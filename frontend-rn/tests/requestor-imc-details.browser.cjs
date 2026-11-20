const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { createWebServer } = require('../scripts/serve-web.cjs');

(async () => {
  const server = createWebServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge' });
  const user = { id: 41, name: 'Den Mark Orca', first_name: 'Den Mark', last_name: 'Orca', role: 'requestor', roles: ['requestor'], department: 'College of Information Technology Education' };
  const photo = (name) => ({ type: 'image', mime_type: 'image/jpeg', original_filename: name, url: `${base}/fixtures/photos/${name}` });
  const original = 'Congratulations to the CITE students who received academic distinctions.';
  const refined = 'Congratulations to our CITE students for earning academic distinctions. Your dedication continues to make the college proud.';
  const common = { title: 'Student Achievement Spotlight', category: { id: 1, name: 'Direct to IMC' }, requestor: { full_name: user.name, department: user.department }, created_at: '2026-11-06T02:00:00Z', target_platforms: ['facebook', 'instagram', 'website'] };
  const records = [
    { ...common, id: 301, title: 'Standard request', routing_type: 'standard', status: 'pending_imc_qa', caption_narrative: original, media: [photo('submitted-original.jpg')], approval_workflows: [{ stage: 'imc_qa', action: 'pending' }] },
    { ...common, id: 302, routing_type: 'direct_imc', status: 'published', caption_narrative: refined, media: Array.from({ length: 6 }, (_, i) => photo(`final-photo-${i + 1}.jpg`)), submitted_materials: { caption_narrative: original, media: [photo('submitted-original.jpg')] }, approval_workflows: [{ stage: 'imc_qa', action: 'approved', remarks: 'The final caption and artwork are ready for publication.' }] },
    { ...common, id: 303, title: 'Pending direct request', routing_type: 'direct_imc', status: 'pending_imc_qa', caption_narrative: original, media: [], approval_workflows: [] },
    { ...common, id: 304, title: 'Scheduled direct request', routing_type: 'direct_imc', status: 'scheduled', preferred_schedule_at: '2026-12-01T02:00:00Z', caption_narrative: refined, media: [], submitted_materials: { caption_narrative: original, media: [] }, approval_workflows: [] },
    { ...common, id: 305, title: 'Legacy direct request', routing_type: 'direct_imc', status: 'published', caption_narrative: refined, media: [], approval_workflows: [] },
    { ...common, id: 306, title: 'Missing routing request', status: 'pending_imc_qa', caption_narrative: original, media: [], approval_workflows: [] },
    { ...common, id: 307, title: 'Revision direct request', routing_type: 'direct_imc', status: 'returned_for_revision', caption_narrative: original, media: [], approval_workflows: [{ stage: 'imc_qa', action: 'returned_for_revision', remarks: 'Please confirm the event date.' }] },
    { ...common, id: 308, title: 'Publication retry request', routing_type: 'direct_imc', status: 'publish_failed', caption_narrative: refined, media: [], submitted_materials: { caption_narrative: original, media: [] }, approval_workflows: [{ stage: 'imc_qa', action: 'approved' }] },
    { ...common, id: 309, title: 'Draft direct request', routing_type: 'direct_imc', status: 'draft', caption_narrative: original, media: [], approval_workflows: [] },
    { ...common, id: 310, title: 'Unchanged direct request', routing_type: 'direct_imc', status: 'approved', caption_narrative: original, media: [photo('submitted-original.jpg')], submitted_materials: { caption_narrative: original, media: [photo('submitted-original.jpg')] }, approval_workflows: [] },
    { ...common, id: 311, title: 'Pending edited request', routing_type: 'direct_imc', status: 'pending_imc_qa', caption_narrative: refined, media: [photo('replacement.jpg')], submitted_materials: { caption_narrative: original, media: [photo('submitted-original.jpg')] }, approval_workflows: [] },
    { ...common, id: 312, title: 'Photos only edited request', routing_type: 'direct_imc', status: 'approved', caption_narrative: original, media: [photo('replacement.jpg')], submitted_materials: { caption_narrative: original, media: [photo('submitted-original.jpg')] }, approval_workflows: [] },
    { ...common, id: 313, title: 'Caption only edited request', routing_type: 'direct_imc', status: 'approved', caption_narrative: refined, media: [photo('submitted-original.jpg')], submitted_materials: { caption_narrative: original, media: [photo('submitted-original.jpg')] }, approval_workflows: [] },
  ];
  const errors = [];
  let mutations = 0;
  try {
    for (const width of process.argv.includes('--visual') ? [390, 1440] : [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(user => { sessionStorage.setItem('auth_token', 'requestor-details-fixture'); sessionStorage.setItem('auth_user', JSON.stringify(user)); }, user);
      await context.route('**/fixtures/photos/**', route => route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(require.resolve('../assets/images/jmcbg2.jpeg')) }));
      await context.route('**/api/**', async route => {
        if (!['GET', 'HEAD'].includes(route.request().method())) { mutations++; return route.fulfill({ status: 405, json: {} }); }
        const endpoint = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        let body = { data: [] };
        if (endpoint === '/auth/user') body = { user };
        else if (endpoint === '/dashboard/init') body = { posts: { data: records }, stats: {}, categories: [] };
        else if (endpoint === '/posts') body = { data: records, meta: { current_page: 1, last_page: 1, per_page: 50, total: records.length } };
        else if (/^\/posts\/\d+$/.test(endpoint)) body = { data: records.find(post => post.id === Number(endpoint.split('/').pop())) };
        else if (endpoint === '/notifications') body = { notifications: [], unread_count: 0 };
        await route.fulfill({ json: body });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      let standardFrame;
      for (const id of process.argv.includes('--visual') ? [302] : [301, 306, 302, 303, 304, 305, 307, 308, 309, 310, 311, 312, 313]) {
        await page.goto(`${base}/dashboard/requestor?postId=${id}`);
        const standard = [301, 306].includes(id);
        const modal = page.locator(standard ? '#requestor-request-details' : '#requestor-imc-preview');
        await modal.waitFor();
        if (id === 301) {
          await page.waitForTimeout(400);
          standardFrame = await modal.evaluate(el => ({ width: el.getBoundingClientRect().width, background: getComputedStyle(el).backgroundColor, topBorder: getComputedStyle(el).borderTopColor }));
        }
        assert.equal(await modal.getByText(/IMC Review & Edits Status|editorial adjustments|proofreading edits/i).count(), 0, 'Standard details do not claim editorial editing');
        if (!standard) {
          await modal.getByText('Request Details', { exact: true }).waitFor();
          const frame = await modal.evaluate(el => ({ width: el.getBoundingClientRect().width, background: getComputedStyle(el).backgroundColor, topBorder: getComputedStyle(el).borderTopColor }));
          assert.ok(frame.width <= 820 && frame.width <= width - 31, 'Direct window keeps the standard compact width');
          assert.equal(frame.topBorder, 'rgb(76, 0, 124)');
          if (standardFrame) assert.deepEqual(frame, standardFrame, 'Direct and standard windows share width, surface and purple top border');
          await modal.getByText('Submitted materials', { exact: true }).waitFor();
          await modal.getByText('Request information', { exact: true }).waitFor();
          await modal.getByText('Publication preview', { exact: true }).waitFor();
          const final = modal.locator('#direct-imc-final');
          await final.getByText('IMC updates', { exact: true }).waitFor();
          if (id === 302) {
            await page.waitForTimeout(400);
            await page.screenshot({ path: `.expo/requestor-qa/details-published-top-${width}.png` });
            assert.equal(await modal.locator('#direct-imc-submitted').getByText(original, { exact: true }).count(), 1);
            assert.equal(await final.getByText(refined, { exact: true }).count(), 1);
            assert.ok(await final.locator('img').count() >= 6);
            await final.getByText('Caption updated by IMC', { exact: true }).waitFor();
            await final.getByText(/^Photos replaced by IMC/).waitFor();
            await modal.getByRole('button', { name: 'Preview on Instagram', exact: true }).click();
            await modal.getByRole('button', { name: 'Preview on Website', exact: true }).click();
            await modal.getByRole('button', { name: 'Preview on Facebook', exact: true }).click();
            const view = final.getByRole('button', { name: 'View final-photo-1.jpg', exact: true }).last();
            await view.scrollIntoViewIfNeeded();
            await view.click();
            await page.getByRole('button', { name: 'Close image preview', exact: true }).waitFor();
            await page.keyboard.press('Escape');
            assert.equal(await page.getByRole('button', { name: 'Close image preview', exact: true }).count(), 0);
            await modal.waitFor();
          } else if (id === 303) {
            await final.getByText('IMC will add the final caption and images after review.', { exact: true }).waitFor();
            assert.equal(await final.locator('img').count(), 0);
          } else if (id === 304) {
            await modal.locator('#direct-imc-progress').getByText('Scheduled', { exact: true }).waitFor();
            assert.equal(await modal.locator('#direct-imc-progress').getByText('Published', { exact: true }).count(), 0);
          } else if (id === 305) {
            await modal.getByText('Original caption was not saved for this request.', { exact: true }).waitFor();
          } else if (id === 307) {
            await modal.getByText('Please confirm the event date.', { exact: true }).waitFor();
            assert.equal(await final.getByText(refined, { exact: true }).count(), 0);
          } else if (id === 308) {
            await modal.locator('#direct-imc-progress').getByText('Needs attention', { exact: true }).waitFor();
            assert.equal(await modal.locator('#direct-imc-progress').getByText('Published', { exact: true }).count(), 0);
          } else if (id === 309) {
            await modal.getByText('This request is a draft. Submit it when your materials are ready.', { exact: true }).waitFor();
          } else if (id === 310) {
            await final.getByText('Caption as submitted', { exact: true }).waitFor();
            await final.getByText(/^Photos as submitted/).waitFor();
            assert.equal(await final.getByText(/updated by IMC|replaced by IMC/).count(), 0);
          } else if (id === 311) {
            await final.getByText(/^Updates in progress/).waitFor();
            await final.getByText('Caption updated by IMC', { exact: true }).waitFor();
            await final.getByText(/^Photos replaced by IMC/).waitFor();
            assert.equal(await final.getByText(refined, { exact: true }).count(), 1, 'Pending recorded IMC edits are visible');
          } else if (id === 312) {
            await final.getByText('Caption as submitted', { exact: true }).waitFor();
            await final.getByText(/^Photos replaced by IMC/).waitFor();
          } else if (id === 313) {
            await final.getByText('Caption updated by IMC', { exact: true }).waitFor();
            await final.getByText(/^Photos as submitted/).waitFor();
          }
          await final.scrollIntoViewIfNeeded();
          const escaped = await modal.evaluate(root => [...root.querySelectorAll('button,[role="button"],input,textarea,img')].flatMap(el => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && (b.left < -1 || b.right > innerWidth + 1) ? [el.getAttribute('aria-label') || el.tagName] : [];
          }));
          assert.deepEqual(escaped, [], 'All controls and images fit the viewport');
          const close = modal.getByRole('button', { name: 'Close request details', exact: true });
          const closeBox = await close.boundingBox();
          assert.ok(closeBox.y >= 0 && closeBox.y + closeBox.height <= 901, 'Close footer stays visible');
          await page.screenshot({ path: `.expo/requestor-qa/details-${id}-${width}.png` });
          await page.keyboard.press('Escape');
          await modal.waitFor({ state: 'detached' });
        }
      }
      // Open the same layout from the dedicated direct IMC list.
      await page.goto(`${base}/dashboard/requestor?tab=modern-workspace&view=modern`);
      await page.getByRole('button', { name: 'View request: Student Achievement Spotlight', exact: true }).click();
      await page.locator('#requestor-imc-preview #direct-imc-final').waitFor();
      assert.ok(await page.locator('#direct-imc-final img').count() >= 6);
      if (width === 1440) {
        await context.addInitScript(() => localStorage.setItem('dark_mode', 'true'));
        await page.goto(`${base}/dashboard/requestor?postId=302`);
        const darkModal = page.locator('#requestor-imc-preview');
        await darkModal.waitFor();
        assert.equal(await darkModal.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(28, 37, 65)', 'Direct window uses the standard dark surface');
        await page.waitForTimeout(400);
        await page.screenshot({ path: '.expo/requestor-qa/details-published-dark.png' });
      }
      await context.close();
      console.log(`PASS request details ${width}px`);
    }
    assert.deepEqual(errors, []);
    assert.equal(mutations, 0);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
