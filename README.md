# 上海・大連氣候報告

以繁體中文呈現上海與大連的氣候平年值、季節特徵、即時天氣與 7 日預報。
純 HTML/CSS/JavaScript，不需建置，直接由 GitHub Pages 提供。

網址：https://gerryshih-afk.github.io/repair-system/
（舊網址 `/climate/` 會自動轉到首頁。）

## 檔案

- `index.html`、`style.css`：頁面與版面，支援手機、桌面與深色模式。
- `data.js`：上海（徐家匯站）與大連的氣候平年值（約 1991–2020），包括月平均、最高、最低氣溫、
  月降水量及四季說明。數值為參考近似值，尚未與官方資料逐項核對。
- `app.js`：分頁「上海／大連／雙城對照」（可用 `#shanghai`、`#dalian`、`#compare` 直接連結），
  顯示重點數據、內嵌 SVG 氣溫與降水圖、四季特徵、月別表格，並標示當地時間的本月。
- 即時天氣與 7 日預報來自 Open-Meteo（免金鑰），15 秒逾時；失敗時顯示錯誤與「重新載入」按鈕，
  平年值仍正常顯示。
- `climate/index.html`：舊網址轉址頁。

## 本機預覽

```sh
python3 -m http.server 8000
```

開啟 http://localhost:8000/ 。

## 測試

`tests/climate.cjs` 使用 Playwright 與 Chromium，模擬 Open-Meteo 回應，不需外部網路。先啟動上述 HTTP server，再執行：

```sh
node --check app.js
node tests/climate.cjs
```

可用 `CHROMIUM_PATH` 指定 Chromium 路徑；設定 `SCREENSHOT_DIR=docs` 會更新
`docs/climate-mobile.png` 與 `docs/climate-desktop.png`。

## GitHub Pages

儲存庫 Settings → Pages 選擇 **Deploy from a branch**，來源為 **main / (root)**。

## 舊報修練習

報修登記系統為練習用途，已自網站移除，不再維護。前端程式可從提交 `48c6abc` 取回。
儲存庫仍保留 `報修需求筆記.txt`、`文件/報修欄位表.xlsx` 與 `supabase/schema.sql` 作為參考，未在網站上使用。
