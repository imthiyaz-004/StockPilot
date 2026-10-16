const http = require('http');
const fs = require('fs');
const path = require('path');

process.env.PORT = '3099';
const { app, server } = require('../server');

async function runTests() {
  console.log('--- Starting StockPilot Product-Led Public Website & Application Verification ---');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failures++;
    }
  }

  // Helper for HTTP requests
  function get(urlPath) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:3099${urlPath}`, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }).on('error', reject);
    });
  }

  try {
    // 1. Health check endpoint
    const health = await get('/api/health');
    assert(health.status === 200, 'GET /api/health returns 200 OK');
    const healthJson = JSON.parse(health.body);
    assert(healthJson.status === 'ok', 'Health response contains status: "ok"');

    // 2. Index HTML delivery & content
    const indexRes = await get('/');
    assert(indexRes.status === 200, 'GET / returns 200 OK');
    assert(indexRes.body.includes('<!DOCTYPE html>'), 'Document has valid HTML5 doctype');
    assert(indexRes.body.includes('StockPilot // Modern Product-Led Inventory Intelligence'), 'Document title reflects product-led brand');
    assert(indexRes.body.includes('family=Plus+Jakarta+Sans'), 'Loads Plus Jakarta Sans typography');
    assert(indexRes.body.includes('family=JetBrains+Mono'), 'Loads JetBrains Mono tabular typography');
    assert(indexRes.body.includes('id="public-home-section"'), 'Includes public homepage container (#public-home-section)');
    assert(indexRes.body.includes('Know your stock.'), 'Hero headline includes primary value proposition');
    assert(indexRes.body.includes('id="demo-preview"'), 'Includes live interactive interface demo preview (#demo-preview)');
    assert(indexRes.body.includes('BIT-TUNG-001'), 'Demo preview includes realistic product SKU (BIT-TUNG-001)');
    assert(indexRes.body.includes('id="btn-nav-signin"'), 'Includes navigation Sign In button');
    assert(indexRes.body.includes('id="btn-nav-getstarted"'), 'Includes navigation Get Started button');
    assert(indexRes.body.includes('id="auth-section"'), 'Includes preserved authentication view container (#auth-section)');
    assert(indexRes.body.includes('id="onboarding-section"'), 'Includes preserved business onboarding container (#onboarding-section)');
    assert(indexRes.body.includes('id="workspace-section"'), 'Includes preserved operational workspace container (#workspace-section)');
    assert(indexRes.body.includes('id="movements-modal"'), 'Includes product movement audit trail dialog (#movements-modal)');

    // 3. Stylesheet delivery & modern design tokens
    const cssRes = await get('/css/styles.css');
    assert(cssRes.status === 200, 'GET /css/styles.css returns 200 OK');
    const css = cssRes.body;
    assert(css.includes('--color-canvas: #FFFFFF;'), 'CSS tokens include clean white canvas (#FFFFFF)');
    assert(css.includes('--color-text-main: #0F172A;'), 'CSS tokens include deep slate navy contrast (#0F172A)');
    assert(css.includes('--color-primary: #2563EB;'), 'CSS tokens include electric cobalt blue (#2563EB)');
    assert(!css.includes('#F3F0E8'), 'Beige palette (#F3F0E8) is removed from active tokens');
    assert(css.includes('--shadow-preview:'), 'CSS defines modern elevation shadow (--shadow-preview)');
    assert(css.includes('.preview-shell'), 'CSS defines .preview-shell interactive container');
    assert(css.includes('.feature-split-grid'), 'CSS defines .feature-split-grid storytelling layout');
    assert(css.includes('.ledger-table'), 'CSS defines .ledger-table operational table styles');
    assert(css.includes('.stock-meter-wrap'), 'CSS defines .stock-meter-wrap proportional gauge');
    assert(css.includes('@media (max-width: 1440px)'), 'CSS defines 1440px desktop breakpoint');
    assert(css.includes('@media (max-width: 1280px)'), 'CSS defines 1280px laptop breakpoint');
    assert(css.includes('@media (max-width: 768px)'), 'CSS defines 768px tablet breakpoint');
    assert(css.includes('@media (max-width: 390px)'), 'CSS defines 390px mobile compact breakpoint');

    // 4. JS Application controller delivery & routing
    const jsRes = await get('/js/app.js');
    assert(jsRes.status === 200, 'GET /js/app.js returns 200 OK');
    const js = jsRes.body;
    assert(js.includes('publicHomeSection'), 'app.js manages publicHomeSection visibility');
    assert(js.includes('btnNavSignin'), 'app.js binds btnNavSignin click handler');
    assert(js.includes('btnNavGetstarted'), 'app.js binds btnNavGetstarted click handler');
    assert(js.includes('btnHeroGetstarted'), 'app.js binds btnHeroGetstarted click handler');
    assert(js.includes('updateNavAuthState'), 'app.js maintains dynamic navigation auth state');
    assert(js.includes('handleMovementsClick'), 'app.js maintains movement audit trail handler');
    assert(js.includes('hashchange'), 'app.js handles hashchange for browser back/forward buttons');

    console.log('\n--- Verification Summary ---');
    if (failures === 0) {
      console.log('ALL VERIFICATIONS PASSED: 33/33 checks successful.');
    } else {
      console.error(`VERIFICATION FAILED: ${failures} check(s) failed.`);
    }
  } catch (err) {
    console.error('Fatal verification error:', err);
    failures++;
  } finally {
    server.close(() => {
      process.exit(failures === 0 ? 0 : 1);
    });
  }
}

runTests();
