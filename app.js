(() => {
  'use strict';

  const form = document.querySelector('#repair-form');
  const submitButton = document.querySelector('#submit-button');
  const refreshButton = document.querySelector('#refresh-button');
  const formMessage = document.querySelector('#form-message');
  const listMessage = document.querySelector('#list-message');
  const list = document.querySelector('#repair-list');
  const filterButtons = [...document.querySelectorAll('.urgency-filters button')];
  const filterSummary = document.querySelector('#filter-summary');
  const categories = ['設備', '網路', '環境', '其他'];
  const urgencies = ['低', '中', '高'];
  const dateFormatter = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short',
  });
  let client;
  let submitting = false;
  let loadedRecords = [];
  let selectedUrgency = '全部';
  let hasLoadedRecords = false;

  // 中斷無回應的請求，讓手機網路不穩時仍能重試。
  async function fetchWithTimeout(input, options = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const signal = options.signal;
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 20000);
    try {
      return await fetch(input, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  function showMessage(element, text, type = '') {
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function createTextElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text ?? '';
    return element;
  }

  function renderRecords() {
    const records = selectedUrgency === '全部'
      ? loadedRecords
      : loadedRecords.filter((record) => record.urgency === selectedUrgency);
    filterSummary.textContent = `緊急程度：${selectedUrgency}，顯示 ${records.length} 筆（最近 ${loadedRecords.length} 筆中）。`;
    list.replaceChildren();
    if (!records.length) {
      const message = loadedRecords.length
        ? `最近 ${loadedRecords.length} 筆中沒有緊急程度為「${selectedUrgency}」的報修。`
        : '目前還沒有報修紀錄，從第一筆登記開始。';
      list.append(createTextElement('p', 'empty-state', message));
      return;
    }
    records.forEach((record) => {
      const card = createTextElement('article', 'repair-card', '');
      const top = createTextElement('div', 'card-top', '');
      top.append(createTextElement('h3', 'card-title', `${record.category} · ${record.location}`));
      const urgencyClass = record.urgency === '高' ? 'high' : record.urgency === '中' ? 'medium' : '';
      top.append(createTextElement('span', `badge ${urgencyClass}`, `緊急程度：${record.urgency}`));
      const meta = createTextElement('div', 'card-meta', '');
      meta.append(createTextElement('span', '', `報修人：${record.reporter_name}`));
      const date = new Date(record.created_at);
      const time = createTextElement('time', '', Number.isNaN(date.getTime()) ? '時間未提供' : `${dateFormatter.format(date)}（台灣時間）`);
      if (!Number.isNaN(date.getTime())) time.dateTime = date.toISOString();
      meta.append(time);
      card.append(top, meta,
        createTextElement('p', 'card-description', record.description),
        createTextElement('span', 'status', `處理狀態：${record.status}`));
      list.append(card);
    });
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedUrgency = button.dataset.urgency;
      filterButtons.forEach((filter) => {
        filter.setAttribute('aria-pressed', String(filter === button));
      });
      // 只篩選最近一次載入的清單，不發出新的 Supabase 請求。
      if (hasLoadedRecords) renderRecords();
    });
  });

  async function loadRecords() {
    if (!navigator.onLine) {
      list.setAttribute('aria-busy', 'false');
      showMessage(listMessage, '目前離線，無法讀取最新紀錄。連線後請按「重新整理」。', 'error');
      return;
    }
    refreshButton.disabled = true;
    list.setAttribute('aria-busy', 'true');
    showMessage(listMessage, '正在載入報修紀錄…');
    try {
      const { data, error } = await client.from('repair_requests')
        .select('id, created_at, reporter_name, location, category, description, urgency, status')
        .order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      loadedRecords = data ?? [];
      hasLoadedRecords = true;
      renderRecords();
      showMessage(listMessage, '');
    } catch (error) {
      showMessage(listMessage, `無法載入清單：${error.message || '請檢查網路連線'}。可按「重新整理」重試。`, 'error');
    } finally {
      list.setAttribute('aria-busy', 'false');
      refreshButton.disabled = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !client || !form.reportValidity()) return;
    if (!navigator.onLine) {
      showMessage(formMessage, '目前離線，報修尚未送出。請保持此頁開啟，連線後再送出；重新載入會清除輸入。', 'error');
      return;
    }
    const fields = new FormData(form);
    const payload = Object.fromEntries(['reporter_name', 'location', 'category', 'description', 'urgency']
      .map((name) => [name, String(fields.get(name) ?? '').trim()]));
    if (Object.values(payload).some((value) => !value)) {
      showMessage(formMessage, '請填寫所有欄位，內容不可只有空白。', 'error');
      return;
    }
    if (!categories.includes(payload.category) || !urgencies.includes(payload.urgency)) {
      showMessage(formMessage, '請選擇有效的類別與緊急程度。', 'error');
      return;
    }
    submitting = true;
    // 暫停編輯，避免等待回應期間的新內容被成功後的 reset 清除。
    const controls = [...form.querySelectorAll('input, select, textarea, button')];
    controls.forEach((control) => { control.disabled = true; });
    submitButton.textContent = '送出中…';
    showMessage(formMessage, '正在送出，請稍候…');
    try {
      // 不傳送 status、id 或 created_at，使用資料庫預設值。
      const { error } = await client.from('repair_requests').insert(payload);
      if (error) throw error;
      form.reset();
      showMessage(formMessage, '報修已成功送出！初始狀態為「待處理」。', 'success');
      await loadRecords();
    } catch (error) {
      showMessage(formMessage, `送出失敗：${error.message || '請檢查網路連線'}。填寫內容已保留；若連線中斷，請先重新整理清單確認是否已登記，再決定是否重送。`, 'error');
    } finally {
      submitting = false;
      controls.forEach((control) => { control.disabled = false; });
      submitButton.textContent = '送出報修 ↗';
    }
  });

  try {
    const config = window.REPAIR_CONFIG;
    if (!window.supabase || !config?.supabaseUrl || !config?.supabasePublishableKey) {
      throw new Error('連線元件未載入，請重新整理頁面或檢查 config.js');
    }
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchWithTimeout },
    });
    refreshButton.addEventListener('click', loadRecords);
    loadRecords();
  } catch (error) {
    submitButton.disabled = true;
    refreshButton.disabled = true;
    list.setAttribute('aria-busy', 'false');
    showMessage(formMessage, error.message, 'error');
    showMessage(listMessage, '服務暫時無法連線，請重新整理頁面再試。', 'error');
  }
})();
