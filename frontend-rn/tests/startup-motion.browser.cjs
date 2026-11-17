const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { createWebServer } = require('../scripts/serve-web.cjs');
const server = createWebServer();
const artifacts = path.resolve(__dirname, '../.expo/startup-qa');
fs.mkdirSync(artifacts, { recursive: true });

async function seek(page, time) {
  await page.locator('.pfa-root').evaluate(async (root, time) => {
    for (const animation of root.getAnimations({ subtree: true })) {
      animation.pause();
      animation.currentTime = time;
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, time);
}

async function assertCapeAttached(page) {
  const gap = await page.locator('.pfa-assistant .pfa-character').evaluate(bot => {
    const fabric = bot.querySelector('.pfa-cape-root-anchor');
    const body = bot.querySelector('.pfa-cape-body-anchor');
    const point = node => new DOMPoint(node.cx.baseVal.value, node.cy.baseVal.value).matrixTransform(node.getScreenCTM());
    const a = point(fabric), b = point(body);
    return Math.hypot(a.x - b.x, a.y - b.y);
  });
  assert.ok(gap < .5, 'Moving fabric stays attached to its shoulder in screen coordinates');
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.POSTFLOW_BROWSER_CHANNEL || 'msedge' });
  try {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(() => {
        const schedule = window.setTimeout;
        window.setTimeout = (callback, delay, ...args) => {
          if (delay === 3500) { window.__dockStart = () => callback(...args); return schedule(() => {}, 60000); }
          if (delay === 950) { window.__dockFinish = () => callback(...args); return schedule(() => {}, 60000); }
          return schedule(callback, delay, ...args);
        };
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/login`);
      await page.locator('.pfa-intro').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.pfa-startup-actor .pfa-bot-base').evaluate(img => img.decode());
      const frames = [];
      const fabricShapes = [];
      for (const time of [200, 1550, 2200, 3400]) {
        await seek(page, time);
        await assertCapeAttached(page);
        fabricShapes.push(await page.locator('.pfa-cape-cloth').getAttribute('d'));
        frames.push(await page.locator('.pfa-root').evaluate(intro => Object.fromEntries(
          ['.pfa-character-motion', '.pfa-character-pose', '.pfa-spine', '.pfa-head-rig', '.pfa-chest-rig', '.pfa-base-rig', '.pfa-flight-front-arm', '.pfa-forearm', '.pfa-flight-arm', '.pfa-wave-forearm', '.pfa-bot-hand', '.pfa-eye-direction'].map(selector => {
            const style = getComputedStyle(intro.querySelector(selector));
            const matrix = style.transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(style.transform);
            return [selector, { transform: style.transform, angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI }];
          }))));
        assert.equal(await page.locator('.pfa-arrival-rest').count(), 0, 'No second body is mounted during the entrance');
        await page.screenshot({ path: path.join(artifacts, `arrival-${viewport.width}-${time}.png`) });
      }
      for (const joint of ['.pfa-spine', '.pfa-chest-rig', '.pfa-base-rig', '.pfa-flight-front-arm', '.pfa-forearm', '.pfa-eye-direction']) {
        assert.ok(frames.every(frame => frame[joint].transform === 'none'), `${joint} stays composed instead of fidgeting`);
      }
      const limits = { '.pfa-character-pose': 3.05, '.pfa-head-rig': 2.05, '.pfa-flight-arm': 3.05, '.pfa-wave-forearm': 6.05, '.pfa-bot-hand': 8.05 };
      for (const [joint, limit] of Object.entries(limits)) {
        const angles = frames.map(frame => Math.abs(frame[joint].angle));
        assert.ok(angles.every(angle => angle <= limit), `${joint} stays within a restrained gesture range`);
        assert.ok(angles.some(angle => angle > .2), `${joint} makes a small intentional greeting`);
        assert.ok(angles.slice(2).every(angle => angle < .001), `${joint} holds neutral after the greeting`);
      }
      assert.equal(frames[2]['.pfa-character-motion'].transform, frames[3]['.pfa-character-motion'].transform, 'The entrance settles without continuing to bob');
      for (const shape of fabricShapes) {
        const points = shape.match(/-?\d+(?:\.\d+)?/g).map(Number);
        assert.ok(Math.abs(points[12] - 810) < 8 && Math.abs(points[13] - 659) < 5, 'Cape-tip movement remains subtle');
      }
      assert.ok(new Set(fabricShapes).size > 2, 'Cape fabric bends along its length instead of moving as one flat piece');
      assert.equal(await page.locator('.pfa-intro-paper').count(), 0, 'The character has a clear silhouette without wireframe cards');
      assert.equal(await page.locator('.pfa-mouth').evaluate(el => getComputedStyle(el).animationName), 'none', 'Startup gestures do not make the mouth talk without text');
      await page.mouse.move(8, 120);
      await page.waitForTimeout(160);
      const leftGaze = await page.locator('.pfa-pupils').evaluate(el => getComputedStyle(el).transform);
      await page.mouse.move(viewport.width - 8, 120);
      await page.waitForTimeout(160);
      assert.notEqual(await page.locator('.pfa-pupils').evaluate(el => getComputedStyle(el).transform), leftGaze, 'The startup character notices the cursor while greeting');
      assert.equal(await page.locator('.pfa-head-look').evaluate(el => getComputedStyle(el).transform), 'none', 'Only the eyes follow the cursor, without repeated head turns');
      const settled = await page.locator('.pfa-startup-actor .pfa-character').boundingBox();
      const title = await page.locator('.pfa-intro-wordmark').boundingBox();
      const header = await page.locator('.pfa-intro .pfa-topbar').boundingBox();
      if (viewport.width <= 700) {
        assert.ok(settled.y >= header.y + header.height, 'The character clears the mobile header');
        assert.ok(settled.y + settled.height <= title.y, 'The settled character clears the wordmark');
      }

      await page.evaluate(() => window.__dockStart());
      await page.locator('.pfa-intro-leaving').waitFor();
      await page.evaluate(() => { window.__startupActor = document.querySelector('.pfa-assistant .pfa-character'); });
      for (const time of [0, 200, 450, 740, 760, 790, 820, 850, 880, 910, 940]) {
        await seek(page, time);
        await assertCapeAttached(page);
        const solid = await page.locator('.pfa-root').evaluate(root => ['.pfa-torso-art', '.pfa-head-art', '.pfa-arms-art'].every(selector => +getComputedStyle(root.querySelector(selector)).opacity === 1));
        assert.equal(solid, true, 'All body parts remain opaque throughout landing');
        assert.equal(await page.locator('.pfa-character').count(), 1, 'There is only one actor throughout landing');
        assert.equal(await page.locator('.pfa-root').evaluate(root => ['.pfa-character-pose', '.pfa-head-rig', '.pfa-flight-arm', '.pfa-wave-forearm', '.pfa-bot-hand'].every(selector => getComputedStyle(root.querySelector(selector)).transform === 'none')), true, 'The character glides into login with its joints held still');
      }
      for (const time of [0, 450, 750, 850, 950]) {
        await seek(page, time);
        await page.screenshot({ path: path.join(artifacts, `dock-${viewport.width}-${time}.png`) });
      }
      const docked = await page.locator('.pfa-startup-actor .pfa-character').boundingBox();
      const target = await page.locator('.pfa-assistant').boundingBox();
      for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(docked[key] - target[key]) < 1, `Docking meets the login slot ${key} without a snap`);
      await page.evaluate(() => window.__dockFinish());
      await page.locator('.pfa-intro').waitFor({ state: 'detached' });
      const idle = await page.locator('.pfa-assistant .pfa-character').boundingBox();
      await assertCapeAttached(page);
      assert.equal(await page.evaluate(() => window.__startupActor === document.querySelector('.pfa-assistant .pfa-character')), true, 'Startup and login keep the same DOM actor');
      for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(idle[key] - docked[key]) < 1, `The login avatar preserves the final docked ${key}`);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !document.querySelector('.pfa-cape-cloth').getAttribute('d').includes('.'));
      const stillFabric = await page.locator('.pfa-cape-cloth').getAttribute('d');
      await page.waitForTimeout(120);
      assert.equal(await page.locator('.pfa-cape-cloth').getAttribute('d'), stillFabric, 'Reduced motion stops the cloth simulation');
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: one restrained greeting, steady torso/right arm, settled entrance, subtle attached cape, composed docking, cursor gaze and reduced motion at desktop/phone/compact sizes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
