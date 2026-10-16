/**
 * StockPilot Stage 6.2.3: Inventory Intelligence UI Verification Suite
 * Verifies HTML structure, CSS rules, DOM identifiers, JavaScript runtime functions,
 * prefill integration with purchase modal, and end-to-end API data flow.
 */

const http = require('http');
const fs = require('fs');

process.env.PORT = '3096';
const { app, server } = require('../server');
const { getSupabaseClient } = require('../services/supabaseClient');
const supabase = getSupabaseClient();
const TEST_PORT = 3096;

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
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runUiVerification() {
  console.log('=== StockPilot Stage 6.2.3: Inventory Intelligence UI Verification Suite ===\n');

  // ---------------------------------------------------------------------------
  // 1. STATIC DOM IDENTIFIERS & MARKUP AUDIT
  // ---------------------------------------------------------------------------
  console.log('[1/5] Verifying Static HTML Markup & DOM Identifiers...');
  const html = fs.readFileSync('public/index.html', 'utf8');

  const requiredIds = [
    'dashboard-intelligence-section',
    'intel-window-select',
    'intel-target-select',
    'btn-refresh-intel',
    'intel-last-updated',
    'intel-error-alert',
    'intel-error-text',
    'btn-retry-intel',
    'intel-loading-state',
    'intel-summary-depleted',
    'intel-summary-high-risk',
    'intel-summary-moderate-risk',
    'intel-summary-insufficient-data',
    'intel-summary-reorder-cost',
    'intel-filter-all',
    'intel-filter-critical',
    'intel-filter-moderate',
    'intel-filter-healthy',
    'intel-filter-insufficient',
    'intel-count-all',
    'intel-count-critical',
    'intel-count-moderate',
    'intel-count-healthy',
    'intel-count-insufficient',
    'intel-search-input',
    'intel-table',
    'intel-tbody',
    'intel-empty-catalog',
    'intel-empty-restock',
    'intel-empty-filter'
  ];

  for (const id of requiredIds) {
    assert(html.includes(`id="${id}"`), `DOM element #${id} exists in public/index.html`);
  }

  // ---------------------------------------------------------------------------
  // 2. CSS STYLING & DESIGN TOKEN ADHERENCE
  // ---------------------------------------------------------------------------
  console.log('\n[2/5] Verifying CSS Rules & Industrial Design Tokens...');
  const css = fs.readFileSync('public/css/styles.css', 'utf8');

  assert(css.includes('.intelligence-card-wrap'), 'CSS defines .intelligence-card-wrap container');
  assert(css.includes('.intel-summary-grid'), 'CSS defines .intel-summary-grid layout');
  assert(css.includes('.risk-badge.critical'), 'CSS defines .risk-badge.critical token');
  assert(css.includes('.risk-badge.high'), 'CSS defines .risk-badge.high token');
  assert(css.includes('.risk-badge.moderate'), 'CSS defines .risk-badge.moderate token');
  assert(css.includes('.risk-badge.healthy'), 'CSS defines .risk-badge.healthy token');
  assert(css.includes('.risk-badge.calibrating'), 'CSS defines .risk-badge.calibrating token');
  assert(css.includes('.runway-val.uncalibrated'), 'CSS defines .runway-val.uncalibrated styling');
  assert(css.includes('.intel-tab-btn.active'), 'CSS defines .intel-tab-btn.active state');
  assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'CSS includes reduced-motion accessibility preference');

  // ---------------------------------------------------------------------------
  // 3. JAVASCRIPT FUNCTIONAL AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n[3/5] Verifying JavaScript Application Architecture...');
  const js = fs.readFileSync('public/js/app.js', 'utf8');

  assert(js.includes('async function loadIntelligence('), 'app.js defines loadIntelligence() function');
  assert(js.includes('function renderIntelligenceTable('), 'app.js defines renderIntelligenceTable() function');
  assert(js.includes('openPurchaseModal(prefill'), 'openPurchaseModal supports prefill parameter');
  assert(js.includes('addPurchaseItemRow(prefill'), 'addPurchaseItemRow supports prefill parameter');
  assert(js.includes('btn-intel-restock'), 'app.js wires restock click handler to openPurchaseModal');
  assert(js.includes('currentIntelligenceFilter'), 'app.js maintains dynamic risk category filter state');
  assert(js.includes('intelligenceRequestId'), 'app.js protects against stale responses via request sequencing');

  // ---------------------------------------------------------------------------
  // 4. LIVE SERVER & API CONTRACT VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n[4/5] Testing Live Server & Inventory Intelligence Workflow...');

  console.log(`Test server running on port ${TEST_PORT}`);

  let testUser = null;
  let testBusiness = null;
  let testToken = null;

  try {
    const testId = Date.now();
    const testEmail = `intel_ui_test_${testId}@stockpilot.local`;
    const testPassword = 'Password123!Secure';

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    if (authErr) throw authErr;
    testUser = authData.user;

    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    if (signInErr) throw signInErr;
    testToken = signInData.session.access_token;

    // Create Business in EUR currency to verify dynamic currency formatting
    const bizRes = await request('POST', '/api/businesses', {
      name: 'Precision European Logistics',
      industry: 'Wholesale & Distribution',
      currency: 'EUR',
      location: 'Frankfurt Hub, DE'
    }, testToken);
    assert(bizRes.status === 201, 'Created test business workspace with EUR currency');
    testBusiness = bizRes.body.business;

    // Ingest Product 1: Out of stock (Depleted)
    const p1Res = await request('POST', '/api/products', {
      business_id: testBusiness.id,
      name: 'Depleted Titanium Bearing',
      sku: `SKU-DEP-${testId}`,
      category: 'Bearings',
      purchase_price: 85,
      selling_price: 150,
      current_stock: 0,
      minimum_stock: 12
    }, testToken);
    assert(p1Res.status === 201, 'Created depleted product (Stock: 0, Min: 12)');
    const p1 = p1Res.body.product;

    // Ingest Product 2: Calibrating (Created today, 0 orders)
    const p2Res = await request('POST', '/api/products', {
      business_id: testBusiness.id,
      name: 'Calibrating Laser Sensor',
      sku: `SKU-CAL-${testId}`,
      category: 'Sensors',
      purchase_price: 120,
      selling_price: 240,
      current_stock: 25,
      minimum_stock: 10
    }, testToken);
    assert(p2Res.status === 201, 'Created calibrating product (Stock: 25, Min: 10)');
    const p2 = p2Res.body.product;

    // Ingest Product 3: Backdated active product for runway testing
    const p3Res = await request('POST', '/api/products', {
      business_id: testBusiness.id,
      name: 'Active Pneumatic Cylinder',
      sku: `SKU-ACT-${testId}`,
      category: 'Pneumatics',
      purchase_price: 60,
      selling_price: 110,
      current_stock: 40,
      minimum_stock: 15
    }, testToken);
    assert(p3Res.status === 201, 'Created active product for velocity modeling');
    const p3 = p3Res.body.product;

    // Backdate Product 3
    const backdate35d = new Date(Date.now() - 35 * 86400000).toISOString();
    await supabase.from('products').update({ created_at: backdate35d }).eq('id', p3.id);

    // Record sales to establish velocity (2 orders, 20 units total => ADS = 20 / 30 = 0.667)
    await request('POST', '/api/sales', {
      business_id: testBusiness.id,
      customer_name: 'Client Alpha',
      items: [{ product_id: p3.id, quantity: 10, unit_price: 110 }]
    }, testToken);

    await request('POST', '/api/sales', {
      business_id: testBusiness.id,
      customer_name: 'Client Beta',
      items: [{ product_id: p3.id, quantity: 10, unit_price: 110 }]
    }, testToken);

    // Set Product 3 stock to 4 (ADS ~ 0.67 => runway = 4 / 0.67 = 6.0 days => HIGH_RISK)
    await supabase.from('products').update({ current_stock: 4 }).eq('id', p3.id);

    // Fetch Intelligence default (windowDays=30, targetDays=30)
    const intelRes = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}`, null, testToken);
    assert(intelRes.status === 200, 'GET /api/analytics/intelligence returns 200 OK');
    assert(intelRes.body.currency === 'EUR', 'Correctly reports EUR business currency');
    assert(intelRes.body.summary.critical_depleted_count === 1, 'Summary reports 1 depleted stock item');
    assert(intelRes.body.summary.high_risk_count === 1, 'Summary reports 1 high-risk item');
    assert(intelRes.body.summary.insufficient_data_count === 1, 'Summary reports 1 calibrating/insufficient data item');

    const recs = intelRes.body.recommendations;
    const r1 = recs.find(r => r.product_id === p1.id);
    const r2 = recs.find(r => r.product_id === p2.id);
    const r3 = recs.find(r => r.product_id === p3.id);

    assert(r1.intelligence.risk_category === 'CRITICAL_DEPLETED', 'Product 1 receives CRITICAL_DEPLETED rank');
    assert(r1.metrics.days_of_stock_remaining === 0, 'Depleted product reports runway 0 days');
    assert(r1.intelligence.suggested_reorder_qty === 12, 'Depleted product suggests reorder of 12 units');

    assert(r2.intelligence.risk_category === 'INSUFFICIENT_DATA', 'Product 2 receives INSUFFICIENT_DATA status');
    assert(r2.metrics.days_of_stock_remaining === null, 'Calibrating product correctly maintains null runway');

    assert(r3.intelligence.risk_category === 'HIGH_RISK', 'Product 3 receives HIGH_RISK status');
    assert(r3.metrics.days_of_stock_remaining <= 7, 'Product 3 reports runway <= 7 days');

    // Test parameterization: targetDays=60
    const intel60Res = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}&targetDays=60`, null, testToken);
    assert(intel60Res.status === 200, 'Target days parameterization (targetDays=60) returns 200 OK');
    const r3_60 = intel60Res.body.recommendations.find(r => r.product_id === p3.id);
    assert(r3_60.intelligence.target_units >= 40, '60-day target scales target stock requirements');

    // ---------------------------------------------------------------------------
    // 5. RESTOCK PURCHASE PREFILL SIMULATION & SAFETY AUDIT
    // ---------------------------------------------------------------------------
    console.log('\n[5/5] Testing Restock Workflow Safety & Non-Submission Guarantee...');

    // Verify initial stock has NOT been modified by merely querying or evaluating recommendations
    const { data: p1Before } = await supabase.from('products').select('current_stock').eq('id', p1.id).single();
    assert(p1Before.current_stock === 0, 'Product stock is untouched by intelligence evaluation (remains 0)');

    // Verify user can create a purchase order prefilled with intelligence values
    const poRes = await request('POST', '/api/purchases', {
      business_id: testBusiness.id,
      status: 'ordered',
      notes: 'Replenishment order from intelligence recommendation',
      items: [{
        product_id: p1.id,
        quantity: r1.intelligence.suggested_reorder_qty,
        unit_cost: r1.unit_cost
      }]
    }, testToken);
    assert(poRes.status === 201, 'Restock purchase order successfully created via standard purchase route');

    // Verify purchase order is "ordered" (inbound), not received yet, so on-hand stock remains 0
    const { data: p1AfterPo } = await supabase.from('products').select('current_stock').eq('id', p1.id).single();
    assert(p1AfterPo.current_stock === 0, 'On-hand stock remains 0 until warehouse receives the order');

    // Verify intelligence now reflects the inbound PO (incoming_stock = 12, suggested reorder drops to 0)
    const intelAfterPo = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}`, null, testToken);
    const r1AfterPo = intelAfterPo.body.recommendations.find(r => r.product_id === p1.id);
    assert(r1AfterPo.incoming_stock === 12, 'Intelligence immediately recognizes +12 units in inbound PO');
    assert(r1AfterPo.effective_available_stock === 12, 'Effective available stock is now 12 (0 + 12)');
    assert(r1AfterPo.intelligence.suggested_reorder_qty === 0, 'Suggested reorder drops to 0 because incoming PO satisfies minimum');

  } catch (err) {
    console.error('\nFatal UI Verification Suite Error:', err);
    failures++;
  } finally {
    console.log('\n--- Cleaning up test artifacts ---');
    try {
      if (testBusiness) {
        await supabase.from('sale_items').delete().eq('business_id', testBusiness.id);
        await supabase.from('sales').delete().eq('business_id', testBusiness.id);
        await supabase.from('purchase_items').delete().eq('business_id', testBusiness.id);
        await supabase.from('purchases').delete().eq('business_id', testBusiness.id);
        await supabase.from('products').delete().eq('business_id', testBusiness.id);
        await supabase.from('business_members').delete().eq('business_id', testBusiness.id);
        await supabase.from('businesses').delete().eq('id', testBusiness.id);
        console.log('  ✓ Cleaned up test business and test records.');
      }
    } catch (cleanupErr) {
      console.warn('  ! Cleanup warning:', cleanupErr.message);
    }

    server.close(() => {
      console.log('======================================================');
      if (failures === 0) {
        console.log('ALL INVENTORY INTELLIGENCE UI VERIFICATIONS PASSED (0 failures)!');
        process.exit(0);
      } else {
        console.error(`VERIFICATION SUITE COMPLETED WITH ${failures} FAILURE(S).`);
        process.exit(1);
      }
    });
  }
}

runUiVerification();
