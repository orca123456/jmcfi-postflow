const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { createWebServer } = require('../scripts/serve-web.cjs');

const server = createWebServer();
const artifacts = path.resolve(__dirname, '../.expo/startup-qa');
fs.mkdirSync(artifacts, { recursive: true });

async function waitForRest(page) {
  await page.waitForFunction(() => document.querySelector('.pfa-login-mascot')?.dataset.speaking === 'false');
}

async function assertContained(page) {
  const speech = page.locator('.pfa-login-speech');
  await speech.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
  const box = await speech.boundingBox();
  const card = await page.locator('.pfa-login-panel').boundingBox();
  assert.ok(box.x >= card.x && box.x + box.width <= card.x + card.width, 'Speech stays inside the card width');
  assert.ok(box.y >= 0 && box.y + box.height <= card.y + 1, 'Speech clears the card and its fields');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.POSTFLOW_BROWSER_CHANNEL || 'msedge' });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('postflow_welcome_seen_v11', '1');
      window.__loginTones = [];
      const greeting = window.__loginGreetingTiming = { ready: null, visible: null, complete: null, lengths: [] };
      const observeGreeting = new MutationObserver(() => {
        const root = document.querySelector('.pfa-ready');
        const mascot = root?.querySelector('.pfa-login-mascot');
        const speech = root?.querySelector('.pfa-login-speech');
        if (!root || !speech || !mascot) return;
        greeting.ready ??= performance.now();
        const text = speech.querySelector('.pfa-speech-copy').textContent;
        if (speech.classList.contains('pfa-speech-visible') && getComputedStyle(speech).visibility === 'visible' && Number(getComputedStyle(speech).opacity) > 0) greeting.visible ??= performance.now();
        greeting.lengths.push(text.length);
        if (text === 'Hello! Welcome to PostFlow.' && mascot.dataset.speaking === 'false') {
          greeting.complete = performance.now();
          observeGreeting.disconnect();
        }
      });
      observeGreeting.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      const Audio = window.AudioContext;
      window.AudioContext = class extends Audio {
        createOscillator() {
          const oscillator = super.createOscillator();
          const start = oscillator.start.bind(oscillator);
          oscillator.start = (...args) => { window.__loginTones.push(oscillator.frequency.value); return start(...args); };
          return oscillator;
        }
      };
    });
    const page = await context.newPage();
    await page.clock.install();
    page.on('pageerror', error => errors.push(error.message));
    let attempts = 0;
    await page.route('**/api/auth/login', route => {
      attempts++;
      return route.fulfill(attempts >= 3
        ? { status: 429, json: { message: 'Too many login attempts.', retry_after: 59 } }
        : { status: 422, json: { message: 'The provided credentials are incorrect.' } });
    });
    await page.goto(`${base}/login`);
    await page.waitForFunction(() => window.__loginGreetingTiming.complete !== null);
    const timing = await page.evaluate(() => window.__loginGreetingTiming);
    const reveal = timing.lengths;
    assert.ok(timing.visible !== null && timing.visible - timing.ready < 250, 'The greeting is visibly painted promptly once login is ready');
    assert.ok(reveal[0] >= 'Hello!'.length, 'The opening word is readable immediately');
    assert.ok(new Set(reveal).size > 3 && reveal[0] < reveal.at(-1), 'Text appears progressively while the character talks');
    assert.ok(timing.complete - timing.visible < 650, `The full greeting finishes quickly without a long typewriter delay: ${JSON.stringify(timing)}`);
    assert.equal(await page.locator('.pfa-mouth').evaluate(el => getComputedStyle(el).animationName), 'none', 'Mouth stops when the message finishes');
    await assertContained(page);
    await page.clock.fastForward(10000);
    await page.clock.runFor(1400);
    assert.equal(await page.locator('.pfa-login-speech').isVisible(), true, 'The greeting remains beyond the former hide timeout');
    assert.equal(await page.locator('.pfa-speech-copy').textContent(), 'Still there? No pop quiz, I promise.', 'The mascot checks in automatically without any input');
    await page.getByLabel('Email', { exact: true }).focus();
    await page.getByRole('button', { name: 'Say hello to PostFlow', exact: true }).hover();
    await page.getByRole('button', { name: 'Say hello to PostFlow', exact: true }).click();
    await page.waitForFunction(() => window.__loginTones.length === 1);
    assert.equal(await page.locator('.pfa-speech-copy').textContent(), 'Still there? No pop quiz, I promise.', 'Focus, hover and tap preserve the current automatic reply');
    assert.equal(await page.locator('.pfa-login-mascot').getAttribute('data-speaking'), 'false');
    await page.clock.fastForward(1000);
    await page.screenshot({ path: path.join(artifacts, 'login-persistent-greeting.png') });

    const email = page.getByLabel('Email', { exact: true });
    const password = page.getByLabel('Password', { exact: true });
    const login = page.getByRole('button', { name: 'Login', exact: true });
    await email.fill('wrong-email');
    assert.equal(await page.locator('.pfa-login-speech').getAttribute('data-message'), 'Use your account email.', 'Actual entry changes the greeting');
    await password.fill('wrong-password');
    const beforeInvalid = await page.evaluate(() => window.__loginTones.length);
    await login.click();
    await page.waitForFunction(count => window.__loginTones.length === count + 2, beforeInvalid);
    await page.waitForFunction(() => document.querySelector('.pfa-login-speech').dataset.message === 'Check your email address.');
    assert.equal(attempts, 0, 'Malformed input stays on the client');
    assert.equal(await page.locator('.pfa-login-speech').getAttribute('data-message'), 'Check your email address.');
    const tones = await page.evaluate(() => window.__loginTones.slice(-2));
    assert.ok(tones[0] > tones[1], 'The error chime descends');
    await waitForRest(page);
    await assertContained(page);
    await page.screenshot({ path: path.join(artifacts, 'login-error-feedback-desktop.png') });

    // A remaining field error still wins over greetings when the other field is corrected.
    await email.fill('');
    await password.fill('');
    await login.click();
    await email.fill('reviewer@example.invalid');
    assert.equal(await page.locator('.pfa-login-speech').getAttribute('data-message'), 'Please enter your password.');
    await password.fill('wrong-password');
    await login.click();
    await page.waitForFunction(() => document.querySelector('.pfa-login-speech').dataset.message === 'Check your email and password.');
    await waitForRest(page);
    assert.equal(attempts, 1);
    const completeError = await page.locator('.pfa-speech-copy').textContent();
    await password.focus();
    assert.equal(await page.locator('.pfa-speech-copy').textContent(), completeError, 'Refocusing an error does not retype it');

    await page.evaluate(() => localStorage.setItem('postflow.assistant.sound', 'off'));
    const mutedCount = await page.evaluate(() => window.__loginTones.length);
    await password.fill('still-wrong');
    await login.click();
    await page.waitForFunction(() => document.querySelector('.pfa-speech-error') && document.getElementById('password').value === '');
    await waitForRest(page);
    assert.equal(attempts, 2);
    assert.equal(await page.evaluate(() => window.__loginTones.length), mutedCount, 'Saved mute also silences credential errors');

    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      await assertContained(page);
      await page.screenshot({ path: path.join(artifacts, `login-error-feedback-${viewport.width}.png`), fullPage: true });
    }

    await page.evaluate(() => localStorage.setItem('postflow.assistant.sound', 'on'));
    await password.fill('third-wrong-password');
    await login.click();
    await page.locator('.pfa-sleeping').waitFor();
    await page.waitForFunction(count => window.__loginTones.length === count + 2, mutedCount);
    // Freeze wall-clock drift before screenshots and exact countdown advances.
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 250)));
    assert.equal(attempts, 3);
    assert.equal(await page.locator('.pfa-sleep-countdown strong').textContent(), '59s');
    assert.equal(await page.locator('#postflow-login-feedback').count(), 0, 'The lockout does not duplicate the disabled-button countdown with another notice');
    assert.equal(await page.locator('.pfa-login-mascot').getAttribute('data-speaking'), 'false');
    assert.equal(await page.locator('.pfa-character').getAttribute('data-tracking'), 'false');
    assert.equal(await page.locator('.pfa-character.pfa-private').count(), 1, 'Sleeping closes the eyes');
    assert.equal(await page.locator('.pfa-mouth').evaluate(el => getComputedStyle(el).animationName), 'none');
    await assertContained(page);
    await page.screenshot({ path: path.join(artifacts, 'login-sleep-320.png'), fullPage: true });
    const sleepTones = await page.evaluate(() => window.__loginTones.length);
    await page.clock.fastForward(3000);
    assert.equal(await page.locator('.pfa-sleep-countdown strong').textContent(), '56s');
    await password.press('Enter');
    assert.equal(attempts, 3, 'No request can submit during the countdown');
    await page.clock.fastForward(55000);
    assert.equal(await page.locator('.pfa-sleep-countdown strong').textContent(), '1s');
    assert.equal(await page.evaluate(() => window.__loginTones.length), sleepTones, 'Countdown ticks stay silent');
    await page.clock.fastForward(1000);
    await page.locator('.pfa-sleeping').waitFor({ state: 'detached' });
    await page.clock.runFor(1000);
    assert.equal(await login.isEnabled(), true);
    assert.equal(await page.locator('.pfa-login-speech').getAttribute('data-message'), 'I’m awake. Try again.');
    assert.equal(await page.locator('.pfa-character').getAttribute('data-tracking'), 'true');
    await waitForRest(page);
    await page.screenshot({ path: path.join(artifacts, 'login-awake-320.png'), fullPage: true });
    await context.close();

    const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 320, height: 568 } });
    await reduced.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    const reducedPage = await reduced.newPage();
    reducedPage.on('pageerror', error => errors.push(error.message));
    await reducedPage.goto(`${base}/login`);
    await reducedPage.getByLabel('Email', { exact: true }).fill('wrong-email');
    await reducedPage.getByLabel('Password', { exact: true }).fill('wrong-password');
    await reducedPage.getByRole('button', { name: 'Login', exact: true }).click();
    assert.equal(await reducedPage.locator('.pfa-speech-copy').textContent(), 'Check your email address.');
    assert.equal(await reducedPage.locator('.pfa-login-mascot').getAttribute('data-speaking'), 'false');
    assert.equal(await reducedPage.locator('.pfa-mouth').evaluate(el => getComputedStyle(el).animationName), 'none');
    await assertContained(reducedPage);
    await reduced.close();
    assert.deepEqual(errors, []);
    console.log('PASS: progressive speech/mouth timing, error precedence, desktop/mobile placement, descending error chime, saved mute, third-attempt 59s sleep/countdown/wake, no locked submissions, reduced motion and unsupported audio.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
