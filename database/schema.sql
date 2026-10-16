-- ============================================================================
-- StockPilot: PostgreSQL Schema & Row Level Security Policies
-- Platform: Supabase PostgreSQL (Multi-Tenant Architecture)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Automated updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TENANT & MEMBERSHIP TABLES
-- ============================================================================

-- Businesses (Tenants)
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  industry TEXT,
  location TEXT,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business Members (Team access & roles)
CREATE TABLE public.business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_business_members_business_user UNIQUE (business_id, user_id)
);

-- Automated membership verification helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_business_member(target_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = target_business_id AND b.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = target_business_id AND bm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_business_admin(target_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = target_business_id AND b.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = target_business_id 
      AND bm.user_id = auth.uid() 
      AND bm.role IN ('owner', 'admin')
  );
$$;

-- ============================================================================
-- 3. CORE DOMAIN TABLES
-- ============================================================================

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_suppliers_business_name UNIQUE (business_id, name)
);

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  sku TEXT,
  barcode TEXT,
  description TEXT,
  category TEXT,
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
  selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (selling_price >= 0),
  current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (current_stock >= 0),
  reorder_level NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (reorder_level >= 0),
  unit TEXT NOT NULL DEFAULT 'units',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales (Invoices / Outgoing Orders)
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sale_number TEXT NOT NULL,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'pending', 'completed', 'cancelled', 'refunded')),
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sales_business_number UNIQUE (business_id, sale_number)
);

-- Sale Items (Multi-line sale details)
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchases (Supplier Orders / Restocking)
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('ordered', 'pending', 'received', 'cancelled')),
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_purchases_business_number UNIQUE (business_id, purchase_number)
);

-- Purchase Items (Multi-line purchase details)
CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inventory Movements (Audit trail of every stock change)
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'sale',
    'purchase',
    'adjustment_in',
    'adjustment_out',
    'return_customer',
    'return_supplier',
    'damaged',
    'audit'
  )),
  quantity_change NUMERIC(12, 2) NOT NULL CHECK (quantity_change <> 0),
  reference_type TEXT CHECK (reference_type IN ('sale', 'purchase', 'manual', 'audit', 'other')),
  reference_id UUID,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. TIMESTAMPTZ UPDATE TRIGGERS
-- ============================================================================

CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_business_members_updated_at
  BEFORE UPDATE ON public.business_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-assign creator as owner in business_members table
CREATE OR REPLACE FUNCTION public.handle_new_business()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (business_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_businesses_auto_owner_member
  AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_business();

-- ============================================================================
-- 5. PERFORMANCE INDEXES
-- ============================================================================

-- Businesses & Members
CREATE INDEX idx_businesses_owner ON public.businesses(owner_id);
CREATE INDEX idx_business_members_business ON public.business_members(business_id);
CREATE INDEX idx_business_members_user ON public.business_members(user_id);

-- Suppliers
CREATE INDEX idx_suppliers_business ON public.suppliers(business_id);

-- Products
CREATE INDEX idx_products_business ON public.products(business_id);
CREATE INDEX idx_products_supplier ON public.products(supplier_id);
CREATE INDEX idx_products_business_category ON public.products(business_id, category);
CREATE INDEX idx_products_reorder_alert ON public.products(business_id, current_stock, reorder_level);
CREATE UNIQUE INDEX idx_products_business_sku ON public.products(business_id, sku) WHERE sku IS NOT NULL;

-- Sales & Line Items
CREATE INDEX idx_sales_business_date ON public.sales(business_id, sale_date DESC);
CREATE INDEX idx_sales_business_status ON public.sales(business_id, status);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items(product_id);
CREATE INDEX idx_sale_items_business ON public.sale_items(business_id);

-- Purchases & Line Items
CREATE INDEX idx_purchases_business_date ON public.purchases(business_id, purchase_date DESC);
CREATE INDEX idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_product ON public.purchase_items(product_id);
CREATE INDEX idx_purchase_items_business ON public.purchase_items(business_id);

-- Inventory Movements
CREATE INDEX idx_inventory_movements_product ON public.inventory_movements(product_id, created_at DESC);
CREATE INDEX idx_inventory_movements_business_created ON public.inventory_movements(business_id, created_at DESC);
CREATE INDEX idx_inventory_movements_reference ON public.inventory_movements(reference_id);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Businesses Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view businesses they own or belong to"
  ON public.businesses FOR SELECT
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create businesses"
  ON public.businesses FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Business owners and admins can update business details"
  ON public.businesses FOR UPDATE
  USING (public.is_business_admin(id))
  WITH CHECK (public.is_business_admin(id));

CREATE POLICY "Only business owner can delete a business"
  ON public.businesses FOR DELETE
  USING (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Business Members Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view other members in the same business"
  ON public.business_members FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Admins can add members to their business"
  ON public.business_members FOR INSERT
  WITH CHECK (public.is_business_admin(business_id));

CREATE POLICY "Admins can update membership roles"
  ON public.business_members FOR UPDATE
  USING (public.is_business_admin(business_id))
  WITH CHECK (public.is_business_admin(business_id));

CREATE POLICY "Admins can remove members or members can leave"
  ON public.business_members FOR DELETE
  USING (public.is_business_admin(business_id) OR user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Suppliers Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view suppliers"
  ON public.suppliers FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Members can insert suppliers"
  ON public.suppliers FOR INSERT
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Members can update suppliers"
  ON public.suppliers FOR UPDATE
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Admins can delete suppliers"
  ON public.suppliers FOR DELETE
  USING (public.is_business_admin(business_id));

-- ----------------------------------------------------------------------------
-- Products Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view products"
  ON public.products FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Members can insert products"
  ON public.products FOR INSERT
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Members can update products"
  ON public.products FOR UPDATE
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  USING (public.is_business_admin(business_id));

-- ----------------------------------------------------------------------------
-- Sales Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view sales"
  ON public.sales FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Members can record sales"
  ON public.sales FOR INSERT
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Members can update sales"
  ON public.sales FOR UPDATE
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Admins can delete sales records"
  ON public.sales FOR DELETE
  USING (public.is_business_admin(business_id));

-- ----------------------------------------------------------------------------
-- Sale Items Policies (Enforces parent sale and product tenant match)
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view sale items"
  ON public.sale_items FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Members can insert sale items"
  ON public.sale_items FOR INSERT
  WITH CHECK (
    public.is_business_member(business_id) AND
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id AND s.business_id = sale_items.business_id
    ) AND
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.business_id = sale_items.business_id
    )
  );

CREATE POLICY "Members can update sale items"
  ON public.sale_items FOR UPDATE
  USING (public.is_business_member(business_id))
  WITH CHECK (
    public.is_business_member(business_id) AND
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id AND s.business_id = sale_items.business_id
    ) AND
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.business_id = sale_items.business_id
    )
  );

CREATE POLICY "Admins can delete sale items"
  ON public.sale_items FOR DELETE
  USING (public.is_business_admin(business_id));

-- ----------------------------------------------------------------------------
-- Purchases Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view purchases"
  ON public.purchases FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Members can record purchases"
  ON public.purchases FOR INSERT
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Members can update purchases"
  ON public.purchases FOR UPDATE
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Admins can delete purchases"
  ON public.purchases FOR DELETE
  USING (public.is_business_admin(business_id));

-- ----------------------------------------------------------------------------
-- Purchase Items Policies (Enforces parent purchase and product tenant match)
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view purchase items"
  ON public.purchase_items FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Members can insert purchase items"
  ON public.purchase_items FOR INSERT
  WITH CHECK (
    public.is_business_member(business_id) AND
    EXISTS (
      SELECT 1 FROM public.purchases pu
      WHERE pu.id = purchase_id AND pu.business_id = purchase_items.business_id
    ) AND
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.business_id = purchase_items.business_id
    )
  );

CREATE POLICY "Members can update purchase items"
  ON public.purchase_items FOR UPDATE
  USING (public.is_business_member(business_id))
  WITH CHECK (
    public.is_business_member(business_id) AND
    EXISTS (
      SELECT 1 FROM public.purchases pu
      WHERE pu.id = purchase_id AND pu.business_id = purchase_items.business_id
    ) AND
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.business_id = purchase_items.business_id
    )
  );

CREATE POLICY "Admins can delete purchase items"
  ON public.purchase_items FOR DELETE
  USING (public.is_business_admin(business_id));

-- ----------------------------------------------------------------------------
-- Inventory Movements Policies (Append-focused audit trail with product match)
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view inventory movements"
  ON public.inventory_movements FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Members can insert inventory movements"
  ON public.inventory_movements FOR INSERT
  WITH CHECK (
    public.is_business_member(business_id) AND
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.business_id = inventory_movements.business_id
    )
  );

CREATE POLICY "Admins can update inventory movements"
  ON public.inventory_movements FOR UPDATE
  USING (public.is_business_admin(business_id))
  WITH CHECK (public.is_business_admin(business_id));

CREATE POLICY "Only admins can delete inventory movement records"
  ON public.inventory_movements FOR DELETE
  USING (public.is_business_admin(business_id));

-- ============================================================================
-- 7. ATOMIC TRANSACTION PROCEDURES (STAGE 5: SALES, PURCHASES & MOVEMENTS)
-- ============================================================================

-- Function: Atomic Sale Creation & Stock Deduction
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

-- Function: Atomic Purchase Creation & Conditional Stock Receipt
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

-- Function: Atomic Receive Purchase Order & Update Stock
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

-- Hardened execution privileges (explicit parameter signatures)
REVOKE EXECUTE ON FUNCTION public.create_sale_transaction(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.create_purchase_transaction(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_transaction(UUID) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.create_sale_transaction(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_transaction(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase_transaction(UUID) TO authenticated;
