const { chromium } = require('playwright');
(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  page.on('request', request => {
    if (request.url().includes('/api/')) console.log('REQ_START:', request.url(), Date.now());
  });
  page.on('response', response => {
    if (response.url().includes('/api/')) console.log('REQ_DONE:', response.url(), Date.now());
  });
  
  console.log('Navigating to http://localhost:8081...');
  await page.goto('http://localhost:8081');
  
  console.log('Filling in credentials...');
  await page.fill('input[type="email"]', 'admin@jmc.edu.ph');
  await page.fill('input[type="password"]', 'password123');
  
  console.log('Clicking Login at', Date.now());
  const start = Date.now();
  await page.click('text=Login');
  
  // Wait for the dashboard to appear
  try {
    await page.waitForSelector('text=All Content Requests', { timeout: 20000 });
    const end = Date.now();
    console.log(`SUCCESS: Dashboard loaded in ${(end - start) / 1000} seconds!`);
  } catch (err) {
    console.error('ERROR: Dashboard did not load within 20 seconds!');
  }
  
  await browser.close();
})();
