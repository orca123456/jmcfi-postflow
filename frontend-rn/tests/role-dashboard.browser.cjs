const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createWebServer } = require('../scripts/serve-web.cjs');

const artifacts = path.resolve(__dirname, '../.expo/role-dashboard-qa');
fs.mkdirSync(artifacts, { recursive: true });
const roles = [
  { route: 'office-head', root: 'office-head-workspace', role: 'office_head', department: 'College of Information Technology Education', pending: 401, tab: 'dashboard', reviewTitle: 'Departmental Content Request Review' },
  { route: 'vp', root: 'vp-workspace', role: 'vice_president', department: 'Vice President for Academic Affairs', pending: 402, tab: 'dashboard', reviewTitle: 'Content Request Preview' },
  { route: 'imc-qa', root: 'imc-workspace', role: 'imc_qa_checker', department: 'Integrated Marketing Communications', pending: 403, tab: 'dashboard', reviewTitle: 'Content Request Quality Review' },
  { route: 'it-admin', root: 'admin-workspace', role: 'it_admin', department: 'Information Technology Office', pending: 401, tab: 'overview' },
];
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const errors = [];
const writes = [];

async function session(browser, base, role, width, dark = false) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Manila' });
  const user = { id: 42, name: 'Dashboard Reviewer', full_name: 'Dashboard Reviewer', first_name: 'Dashboard', last_name: 'Reviewer', email: 'reviewer@example.invalid', role: role.role === 'it_admin' ? 'admin' : 'approver', roles: [role.role], workflow_role: role.role, department: role.department, position: role.role, status: 'active' };
  const departments = [{ id: 7, name: 'College of Information Technology Education', display_name: 'College of Information Technology Education', role_categories: ['requestor', 'office_head'], program_heads: [] }, { id: 8, name: 'School of Business and Accountancy', display_name: 'School of Business and Accountancy', role_categories: ['requestor'], program_heads: [] }];
  const statuses = ['pending_office_head', 'pending_vice_president', 'pending_imc_qa', 'approved', 'published', 'rejected', 'returned_for_revision', 'scheduled', 'draft'];
  const posts = statuses.map((status, index) => ({ id: 401 + index, code: `REQ-${401 + index}`, title: index < 3 ? `Role publication ${401 + index}` : `Content ${status.replaceAll('_', ' ')}`, status, status_label: status.replaceAll('_', ' '), routing_type: 'standard', caption_narrative: 'An institutional publication request with a clear date, venue, and department contact.', category: { id: 1, name: 'Advisory' }, requestor: { id: 41, full_name: 'Den Mark Orca', first_name: 'Den Mark', last_name: 'Orca', department: departments[0].name }, department: departments[0], created_at: '2026-11-17T02:00:00Z', updated_at: '2026-11-17T03:00:00Z', preferred_schedule_at: null, target_platforms: ['facebook', 'instagram'], platforms: { facebook: true, instagram: true }, media: [], approval_workflows: status.startsWith('pending') ? [{ stage: status.replace('pending_', ''), action: 'pending', approver: { full_name: user.name } }] : [], rejection_reason: status === 'rejected' ? 'Please attach the approved artwork.' : null }));
  posts.push({ ...posts[2], id: 420, title: 'Direct IMC publication', routing_type: 'direct_imc', target_platforms: ['facebook', 'website'] });
  const users = [user, { id: 41, name: 'Den Mark Orca', full_name: 'Den Mark Orca', first_name: 'Den Mark', last_name: 'Orca', email: 'requestor@example.invalid', roles: ['requestor'], role: 'requestor', department: departments[0].name, department_id: 7, status: 'active', created_at: '2026-11-01T02:00:00Z' }];
  const stats = { total: posts.length, total_posts: posts.length, pending: 4, pending_posts: 4, pending_approval: 4, approved: 1, approved_posts: 1, rejected: 1, rejected_posts: 1, published: 1, published_posts: 1, drafts: 1, draft_posts: 1 };
  await context.addInitScript(({ user, dark }) => {
    sessionStorage.setItem('auth_token', 'role-dashboard-readonly-fixture');
    sessionStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('dark_mode', String(dark));
  }, { user, dark });
  await context.route('**/api/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    if (!['GET', 'HEAD'].includes(route.request().method())) {
      writes.push({ endpoint, method: route.request().method() });
      return route.fulfill({ status: 405, json: { message: 'Read-only dashboard fixture' } });
    }
    let body = { data: [] };
    if (endpoint === '/auth/user') body = { user };
    else if (endpoint === '/dashboard/init') body = { posts: { data: posts }, stats, activities: [], departments: departments.map(item => item.name), users, audit_logs: [] };
    else if (endpoint === '/dashboard/stats') body = stats;
    else if (endpoint === '/dashboard/analytics') body = { data: {} };
    else if (endpoint === '/posts') body = { data: posts, meta: { current_page: 1, last_page: 1, per_page: 50, total: posts.length } };
    else if (/^\/posts\/\d+$/.test(endpoint)) body = { data: posts.find(post => post.id === Number(endpoint.split('/').pop())) };
    else if (endpoint === '/notifications') body = { notifications: [], unread_count: 0 };
    else if (endpoint === '/departments') body = { data: departments };
    else if (endpoint === '/users') body = { data: users };
    else if (endpoint === '/categories') body = { data: [{ id: 1, name: 'Advisory' }] };
    else if (endpoint === '/roles/list') body = { data: [{ id: 1, name: 'requestor', display_name: 'Requestor' }, { id: 2, name: 'office_head', display_name: 'Department Head' }, { id: 3, name: 'imc_qa_checker', display_name: 'IMC' }] };
    else if (endpoint === '/token-settings') body = { tokens: {}, connections: {}, last_updated: null };
    else if (endpoint === '/ai-settings') body = { data: { provider: 'deepseek', model: 'deepseek-chat', configured: false, verified_at: null, providers: [{ id: 'deepseek', name: 'DeepSeek' }] } };
    else if (endpoint === '/email-settings') body = { settings: {}, templates: [] };
    await route.fulfill({ json: body });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push({ role: role.route, width, message: error.message }));
  return { context, page };
}

async function inspect(page, role, width, tab, baseline) {
  const workspace = page.locator(`#${role.root}`);
  if (!baseline) await workspace.waitFor({ timeout: 15000 });
  await page.locator('img[src*="jmcbg2"]').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  if (!baseline) {
    const bounds = await workspace.boundingBox();
    assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, `${role.route}/${tab} workspace fits`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${role.route}/${tab}: no page horizontal overflow`);
    const overflow = await workspace.evaluate(root => [...root.querySelectorAll('input,textarea,select,[role="button"]')].flatMap(el => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!box.width || !box.height || style.visibility === 'hidden' || (box.left >= -1 && box.right <= innerWidth + 1)) return [];
      // Offscreen table cells are allowed only inside an intentionally clipped/scrolling region.
      let parent = el.parentElement;
      while (parent && parent !== root) {
        const css = getComputedStyle(parent);
        if (['auto', 'scroll', 'hidden'].includes(css.overflowX)) return [];
        parent = parent.parentElement;
      }
      return [{ label: el.getAttribute('aria-label') || el.textContent.slice(0, 60), left: box.left, right: box.right }];
    }));
    assert.deepEqual(overflow, [], `${role.route}/${tab}: controls stay contained`);
    assert.ok(await page.locator('img[src*="jmc_logo"]').count(), 'JMC logo remains');
  }
  await page.screenshot({ path: path.join(artifacts, `${baseline ? 'before' : 'after'}-${role.route}-${tab}-${width}.png`), animations: 'disabled' });
}

(async () => {
  const server = createWebServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge' });
  const baseline = process.argv.includes('--baseline');
  const quick = process.argv.includes('--quick') || baseline;
  try {
    for (const role of roles.filter(item => !arg('role') || item.route === arg('role'))) {
      for (const width of arg('width') ? [Number(arg('width'))] : baseline ? [390, 1440] : [320, 390, 768, 1440]) {
        const { context, page } = await session(browser, base, role, width);
        const tabs = quick || ![320, 1440].includes(width) ? [role.tab]
          : role.role === 'it_admin' ? ['overview', 'user-management', 'analytics', 'audit-logs', 'tokens', 'developer-api', 'email-settings', 'policy-rules', 'account-settings']
            : [role.tab, 'approved', 'rejected', 'all', ...(role.route === 'imc-qa' ? ['publishing-requests', 'published-posts'] : []), 'policy-rules', 'account-settings'];
        for (const tab of tabs) {
          await page.goto(`${base}/dashboard/${role.route}?tab=${tab}`);
          await inspect(page, role, width, tab, baseline);
        }
        if (!baseline && !quick) {
          await page.goto(`${base}/dashboard/${role.route}?tab=${role.tab}`);
          await page.locator(`#${role.root}`).waitFor();
          const search = page.locator(`#${role.root} input[placeholder*="Search" i]`).first();
          if (await search.count()) {
            await search.fill('No dashboard result matches this');
            await search.fill('');
          }
          if (width === 1440) {
            await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
            await inspect(page, role, width, `${role.tab}-expanded`, false);
          }
          if (role.role !== 'it_admin') {
            await page.goto(`${base}/dashboard/${role.route}?tab=dashboard&postId=${role.pending}`);
            await page.getByText(role.reviewTitle, { exact: true }).waitFor();
            const dialog = page.locator('[role="dialog"]').last();
            await page.waitForTimeout(350);
            const box = await dialog.boundingBox();
            assert.ok(box.x >= -1 && box.x + box.width <= width + 1, 'Review window fits');
            await page.screenshot({ path: path.join(artifacts, `after-${role.route}-review-${width}.png`) });
            await page.keyboard.press('Escape');
          }
        }
        await context.close();
        console.log(`PASS ${baseline ? 'baseline ' : ''}${role.route} ${width}px`);
      }
    }
    assert.deepEqual(errors, [], 'No browser runtime errors');
    assert.deepEqual(writes, [], 'No live approval, account, or publishing writes');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
