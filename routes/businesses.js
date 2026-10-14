const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Enforce authentication on all business routes
router.use(requireAuth);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD'];

/**
 * GET /api/businesses/mine
 * Retrieves all businesses associated with the authenticated user (as owner or member).
 */
router.get('/mine', async (req, res, next) => {
  try {
    // Queries businesses strictly through the authenticated user's RLS context
    const { data: businesses, error: bizError } = await req.supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });

    if (bizError) {
      return res.status(500).json({
        error: 'Failed to retrieve businesses.',
        details: bizError.message
      });
    }

    // Retrieve the user's explicit roles across their businesses
    const { data: memberships } = await req.supabase
      .from('business_members')
      .select('business_id, role')
      .eq('user_id', req.user.id);

    const roleMap = new Map();
    if (Array.isArray(memberships)) {
      memberships.forEach(m => roleMap.set(m.business_id, m.role));
    }

    const enrichedBusinesses = (businesses || []).map(b => ({
      ...b,
      role: roleMap.get(b.id) || (b.owner_id === req.user.id ? 'owner' : 'member')
    }));

    return res.status(200).json({
      status: 'ok',
      hasBusiness: enrichedBusinesses.length > 0,
      count: enrichedBusinesses.length,
      businesses: enrichedBusinesses,
      primaryBusiness: enrichedBusinesses.length > 0 ? enrichedBusinesses[0] : null
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/businesses
 * Creates a new business and assigns the authenticated user as owner and member.
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, industry, location, currency } = req.body || {};

    // Validate Business Name
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({
        error: 'Business name is required and must be between 2 and 100 characters.'
      });
    }

    // Validate Industry
    if (!industry || typeof industry !== 'string' || industry.trim().length < 2 || industry.trim().length > 50) {
      return res.status(400).json({
        error: 'Industry is required and must be between 2 and 50 characters.'
      });
    }

    // Validate Location (optional)
    let validatedLocation = null;
    if (location && typeof location === 'string') {
      const trimmedLoc = location.trim();
      if (trimmedLoc.length > 150) {
        return res.status(400).json({
          error: 'Location must not exceed 150 characters.'
        });
      }
      if (trimmedLoc.length > 0) {
        validatedLocation = trimmedLoc;
      }
    }

    // Validate Currency (default to INR)
    let validatedCurrency = 'INR';
    if (currency && typeof currency === 'string') {
      const upperCurrency = currency.trim().toUpperCase();
      if (ALLOWED_CURRENCIES.includes(upperCurrency)) {
        validatedCurrency = upperCurrency;
      } else {
        return res.status(400).json({
          error: `Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}.`
        });
      }
    }

    const trimmedName = name.trim();
    const trimmedIndustry = industry.trim();

    // Owner ID is derived exclusively from verified authentication token, never from client body
    const ownerId = req.user.id;

    // 1. Insert Business record
    // Attempt insert with industry and location. If the live database schema has not yet
    // added those columns, gracefully fallback to core schema fields.
    let insertedBusiness = null;
    const fullPayload = {
      name: trimmedName,
      currency: validatedCurrency,
      owner_id: ownerId,
      industry: trimmedIndustry,
      location: validatedLocation
    };

    const { data: initialData, error: initialError } = await req.supabase
      .from('businesses')
      .insert(fullPayload)
      .select()
      .single();

    if (initialError) {
      // Check if error is due to missing industry/location columns in schema cache
      if (
        initialError.message.includes('industry') ||
        initialError.message.includes('location')
      ) {
        const fallbackPayload = {
          name: trimmedName,
          currency: validatedCurrency,
          owner_id: ownerId
        };

        const { data: fallbackData, error: fallbackError } = await req.supabase
          .from('businesses')
          .insert(fallbackPayload)
          .select()
          .single();

        if (fallbackError) {
          return res.status(400).json({
            error: 'Failed to create business.',
            details: fallbackError.message
          });
        }
        insertedBusiness = fallbackData;
      } else {
        return res.status(400).json({
          error: 'Failed to create business.',
          details: initialError.message
        });
      }
    } else {
      insertedBusiness = initialData;
    }

    if (!insertedBusiness || !insertedBusiness.id) {
      return res.status(500).json({
        error: 'Business creation did not return a valid record.'
      });
    }

    // 2. Ensure owner is explicitly recorded in business_members
    const { error: memberError } = await req.supabase
      .from('business_members')
      .insert({
        business_id: insertedBusiness.id,
        user_id: ownerId,
        role: 'owner'
      });

    if (memberError) {
      // Roll back the business creation to prevent orphan business without owner membership
      console.error('Membership insert failed, rolling back business creation:', memberError.message);
      await req.supabase.from('businesses').delete().eq('id', insertedBusiness.id);
      return res.status(500).json({
        error: 'Failed to assign owner membership to the created business. Operation rolled back.',
        details: memberError.message
      });
    }

    const responseBusiness = {
      ...insertedBusiness,
      industry: insertedBusiness.industry || trimmedIndustry,
      location: insertedBusiness.location || validatedLocation,
      role: 'owner'
    };

    return res.status(201).json({
      status: 'created',
      message: 'Business workspace created successfully.',
      business: responseBusiness
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/businesses/:id
 * Fetches a specific business by ID.
 * Multi-tenant RLS prevents accessing any business not owned or shared with the caller.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid business ID format.' });
    }

    const { data: business, error } = await req.supabase
      .from('businesses')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !business) {
      return res.status(404).json({
        error: 'Business not found or access denied.'
      });
    }

    return res.status(200).json({
      status: 'ok',
      business
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
