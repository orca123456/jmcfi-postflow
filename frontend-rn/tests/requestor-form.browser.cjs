const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createWebServer } = require('../scripts/serve-web.cjs');
const { createSession, capture, errors, mutations } = require('./requestor-overview.browser.cjs');

async function run() {
  const server = createWebServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.POSTFLOW_BROWSER_CHANNEL || 'msedge' });
  try {
    for (const width of [320, 1440]) {
      const { page, context } = await createSession(browser, base, { viewport: { width, height: 900 } });
      await page.goto(`${base}/dashboard/requestor?tab=modern-workspace&view=modern`);
      const form = page.locator('#requestor-imc-workspace');
      const title = page.getByRole('textbox', { name: 'Request title, required', exact: true });
      await title.waitFor();
      await form.getByText(/^Example: The JMCFI Student Council/).waitFor();
      await page.locator('#imc-content-preview').waitFor();
      assert.equal(await form.getByRole('button', { name: /(?:Show|Hide) (?:preview|example)/i }).count(), 0, 'Example and preview are always visible');
      const submit = page.getByRole('button', { name: 'Submit request to IMC', exact: true });
      await submit.click();
      assert.equal(await title.getAttribute('aria-invalid'), 'true', 'Missing title is explained at its field');
      assert.equal(await title.evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'Input focus has one clean border');
      assert.equal(await title.evaluate(el => getComputedStyle(el).borderTopColor), 'rgb(185, 28, 28)', 'Invalid title keeps its field-level error border');
      assert.equal(await title.evaluate(el => el === document.activeElement), true, 'Invalid submit focuses the first field');
      assert.ok(await form.getByRole('alert').count(), 'Missing content has inline feedback');
      assert.deepEqual(mutations, [], 'Invalid form never uploads');
      await capture(page, `form-validation-${width}`);
      await title.fill('Student research forum');
      const caption = form.locator('[contenteditable="true"]').first();
      await caption.fill('Students are invited to the research forum at the JMCFI auditorium.');
      const facebook = page.getByRole('checkbox', { name: 'Publish to Facebook', exact: true });
      if (await facebook.getAttribute('aria-checked') !== 'true') await facebook.click();
      await page.getByText(/Ready for IMC review/i).waitFor();
      assert.notEqual(await title.getAttribute('aria-invalid'), 'true');
      const guide = form.getByText('Include who is involved, what is happening, when and where it takes place, and why it matters.', { exact: true }).locator('..');
      assert.equal(await guide.evaluate(el => getComputedStyle(el).borderLeftWidth), '0px', 'Caption guidance has no vertical line');
      let finishPolicy;
      const policyGate = new Promise(resolve => { finishPolicy = resolve; });
      await page.route('**/api/posts/ai-check-draft', async route => {
        await policyGate;
        await route.fulfill({ json: { data: { compliance_score: 92, overall_status: 'compliant', analysis_logic: 'Read-only preview policy result.', checks: {} } } });
      });
      await page.getByRole('button', { name: 'Check policy alignment with AI', exact: true }).click();
      const busyPolicy = page.getByRole('button', { name: 'Checking policy alignment', exact: true });
      await busyPolicy.waitFor();
      assert.equal(await busyPolicy.getAttribute('aria-busy'), 'true');
      assert.equal(await busyPolicy.isDisabled(), true);
      const policyBox = await busyPolicy.boundingBox();
      assert.ok(policyBox.x >= 0 && policyBox.x + policyBox.width <= width + 1);
      await capture(page, `policy-action-${width}`);
      finishPolicy();
      await page.locator('[role="dialog"][aria-modal="true"]').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Check policy alignment with AI', exact: true }).waitFor();
      assert.ok(await form.getByText('Students are invited to the research forum at the JMCFI auditorium.', { exact: true }).count() >= 2, 'Preview contains the actual caption');
      await capture(page, `form-ready-${width}`);
      const overflow = await form.evaluate(root => [...root.querySelectorAll('input, [contenteditable="true"], [role="button"], [role="checkbox"]')].filter(el => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.left < -1 || b.right > innerWidth + 1);
      }).map(el => el.getAttribute('aria-label') || el.textContent.slice(0, 40)));
      assert.deepEqual(overflow, [], 'Controls fit the viewport');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      if (await title.count()) assert.equal(await title.inputValue(), '', 'Cancel clears the form');
      await context.close();
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(mutations, []);
    console.log('PASS: always-visible example/live preview, inline validation/focus, readiness, responsive controls and reset; zero API writes.');
  } finally { await browser.close(); server.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
