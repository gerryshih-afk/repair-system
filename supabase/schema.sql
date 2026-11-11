-- 報修登記系統初始化設定
-- 可重複執行，不刪除現有報修資料。
-- 既有資料表的欄位須與下方定義一致。
-- 存取設定：
--   匿名使用者可以讀取全部報修紀錄。
--   匿名使用者可以新增狀態為「待處理」的報修。
--   不授予匿名或一般登入使用者修改、刪除權限。
-- 請手動在 Supabase SQL Editor 執行。

BEGIN;

-- 1. 建立資料表；已存在時保留原表與資料。
CREATE TABLE IF NOT EXISTS public.repair_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  reporter_name text NOT NULL,
  location text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  urgency text NOT NULL DEFAULT '中',
  status text NOT NULL DEFAULT '待處理'
);

-- 2. 啟用資料列安全性。
ALTER TABLE public.repair_requests
  ENABLE ROW LEVEL SECURITY;

-- 3. 清除資料表層級的既有一般角色授權。
REVOKE ALL PRIVILEGES
  ON TABLE public.repair_requests
  FROM PUBLIC, anon, authenticated;

-- PostgreSQL 的欄位授權獨立於資料表授權，須另行清除。
REVOKE ALL PRIVILEGES (
  id,
  created_at,
  reporter_name,
  location,
  category,
  description,
  urgency,
  status
)
  ON TABLE public.repair_requests
  FROM PUBLIC, anon, authenticated;

-- 4. 授予匿名使用者必要權限。
GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT
  ON TABLE public.repair_requests
  TO anon;

-- id 與 created_at 由資料庫自動產生，不允許匿名指定。
GRANT INSERT (
  reporter_name,
  location,
  category,
  description,
  urgency,
  status
)
  ON TABLE public.repair_requests
  TO anon;

-- 5. 重建同名政策，避免重複建立造成錯誤。
DROP POLICY IF EXISTS repair_requests_anon_select
  ON public.repair_requests;

CREATE POLICY repair_requests_anon_select
  ON public.repair_requests
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS repair_requests_anon_insert
  ON public.repair_requests;

CREATE POLICY repair_requests_anon_insert
  ON public.repair_requests
  FOR INSERT
  TO anon
  WITH CHECK (status = '待處理');

COMMIT;
