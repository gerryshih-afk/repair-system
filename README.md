# 報修登記系統
用於新增報修需求並查看問題清單的小型示範系統。
雲端任務測試
[報修欄位表（Excel）](文件/報修欄位表.xlsx)

## 報修網頁

根目錄的 `index.html` 是 GitHub Pages 首頁；`style.css` 負責手機與桌面版面，
`app.js` 處理表單及最近 20 筆紀錄，`config.js` 儲存 Supabase URL 與公開 publishable key。
透過 CDN 載入 supabase-js v2，無須建置。新增僅傳送報修人、地點、類別、問題說明及緊急程度，
`id`、`created_at` 與 `status` 使用資料庫預設值。時間以台灣時間顯示。

### 本機預覽

```sh
python3 -m http.server 8000
```

開啟 http://localhost:8000。需要網路連線才能載入 CDN 與存取 Supabase。

### GitHub Pages

在儲存庫 Settings → Pages，選擇 **Deploy from a branch**，來源為 **main / (root)**。
部署完成後網址為 https://gerryshih-afk.github.io/repair-system/ 。
不需要額外打包或填入 secret 金鑰。

### 資料庫與公開存取

資料表及政策定義見 `supabase/schema.sql`。本次前端變更不會自動執行 SQL 或修改政策。
資料庫須允許匿名 SELECT，以及五個表單欄位的 INSERT，且 `status` 預設為「待處理」。
目前清單公開可讀，請使用虛構姓名與地點。前端公開金鑰不是存取控制，權限由 RLS 與 GRANT 決定。

### 驗證

JavaScript 語法檢查：

```sh
node --check app.js
node --check config.js
```

`tests/frontend.cjs` 使用 Playwright 與 Chromium，模擬 Supabase REST 回應，不寫入真實資料。
在已有 Playwright 的環境中，先啟動上述 HTTP server，再執行：

```sh
curl -fsS 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js' -o /tmp/repair-supabase.js
node tests/frontend.cjs
```

若本機未安裝 Playwright，可先執行 `npm install --no-save --package-lock=false playwright`；
Chromium 預設路徑為 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 指定其他路徑。
CDN 套件路徑可用 `SUPABASE_BUNDLE` 指定。
測試涵蓋必填與空白驗證、送出 payload、成功與失敗、保留輸入、重試、空清單、文字安全、
手機寬度及 CDN 載入失敗；示範截圖位於 `docs/mobile.png`、`docs/desktop.png`。
真實環境仍需在部署後送出一筆虛構報修，確認資料庫預設時間、狀態與 RLS；
自動測試的模擬回應不能證明真實資料庫的權限設定。
