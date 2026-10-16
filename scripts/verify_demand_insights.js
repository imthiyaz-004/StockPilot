const http = require('http');
const { getSupabaseClient } = require('../services/supabaseClient');
const demandService = require('../services/demandService');

process.env.PORT = '3092';
const { app, server } = require('../server');

async function runDemandVerification() {
  console.log('=== StockPilot Stage 7.3: Demand Insights & Slow-Moving Stock Verification Suite ===\n');
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
          port: 3092,
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
  const testEmail = `demand_test_${testId}@stockpilot.local`;
  const testPassword = 'DemandPassword123!';
  let testUser = null;
  let testToken = null;
  let testBusiness = null;

  const testProductIds = [];
  const testSaleIds = [];

  try {
    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & BUSINESS AUTHORIZATION
    // -------------------------------------------------------------------------
    console.log('[1/8] Testing Authentication & Business Authorization Controls...');

    // 1.1 Unauthenticated Request
    const noAuth = await request('GET', '/api/analytics/demand-insights?businessId=00000000-0000-0000-0000-000000000000');
    assert(noAuth.status === 401, 'Rejects unauthenticated request without token (HTTP 401)');

    // 1.2 Invalid Bearer Token
    const badAuth = await request('GET', '/api/analytics/demand-insights?businessId=00000000-0000-0000-0000-000000000000', null, 'invalid.jwt.token');
    assert(badAuth.status === 401, 'Rejects forged or invalid token (HTTP 401)');

    // 1.3 Provision Test User Session
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    if (authErr || !authData.user) throw new Error(`User provisioning failed: ${authErr?.message}`);
    testUser = authData.user;
    testToken = authData.session?.access_token;
    if (!testToken) {
      const { data: logData } = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
      testToken = logData.session.access_token;
    }
    assert(Boolean(testToken), 'Established isolated test user session');

    // 1.4 Missing businessId
    const missingBiz = await request('GET', '/api/analytics/demand-insights', null, testToken);
    assert(missingBiz.status === 403, 'Rejects request missing businessId (HTTP 403)');

    // 1.5 Malformed businessId
    const malformedBiz = await request('GET', '/api/analytics/demand-insights?businessId=not-a-uuid', null, testToken);
    assert(malformedBiz.status === 403, 'Rejects malformed non-UUID businessId (HTTP 403)');

    // 1.6 Cross-business access
    const crossBiz = await request('GET', '/api/analytics/demand-insights?businessId=a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', null, testToken);
    assert(crossBiz.status === 403, 'Rejects cross-business access to foreign UUID (HTTP 403)');

    // 1.7 Provision Isolated Test Business
    const bizRes = await request('POST', '/api/businesses', {
      name: `Demand Insights Test Business ${testId}`,
      currency: 'INR',
      industry: 'Machinery'
    }, testToken);
    assert(bizRes.status === 201, 'Created isolated test business workspace (INR)');
    testBusiness = bizRes.body.business;

    // -------------------------------------------------------------------------
    // 2. PARAMETER VALIDATION & EMPTY BUSINESS HANDLING
    // -------------------------------------------------------------------------
    console.log('\n[2/8] Testing Window Parameters & Empty Catalog State...');

    // 2.1 Invalid windowDays
    const badWindow = await request('GET', `/api/analytics/demand-insights?businessId=${testBusiness.id}&windowDays=45`, null, testToken);
    assert(badWindow.status === 400, 'Rejects unsupported windowDays=45 (HTTP 400)');

    const badWindow2 = await request('GET', `/api/analytics/demand-insights?businessId=${testBusiness.id}&windowDays=7`, null, testToken);
    assert(badWindow2.status === 400, 'Rejects unsupported windowDays=7 (HTTP 400)');

    // 2.2 Valid windowDays=30 on empty catalog
    const emptyRes = await request('GET', `/api/analytics/demand-insights?businessId=${testBusiness.id}&windowDays=30`, null, testToken);
    assert(emptyRes.status === 200, 'GET /api/analytics/demand-insights returns 200 OK for empty business');
    assert(emptyRes.body?.summary?.total_active_products === 0, 'Empty business reports total_active_products: 0');
    assert(emptyRes.body?.summary?.overstocked_count === 0, 'Empty business reports overstocked_count: 0');
    assert(Array.isArray(emptyRes.body?.items) && emptyRes.body.items.length === 0, 'Returns empty items array');
    assert(emptyRes.body?.period_context?.window_days === 30, 'Reports window_days: 30 in period context');

    // 2.3 Valid windowDays=14
    const win14Res = await request('GET', `/api/analytics/demand-insights?businessId=${testBusiness.id}&windowDays=14`, null, testToken);
    assert(win14Res.status === 200, 'Accepts valid windowDays=14 (HTTP 200)');
    assert(win14Res.body?.period_context?.window_days === 14, 'Reports window_days: 14 in period context');

    // -------------------------------------------------------------------------
    // 3. CATALOG CREATION & INSUFFICIENT HISTORY / CALIBRATING CLASSIFICATION
    // -------------------------------------------------------------------------
    console.log('\n[3/8] Testing Catalog Ingestion & Newly Listed Calibrating Status...');

    // Product 1: Newly listed (created today), stock 25, reorder 10
    const p1Res = await request('POST', '/api/products', {
      business_id: testBusiness.id,
      name: 'Newly Listed Calibrating Sensor',
      sku: `SKU-CALIB-${testId}`,
      category: 'Electronics',
      purchase_price: 150,
      selling_price: 300,
      current_stock: 25,
      minimum_stock: 10
    }, testToken);
    assert(p1Res.status === 201, 'Created newly listed Product 1 (Stock: 25, Min: 10)');
    const product1 = p1Res.body.product;
    testProductIds.push(product1.id);

    // Product 2: Inactive product (should be excluded from demand evaluation)
    const p2Res = await request('POST', '/api/products', {
      business_id: testBusiness.id,
      name: 'Decommissioned Inactive Drill',
      sku: `SKU-INACT-${testId}`,
      category: 'Tools',
      purchase_price: 200,
      selling_price: 400,
      current_stock: 50,
      minimum_stock: 10
    }, testToken);
    const product2 = p2Res.body.product;
    testProductIds.push(product2.id);
    // Mark product 2 inactive directly in database
    await supabase.from('products').update({ is_active: false }).eq('id', product2.id);

    // Fetch demand insights to verify newly listed handling and inactive exclusion
    const calibCheck = await request('GET', `/api/analytics/demand-insights?businessId=${testBusiness.id}&windowDays=30`, null, testToken);
    assert(calibCheck.body?.summary?.total_active_products === 1, 'Excludes inactive product (evaluates only 1 active product)');
    assert(calibCheck.body?.items[0]?.product_id === product1.id, 'Includes active Product 1');
    assert(calibCheck.body?.items[0]?.velocity_metrics?.velocity_status === 'CALIBRATING', 'Classifies newly listed item as CALIBRATING');
    assert(calibCheck.body?.items[0]?.velocity_metrics?.is_slow_moving === false, 'Newly listed item is NOT falsely flagged as slow-moving');
    assert(calibCheck.body?.items[0]?.demand_metrics?.demand_trend === 'UNCLASSIFIED', 'Newly listed item demand trend is UNCLASSIFIED');
    assert(calibCheck.body?.items[0]?.demand_metrics?.turnover_days === null, 'Turnover days is null when daily sales velocity is zero');

    // -------------------------------------------------------------------------
    // 4. PERIOD-OVER-PERIOD TRENDS: ZERO PRECEDING DEMAND (0 -> X)
    // -------------------------------------------------------------------------
    console.log('\n[4/8] Testing Zero Previous-Period Demand & Safe Math (0 -> X)...');

    // Update Product 1 created_at to 60 days ago so it has catalog history
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('products').update({ created_at: sixtyDaysAgo }).eq('id', product1.id);

    // Record completed sale of 8 units within the Recent Period (10 days ago)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const { data: sale1, error: s1Err } = await supabase.from('sales').insert({
      business_id: testBusiness.id,
      sale_number: `SO-RECENT-${testId}-01`,
      customer_name: 'Metro Machining',
      status: 'completed',
      sale_date: tenDaysAgo,
      total_amount: 2400
    }).select().single();
    if (s1Err) throw new Error(`Sale 1 insert failed: ${s1Err.message}`);
    testSaleIds.push(sale1.id);

    await supabase.from('sale_items').insert({
      business_id: testBusiness.id,
      sale_id: sale1.id,
      product_id: product1.id,
      quantity: 8,
      unit_price: 300,
      unit_cost: 150,
      line_total: 2400
    });

    const newDemandRes = await request('GET', `/api/analytics/demand-insights?businessId=${testBusiness.id}&windowDays=30`, null, testToken);
    const p1Metrics = newDemandRes.body?.items?.find(i => i.product_id === product1.id);

    assert(p1Metrics?.demand_metrics?.recent_units_sold === 8, 'Accurately counts 8 units sold in recent 30 days');
    assert(p1Metrics?.demand_metrics?.preceding_units_sold === 0, 'Accurately counts 0 units sold in preceding 30 days');
    assert(p1Metrics?.demand_metrics?.percentage_change === null, 'percentage_change is strictly null when earlier volume is 0 (avoids division by zero)');
    assert(p1Metrics?.demand_metrics?.percentage_change_label?.includes('New Volume'), 'Labels change as "New Volume (0 → 8)"');
    assert(p1Metrics?.demand_metrics?.demand_trend === 'ACCELERATING', 'Classifies transition from 0 to 8 units as ACCELERATING demand');

    // -------------------------------------------------------------------------
    // 5. PERIOD-OVER-PERIOD TRENDS: ACCELERATING & DECELERATING DEMAND
    // -------------------------------------------------------------------------
    console.log('\n[5/8] Testing Accelerating vs Decelerating Demand Classification...');

    // Product 3: Decelerating item (30 units sold in preceding period, only 5 in recent period)
    const p3Res = await request('POST', '/api/products', {
      business_id: testBusiness.id,
      name: 'Hydraulic Piston Seal Kit',
      sku: `SKU-SEAL-${testId}`,
      category: 'Hydraulics',
      purchase_price: 80,
      selling_price: 180,
      current_stock: 40,
      minimum_stock: 15
    }, testToken);
    const product3 = p3Res.body.product;
    testProductIds.push(product3.id);
    await supabase.from('products').update({ created_at: sixtyDaysAgo }).eq('id', product3.id);

    // Sale in preceding period (45 days ago): 30 units
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const { data: salePreceding } = await supabase.from('sales').insert({
      business_id: testBusiness.id,
      sale_number: `SO-PREC-${testId}-01`,
      customer_name: 'Fluid Power Ltd',
      status: 'completed',
      sale_date: fortyFiveDaysAgo,
      total_amount: 5400
    }).select().single();
    testSaleIds.push(salePreceding.id);

    await supabase.from('sale_items').insert({
      business_id: testBusiness.id,
      sale_id: salePreceding.id,
      product_id: product3.id,
      quantity: 30,
      unit_price: 180,
      unit_cost: 80,
      line_total: 5400
    });

    // Sale in recent period (5 days ago): 5 units
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data: saleRecent } = await supabase.from('sales').insert({
      business_id: testBusiness.id,
      sale_number: `SO-REC-${testId}-01`,
      customer_name: 'Fluid Power Ltd',
      status: 'completed',
      sale_date: fiveDaysAgo,
      total_amount: 900
    }).select().single();
    testSaleIds.push(saleRecent.id);

    await supabase.from('sale_items').insert({
      business_id: testBusiness.id,
      sale_id: saleRecent.id,
      product_id: product3.id,
      quantity: 5,
      unit_price: 180,
      unit_cost: 80,
      line_total: 900
    });

    const decelRes = await request('GET', `/api/analytics/demand-insights?businessId=${testBusiness.id}&windowDays=30`, null, testToken);
    const p3Metrics = decelRes.body?.items?.find(i => i.product_id === product3.id);

    assert(p3Metrics?.demand_metrics?.recent_units_sold === 5, 'Product 3 recent units: 5');
    assert(p3Metrics?.demand_metrics?.preceding_units_sold === 30, 'Product 3 preceding units: 30');
    assert(p3Metrics?.demand_metrics?.percentage_change === -83.3, 'Product 3 percentage change calculated accurately (-83.3%)');
    assert(p3Metrics?.demand_metrics?.demand_trend === 'DECELERATING', 'Classifies -83.3% shift as DECELERATING demand');

    // -------------------------------------------------------------------------
    // 6. EXCLUSION OF DRAFT / PENDING / CANCELLED / REFUNDED SALES
    // -------------------------------------------------------------------------
    console.log('\n[6/8] Testing Strict Exclusion of Non-Completed Sales Statuses...');

    // Insert cancelled sale with 500 units
    const { data: saleCancelled } = await supabase.from('sales').insert({
      business_id: testBusiness.id,
      sale_number: `SO-CANCEL-${testId}`,
      customer_name: 'Cancelled Buyer',
      status: 'cancelled',
      sale_date: fiveDaysAgo,
      total_amount: 90000
    }).select().single();
    testSaleIds.push(saleCancelled.id);

    await supabase.from('sale_items').insert({
      business_id: testBusiness.id,
      sale_id: saleCancelled.id,
      product_id: product3.id,
      quantity: 500,
      unit_price: 180,
      unit_cost: 80,
      line_total: 90000
    });

    // Insert draft sale with 200 units
    const { data: saleDraft } = await supabase.from('sales').insert({
      business_id: testBusiness.id,
      sale_number: `SO-DRAFT-${testId}`,
      customer_name: 'Draft Buyer',
      status: 'draft',
      sale_date: fiveDaysAgo,
      total_amount: 36000
    }).select().single();
    testSaleIds.push(saleDraft.id);

    await supabase.from('sale_items').insert({
      business_id: testBusiness.id,
      sale_id: saleDraft.id,
      product_id: product3.id,
      quantity: 200,
      unit_price: 180,
      unit_cost: 80,
      line_total: 36000
    });

    const statusRes = await request('GET', `/api/analytics/demand-insights?businessId=${testBusiness.id}&windowDays=30`, null, testToken);
    const p3PostCancel = statusRes.body?.items?.find(i => i.product_id === product3.id);
    assert(p3PostCancel?.demand_metrics?.recent_units_sold === 5, 'Cancelled and draft sales (700 units) strictly excluded from recent demand');

    // -------------------------------------------------------------------------
    // 7. SLOW-MOVING INVENTORY & OVERSTOCK DETECTION
    // -------------------------------------------------------------------------
    console.log('\n[7/8] Testing Stagnant/Slow-Moving Stock & Overstock Flags...');

    // Product 4: Stagnant & Overstocked
    // Stock: 100, Reorder: 10, Cost: 50. Catalog age: 60 days. Zero sales in 60 days.
    const p4Res = await request('POST', '/api/products', {
      business_id: testBusiness.id,
      name: 'Obsolete Mounting Bracket 120mm',
      sku: `SKU-OBS-${testId}`,
      category: 'Mounting',
      purchase_price: 50,
      selling_price: 110,
      current_stock: 100,
      minimum_stock: 10
    }, testToken);
    const product4 = p4Res.body.product;
    testProductIds.push(product4.id);
    await supabase.from('products').update({ created_at: sixtyDaysAgo }).eq('id', product4.id);

    const overstockRes = await request('GET', `/api/analytics/demand-insights?businessId=${testBusiness.id}&windowDays=30`, null, testToken);
    const p4Metrics = overstockRes.body?.items?.find(i => i.product_id === product4.id);

    assert(p4Metrics?.velocity_metrics?.velocity_status === 'STAGNANT', 'Product 4 classified as STAGNANT (0 sales in 30 days)');
    assert(p4Metrics?.velocity_metrics?.is_slow_moving === true, 'Product 4 flagged as is_slow_moving: true');
    assert(p4Metrics?.overstock_metrics?.is_overstock === true, 'Product 4 flagged as is_overstock: true');
    assert(p4Metrics?.overstock_metrics?.excess_units === 90, 'Excess units calculated correctly (100 - 10 = 90)');
    assert(p4Metrics?.overstock_metrics?.potential_excess_capital === 4500.00, 'Potential excess capital calculated accurately (90 * 50 = ₹4,500.00)');
    assert(p4Metrics?.overstock_metrics?.evidence?.includes('Zero completed sales observed'), 'Includes transparent factual evidence text');
    assert(p4Metrics?.last_sale_date === null, 'last_sale_date is null when no sales exist in lookback (no fabricated dates)');

    // Verify summary totals
    const summary = overstockRes.body?.summary;
    assert(summary?.overstocked_count >= 1, 'Summary reports at least 1 overstocked product');
    assert(summary?.slow_moving_count >= 1, 'Summary reports at least 1 slow-moving product');
    assert(summary?.total_excess_capital_under_review >= 4500.00, 'Summary reflects total excess capital under review');

    // -------------------------------------------------------------------------
    // 8. ZERO MUTATIONS & TRANSPARENCY DISCLAIMERS
    // -------------------------------------------------------------------------
    console.log('\n[8/8] Testing Zero-Mutation Guarantee & Metadata Disclaimers...');

    const { data: p4DbAfter } = await supabase.from('products').select('current_stock').eq('id', product4.id).single();
    assert(Number(p4DbAfter.current_stock) === 100, 'Product stock balance is completely untouched (remains 100)');

    const metadata = overstockRes.body?.metadata;
    assert(Boolean(metadata?.generated_at), 'Includes generated_at ISO timestamp');
    assert(metadata?.disclaimers?.overstock?.includes('heuristic suggestions for inventory review'), 'Includes clear overstock review disclaimer');
    assert(metadata?.disclaimers?.overstock?.includes('do not constitute financial forecasts'), 'Explicitly disclaims financial forecasting or loss claims');
    assert(metadata?.disclaimers?.overstock?.includes('Recoverable capital depends on market liquidity'), 'Disclaims cash recovery equivalence');

    // Clean up test data
    console.log('\n--- Cleaning up test artifacts ---');
    if (testSaleIds.length > 0) {
      await supabase.from('sale_items').delete().in('sale_id', testSaleIds);
      await supabase.from('sales').delete().in('id', testSaleIds);
    }
    if (testProductIds.length > 0) {
      await supabase.from('products').delete().in('id', testProductIds);
    }
    if (testBusiness) {
      await supabase.from('businesses').delete().eq('id', testBusiness.id);
    }
    if (testUser) {
      await supabase.auth.admin.deleteUser(testUser.id).catch(() => {});
    }
    console.log('  ✓ Cleaned up test business, sales, and products.');

  } catch (err) {
    console.error('Test suite runtime error:', err);
    failures++;
  } finally {
    server.close();
  }

  console.log('======================================================');
  if (failures === 0) {
    console.log('ALL DEMAND INSIGHTS CHECKS PASSED (0 failures)!');
    process.exit(0);
  } else {
    console.error(`FAILED: ${failures} check(s) failed.`);
    process.exit(1);
  }
}

runDemandVerification();
