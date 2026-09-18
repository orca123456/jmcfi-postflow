const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 960 } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      const user = { id: 1, name: 'Test Admin', email: 'test@example.com', role: 'admin', roles: ['it_admin'] };
      let settings = {
        provider: 'deepseek', model: 'deepseek-chat', configured: true, verified_at: null,
        providers: ['deepseek', 'openai', 'gemini', 'groq', 'openrouter'].map(id => ({ id, name: id })),
      };
      const writes = [];
      await context.addInitScript(user => {
        sessionStorage.setItem('auth_token', 'browser-test-token');
        sessionStorage.setItem('auth_user', JSON.stringify(user));
      }, user);
      await page.route('**/api/**', async route => {
        const request = route.request();
        const endpoint = new URL(request.url()).pathname;
        let body = { data: [] };
        let status = 200;
        if (endpoint.endsWith('/ai-settings')) {
          if (request.method() === 'POST') {
            const data = request.postDataJSON();
            writes.push(data);
            if (data.api_key === 'bad-test-key') {
              status = 422;
              body = { errors: { api_key: ['API key rejected. Previous settings were kept.'] } };
            } else {
              settings = { ...settings, provider: data.provider, model: data.model, configured: true, verified_at: new Date().toISOString() };
              body = settings;
            }
          } else {
            if (request.method() === 'DELETE') settings = { ...settings, configured: false, verified_at: null };
            body = settings;
          }
        } else if (endpoint.endsWith('/token-settings')) body = { tokens: {}, connections: {} };
        else if (endpoint.endsWith('/dashboard/init')) body = { posts: [], activities: [] };
        else if (endpoint.endsWith('/auth/user')) body = { user };
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`${process.env.POSTFLOW_WEB_URL || 'http://localhost:3001'}/dashboard/it-admin?tab=tokens`);
      const key = page.getByLabel('AI API key', { exact: true });
      await key.waitFor({ timeout: 90000 });
      assert.equal(await key.inputValue(), '');
      assert.equal(await key.getAttribute('type'), 'password');
      await page.getByRole('button', { name: 'Select AI provider' }).click();
      await page.getByRole('radio', { name: 'gemini', exact: true }).click();
      await page.getByLabel('AI model ID', { exact: true }).fill('gemini-test');
      assert.equal(await page.getByRole('button', { name: 'Test & Save' }).isDisabled(), true);
      await key.fill('bad-test-key');
      await page.getByRole('button', { name: 'Test & Save' }).click();
      await page.getByText('API key rejected. Previous settings were kept.', { exact: true }).waitFor();
      assert.equal(settings.provider, 'deepseek');
      await key.fill('good-test-key');
      await page.getByRole('button', { name: 'Test & Save' }).click();
      await page.getByText('Connection tested and settings saved.', { exact: true }).waitFor();
      assert.equal(settings.provider, 'gemini');
      assert.equal(await key.inputValue(), '');
      assert.equal(writes.at(-1).model, 'gemini-test');
      await page.reload();
      await page.getByText('gemini: gemini-test - Connection verified', { exact: true }).waitFor();
      const panel = page.getByText('AI Provider', { exact: true });
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(os.tmpdir(), `postflow-ai-${width}.png`) });
      const bounds = await key.boundingBox();
      assert.ok(bounds.width > 150 && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      await page.getByRole('button', { name: 'Clear credentials', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm clear', exact: true }).click();
      await page.getByText('AI disabled', { exact: true }).waitFor();
      assert.equal(settings.configured, false);
      assert.deepEqual(pageErrors, []);
      console.log(`AI settings browser flow passed at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
