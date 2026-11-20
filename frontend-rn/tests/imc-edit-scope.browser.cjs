const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createWebServer } = require('../scripts/serve-web.cjs');
(async () => {
  const server = createWebServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge' });
  const user = { id: 42, name: 'IMC Reviewer', first_name: 'IMC', last_name: 'Reviewer', role: 'approver', roles: ['imc_qa_checker'], workflow_role: 'imc_qa_checker', department: 'Integrated Marketing Communications' };
  let writes = 0;
  try {
    for (const width of [390, 1440]) {
      for (const routing_type of ['standard', 'direct_imc', null]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await context.addInitScript(user => {
          sessionStorage.setItem('auth_token', 'imc-scope-fixture');
          sessionStorage.setItem('auth_user', JSON.stringify(user));
        }, user);
        const post = { id: 901, title: 'Scope fixture', caption_narrative: 'Original submitted caption.', routing_type,
          status: 'pending_imc_qa', created_at: '2026-11-17T02:00:00Z', target_platforms: ['facebook'],
          category: { name: 'Direct to IMC' }, requestor: { full_name: 'Requestor', department: 'Test department' }, media: [], approval_workflows: [] };
        await context.route('**/api/**', async route => {
          if (route.request().method() !== 'GET') { writes++; return route.fulfill({ status: 405, json: {} }); }
          const endpoint = new URL(route.request().url()).pathname;
          let body = { data: [] };
          if (endpoint.endsWith('/auth/user')) body = { user };
          else if (endpoint.endsWith('/posts/901')) body = { data: post };
          else if (endpoint.includes('init')) body = { posts: { data: [post] }, stats: {}, categories: [] };
          else if (endpoint.endsWith('/posts')) body = { data: [post] };
          else if (endpoint.endsWith('/notifications')) body = { notifications: [], unread_count: 0 };
          await route.fulfill({ json: body });
        });
        const page = await context.newPage();
        await page.goto(`${base}/dashboard/imc-qa?tab=publishing-requests&postId=901`);
        if (routing_type === 'direct_imc') {
          await page.getByText('Final Preparation', { exact: true }).waitFor({ timeout: 15000 });
          const caption = page.getByPlaceholder('Enter or refine the finalized publication caption...');
          await caption.fill('Finalized direct IMC caption.');
          assert.equal(await caption.inputValue(), 'Finalized direct IMC caption.');
          await page.getByText('Upload Final Images', { exact: true }).waitFor();
        } else {
          await page.getByText('Content Request Quality Review', { exact: true }).waitFor({ timeout: 15000 });
          assert.equal(await page.getByText('Final Preparation', { exact: true }).count(), 0);
          assert.equal(await page.getByText('Upload Final Images', { exact: true }).count(), 0);
          await page.getByText('Original submitted caption.', { exact: true }).first().waitFor();
        }
        await page.screenshot({ path: `.expo/requestor-qa/imc-edit-scope-${routing_type}-${width}.png` });
        console.log(`PASS ${routing_type} ${width}`);
        await context.close();
      }
    }
    assert.equal(writes, 0);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
