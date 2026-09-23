const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1920, 1440, 768, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 960 } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      const user = { id: 1, name: 'Test Admin', email: 'test@example.com', role: 'admin', roles: ['it_admin'] };
      let settings = {
        provider: 'deepseek', model: 'deepseek-chat', configured: true, verified_at: null,
        providers: [ ['deepseek', 'DeepSeek'], ['openai', 'OpenAI'], ['gemini', 'Google Gemini'],
          ['groq', 'Groq'], ['openrouter', 'OpenRouter'] ].map(([id, name]) => ({ id, name })),
      };
      const writes = [];
      let failLoad = true;
      let failClear = true;
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
          if (request.method() === 'GET' && failLoad) {
            status = 503;
            body = { message: 'Temporarily unavailable' };
          } else if (request.method() === 'POST') {
            await new Promise(resolve => setTimeout(resolve, 300));
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
            if (request.method() === 'DELETE' && failClear) {
              status = 503;
              body = { message: 'Clear failed. Please retry.' };
            } else {
              if (request.method() === 'DELETE') settings = { ...settings, configured: false, verified_at: null };
              body = settings;
            }
          }
        } else if (endpoint.endsWith('/token-settings')) body = { tokens: {}, connections: {} };
        else if (endpoint.endsWith('/dashboard/init')) body = { posts: [], activities: [] };
        else if (endpoint.endsWith('/auth/user')) body = { user };
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`${process.env.POSTFLOW_WEB_URL || 'http://localhost:3001'}/dashboard/it-admin?tab=tokens`);
      const panel = page.getByTestId('ai-settings-panel');
      await panel.getByText('Unable to load AI settings.', { exact: true }).waitFor({ timeout: 90000 });
      failLoad = false;
      await panel.getByRole('button', { name: 'Retry', exact: true }).click();
      const key = page.getByLabel('AI API key', { exact: true });
      const save = panel.getByRole('button', { name: 'Save Changes', exact: true });
      await key.waitFor({ timeout: 90000 });
      assert.equal(await key.inputValue(), '');
      assert.equal(await key.getAttribute('type'), 'password');
      await save.click();
      await panel.getByText('Connection tested and settings saved.', { exact: true }).waitFor();
      assert.equal(Object.hasOwn(writes.at(-1), 'api_key'), false, 'Retain the saved key when no replacement is entered');
      await page.getByRole('button', { name: 'Select AI provider' }).click();
      await page.getByRole('radio', { name: 'Google Gemini', exact: true }).click();
      await page.getByLabel('AI model ID', { exact: true }).fill('gemini-test');
      assert.equal(await save.isDisabled(), true);
      await key.fill('bad-test-key');
      await panel.getByRole('button', { name: 'Show API key', exact: true }).click();
      assert.equal(await key.evaluate(element => element.type), 'text');
      await panel.getByRole('button', { name: 'Hide API key', exact: true }).click();
      assert.equal(await key.getAttribute('type'), 'password');
      await save.click();
      assert.equal(await save.isDisabled(), true);
      await page.getByText('API key rejected. Previous settings were kept.', { exact: true }).waitFor();
      assert.equal(settings.provider, 'deepseek');
      await key.fill('good-test-key');
      await save.click();
      await page.getByText('Connection tested and settings saved.', { exact: true }).waitFor();
      assert.equal(settings.provider, 'gemini');
      assert.equal(await key.inputValue(), '');
      assert.equal(writes.at(-1).model, 'gemini-test');
      await page.reload();
      await panel.getByText('Connected', { exact: true }).waitFor();
      await panel.getByText('gemini-test', { exact: true }).waitFor();
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(os.tmpdir(), `postflow-ai-${width}.png`) });
      await panel.screenshot({ path: path.join(os.tmpdir(), `postflow-ai-panel-${width}.png`) });
      const bounds = await key.boundingBox();
      assert.ok(bounds.width > 150 && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      const intro = await page.getByTestId('ai-settings-intro').boundingBox();
      const model = await page.getByLabel('AI model ID', { exact: true }).boundingBox();
      if (width >= 1440) {
        assert.ok(model.x >= intro.x + intro.width, 'Desktop form must sit beside the intro');
        assert.ok(Math.abs(model.y - bounds.y) < 2, 'Desktop fields must align');
      } else if (width === 390) {
        assert.ok(bounds.y >= model.y + model.height, 'Mobile inputs must stack');
      }
      await page.getByRole('button', { name: 'Clear credentials', exact: true }).click();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(settings.configured, true);
      await page.getByRole('button', { name: 'Clear credentials', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm clear', exact: true }).click();
      await page.getByText('Clear failed. Please retry.', { exact: true }).last().waitFor();
      assert.equal(settings.configured, true);
      failClear = false;
      await page.getByRole('button', { name: 'Confirm clear', exact: true }).click();
      await panel.getByText('Not Connected', { exact: true }).waitFor();
      assert.equal(settings.configured, false);
      assert.deepEqual(pageErrors, []);
      console.log(`AI settings browser flow passed at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
