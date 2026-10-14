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
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
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
-- Sale Items Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view sale items"
  ON public.sale_items FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Members can insert sale items"
  ON public.sale_items FOR INSERT
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Members can update sale items"
  ON public.sale_items FOR UPDATE
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

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
-- Purchase Items Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view purchase items"
  ON public.purchase_items FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Members can insert purchase items"
  ON public.purchase_items FOR INSERT
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Members can update purchase items"
  ON public.purchase_items FOR UPDATE
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Admins can delete purchase items"
  ON public.purchase_items FOR DELETE
  USING (public.is_business_admin(business_id));

-- ----------------------------------------------------------------------------
-- Inventory Movements Policies (Append-focused audit trail)
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view inventory movements"
  ON public.inventory_movements FOR SELECT
  USING (public.is_business_member(business_id));

CREATE POLICY "Members can insert inventory movements"
  ON public.inventory_movements FOR INSERT
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Admins can update inventory movements"
  ON public.inventory_movements FOR UPDATE
  USING (public.is_business_admin(business_id))
  WITH CHECK (public.is_business_admin(business_id));

CREATE POLICY "Only admins can delete inventory movement records"
  ON public.inventory_movements FOR DELETE
  USING (public.is_business_admin(business_id));
