const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createWebServer } = require('../scripts/serve-web.cjs');
const { createSession, capture, expandSidebar, errors, mutations } = require('./requestor-overview.browser.cjs');

async function fitControls(page, selector) {
  const escaped = await page.locator(selector).evaluate(root => [...root.querySelectorAll('input, textarea, select, [role="button"], [role="radio"], [role="checkbox"]')].flatMap(el => {
    const b = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return b.width > 0 && b.height > 0 && style.visibility !== 'hidden' && (b.left < -1 || b.right > innerWidth + 1)
      ? [{ name: el.getAttribute('aria-label') || el.textContent.slice(0, 70), left: b.left, right: b.right, width: innerWidth }] : [];
  }));
  assert.deepEqual(escaped, [], `Controls stay within the viewport: ${selector}`);
}
async function headerFits(page) {
  const brand = await page.getByRole('button', { name: 'JMCFI PostFlow dashboard', exact: true }).boundingBox();
  const notifications = await page.getByRole('button', { name: 'Notifications', exact: true }).boundingBox();
  assert.ok(brand.x + brand.width <= notifications.x, 'Brand and header actions do not overlap');
  const account = await page.getByRole('button', { name: 'Account menu', exact: true }).boundingBox();
  assert.ok(account.x + account.width <= page.viewportSize().width);
}
async function run() {
  const server = createWebServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.POSTFLOW_BROWSER_CHANNEL || 'msedge' });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const { page, context } = await createSession(browser, base, { viewport: { width, height: 900 } });
      const goto = async (tab, marker) => {
        await page.goto(`${base}/dashboard/requestor?tab=${tab}&view=${tab === 'modern-workspace' ? 'modern' : 'classic'}`);
        await page.locator(marker).waitFor();
        if (width === 1440) await expandSidebar(page);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await headerFits(page);
        await fitControls(page, marker);
        assert.ok(await page.locator('img[src*="jmcbg2"]').count(), 'School background remains on every requestor screen');
        await capture(page, `workspace-${tab}-${width}`);
      };
      await page.locator('#requestor-overview').waitFor();
      if (width < 1024) {
        const launcher = page.locator('[data-pf-launcher]');
        await launcher.waitFor();
        const launcherBox = await launcher.boundingBox();
        const scrollBottom = await page.locator('#requestor-workspace').evaluate(root => {
          let parent = root.parentElement;
          while (parent && !['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
          return parent?.getBoundingClientRect().bottom;
        });
        assert.ok(launcherBox.y >= scrollBottom, 'The default assistant is clear of the mobile content viewport');
        await launcher.click();
        const panel = page.getByRole('dialog', { name: 'PostFlow Assistant', exact: true });
        await panel.waitFor();
        const panelBox = await panel.boundingBox();
        assert.ok(panelBox.x >= 0 && panelBox.x + panelBox.width <= width + 1, 'Assistant panel fits narrow screens');
        await page.keyboard.press('Escape');
      }
      if (width === 1440) { await expandSidebar(page); await fitControls(page, '#requestor-overview'); await capture(page, 'workspace-overview-expanded'); }

      await goto('request', '#requestor-type-selector');
      const imc = page.getByRole('radio', { name: 'IMC Publication Request', exact: true });
      const standard = page.getByRole('radio', { name: 'Standard Content Request', exact: true });
      assert.equal(await imc.getAttribute('aria-checked'), 'true', 'Existing IMC default is preserved');
      await imc.focus(); await page.keyboard.press('Home');
      assert.equal(await standard.getAttribute('aria-checked'), 'true');
      await page.getByRole('button', { name: 'Continue with Standard Content Request', exact: true }).click();
      await page.locator('#requestor-standard-form').waitFor();
      await fitControls(page, '#requestor-standard-form');
      assert.ok((await page.getByRole('textbox', { name: 'Request title', exact: true }).boundingBox()).y < page.viewportSize().height, 'A new tab opens at the start of the form');
      await capture(page, `workspace-standard-top-${width}`);
      await page.getByRole('textbox', { name: 'Request title', exact: true }).fill('Student research forum');
      await page.getByText('Live Preview', { exact: true }).scrollIntoViewIfNeeded();
      await capture(page, `workspace-standard-bottom-${width}`);
      await goto('draft', '#requestor-drafts');
      await page.getByRole('button', { name: 'Edit draft: Internal draft', exact: true }).waitFor();
      const draftSearch = page.getByRole('textbox', { name: 'Search drafts by title, category, or caption', exact: true });
      await draftSearch.fill('no result');
      assert.equal(await page.getByRole('button', { name: 'Edit draft: Internal draft', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Clear draft search', exact: true }).click();
      await page.getByRole('button', { name: 'Delete draft: Internal draft', exact: true }).click();
      const dialog = page.locator('[role="dialog"][aria-modal="true"]');
      await dialog.waitFor();
      await fitControls(page, '[role="dialog"][aria-modal="true"]');
      await capture(page, `workspace-delete-confirm-${width}`);
      await dialog.getByText('Cancel', { exact: true }).click();
      await page.getByRole('button', { name: 'Edit and submit draft: Internal draft', exact: true }).click();
      await page.locator('#requestor-standard-form').waitFor();
      assert.equal(await page.getByRole('textbox', { name: 'Request title', exact: true }).inputValue(), 'Internal draft');

      await goto('rejected', '#requestor-rejected');
      await page.getByRole('button', { name: 'View request details: Rejected example', exact: true }).waitFor();
      await page.getByText('Returned for revision', { exact: true }).waitFor();
      const rejectedSearch = page.getByRole('textbox', { name: 'Search requests by title, category, reason, or reviewer', exact: true });
      await rejectedSearch.fill('no matching feedback');
      assert.equal(await page.getByRole('button', { name: /^View request details:/ }).count(), 0);
      await page.getByRole('button', { name: 'Clear request search', exact: true }).click();
      await page.getByRole('button', { name: 'Filter request date: Custom range', exact: true }).click();
      await page.getByLabel('Rejected start date', { exact: true }).fill('2026-11-17');
      await page.getByLabel('Rejected end date', { exact: true }).fill('2026-11-16');
      assert.equal(await page.getByRole('button', { name: 'Apply rejected request date range', exact: true }).isDisabled(), true);
      await page.getByLabel('Rejected start date', { exact: true }).fill('2026-11-16');
      await page.getByRole('button', { name: 'Apply rejected request date range', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: /^View request details:/ }).count(), 2, 'Custom range includes both requested-date boundaries');
      await page.getByRole('button', { name: 'View request details: Rejected example', exact: true }).click();
      await page.locator('#requestor-request-details').waitFor();
      await fitControls(page, '#requestor-request-details');
      await capture(page, `workspace-request-details-${width}`);
      await page.getByRole('button', { name: 'Close request details', exact: true }).click();

      await goto('modern-workspace', '#requestor-imc-workspace');
      await page.getByRole('textbox', { name: 'Request title, required', exact: true }).waitFor();
      await fitControls(page, '#requestor-imc-workspace');
      const facebook = page.getByRole('checkbox', { name: 'Publish to Facebook', exact: true });
      const checked = await facebook.getAttribute('aria-checked');
      assert.ok(['true', 'false'].includes(checked), 'Platform checkbox exposes its actual state');
      await facebook.click();
      assert.notEqual(await facebook.getAttribute('aria-checked'), checked, 'Platform selection is interactive');
      await page.getByRole('textbox', { name: 'Request title, required', exact: true }).fill('Preview IMC request');
      await page.getByRole('button', { name: 'Submit request to IMC', exact: true }).scrollIntoViewIfNeeded();
      await capture(page, `workspace-imc-form-bottom-${width}`);
      await page.getByRole('button', { name: 'Close create content request form', exact: true }).click();
      await page.getByRole('button', { name: 'View request: Direct IMC example', exact: true }).waitFor();
      await fitControls(page, '#requestor-imc-workspace');
      await capture(page, `workspace-imc-list-${width}`);
      assert.equal(await page.locator('#requestor-imc-workspace').getByText(/REQ-\d+|^#\d+$/).count(), 0);
      await page.getByRole('button', { name: 'View request: Direct IMC example', exact: true }).click();
      await page.locator('#requestor-imc-preview').waitFor();
      await fitControls(page, '#requestor-imc-preview');
      assert.equal(await page.locator('#requestor-imc-preview').getByText(/REQ-\d+|^#\d+$/).count(), 0);
      await capture(page, `workspace-imc-preview-${width}`);
      await page.getByRole('button', { name: 'Close request preview', exact: true }).click();

      await goto('policy-rules', '#postflow-policy-rules');
      const policySearch = page.getByRole('textbox', { name: 'Search policy rules', exact: true });
      await policySearch.fill('an unmatched policy phrase');
      await page.getByText('No policy rules match your search', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      await goto('account-settings', '#requestor-workspace');
      await page.getByRole('textbox', { name: 'Full name', exact: true }).waitFor();
      await fitControls(page, '#requestor-workspace');
      await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Preview account');
      await page.getByText('Update Password', { exact: true }).scrollIntoViewIfNeeded();
      await capture(page, `workspace-account-password-${width}`);
      await context.close();
    }
    assert.deepEqual(errors, [], 'Requestor components have no uncaught runtime errors');
    assert.deepEqual(mutations, [], 'Preview actions never write real data');
    console.log('PASS: requestor selector, standard form, drafts/edit/delete confirmation, rejected/date/details, IMC form/list/preview, policy and account controls fit at 320/390/768/1440px; original handlers and brand background preserved.');
  } finally { await browser.close(); server.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
