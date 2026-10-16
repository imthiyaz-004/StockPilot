const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Enforce authentication on all purchase routes
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
 * Format a purchase object for consistent API output
 */
function formatPurchase(p) {
  const items = Array.isArray(p.purchase_items)
    ? p.purchase_items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products ? item.products.name : 'Unknown Product',
        sku: item.products ? item.products.sku : null,
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost),
        line_total: Number(item.line_total),
        created_at: item.created_at
      }))
    : [];

  return {
    id: p.id,
    business_id: p.business_id,
    supplier_id: p.supplier_id || null,
    supplier: p.suppliers ? { id: p.suppliers.id, name: p.suppliers.name } : null,
    purchase_number: p.purchase_number,
    status: p.status,
    purchase_date: p.purchase_date,
    total_amount: Number(p.total_amount || 0),
    item_count: items.reduce((acc, curr) => acc + curr.quantity, 0),
    line_item_count: items.length,
    notes: p.notes || null,
    created_by: p.created_by,
    created_at: p.created_at,
    updated_at: p.updated_at,
    items
  };
}

/**
 * GET /api/purchases?businessId=...
 * Retrieves purchases for an authorized business.
 */
router.get('/', async (req, res, next) => {
  try {
    const { businessId, status, supplierId, limit } = req.query;

    const authCheck = await verifyBusinessMembership(req.supabase, businessId);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    let query = req.supabase
      .from('purchases')
      .select(`
        id,
        business_id,
        supplier_id,
        purchase_number,
        status,
        purchase_date,
        total_amount,
        notes,
        created_by,
        created_at,
        updated_at,
        suppliers (
          id,
          name,
          contact_name
        ),
        purchase_items (
          id,
          product_id,
          quantity,
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
      .order('purchase_date', { ascending: false });

    if (status && typeof status === 'string' && status.trim() !== '' && status !== 'all') {
      const statuses = status.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in('status', statuses);
      }
    }

    if (supplierId && UUID_REGEX.test(supplierId)) {
      query = query.eq('supplier_id', supplierId);
    }

    const maxRows = Number(limit) > 0 && Number(limit) <= 500 ? Number(limit) : 100;
    query = query.limit(maxRows);

    const { data: purchases, error } = await query;

    if (error) {
      return res.status(500).json({
        error: 'Failed to retrieve purchases.',
        details: error.message
      });
    }

    const formattedPurchases = (purchases || []).map(formatPurchase);

    return res.status(200).json({
      status: 'ok',
      count: formattedPurchases.length,
      purchases: formattedPurchases
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/purchases/:id
 * Retrieves a single purchase order by ID with line items.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Valid purchase ID is required.' });
    }

    const { data: purchase, error } = await req.supabase
      .from('purchases')
      .select(`
        id,
        business_id,
        supplier_id,
        purchase_number,
        status,
        purchase_date,
        total_amount,
        notes,
        created_by,
        created_at,
        updated_at,
        suppliers (
          id,
          name,
          contact_name
        ),
        purchase_items (
          id,
          product_id,
          quantity,
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
        error: 'Failed to retrieve purchase details.',
        details: error.message
      });
    }

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase record not found.' });
    }

    // Verify user membership in the purchase's business
    const authCheck = await verifyBusinessMembership(req.supabase, purchase.business_id);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    return res.status(200).json({
      status: 'ok',
      purchase: formatPurchase(purchase)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/purchases
 * Creates a purchase order or direct stock receipt atomically via create_purchase_transaction.
 */
router.post('/', async (req, res, next) => {
  try {
    const { business_id, supplier_id, notes, purchase_date, status, items } = req.body || {};

    // 1. Validate business membership
    const authCheck = await verifyBusinessMembership(req.supabase, business_id);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    // 2. Validate supplier ID if provided
    let cleanSupplierId = null;
    if (supplier_id && typeof supplier_id === 'string' && supplier_id.trim() !== '') {
      if (!UUID_REGEX.test(supplier_id.trim())) {
        return res.status(400).json({ error: 'Invalid supplier ID format.' });
      }
      cleanSupplierId = supplier_id.trim();
    }

    // 3. Validate status
    const allowedStatuses = ['ordered', 'pending', 'received'];
    const purchaseStatus = status ? String(status).toLowerCase().trim() : 'ordered';
    if (!allowedStatuses.includes(purchaseStatus)) {
      return res.status(400).json({
        error: `Invalid purchase status "${status}". Allowed values: ${allowedStatuses.join(', ')}.`
      });
    }

    // 4. Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Purchase must include at least one valid line item.'
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

      const cost = Number(item.unit_cost);
      if (isNaN(cost) || cost < 0) {
        return res.status(400).json({
          error: `Item #${i + 1}: Unit cost cannot be negative.`
        });
      }

      cleanedItems.push({
        product_id: item.product_id,
        quantity: Math.round(qty * 100) / 100,
        unit_cost: Math.round(cost * 100) / 100
      });
    }

    // 5. Execute atomic transaction in PostgreSQL via RPC
    const { data: purchaseResult, error: rpcError } = await req.supabase.rpc('create_purchase_transaction', {
      p_business_id: business_id,
      p_supplier_id: cleanSupplierId,
      p_notes: notes ? notes.trim() : null,
      p_status: purchaseStatus,
      p_purchase_date: purchase_date ? new Date(purchase_date).toISOString() : new Date().toISOString(),
      p_items: cleanedItems
    });

    if (rpcError) {
      const msg = rpcError.message || '';

      if (msg.includes('does not belong to this business') || msg.includes('Access denied')) {
        return res.status(403).json({
          error: msg,
          type: 'AUTHORIZATION_ERROR'
        });
      }

      if (msg.includes('Could not find the function') || msg.includes('schema cache')) {
        return res.status(503).json({
          error: "Database procedure 'create_purchase_transaction' has not been installed yet. Please execute the Stage 5 database script in Supabase SQL editor.",
          type: 'RPC_NOT_INSTALLED'
        });
      }

      return res.status(400).json({
        error: msg || 'Failed to complete purchase transaction.',
        details: rpcError.details
      });
    }

    return res.status(201).json({
      status: 'created',
      message: purchaseStatus === 'received'
        ? 'Purchase recorded and stock added immediately.'
        : 'Purchase order created successfully.',
      purchase: purchaseResult
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/purchases/:id/receive
 * Atomically marks an ordered/pending purchase as received, increases stock,
 * and creates inventory movement records. Prevents double-receiving.
 */
router.post('/:id/receive', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Valid purchase ID is required.' });
    }

    // Call atomic receive_purchase_transaction RPC
    const { data: receiptResult, error: rpcError } = await req.supabase.rpc('receive_purchase_transaction', {
      p_purchase_id: id
    });

    if (rpcError) {
      const msg = rpcError.message || '';

      if (msg.includes('already been received')) {
        return res.status(400).json({
          error: msg,
          type: 'ALREADY_RECEIVED'
        });
      }

      if (msg.includes('Access denied') || msg.includes('Unauthorized')) {
        return res.status(403).json({
          error: msg,
          type: 'AUTHORIZATION_ERROR'
        });
      }

      if (msg.includes('not found')) {
        return res.status(404).json({
          error: msg,
          type: 'NOT_FOUND'
        });
      }

      if (msg.includes('Could not find the function') || msg.includes('schema cache')) {
        return res.status(503).json({
          error: "Database procedure 'receive_purchase_transaction' has not been installed yet. Please execute the Stage 5 database script in Supabase SQL editor.",
          type: 'RPC_NOT_INSTALLED'
        });
      }

      return res.status(400).json({
        error: msg || 'Failed to receive purchase order.',
        details: rpcError.details
      });
    }

    return res.status(200).json({
      status: 'received',
      message: 'Purchase marked as received and stock successfully updated.',
      purchase: receiptResult
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
