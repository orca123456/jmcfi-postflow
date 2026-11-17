const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createWebServer } = require('../scripts/serve-web.cjs');
const server = createWebServer();
const artifacts = path.resolve(__dirname, '../.expo/requestor-qa');
fs.mkdirSync(artifacts, { recursive: true });
const user = { id: 41, name: 'Den Mark Orca', first_name: 'Den Mark', last_name: 'Orca', email: 'requestor@example.invalid', role: 'requestor', roles: ['requestor'], department: 'College of Information Technology Education', department_id: 7 };
const entries = [
  [101, 'Enrollment advisory', 'pending_office_head', '2026-11-16', 'Advisory'],
  [102, 'Research forum', 'pending_vice_president', '2026-11-15', 'Event'],
  [103, 'Campus update', 'published', '2026-11-14', 'News & Updates'],
  [104, 'Scholarship announcement', 'approved', '2026-11-13', 'Advisory'],
  [105, 'Program orientation', 'pending_imc_qa', '2026-11-12', 'Event'],
  [106, 'Sports festival', 'scheduled', '2026-11-11', 'Event'],
  [107, 'Library hours', 'pending_office_head', '2026-11-10', 'Advisory'],
  [108, 'Wellness advisory', 'published', '2026-11-09', 'Advisory'],
  [109, 'Community outreach', 'approved', '2026-11-02', 'Event'],
  [110, 'Faculty seminar', 'pending_vice_president', '2026-10-28', 'Event'],
  [111, 'Academic calendar', 'published', '2026-10-18', 'Advisory'],
  [112, 'Admissions notice', 'pending_office_head', '2026-10-17', 'Advisory'],
  [113, 'Student achievements', 'approved', '2026-10-12', 'News & Updates'],
  [114, 'Laboratory maintenance', 'pending_office_head', '2026-09-30', 'Advisory'],
];
const labels = { pending_office_head: 'Pending Department Head', pending_vice_president: 'Pending Vice President', pending_imc_qa: 'Pending IMC QA', approved: 'Approved', scheduled: 'Scheduled', published: 'Published' };
const errors = [], mutations = [];

async function createSession(browser, base, { viewport = { width: 1536, height: 864 }, mode = 'normal', scale = 1, gate = false, dark = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, timezoneId: 'Asia/Manila' });
  await context.addInitScript(({ user, dark }) => {
    sessionStorage.setItem('auth_token', 'requestor-preview');
    sessionStorage.setItem('auth_user', JSON.stringify(user));
    if (dark) localStorage.setItem('dark_mode', 'true');
  }, { user, dark });
  const records = entries.map(([id, title, status, day, category]) => ({ id, title, status, status_label: labels[status], code: `REQ-${id}`, category: { id: 1, name: category }, created_at: `${day}T02:00:00Z`, updated_at: `${day}T02:00:00Z`, routing_type: 'standard', target_platforms: id === 105 ? ['facebook', 'instagram', 'website'] : [id === 102 ? 'instagram' : 'facebook'], caption_narrative: `Publication request for ${title}.`, requestor: { full_name: user.name, department: user.department }, media: id === 101 || id === 102 ? [{ type: 'image', mime_type: 'image/jpeg', url: `${base}/requestor-preview-${id === 101 ? 'cover.jpeg' : 'missing.jpg'}` }] : [], approval_workflows: [] }));
  records.push(...[
    { ...records[0], id: 201, code: 'REQ-201', title: 'Internal draft', status: 'draft', status_label: 'Draft' },
    { ...records[0], id: 202, code: 'REQ-202', title: 'Rejected example', status: 'rejected', status_label: 'Rejected', rejection_reason: 'Please update the department name and attach the approved artwork before creating a revised request.', approval_workflows: [{ stage: 'office_head', action: 'rejected', approver: { full_name: 'Preview Department Head' } }] },
    { ...records[0], id: 203, code: 'REQ-203', title: 'Revision example', status: 'returned_for_revision', status_label: 'Returned for revision', rejection_reason: 'Add the event date, venue, and contact details to the caption.', approval_workflows: [{ stage: 'office_head', action: 'returned_for_revision', approver: { full_name: 'Preview Department Head' } }] },
    { ...records[0], id: 204, title: 'Direct IMC example', routing_type: 'direct_imc' },
  ]);
  const state = { mode, requests: 0 };
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await context.route('**/requestor-preview-cover.jpeg', route => route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(path.resolve(__dirname, '../assets/images/jmcbg2.jpeg')) }));
  await context.route('**/requestor-preview-missing.jpg', route => route.fulfill({ status: 404, body: '' }));
  await context.route('**/api/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    if (!['GET', 'HEAD'].includes(route.request().method())) { mutations.push(endpoint); return route.fulfill({ status: 405, json: { message: 'Read-only browser fixture' } }); }
    let body = { data: [] };
    if (endpoint === '/auth/user') body = { user };
    if (endpoint === '/posts') {
      state.requests++;
      if (gate) await held;
      if (state.mode === 'error') return route.fulfill({ status: 503, json: { message: 'Request list unavailable' } });
      body = { data: state.mode === 'empty' ? [] : records, meta: { current_page: 1, per_page: 50, total: records.length, last_page: 1 } };
    }
    if (endpoint === '/notifications') body = { notifications: [], unread_count: 0 };
    if (endpoint === '/categories') body = { data: [{ id: 1, name: 'Advisory' }, { id: 2, name: 'Event' }] };
    if (endpoint === '/departments') body = { data: [{ id: 7, name: user.department }] };
    await route.fulfill({ json: body });
  });
  const page = await context.newPage();
  page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
  await page.clock.install({ time: new Date('2026-11-16T02:00:00Z') });
  await page.goto(`${base}/dashboard/requestor`, { waitUntil: 'domcontentloaded' });
  return { page, context, state, release };
}

async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  // Native-web Modal uses a JS opacity transition; allow it to settle as well.
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), animations: 'disabled' });
}
async function expandSidebar(page) {
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await page.mouse.move(600, 100);
  await page.waitForFunction(() => {
    const logo = document.querySelector('img[src*="jmc_logo"]');
    return logo && [...document.querySelectorAll('div')].some(el => {
      const b = el.getBoundingClientRect();
      return b.width > 250 && b.width < 280 && b.height > innerHeight / 2 && getComputedStyle(el).backgroundColor === 'rgb(76, 0, 124)';
    });
  });
  assert.equal(await page.getByRole('button', { name: 'Toggle navigation', exact: true }).getAttribute('aria-expanded'), 'true');
}
async function brandIntact(page) {
  assert.ok(await page.locator('img[src*="jmcbg2"]').count(), 'The school photo is preserved');
  assert.ok(await page.locator('img[src*="jmc_logo"]').count(), 'The JMC logo is preserved');
  const namedGold = page.getByRole('button', { name: 'Create New Request', exact: true });
  const gold = await namedGold.count() ? namedGold : page.getByText('Create New Request', { exact: true }).locator('..');
  assert.equal(await gold.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 199, 44)', 'The create action keeps JMC gold');
  assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll('div')).some(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > innerWidth * .8 && rect.height > 40 && rect.height < 100 && getComputedStyle(el).backgroundColor === 'rgb(76, 0, 124)';
  })), true, 'The existing purple shell is unchanged');
}
async function fits(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (!(await page.locator('#requestor-overview').count())) {
    console.log(await page.evaluate(() => ({ url: location.href, ids: [...document.querySelectorAll('[id]')].map(el => el.id).filter(id => id.includes('requestor') || id.includes('overview')), text: document.body.innerText.slice(0, 500) })));
    await capture(page, 'missing-overview');
    throw new Error('The requestor overview root is missing');
  }
  const bounds = await page.locator('#requestor-overview').boundingBox();
  const viewport = page.viewportSize();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1, 'Overview stays inside the available workspace');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'The page has no horizontal overflow');
}

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.POSTFLOW_BROWSER_CHANNEL || 'msedge' });
  try {
    const { page, context } = await createSession(browser, base, { scale: 1.25 });
    await page.getByText('Enrollment advisory', { exact: true }).first().waitFor();
    await brandIntact(page);
    if (process.argv.includes('--before')) {
      await capture(page, 'before-collapsed');
      await expandSidebar(page);
      await page.waitForTimeout(350);
      await capture(page, 'before-expanded');
      await context.close();
      return;
    }
    const overview = page.locator('#requestor-overview');
    const rows = overview.locator('[data-overview-row]');
    await fits(page);
    assert.equal(await rows.count(), 10);
    assert.equal(await overview.getByText(/REQ-\d+|^#\d+$/).count(), 0, 'Request identifiers are not displayed in request rows');
    await page.waitForFunction(() => !document.querySelector('[data-overview-row] img[src*="requestor-preview-missing"]'));
    for (const title of ['Internal draft', 'Rejected example', 'Revision example', 'Direct IMC example']) assert.equal(await overview.getByText(title, { exact: true }).count(), 0, 'Other workspaces remain separate');
    await capture(page, 'after-collapsed');
    await expandSidebar(page);
    await page.waitForTimeout(350);
    await fits(page);
    await capture(page, 'after-expanded');

    const search = page.getByRole('textbox', { name: 'Search requests', exact: true });
    await search.fill('enrollment');
    assert.equal(await search.evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'Search uses only the field border as its focus indicator');
    assert.equal(await page.locator('#requestor-overview-search').evaluate(el => getComputedStyle(el).borderTopColor), 'rgb(76, 0, 124)');
    assert.equal(await rows.count(), 1);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.getByRole('button', { name: /^Filter by status/ }).click();
    assert.equal(await page.getByRole('button', { name: 'All Status', exact: true }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Scheduled', exact: true }).count(), 0, 'Scheduled is not a dropdown option');
    await page.keyboard.press('Escape');
    assert.notEqual(await page.getByRole('button', { name: /^Filter by status/ }).getAttribute('aria-expanded'), 'true', 'Escape closes the filter');
    assert.equal(await page.getByRole('button', { name: 'In review', exact: true }).count(), 0);
    await page.getByRole('button', { name: /^Filter by status/ }).click();
    await page.getByRole('button', { name: /^In review(?:, selected)?$/ }).click();
    assert.equal(await rows.count(), 7, 'In-review filtering uses raw approval status');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByRole('button', { name: /^Filter by status/ }).click();
    await page.getByRole('button', { name: /^Approved(?:, selected)?$/ }).click();
    assert.equal(await rows.count(), 3, 'Approved is distinct from published and scheduled');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByRole('button', { name: /^Filter by date/ }).click();
    await page.getByRole('button', { name: /^Last 7 days(?:, selected)?$/i }).click();
    assert.equal(await rows.count(), 7, 'Last seven days includes today and the preceding six days');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByRole('button', { name: /^Filter by date/ }).click();
    await page.getByRole('button', { name: /^Custom range/i }).click();
    await page.locator('#overview-start-date').fill('2026-11-15');
    await page.locator('#overview-end-date').fill('2026-11-10');
    assert.equal(await page.getByRole('button', { name: 'Apply range', exact: true }).isDisabled(), true);
    await page.locator('#overview-start-date').fill('2026-11-10');
    await page.locator('#overview-end-date').fill('2026-11-15');
    await page.getByRole('button', { name: 'Apply range', exact: true }).click();
    assert.equal(await rows.count(), 6, 'Custom range includes both calendar boundaries');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByRole('button', { name: 'Sort by oldest first', exact: true }).click();
    assert.match(await rows.first().textContent(), /Laboratory maintenance/);
    await page.getByRole('button', { name: 'Sort by newest first', exact: true }).click();
    await search.fill('No matching title');
    assert.equal(await rows.count(), 0);
    await capture(page, 'filtered-empty');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
    const pageSize = overview.locator('select');
    await pageSize.selectOption('5');
    assert.equal(await rows.count(), 5);
    await overview.getByRole('button', { name: 'Go to page 2', exact: true }).click();
    assert.match(await rows.first().textContent(), /Sports festival/);
    await search.fill('Enrollment');
    assert.equal(await rows.count(), 1, 'Changing filters resets a later page');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await pageSize.selectOption('10');
    const first = page.getByRole('button', { name: 'View request: Enrollment advisory', exact: true });
    await first.focus();
    await page.keyboard.press('Enter');
    await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ state: 'detached' });
    await search.fill('Enrollment');
    await page.getByRole('button', { name: 'Create New Request', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('tab') === 'request');
    await page.getByText('Dashboard', { exact: true }).click();
    await search.waitFor();
    assert.equal(await search.inputValue(), 'Enrollment', 'Overview state survives visiting another requestor tab');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await context.close();

    const mobile = await createSession(browser, base, { viewport: { width: 390, height: 844 } });
    await mobile.page.getByRole('button', { name: 'View request: Enrollment advisory', exact: true }).waitFor();
    for (const width of [390, 320]) {
      await mobile.page.setViewportSize({ width, height: 844 });
      await fits(mobile.page);
      await brandIntact(mobile.page);
      await capture(mobile.page, `mobile-${width}`);
    }
    await mobile.context.close();

    const dark = await createSession(browser, base, { dark: true });
    await dark.page.getByRole('button', { name: 'View request: Enrollment advisory', exact: true }).waitFor();
    await fits(dark.page);
    await brandIntact(dark.page);
    assert.equal(await dark.page.getByText('Create New Request', { exact: true }).evaluate(el => getComputedStyle(el).color), 'rgb(26, 26, 46)', 'Gold action keeps its dark readable foreground');
    await capture(dark.page, 'dark');
    await dark.context.close();

    const loading = await createSession(browser, base, { gate: true });
    await loading.page.getByText(/Loading recent requests/i).waitFor();
    await capture(loading.page, 'loading');
    loading.release();
    await loading.page.getByText('Enrollment advisory', { exact: true }).first().waitFor();
    await loading.context.close();
    const empty = await createSession(browser, base, { mode: 'empty' });
    await empty.page.getByText('No recent requests yet', { exact: true }).waitFor();
    await capture(empty.page, 'empty');
    await empty.context.close();
    const failure = await createSession(browser, base, { mode: 'error' });
    await failure.page.getByRole('button', { name: /Try again/i }).waitFor({ timeout: 30000 });
    await capture(failure.page, 'error');
    failure.state.mode = 'normal';
    await failure.page.getByRole('button', { name: /Try again/i }).click();
    await failure.page.getByText('Enrollment advisory', { exact: true }).first().waitFor();
    await failure.context.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(mutations, [], 'The overview and browser QA issue no write requests');
    console.log('PASS: preserved JMC branding/background/template, responsive overview, real filters/date boundaries/sorting, empty/loading/retry states, keyboard details and existing create flow.');
  } finally { await browser.close(); }
}

module.exports = { createSession, capture, expandSidebar, brandIntact, errors, mutations, artifacts, user };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
