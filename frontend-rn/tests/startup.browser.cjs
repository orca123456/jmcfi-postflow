const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createWebServer } = require('../scripts/serve-web.cjs');

// Production-browser coverage; authentication responses are mocked, with no database writes.
const server = createWebServer();
const artifacts = path.resolve(__dirname, '../.expo/startup-qa');
fs.mkdirSync(artifacts, { recursive: true });

async function assertFits(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal overflow');
  assert.equal(await page.locator('.pfa-root').evaluate(el => el.scrollWidth <= el.clientWidth), true, 'The application must not scroll horizontally');
  const panel = await page.locator('.pfa-login-panel').boundingBox();
  const viewport = page.viewportSize();
  assert.ok(panel.x >= 12 && panel.x + panel.width <= viewport.width - 12, 'The entire card must fit inside the screen');
  assert.ok(Math.abs(panel.x + panel.width / 2 - viewport.width / 2) < 1, 'The card stays centered at every viewport size');
  const login = page.getByRole('button', { name: 'Login', exact: true });
  await login.scrollIntoViewIfNeeded();
  assert.equal(await login.isVisible(), true);
}

async function assertLabelsSeparated(page) {
  for (const label of ['Email', 'Password']) {
    const input = page.getByLabel(label, { exact: true });
    await page.locator(`#postflow-${label.toLowerCase()}-label`).evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))));
    const state = await input.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { floating: !!el.value || el === document.activeElement || el.matches(':autofill'), contentTop: rect.top + parseFloat(getComputedStyle(el).paddingTop), center: rect.top + rect.height / 2 };
    });
    const caption = await page.locator('.pfa-login-panel').getByText(label, { exact: true }).boundingBox();
    if (state.floating) {
      assert.ok(caption.y + caption.height <= state.contentTop, `${label} must stay above the input text`);
    } else {
      assert.ok(Math.abs(caption.y + caption.height / 2 - state.center) < 2, `${label} must be centered when empty and unfocused`);
    }
  }
}

async function assertSpeechFits(page) {
  const speech = page.locator('.pfa-login-speech.pfa-speech-visible');
  await speech.waitFor();
  await speech.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
  const bubble = await speech.boundingBox();
  const card = await page.locator('.pfa-login-panel').boundingBox();
  assert.ok(bubble.x >= 12 && bubble.x + bubble.width <= page.viewportSize().width - 12, 'The speech bubble stays inside the viewport');
  assert.ok(bubble.y >= 0 && bubble.y + bubble.height <= card.y, 'The speech bubble stays above the login card');
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.POSTFLOW_BROWSER_CHANNEL || 'msedge' });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => sessionStorage.setItem('postflow_welcome_seen_v10', '1'));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const start = Date.now();
    await page.goto(base);
    await page.locator('.pfa-intro').waitFor();
    assert.equal(await page.locator('.pfa-root').evaluate(el => el.scrollWidth <= el.clientWidth), true, 'The campus camera move stays clipped inside the screen');
    assert.equal(await page.locator('.pfa-login-shell').getAttribute('inert'), '');
    assert.equal(await page.getByRole('button', { name: /skip|replay/i, includeHidden: true }).count(), 0);
    const introCharacterBox = await page.locator('.pfa-intro-character').boundingBox();
    const introTitleBox = await page.locator('.pfa-intro-wordmark').boundingBox();
    assert.ok(introCharacterBox.x + introCharacterBox.width < introTitleBox.x, 'Desktop startup places the character beside the wordmark');
    assert.equal(await page.locator('.pfa-intro-signature span').allTextContents().then(words => words.join(', ')), 'Request, Review, Publish');
    assert.ok((await page.locator('.pfa-intro h1').evaluate(el => getComputedStyle(el).fontFamily)).includes('Merriweather_700Bold'), 'The PostFlow title uses Merriweather Bold');
    assert.equal(await page.locator('.pfa-startup-actor .pfa-arms-art').evaluate(el => !!(el.compareDocumentPosition(el.parentElement.querySelector('.pfa-head-rig')) & Node.DOCUMENT_POSITION_PRECEDING)), true, 'The flying arms render in front of the helmet');
    assert.equal(await page.locator('.pfa-startup-actor .pfa-character').getAttribute('data-hand-pose'), 'closed');
    assert.equal(await page.locator('.pfa-startup-actor .pfa-character').getAttribute('data-tracking'), 'true', 'The startup greeting responds to the cursor');
    assert.equal(await page.locator('.pfa-arrival-rest').count(), 0, 'There is no replacement body to crossfade');
    await page.locator('img[src*="jmcbg2"]').evaluate(img => img.decode());
    await page.locator('.pfa-startup-actor .pfa-bot-base').evaluate(img => img.decode());
    const orbitPositions = await page.locator('.pfa-startup-actor .pfa-character-motion').evaluate(el => {
      const flight = el.getAnimations().find(animation => animation instanceof CSSAnimation && animation.animationName === 'pfa-entrance');
      const positions = [];
      const start = performance.now();
      return new Promise(resolve => {
        function sample() {
          const bounds = el.getBoundingClientRect();
          positions.push(bounds.x + bounds.width / 2);
          if (flight?.playState === 'finished' || performance.now() - start > 3600) resolve(positions);
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
    });
    const orbitSteps = orbitPositions.slice(1).map((position, index) => position - orbitPositions[index]);
    assert.ok(orbitSteps.some(step => step > 1), 'The character makes one controlled entrance');
    assert.equal(await page.locator('.pfa-startup-actor .pfa-character-motion').evaluate(el => getComputedStyle(el).offsetPath), 'none', 'Startup no longer follows a looping orbit');
    const capeBefore = await page.locator('.pfa-cape-cloth').getAttribute('d');
    await page.waitForFunction(previous => document.querySelector('.pfa-cape-cloth').getAttribute('d') !== previous, capeBefore);
    await page.screenshot({ path: path.join(artifacts, 'welcome-desktop.png') });
    await page.locator('.pfa-intro').waitFor({ state: 'detached', timeout: 8000 });
    assert.ok(Date.now() - start < 9000, 'Welcome advances automatically');
    await assertFits(page);
    const panel = await page.locator('.pfa-login-panel').boundingBox();
    const assistant = await page.locator('.pfa-assistant').boundingBox();
    assert.ok(Math.abs(panel.x + panel.width / 2 - 720) < 1, 'Login card stays centered');
    assert.ok(Math.abs(assistant.x - panel.x - 16) < 1 && assistant.y < panel.y, 'Character and speech sit together above the centered card');
    await page.locator('.pfa-login-panel').getByLabel('Jose Maria College logo').waitFor();
    const logo = await page.locator('#postflow-login-logo').boundingBox();
    assert.equal(logo.width, 56, 'The card logo is larger without expanding the card');
    assert.ok(Math.abs(logo.x + logo.width / 2 - 720) < 1, 'The larger logo stays centered');
    const titleFont = await page.locator('.pfa-login-panel').getByText('JMCFI PostFlow', { exact: true }).evaluate(el => getComputedStyle(el).fontFamily);
    assert.ok(titleFont.includes('Merriweather_700Bold'), 'The login heading uses Merriweather Bold');
    await page.locator('.pfa-login-speech.pfa-speech-visible').waitFor();
    assert.equal(await page.locator('.pfa-login-speech').getAttribute('data-message'), 'Hello! Welcome to PostFlow.', 'The character greets the user automatically');
    assert.equal(await page.getByRole('button', { name: 'Get sign-in help', exact: true }).count(), 0, 'The greeting has no question-mark badge');
    assert.equal(await page.locator('.pfa-login-help').count(), 0, 'The character does not open a help popup');
    await page.screenshot({ path: path.join(artifacts, 'login-desktop.png') });
    const sayHello = page.getByRole('button', { name: 'Say hello to PostFlow', exact: true });
    let mascotLoginRequests = 0;
    const countMascotRequests = request => { if (new URL(request.url()).pathname === '/api/auth/login') mascotLoginRequests++; };
    page.on('request', countMascotRequests);
    await page.waitForFunction(() => document.querySelector('.pfa-login-mascot').dataset.speaking === 'false');
    await sayHello.hover();
    assert.equal(await page.locator('.pfa-login-mascot').getAttribute('data-speaking'), 'false', 'Hover does not restart talking over an unchanged message');
    await sayHello.click();
    assert.equal(await page.locator('.pfa-login-mascot').getAttribute('data-speaking'), 'false', 'A greeting gesture does not talk over unchanged text');
    await page.getByLabel('Email', { exact: true }).fill('typing@example.invalid');
    await page.waitForFunction(() => document.querySelector('.pfa-login-mascot').dataset.speaking === 'true');
    const mouthFrames = await page.locator('.pfa-assistant .pfa-mouth').evaluate(async el => {
      const frames = [];
      const started = performance.now();
      await new Promise(resolve => {
        function sample() {
          frames.push(getComputedStyle(el).transform);
          if (performance.now() - started < 180) requestAnimationFrame(sample);
          else resolve();
        }
        requestAnimationFrame(sample);
      });
      return frames;
    });
    assert.ok(new Set(mouthFrames).size > 2, 'The mouth moves through intermediate shapes while interacting');
    await assertSpeechFits(page);
    await page.screenshot({ path: path.join(artifacts, 'login-speech-desktop.png') });
    await sayHello.focus();
    await page.keyboard.press('Enter');
    await page.locator('.pfa-gesturing').waitFor();
    assert.match(await page.locator('.pfa-assistant-announcement').textContent(), /Use your account email/);
    await page.waitForFunction(() => document.querySelector('.pfa-login-mascot').dataset.speaking === 'false');
    assert.equal(await page.locator('.pfa-assistant .pfa-mouth').evaluate(el => getComputedStyle(el).animationName), 'none', 'The mouth rests after the brief response');
    assert.equal(await page.locator('.pfa-login-speech').isVisible(), true, 'The speech remains long enough to read after the mouth rests');
    await sayHello.click();
    assert.match(await page.locator('.pfa-login-speech').getAttribute('data-message'), /Use your account email/, 'Tapping the mascot preserves the current message');
    await page.locator('.pfa-login-panel').getByText('JMCFI PostFlow', { exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.pfa-login-mascot').dataset.speaking === 'false');
    assert.equal(mascotLoginRequests, 0, 'Greeting the character never submits the form');
    page.off('request', countMascotRequests);
    // Pupils must respond across the whole page, independently of the body.
    const bodyBefore = await page.locator('.pfa-character').boundingBox();
    await page.mouse.move(1420, 200);
    await page.waitForFunction(() => parseFloat(document.querySelector('.pfa-character').style.getPropertyValue('--gaze-x')) > 5);
    const rightGaze = await page.locator('.pfa-pupils').evaluate(el => getComputedStyle(el).transform);
    await page.mouse.move(20, 700);
    await page.waitForFunction(() => parseFloat(document.querySelector('.pfa-character').style.getPropertyValue('--gaze-x')) < -5);
    const leftGaze = await page.locator('.pfa-pupils').evaluate(el => getComputedStyle(el).transform);
    assert.notEqual(leftGaze, rightGaze, 'The pupils track pointer direction');
    assert.deepEqual(await page.locator('.pfa-character').boundingBox(), bodyBefore, 'Tracking must not move the whole sprite');

    await page.reload();
    await page.getByRole('button', { name: 'Login', exact: true }).waitFor();
    await page.locator('.pfa-login-panel').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    assert.equal(await page.locator('.pfa-intro').count(), 0, 'Refresh skips a completed intro');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('postflow_welcome_seen_v11')), '1', 'The new entrance is remembered after one automatic showing');
    assert.equal(await page.getByRole('button', { name: /skip|replay/i }).count(), 0);

    await assertLabelsSeparated(page);
    const labelFrames = await page.evaluate(async () => {
      const input = document.getElementById('email');
      const label = document.getElementById('postflow-email-label');
      const positions = [label.getBoundingClientRect().top];
      input.focus();
      const start = performance.now();
      await new Promise(resolve => {
        function sample() {
          positions.push(label.getBoundingClientRect().top);
          if (performance.now() - start < 220) requestAnimationFrame(sample);
          else resolve();
        }
        requestAnimationFrame(sample);
      });
      return positions;
    });
    assert.ok(new Set(labelFrames.map(y => Math.round(y))).size > 2, 'The label moves through intermediate positions');
    assert.ok(labelFrames.at(-1) < labelFrames[0] - 5, 'The label animates upward');
    await assertLabelsSeparated(page);
    await page.locator('.pfa-login-panel').getByText('JMCFI PostFlow', { exact: true }).click();
    await assertLabelsSeparated(page);
    // Password managers can fill the DOM before React receives an input event.
    for (const [label, value] of [['Email', 'autofill@example.invalid'], ['Password', 'autofill-test']]) {
      await page.getByLabel(label, { exact: true }).evaluate((el, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
      }, value);
    }
    await assertLabelsSeparated(page);
    await page.screenshot({ path: path.join(artifacts, 'login-autofill.png') });

    await page.getByLabel('Email', { exact: true }).fill('');
    await page.getByLabel('Password', { exact: true }).fill('');
    await page.locator('.pfa-login-panel').getByText('JMCFI PostFlow', { exact: true }).click();
    await assertLabelsSeparated(page);

    let invalidSubmissionRequests = 0;
    const countInvalidRequests = request => { if (new URL(request.url()).pathname === '/api/auth/login') invalidSubmissionRequests++; };
    page.on('request', countInvalidRequests);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByText('Enter your email address.', { exact: true }).waitFor();
    await page.getByText('Enter your password.', { exact: true }).waitFor();
    await page.getByLabel('Email', { exact: true }).fill('rafael');
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByText('Enter a valid email address.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Email', { exact: true }).getAttribute('aria-invalid'), 'true');
    assert.equal(await page.getByLabel('Email', { exact: true }).getAttribute('aria-describedby'), 'postflow-email-error');
    assert.equal(await page.getByLabel('Email', { exact: true }).evaluate(el => el === document.activeElement), true);
    assert.equal(invalidSubmissionRequests, 0, 'Invalid input is corrected before sending a login request');
    page.off('request', countInvalidRequests);
    await page.locator('#postflow-email-error').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    await page.screenshot({ path: path.join(artifacts, 'login-invalid-email-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await assertFits(page);
    await page.screenshot({ path: path.join(artifacts, 'login-invalid-email-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByLabel('Email', { exact: true }).fill('reviewer@example.invalid');
    assert.equal(await page.locator('#postflow-email-error').count(), 0, 'Field feedback clears while correcting the value');
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await assertLabelsSeparated(page);
    await page.locator('.pfa-character.pfa-private').waitFor();
    assert.match(await page.locator('.pfa-login-speech').getAttribute('data-message'), /look away/, 'The bubble acknowledges password privacy');
    await page.waitForFunction(() => document.querySelector('.pfa-login-mascot').dataset.speaking === 'false');
    await page.getByLabel('Password', { exact: true }).press('a');
    assert.equal(await page.locator('.pfa-login-mascot').getAttribute('data-speaking'), 'false', 'Typing does not restart talking when no new character message appears');
    await page.getByLabel('Password', { exact: true }).press('Backspace');
    await page.getByRole('button', { name: 'Show password' }).click();
    assert.equal(await page.getByLabel('Password', { exact: true }).evaluate(el => el.type), 'text');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await assertLabelsSeparated(page);
    await page.route('**/api/auth/login', async route => {
      assert.deepEqual(route.request().postDataJSON(), { email: 'reviewer@example.invalid', password: 'test-password' });
      await route.fulfill({ status: 422, json: { message: 'These credentials do not match our records.' } });
    });
    await page.getByLabel('Password', { exact: true }).press('Enter');
    await page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' }).waitFor();
    assert.equal(await page.getByLabel('Email', { exact: true }).getAttribute('aria-describedby'), 'postflow-login-feedback');
    assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('aria-describedby'), 'postflow-login-feedback');
    assert.equal(await page.locator('.pfa-departing').count(), 0, 'Failed sign-in must leave the form in place');
    assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), '');
    await page.waitForFunction(() => document.activeElement?.id === 'password');
    await page.locator('#postflow-login-feedback').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    await page.screenshot({ path: path.join(artifacts, 'credentials-error-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await assertFits(page);
    await page.screenshot({ path: path.join(artifacts, 'credentials-error-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.unroute('**/api/auth/login');
    await page.route('**/api/auth/login', route => route.abort('connectionfailed'));
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Unable to connect. Check your connection and try again.' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Login', exact: true }).isEnabled(), true, 'A connection failure must allow retry');
    await page.unroute('**/api/auth/login');
    await page.route('**/api/auth/login', route => route.fulfill({ status: 429, json: { retry_after: 2, message: 'Too many attempts.' } }));
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByRole('button', { name: /Try again in/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Try again in/ }).isDisabled(), true);
    await page.getByRole('button', { name: 'Login', exact: true }).waitFor({ timeout: 5000 });
    await page.unroute('**/api/auth/login');
    const user = { id: 1, name: 'Startup Test', email: 'reviewer@example.invalid', role: 'admin', roles: ['it_admin'] };
    let releaseLogin;
    const loginGate = new Promise(resolve => { releaseLogin = resolve; });
    let loginRequests = 0;
    await page.route('**/api/**', async route => {
      const endpoint = new URL(route.request().url()).pathname;
      if (endpoint === '/api/auth/login') {
        loginRequests++;
        await loginGate;
      }
      const json = endpoint === '/api/auth/login' ? { token: 'startup-test', user }
        : endpoint === '/api/auth/user' ? { user }
        : endpoint === '/api/dashboard/init' ? { stats: {}, posts: { data: [] }, activities: [] }
        : endpoint === '/api/notifications' ? { notifications: [], unread_count: 0 } : { data: [] };
      return route.fulfill({ json });
    });
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    const cardBeforeSignIn = await page.locator('.pfa-login-panel').boundingBox();
    await page.evaluate(() => {
      const samples = window.__postflowHandoff = { seen: false, ariaHidden: null, hasForm: null, opacities: [], removed: false };
      const observer = new MutationObserver(() => {
        const overlay = document.querySelector('[data-postflow-handoff]');
        if (!overlay || samples.seen) return;
        samples.seen = true;
        samples.ariaHidden = overlay.getAttribute('aria-hidden');
        samples.hasForm = !!overlay.querySelector('input, .pfa-login-panel, .pfa-character');
        function sample() {
          if (!overlay.isConnected) { samples.removed = true; observer.disconnect(); return; }
          samples.opacities.push(Number(getComputedStyle(overlay).opacity));
          requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      observer.observe(document.body, { childList: true });
    });
    const requestStarted = page.waitForRequest('**/api/auth/login');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await requestStarted;
    assert.equal(await page.getByRole('button', { name: 'Signing in...' }).isDisabled(), true);
    assert.equal(await page.locator('.pfa-departing').count(), 0, 'The push waits for a successful server response');
    await page.getByLabel('Password', { exact: true }).press('Enter');
    releaseLogin();
    await page.locator('.pfa-departing').waitFor();
    assert.equal(await page.getByText(/Opening (your )?dashboard/i).count(), 0, 'Successful sign-in has no opening-dashboard message');
    assert.ok(new URL(page.url()).pathname.includes('login'), 'The auth guard must allow the animation to finish');
    const pushMotion = await page.evaluate(async () => {
      const card = document.querySelector('.pfa-login-panel');
      const bot = document.querySelector('.pfa-assistant .pfa-character');
      const contactGaps = [];
      const gripGaps = [];
      const secondGripGaps = [];
      const gripSpans = [];
      const gripInsets = [];
      const poses = new Set();
      const capeFrames = new Set();
      let maxCapeGap = 0;
      const start = performance.now();
      return new Promise(resolve => {
        function sample() {
          const cardBounds = card.getBoundingClientRect();
          const cardLeft = cardBounds.left;
          const botLeft = bot.getBoundingClientRect().left;
          poses.add(getComputedStyle(bot.querySelector('.pfa-push-arm')).transform);
          capeFrames.add(getComputedStyle(bot.querySelector('.pfa-cape')).transform);
          const capeRoot = bot.querySelector('.pfa-cape-root-anchor');
          const bodyRoot = bot.querySelector('.pfa-cape-body-anchor');
          const point = node => new DOMPoint(node.cx.baseVal.value, node.cy.baseVal.value).matrixTransform(node.getScreenCTM());
          const fabric = point(capeRoot), shoulder = point(bodyRoot);
          maxCapeGap = Math.max(maxCapeGap, Math.hypot(fabric.x - shoulder.x, fabric.y - shoulder.y));
          const cargoMotion = document.querySelector('.pfa-login-group').getAnimations().find(animation => animation.animationName === 'pfa-card-depart');
          if (cargoMotion?.effect.getComputedTiming().progress > .48) {
            contactGaps.push(cardLeft - botLeft);
            const hand = point(bot.querySelector('.pfa-grip-anchor'));
            const secondHand = point(bot.querySelector('.pfa-second-grip-anchor'));
            gripGaps.push(hand.x - cardLeft);
            secondGripGaps.push(secondHand.x - cardLeft);
            gripSpans.push(hand.y - secondHand.y);
            gripInsets.push(Math.min(hand.y - cardBounds.top, cardBounds.bottom - hand.y, secondHand.y - cardBounds.top, cardBounds.bottom - secondHand.y));
          }
          if (performance.now() - start > 1250) resolve({ cardLeft, contactGaps, gripGaps, secondGripGaps, gripSpans, gripInsets, maxCapeGap, poses: poses.size, capeFrames: capeFrames.size });
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
    });
    assert.ok(pushMotion.cardLeft > cardBeforeSignIn.x + 12, 'The card visibly moves before navigation');
    assert.ok(pushMotion.contactGaps.length > 3, 'The push has several visible frames of contact');
    assert.ok(pushMotion.poses > 10, 'The reaching arm changes pose during flight');
    assert.ok(pushMotion.capeFrames > 10, 'The cape keeps flowing independently during flight and contact');
    assert.ok(pushMotion.maxCapeGap < .5, 'The cape remains attached while the character pushes the card');
    assert.ok(Math.max(...pushMotion.contactGaps) - Math.min(...pushMotion.contactGaps) < 1.5, 'The character and card move together throughout the push');
    assert.ok(pushMotion.gripGaps.every(gap => Math.abs(gap - 2) < 1.5), 'The first glove stays on the left side during the forward push');
    assert.ok(pushMotion.secondGripGaps.every(gap => Math.abs(gap - 2) < 1.5), 'The second glove stays on the left side during the forward push');
    assert.ok(pushMotion.gripSpans.every(span => span > 20 && span < cardBeforeSignIn.height - 40), 'Both hands hold vertically separated points within the card side');
    assert.ok(pushMotion.gripInsets.every(inset => inset > 20), 'Both hands grip the side, clear of the top and bottom corners');
    await page.screenshot({ path: path.join(artifacts, 'sign-in-push-desktop.png') });
    await page.waitForURL('**/dashboard/it-admin');
    await page.waitForFunction(() => window.__postflowHandoff.removed);
    const handoff = await page.evaluate(() => window.__postflowHandoff);
    assert.equal(handoff.seen, true, 'The campus remains visible across the route change');
    assert.equal(handoff.ariaHidden, 'true', 'The crossfade does not duplicate accessible content');
    assert.equal(handoff.hasForm, false, 'The reveal carries only the campus backdrop');
    assert.ok(handoff.opacities.some(opacity => opacity > 0 && opacity < 1), 'The dashboard reveal contains intermediate crossfade frames');
    assert.equal(loginRequests, 1, 'Repeat submission while signing in must not create a second login request');
    assert.equal(await page.locator('.pfa-intro').count(), 0, 'Successful login reaches the existing dashboard');
    const launcher = page.getByRole('button', { name: 'Open PostFlow assistant', exact: true });
    await launcher.waitFor({ state: 'visible' });
    await page.locator('.pf-bot .pfa-bot-base').evaluate(img => img.decode());
    await page.mouse.move(20, 40);
    await page.waitForFunction(() => parseFloat(document.querySelector('.pf-bot .pfa-character').style.getPropertyValue('--gaze-x')) < -10);
    await page.mouse.move(1430, 890);
    await page.waitForFunction(() => parseFloat(document.querySelector('.pf-bot .pfa-character').style.getPropertyValue('--gaze-x')) > 0);
    assert.equal(await page.locator('.pf-bot .pfa-pupils ellipse').count(), 2, 'Chatbot uses the same independent pupils as login');
    assert.equal(await page.locator('.pf-eye-blink, .pf-mouth-sprite').count(), 0, 'Old face sprites cannot cover the tracking eyes');
    await page.screenshot({ path: path.join(artifacts, 'dashboard-character.png') });
    await launcher.hover();
    const greetingButton = page.getByRole('button', { name: 'Chat with PostFlow', exact: true });
    await greetingButton.waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(artifacts, 'chatbot-greeting-refined.png') });
    await greetingButton.click();
    await page.getByRole('dialog', { name: 'PostFlow Assistant', exact: true }).waitFor({ state: 'visible' });
    await greetingButton.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.pf-avatar .pfa-face').count(), 1, 'Chat header uses the matching face');
    assert.equal(await page.getByRole('button', { name: 'Send message', exact: true }).isDisabled(), true, 'Empty messages cannot be sent');
    await page.screenshot({ path: path.join(artifacts, 'chatbot-panel-desktop.png') });
    await page.locator('.pf-assistant').evaluate(el => el.classList.add('pf-dark'));
    await page.screenshot({ path: path.join(artifacts, 'chatbot-panel-dark.png') });
    await page.locator('.pf-assistant').evaluate(el => el.classList.remove('pf-dark'));
    let releaseChat;
    let chatRequests = 0;
    const chatGate = new Promise(resolve => { releaseChat = resolve; });
    await page.route('**/api/chatbot/message', async route => {
      chatRequests++;
      await chatGate;
      return route.fulfill({ json: { reply: 'Your requests are available in the dashboard.' } });
    });
    await page.getByLabel('Type your message').fill('Where can I find my requests?');
    await page.getByLabel('Type your message').press('Shift+Enter');
    await page.getByLabel('Type your message').pressSequentially('Please explain.');
    assert.ok((await page.getByLabel('Type your message').inputValue()).includes('\n'), 'Shift+Enter keeps a new line');
    assert.ok((await page.getByLabel('Type your message').boundingBox()).height > 44, 'Composer grows for longer messages');
    const chatStarted = page.waitForRequest('**/api/chatbot/message');
    await page.getByLabel('Type your message').press('Enter');
    await chatStarted;
    assert.equal(await page.getByRole('button', { name: 'Send message', exact: true }).isDisabled(), true, 'Sending prevents duplicate requests');
    await page.getByLabel('Type your message').fill('A draft for my next question');
    await page.getByLabel('Type your message').press('Enter');
    releaseChat();
    await page.getByText('Your requests are available in the dashboard.', { exact: true }).waitFor();
    assert.equal(chatRequests, 1, 'Enter while busy does not send a second request');
    assert.equal(await page.getByLabel('Type your message').inputValue(), 'A draft for my next question', 'A reply preserves the next message draft');
    await page.getByLabel('Type your message').fill('   ');
    assert.equal(await page.getByRole('button', { name: 'Send message', exact: true }).isDisabled(), true, 'Whitespace cannot be sent');
    await page.getByRole('button', { name: 'Close chat', exact: true }).click();
    const beforeDrag = await launcher.boundingBox();
    await page.mouse.move(beforeDrag.x + 42, beforeDrag.y + 48);
    await page.mouse.down();
    await page.mouse.move(beforeDrag.x - 100, beforeDrag.y - 60, { steps: 12 });
    assert.equal(await page.locator('.pf-bot .pfa-drag-hand').isVisible(), true, 'Dragging the chatbot also uses a closed glove');
    assert.equal(await page.locator('.pf-bot img.pfa-bot-hand').evaluate(el => getComputedStyle(el).visibility), 'hidden');
    await page.waitForFunction(() => {
      const cape = document.querySelector('.pf-bot .pfa-cape-response');
      return new DOMMatrix(getComputedStyle(cape).transform).b > .05;
    });
    const flyingCape = await page.locator('.pf-bot .pfa-cape').evaluate(el => getComputedStyle(el).transform);
    await page.waitForFunction(previous => getComputedStyle(document.querySelector('.pf-bot .pfa-cape')).transform !== previous, flyingCape);
    await page.mouse.move(beforeDrag.x - 30, beforeDrag.y - 30, { steps: 8 });
    await page.waitForFunction(() => {
      const cape = document.querySelector('.pf-bot .pfa-cape-response');
      return new DOMMatrix(getComputedStyle(cape).transform).b < -.03;
    });
    await page.screenshot({ path: path.join(artifacts, 'chatbot-cape-drag.png') });
    await page.mouse.up();
    assert.ok((await launcher.boundingBox()).x < beforeDrag.x - 20, 'The shared character remains draggable');
    await page.waitForFunction(() => {
      const transform = new DOMMatrix(getComputedStyle(document.querySelector('.pf-bot .pfa-cape-response')).transform);
      return Math.abs(transform.a - 1) < .005 && Math.abs(transform.b) < .005 && Math.abs(transform.c) < .005;
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.mouse.move(20, 40);
    assert.equal(await page.locator('.pf-bot .pfa-pupils').evaluate(el => getComputedStyle(el).transform), 'none', 'Dashboard eyes respect reduced motion');
    assert.equal(await page.locator('.pf-bot .pfa-cape-response').evaluate(el => getComputedStyle(el).transform), 'none', 'Cape response respects reduced motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(base);
    await page.waitForURL('**/dashboard/it-admin');
    assert.equal(await page.locator('[data-postflow-handoff]').count(), 0, 'Restoring a session does not replay the sign-in reveal');
    assert.equal(await page.locator('.pfa-intro').count(), 0, 'Authenticated visits bypass welcome and login');
    await page.getByRole('button', { name: 'Open PostFlow assistant', exact: true }).click();
    const topicRequest = page.waitForRequest('**/api/chatbot/message');
    await page.getByRole('button', { name: 'System health', exact: true }).click();
    const topicPayload = (await topicRequest).postDataJSON();
    assert.equal(topicPayload.messages.at(-1).content, 'System health & publishing status', 'Topic cards send the selected question');
    await context.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobile.newPage();
    mobilePage.on('pageerror', error => errors.push(error.message));
    await mobilePage.goto(`${base}/login`);
    await mobilePage.locator('.pfa-intro').waitFor();
    await mobilePage.locator('.pfa-startup-actor .pfa-bot-base').evaluate(img => img.decode());
    await mobilePage.locator('.pfa-startup-actor .pfa-character-motion').evaluate(el => Promise.all(el.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished)));
    await mobilePage.screenshot({ path: path.join(artifacts, 'welcome-mobile.png') });
    await mobilePage.locator('.pfa-intro').waitFor({ state: 'detached' });
    await assertFits(mobilePage);
    await mobilePage.locator('.pfa-login-panel').getByLabel('Jose Maria College logo').waitFor();
    await mobilePage.screenshot({ path: path.join(artifacts, 'login-mobile.png'), fullPage: true });
    await mobilePage.locator('.pfa-speech-visible').waitFor();
    await mobilePage.waitForFunction(() => document.querySelector('.pfa-login-mascot').dataset.speaking === 'false');
    await mobilePage.getByRole('button', { name: 'Say hello to PostFlow', exact: true }).tap();
    assert.equal(await mobilePage.locator('.pfa-login-mascot').getAttribute('data-speaking'), 'false', 'Touch greetings preserve the visible message without extra talking');
    await assertSpeechFits(mobilePage);
    await mobilePage.screenshot({ path: path.join(artifacts, 'login-speech-mobile.png'), fullPage: true });
    await mobilePage.setViewportSize({ width: 320, height: 568 });
    await assertFits(mobilePage);
    await assertSpeechFits(mobilePage);
    await mobilePage.screenshot({ path: path.join(artifacts, 'login-speech-compact.png'), fullPage: true });
    assert.equal((await mobilePage.locator('#postflow-login-logo').boundingBox()).width, 52, 'Short screens use a slightly smaller logo');
    await mobilePage.getByLabel('Email', { exact: true }).fill('mobile@example.invalid');
    await mobilePage.getByLabel('Password', { exact: true }).fill('mobile-test');
    await assertLabelsSeparated(mobilePage);
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    await mobilePage.route('**/api/**', route => {
      const endpoint = new URL(route.request().url()).pathname;
      return route.fulfill({ json: endpoint === '/api/auth/login' ? { token: 'mobile-sign-in-test', user }
        : endpoint === '/api/auth/user' ? { user }
        : endpoint === '/api/dashboard/init' ? { stats: {}, posts: { data: [] }, activities: [] }
        : endpoint === '/api/notifications' ? { notifications: [], unread_count: 0 } : { data: [] } });
    });
    await mobilePage.getByRole('button', { name: 'Login', exact: true }).click();
    await mobilePage.locator('.pfa-departing').waitFor();
    assert.equal(await mobilePage.locator('.pfa-character-trigger').isDisabled(), true, 'The greeting cannot interrupt the sign-in flight');
    assert.equal(await mobilePage.locator('.pfa-login-speech').isVisible(), false, 'The speech clears for the sign-in flight');
    await mobilePage.waitForFunction(() => document.querySelector('.pfa-login-group').getAnimations().some(animation => animation.animationName === 'pfa-card-depart' && animation.effect.getComputedTiming().progress > .55));
    assert.ok((await mobilePage.locator('.pfa-assistant .pfa-character').boundingBox()).x >= 0, 'The pushing character stays visible on mobile');
    const mobileGripGaps = await mobilePage.locator('.pfa-root').evaluate(root => {
      const card = root.querySelector('.pfa-login-panel').getBoundingClientRect();
      return ['.pfa-grip-anchor', '.pfa-second-grip-anchor'].map(selector => {
        const anchor = root.querySelector(selector);
        const hand = new DOMPoint(anchor.cx.baseVal.value, anchor.cy.baseVal.value).matrixTransform(anchor.getScreenCTM());
        return hand.x - card.left;
      });
    });
    assert.ok(mobileGripGaps.every(gap => Math.abs(gap - 2) < 1.5), 'On mobile both gloves push from the left side of the card');
    await mobilePage.screenshot({ path: path.join(artifacts, 'sign-in-push-mobile.png') });
    await mobilePage.waitForURL('**/dashboard/it-admin');
    await mobilePage.locator('[data-postflow-handoff]').waitFor({ state: 'detached' });
    const touchLauncher = mobilePage.getByRole('button', { name: 'Open PostFlow assistant', exact: true });
    await touchLauncher.waitFor({ state: 'visible' });
    await touchLauncher.click();
    await mobilePage.getByRole('dialog', { name: 'PostFlow Assistant', exact: true }).waitFor({ state: 'visible' });
    await mobilePage.setViewportSize({ width: 320, height: 568 });
    await mobilePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const mobileChatBounds = await mobilePage.locator('.pf-panel').boundingBox();
    assert.ok(mobileChatBounds.x >= 10 && mobileChatBounds.x + mobileChatBounds.width <= 310, `Chat panel fits a narrow phone: ${JSON.stringify(mobileChatBounds)}`);
    assert.ok(mobileChatBounds.y >= 10 && mobileChatBounds.y + mobileChatBounds.height <= 558, 'Chat stays inside the visible screen');
    await mobilePage.screenshot({ path: path.join(artifacts, 'chatbot-panel-mobile.png') });
    await mobilePage.setViewportSize({ width: 320, height: 420 });
    assert.equal(await mobilePage.getByLabel('Type your message').isVisible(), true, 'Composer remains available on short screens');
    await mobilePage.getByRole('button', { name: 'Close chat', exact: true }).click();
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    const touchBounds = await touchLauncher.boundingBox();
    const touchSession = await mobile.newCDPSession(mobilePage);
    const touchX = touchBounds.x + 42;
    const touchY = touchBounds.y + 48;
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
    for (let step = 1; step <= 10; step++) {
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX - step * 12, y: touchY - step * 5 }] });
    }
    await mobilePage.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('.pf-bot .pfa-cape-response')).transform).b > .05);
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok((await touchLauncher.boundingBox()).x < touchBounds.x - 80, 'Touch dragging also moves the chatbot and its cape');
    await touchSession.detach();
    await mobile.close();

    const reduced = await browser.newContext({ reducedMotion: 'reduce' });
    const reducedPage = await reduced.newPage();
    await reducedPage.goto(base);
    await reducedPage.locator('.pfa-login-shell').waitFor();
    await reducedPage.locator('.pfa-intro').waitFor({ state: 'detached', timeout: 3000 });
    await reducedPage.locator('.pfa-speech-visible').waitFor();
    await reducedPage.getByRole('button', { name: 'Say hello to PostFlow', exact: true }).click();
    assert.match(await reducedPage.locator('.pfa-assistant-announcement').textContent(), /Hello!/);
    await assertSpeechFits(reducedPage);
    assert.equal(await reducedPage.locator('.pfa-assistant .pfa-mouth').evaluate(el => getComputedStyle(el).animationName), 'none', 'Reduced motion keeps the greeting available without mouth animation');
    await reducedPage.getByLabel('Email', { exact: true }).fill('keyboard@example.invalid');
    await reducedPage.mouse.move(1200, 300);
    assert.equal(await reducedPage.locator('.pfa-pupils').evaluate(el => getComputedStyle(el).transform), 'none', 'Reduced motion keeps eyes neutral');
    await reducedPage.keyboard.press('Tab');
    assert.equal(await reducedPage.getByLabel('Password', { exact: true }).evaluate(el => el === document.activeElement), true);
    await reducedPage.route('**/api/**', route => {
      const endpoint = new URL(route.request().url()).pathname;
      return route.fulfill({ json: endpoint === '/api/auth/login' ? { token: 'reduced-motion-test', user }
        : endpoint === '/api/auth/user' ? { user }
        : endpoint === '/api/dashboard/init' ? { stats: {}, posts: { data: [] }, activities: [] }
        : endpoint === '/api/notifications' ? { notifications: [], unread_count: 0 } : { data: [] } });
    });
    await reducedPage.getByLabel('Password', { exact: true }).fill('reduced-motion-test');
    await reducedPage.getByRole('button', { name: 'Login', exact: true }).click();
    await reducedPage.waitForURL('**/dashboard/it-admin', { timeout: 3000 });
    assert.equal(await reducedPage.locator('[data-postflow-handoff]').count(), 0, 'Reduced motion bypasses the dashboard crossfade');
    await reduced.close();

    const disabledAnimation = await browser.newContext();
    await disabledAnimation.addInitScript(() => {
      sessionStorage.setItem('postflow_welcome_seen_v11', '1');
      sessionStorage.setItem('postflow_intended_url', '/dashboard/it-admin?source=notification');
    });
    const fallbackPage = await disabledAnimation.newPage();
    fallbackPage.on('pageerror', error => errors.push(error.message));
    await fallbackPage.route('**/api/**', route => {
      const endpoint = new URL(route.request().url()).pathname;
      return route.fulfill({ json: endpoint === '/api/auth/login' ? { token: 'animation-fallback-test', user }
        : endpoint === '/api/auth/user' ? { user }
        : endpoint === '/api/dashboard/init' ? { stats: {}, posts: { data: [] }, activities: [] }
        : endpoint === '/api/notifications' ? { notifications: [], unread_count: 0 } : { data: [] } });
    });
    await fallbackPage.goto(base);
    await fallbackPage.getByLabel('Email', { exact: true }).fill('fallback@example.invalid');
    await fallbackPage.addStyleTag({ content: '.pfa-root * { animation: none !important; transition: none !important; }' });
    await fallbackPage.getByLabel('Password', { exact: true }).fill('fallback-test');
    await fallbackPage.getByRole('button', { name: 'Login', exact: true }).click();
    await fallbackPage.waitForURL(url => url.pathname === '/dashboard/it-admin' && url.searchParams.get('source') === 'notification', { timeout: 4000 });
    await disabledAnimation.close();

    const compactIntro = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
    const compactPage = await compactIntro.newPage();
    compactPage.on('pageerror', error => errors.push(error.message));
    await compactPage.goto(`${base}/login`);
    await compactPage.locator('.pfa-intro').waitFor();
    await compactPage.locator('.pfa-startup-actor .pfa-character-motion').evaluate(el => Promise.all(el.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished)));
    const compactHeader = await compactPage.locator('.pfa-intro .pfa-topbar').boundingBox();
    const compactCharacter = await compactPage.locator('.pfa-intro-character').boundingBox();
    const compactTitle = await compactPage.locator('.pfa-intro-wordmark').boundingBox();
    const compactSchool = await compactPage.locator('.pfa-intro-school').boundingBox();
    assert.ok(compactCharacter.y > compactHeader.y + compactHeader.height + 12, 'The startup character clears the mobile brand header');
    assert.ok(compactTitle.x >= 12 && compactTitle.x + compactTitle.width <= 308, 'The whole wordmark fits a narrow phone');
    assert.ok(compactSchool.y > compactTitle.y + compactTitle.height + 16, 'The school name stays clear of the intro content');
    await compactPage.screenshot({ path: path.join(artifacts, 'welcome-compact-mobile.png') });
    await compactPage.locator('.pfa-intro').waitFor({ state: 'detached' });
    await assertFits(compactPage);
    await compactIntro.close();

    const blockedStorage = await browser.newContext();
    await blockedStorage.addInitScript(() => {
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = function(key) {
        if (key.startsWith('postflow_welcome')) throw new DOMException('Unavailable', 'SecurityError');
        return original.call(this, key);
      };
    });
    const storagePage = await blockedStorage.newPage();
    await storagePage.goto(base);
    await storagePage.locator('.pfa-intro').waitFor();
    await storagePage.locator('.pfa-intro').waitFor({ state: 'detached' });
    await blockedStorage.close();
    assert.deepEqual(errors, []);
    console.log('PASS: startup, floating labels/autofill, shared character and chatbot cursor tracking/chat/drag, synchronized desktop/mobile sign-in push, errors/lockout, duplicate submission prevention, reduced motion, disabled-animation fallback, intended links and authenticated redirects.');
    console.log(`Screenshots: ${artifacts}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
