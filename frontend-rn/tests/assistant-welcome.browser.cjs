const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createWebServer } = require('../scripts/serve-web.cjs');

const server = createWebServer();
const artifacts = path.resolve(__dirname, '../.expo/startup-qa');
fs.mkdirSync(artifacts, { recursive: true });

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.POSTFLOW_BROWSER_CHANNEL || 'msedge' });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('postflow_welcome_seen_v11', '1');
      window.__assistantAudio = { contexts: [], tones: 0 };
      const Audio = window.AudioContext;
      window.AudioContext = class extends Audio {
        constructor(...args) { super(...args); window.__assistantAudio.contexts.push(this); }
        createOscillator() {
          const oscillator = super.createOscillator();
          const start = oscillator.start.bind(oscillator);
          oscillator.start = (...args) => { window.__assistantAudio.tones++; return start(...args); };
          return oscillator;
        }
      };
    });
    const user = { id: 2, name: 'Rafael Santos', first_name: 'Rafael', email: 'approver@example.invalid', role: 'office_head', roles: ['office_head'], department: 'College of Engineering' };
    let pending = 27;
    let failStats = false;
    let initRequests = 0;
    let releaseStats;
    const statsGate = new Promise(resolve => { releaseStats = resolve; });
    await context.route('**/api/**', async route => {
      const endpoint = new URL(route.request().url()).pathname;
      if (endpoint === '/api/dashboard/init') {
        initRequests++;
        await statsGate;
        if (failStats) return route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } });
      }
      return route.fulfill({ json: endpoint === '/api/auth/login' ? { token: 'assistant-welcome-test', user }
        : endpoint === '/api/auth/user' ? { user }
        : endpoint === '/api/dashboard/init' ? { stats: { pending_review: pending, pending }, posts: { data: [] }, activities: [], departments: [] }
        : endpoint === '/api/notifications' ? { notifications: [], unread_count: 0 }
        : endpoint === '/api/chatbot/message' ? { reply: 'You can review requests from your dashboard.' } : { data: [] } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('welcome-test');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.waitForURL('**/dashboard/office-head');
    await page.locator('[data-postflow-handoff]').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.pf-review-summary').textContent(), 'I’m here to help with your reviews.');
    const greeting = page.getByRole('button', { name: 'Chat with PostFlow', exact: true });
    await greeting.waitFor({ state: 'visible', timeout: 1000 });
    assert.match(await page.locator('[data-pf-welcome-announcement]').textContent(), /Welcome back, Rafael.*here to help with your reviews/, 'The welcome appears while the review request is still pending');
    assert.doesNotMatch(await greeting.textContent(), /No requests/, 'A pending count is never announced as zero');
    releaseStats();
    await page.waitForFunction(() => document.querySelector('.pf-greeting-detail').textContent.includes('27 requests'));
    await page.waitForFunction(() => document.querySelector('.pf-greeting-title').textContent === 'Welcome back, Rafael.');
    assert.match(await greeting.textContent(), /27 requests are awaiting your approval/);
    assert.match(await page.locator('[data-pf-welcome-announcement]').textContent(), /Welcome back, Rafael.*27 requests/);
    assert.equal(initRequests, 1, 'The assistant reuses the dashboard request instead of fetching a second queue');
    await page.waitForFunction(() => window.__assistantAudio.tones >= 3);
    assert.equal(await page.evaluate(() => window.__assistantAudio.contexts[0].state), 'running', 'Sign-in unlocks the welcome chime');
    await greeting.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    await greeting.screenshot({ path: path.join(artifacts, 'assistant-login-welcome.png') });
    await greeting.click();
    await page.getByRole('button', { name: 'Mute assistant sounds' }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('postflow.assistant.sound')), 'off');
    const tonesMuted = await page.evaluate(() => window.__assistantAudio.tones);
    pending = 0;
    await page.waitForFunction(() => document.querySelector('.pf-review-summary')?.textContent.includes('No requests awaiting your approval'), null, { timeout: 20000 });
    assert.equal(initRequests, 2, 'The existing dashboard refresh also updates the assistant count');
    await page.screenshot({ path: path.join(artifacts, 'assistant-review-zero.png') });
    await page.getByLabel('Type your message').fill('How can I review a request?');
    const chatRequest = page.waitForRequest('**/api/chatbot/message');
    await page.getByLabel('Type your message').press('Enter');
    assert.match((await chatRequest).postDataJSON().messages[0].content, /No requests awaiting your approval/, 'Chat follow-ups receive the latest queue summary');
    await page.getByText('You can review requests from your dashboard.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__assistantAudio.tones), tonesMuted, 'Muted send and reply interactions stay silent');
    pending = 1;
    await page.reload();
    await page.locator('.pf-review-summary').filter({ hasText: '1 request is awaiting your approval.' }).waitFor({ state: 'attached' });
    assert.equal(await page.locator('[data-pf-welcome-announcement]').textContent(), '', 'Refreshing does not repeat the sign-in welcome');
    await page.getByRole('button', { name: 'Open PostFlow assistant', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Enable assistant sounds' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => window.__assistantAudio.tones), 0, 'The saved mute preference applies after refresh');
    await page.getByRole('button', { name: 'Enable assistant sounds' }).click();
    await page.waitForFunction(() => window.__assistantAudio.tones > 0);
    await page.getByRole('button', { name: 'Mute assistant sounds' }).click();
    failStats = true;
    await page.reload();
    await page.locator('.pf-review-summary').filter({ hasText: 'I’m here to help with your reviews.' }).waitFor({ state: 'attached' });
    assert.equal(await page.locator('.pf-review-summary').getByText(/No requests/).count(), 0, 'A failed request is never shown as zero');
    assert.equal(await page.locator('.pf-assistant').getByText(/unavailable right now/i).count(), 0, 'The greeting does not expose a failed count as an error message');
    failStats = false;
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`${base}/login`);
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('welcome-test');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.locator('[data-pf-welcome-announcement]').filter({ hasText: 'Welcome back, Rafael.' }).waitFor({ state: 'attached' });
    assert.equal(await page.evaluate(() => localStorage.getItem('postflow.assistant.sound')), 'off', 'The sound preference survives signing in again');
    assert.equal(await page.evaluate(() => window.__assistantAudio.tones), 0, 'A muted welcome stays silent on the next sign-in');
    await context.close();

    for (const [role, routePath, count] of [['vice_president', 'vp', 4], ['imc_qa_checker', 'imc-qa', 8]]) {
      const session = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
      const approver = { ...user, role, roles: [role] };
      await session.addInitScript(user => {
        sessionStorage.setItem('auth_token', 'role-review-count');
        sessionStorage.setItem('auth_user', JSON.stringify(user));
        window.AudioContext = undefined;
        window.webkitAudioContext = undefined;
      }, approver);
      await session.route('**/api/**', route => {
        const endpoint = new URL(route.request().url()).pathname;
        return route.fulfill({ json: endpoint === '/api/auth/user' ? { user: approver }
          : endpoint === '/api/dashboard/init' ? { stats: { pending_review: count }, posts: { data: [] }, activities: [], departments: [] }
          : endpoint === '/api/notifications' ? { notifications: [], unread_count: 0 } : { data: [] } });
      });
      const rolePage = await session.newPage();
      rolePage.on('pageerror', error => errors.push(error.message));
      await rolePage.goto(`${base}/dashboard/${routePath}`);
      await rolePage.locator('.pf-review-summary').filter({ hasText: `${count} requests are awaiting your approval.` }).waitFor({ state: 'attached' });
      await rolePage.getByRole('button', { name: 'Open PostFlow assistant', exact: true }).click();
      await rolePage.getByRole('button', { name: 'Mute assistant sounds' }).click();
      await rolePage.setViewportSize({ width: 320, height: 568 });
      await rolePage.waitForFunction(() => {
        const bounds = document.querySelector('.pf-panel').getBoundingClientRect();
        return bounds.x >= 10 && bounds.right <= 310;
      }, null, { timeout: 3000 });
      const panel = await rolePage.locator('.pf-panel').boundingBox();
      assert.ok(panel.x >= 10 && panel.x + panel.width <= 310, `Count and sound controls fit on narrow screens: ${JSON.stringify(panel)}`);
      await rolePage.screenshot({ path: path.join(artifacts, `assistant-review-${routePath}-mobile.png`) });
      await session.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: personalized sign-in welcome, real approval totals, zero/singular/plural/error states, live queue updates without duplicate requests, welcome chime, persistent mute, reply feedback, refresh behavior, VP/IMC queues, narrow screens and unavailable audio.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
