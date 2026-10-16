const express = require('express');
const { requireAuth } = require('../middleware/auth');
const geminiService = require('../services/geminiService');
const { computeInventoryIntelligence } = require('../services/intelligenceService');

const router = express.Router();

// Enforce authentication on all AI routes
router.use(requireAuth);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Verify business membership helper.
 * Uses user-scoped Supabase client where RLS guarantees isolation.
 */
async function verifyBusinessMembership(supabase, businessId) {
  if (!businessId || !UUID_REGEX.test(businessId)) {
    return { authorized: false, error: 'Invalid or missing business ID format.' };
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, currency, industry, location')
    .eq('id', businessId)
    .maybeSingle();

  if (error || !business) {
    return { authorized: false, error: 'Access denied. You do not belong to this business.' };
  }

  return { authorized: true, business };
}

// In-memory rate limiter per business: 1 request every 5 seconds, max 10 per minute
const requestTimestamps = new Map();
const COOLDOWN_MS = 5000;
const RATE_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(businessId) {
  const now = Date.now();
  let history = requestTimestamps.get(businessId) || [];

  // Prune entries older than the rate window
  history = history.filter(ts => now - ts < RATE_WINDOW_MS);

  // Check cooldown since last request
  if (history.length > 0) {
    const lastRequest = history[history.length - 1];
    const elapsed = now - lastRequest;
    if (elapsed < COOLDOWN_MS) {
      const waitSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return {
        allowed: false,
        error: `Please wait ${waitSeconds}s before requesting new AI insights.`,
        retryAfter: waitSeconds
      };
    }
  }

  // Check frequency limit
  if (history.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = history[0];
    const resetSeconds = Math.ceil((RATE_WINDOW_MS - (now - oldestInWindow)) / 1000);
    return {
      allowed: false,
      error: `AI analysis rate limit exceeded. Please wait ${resetSeconds}s.`,
      retryAfter: resetSeconds
    };
  }

  history.push(now);
  requestTimestamps.set(businessId, history);
  return { allowed: true };
}

/**
 * POST /api/ai/inventory-insights
 * Synthesizes inventory risk, demand velocity, and restock actions via Google Gemini.
 */
router.post('/inventory-insights', async (req, res) => {
  try {
    const businessId = (req.body?.businessId || req.query?.businessId || '').trim();

    if (!businessId || !UUID_REGEX.test(businessId)) {
      return res.status(403).json({ error: 'Invalid or missing business ID format.' });
    }

    // Verify user belongs to the business
    const authCheck = await verifyBusinessMembership(req.supabase, businessId);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    const business = authCheck.business;

    // Check rate limits to prevent cost spikes
    const rateCheck = checkRateLimit(businessId);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: rateCheck.error,
        code: 'AI_RATE_LIMIT',
        retryAfter: rateCheck.retryAfter
      });
    }

    // Verify AI provider configuration
    if (!geminiService.isConfigured()) {
      return res.status(503).json({
        error: 'AI Inventory Analyst is not configured. Please set the GEMINI_API_KEY server environment variable to enable AI insights.',
        code: 'AI_NOT_CONFIGURED'
      });
    }

    // Fetch deterministic intelligence facts strictly from the backend
    const intelligence = await computeInventoryIntelligence(req.supabase, business, 30, 30);

    // Minimize and sanitize data sent to the AI provider
    // Limit to top 25 priority items to keep tokens concise and focused
    const sanitizedProducts = (intelligence.recommendations || []).slice(0, 25).map(r => ({
      product_id: r.product_id,
      name: typeof r.name === 'string' ? r.name.slice(0, 100) : 'Item',
      sku: typeof r.sku === 'string' ? r.sku.slice(0, 50) : 'N/A',
      category: typeof r.category === 'string' ? r.category.slice(0, 50) : 'General',
      current_stock: Number(r.current_stock) || 0,
      minimum_stock: Number(r.minimum_stock) || 0,
      incoming_stock: Number(r.incoming_stock) || 0,
      average_daily_sales: Number(r.metrics?.average_daily_sales) || 0,
      days_of_stock_remaining: r.metrics?.days_of_stock_remaining !== null && r.metrics?.days_of_stock_remaining !== undefined ? Number(r.metrics.days_of_stock_remaining) : null,
      demand_trend: typeof r.metrics?.demand_trend === 'string' ? r.metrics.demand_trend.slice(0, 30) : 'STABLE',
      has_sufficient_history: Boolean(r.metrics?.has_sufficient_history),
      risk_category: typeof r.intelligence?.risk_category === 'string' ? r.intelligence.risk_category.slice(0, 30) : 'HEALTHY',
      suggested_reorder_qty: Number(r.intelligence?.suggested_reorder_qty) || 0,
      estimated_reorder_cost: Number(r.intelligence?.estimated_reorder_cost) || 0
    }));

    const sanitizedData = {
      business: {
        name: typeof business.name === 'string' ? business.name.slice(0, 100) : 'Small Business Workspace',
        currency: business.currency || 'INR'
      },
      summary: intelligence.summary,
      products: sanitizedProducts
    };

    // Invoke Gemini AI Analyst with server-side timeout
    const result = await geminiService.generateInventoryInsights(sanitizedData, { timeoutMs: 15000 });

    return res.status(200).json({
      success: true,
      business_id: business.id,
      currency: business.currency || 'INR',
      insights: result.insights,
      metadata: {
        model: result.model,
        generated_at: new Date().toISOString(),
        evaluated_products_count: sanitizedProducts.length
      }
    });
  } catch (err) {
    console.error('AI Inventory Insights error:', err.message);

    const status = err.status || 500;
    const code = err.code || 'AI_ERROR';

    let safeError = err.message || 'Failed to generate AI inventory insights.';
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && safeError.includes(apiKey)) {
      safeError = safeError.replaceAll(apiKey, '[REDACTED_API_KEY]');
    }

    return res.status(status).json({
      error: safeError,
      code,
      details: process.env.NODE_ENV === 'development' ? err.rawResponse : undefined
    });
  }
});

module.exports = router;
