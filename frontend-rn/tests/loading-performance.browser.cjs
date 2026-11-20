const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createWebServer } = require('../scripts/serve-web.cjs');

// Exercise the production export without changing the database or real accounts.
const server = createWebServer();

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.POSTFLOW_BROWSER_CHANNEL || 'msedge' });
  try {
    // No request routing in this context: browser routing disables the HTTP cache.
    const cachedBrowser = await browser.newContext();
    const cachedPage = await cachedBrowser.newPage();
    await cachedPage.goto(base, { waitUntil: 'networkidle' });
    const refreshStart = Date.now();
    await cachedPage.reload({ waitUntil: 'domcontentloaded' });
    await cachedPage.locator('input[type="password"]').waitFor();
    const scripts = await cachedPage.evaluate(() => performance.getEntriesByType('resource')
      .filter(r => /\/entry-[a-f0-9]+\.js/.test(r.name))
      .map(r => ({ bytes: r.transferSize, size: r.decodedBodySize })));
    assert.ok(scripts.length > 0);
    assert.ok(scripts.every(r => r.bytes === 0 && r.size > 0), 'Refresh must reuse the cached application bundle');
    console.log(`Cached refresh to login UI: ${Date.now() - refreshStart} ms; bundle transfer: 0 bytes`);
    await cachedBrowser.close();
    // A delayed font download must not hold the login form behind a blank page.
    const login = await browser.newContext();
    let releaseFonts;
    const fontGate = new Promise(resolve => { releaseFonts = resolve; });
    await login.route('**/*.ttf', async route => {
      await fontGate;
      await route.continue().catch(() => {});
    });
    const loginPage = await login.newPage();
    try {
      const start = Date.now();
      await loginPage.goto(base, { waitUntil: 'domcontentloaded' });
      await loginPage.locator('input[type="password"]').waitFor({ timeout: 15000 });
      console.log(`Login visible with fonts pending: ${Date.now() - start} ms`);
    } finally {
      releaseFonts();
      await login.close();
    }

    const context = await browser.newContext();
    const user = { id: 1, name: 'Performance Test', email: 'test@example.invalid', role: 'admin', roles: ['it_admin'], department: 'IT' };
    await context.addInitScript(user => {
      sessionStorage.setItem('auth_token', 'performance-test');
      sessionStorage.setItem('auth_user', JSON.stringify(user));
    }, user);
    const requests = [];
    let holdDashboard = false;
    let releaseDashboard;
    const dashboardGate = new Promise(resolve => { releaseDashboard = resolve; });
    await context.route('**/api/**', async route => {
      const endpoint = new URL(route.request().url()).pathname.replace(/^\/api/, '');
      requests.push(endpoint);
      let body = { data: [] };
      if (endpoint === '/dashboard/init') {
        if (holdDashboard) await dashboardGate;
        body = { stats: {}, posts: { data: [{ id: 7, title: 'Cached refresh post', status: 'approved', created_at: '2026-11-14T00:00:00Z', media: [], requestor: { full_name: 'Test User' } }] }, activities: [] };
      }
      if (endpoint === '/auth/user') body = { user };
      if (endpoint === '/notifications') body = { notifications: [], unread_count: 0 };
      if (endpoint === '/email-settings') body = { settings: {} };
      await route.fulfill({ json: body });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/dashboard/it-admin`, { waitUntil: 'networkidle' });
    assert.equal(requests.filter(p => p === '/dashboard/init').length, 1);
    for (const endpoint of ['/users', '/audit-logs', '/dashboard/analytics', '/token-settings', '/ai-settings', '/email-settings', '/api-tokens', '/posts']) {
      assert.equal(requests.includes(endpoint), false, `${endpoint} must wait until its tab opens`);
    }
    const deferredBundles = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /\/(xlsx|excelTemplateBase64)-/.test(r.name)).map(r => r.name));
    assert.deepEqual(deferredBundles, [], 'Spreadsheet assets must stay out of startup downloads');
    await page.getByText('Cached refresh post', { exact: true }).first().waitFor();
    const snapshot = await page.evaluate(() => sessionStorage.getItem('postflow_query_v2_1'));
    assert.ok(snapshot, 'Dashboard data must survive refresh');
    assert.ok(!snapshot.includes('performance-test'), 'Persisted responses must exclude authorization credentials');
    holdDashboard = true;
    try {
      const start = Date.now();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText('Cached refresh post', { exact: true }).first().waitFor({ timeout: 5000 });
      console.log(`Dashboard restored before API response: ${Date.now() - start} ms`);
    } finally {
      holdDashboard = false;
      releaseDashboard();
    }
    for (const [tab, endpoint] of [['user-management', '/users'], ['audit-logs', '/audit-logs'], ['analytics', '/dashboard/analytics'], ['email-settings', '/email-settings'], ['developer-api', '/api-tokens']]) {
      await page.goto(`${base}/dashboard/it-admin?tab=${tab}`, { waitUntil: 'networkidle' });
      assert.ok(requests.includes(endpoint), `${tab} must still load its data`);
    }
    assert.deepEqual(errors, []);
    // A different account must not restore the previous account's dashboard.
    await context.addInitScript(() => {
      sessionStorage.setItem('auth_user', JSON.stringify({ id: 2, name: 'Other User', role: 'admin', roles: ['it_admin'] }));
      sessionStorage.setItem('auth_token', 'different-session');
    });
    await context.route('**/api/dashboard/init', route => route.fulfill({ json: { stats: {}, posts: { data: [] }, activities: [] } }));
    await page.goto(`${base}/dashboard/it-admin`, { waitUntil: 'networkidle' });
    assert.equal(await page.getByText('Cached refresh post', { exact: true }).count(), 0);
    console.log('PASS: No unused tab requests or spreadsheet downloads at startup; tabs load on demand.');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => server.close());
