const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route('**/vendor/supabase.js', route => route.fulfill({ path: '/tmp/repair-supabase.js', contentType: 'application/javascript' }));
    let posts = 0;
    await context.route('https://*.supabase.co/**', route => {
      if (route.request().method() === 'POST') posts++;
      return route.fulfill({ json: [] });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = 'http://127.0.0.1:8123/repair-system/';
    await page.goto(base);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
    assert.equal(new URL(manifest.start_url, base).href, base);
    assert.equal(new URL(manifest.scope, base).href, base);
    assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) {
      const size = await page.evaluate(async src => {
        const img = new Image(); img.src = src; await img.decode(); return `${img.width}x${img.height}`;
      }, new URL(icon.src, base).href);
      assert.equal(size, icon.sizes);
    }
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    const info = await cdp.send('Page.getAppManifest');
    assert.deepEqual(info.errors, []);
    // 確認支援安裝提示的瀏覽器會顯示入口，使用者取消後可繼續操作。
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      event.prompt = async () => {};
      event.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(event);
    });
    await page.locator('#install-button').click();
    assert.equal(await page.locator('#install-button').isVisible(), false);
    await context.setOffline(true);
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await page.reload();
    await page.locator('#connection-status').waitFor();
    await page.locator('#reporter-name').fill('測試同事');
    await page.locator('#location').fill('示範辦公室');
    await page.locator('#category').selectOption('設備');
    await page.locator('#description').fill('離線測試');
    await page.locator('#submit-button').click();
    await page.getByText('目前離線，報修尚未送出。', { exact: false }).waitFor();
    assert.equal(posts, 0);
    assert.equal(await page.locator('#description').inputValue(), '離線測試');
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      return (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(r => r.url)))).flat();
    });
    assert.ok(cached.every(url => !url.includes('supabase.co')));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: 'docs/pwa-offline-mobile.png', fullPage: true });
    await context.setOffline(false);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await page.waitForFunction(() => document.querySelector('#connection-status').hidden);
    await page.locator('#refresh-button').click();
    await page.locator('.empty-state').waitFor();
    // 用路由供應下一版 worker，驗證新版本等待，關閉頁面後才接手。
    await context.route('**/sw.js', route => route.fulfill({ body: fs.readFileSync('sw.js', 'utf8').replace('}v1`', '}v2`'), contentType: 'application/javascript' }));
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
    await page.close();
    const next = await context.newPage();
    await next.goto(base);
    await next.waitForFunction(async () => (await caches.keys()).includes('repair-system-shell-v2'));
    await next.waitForFunction(async () => !(await caches.keys()).includes('repair-system-shell-v1'));
    assert.deepEqual(errors, []);
    console.log('PASS: 子路徑 manifest、圖示、安裝入口、離線重開與送出保護、網路恢復、快取範圍、等待更新與舊快取清理。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
