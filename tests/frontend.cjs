// 使用環境既有的 Playwright：node tests/frontend.cjs
// 模擬 REST 回應，避免測試資料寫入公開資料庫。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let records = [{ id: 'example', created_at: '2026-11-11T00:00:00Z', reporter_name: '測試同事', location: '示範部門', category: '設備', description: '<img src=x onerror=alert(1)>', urgency: '高', status: '待處理' }];
    let payload;
    let posts = 0;
    let failInsert = false;
    let failRead = false;
    let stallRead = false;
    await page.route('**/vendor/supabase.js', async (route) => {
      // CDN 真實套件預先以 curl 下載，仍測試 supabase-js v2 的實際 HTTP 行為。
      await route.fulfill({ path: process.env.SUPABASE_BUNDLE || '/tmp/repair-supabase.js', contentType: 'application/javascript' });
    });
    await page.route('https://hvzllrixkjjwqzmmyqwd.supabase.co/**', async (route) => {
      if (route.request().method() === 'POST') {
        posts++;
        payload = route.request().postDataJSON();
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (failInsert) return route.fulfill({ status: 403, json: { message: '測試：權限不足' } });
        records = [{ ...payload, id: 'new', created_at: '2026-11-11T01:00:00Z', status: '待處理' }, ...records];
        return route.fulfill({ status: 201, body: '' });
      }
      const url = new URL(route.request().url());
      if (stallRead) return; // 模擬伺服器一直沒有回應。
      assert.equal(url.searchParams.get('order'), 'created_at.desc');
      assert.equal(url.searchParams.get('limit'), '20');
      assert.equal(route.request().headers().apikey, 'sb_publishable_llrdegpHSMl7Vx6LQmCACw__BdLJJ14');
      return route.fulfill({ status: failRead ? 500 : 200, json: failRead ? { message: '測試：讀取失敗' } : records });
    });
    await page.goto('http://127.0.0.1:8000');
    await page.locator('.repair-card').waitFor();
    assert.equal(await page.locator('.repair-card img').count(), 0, '資料應顯示為純文字');
    assert.ok((await page.locator('.card-meta').innerText()).includes('台灣時間'));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '手機不可水平溢出');
    await page.locator('#submit-button').click();
    assert.equal(posts, 0, '必填驗證應阻止空表單送出');
    await page.locator('#reporter-name').fill('   ');
    await page.locator('#location').fill('示範部門');
    await page.locator('#category').selectOption('網路');
    await page.locator('#description').fill('測試連線問題');
    await page.locator('#submit-button').click();
    await page.getByText('請填寫所有欄位，內容不可只有空白。').waitFor();
    assert.equal(posts, 0);
    await page.locator('#reporter-name').fill(' 測試同事 ');
    await page.locator('#submit-button').click();
    assert.equal(await page.locator('#submit-button').isDisabled(), true);
    await page.getByText('報修已成功送出！初始狀態為「待處理」。').waitFor();
    assert.equal(posts, 1);
    assert.deepEqual(Object.keys(payload).sort(), ['category', 'description', 'location', 'reporter_name', 'urgency']);
    assert.equal(payload.reporter_name, '測試同事');
    assert.equal(payload.urgency, '中');
    assert.equal(await page.locator('#reporter-name').inputValue(), '');
    assert.ok((await page.locator('.repair-card').first().innerText()).includes('網路'));
    await page.locator('#submit-button').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#submit-button').disabled);
    failInsert = true;
    await page.locator('#reporter-name').fill('測試同事');
    await page.locator('#location').fill('示範部門');
    await page.locator('#category').selectOption('其他');
    await page.locator('#description').fill('保留這段內容');
    await page.locator('#submit-button').click();
    await page.locator('#form-message.error').waitFor();
    assert.equal(await page.locator('#description').inputValue(), '保留這段內容');
    failRead = true;
    await page.locator('#refresh-button').click();
    await page.locator('#list-message.error').waitFor();
    failRead = false;
    records = [];
    await page.locator('#refresh-button').click();
    await page.locator('.empty-state').waitFor();
    // 留存展示截圖：全部為虛構資料。
    await page.reload();
    await page.locator('.empty-state').waitFor();
    await page.screenshot({ path: 'docs/mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({ path: 'docs/desktop.png', fullPage: true });
    assert.deepEqual(errors, []);
    await page.clock.install();
    stallRead = true;
    const stalledRequest = page.waitForRequest((request) => request.url().includes('/rest/v1/repair_requests'));
    await page.locator('#refresh-button').click();
    await stalledRequest;
    await page.clock.fastForward(20001);
    await page.locator('#list-message.error').waitFor();
    assert.equal(await page.locator('#refresh-button').isDisabled(), false, '逾時後應可重試');
    stallRead = false;
    await page.locator('#refresh-button').click();
    await page.waitForFunction(() => !document.querySelector('#refresh-button').disabled);
    assert.equal(await page.locator('#list-message').innerText(), '');
    // 程式庫未載入時須提供明確訊息且停用送出。
    const offline = await browser.newPage();
    await offline.route('**/vendor/supabase.js', (route) => route.abort());
    await offline.goto('http://127.0.0.1:8000');
    await offline.locator('#form-message.error').waitFor();
    assert.equal(await offline.locator('#submit-button').isDisabled(), true);
    console.log('PASS: 必填、空白、預設值、省略 status、送出鎖定、成功重載、錯誤保留、清單重試、逾時復原、空清單、文字安全、手機版面與 程式庫失敗。');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
