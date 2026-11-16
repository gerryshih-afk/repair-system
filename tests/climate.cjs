// 氣候報告頁測試：先於儲存庫根目錄啟動 python3 -m http.server 8000，再執行 node tests/climate.cjs
// 模擬 Open-Meteo 回應，不依賴外部網路。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000/';
const SHOTS = process.env.SCREENSHOT_DIR;

function fakeForecast(lat) {
  const days = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
  const base = lat > 35 ? 5 : 14;
  return {
    current: { time: '2026-11-16T10:00', temperature_2m: base + 0.4, apparent_temperature: base - 2, relative_humidity_2m: 65, weather_code: 2, wind_speed_10m: 12.3 },
    daily: {
      time: days,
      weather_code: [2, 3, 61, 0, 1, 80, 45],
      temperature_2m_max: days.map((_, i) => base + 4 + i * 0.3),
      temperature_2m_min: days.map((_, i) => base - 3 + i * 0.2),
      precipitation_probability_max: [10, 20, 80, 0, 5, 60, 15],
    },
  };
}

(async () => {
  const opts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(opts);
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let fail = false;
    const requested = [];
    await page.route('https://api.open-meteo.com/**', (route) => {
      const url = new URL(route.request().url());
      requested.push(url.searchParams.get('latitude'));
      assert.equal(url.searchParams.get('timezone'), 'Asia/Shanghai');
      if (fail) return route.fulfill({ status: 500, body: 'error' });
      return route.fulfill({ json: fakeForecast(Number(url.searchParams.get('latitude'))) });
    });

    // 預設顯示上海
    await page.goto(BASE);
    assert.equal(await page.getAttribute('html', 'lang'), 'zh-Hant');
    await page.locator('.forecast li').first().waitFor();
    assert.match(await page.locator('#h-intro').innerText(), /上海市氣候概況/);
    assert.equal(await page.locator('.forecast li').count(), 7, '應顯示 7 日預報');
    assert.match(await page.locator('.now').innerText(), /14\.4°C/);
    assert.equal(await page.locator('#h-table + .table-wrap tbody tr').count(), 12, '月別表應有 12 列');
    assert.equal(await page.locator('tr.current').count(), 1, '應標示本月');
    assert.equal(await page.locator('.chart svg circle').count(), 24, '圖表應有最高溫與最低溫各 12 點');
    assert.equal(await page.locator('.seasons .card').count(), 4);
    assert.match(await page.locator('.stats').innerText(), /1336 mm/);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/climate-mobile.png`, fullPage: true });

    // 切換大連
    await page.click('#tab-dalian');
    await page.locator('.forecast li').first().waitFor();
    assert.match(await page.locator('#h-intro').innerText(), /大連市氣候概況/);
    assert.equal(await page.getAttribute('#tab-dalian', 'aria-selected'), 'true');
    assert.equal(await page.getAttribute('#tab-shanghai', 'aria-selected'), 'false');
    assert.equal(new URL(page.url()).hash, '#dalian');
    assert.match(await page.locator('.now').innerText(), /5\.4°C/);

    // 雙城對照
    await page.click('#tab-compare');
    const points = await page.locator('.compare-points').innerText();
    assert.match(points, /上海年平均氣溫比大連高約/);
    assert.equal(await page.locator('#h-cmonth + .table-wrap tbody tr').count(), 12);
    assert.equal(await page.locator('.chart svg circle').count(), 24);

    // 回到上海時使用快取，不重複請求
    const before = requested.length;
    await page.click('#tab-shanghai');
    await page.locator('.forecast li').first().waitFor();
    assert.equal(requested.length, before, '已載入城市應使用快取');

    // 即時天氣失敗：顯示錯誤與重試，平年值仍正常
    fail = true;
    const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await p2.route('https://api.open-meteo.com/**', (route) => (fail ? route.fulfill({ status: 500, body: 'x' }) : route.fulfill({ json: fakeForecast(31.23) })));
    await p2.goto(`${BASE}#dalian`);
    await p2.locator('.status.error').waitFor();
    assert.match(await p2.locator('#h-intro').innerText(), /大連/);
    assert.equal(await p2.locator('#h-table + .table-wrap tbody tr').count(), 12);
    fail = false;
    await p2.click('.retry');
    await p2.locator('.forecast li').first().waitFor();
    await p2.goto(`${BASE}#shanghai`);
    await p2.locator('.forecast li').first().waitFor();
    if (SHOTS) await p2.screenshot({ path: `${SHOTS}/climate-desktop.png`, fullPage: true });

    // 手機寬度不應出現水平捲動
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, '手機版不應水平捲動');

    // 舊網址 /climate/ 應轉址到首頁並保留分頁
    await page.goto(`${BASE}climate/#dalian`);
    await page.waitForURL((u) => !u.pathname.includes('/climate'));
    await page.locator('#h-intro').waitFor();
    assert.match(await page.locator('#h-intro').innerText(), /大連/);

    assert.deepEqual(errors, []);
    console.log('氣候報告頁測試通過');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
