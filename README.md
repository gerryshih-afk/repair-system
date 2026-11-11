# 報修登記系統
用於新增報修需求並查看問題清單的小型示範系統。
雲端任務測試
[報修欄位表（Excel）](文件/報修欄位表.xlsx)

## 報修網頁

根目錄的 `index.html` 是 GitHub Pages 首頁；`style.css` 負責手機與桌面版面，
`app.js` 處理表單及最近 20 筆紀錄，`config.js` 儲存 Supabase URL 與公開 publishable key。
透過本機 vendor/supabase.js 載入 supabase-js v2，無須建置。新增僅傳送報修人、地點、類別、問題說明及緊急程度，
`id`、`created_at` 與 `status` 使用資料庫預設值。時間以台灣時間顯示。
連線請求超過 20 秒會中斷並顯示錯誤，避免持續停留在載入或送出狀態。

### 緊急程度篩選

最近報修清單上方提供「全部／高／中／低」按鈕，預設選取「全部」。
目前選取的按鈕以深綠底白字顯示，並以 `aria-pressed` 提供輔助技術辨識。
篩選只使用網頁已載入的最近 20 筆，不會額外查詢 Supabase，也不代表搜尋全部歷史紀錄。
清單仍維持由新到舊排列；重新整理清單或送出報修後會保留目前篩選。
沒有符合的紀錄時顯示提示；緊急程度「高」的標籤使用紅字與淡紅底。
本次只修改前端及說明文件，未新增資料欄位、未變更資料庫或 `supabase/` 資料夾。

手機確認方式：在此分支的本機預覽向下滑到「最近報修」，確認預設「全部」；
依序點選「高／中／低」檢查選取樣式及顯示資料，點「全部」恢復原清單。
有高緊急紀錄時確認其標籤為紅色，沒有符合資料時則確認提示文字。
合併此變更並完成 Pages 部署後，手機也可從正式網址確認；PR 未合併時仍顯示 main 的版本。

### 本機預覽

```sh
python3 -m http.server 8000
```

開啟 http://localhost:8000。需要網路連線才能存取 Supabase。

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
測試用套件路徑可用 `SUPABASE_BUNDLE` 指定。
測試涵蓋必填與空白驗證、送出 payload、成功與失敗、保留輸入、重試、空清單、文字安全、
手機寬度、連線逾時後重試及 程式庫載入失敗；示範截圖位於 `docs/mobile.png`、`docs/desktop.png`。
真實環境仍需在部署後送出一筆虛構報修，確認資料庫預設時間、狀態與 RLS；
自動測試的模擬回應不能證明真實資料庫的權限設定。

### PWA 安裝與離線

包含 `manifest.webmanifest`、`pwa.js`、`sw.js` 及 `icons/`，適用 GitHub Pages 的 `/repair-system/` 子路徑；不需建置。首次連線開啟後，等待 Service Worker 安裝完成，即可離線開啟頁面。

- Android／桌面 Chrome、Edge：符合瀏覽器安裝條件時點「安裝報修 App」，或使用瀏覽器選單安裝。
- iPhone／iPad：Safari → 分享 → 加入主畫面。
- 離線僅提供頁面；送出與最新清單仍需網路。不快取 Supabase 回應、不排隊送出，也不永久儲存表單。請保持頁面開啟，恢復連線後手動送出或重新整理清單。
- Service Worker 僅快取應用程式靜態資源與本機 Supabase 程式庫。程式庫隨頁面一併快取，避免離線時依賴 CDN。
- 更新前端時，務必遞增 `sw.js` 的 `CACHE_NAME` 版本；使用者關閉所有本網站頁面與 App 再開啟後套用更新，避免填寫到一半重新載入。
- 需 HTTPS 或 localhost；請勿直接以 file:// 開啟。清除網站資料會一併刪除離線快取。

PWA 瀏覽器測試（在 /workspace 執行 `python3 -m http.server 8123` 後）：`node tests/pwa.cjs`。以 `/repair-system/` 子路徑測試安裝資訊、離線重開、離線送出、快取範圍及更新生命週期，不寫入真實資料。

`vendor/supabase.js` 取自 https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js （2026-11-11），授權見 `vendor/supabase-LICENSE`。升級時請一併更新 Service Worker 快取版本。
