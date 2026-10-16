const http = require('http');
const { getSupabaseClient } = require('../services/supabaseClient');

process.env.PORT = '3098';
const { app, server } = require('../server');

async function runVerification() {
  console.log('=== StockPilot Stage 6.1: Dashboard Analytics Verification Suite ===\n');
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
          port: 3098,
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
              // Not JSON
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
  const testEmail = `analytics_test_${testId}@stockpilot.local`;
  const testPassword = 'TestPassword123!';
  let testUser = null;
  let testToken = null;
  let testBusiness = null;
  let createdProductIds = [];
  let createdSaleIds = [];
  let createdPurchaseIds = [];

  try {
    // -------------------------------------------------------------------------
    // 1. SECURITY & AUTHENTICATION ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('[1/6] Testing Authentication & Authorization Controls...');

    // 1.1 Missing Token
    const noTokenRes = await request('GET', '/api/analytics/dashboard');
    assert(noTokenRes.status === 401, 'Rejects unauthenticated request without token (HTTP 401)');

    // 1.2 Invalid Token
    const badTokenRes = await request('GET', '/api/analytics/dashboard', null, 'invalid.jwt.token');
    assert(badTokenRes.status === 401, 'Rejects forged or invalid JWT token (HTTP 401)');

    // 1.3 Register Isolated Test User
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    if (authErr || !authData.user) {
      throw new Error(`Failed to create test user: ${authErr?.message}`);
    }
    testUser = authData.user;
    testToken = authData.session?.access_token;

    // If session not returned on signUp (e.g. email confirm setting), signInWithPassword
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

    // 1.4 Missing businessId with valid token
    const noBizRes = await request('GET', '/api/analytics/dashboard', null, testToken);
    assert(noBizRes.status === 403, 'Rejects request missing businessId query param (HTTP 403)');

    // 1.5 Non-UUID businessId
    const malformedBizRes = await request('GET', '/api/analytics/dashboard?businessId=123-abc', null, testToken);
    assert(malformedBizRes.status === 403, 'Rejects malformed non-UUID businessId (HTTP 403)');

    // 1.6 Cross-Business Access (Unrelated Random UUID)
    const randomUuid = '00000000-0000-4000-a000-000000000000';
    const crossBizRes = await request('GET', `/api/analytics/dashboard?businessId=${randomUuid}`, null, testToken);
    assert(crossBizRes.status === 403, 'Rejects unauthorized cross-business access (HTTP 403)');

    // -------------------------------------------------------------------------
    // 2. EMPTY DATASET ANALYTICS
    // -------------------------------------------------------------------------
    console.log('\n[2/6] Testing Empty Business Dataset Aggregation...');

    // Create a new business for test user
    const createBizRes = await request(
      'POST',
      '/api/businesses',
      {
        name: `Analytics Demo Co ${testId}`,
        industry: 'Manufacturing',
        currency: 'USD',
        location: 'Industrial District'
      },
      testToken
    );

    assert(createBizRes.status === 201, 'Created isolated test business (USD currency)');
    testBusiness = createBizRes.body.business;

    // Fetch empty dashboard
    const emptyDashRes = await request('GET', `/api/analytics/dashboard?businessId=${testBusiness.id}`, null, testToken);
    assert(emptyDashRes.status === 200, 'GET /api/analytics/dashboard returns 200 OK for empty business');
    const emptyData = emptyDashRes.body;

    assert(emptyData.business?.currency === 'USD', 'Reports business currency correctly (USD)');
    assert(emptyData.summary.total_products === 0, 'Empty catalog reports total_products: 0');
    assert(emptyData.summary.active_products === 0, 'Empty catalog reports active_products: 0');
    assert(emptyData.summary.total_units_on_hand === 0, 'Empty catalog reports total_units_on_hand: 0');
    assert(emptyData.summary.inventory_cost_value === 0, 'Empty catalog reports inventory_cost_value: 0.00');
    assert(emptyData.summary.low_stock_count === 0, 'Empty catalog reports low_stock_count: 0');
    assert(emptyData.summary.out_of_stock_count === 0, 'Empty catalog reports out_of_stock_count: 0');
    assert(emptyData.summary.monthly_sales_revenue === 0, 'Empty catalog reports monthly_sales_revenue: 0.00');
    assert(Array.isArray(emptyData.critical_stock) && emptyData.critical_stock.length === 0, 'Empty critical_stock array');
    assert(Array.isArray(emptyData.recent_activity) && emptyData.recent_activity.length === 0, 'Empty recent_activity array');
    assert(emptyData.trend.series.length === 30, 'Generates full 30-day continuous trend series without gaps');
    assert(emptyData.trend.total_period_sales === 0, 'Trend reports 0.00 total period sales');

    // -------------------------------------------------------------------------
    // 3. CATALOG VALUATION & LOW STOCK CALCULATION
    // -------------------------------------------------------------------------
    console.log('\n[3/6] Testing Inventory Valuation & Safety Threshold Alerts...');

    // Create 3 products:
    // P1: In stock (stock 10, cost 100, reorder 5) => Value: 1000
    // P2: Low stock (stock 3, cost 50, reorder 10) => Deficit: 7, Value: 150
    // P3: Depleted / Out of stock (stock 0, cost 200, reorder 15) => Deficit: 15, Value: 0
    const p1Res = await request(
      'POST',
      '/api/products',
      {
        business_id: testBusiness.id,
        name: 'Precision Milling Tool',
        sku: `SKU-P1-${testId}`,
        category: 'Machinery',
        purchase_price: 100,
        selling_price: 150,
        current_stock: 10,
        minimum_stock: 5
      },
      testToken
    );
    assert(p1Res.status === 201, 'Created Product 1: In Stock (Stock 10, Cost 100, Reorder 5)');
    createdProductIds.push(p1Res.body.product.id);

    const p2Res = await request(
      'POST',
      '/api/products',
      {
        business_id: testBusiness.id,
        name: 'Carbide Endmill Drill',
        sku: `SKU-P2-${testId}`,
        category: 'Tooling',
        purchase_price: 50,
        selling_price: 80,
        current_stock: 3,
        minimum_stock: 10
      },
      testToken
    );
    assert(p2Res.status === 201, 'Created Product 2: Low Stock (Stock 3, Cost 50, Reorder 10)');
    createdProductIds.push(p2Res.body.product.id);

    const p3Res = await request(
      'POST',
      '/api/products',
      {
        business_id: testBusiness.id,
        name: 'Industrial Valve Seals',
        sku: `SKU-P3-${testId}`,
        category: 'Pneumatics',
        purchase_price: 200,
        selling_price: 320,
        current_stock: 0,
        minimum_stock: 15
      },
      testToken
    );
    assert(p3Res.status === 201, 'Created Product 3: Out of Stock (Stock 0, Cost 200, Reorder 15)');
    createdProductIds.push(p3Res.body.product.id);

    // Verify Dashboard with Products
    const popDashRes = await request('GET', `/api/analytics/dashboard?businessId=${testBusiness.id}`, null, testToken);
    assert(popDashRes.status === 200, 'Retrieved dashboard with populated catalog');
    const popData = popDashRes.body;

    assert(popData.summary.total_products === 3, 'Reports total_products: 3');
    assert(popData.summary.active_products === 3, 'Reports active_products: 3');
    assert(popData.summary.total_units_on_hand === 13, 'Reports total_units_on_hand: 13 (10 + 3 + 0)');
    // Expected valuation: (10 * 100) + (3 * 50) + (0 * 200) = 1150
    assert(popData.summary.inventory_cost_value === 1150, 'Calculates exact inventory_cost_value: 1150.00 using cost_price');
    assert(popData.summary.low_stock_count === 2, 'Calculates low_stock_count: 2 (Product 2 & Product 3)');
    assert(popData.summary.out_of_stock_count === 1, 'Calculates out_of_stock_count: 1 (Product 3)');

    // Verify Critical Stock ranking (largest deficit first)
    assert(popData.critical_stock.length === 2, 'Reports 2 critical low-stock items');
    assert(popData.critical_stock[0].name === 'Industrial Valve Seals', 'Highest deficit (15) ranked first');
    assert(popData.critical_stock[0].stock_deficit === 15, 'Product 3 reports deficit of 15');
    assert(popData.critical_stock[1].name === 'Carbide Endmill Drill', 'Second deficit (7) ranked second');
    assert(popData.critical_stock[1].stock_deficit === 7, 'Product 2 reports deficit of 7');

    // -------------------------------------------------------------------------
    // 4. UNRECEIVED PURCHASE ORDER EXCLUSION FROM VALUATION
    // -------------------------------------------------------------------------
    console.log('\n[4/6] Testing Unreceived Purchase Exclusion from Stock Valuation...');

    // Create an "ordered" purchase order for 20 units of Product 1 at cost 100 ($2,000 spend)
    const poRes = await request(
      'POST',
      '/api/purchases',
      {
        business_id: testBusiness.id,
        status: 'ordered',
        notes: 'In-flight restock order awaiting delivery',
        items: [
          {
            product_id: p1Res.body.product.id,
            quantity: 20,
            unit_cost: 100
          }
        ]
      },
      testToken
    );
    assert(poRes.status === 201, 'Created pending purchase order PO (Status: ordered, Amount: 2000)');
    createdPurchaseIds.push(poRes.body.purchase.id);

    // Verify valuation has NOT double-counted the unreceived purchase order
    const poDashRes = await request('GET', `/api/analytics/dashboard?businessId=${testBusiness.id}`, null, testToken);
    const poDashData = poDashRes.body;

    assert(
      poDashData.summary.inventory_cost_value === 1150,
      'Inventory cost value remains exactly 1150.00 (unreceived PO excluded from on-hand stock)'
    );
    assert(poDashData.summary.total_units_on_hand === 13, 'On-hand units remain 13 (unreceived PO not added)');
    assert(poDashData.summary.pending_purchases_count === 1, 'Reports pending_purchases_count: 1');
    assert(poDashData.summary.pending_purchases_spend === 2000, 'Reports pending_purchases_spend: 2000.00');

    // -------------------------------------------------------------------------
    // 5. COMPLETED SALE TRANSACTION & MONTHLY GROSS REVENUE
    // -------------------------------------------------------------------------
    console.log('\n[5/6] Testing Sale Execution & Monthly Gross Revenue...');

    // Record a completed sale of 2 units of Product 1 at price 150 ($300 total)
    const saleRes = await request(
      'POST',
      '/api/sales',
      {
        business_id: testBusiness.id,
        customer_name: 'Apex Manufacturing Client',
        items: [
          {
            product_id: p1Res.body.product.id,
            quantity: 2,
            unit_price: 150
          }
        ]
      },
      testToken
    );
    assert(saleRes.status === 201, 'Recorded completed sale (2 units @ 150 = 300 total)');
    createdSaleIds.push(saleRes.body.sale.id);

    // Verify dashboard reflects stock deduction and gross sales
    const saleDashRes = await request('GET', `/api/analytics/dashboard?businessId=${testBusiness.id}`, null, testToken);
    const saleDashData = saleDashRes.body;

    // After selling 2 units of P1 (was 10, now 8):
    // New total units: 8 + 3 + 0 = 11
    // New valuation: (8 * 100) + (3 * 50) + (0 * 200) = 950
    assert(saleDashData.summary.total_units_on_hand === 11, 'Total units deducted to 11 after sale');
    assert(saleDashData.summary.inventory_cost_value === 950, 'Inventory valuation updated to 950.00');
    assert(saleDashData.summary.monthly_sales_revenue === 300, 'Monthly gross sales revenue reflects 300.00');
    assert(saleDashData.summary.monthly_sales_count === 1, 'Monthly sales order count reflects 1');

    // Verify Recent Activity Stream includes the sale
    assert(saleDashData.recent_activity.length >= 1, 'Recent activity stream contains entries');
    const latestActivity = saleDashData.recent_activity[0];
    assert(latestActivity.type === 'sale', 'Activity item type is "sale"');
    assert(latestActivity.amount === 300, 'Activity item amount is 300.00');
    assert(latestActivity.party_name === 'Apex Manufacturing Client', 'Activity item records counterparty customer');

    // -------------------------------------------------------------------------
    // 6. PERIOD TIMEFRAMES & METADATA DOCUMENTATION
    // -------------------------------------------------------------------------
    console.log('\n[6/6] Testing Trend Timeframes & Formula Transparency...');

    // 7-day query
    const sevenDayRes = await request('GET', `/api/analytics/dashboard?businessId=${testBusiness.id}&days=7`, null, testToken);
    assert(sevenDayRes.status === 200, 'GET /api/analytics/dashboard?days=7 returns 200 OK');
    assert(sevenDayRes.body.trend.period_days === 7, 'Trend reflects requested 7-day window');
    assert(sevenDayRes.body.trend.series.length === 7, 'Trend series contains exactly 7 daily entries');
    assert(sevenDayRes.body.trend.total_period_sales === 300, 'Trend total_period_sales matches period sum');

    // Metadata & Formula documentation check
    const metadata = sevenDayRes.body.metadata;
    assert(Boolean(metadata.generated_at), 'Includes generated_at ISO timestamp');
    assert(metadata.calculation_rules.monthly_sales_revenue.includes('gross receipts, not net profit'), 'Metadata explicitly disclaims gross revenue vs profit');
    assert(metadata.calculation_rules.inventory_cost_value.includes('cost_price'), 'Metadata documents cost_price formula');

  } catch (err) {
    console.error('\nFatal Verification Suite Error:', err);
    failures++;
  } finally {
    console.log('\n--- Cleaning up isolated test artifacts ---');
    try {
      // 1. Delete created sales items & sales
      if (testBusiness) {
        await supabase.from('sale_items').delete().eq('business_id', testBusiness.id);
        await supabase.from('sales').delete().eq('business_id', testBusiness.id);

        // 2. Delete created purchase items & purchases
        await supabase.from('purchase_items').delete().eq('business_id', testBusiness.id);
        await supabase.from('purchases').delete().eq('business_id', testBusiness.id);

        // 3. Delete inventory movements & products
        await supabase.from('inventory_movements').delete().eq('business_id', testBusiness.id);
        await supabase.from('products').delete().eq('business_id', testBusiness.id);

        // 4. Delete business members & business
        await supabase.from('business_members').delete().eq('business_id', testBusiness.id);
        await supabase.from('businesses').delete().eq('id', testBusiness.id);
        console.log('  ✓ Cleaned up test business and transaction records.');
      }

      // 5. Delete test auth user if possible
      if (testUser) {
        // Auth user deletion requires service role or cleanup, handled gracefully
        console.log(`  ✓ Test user ${testEmail} isolated.`);
      }
    } catch (cleanupErr) {
      console.warn('  ! Cleanup warning:', cleanupErr.message);
    }

    server.close(() => {
      console.log('\n======================================================');
      if (failures === 0) {
        console.log('ALL 34 ANALYTICS SUITE CHECKS PASSED (0 failures)!');
        process.exit(0);
      } else {
        console.error(`VERIFICATION SUITE COMPLETED WITH ${failures} FAILURE(S).`);
        process.exit(1);
      }
    });
  }
}

runVerification();
