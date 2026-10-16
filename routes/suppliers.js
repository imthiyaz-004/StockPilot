const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

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
 * GET /api/suppliers?businessId=...
 * Lists suppliers for an authorized business.
 */
router.get('/', async (req, res, next) => {
  try {
    const businessId = req.query.businessId || req.query.business_id;

    const authCheck = await verifyBusinessMembership(req.supabase, businessId);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    const { data: suppliers, error } = await req.supabase
      .from('suppliers')
      .select('id, name, contact_name, email, phone')
      .eq('business_id', businessId)
      .order('name');

    if (error) {
      return res.status(500).json({ error: 'Failed to retrieve suppliers.', details: error.message });
    }

    return res.status(200).json({
      status: 'ok',
      suppliers: suppliers || []
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/suppliers
 * Adds a new supplier scoped to an authorized business.
 */
router.post('/', async (req, res, next) => {
  try {
    const { business_id, businessId, name, contact_name, email, phone } = req.body || {};
    const targetBusinessId = business_id || businessId;

    const authCheck = await verifyBusinessMembership(req.supabase, targetBusinessId);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Supplier name is required (minimum 2 characters).' });
    }

    const { data: supplier, error } = await req.supabase
      .from('suppliers')
      .insert({
        business_id: targetBusinessId,
        name: name.trim(),
        contact_name: contact_name ? contact_name.trim() : null,
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: 'Failed to create supplier.', details: error.message });
    }

    return res.status(201).json({
      status: 'created',
      supplier
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
