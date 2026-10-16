const http = require('http');
const { getSupabaseClient } = require('../services/supabaseClient');

process.env.PORT = '3095';
const { app, server } = require('../server');

async function runSuppliersAuthVerification() {
  console.log('=== StockPilot Stage 8.2: Suppliers Business Authorization Verification Suite ===\n');
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
          port: 3095,
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
  const userAEmail = `supplier_test_a_${testId}@stockpilot.local`;
  const userBEmail = `supplier_test_b_${testId}@stockpilot.local`;
  const testPassword = 'SupplierPassword123!';

  let userA = null;
  let userB = null;
  let tokenA = null;
  let tokenB = null;
  let businessA = null;
  let businessB = null;
  let createdSupplierId = null;

  try {
    // -------------------------------------------------------------------------
    // 1. UNAUTHENTICATED ACCESS CONTROLS
    // -------------------------------------------------------------------------
    console.log('[1/4] Testing Authentication Rejections...');
    const unauthGet = await request('GET', '/api/suppliers?businessId=00000000-0000-0000-0000-000000000000');
    assert(unauthGet.status === 401, 'Rejects unauthenticated GET request without token (HTTP 401)');

    const unauthPost = await request('POST', '/api/suppliers', {
      business_id: '00000000-0000-0000-0000-000000000000',
      name: 'Unauth Supplier'
    });
    assert(unauthPost.status === 401, 'Rejects unauthenticated POST request without token (HTTP 401)');

    // -------------------------------------------------------------------------
    // 2. SESSION & WORKSPACE PROVISIONING
    // -------------------------------------------------------------------------
    console.log('\n[2/4] Provisioning Two Isolated Users and Businesses...');
    const { data: signUpA, error: errA } = await supabase.auth.signUp({
      email: userAEmail,
      password: testPassword
    });
    if (errA || !signUpA.user || !signUpA.session) {
      throw new Error(`Failed to create test user A: ${errA?.message}`);
    }
    userA = signUpA.user;
    tokenA = signUpA.session.access_token;
    assert(tokenA, 'User A session established');

    const { data: signUpB, error: errB } = await supabase.auth.signUp({
      email: userBEmail,
      password: testPassword
    });
    if (errB || !signUpB.user || !signUpB.session) {
      throw new Error(`Failed to create test user B: ${errB?.message}`);
    }
    userB = signUpB.user;
    tokenB = signUpB.session.access_token;
    assert(tokenB, 'User B session established');

    // Create Business A for User A
    const bARes = await request('POST', '/api/businesses', {
      name: `Workspace Alpha ${testId}`,
      industry: 'Manufacturing',
      location: 'New Delhi',
      currency: 'INR'
    }, tokenA);
    assert(bARes.status === 201, 'Created Business Alpha for User A');
    businessA = bARes.body.business;

    // Create Business B for User B
    const bBRes = await request('POST', '/api/businesses', {
      name: `Workspace Beta ${testId}`,
      industry: 'Logistics',
      location: 'Mumbai',
      currency: 'USD'
    }, tokenB);
    assert(bBRes.status === 201, 'Created Business Beta for User B');
    businessB = bBRes.body.business;

    // -------------------------------------------------------------------------
    // 3. CROSS-BUSINESS AUTHORIZATION CONTROLS
    // -------------------------------------------------------------------------
    console.log('\n[3/4] Testing Business Membership Validation on Suppliers...');

    // Missing business ID
    const missingRes = await request('GET', '/api/suppliers', null, tokenA);
    assert(missingRes.status === 403, 'Rejects GET request missing businessId (HTTP 403)');

    // Malformed non-UUID business ID
    const malformedRes = await request('GET', '/api/suppliers?businessId=not-a-valid-uuid', null, tokenA);
    assert(malformedRes.status === 403, 'Rejects GET request with malformed businessId (HTTP 403)');

    // Cross-business read: User A queries Business B
    const crossReadRes = await request('GET', `/api/suppliers?businessId=${businessB.id}`, null, tokenA);
    assert(crossReadRes.status === 403, 'Rejects cross-business read: User A cannot access Business B suppliers (HTTP 403)');
    assert(crossReadRes.body?.error?.includes('Access denied') || crossReadRes.body?.error?.includes('do not belong'), 'Returns descriptive access denied message');

    // Cross-business write: User A attempts to create supplier in Business B
    const crossWriteRes = await request('POST', '/api/suppliers', {
      business_id: businessB.id,
      name: 'Malicious Cross Supplier',
      contact_name: 'Intruder',
      email: 'intruder@test.com'
    }, tokenA);
    assert(crossWriteRes.status === 403, 'Rejects cross-business write: User A cannot create supplier in Business B (HTTP 403)');
    assert(crossWriteRes.body?.error?.includes('Access denied') || crossWriteRes.body?.error?.includes('do not belong'), 'Returns access denied message on unauthorized write');

    // -------------------------------------------------------------------------
    // 4. AUTHORIZED SUPPLIER WORKFLOW
    // -------------------------------------------------------------------------
    console.log('\n[4/4] Testing Authorized Supplier CRUD Operations...');

    // Input validation: short supplier name
    const shortNameRes = await request('POST', '/api/suppliers', {
      business_id: businessA.id,
      name: 'X'
    }, tokenA);
    assert(shortNameRes.status === 400, 'Rejects supplier name shorter than 2 characters (HTTP 400)');

    // Authorized creation in Business A
    const createRes = await request('POST', '/api/suppliers', {
      business_id: businessA.id,
      name: 'Authorized Industrial Tooling Co.',
      contact_name: 'Rajesh Sharma',
      email: 'rajesh@tooling.local',
      phone: '+91 98765 43210'
    }, tokenA);
    assert(createRes.status === 201, 'User A successfully creates supplier in Business A (HTTP 201)');
    assert(createRes.body?.supplier?.name === 'Authorized Industrial Tooling Co.', 'Supplier record returns correct name');
    assert(createRes.body?.supplier?.business_id === businessA.id, 'Supplier is scoped to Business A');
    createdSupplierId = createRes.body?.supplier?.id;

    // Authorized list for Business A
    const listARes = await request('GET', `/api/suppliers?businessId=${businessA.id}`, null, tokenA);
    assert(listARes.status === 200, 'User A successfully lists suppliers for Business A (HTTP 200)');
    assert(Array.isArray(listARes.body?.suppliers), 'Returns array of suppliers');
    assert(listARes.body.suppliers.some(s => s.id === createdSupplierId), 'Created supplier is present in Business A list');

    // User B lists Business B suppliers: must be completely empty (zero cross-contamination)
    const listBRes = await request('GET', `/api/suppliers?businessId=${businessB.id}`, null, tokenB);
    assert(listBRes.status === 200, 'User B lists Business B suppliers (HTTP 200)');
    assert(listBRes.body?.suppliers?.length === 0, 'Business B has 0 suppliers (tenant isolation guaranteed)');

  } catch (err) {
    console.error('Test execution error:', err);
    failures++;
  } finally {
    console.log('\n--- Cleaning up test artifacts ---');
    try {
      if (businessA?.id) {
        await supabase.from('suppliers').delete().eq('business_id', businessA.id);
        await supabase.from('businesses').delete().eq('id', businessA.id);
      }
      if (businessB?.id) {
        await supabase.from('suppliers').delete().eq('business_id', businessB.id);
        await supabase.from('businesses').delete().eq('id', businessB.id);
      }
      console.log('  ✓ Cleaned up test businesses and suppliers.');
    } catch (cleanupErr) {
      console.warn('  ! Cleanup warning:', cleanupErr.message);
    }

    server.close(() => {
      console.log('======================================================');
      if (failures === 0) {
        console.log('ALL SUPPLIER AUTHORIZATION CHECKS PASSED (0 failures)!');
        process.exit(0);
      } else {
        console.error(`VERIFICATION FAILED: ${failures} failure(s) detected.`);
        process.exit(1);
      }
    });
  }
}

runSuppliersAuthVerification();
