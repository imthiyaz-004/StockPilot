-- ============================================================================
-- StockPilot Stage 5: Corrective SQL Patch
-- Fixes:
-- 1. Aggregates duplicate product line items in a sale to validate combined quantity against available stock.
-- 2. Sorts product locking by product_id ASC to eliminate deadlock risks across concurrent transactions.
-- 3. Hardens status validation across purchase orders ('ordered', 'pending', 'received').
-- 4. Prevents duplicate product lines in purchases from issuing redundant row updates.
-- 5. Revokes execution from public and anon, granting execute only to authenticated users.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNCTION: public.create_sale_transaction
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_sale_transaction(
  p_business_id UUID,
  p_customer_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_sale_date TIMESTAMPTZ DEFAULT now(),
  p_sale_number TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_sale_id UUID;
  v_sale_number TEXT;
  v_total NUMERIC(12, 2) := 0.00;
  v_item RECORD;
  v_prod_agg RECORD;
  v_prod RECORD;
  v_item_qty NUMERIC(12, 2);
  v_item_price NUMERIC(12, 2);
  v_line_total NUMERIC(12, 2);
  v_created_items JSONB := '[]'::jsonb;
BEGIN
  -- 1. Verify caller authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Verify business membership
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied. You do not belong to this business.';
  END IF;

  -- 3. Validate line items presence
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A sale must contain at least one line item.';
  END IF;

  -- 4. Validate each individual line item input (strictly positive quantity, non-negative price)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_price NUMERIC)
  LOOP
    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'Line item product ID is required.';
    END IF;

    v_item_qty := COALESCE(v_item.quantity, 0);
    IF v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero.';
    END IF;

    v_item_price := COALESCE(v_item.unit_price, 0);
    IF v_item_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative.';
    END IF;

    v_line_total := round(v_item_qty * v_item_price, 2);
    v_total := v_total + v_line_total;
  END LOOP;

  -- 5. Deadlock-free row locking & aggregated stock verification
  -- Products are locked in ascending order of product_id.
  -- Quantities for duplicate product lines are aggregated so the sum cannot exceed available stock.
  FOR v_prod_agg IN
    SELECT
      product_id,
      SUM(quantity) AS total_qty
    FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_price NUMERIC)
    GROUP BY product_id
    ORDER BY product_id ASC
  LOOP
    SELECT id, business_id, name, current_stock, cost_price
    INTO v_prod
    FROM public.products
    WHERE id = v_prod_agg.product_id
    FOR UPDATE;

    IF NOT FOUND OR v_prod.business_id <> p_business_id THEN
      RAISE EXCEPTION 'Product % does not belong to this business.', v_prod_agg.product_id;
    END IF;

    IF v_prod.current_stock < v_prod_agg.total_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product "%": requested %, available %',
        v_prod.name, v_prod_agg.total_qty, v_prod.current_stock;
    END IF;
  END LOOP;

  -- 6. Generate human-readable sale number if not provided
  IF p_sale_number IS NOT NULL AND trim(p_sale_number) <> '' THEN
    v_sale_number := trim(p_sale_number);
  ELSE
    v_sale_number := 'SO-' || to_char(COALESCE(p_sale_date, now()), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
  END IF;

  -- 7. Insert parent sale record
  INSERT INTO public.sales (
    business_id,
    sale_number,
    customer_name,
    status,
    sale_date,
    subtotal,
    tax_amount,
    discount_amount,
    total_amount,
    notes,
    created_by
  ) VALUES (
    p_business_id,
    v_sale_number,
    NULLIF(trim(p_customer_name), ''),
    'completed',
    COALESCE(p_sale_date, now()),
    v_total,
    0.00,
    0.00,
    v_total,
    NULLIF(trim(p_notes), ''),
    v_user_id
  )
  RETURNING id INTO v_sale_id;

  -- 8. Deduct stock per aggregated product (prevents duplicate update issues)
  FOR v_prod_agg IN
    SELECT
      product_id,
      SUM(quantity) AS total_qty
    FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_price NUMERIC)
    GROUP BY product_id
    ORDER BY product_id ASC
  LOOP
    UPDATE public.products
    SET current_stock = current_stock - v_prod_agg.total_qty,
        updated_at = now()
    WHERE id = v_prod_agg.product_id;
  END LOOP;

  -- 9. Insert individual line items and inventory movements
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_price NUMERIC)
  LOOP
    v_item_qty := v_item.quantity;
    v_item_price := v_item.unit_price;
    v_line_total := round(v_item_qty * v_item_price, 2);

    SELECT id, business_id, name, current_stock, cost_price
    INTO v_prod
    FROM public.products
    WHERE id = v_item.product_id;

    INSERT INTO public.sale_items (
      business_id,
      sale_id,
      product_id,
      quantity,
      unit_price,
      unit_cost,
      line_total
    ) VALUES (
      p_business_id,
      v_sale_id,
      v_prod.id,
      v_item_qty,
      v_item_price,
      v_prod.cost_price,
      v_line_total
    );

    INSERT INTO public.inventory_movements (
      business_id,
      product_id,
      movement_type,
      quantity_change,
      reference_type,
      reference_id,
      reason,
      created_by
    ) VALUES (
      p_business_id,
      v_prod.id,
      'sale',
      -v_item_qty,
      'sale',
      v_sale_id,
      'Sale #' || v_sale_number,
      v_user_id
    );

    v_created_items := v_created_items || jsonb_build_object(
      'product_id', v_prod.id,
      'product_name', v_prod.name,
      'quantity', v_item_qty,
      'unit_price', v_item_price,
      'line_total', v_line_total,
      'remaining_stock', v_prod.current_stock
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_sale_id,
    'business_id', p_business_id,
    'sale_number', v_sale_number,
    'customer_name', NULLIF(trim(p_customer_name), ''),
    'status', 'completed',
    'sale_date', COALESCE(p_sale_date, now()),
    'subtotal', v_total,
    'total_amount', v_total,
    'notes', NULLIF(trim(p_notes), ''),
    'items', v_created_items
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. FUNCTION: public.create_purchase_transaction
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_purchase_transaction(
  p_business_id UUID,
  p_supplier_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'ordered',
  p_purchase_date TIMESTAMPTZ DEFAULT now(),
  p_purchase_number TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_purchase_id UUID;
  v_purchase_number TEXT;
  v_status TEXT;
  v_total NUMERIC(12, 2) := 0.00;
  v_item RECORD;
  v_prod_agg RECORD;
  v_prod RECORD;
  v_supp RECORD;
  v_item_qty NUMERIC(12, 2);
  v_item_cost NUMERIC(12, 2);
  v_line_total NUMERIC(12, 2);
  v_created_items JSONB := '[]'::jsonb;
BEGIN
  -- 1. Verify caller authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Verify business membership
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Access denied. You do not belong to this business.';
  END IF;

  -- 3. Validate status
  v_status := LOWER(COALESCE(p_status, 'ordered'));
  IF v_status NOT IN ('ordered', 'pending', 'received') THEN
    RAISE EXCEPTION 'Invalid purchase status: %. Must be ordered, pending, or received.', p_status;
  END IF;

  -- 4. Validate supplier if provided
  IF p_supplier_id IS NOT NULL THEN
    SELECT id, business_id, name INTO v_supp
    FROM public.suppliers
    WHERE id = p_supplier_id;

    IF NOT FOUND OR v_supp.business_id <> p_business_id THEN
      RAISE EXCEPTION 'Supplier % does not belong to this business.', p_supplier_id;
    END IF;
  END IF;

  -- 5. Validate line items presence
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A purchase must contain at least one line item.';
  END IF;

  -- 6. Validate each item values
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_cost NUMERIC)
  LOOP
    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'Line item product ID is required.';
    END IF;

    v_item_qty := COALESCE(v_item.quantity, 0);
    IF v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero.';
    END IF;

    v_item_cost := COALESCE(v_item.unit_cost, 0);
    IF v_item_cost < 0 THEN
      RAISE EXCEPTION 'Unit cost cannot be negative.';
    END IF;

    v_line_total := round(v_item_qty * v_item_cost, 2);
    v_total := v_total + v_line_total;
  END LOOP;

  -- 7. Deadlock-free product verification in product_id ascending order
  FOR v_prod_agg IN
    SELECT product_id
    FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_cost NUMERIC)
    GROUP BY product_id
    ORDER BY product_id ASC
  LOOP
    SELECT id, business_id, name, current_stock, cost_price
    INTO v_prod
    FROM public.products
    WHERE id = v_prod_agg.product_id
    FOR UPDATE;

    IF NOT FOUND OR v_prod.business_id <> p_business_id THEN
      RAISE EXCEPTION 'Product % does not belong to this business.', v_prod_agg.product_id;
    END IF;
  END LOOP;

  -- 8. Generate purchase number
  IF p_purchase_number IS NOT NULL AND trim(p_purchase_number) <> '' THEN
    v_purchase_number := trim(p_purchase_number);
  ELSE
    v_purchase_number := 'PO-' || to_char(COALESCE(p_purchase_date, now()), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
  END IF;

  -- 9. Insert parent purchase record
  INSERT INTO public.purchases (
    business_id,
    supplier_id,
    purchase_number,
    status,
    purchase_date,
    total_amount,
    notes,
    created_by
  ) VALUES (
    p_business_id,
    p_supplier_id,
    v_purchase_number,
    v_status,
    COALESCE(p_purchase_date, now()),
    v_total,
    NULLIF(trim(p_notes), ''),
    v_user_id
  )
  RETURNING id INTO v_purchase_id;

  -- 10. If received immediately, update stock per aggregated product
  IF v_status = 'received' THEN
    FOR v_prod_agg IN
      SELECT
        product_id,
        SUM(quantity) AS total_qty
      FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_cost NUMERIC)
      GROUP BY product_id
      ORDER BY product_id ASC
    LOOP
      UPDATE public.products
      SET current_stock = current_stock + v_prod_agg.total_qty,
          updated_at = now()
      WHERE id = v_prod_agg.product_id;
    END LOOP;
  END IF;

  -- 11. Insert purchase items and inventory movements
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_cost NUMERIC)
  LOOP
    v_item_qty := v_item.quantity;
    v_item_cost := v_item.unit_cost;
    v_line_total := round(v_item_qty * v_item_cost, 2);

    SELECT id, business_id, name, current_stock, cost_price
    INTO v_prod
    FROM public.products
    WHERE id = v_item.product_id;

    INSERT INTO public.purchase_items (
      business_id,
      purchase_id,
      product_id,
      quantity,
      unit_cost,
      line_total
    ) VALUES (
      p_business_id,
      v_purchase_id,
      v_prod.id,
      v_item_qty,
      v_item_cost,
      v_line_total
    );

    IF v_status = 'received' THEN
      INSERT INTO public.inventory_movements (
        business_id,
        product_id,
        movement_type,
        quantity_change,
        reference_type,
        reference_id,
        reason,
        created_by
      ) VALUES (
        p_business_id,
        v_prod.id,
        'purchase',
        v_item_qty,
        'purchase',
        v_purchase_id,
        'Purchase #' || v_purchase_number || ' received',
        v_user_id
      );
    END IF;

    v_created_items := v_created_items || jsonb_build_object(
      'product_id', v_prod.id,
      'product_name', v_prod.name,
      'quantity', v_item_qty,
      'unit_cost', v_item_cost,
      'line_total', v_line_total
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_purchase_id,
    'business_id', p_business_id,
    'supplier_id', p_supplier_id,
    'purchase_number', v_purchase_number,
    'status', v_status,
    'purchase_date', COALESCE(p_purchase_date, now()),
    'total_amount', v_total,
    'notes', NULLIF(trim(p_notes), ''),
    'items', v_created_items
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. FUNCTION: public.receive_purchase_transaction
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_purchase_transaction(
  p_purchase_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_purchase RECORD;
  v_item RECORD;
  v_prod_agg RECORD;
  v_prod RECORD;
  v_updated_items JSONB := '[]'::jsonb;
BEGIN
  -- 1. Verify caller authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Lock target purchase row first to serialize concurrent receive attempts
  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found.';
  END IF;

  -- 3. Verify business membership
  IF NOT public.is_business_member(v_purchase.business_id) THEN
    RAISE EXCEPTION 'Access denied. You do not belong to this business.';
  END IF;

  -- 4. Enforce state transition constraints
  IF v_purchase.status = 'received' THEN
    RAISE EXCEPTION 'Purchase order % has already been received.', v_purchase.purchase_number;
  END IF;

  IF v_purchase.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot receive a cancelled purchase order.';
  END IF;

  -- 5. Lock products in deterministic product_id order and increase stock
  FOR v_prod_agg IN
    SELECT
      pi.product_id,
      SUM(pi.quantity) AS total_qty
    FROM public.purchase_items pi
    WHERE pi.purchase_id = p_purchase_id
    GROUP BY pi.product_id
    ORDER BY pi.product_id ASC
  LOOP
    SELECT id, business_id, name, current_stock
    INTO v_prod
    FROM public.products
    WHERE id = v_prod_agg.product_id AND business_id = v_purchase.business_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % in purchase order no longer exists or does not belong to this business.', v_prod_agg.product_id;
    END IF;

    UPDATE public.products
    SET current_stock = current_stock + v_prod_agg.total_qty,
        updated_at = now()
    WHERE id = v_prod.id;
  END LOOP;

  -- 6. Record inventory movements for all items in the purchase order
  FOR v_item IN
    SELECT pi.product_id, pi.quantity, pi.unit_cost, p.name AS product_name
    FROM public.purchase_items pi
    JOIN public.products p ON p.id = pi.product_id
    WHERE pi.purchase_id = p_purchase_id
  LOOP
    INSERT INTO public.inventory_movements (
      business_id,
      product_id,
      movement_type,
      quantity_change,
      reference_type,
      reference_id,
      reason,
      created_by
    ) VALUES (
      v_purchase.business_id,
      v_item.product_id,
      'purchase',
      v_item.quantity,
      'purchase',
      v_purchase.id,
      'Purchase #' || v_purchase.purchase_number || ' received',
      v_user_id
    );

    v_updated_items := v_updated_items || jsonb_build_object(
      'product_id', v_item.product_id,
      'product_name', v_item.product_name,
      'quantity_added', v_item.quantity
    );
  END LOOP;

  -- 7. Transition purchase status to 'received'
  UPDATE public.purchases
  SET status = 'received',
      updated_at = now()
  WHERE id = v_purchase.id;

  RETURN jsonb_build_object(
    'id', v_purchase.id,
    'business_id', v_purchase.business_id,
    'purchase_number', v_purchase.purchase_number,
    'status', 'received',
    'total_amount', v_purchase.total_amount,
    'received_at', now(),
    'items', v_updated_items
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. HARDEN EXECUTION PRIVILEGES (EXPLICIT PARAMETER SIGNATURES)
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_sale_transaction(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.create_purchase_transaction(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_transaction(UUID) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.create_sale_transaction(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_transaction(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase_transaction(UUID) TO authenticated;
