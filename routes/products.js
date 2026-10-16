const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Enforce authentication on all product routes
router.use(requireAuth);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Helper to verify user membership in a business.
 * Prevents unauthorized or cross-business operations.
 */
async function verifyBusinessMembership(supabase, businessId) {
  if (!businessId || !UUID_REGEX.test(businessId)) {
    return { authorized: false, error: 'Invalid or missing business ID format.' };
  }

  // RLS ensures only businesses where user is owner or member are returned
  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, currency')
    .eq('id', businessId)
    .maybeSingle();

  if (error || !business) {
    return { authorized: false, error: 'Access denied. You do not belong to this business.' };
  }

  return { authorized: true, business };
}

/**
 * Format a product row ensuring consistent field aliases
 */
function formatProduct(p) {
  const cost = Number(p.cost_price || 0);
  const stock = Number(p.current_stock || 0);
  const minStock = Number(p.reorder_level || 0);

  let stockStatus = 'in_stock';
  if (stock === 0) {
    stockStatus = 'out_of_stock';
  } else if (stock <= minStock) {
    stockStatus = 'low_stock';
  }

  return {
    id: p.id,
    business_id: p.business_id,
    name: p.name,
    sku: p.sku || null,
    category: p.category || 'Uncategorized',
    purchase_price: cost,
    cost_price: cost,
    selling_price: Number(p.selling_price || 0),
    current_stock: stock,
    minimum_stock: minStock,
    reorder_level: minStock,
    inventory_value: Math.round(cost * stock * 100) / 100,
    stock_status: stockStatus,
    supplier_id: p.supplier_id || null,
    supplier: p.suppliers ? { id: p.suppliers.id, name: p.suppliers.name } : null,
    unit: p.unit || 'units',
    is_active: p.is_active ?? true,
    created_at: p.created_at,
    updated_at: p.updated_at
  };
}

/**
 * GET /api/products?businessId=...
 * Retrieves products for an authorized business with optional search, filtering, and sorting.
 */
router.get('/', async (req, res, next) => {
  try {
    const { businessId, search, category, stockStatus, sortBy, sortOrder } = req.query;

    const authCheck = await verifyBusinessMembership(req.supabase, businessId);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    let query = req.supabase
      .from('products')
      .select('*, suppliers(id, name)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    // Optional server-side category filter
    if (category && typeof category === 'string' && category.trim() !== '') {
      query = query.eq('category', category.trim());
    }

    const { data: rawProducts, error } = await query;

    if (error) {
      return res.status(500).json({
        error: 'Failed to retrieve products.',
        details: error.message
      });
    }

    let products = (rawProducts || []).map(formatProduct);

    // In-memory search filter (name or sku)
    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      products = products.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    // In-memory stock status filter
    if (stockStatus && typeof stockStatus === 'string' && stockStatus !== 'all') {
      products = products.filter(p => p.stock_status === stockStatus);
    }

    // Sorting
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      products.sort((a, b) => {
        if (sortBy === 'name') {
          return order * a.name.localeCompare(b.name);
        }
        if (sortBy === 'current_stock') {
          return order * (a.current_stock - b.current_stock);
        }
        if (sortBy === 'selling_price') {
          return order * (a.selling_price - b.selling_price);
        }
        if (sortBy === 'inventory_value') {
          return order * (a.inventory_value - b.inventory_value);
        }
        return 0;
      });
    }

    return res.status(200).json({
      status: 'ok',
      count: products.length,
      products
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id
 * Retrieves a single product by ID. RLS enforces business membership.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid product ID format.' });
    }

    const { data: product, error } = await req.supabase
      .from('products')
      .select('*, suppliers(id, name)')
      .eq('id', id)
      .maybeSingle();

    if (error || !product) {
      return res.status(404).json({ error: 'Product not found or access denied.' });
    }

    return res.status(200).json({
      status: 'ok',
      product: formatProduct(product)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/products
 * Creates a new product for an authorized business.
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      business_id,
      name,
      sku,
      category,
      purchase_price,
      cost_price,
      selling_price,
      current_stock,
      minimum_stock,
      reorder_level,
      supplier_id,
      unit
    } = req.body || {};

    // 1. Authorize user against business
    const authCheck = await verifyBusinessMembership(req.supabase, business_id);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    // 2. Validate Product Name
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 150) {
      return res.status(400).json({
        error: 'Product name is required and must be between 2 and 150 characters.'
      });
    }

    // 3. Validate Prices & Quantities (Reject negative values)
    const cost = Number(purchase_price !== undefined ? purchase_price : cost_price);
    const selling = Number(selling_price);
    const stock = Number(current_stock !== undefined ? current_stock : 0);
    const minStock = Number(minimum_stock !== undefined ? minimum_stock : (reorder_level !== undefined ? reorder_level : 0));

    if (isNaN(cost) || cost < 0) {
      return res.status(400).json({ error: 'Purchase price must be a non-negative number.' });
    }
    if (isNaN(selling) || selling < 0) {
      return res.status(400).json({ error: 'Selling price must be a non-negative number.' });
    }
    if (isNaN(stock) || stock < 0) {
      return res.status(400).json({ error: 'Stock quantity cannot be negative.' });
    }
    if (isNaN(minStock) || minStock < 0) {
      return res.status(400).json({ error: 'Minimum stock threshold cannot be negative.' });
    }

    // 4. Validate SKU (Optional, max 50 chars, uppercase trimmed)
    let sanitizedSku = null;
    if (sku && typeof sku === 'string' && sku.trim().length > 0) {
      sanitizedSku = sku.trim().toUpperCase();
      if (sanitizedSku.length > 50) {
        return res.status(400).json({ error: 'SKU must not exceed 50 characters.' });
      }

      // Check SKU uniqueness within this business
      const { data: existingSku } = await req.supabase
        .from('products')
        .select('id')
        .eq('business_id', business_id)
        .eq('sku', sanitizedSku)
        .maybeSingle();

      if (existingSku) {
        return res.status(400).json({
          error: `A product with SKU "${sanitizedSku}" already exists in this business.`
        });
      }
    }

    // 5. Validate Supplier Association (Must belong to the same business)
    let sanitizedSupplierId = null;
    if (supplier_id && typeof supplier_id === 'string' && supplier_id.trim() !== '') {
      if (!UUID_REGEX.test(supplier_id)) {
        return res.status(400).json({ error: 'Invalid supplier ID format.' });
      }

      const { data: supplier, error: suppErr } = await req.supabase
        .from('suppliers')
        .select('id, business_id')
        .eq('id', supplier_id)
        .maybeSingle();

      if (suppErr || !supplier || supplier.business_id !== business_id) {
        return res.status(400).json({
          error: 'Selected supplier was not found or belongs to a different business.'
        });
      }
      sanitizedSupplierId = supplier.id;
    }

    // 6. Insert Product into PostgreSQL
    const insertPayload = {
      business_id,
      name: name.trim(),
      sku: sanitizedSku,
      category: category && typeof category === 'string' && category.trim().length > 0 ? category.trim() : 'General',
      cost_price: cost,
      selling_price: selling,
      current_stock: stock,
      reorder_level: minStock,
      supplier_id: sanitizedSupplierId,
      unit: unit && typeof unit === 'string' && unit.trim().length > 0 ? unit.trim() : 'units'
    };

    const { data: createdProduct, error: insertError } = await req.supabase
      .from('products')
      .insert(insertPayload)
      .select('*, suppliers(id, name)')
      .single();

    if (insertError) {
      if (insertError.message.includes('idx_products_business_sku')) {
        return res.status(400).json({
          error: `A product with SKU "${sanitizedSku}" already exists in this business.`
        });
      }
      return res.status(400).json({
        error: 'Failed to create product.',
        details: insertError.message
      });
    }

    return res.status(201).json({
      status: 'created',
      message: 'Product created successfully.',
      product: formatProduct(createdProduct)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/products/:id
 * Updates an existing product.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid product ID format.' });
    }

    // Verify existing product access via RLS
    const { data: existing, error: existErr } = await req.supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existErr || !existing) {
      return res.status(404).json({ error: 'Product not found or access denied.' });
    }

    const {
      name,
      sku,
      category,
      purchase_price,
      cost_price,
      selling_price,
      current_stock,
      minimum_stock,
      reorder_level,
      supplier_id,
      unit
    } = req.body || {};

    const updatePayload = {};

    // Validate Name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 150) {
        return res.status(400).json({ error: 'Product name must be between 2 and 150 characters.' });
      }
      updatePayload.name = name.trim();
    }

    // Validate Prices
    if (purchase_price !== undefined || cost_price !== undefined) {
      const cost = Number(purchase_price !== undefined ? purchase_price : cost_price);
      if (isNaN(cost) || cost < 0) {
        return res.status(400).json({ error: 'Purchase price must be a non-negative number.' });
      }
      updatePayload.cost_price = cost;
    }

    if (selling_price !== undefined) {
      const selling = Number(selling_price);
      if (isNaN(selling) || selling < 0) {
        return res.status(400).json({ error: 'Selling price must be a non-negative number.' });
      }
      updatePayload.selling_price = selling;
    }

    // Validate Quantities
    if (current_stock !== undefined) {
      const stock = Number(current_stock);
      if (isNaN(stock) || stock < 0) {
        return res.status(400).json({ error: 'Stock quantity cannot be negative.' });
      }
      updatePayload.current_stock = stock;
    }

    if (minimum_stock !== undefined || reorder_level !== undefined) {
      const minStock = Number(minimum_stock !== undefined ? minimum_stock : reorder_level);
      if (isNaN(minStock) || minStock < 0) {
        return res.status(400).json({ error: 'Minimum stock threshold cannot be negative.' });
      }
      updatePayload.reorder_level = minStock;
    }

    // Validate SKU
    if (sku !== undefined) {
      if (sku && typeof sku === 'string' && sku.trim().length > 0) {
        const sanitizedSku = sku.trim().toUpperCase();
        if (sanitizedSku.length > 50) {
          return res.status(400).json({ error: 'SKU must not exceed 50 characters.' });
        }

        // Check if SKU taken by another product in this business
        const { data: duplicate } = await req.supabase
          .from('products')
          .select('id')
          .eq('business_id', existing.business_id)
          .eq('sku', sanitizedSku)
          .neq('id', id)
          .maybeSingle();

        if (duplicate) {
          return res.status(400).json({
            error: `A product with SKU "${sanitizedSku}" already exists in this business.`
          });
        }
        updatePayload.sku = sanitizedSku;
      } else {
        updatePayload.sku = null;
      }
    }

    // Validate Category
    if (category !== undefined) {
      updatePayload.category = typeof category === 'string' && category.trim().length > 0 ? category.trim() : 'General';
    }

    // Validate Unit
    if (unit !== undefined) {
      updatePayload.unit = typeof unit === 'string' && unit.trim().length > 0 ? unit.trim() : 'units';
    }

    // Validate Supplier
    if (supplier_id !== undefined) {
      if (supplier_id && typeof supplier_id === 'string' && supplier_id.trim() !== '') {
        if (!UUID_REGEX.test(supplier_id)) {
          return res.status(400).json({ error: 'Invalid supplier ID format.' });
        }
        const { data: supplier, error: suppErr } = await req.supabase
          .from('suppliers')
          .select('id, business_id')
          .eq('id', supplier_id)
          .maybeSingle();

        if (suppErr || !supplier || supplier.business_id !== existing.business_id) {
          return res.status(400).json({
            error: 'Selected supplier was not found or belongs to a different business.'
          });
        }
        updatePayload.supplier_id = supplier.id;
      } else {
        updatePayload.supplier_id = null;
      }
    }

    const { data: updatedProduct, error: updateErr } = await req.supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select('*, suppliers(id, name)')
      .single();

    if (updateErr) {
      return res.status(400).json({
        error: 'Failed to update product.',
        details: updateErr.message
      });
    }

    return res.status(200).json({
      status: 'ok',
      message: 'Product updated successfully.',
      product: formatProduct(updatedProduct)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/products/:id
 * Deletes a product.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid product ID format.' });
    }

    // Verify existing product access via RLS
    const { data: existing, error: existErr } = await req.supabase
      .from('products')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    if (existErr || !existing) {
      return res.status(404).json({ error: 'Product not found or access denied.' });
    }

    const { error: deleteErr } = await req.supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      // Check foreign key constraint restrictions (e.g. sale_items references)
      if (deleteErr.message.includes('violates foreign key constraint')) {
        return res.status(400).json({
          error: 'Cannot delete product because it has associated sales or purchase transactions.'
        });
      }
      return res.status(400).json({
        error: 'Failed to delete product.',
        details: deleteErr.message
      });
    }

    return res.status(200).json({
      status: 'ok',
      message: `Product "${existing.name}" deleted successfully.`
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id/movements
 * Returns the audit trail of inventory movements for a product.
 */
router.get('/:id/movements', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid product ID format.' });
    }

    const { data: product, error: prodErr } = await req.supabase
      .from('products')
      .select('id, business_id, name, current_stock')
      .eq('id', id)
      .maybeSingle();

    if (prodErr || !product) {
      return res.status(404).json({ error: 'Product not found or access denied.' });
    }

    const { data: movements, error: movErr } = await req.supabase
      .from('inventory_movements')
      .select('id, movement_type, quantity_change, reference_type, reference_id, reason, created_by, created_at')
      .eq('product_id', id)
      .order('created_at', { ascending: false });

    if (movErr) {
      return res.status(500).json({ error: 'Failed to retrieve movements.', details: movErr.message });
    }

    return res.status(200).json({
      status: 'ok',
      product: {
        id: product.id,
        name: product.name,
        current_stock: Number(product.current_stock)
      },
      movements: movements || []
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
