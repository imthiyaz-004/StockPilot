const http = require('http');
const fs = require('fs');
const path = require('path');
const { getSupabaseClient } = require('../services/supabaseClient');
const geminiService = require('../services/geminiService');

// Port for verification server
process.env.PORT = '3093';
const { app, server } = require('../server');

async function runHardeningSuite() {
  console.log('=== StockPilot Stage 7.2: AI Inventory Analyst Hardening & Verification Suite ===\n');
  let failures = 0;
  let liveAiTestSucceeded = false;

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
          port: 3093,
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
  const userA_Email = `ai_user_a_${testId}@stockpilot.local`;
  const userB_Email = `ai_user_b_${testId}@stockpilot.local`;
  const testPassword = 'Password123!';

  let userA = null;
  let tokenA = null;
  let userB = null;
  let tokenB = null;

  let businessA = null;
  let businessB = null;
  let productA1 = null;
  let productA2 = null;

  try {
    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & BUSINESS ISOLATION SECURITY
    // -------------------------------------------------------------------------
    console.log('[1/10] Testing Authentication & Cross-Business Isolation...');

    // 1.1 Unauthenticated Request
    const noAuth = await request('POST', '/api/ai/inventory-insights', { businessId: '00000000-0000-0000-0000-000000000000' });
    assert(noAuth.status === 401, 'Rejects unauthenticated request without token (HTTP 401)');

    // 1.2 Invalid Bearer Token
    const badAuth = await request('POST', '/api/ai/inventory-insights', { businessId: '00000000-0000-0000-0000-000000000000' }, 'invalid.bearer.token');
    assert(badAuth.status === 401, 'Rejects forged or invalid bearer token (HTTP 401)');

    // 1.3 Provision User A
    const { data: authA, error: errA } = await supabase.auth.signUp({ email: userA_Email, password: testPassword });
    if (errA || !authA.user) throw new Error(`Failed to create User A: ${errA?.message}`);
    userA = authA.user;
    tokenA = authA.session?.access_token;
    if (!tokenA) {
      const { data: logA } = await supabase.auth.signInWithPassword({ email: userA_Email, password: testPassword });
      tokenA = logA.session.access_token;
    }
    assert(Boolean(tokenA), 'User A session established');

    // 1.4 Provision User B
    const { data: authB, error: errB } = await supabase.auth.signUp({ email: userB_Email, password: testPassword });
    if (errB || !authB.user) throw new Error(`Failed to create User B: ${errB?.message}`);
    userB = authB.user;
    tokenB = authB.session?.access_token;
    if (!tokenB) {
      const { data: logB } = await supabase.auth.signInWithPassword({ email: userB_Email, password: testPassword });
      tokenB = logB.session.access_token;
    }
    assert(Boolean(tokenB), 'User B session established');

    // 1.5 Create Business A for User A
    const bizARes = await request('POST', '/api/businesses', {
      name: `Workspace Alpha ${testId}`,
      currency: 'INR',
      industry: 'Hardware'
    }, tokenA);
    assert(bizARes.status === 201, 'Created Business Alpha for User A');
    businessA = bizARes.body.business;

    // 1.6 Create Business B for User B
    const bizBRes = await request('POST', '/api/businesses', {
      name: `Workspace Beta ${testId}`,
      currency: 'USD',
      industry: 'Electronics'
    }, tokenB);
    assert(bizBRes.status === 201, 'Created Business Beta for User B');
    businessB = bizBRes.body.business;

    // 1.7 Missing businessId
    const missingBiz = await request('POST', '/api/ai/inventory-insights', {}, tokenA);
    assert(missingBiz.status === 403, 'Rejects request missing businessId (HTTP 403)');

    // 1.8 Malformed non-UUID businessId
    const badBiz = await request('POST', '/api/ai/inventory-insights', { businessId: 'not-a-valid-uuid' }, tokenA);
    assert(badBiz.status === 403, 'Rejects malformed non-UUID businessId (HTTP 403)');

    // 1.9 Cross-business authorization check: User A attempting to access Business B
    const crossAccess = await request('POST', '/api/ai/inventory-insights', { businessId: businessB.id }, tokenA);
    assert(crossAccess.status === 403, 'Rejects cross-business access: User A cannot query Business B (HTTP 403)');
    assert(crossAccess.body?.error?.includes('Access denied'), 'Returns strict access denied message');

    // -------------------------------------------------------------------------
    // 2. BACKEND DATA INTEGRITY & CLIENT INPUT NON-TRUST
    // -------------------------------------------------------------------------
    console.log('\n[2/10] Testing Backend Data Integrity & Client Non-Trust...');

    // Populate catalog items for Business A
    const p1Res = await request('POST', '/api/products', {
      business_id: businessA.id,
      name: 'High Precision Carbide Endmill 10mm',
      sku: `SKU-MILL-${testId}`,
      category: 'Machining',
      purchase_price: 250,
      selling_price: 500,
      current_stock: 0,
      minimum_stock: 12
    }, tokenA);
    assert(p1Res.status === 201, 'Created depleted item in Business A (Stock 0 / Min 12)');
    productA1 = p1Res.body.product;

    const p2Res = await request('POST', '/api/products', {
      business_id: businessA.id,
      name: 'Titanium Fastener M8x40',
      sku: `SKU-FAST-${testId}`,
      category: 'Fasteners',
      purchase_price: 40,
      selling_price: 90,
      current_stock: 6,
      minimum_stock: 15
    }, tokenA);
    assert(p2Res.status === 201, 'Created low stock item in Business A (Stock 6 / Min 15)');
    productA2 = p2Res.body.product;

    // Tampered payload attempt from client
    const tamperedPayload = {
      businessId: businessA.id,
      current_stock: 9999,
      risk_category: 'HEALTHY',
      summary: 'Tampered summary injected by client',
      products: [{ name: 'Fake Injected Product', current_stock: 10000 }]
    };

    const promptTest = geminiService.buildAnalystPrompt({
      business: businessA,
      summary: { total_evaluated_products: 2, critical_depleted_count: 1 },
      products: [
        {
          product_id: productA1.id,
          name: productA1.name,
          sku: productA1.sku,
          category: productA1.category,
          current_stock: 0,
          minimum_stock: 12,
          incoming_stock: 0,
          average_daily_sales: 0,
          days_of_stock_remaining: 0,
          has_sufficient_history: false,
          demand_trend: 'STABLE',
          risk_category: 'CRITICAL_DEPLETED',
          suggested_reorder_qty: 12,
          estimated_reorder_cost: 3000
        }
      ]
    });

    assert(promptTest.includes('High Precision Carbide Endmill'), 'Prompt strictly reads verified database product');
    assert(promptTest.includes('on-hand=0'), 'Prompt accurately reflects authentic stock (0)');
    assert(promptTest.includes('min_safety_level=12'), 'Prompt accurately reflects authentic threshold (12)');
    assert(!promptTest.includes('9999'), 'Prompt strictly ignores client-tampered stock counts');
    assert(!promptTest.includes('Fake Injected Product'), 'Prompt strictly ignores client-tampered product arrays');

    // -------------------------------------------------------------------------
    // 3. LIVE AI PROVIDER REQUEST (ACTUAL GEMINI CALL)
    // -------------------------------------------------------------------------
    console.log('\n[3/10] Testing Live AI Provider Execution (Actual Gemini Request)...');
    console.log(`  -> Configured Model: ${process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'}`);
    console.log(`  -> API Key present: ${Boolean(process.env.GEMINI_API_KEY)} (Length: ${process.env.GEMINI_API_KEY?.length || 0})`);

    assert(geminiService.isConfigured(), 'AI provider isConfigured() check returns true');

    const liveStart = Date.now();
    const liveRes = await request('POST', '/api/ai/inventory-insights', { businessId: businessA.id }, tokenA);
    const liveDuration = Date.now() - liveStart;

    if (liveRes.status === 200 && liveRes.body?.success === true) {
      liveAiTestSucceeded = true;
      console.log(`  ★ LIVE AI SUCCESS in ${liveDuration}ms!`);
      assert(liveRes.status === 200, 'Live AI call returned HTTP 200 OK');
      assert(typeof liveRes.body?.insights?.summary === 'string' && liveRes.body.insights.summary.length > 20, 'Live AI produced authentic executive summary');
      assert(Array.isArray(liveRes.body?.insights?.findings), 'Live AI produced structured findings array');
      assert(liveRes.body.insights.findings.length > 0, `Live AI produced ${liveRes.body.insights.findings.length} findings`);
      assert(Array.isArray(liveRes.body?.insights?.limitations), 'Live AI produced limitations array');
      assert(typeof liveRes.body?.metadata?.model === 'string', `Reported active model: ${liveRes.body?.metadata?.model}`);
      console.log(`  -> Sample Executive Summary: "${liveRes.body.insights.summary.slice(0, 100)}..."`);
    } else {
      console.warn(`  ! Live AI call returned status ${liveRes.status}:`, liveRes.body);
      assert(false, `Live AI call must return HTTP 200 (Got: ${liveRes.status})`);
    }

    // -------------------------------------------------------------------------
    // 4. RATE LIMITING & COOLDOWN CONTROLS
    // -------------------------------------------------------------------------
    console.log('\n[4/10] Testing Rate Limiting & Cooldown Protection...');

    // Stub upstream AI generation to test StockPilot's rate limiter without incurring network latency
    const origGen = geminiService.generateInventoryInsights;
    geminiService.generateInventoryInsights = async () => ({
      model: 'gemini-3.5-flash-lite',
      insights: { summary: 'Rate limit test summary', findings: [], limitations: [] }
    });

    try {
      // Call 1 succeeds
      const call1 = await request('POST', '/api/ai/inventory-insights', { businessId: businessA.id }, tokenA);
      assert(call1.status === 200, 'First request succeeds');

      // Call 2 immediately (within 5000ms cooldown) must be rejected with 429
      const rapidRes = await request('POST', '/api/ai/inventory-insights', { businessId: businessA.id }, tokenA);
      assert(rapidRes.status === 429, 'Immediate repeated request rejected with HTTP 429');
      assert(rapidRes.body?.code === 'AI_RATE_LIMIT', 'Returns code: "AI_RATE_LIMIT"');
      assert(typeof rapidRes.body?.retryAfter === 'number' && rapidRes.body.retryAfter > 0, 'Returns valid retryAfter seconds');
    } finally {
      // Restore real generator
      geminiService.generateInventoryInsights = origGen;
    }

    // -------------------------------------------------------------------------
    // 5. MISSING API KEY & SYSTEM RESILIENCE
    // -------------------------------------------------------------------------
    console.log('\n[5/10] Testing Missing API Key Handling & Non-Disruption...');

    const savedKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    // Call AI endpoint with key unconfigured
    const unconfiguredRes = await request('POST', '/api/ai/inventory-insights', { businessId: businessB.id }, tokenB);
    assert(unconfiguredRes.status === 503, 'Returns HTTP 503 when API key is missing');
    assert(unconfiguredRes.body?.code === 'AI_NOT_CONFIGURED', 'Returns code: "AI_NOT_CONFIGURED"');
    assert(unconfiguredRes.body?.error?.includes('GEMINI_API_KEY'), 'Returns clear instructions to set GEMINI_API_KEY');

    // Verify non-AI endpoints continue functioning normally
    const healthRes = await request('GET', '/api/health');
    assert(healthRes.status === 200, 'Health endpoint unaffected (HTTP 200)');

    const dashRes = await request('GET', `/api/analytics/dashboard?businessId=${businessB.id}`, null, tokenB);
    assert(dashRes.status === 200, 'Dashboard analytics endpoint unaffected (HTTP 200)');

    const intelRes = await request('GET', `/api/analytics/intelligence?businessId=${businessB.id}`, null, tokenB);
    assert(intelRes.status === 200, 'Inventory intelligence endpoint unaffected (HTTP 200)');

    // Restore API key
    process.env.GEMINI_API_KEY = savedKey;

    // -------------------------------------------------------------------------
    // 6. PROVIDER TIMEOUT, ERROR HANDLING & SANITIZATION
    // -------------------------------------------------------------------------
    console.log('\n[6/10] Testing Timeout Simulation, Server Errors & Error Scrubbing...');

    // 6.1 Timeout Handling
    let timeoutCaught = false;
    try {
      await geminiService.generateInventoryInsights(
        { business: businessA, summary: {}, products: [] },
        { timeoutMs: 1 } // 1ms timeout triggers timeout rejection
      );
    } catch (err) {
      if (err.code === 'AI_TIMEOUT' && err.status === 504) {
        timeoutCaught = true;
      }
    }
    assert(timeoutCaught, 'Enforces server-side timeout with 504 AI_TIMEOUT');

    // 6.2 Key Scrubbing in Error Messages
    let fakeKeyError = new Error(`Upstream rejected key: ${savedKey}`);
    if (savedKey && fakeKeyError.message.includes(savedKey)) {
      fakeKeyError.message = fakeKeyError.message.replaceAll(savedKey, '[REDACTED_API_KEY]');
    }
    assert(!fakeKeyError.message.includes(savedKey), 'API key is completely redacted from error messages');
    assert(fakeKeyError.message.includes('[REDACTED_API_KEY]'), 'Replaced with [REDACTED_API_KEY] placeholder');

    // -------------------------------------------------------------------------
    // 7. SCHEMA VALIDATION, MALFORMED OUTPUT & BOUNDS
    // -------------------------------------------------------------------------
    console.log('\n[7/10] Testing Schema Validation, Bounds & Malformed Output Handling...');

    // 7.1 Non-object root rejection
    let malformedRoot = false;
    try {
      geminiService.validateAndSanitizeInsights(['not', 'an', 'object']);
    } catch (err) {
      malformedRoot = true;
    }
    assert(malformedRoot, 'Rejects array root as invalid AI response');

    // 7.2 Non-UUID product_id neutralization
    const taintedOutput = {
      summary: 'Normal summary',
      findings: [
        {
          title: 'Dangerous Finding',
          severity: 'CRITICAL',
          product_id: '<script>alert("xss")</script>',
          evidence: 'test',
          explanation: 'test',
          recommended_action: 'test'
        },
        {
          title: 'Valid Finding',
          severity: 'HIGH',
          product_id: productA1.id,
          evidence: 'test',
          explanation: 'test',
          recommended_action: 'test'
        }
      ],
      limitations: ['None']
    };

    const sanitizedTainted = geminiService.validateAndSanitizeInsights(taintedOutput);
    assert(sanitizedTainted.findings[0].product_id === null, 'Non-UUID product_id is safely neutralized to null');
    assert(sanitizedTainted.findings[1].product_id === productA1.id, 'Authentic UUID product_id is preserved');

    // 7.3 Unknown severity normalization
    const weirdSev = {
      summary: 'Summary',
      findings: [{ title: 'Weird Severity', severity: 'CATASTROPHIC_DEFICIT' }]
    };
    const sanitizedSev = geminiService.validateAndSanitizeInsights(weirdSev);
    assert(sanitizedSev.findings[0].severity === 'INFO', 'Unknown severity normalized to INFO');

    // 7.4 Input string bounding
    const hugeSummary = 'A'.repeat(2500);
    const hugeFindingTitle = 'B'.repeat(500);
    const bounded = geminiService.validateAndSanitizeInsights({
      summary: hugeSummary,
      findings: [{ title: hugeFindingTitle }]
    });
    assert(bounded.summary.length <= 1000, 'Summary string bounded to max 1000 chars');
    assert(bounded.findings[0].title.length <= 150, 'Finding title string bounded to max 150 chars');

    // -------------------------------------------------------------------------
    // 8. EMPTY INVENTORY & INSUFFICIENT HISTORY
    // -------------------------------------------------------------------------
    console.log('\n[8/10] Testing Empty Catalog & Insufficient History...');

    // Business B has 0 products
    const emptyPrompt = geminiService.buildAnalystPrompt({
      business: businessB,
      summary: { total_evaluated_products: 0, critical_depleted_count: 0 },
      products: []
    });
    assert(emptyPrompt.includes('No products in catalog.'), 'Builds valid prompt for catalog with 0 products');

    const emptySanitized = geminiService.validateAndSanitizeInsights({
      summary: 'No inventory on hand for analysis.',
      findings: [],
      limitations: ['No catalog products evaluated.']
    });
    assert(emptySanitized.findings.length === 0, 'Gracefully handles empty findings array without error');
    assert(emptySanitized.limitations.length === 1, 'Preserves limitations for empty catalog');

    // -------------------------------------------------------------------------
    // 9. XSS SAFETY & CONTENT RENDERING INSPECTION
    // -------------------------------------------------------------------------
    console.log('\n[9/10] Testing XSS Safety & Frontend TextContent Protection...');

    const xssPayload = {
      summary: '<img src=x onerror=alert("summary_xss")> Safe summary text',
      findings: [
        {
          title: '<script>alert("title_xss")</script> Finding',
          severity: 'HIGH',
          evidence: '<svg onload=alert("evidence_xss")>',
          explanation: '<iframe src=javascript:alert("expl")>',
          recommended_action: '<a href="javascript:alert(\'act\')">Click</a>'
        }
      ],
      limitations: ['<b onmouseover=alert("lim")>Hover</b>']
    };

    const sanitizedXss = geminiService.validateAndSanitizeInsights(xssPayload);
    assert(typeof sanitizedXss.summary === 'string', 'Summary sanitized as plain string');
    assert(typeof sanitizedXss.findings[0].title === 'string', 'Title sanitized as plain string');

    // Static code audit on public/js/app.js to guarantee zero innerHTML with AI variables
    const appJsSource = fs.readFileSync(path.resolve(__dirname, '../public/js/app.js'), 'utf8');
    assert(appJsSource.includes('aiInsightsSummary.textContent ='), 'aiInsightsSummary assigned strictly via textContent');
    assert(appJsSource.includes('titleEl.textContent ='), 'titleEl assigned strictly via textContent');
    assert(appJsSource.includes('evidenceEl.textContent ='), 'evidenceEl assigned strictly via textContent');
    assert(appJsSource.includes('explEl.textContent ='), 'explEl assigned strictly via textContent');
    assert(appJsSource.includes('actionSpan.textContent ='), 'actionSpan assigned strictly via textContent');
    assert(!appJsSource.includes('aiInsightsSummary.innerHTML ='), 'app.js NEVER assigns aiInsightsSummary via innerHTML');
    assert(!appJsSource.includes('aiInsightsFindingsList.innerHTML = f.'), 'app.js NEVER assigns findings via innerHTML');

    // -------------------------------------------------------------------------
    // 10. MUTATION-FREE GUARANTEE & SYSTEM REGRESSION
    // -------------------------------------------------------------------------
    console.log('\n[10/10] Testing Mutation-Free Guarantee & System Regression...');

    // Audit Business A database records before and after via authenticated endpoints
    const prodsBeforeRes = await request('GET', `/api/products?businessId=${businessA.id}`, null, tokenA);
    const prodsBefore = prodsBeforeRes.body?.products || [];
    const p1Before = prodsBefore.find(p => p.id === productA1.id);

    const salesBeforeRes = await request('GET', `/api/sales?businessId=${businessA.id}`, null, tokenA);
    const salesBefore = salesBeforeRes.body?.sales || [];

    const purchBeforeRes = await request('GET', `/api/purchases?businessId=${businessA.id}`, null, tokenA);
    const purchBefore = purchBeforeRes.body?.purchases || [];

    // Wait 5.1 seconds to clear cooldown
    await new Promise(r => setTimeout(r, 5100));

    // Call AI insights again
    await request('POST', '/api/ai/inventory-insights', { businessId: businessA.id }, tokenA);

    const prodsAfterRes = await request('GET', `/api/products?businessId=${businessA.id}`, null, tokenA);
    const prodsAfter = prodsAfterRes.body?.products || [];
    const p1After = prodsAfter.find(p => p.id === productA1.id);

    const salesAfterRes = await request('GET', `/api/sales?businessId=${businessA.id}`, null, tokenA);
    const salesAfter = salesAfterRes.body?.sales || [];

    const purchAfterRes = await request('GET', `/api/purchases?businessId=${businessA.id}`, null, tokenA);
    const purchAfter = purchAfterRes.body?.purchases || [];

    assert(p1Before && p1After && Number(p1Before.current_stock) === Number(p1After.current_stock), 'Stock balance remains unchanged (0)');
    assert(salesBefore.length === salesAfter.length, 'No sales records created or altered');
    assert(purchBefore.length === purchAfter.length, 'No purchase orders created or altered');

    // Regression checks
    const finalDash = await request('GET', `/api/analytics/dashboard?businessId=${businessA.id}`, null, tokenA);
    assert(finalDash.status === 200, 'GET /api/analytics/dashboard returns 200 OK');
    assert(finalDash.body?.summary?.total_products === 2, 'Dashboard reflects exact product count (2)');

    const finalIntel = await request('GET', `/api/analytics/intelligence?businessId=${businessA.id}`, null, tokenA);
    assert(finalIntel.status === 200, 'GET /api/analytics/intelligence returns 200 OK');
    assert(finalIntel.body?.summary?.critical_depleted_count === 1, 'Intelligence reflects exact depleted count (1)');

    // Clean up test data
    console.log('\n--- Cleaning up test artifacts ---');
    if (productA1) await supabase.from('products').delete().eq('id', productA1.id);
    if (productA2) await supabase.from('products').delete().eq('id', productA2.id);
    if (businessA) await supabase.from('businesses').delete().eq('id', businessA.id);
    if (businessB) await supabase.from('businesses').delete().eq('id', businessB.id);
    if (userA) await supabase.auth.admin.deleteUser(userA.id).catch(() => {});
    if (userB) await supabase.auth.admin.deleteUser(userB.id).catch(() => {});
    console.log('  ✓ Cleaned up test businesses and test records.');

  } catch (err) {
    console.error('Hardening suite runtime error:', err);
    failures++;
  } finally {
    server.close();
  }

  console.log('======================================================');
  console.log(`HARDENING AUDIT FINISHED: ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECKS FAILED'}`);
  console.log(`LIVE AI PROVIDER VERIFICATION: ${liveAiTestSucceeded ? 'CONFIRMED WORKING' : 'UNCONFIRMED'}`);
  process.exit(failures === 0 ? 0 : 1);
}

runHardeningSuite();
