const http = require('http');
const { getSupabaseClient } = require('../services/supabaseClient');

process.env.PORT = '3097';
const { app, server } = require('../server');

async function runVerification() {
  console.log('=== StockPilot Stage 6.2.2: Inventory Intelligence Verification Suite ===\n');
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
          port: 3097,
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
              // Non-JSON response
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
  const testEmail = `intel_test_${testId}@stockpilot.local`;
  const testPassword = 'IntelPassword123!';
  let testUser = null;
  let testToken = null;
  let testBusiness = null;

  try {
    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & PARAMETER VALIDATION
    // -------------------------------------------------------------------------
    console.log('[1/7] Testing Authentication & Parameter Validation...');

    // 1.1 Unauthenticated Request
    const noAuth = await request('GET', '/api/analytics/intelligence');
    assert(noAuth.status === 401, 'Rejects unauthenticated request without token (HTTP 401)');

    // 1.2 Invalid Token
    const badAuth = await request('GET', '/api/analytics/intelligence', null, 'invalid.token');
    assert(badAuth.status === 401, 'Rejects invalid bearer token (HTTP 401)');

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
    assert(Boolean(testToken), 'Successfully established isolated user session');

    // 1.4 Missing businessId
    const missingBiz = await request('GET', '/api/analytics/intelligence', null, testToken);
    assert(missingBiz.status === 403, 'Rejects request missing businessId (HTTP 403)');

    // 1.5 Malformed businessId
    const malformedBiz = await request('GET', '/api/analytics/intelligence?businessId=not-a-uuid', null, testToken);
    assert(malformedBiz.status === 403, 'Rejects malformed non-UUID businessId (HTTP 403)');

    // 1.6 Cross-Business Access (Unowned UUID)
    const crossBiz = await request('GET', '/api/analytics/intelligence?businessId=00000000-0000-4000-a000-000000000000', null, testToken);
    assert(crossBiz.status === 403, 'Rejects cross-business access to foreign UUID (HTTP 403)');

    // Create Isolated Test Business
    const bizRes = await request(
      'POST',
      '/api/businesses',
      {
        name: `Intelligence Test Hub ${testId}`,
        industry: 'Wholesale',
        currency: 'USD',
        location: 'Bay 4'
      },
      testToken
    );
    assert(bizRes.status === 201, 'Provisioned isolated test business workspace (USD)');
    testBusiness = bizRes.body.business;

    // 1.7 Invalid windowDays parameter (must be 14 or 30)
    const invalidWindow = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}&windowDays=45`, null, testToken);
    assert(invalidWindow.status === 400, 'Rejects windowDays not in [14, 30] (HTTP 400)');

    // 1.8 Invalid targetDays parameter (must be between 7 and 90)
    const invalidTargetLow = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}&targetDays=5`, null, testToken);
    assert(invalidTargetLow.status === 400, 'Rejects targetDays < 7 (HTTP 400)');

    const invalidTargetHigh = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}&targetDays=100`, null, testToken);
    assert(invalidTargetHigh.status === 400, 'Rejects targetDays > 90 (HTTP 400)');

    // -------------------------------------------------------------------------
    // 2. EMPTY BUSINESS INTELLIGENCE
    // -------------------------------------------------------------------------
    console.log('\n[2/7] Testing Empty Business Dataset...');

    const emptyRes = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}`, null, testToken);
    assert(emptyRes.status === 200, 'GET /api/analytics/intelligence returns 200 OK for empty business');
    const emptyBody = emptyRes.body;

    assert(emptyBody.business?.currency === 'USD', 'Reports business currency correctly');
    assert(emptyBody.parameters?.window_days === 30, 'Applies default window_days: 30');
    assert(emptyBody.parameters?.target_days === 30, 'Applies default target_days: 30');
    assert(emptyBody.summary.total_evaluated_products === 0, 'Total evaluated products is 0');
    assert(emptyBody.summary.total_estimated_reorder_cost === 0, 'Total estimated reorder cost is 0.00');
    assert(Array.isArray(emptyBody.recommendations) && emptyBody.recommendations.length === 0, 'Empty recommendations array returned');

    // -------------------------------------------------------------------------
    // 3. DEPLETED STOCK PRECEDENCE & INSUFFICIENT HISTORY
    // -------------------------------------------------------------------------
    console.log('\n[3/7] Testing Depleted Stock Precedence & Insufficient History...');

    // Product 1: Created today (age < 14d, 0 orders), but current_stock = 0, reorder_level = 10, cost = 50
    const p1Res = await request('POST', '/api/products', {
      business_id: testBusiness.id,
      name: 'Zero Stock New Item',
      sku: `SKU-DEP-${testId}`,
      category: 'Hardware',
      purchase_price: 50,
      selling_price: 90,
      current_stock: 0,
      minimum_stock: 10
    }, testToken);
    assert(p1Res.status === 201, 'Created Product 1: Stock 0, Minimum 10, Cost 50 (Created today)');
    const p1 = p1Res.body.product;

    // Product 2: Created today (age < 14d, 0 orders), current_stock = 15, reorder_level = 10, cost = 25
    const p2Res = await request('POST', '/api/products', {
      business_id: testBusiness.id,
      name: 'In-Stock New Item',
      sku: `SKU-NEW-${testId}`,
      category: 'Hardware',
      purchase_price: 25,
      selling_price: 45,
      current_stock: 15,
      minimum_stock: 10
    }, testToken);
    assert(p2Res.status === 201, 'Created Product 2: Stock 15, Minimum 10, Cost 25 (Created today)');
    const p2 = p2Res.body.product;

    const intelRes1 = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}`, null, testToken);
    const recs1 = intelRes1.body.recommendations;

    const r1 = recs1.find(r => r.product_id === p1.id);
    const r2 = recs1.find(r => r.product_id === p2.id);

    // Verify Depleted takes precedence over Insufficient History for Product 1
    assert(r1.intelligence.risk_category === 'CRITICAL_DEPLETED', 'Product 1 (Stock 0) receives CRITICAL_DEPLETED precedence over insufficient history');
    assert(r1.metrics.days_of_stock_remaining === 0, 'Depleted product reports days_of_stock_remaining: 0');
    assert(r1.intelligence.suggested_reorder_qty === 10, 'Product 1 suggests 10 units to restore minimum threshold');
    assert(r1.intelligence.estimated_reorder_cost === 500, 'Product 1 estimated reorder cost is 500.00 (10 * 50)');

    // Verify Product 2 with positive stock receives INSUFFICIENT_DATA
    assert(r2.intelligence.risk_category === 'INSUFFICIENT_DATA', 'Product 2 (<14d, 0 orders) receives INSUFFICIENT_DATA classification');
    assert(r2.metrics.has_sufficient_history === false, 'Product 2 reports has_sufficient_history: false');
    assert(r2.metrics.days_of_stock_remaining === null, 'Runway is null when daily sales velocity is zero');
    assert(r2.intelligence.suggested_reorder_qty === 0, 'No reorder needed when stock 15 >= threshold 10');
    assert(r2.intelligence.recommendation_basis === 'threshold_only', 'Marked as threshold_only recommendation basis');

    // -------------------------------------------------------------------------
    // 4. VELOCITY, RUNWAY & TARGET DAYS REORDER
    // -------------------------------------------------------------------------
    console.log('\n[4/7] Testing Velocity, Runway & Reorder Planning...');

    // Product 3: Backdated catalog item with active sales history
    const p3Res = await request('POST', '/api/products', {
      business_id: testBusiness.id,
      name: 'Velocity Calibrated Item',
      sku: `SKU-VEL-${testId}`,
      category: 'Electronics',
      purchase_price: 100,
      selling_price: 180,
      current_stock: 50,
      minimum_stock: 10
    }, testToken);
    const p3 = p3Res.body.product;

    // Backdate Product 3 created_at to 35 days ago in the database
    const backdate35d = new Date(Date.now() - 35 * 86400000).toISOString();
    await supabase.from('products').update({ created_at: backdate35d }).eq('id', p3.id);

    // Record 2 distinct sales for Product 3:
    // Sale A: 10 units
    const saleA = await request('POST', '/api/sales', {
      business_id: testBusiness.id,
      customer_name: 'Industrial Client A',
      items: [{ product_id: p3.id, quantity: 10, unit_price: 180 }]
    }, testToken);
    assert(saleA.status === 201, 'Recorded Sale A: 10 units of Product 3');

    // Sale B: 20 units
    const saleB = await request('POST', '/api/sales', {
      business_id: testBusiness.id,
      customer_name: 'Industrial Client B',
      items: [{ product_id: p3.id, quantity: 20, unit_price: 180 }]
    }, testToken);
    assert(saleB.status === 201, 'Recorded Sale B: 20 units of Product 3');

    // After selling 30 units total from Product 3 (was 20 on hand):
    // Wait, create_sale_transaction deducted stock! Let's check or update stock back to 15 to test runway
    await supabase.from('products').update({ current_stock: 15 }).eq('id', p3.id);

    // Now Product 3 has:
    // - catalog_age >= 35 days
    // - 2 distinct completed orders
    // - 30 units sold in 30-day window
    // - average_daily_sales = 30 / 30 = 1.0 units/day
    // - current_stock = 15
    // - days_of_stock_remaining = 15 / 1.0 = 15.0 days
    const intelRes2 = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}`, null, testToken);
    const r3 = intelRes2.body.recommendations.find(r => r.product_id === p3.id);

    assert(r3.metrics.has_sufficient_history === true, 'Product 3 recognized as having sufficient history');
    assert(r3.metrics.units_sold_window === 30, 'Calculates exact units_sold_window: 30 units');
    assert(r3.metrics.orders_count_window === 2, 'Counts exact distinct completed orders: 2');
    assert(r3.metrics.average_daily_sales === 1.0, 'Calculates average_daily_sales: 1.0 units/day');
    assert(r3.metrics.days_of_stock_remaining === 15.0, 'Calculates days_of_stock_remaining: 15.0 days');
    assert(r3.intelligence.risk_category === 'HEALTHY', 'Product 3 classified as HEALTHY (runway 15.0 > 14 days and stock 15 > threshold 10)');
    // Target coverage: max(10, ceil(1.0 * 30)) = 30 units.
    // Suggested reorder: max(0, 30 - 15) = 15 units.
    assert(r3.intelligence.target_units === 30, 'Calculates target_units: 30 (1.0 ADS * 30 days)');
    assert(r3.intelligence.suggested_reorder_qty === 15, 'Calculates suggested_reorder_qty: 15 units');
    assert(r3.intelligence.estimated_reorder_cost === 1500, 'Calculates estimated_reorder_cost: 1500.00 (15 * 100)');

    // -------------------------------------------------------------------------
    // 5. INCOMING PURCHASE ORDER ACCOUNTING & OFFSET
    // -------------------------------------------------------------------------
    console.log('\n[5/7] Testing Incoming Purchase Accounting & Reorder Offset...');

    // Create an "ordered" PO for 10 units of Product 3
    const po1 = await request('POST', '/api/purchases', {
      business_id: testBusiness.id,
      status: 'ordered',
      notes: 'In-flight order 10 units',
      items: [{ product_id: p3.id, quantity: 10, unit_cost: 100 }]
    }, testToken);
    assert(po1.status === 201, 'Created in-flight PO with status "ordered" for 10 units');

    // Create a "cancelled" PO for 50 units of Product 3 (must be excluded!)
    const poCancelled = await request('POST', '/api/purchases', {
      business_id: testBusiness.id,
      status: 'ordered',
      notes: 'Cancelled test order',
      items: [{ product_id: p3.id, quantity: 50, unit_cost: 100 }]
    }, testToken);
    // Mark it cancelled directly in DB
    await supabase.from('purchases').update({ status: 'cancelled' }).eq('id', poCancelled.body.purchase.id);

    const intelRes3 = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}`, null, testToken);
    const r3AfterPo = intelRes3.body.recommendations.find(r => r.product_id === p3.id);

    assert(r3AfterPo.incoming_stock === 10, 'Incoming stock reflects 10 units from ordered PO (cancelled 50 units excluded)');
    assert(r3AfterPo.effective_available_stock === 25, 'Effective available stock is 25 (15 on-hand + 10 incoming)');
    // Suggested reorder was 15; with 10 incoming, suggested reorder drops to 30 - (15 + 10) = 5 units!
    assert(r3AfterPo.intelligence.suggested_reorder_qty === 5, 'Suggested reorder quantity correctly offsets incoming stock (30 - 25 = 5)');
    assert(r3AfterPo.intelligence.estimated_reorder_cost === 500, 'Estimated reorder cost correctly updates to 500.00');

    // -------------------------------------------------------------------------
    // 6. EXCLUSION OF NON-COMPLETED SALES & STATUS INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n[6/7] Testing Non-Completed Sale Exclusions & Window Boundaries...');

    // Insert a cancelled sale with 500 units for Product 3
    const { data: cancelledSale } = await supabase.from('sales').insert({
      business_id: testBusiness.id,
      sale_number: `SO-CANC-${testId}`,
      customer_name: 'Cancelled Customer',
      status: 'cancelled',
      total_amount: 90000
    }).select().single();

    await supabase.from('sale_items').insert({
      business_id: testBusiness.id,
      sale_id: cancelledSale.id,
      product_id: p3.id,
      quantity: 500,
      unit_price: 180,
      line_total: 90000
    });

    const intelRes4 = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}`, null, testToken);
    const r3AfterCancel = intelRes4.body.recommendations.find(r => r.product_id === p3.id);

    assert(r3AfterCancel.metrics.units_sold_window === 30, 'Cancelled sale of 500 units strictly excluded from units_sold_window');
    assert(r3AfterCancel.metrics.average_daily_sales === 1.0, 'Average daily sales remains 1.0 (unaffected by cancelled sale)');

    // -------------------------------------------------------------------------
    // 7. HIGH RISK & DEMAND TREND CLASSIFICATION
    // -------------------------------------------------------------------------
    console.log('\n[7/7] Testing High Risk Threshold & Demand Velocity Trends...');

    // Product 4: Runway <= 7 days (e.g. stock = 5, ADS = 1.0 => runway = 5 days)
    await supabase.from('products').update({ current_stock: 5 }).eq('id', p3.id);

    const intelRes5 = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}`, null, testToken);
    const r3HighRisk = intelRes5.body.recommendations.find(r => r.product_id === p3.id);

    assert(r3HighRisk.metrics.days_of_stock_remaining === 5.0, 'Calculates 5.0 days runway');
    assert(r3HighRisk.intelligence.risk_category === 'HIGH_RISK', 'Classifies product as HIGH_RISK when runway <= 7 days');

    // Test Target Coverage Days parameterization: targetDays=60
    const intelTarget60 = await request('GET', `/api/analytics/intelligence?businessId=${testBusiness.id}&targetDays=60`, null, testToken);
    const r3Target60 = intelTarget60.body.recommendations.find(r => r.product_id === p3.id);

    // Target units: max(10, ceil(1.0 * 60)) = 60 units.
    // Effective available: stock (5) + incoming (10) = 15.
    // Suggested: 60 - 15 = 45 units!
    assert(r3Target60.intelligence.target_units === 60, 'targetDays=60 scales target_units to 60');
    assert(r3Target60.intelligence.suggested_reorder_qty === 45, 'Suggested reorder adjusts to 45 units for 60-day target');

    // Summary counts check
    const summary = intelRes5.body.summary;
    assert(summary.total_evaluated_products === 3, 'Evaluates all 3 active products in summary');
    assert(summary.critical_depleted_count === 1, 'Summary reports 1 depleted product');
    assert(summary.high_risk_count === 1, 'Summary reports 1 high-risk product');
    assert(summary.insufficient_data_count === 1, 'Summary reports 1 insufficient-data product');

    // Sorting order check: CRITICAL_DEPLETED first, then HIGH_RISK, then INSUFFICIENT_DATA
    const sorted = intelRes5.body.recommendations;
    assert(sorted[0].intelligence.risk_category === 'CRITICAL_DEPLETED', 'Prioritizes CRITICAL_DEPLETED at rank 1');
    assert(sorted[1].intelligence.risk_category === 'HIGH_RISK', 'Prioritizes HIGH_RISK at rank 2');
    assert(sorted[2].intelligence.risk_category === 'INSUFFICIENT_DATA', 'Places INSUFFICIENT_DATA at rank 3');

  } catch (err) {
    console.error('\nFatal Verification Suite Error:', err);
    failures++;
  } finally {
    console.log('\n--- Cleaning up isolated test artifacts ---');
    try {
      if (testBusiness) {
        await supabase.from('sale_items').delete().eq('business_id', testBusiness.id);
        await supabase.from('sales').delete().eq('business_id', testBusiness.id);
        await supabase.from('purchase_items').delete().eq('business_id', testBusiness.id);
        await supabase.from('purchases').delete().eq('business_id', testBusiness.id);
        await supabase.from('inventory_movements').delete().eq('business_id', testBusiness.id);
        await supabase.from('products').delete().eq('business_id', testBusiness.id);
        await supabase.from('business_members').delete().eq('business_id', testBusiness.id);
        await supabase.from('businesses').delete().eq('id', testBusiness.id);
        console.log('  ✓ Cleaned up test business and all test transactions.');
      }
    } catch (cleanupErr) {
      console.warn('  ! Cleanup warning:', cleanupErr.message);
    }

    server.close(() => {
      console.log('======================================================');
      if (failures === 0) {
        console.log('ALL 31 INVENTORY INTELLIGENCE CHECKS PASSED (0 failures)!');
        process.exit(0);
      } else {
        console.error(`VERIFICATION SUITE COMPLETED WITH ${failures} FAILURE(S).`);
        process.exit(1);
      }
    });
  }
}

runVerification();
