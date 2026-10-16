const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Enforce authentication on all sales routes
router.use(requireAuth);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Helper to verify user membership in a business.
 */
async function verifyBusinessMembership(supabase, businessId) {
  if (!businessId || !UUID_REGEX.test(businessId)) {
    return { authorized: false, error: 'Invalid or missing business ID format.' };
  }

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
 * Format a sale object for consistent API output
 */
function formatSale(s) {
  const items = Array.isArray(s.sale_items)
    ? s.sale_items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products ? item.products.name : 'Unknown Product',
        sku: item.products ? item.products.sku : null,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        unit_cost: Number(item.unit_cost),
        line_total: Number(item.line_total),
        created_at: item.created_at
      }))
    : [];

  return {
    id: s.id,
    business_id: s.business_id,
    sale_number: s.sale_number,
    customer_name: s.customer_name || 'Walk-in Customer',
    status: s.status,
    sale_date: s.sale_date,
    subtotal: Number(s.subtotal || 0),
    tax_amount: Number(s.tax_amount || 0),
    discount_amount: Number(s.discount_amount || 0),
    total_amount: Number(s.total_amount || 0),
    item_count: items.reduce((acc, curr) => acc + curr.quantity, 0),
    line_item_count: items.length,
    notes: s.notes || null,
    created_by: s.created_by,
    created_at: s.created_at,
    updated_at: s.updated_at,
    items
  };
}

/**
 * GET /api/sales?businessId=...
 * Retrieves list of sales for an authorized business.
 */
router.get('/', async (req, res, next) => {
  try {
    const { businessId, search, status, limit } = req.query;

    const authCheck = await verifyBusinessMembership(req.supabase, businessId);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    let query = req.supabase
      .from('sales')
      .select(`
        id,
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
        created_by,
        created_at,
        updated_at,
        sale_items (
          id,
          product_id,
          quantity,
          unit_price,
          unit_cost,
          line_total,
          created_at,
          products (
            id,
            name,
            sku
          )
        )
      `)
      .eq('business_id', businessId)
      .order('sale_date', { ascending: false });

    if (status && typeof status === 'string' && status.trim() !== '' && status !== 'all') {
      query = query.eq('status', status.trim());
    }

    const maxRows = Number(limit) > 0 && Number(limit) <= 500 ? Number(limit) : 100;
    query = query.limit(maxRows);

    const { data: sales, error } = await query;

    if (error) {
      return res.status(500).json({
        error: 'Failed to retrieve sales.',
        details: error.message
      });
    }

    let formattedSales = (sales || []).map(formatSale);

    // Optional customer / sale_number client search filter
    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = search.trim().toLowerCase();
      formattedSales = formattedSales.filter(
        (s) =>
          s.sale_number.toLowerCase().includes(term) ||
          s.customer_name.toLowerCase().includes(term)
      );
    }

    return res.status(200).json({
      status: 'ok',
      count: formattedSales.length,
      sales: formattedSales
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sales/:id
 * Retrieves a single sale record with full line items.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Valid sale ID is required.' });
    }

    const { data: sale, error } = await req.supabase
      .from('sales')
      .select(`
        id,
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
        created_by,
        created_at,
        updated_at,
        sale_items (
          id,
          product_id,
          quantity,
          unit_price,
          unit_cost,
          line_total,
          created_at,
          products (
            id,
            name,
            sku
          )
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: 'Failed to retrieve sale details.',
        details: error.message
      });
    }

    if (!sale) {
      return res.status(404).json({ error: 'Sale record not found.' });
    }

    // Verify user membership in the sale's business
    const authCheck = await verifyBusinessMembership(req.supabase, sale.business_id);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    return res.status(200).json({
      status: 'ok',
      sale: formatSale(sale)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sales
 * Creates a sale atomically via PostgreSQL RPC create_sale_transaction.
 * Validates business membership, item quantities, stock levels, and backend totals.
 */
router.post('/', async (req, res, next) => {
  try {
    const { business_id, customer_name, notes, sale_date, items } = req.body || {};

    // 1. Validate business membership
    const authCheck = await verifyBusinessMembership(req.supabase, business_id);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    // 2. Validate line items payload
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Sale must include at least one valid line item.'
      });
    }

    const cleanedItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id || !UUID_REGEX.test(item.product_id)) {
        return res.status(400).json({
          error: `Item #${i + 1}: A valid product ID is required.`
        });
      }

      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          error: `Item #${i + 1}: Quantity must be greater than zero.`
        });
      }

      const price = Number(item.unit_price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          error: `Item #${i + 1}: Unit price cannot be negative.`
        });
      }

      cleanedItems.push({
        product_id: item.product_id,
        quantity: Math.round(qty * 100) / 100,
        unit_price: Math.round(price * 100) / 100
      });
    }

    // 3. Execute atomic transaction in PostgreSQL via RPC
    const { data: saleResult, error: rpcError } = await req.supabase.rpc('create_sale_transaction', {
      p_business_id: business_id,
      p_customer_name: customer_name ? customer_name.trim() : null,
      p_notes: notes ? notes.trim() : null,
      p_sale_date: sale_date ? new Date(sale_date).toISOString() : new Date().toISOString(),
      p_items: cleanedItems
    });

    if (rpcError) {
      // Check for custom exception messages raised by the transaction function
      const msg = rpcError.message || '';

      if (msg.includes('Insufficient stock')) {
        return res.status(400).json({
          error: msg,
          type: 'INSUFFICIENT_STOCK'
        });
      }

      if (msg.includes('does not belong to this business') || msg.includes('Access denied')) {
        return res.status(403).json({
          error: msg,
          type: 'AUTHORIZATION_ERROR'
        });
      }

      if (msg.includes('Could not find the function') || msg.includes('schema cache')) {
        return res.status(503).json({
          error: "Database procedure 'create_sale_transaction' has not been installed yet. Please execute the Stage 5 database script in Supabase SQL editor.",
          type: 'RPC_NOT_INSTALLED'
        });
      }

      return res.status(400).json({
        error: msg || 'Failed to complete sale transaction.',
        details: rpcError.details
      });
    }

    return res.status(201).json({
      status: 'created',
      message: 'Sale successfully recorded and inventory updated.',
      sale: saleResult
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
