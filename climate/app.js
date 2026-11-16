(() => {
  'use strict';

  const DATA = window.CLIMATE_DATA;
  const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  const TIMEOUT_MS = 15000;
  const API = 'https://api.open-meteo.com/v1/forecast';

  // WMO 天氣代碼對照
  const WEATHER = {
    0: '晴', 1: '大致晴朗', 2: '局部多雲', 3: '陰',
    45: '霧', 48: '霧凇',
    51: '毛毛雨', 53: '毛毛雨', 55: '濃毛毛雨', 56: '凍毛毛雨', 57: '凍毛毛雨',
    61: '小雨', 63: '中雨', 65: '大雨', 66: '凍雨', 67: '強凍雨',
    71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
    80: '陣雨', 81: '較強陣雨', 82: '強陣雨', 85: '陣雪', 86: '強陣雪',
    95: '雷雨', 96: '雷雨夾冰雹', 99: '強雷雨夾冰雹',
  };

  const main = document.getElementById('main');
  const tabs = Array.from(document.querySelectorAll('.tabs button'));
  const liveCache = {};
  let currentView = 'shanghai';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 1) => Number(n).toFixed(d);
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const mean = (arr) => sum(arr) / arr.length;

  // 以上海／大連當地時間（UTC+8）判斷目前月份。
  function localMonthIndex() {
    const m = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', month: 'numeric' }).format(new Date());
    return Number(m) - 1;
  }

  function summarize(city) {
    const hot = city.temp.indexOf(Math.max(...city.temp));
    const cold = city.temp.indexOf(Math.min(...city.temp));
    const wet = city.rain.indexOf(Math.max(...city.rain));
    return {
      annualTemp: mean(city.temp),
      annualRain: sum(city.rain),
      hot, cold, wet,
      range: city.temp[hot] - city.temp[cold],
    };
  }

  // ---------- 圖表（內嵌 SVG） ----------
  const W = 640, H = 310, PAD = { l: 44, r: 48, t: 28, b: 32 };
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  const xAt = (i) => PAD.l + plotW * (i + 0.5) / 12;

  function scale(min, max) {
    return (v) => PAD.t + plotH * (1 - (v - min) / (max - min));
  }

  function tempAxis(min, max, step, y) {
    let out = '';
    for (let v = min; v <= max; v += step) {
      out += `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v)}" y2="${y(v)}"/>`;
      out += `<text class="axis-label" x="${PAD.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}°</text>`;
    }
    return out;
  }

  function monthLabels() {
    return MONTHS.map((m, i) => `<text class="axis-label" x="${xAt(i)}" y="${H - 10}" text-anchor="middle">${i + 1}</text>`).join('');
  }

  function linePath(values, y, cls, dotCls, label) {
    const d = values.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const dots = values.map((v, i) => `<circle class="${dotCls}" cx="${xAt(i)}" cy="${y(v)}" r="3"><title>${label} ${MONTHS[i]}：${fmt(v)}°C</title></circle>`).join('');
    return `<path class="line ${cls}" d="${d}"/>${dots}`;
  }

  function cityChart(city) {
    const tMin = -10, tMax = 40, rMax = 250;
    const y = scale(tMin, tMax);
    const barW = plotW / 12 * 0.6;
    const bars = city.rain.map((r, i) => {
      const h = plotH * r / rMax;
      return `<rect class="bar" x="${xAt(i) - barW / 2}" y="${PAD.t + plotH - h}" width="${barW}" height="${h}" rx="2"><title>降水 ${MONTHS[i]}：${fmt(r)} mm</title></rect>`;
    }).join('');
    let rainAxis = '';
    for (let r = 0; r <= rMax; r += 50) {
      const yy = PAD.t + plotH * (1 - r / rMax);
      rainAxis += `<text class="axis-label" x="${W - PAD.r + 6}" y="${yy + 4}">${r}</text>`;
    }
    return `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(city.name)}每月氣溫與降水量圖">
        ${tempAxis(tMin, tMax, 10, y)}
        ${bars}
        ${linePath(city.high, y, 'line-hi', 'dot-hi', '平均最高溫')}
        ${linePath(city.low, y, 'line-lo', 'dot-lo', '平均最低溫')}
        ${rainAxis}
        <text class="axis-label" x="${W - PAD.r + 6}" y="12">mm</text>
        ${monthLabels()}
      </svg>
      <ul class="legend">
        <li><span style="background:var(--warm)"></span>平均最高溫（°C，左軸）</li>
        <li><span style="background:var(--cool)"></span>平均最低溫（°C，左軸）</li>
        <li><span style="background:var(--rain)"></span>降水量（mm，右軸）</li>
      </ul>`;
  }

  function compareChart() {
    const y = scale(-10, 35);
    return `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="上海與大連每月平均氣溫對照圖">
        ${tempAxis(-10, 30, 10, y)}
        ${linePath(DATA.shanghai.temp, y, 'line-sh', 'dot-sh', '上海')}
        ${linePath(DATA.dalian.temp, y, 'line-dl', 'dot-dl', '大連')}
        ${monthLabels()}
      </svg>
      <ul class="legend">
        <li><span style="background:var(--sh)"></span>上海 月平均氣溫</li>
        <li><span style="background:var(--dl)"></span>大連 月平均氣溫</li>
      </ul>`;
  }

  // ---------- 即時天氣 ----------
  async function fetchLive(city) {
    const params = new URLSearchParams({
      latitude: city.lat,
      longitude: city.lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'Asia/Shanghai',
      forecast_days: '7',
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API}?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function renderLive(box, live) {
    const c = live.current || {};
    const d = live.daily || {};
    const days = (d.time || []).map((t, i) => {
      const [yy, mm, dd] = t.split('-').map(Number);
      const wd = WEEKDAYS[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()];
      const pop = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
      return `<li>
        <div class="day">${mm}/${dd}（${wd}）</div>
        <div>${esc(WEATHER[d.weather_code[i]] || '—')}</div>
        <div class="range"><span class="hi">${Math.round(d.temperature_2m_max[i])}°</span> / <span class="lo">${Math.round(d.temperature_2m_min[i])}°</span></div>
        ${pop == null ? '' : `<div class="note">降雨機率 ${pop}%</div>`}
      </li>`;
    }).join('');
    const time = c.time ? c.time.replace('T', ' ') : '';
    box.innerHTML = `
      <div class="now">
        <span class="big">${fmt(c.temperature_2m)}°C</span>
        <span>${esc(WEATHER[c.weather_code] || '—')}</span>
        <span class="meta">體感 ${fmt(c.apparent_temperature)}°C・濕度 ${c.relative_humidity_2m}%・風速 ${fmt(c.wind_speed_10m)} km/h</span>
      </div>
      <p class="status">更新時間：${esc(time)}（當地時間）</p>
      <h3 style="margin-top:12px">未來 7 日預報</h3>
      <ul class="forecast">${days}</ul>`;
  }

  async function loadLive(city, box, force = false) {
    if (!force && liveCache[city.id]) return renderLive(box, liveCache[city.id]);
    box.innerHTML = '<p class="status">正在載入即時天氣…</p>';
    try {
      const live = await fetchLive(city);
      liveCache[city.id] = live;
      if (box.isConnected) renderLive(box, live);
    } catch (err) {
      if (!box.isConnected) return;
      const reason = err.name === 'AbortError' ? '連線逾時' : '無法取得資料';
      box.innerHTML = `<p class="status error">即時天氣載入失敗（${reason}）。氣候平年值不受影響。</p>
        <button type="button" class="retry">重新載入</button>`;
      box.querySelector('.retry').addEventListener('click', () => loadLive(city, box, true));
    }
  }

  // ---------- 畫面 ----------
  function cityView(city) {
    const s = summarize(city);
    const now = localMonthIndex();
    const rows = MONTHS.map((m, i) => `<tr${i === now ? ' class="current"' : ''}>
      <td>${m}${i === now ? '（本月）' : ''}</td><td>${fmt(city.high[i])}</td><td>${fmt(city.temp[i])}</td><td>${fmt(city.low[i])}</td><td>${fmt(city.rain[i])}</td></tr>`).join('');
    const seasons = city.seasons.map((x) => `<div class="card"><h3>${esc(x.name)}</h3><p>${esc(x.text)}</p></div>`).join('');

    main.innerHTML = `
      <section class="card intro" aria-labelledby="h-intro">
        <h2 id="h-intro">${esc(city.fullName)}氣候概況</h2>
        <p class="type">${esc(city.type)}</p>
        <p>${esc(city.summary)}</p>
      </section>

      <section aria-label="重點數據" class="stats">
        <div class="card stat"><p class="label">年平均氣溫</p><p class="value">${fmt(s.annualTemp)}°C</p></div>
        <div class="card stat"><p class="label">年降水量</p><p class="value">${Math.round(s.annualRain)} mm</p><p class="note">最多雨：${MONTHS[s.wet]}</p></div>
        <div class="card stat"><p class="label">最熱月</p><p class="value">${MONTHS[s.hot]}</p><p class="note">月均溫 ${fmt(city.temp[s.hot])}°C</p></div>
        <div class="card stat"><p class="label">最冷月</p><p class="value">${MONTHS[s.cold]}</p><p class="note">月均溫 ${fmt(city.temp[s.cold])}°C</p></div>
        <div class="card stat"><p class="label">本月平均（${MONTHS[now]}）</p><p class="value">${fmt(city.temp[now])}°C</p><p class="note">${fmt(city.low[now])}–${fmt(city.high[now])}°C・${fmt(city.rain[now])} mm</p></div>
      </section>

      <section class="card" aria-labelledby="h-live">
        <h2 id="h-live">即時天氣</h2>
        <div id="live"></div>
      </section>

      <section class="card chart" aria-labelledby="h-chart">
        <h2 id="h-chart">每月氣溫與降水</h2>
        ${cityChart(city)}
      </section>

      <section aria-labelledby="h-season">
        <h2 id="h-season">四季特徵</h2>
        <div class="seasons">${seasons}</div>
      </section>

      <section class="card" aria-labelledby="h-table">
        <h2 id="h-table">月別平年值（${esc(city.station)}，約 1991–2020）</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">月份</th><th scope="col">平均最高 °C</th><th scope="col">平均 °C</th><th scope="col">平均最低 °C</th><th scope="col">降水 mm</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;

    loadLive(city, document.getElementById('live'));
  }

  function compareView() {
    const sh = DATA.shanghai, dl = DATA.dalian;
    const a = summarize(sh), b = summarize(dl);
    const diffs = sh.temp.map((t, i) => t - dl.temp[i]);
    const maxDiff = diffs.indexOf(Math.max(...diffs));
    const minDiff = diffs.indexOf(Math.min(...diffs));
    const row = (label, x, y) => `<tr><td>${label}</td><td>${x}</td><td>${y}</td></tr>`;
    const monthRows = MONTHS.map((m, i) => `<tr><td>${m}</td><td>${fmt(sh.temp[i])}</td><td>${fmt(dl.temp[i])}</td><td>${diffs[i] >= 0 ? '+' : ''}${fmt(diffs[i])}</td><td>${fmt(sh.rain[i])}</td><td>${fmt(dl.rain[i])}</td></tr>`).join('');

    main.innerHTML = `
      <section class="card" aria-labelledby="h-points">
        <h2 id="h-points">雙城重點對照</h2>
        <ul class="compare-points">
          <li>上海年平均氣溫比大連高約 <strong>${fmt(a.annualTemp - b.annualTemp)}°C</strong>；溫差最大在 ${MONTHS[maxDiff]}（${fmt(diffs[maxDiff])}°C），最小在 ${MONTHS[minDiff]}（${fmt(diffs[minDiff])}°C）。</li>
          <li>上海年降水量約 <strong>${Math.round(a.annualRain)} mm</strong>，約為大連（${Math.round(b.annualRain)} mm）的 ${fmt(a.annualRain / b.annualRain)} 倍。</li>
          <li>大連冬季（12–2 月）月均溫在 0°C 上下，上海冬季仍維持在 5–8°C。</li>
          <li>兩地最熱月不同：上海為 ${MONTHS[a.hot]}，大連受海洋調節延後至 ${MONTHS[b.hot]}。</li>
          <li>大連年溫差 ${fmt(b.range)}°C，大於上海的 ${fmt(a.range)}°C，季節變化更劇烈。</li>
        </ul>
      </section>

      <section class="card chart" aria-labelledby="h-cchart">
        <h2 id="h-cchart">月平均氣溫對照</h2>
        ${compareChart()}
      </section>

      <section class="card" aria-labelledby="h-ctable">
        <h2 id="h-ctable">年度數據</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">項目</th><th scope="col">上海</th><th scope="col">大連</th></tr></thead>
            <tbody>
              ${row('氣候類型', esc(sh.type), esc(dl.type))}
              ${row('年平均氣溫', `${fmt(a.annualTemp)}°C`, `${fmt(b.annualTemp)}°C`)}
              ${row('年降水量', `${Math.round(a.annualRain)} mm`, `${Math.round(b.annualRain)} mm`)}
              ${row('最熱月', `${MONTHS[a.hot]}（${fmt(sh.temp[a.hot])}°C）`, `${MONTHS[b.hot]}（${fmt(dl.temp[b.hot])}°C）`)}
              ${row('最冷月', `${MONTHS[a.cold]}（${fmt(sh.temp[a.cold])}°C）`, `${MONTHS[b.cold]}（${fmt(dl.temp[b.cold])}°C）`)}
              ${row('最多雨月', `${MONTHS[a.wet]}（${fmt(sh.rain[a.wet])} mm）`, `${MONTHS[b.wet]}（${fmt(dl.rain[b.wet])} mm）`)}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card" aria-labelledby="h-cmonth">
        <h2 id="h-cmonth">逐月對照</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">月份</th><th scope="col">上海 °C</th><th scope="col">大連 °C</th><th scope="col">溫差 °C</th><th scope="col">上海 mm</th><th scope="col">大連 mm</th></tr></thead>
            <tbody>${monthRows}</tbody>
          </table>
        </div>
      </section>`;
  }

  function show(view, updateHash = true) {
    if (!['shanghai', 'dalian', 'compare'].includes(view)) view = 'shanghai';
    currentView = view;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === view)));
    main.setAttribute('aria-labelledby', `tab-${view}`);
    if (view === 'compare') compareView(); else cityView(DATA[view]);
    if (updateHash && location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t.dataset.view));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      show(next.dataset.view);
    });
  });
  window.addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    if (v !== currentView) show(v, false);
  });

  show(location.hash.slice(1) || 'shanghai', false);
})();
