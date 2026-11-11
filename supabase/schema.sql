-- 報修登記系統：首次建表用 SQL，僅供審閱，請勿由應用程式自動執行。
-- 此腳本不刪除或覆寫既有資料表；同名資料表已存在時會失敗。
-- 以下採用的必填規則與長度上限為本次設計選擇，正式上線前仍須確認。
BEGIN;

-- 資料表與自動產生欄位：UUID 由資料庫產生，建立時間以含時區時間儲存。
CREATE TABLE public.repair_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    reporter_name text NOT NULL,
    location text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    urgency text NOT NULL DEFAULT '中',
    status text NOT NULL DEFAULT '待處理',

    -- CHECK：姓名與地點不得只有空白，並限制原始文字的字元數。
    CONSTRAINT repair_requests_reporter_name_check
        CHECK (char_length(btrim(reporter_name, E' \t\n\r')) > 0
               AND char_length(reporter_name) BETWEEN 1 AND 100),
    CONSTRAINT repair_requests_location_check
        CHECK (char_length(btrim(location, E' \t\n\r')) > 0
               AND char_length(location) BETWEEN 1 AND 200),

    -- CHECK：問題說明必須有內容，最多 2,000 個字元。
    CONSTRAINT repair_requests_description_check
        CHECK (char_length(btrim(description, E' \t\n\r')) > 0
               AND char_length(description) BETWEEN 1 AND 2000),

    -- CHECK：清單欄位僅接受指定值；NOT NULL 同時禁止空值繞過檢查。
    CONSTRAINT repair_requests_category_check
        CHECK (category IN ('設備', '網路', '環境', '其他')),
    CONSTRAINT repair_requests_urgency_check
        CHECK (urgency IN ('低', '中', '高')),
    CONSTRAINT repair_requests_status_check
        CHECK (status IN ('待處理', '處理中', '已完成'))
);

-- GRANT：不依賴自動授權；先撤銷一般 API 角色與 PUBLIC 的資料表權限。
-- 本腳本新建資料表，不存在舊的欄位層級授權需要清理。
REVOKE ALL PRIVILEGES ON TABLE public.repair_requests FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE public.repair_requests TO anon;

-- GRANT：只允許新增使用者可填欄位，禁止自訂 id、created_at。
-- status 可省略而採用預設值；若主動指定，仍須通過下方 RLS 的待處理檢查。
-- 不授予 UPDATE、DELETE、TRUNCATE，也不授予 authenticated 任何資料表權限。
GRANT INSERT (reporter_name, location, category, description, urgency, status)
    ON TABLE public.repair_requests TO anon;

-- RLS：啟用資料列安全；授權與資料列政策必須同時通過，才能存取資料。
ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;

-- RLS：匿名公開入口可讀取全部清單；此政策不會隱藏姓名、地點與問題說明。
CREATE POLICY repair_requests_anon_select
    ON public.repair_requests
    FOR SELECT TO anon
    USING (true);

-- RLS：新增時的最終 status 必須是待處理，不能直接建立處理中或已完成案件。
-- 不建立修改或刪除政策；即使日後誤授一般修改權限，仍會被 RLS 預設拒絕。
CREATE POLICY repair_requests_anon_insert
    ON public.repair_requests
    FOR INSERT TO anon
    WITH CHECK (status = '待處理');

-- 部署注意：資料表擁有者與具 BYPASSRLS 的高權限角色仍可能繞過 RLS。
-- 公開入口應另設防濫用措施，且只能放虛構資料；勿將高權限金鑰放在前端。
COMMIT;
