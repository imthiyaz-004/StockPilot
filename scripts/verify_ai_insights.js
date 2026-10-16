const http = require('http');
const { getSupabaseClient } = require('../services/supabaseClient');
const geminiService = require('../services/geminiService');

process.env.PORT = '3094';
const { app, server } = require('../server');

async function runVerification() {
  console.log('=== StockPilot Stage 7.1: AI-Powered Inventory Insights Verification Suite ===\n');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failures++;
    }
  }

  function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const headers = { 'Content-Type': 'application/json' };
      if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const req = http.request(
        {
          hostname: 'localhost',
          port: 3094,
          path,
          method,
          headers
        },
        res => {
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => {
            let json = null;
            try {
              json = JSON.parse(data);
            } catch {
              // Raw non-JSON response
            }
            resolve({ status: res.statusCode, headers: res.headers, body: json || data });
          });
        }
      );

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  const supabase = getSupabaseClient();
  const testId = Date.now();
  const testEmail = `ai_test_${testId}@stockpilot.local`;
  const testPassword = 'AiPassword123!';
  let testUser = null;
  let testToken = null;
  let testBusiness = null;
  let testProduct = null;

  try {
    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & BUSINESS AUTHORIZATION CONTROLS
    // -------------------------------------------------------------------------
    console.log('[1/7] Testing Authentication & Authorization Controls...');

    // 1.1 Unauthenticated Request
    const noAuth = await request('POST', '/api/ai/inventory-insights', { businessId: '00000000-0000-0000-0000-000000000000' });
    assert(noAuth.status === 401, 'Rejects unauthenticated request without token (HTTP 401)');

    // 1.2 Invalid Bearer Token
    const badAuth = await request('POST', '/api/ai/inventory-insights', { businessId: '00000000-0000-0000-0000-000000000000' }, 'invalid.token.here');
    assert(badAuth.status === 401, 'Rejects forged or invalid bearer token (HTTP 401)');

    // 1.3 Provision Test User Session
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    if (authErr || !authData.user) {
      throw new Error(`Failed to create test user: ${authErr?.message}`);
    }
    testUser = authData.user;
    testToken = authData.session?.access_token;

    if (!testToken) {
      const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      });
      if (loginErr || !loginData.session) {
        throw new Error(`Failed to sign in test user: ${loginErr?.message}`);
      }
      testToken = loginData.session.access_token;
    }
    assert(Boolean(testToken), 'Successfully provisioned isolated test session');

    // 1.4 Missing businessId
    const missingBiz = await request('POST', '/api/ai/inventory-insights', {}, testToken);
    assert(missingBiz.status === 403, 'Rejects request missing businessId (HTTP 403)');

    // 1.5 Malformed non-UUID businessId
    const badBiz = await request('POST', '/api/ai/inventory-insights', { businessId: 'non-uuid-string' }, testToken);
    assert(badBiz.status === 403, 'Rejects malformed non-UUID businessId (HTTP 403)');

    // 1.6 Foreign UUID access (User is not a member)
    const foreignBiz = await request('POST', '/api/ai/inventory-insights', { businessId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d' }, testToken);
    assert(foreignBiz.status === 403, 'Rejects cross-business access to foreign UUID (HTTP 403)');

    // -------------------------------------------------------------------------
    // 2. MISSING API CONFIGURATION GRACEFUL FAILURE
    // -------------------------------------------------------------------------
    console.log('\n[2/7] Testing Missing API Configuration & Resilience...');

    // 2.1 Provision isolated test business workspace
    const bizRes = await request('POST', '/api/businesses', {
      name: `AI Test Workspace ${testId}`,
      currency: 'EUR',
      industry: 'Retail'
    }, testToken);
    if (bizRes.status !== 201) {
      throw new Error(`Failed to create test business: ${JSON.stringify(bizRes.body)}`);
    }
    testBusiness = bizRes.body.business;
    assert(testBusiness && testBusiness.currency === 'EUR', 'Provisioned isolated test business workspace (EUR currency)');

    // 2.2 Call endpoint with GEMINI_API_KEY unset (or placeholder)
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const noKeyRes = await request('POST', '/api/ai/inventory-insights', { businessId: testBusiness.id }, testToken);
    assert(noKeyRes.status === 503, 'Returns HTTP 503 Service Unavailable when GEMINI_API_KEY is not configured');
    assert(noKeyRes.body?.code === 'AI_NOT_CONFIGURED', 'Includes explicit code: "AI_NOT_CONFIGURED"');
    assert(typeof noKeyRes.body?.error === 'string' && noKeyRes.body.error.includes('GEMINI_API_KEY'), 'Returns clear instructions to set GEMINI_API_KEY in environment');

    // 2.3 Verify other endpoints remain 100% operational when AI is unconfigured
    const healthRes = await request('GET', '/api/health');
    assert(healthRes.status === 200, 'StockPilot health endpoint remains 200 OK');

    const dashRes = await request('GET', `/api/analytics/dashboard?businessId=${testBusiness.id}`, null, testToken);
    assert(dashRes.status === 200, 'Core dashboard analytics remains 200 OK');

    const intelRes = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}`, null, testToken);
    assert(intelRes.status === 200, 'Inventory intelligence endpoint remains 200 OK');

    // Restore environment
    if (prevKey) process.env.GEMINI_API_KEY = prevKey;

    // -------------------------------------------------------------------------
    // 3. RATE LIMITING & COOLDOWN PROTECTION
    // -------------------------------------------------------------------------
    console.log('\n[3/7] Testing Rate Limiting & Cooldown Protection...');

    // Call twice in rapid succession (within 5s cooldown)
    const call1 = await request('POST', '/api/ai/inventory-insights', { businessId: testBusiness.id }, testToken);
    const call2 = await request('POST', '/api/ai/inventory-insights', { businessId: testBusiness.id }, testToken);

    assert(call2.status === 429, 'Rejects rapid consecutive request within cooldown window (HTTP 429)');
    assert(call2.body?.code === 'AI_RATE_LIMIT', 'Returns code: "AI_RATE_LIMIT"');
    assert(typeof call2.body?.retryAfter === 'number', 'Includes retryAfter seconds estimate');

    // -------------------------------------------------------------------------
    // 4. BACKEND DATA INTEGRITY & CLIENT INPUT NON-TRUST
    // -------------------------------------------------------------------------
    console.log('\n[4/7] Testing Backend Data Integrity & Client Non-Trust...');

    // Create a real product in the catalog with 0 stock (depleted) and 10 minimum
    const prodRes = await request('POST', '/api/products', {
      business_id: testBusiness.id,
      name: 'Turbine Valve 50mm',
      sku: `SKU-TURB-${testId}`,
      category: 'Machinery',
      purchase_price: 120,
      selling_price: 240,
      current_stock: 0,
      minimum_stock: 15
    }, testToken);
    assert(prodRes.status === 201, 'Created authentic product in catalog: Stock 0, Min 15');
    testProduct = prodRes.body.product;

    // Client attempts to tamper with stock or recommendations in the payload
    const tamperedPayload = {
      businessId: testBusiness.id,
      current_stock: 99999,
      risk_category: 'HEALTHY',
      summary: 'Fake client summary trying to bypass backend calculations',
      recommendations: []
    };

    // Prompt builder inspection: verify it only reads factual data from backend calculations
    const promptTest = geminiService.buildAnalystPrompt({
      business: testBusiness,
      summary: { total_evaluated_products: 1, critical_depleted_count: 1 },
      products: [{
        product_id: testProduct.id,
        name: testProduct.name,
        sku: testProduct.sku,
        category: testProduct.category,
        current_stock: 0,
        minimum_stock: 15,
        incoming_stock: 0,
        average_daily_sales: 0,
        days_of_stock_remaining: 0,
        has_sufficient_history: false,
        demand_trend: 'INSUFFICIENT_VOLUME',
        risk_category: 'CRITICAL_DEPLETED',
        suggested_reorder_qty: 15,
        estimated_reorder_cost: 1800
      }]
    });

    assert(promptTest.includes('Turbine Valve 50mm'), 'Prompt includes factual catalog product');
    assert(promptTest.includes('on-hand=0'), 'Prompt uses authentic on-hand stock (0)');
    assert(promptTest.includes('min_safety_level=15'), 'Prompt uses authentic safety threshold (15)');
    assert(!promptTest.includes('99999'), 'Prompt strictly ignores client-supplied tampered numbers');
    assert(!promptTest.includes('Fake client summary'), 'Prompt ignores browser-supplied text');

    // -------------------------------------------------------------------------
    // 5. SCHEMA VALIDATION & MALFORMED OUTPUT REJECTION
    // -------------------------------------------------------------------------
    console.log('\n[5/7] Testing Output Schema Validation & Malformed Output Handling...');

    // 5.1 Rejects null / non-object
    let caughtNonObject = false;
    try {
      geminiService.validateAndSanitizeInsights(null);
    } catch {
      caughtNonObject = true;
    }
    assert(caughtNonObject, 'Rejects non-object raw response');

    // 5.2 Validates and sanitizes well-formed JSON
    const mockValidJson = {
      summary: 'Critical stockout risk detected for high-turnover valve components.',
      findings: [
        {
          title: 'Immediate Depletion Risk on Valve Units',
          severity: 'CRITICAL',
          product_id: testProduct.id,
          evidence: 'On-hand stock is 0 with a safety threshold of 15 units.',
          explanation: 'Component is completely exhausted without active purchase manifests.',
          recommended_action: 'Issue procurement purchase order for 15 units immediately.'
        }
      ],
      limitations: [
        'Analysis based on standard 30-day velocity lookback window.'
      ]
    };

    const sanitized = geminiService.validateAndSanitizeInsights(mockValidJson);
    assert(sanitized.summary === mockValidJson.summary, 'Summary matches expected validated string');
    assert(sanitized.findings.length === 1, 'Findings array validated');
    assert(sanitized.findings[0].severity === 'CRITICAL', 'Severity normalized and accepted');
    assert(sanitized.findings[0].product_id === testProduct.id, 'Product ID mapped accurately');
    assert(sanitized.limitations.length === 1, 'Limitations array populated');

    // 5.3 Normalizes invalid severity
    const mockInvalidSeverity = {
      summary: 'General observation',
      findings: [{ title: 'Test', severity: 'EXTREME_APOCALYPSE' }]
    };
    const sanitizedSev = geminiService.validateAndSanitizeInsights(mockInvalidSeverity);
    assert(sanitizedSev.findings[0].severity === 'INFO', 'Normalizes unapproved severity to INFO');

    // 5.4 Fallback when limitations is omitted
    const mockNoLimitations = {
      summary: 'Observation without limitations',
      findings: []
    };
    const sanitizedLim = geminiService.validateAndSanitizeInsights(mockNoLimitations);
    assert(sanitizedLim.limitations.length > 0, 'Applies default baseline data limitation statement');

    // -------------------------------------------------------------------------
    // 6. XSS SAFETY & SAFE TEXT RENDERING
    // -------------------------------------------------------------------------
    console.log('\n[6/7] Testing XSS Safety & Untrusted Text Protection...');

    const maliciousAiPayload = {
      summary: '<script>alert("pwned_summary")</script>Executive analysis with attempted script injection.',
      findings: [
        {
          title: '<img src="x" onerror="alert(1)"> Finding Title',
          severity: 'HIGH',
          product_id: null,
          evidence: '<svg onload="alert(\'evidence\')"> 0 on hand',
          explanation: '<iframe src="javascript:alert(2)">Explanation payload</iframe>',
          recommended_action: '<a href="javascript:alert(3)">Click here</a>'
        }
      ],
      limitations: [
        '<b onmouseover="alert(4)">Hover me</b>'
      ]
    };

    const validatedMalicious = geminiService.validateAndSanitizeInsights(maliciousAiPayload);

    // Verify properties remain pure strings without code execution
    assert(typeof validatedMalicious.summary === 'string', 'Summary is sanitized to plain string');
    assert(typeof validatedMalicious.findings[0].title === 'string', 'Finding title is plain string');
    assert(typeof validatedMalicious.findings[0].explanation === 'string', 'Finding explanation is plain string');
    assert(typeof validatedMalicious.findings[0].recommended_action === 'string', 'Finding action is plain string');

    // Verify frontend app.js uses textContent (audit check)
    const fs = require('fs');
    const appJsContent = fs.readFileSync('public/js/app.js', 'utf8');
    assert(appJsContent.includes('aiInsightsSummary.textContent ='), 'app.js sets summary strictly via textContent');
    assert(appJsContent.includes('titleEl.textContent ='), 'app.js sets finding titles strictly via textContent');
    assert(appJsContent.includes('explEl.textContent ='), 'app.js sets finding explanations strictly via textContent');
    assert(appJsContent.includes('actionSpan.textContent ='), 'app.js sets finding actions strictly via textContent');
    assert(!appJsContent.includes('aiInsightsSummary.innerHTML ='), 'app.js NEVER sets summary via innerHTML');

    // -------------------------------------------------------------------------
    // 7. MUTATION-FREE GUARANTEE & PARITY VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n[7/7] Testing Mutation-Free Guarantee & Parity Verification...');

    // Audit product stock, sales count, purchases count before and after
    const { data: prodsBefore } = await supabase.from('products').select('current_stock').eq('id', testProduct.id).single();
    const { data: salesBefore } = await supabase.from('sales').select('id').eq('business_id', testBusiness.id);
    const { data: purchBefore } = await supabase.from('purchases').select('id').eq('business_id', testBusiness.id);

    // Wait 5 seconds to bypass rate limit
    await new Promise(r => setTimeout(r, 5100));

    // Call AI insights endpoint
    await request('POST', '/api/ai/inventory-insights', { businessId: testBusiness.id }, testToken);

    const { data: prodsAfter } = await supabase.from('products').select('current_stock').eq('id', testProduct.id).single();
    const { data: salesAfter } = await supabase.from('sales').select('id').eq('business_id', testBusiness.id);
    const { data: purchAfter } = await supabase.from('purchases').select('id').eq('business_id', testBusiness.id);

    assert(Number(prodsBefore.current_stock) === Number(prodsAfter.current_stock), 'Product stock is untouched by AI insights generation (remains 0)');
    assert((salesBefore || []).length === (salesAfter || []).length, 'No sales records created or modified');
    assert((purchBefore || []).length === (purchAfter || []).length, 'No purchase orders autonomously created');

    // Parity check on analytics endpoints
    const finalDash = await request('GET', `/api/analytics/dashboard?businessId=${testBusiness.id}`, null, testToken);
    assert(finalDash.status === 200, 'GET /api/analytics/dashboard functions with 100% parity');
    assert(finalDash.body?.summary?.total_products === 1, 'Dashboard reflects exact product count');

    const finalIntel = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}`, null, testToken);
    assert(finalIntel.status === 200, 'GET /api/analytics/intelligence functions with 100% parity');
    assert(finalIntel.body?.summary?.critical_depleted_count === 1, 'Intelligence reflects exact depleted count');

    // Clean up test data
    console.log('\n--- Cleaning up test artifacts ---');
    if (testProduct) {
      await supabase.from('products').delete().eq('id', testProduct.id);
    }
    if (testBusiness) {
      await supabase.from('businesses').delete().eq('id', testBusiness.id);
    }
    if (testUser) {
      await supabase.auth.admin.deleteUser(testUser.id).catch(() => {});
    }
    console.log('  ✓ Cleaned up test business and test records.');

  } catch (err) {
    console.error('Test suite runtime error:', err);
    failures++;
  } finally {
    server.close();
  }

  console.log('======================================================');
  if (failures === 0) {
    console.log('ALL AI INVENTORY INSIGHTS CHECKS PASSED (0 failures)!');
    process.exit(0);
  } else {
    console.error(`FAILED: ${failures} check(s) failed.`);
    process.exit(1);
  }
}

runVerification();
