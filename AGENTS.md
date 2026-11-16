# 儲存庫指南

## 專案結構

本儲存庫目前的網站是「上海・大連氣候報告」，放在根目錄：`index.html`、`style.css`、`app.js`、`data.js`。
`climate/index.html` 只負責把舊網址轉到首頁。測試為 `tests/climate.cjs`，截圖位於 `docs/climate-*.png`。
說明、本機預覽與測試指令見 README。

舊的報修登記系統是練習，已自網站移除，未來不會使用；請勿再以它為需求依據新增功能。
`報修需求筆記.txt`、`文件/報修欄位表.xlsx`、`supabase/schema.sql` 僅作為歷史參考保留。

## 建置、測試與開發

純 HTML/CSS/JavaScript，無建置步驟與相依套件清單。本機以 `python3 -m http.server 8000` 預覽；
以 `node --check app.js` 檢查語法，以 `node tests/climate.cjs` 執行 Playwright 測試（模擬 Open-Meteo）。
導入框架或套件時，請一併提交相依套件清單與鎖定檔，並更新 README。

## 程式碼風格

檔案使用 UTF-8，使用者介面文字採繁體中文。識別名稱與檔名應清楚表達用途。
氣候資料集中於 `data.js`；修改數值時請註明來源與統計期間。

## 提交與合併請求

提交訊息請簡短並以動作開頭，例如 `新增氣候報告頁`。合併請求應說明變更內容並記錄驗證結果；
介面變更請附上截圖。

## 安全與範圍

前端不得放入任何金鑰；即時天氣僅使用免金鑰的公開 API。外部資料插入頁面前一律經過跳脫或數值格式化，避免注入。
