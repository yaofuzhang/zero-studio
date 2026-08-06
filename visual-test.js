const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  // Capture console logs
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  page.on('pageerror', err => logs.push('JS ERROR: ' + err.message));

  // 1. Load the page
  await page.goto('http://localhost:8765', { waitUntil: 'networkidle', timeout: 15000 });
  await page.screenshot({ path: 'screenshot-1-initial.png' });
  console.log('✅ Initial page loaded');

  // 2. Type folder path and click scan
  const input = await page.$('#pathInput');
  if (!input) { console.log('❌ #pathInput not found!'); await browser.close(); process.exit(1); }

  await input.fill('D:/Zero/projects/zero-studio');
  await page.click('#btnScan');
  console.log('✅ Clicked scan button');

  // 3. Wait for results
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('#scoreValue');
      return el && el.textContent !== '—' && el.textContent.trim() !== '';
    }, { timeout: 10000 });
  } catch {
    console.log('⚠️ Score did not update');
  }

  await page.screenshot({ path: 'screenshot-2-result.png' });
  console.log('✅ Result screenshot taken');

  // 4. Report what we see
  const score = await page.$eval('#scoreValue', el => el.textContent).catch(() => 'NOT FOUND');
  const files = await page.$eval('#statFiles', el => el.textContent).catch(() => 'NOT FOUND');
  const status = await page.$eval('#scanStatus', el => el.textContent).catch(() => 'no status bar');
  const dashboard = await page.$eval('#dashboard', el => el.className).catch(() => 'NOT FOUND');
  const welcome = await page.$eval('#welcome', el => el.className).catch(() => 'NOT FOUND');

  console.log('Score ring:', score);
  console.log('File count:', files);
  console.log('Status bar:', status);
  console.log('Dashboard classes:', dashboard);
  console.log('Welcome classes:', welcome);
  console.log('Console logs:', logs.slice(-10).join(' | ') || 'none');

  await browser.close();
})().catch(e => { console.error('❌ TEST FAILED:', e.message); process.exit(1); });
