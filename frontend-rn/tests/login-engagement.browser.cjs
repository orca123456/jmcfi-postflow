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
  const browser = await chromium.launch({ channel: process.env.POSTFLOW_BROWSER_CHANNEL || 'msedge' });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('postflow_welcome_seen_v11', '1');
      window.__engagementTones = 0;
      const Audio = window.AudioContext;
      window.AudioContext = class extends Audio {
        createOscillator() {
          const oscillator = super.createOscillator();
          const start = oscillator.start.bind(oscillator);
          oscillator.start = (...args) => { window.__engagementTones++; return start(...args); };
          return oscillator;
        }
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.goto(`http://127.0.0.1:${server.address().port}/login`);
    await page.locator('.pfa-speech-visible').waitFor();
    await page.waitForFunction(() => document.querySelector('.pfa-login-mascot').dataset.speaking === 'false');
    const greetingSize = await page.locator('.pfa-login-speech').evaluate(el => {
      const style = getComputedStyle(el);
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); ctx.font = style.font;
      return { width: el.getBoundingClientRect().width, textWidth: ctx.measureText(el.dataset.message).width, padding: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2 };
    });
    assert.ok(greetingSize.width <= greetingSize.textWidth + greetingSize.padding + 2, 'The greeting bubble fits the text instead of stretching to all available space');
    await page.screenshot({ path: path.join(artifacts, 'login-compact-bubble.png') });
    await page.clock.fastForward(10000); await page.clock.runFor(1200);
    assert.equal(await page.locator('.pfa-speech-copy').textContent(), 'Still there? No pop quiz, I promise.', 'A polite check-in appears without typing');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      const bubble = await page.locator('.pfa-login-speech').boundingBox();
      const card = await page.locator('.pfa-login-panel').boundingBox();
      assert.ok(bubble.x >= card.x && bubble.x + bubble.width <= card.x + card.width && bubble.y + bubble.height <= card.y + 1, 'The check-in fits above the card on small phones');
      await page.screenshot({ path: path.join(artifacts, `login-idle-checkin-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.clock.fastForward(10000); await page.clock.runFor(1200);
    assert.equal(await page.locator('.pfa-speech-copy').textContent(), 'Ready when you are.');
    assert.equal(await page.evaluate(() => window.__engagementTones), 0, 'Automatic banter remains silent');
    const email = page.getByLabel('Email', { exact: true });
    await email.focus();
    await page.clock.fastForward(10000); await page.clock.runFor(1200);
    assert.match(await page.locator('.pfa-speech-copy').textContent(), /paper cuts/, 'Automatic replies continue while a field is focused without typing');
    await email.fill('user@example.invalid'); await page.clock.runFor(1200);
    await page.clock.fastForward(3000);
    assert.equal(await page.locator('.pfa-speech-copy').textContent(), 'Use your account email.', 'Typing guidance remains readable');
    await email.press('a'); await page.clock.fastForward(4000);
    await email.press('Backspace'); await page.clock.fastForward(4000);
    assert.equal(await page.locator('.pfa-speech-copy').textContent(), 'Use your account email.', 'Active typing postpones automatic replies');
    await page.clock.fastForward(5000);
    assert.equal(await page.locator('.pfa-login-speech').getAttribute('data-message'), 'Use your account email.', 'The check-in does not interrupt before ten seconds');
    await page.clock.fastForward(1000); await page.clock.runFor(1200);
    assert.equal(await page.locator('.pfa-speech-copy').textContent(), 'Still there? No pop quiz, I promise.', 'The check-in restarts ten seconds after the last keystroke');
    await page.locator('.pfa-login-panel').getByText('JMCFI PostFlow', { exact: true }).click();
    for (let turn = 0; turn < 4 && !(await page.locator('.pfa-speech-copy').textContent()).includes('next post'); turn++) {
      await page.clock.fastForward(10000); await page.clock.runFor(1400);
    }
    assert.match(await page.locator('.pfa-speech-copy').textContent(), /next post/, 'Idle banter resumes after leaving the form');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      const speech = await page.locator('.pfa-login-speech').boundingBox();
      const card = await page.locator('.pfa-login-panel').boundingBox();
      assert.ok(speech.x >= card.x && speech.x + speech.width <= card.x + card.width && speech.y + speech.height <= card.y + 1, 'The longest automatic message fits above the card on phones');
      await page.screenshot({ path: path.join(artifacts, `login-banter-${width}.png`), fullPage: true });
    }

    await page.getByRole('button', { name: 'Say hello to PostFlow', exact: true }).click();
    await page.waitForFunction(() => window.__engagementTones === 1);
    await page.clock.fastForward(9000);
    assert.match(await page.locator('.pfa-login-speech').getAttribute('data-message'), /next post/, 'A mascot tap resets the quiet timer');
    await page.clock.fastForward(1000); await page.clock.runFor(1200);
    assert.match(await page.locator('.pfa-speech-copy').textContent(), /Still there\?/);
    assert.equal(await page.evaluate(() => window.__engagementTones), 1, 'The check-in adds no automatic sound');

    await email.fill('wrong-email');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.locator('.pfa-login-panel').getByText('JMCFI PostFlow', { exact: true }).click();
    await page.clock.runFor(1200); await page.clock.fastForward(44000);
    assert.equal(await page.locator('.pfa-login-speech').getAttribute('data-message'), 'Check your email address.', 'An error message is never replaced by a joke');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: ten-second inactivity check-in, typing/tap timer reset, focused-field automatic replies, quiet reminders, error priority and compact phone layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
