-- 補助金・助成金マスター（Phase 3-⑦）
-- 全店舗共通・グローバルデータ。店舗の売上・従業員数・業種から
-- 利用可能な補助金を自動判定する。
--
-- 出所: 経産省・厚労省・中小企業庁・自治体
-- 定期的なメンテナンスが必要（年度更新・締切変更）。

CREATE TABLE IF NOT EXISTS subsidies (
  id             TEXT PRIMARY KEY,       -- スラグID（例: 'work-style-reform-2026'）
  name           TEXT NOT NULL,          -- 補助金名
  short_name     TEXT,                   -- 略称
  provider       TEXT NOT NULL,          -- 所轄省庁/自治体
  category       TEXT NOT NULL,          -- 'national' | 'prefecture' | 'city'
  max_amount     INTEGER NOT NULL,       -- 最大受給額（円）
  typical_amount INTEGER,                -- よく採択される金額
  deadline_date  DATE,                   -- 締切日（NULL=通年募集）
  -- 判定条件（JSON。フィルタで使用）
  -- {
  --   industries: ["飲食業", "小売業", ...],
  --   employee_max?: number,        -- 従業員数上限
  --   employee_min?: number,        -- 従業員数下限
  --   annual_revenue_max?: number,  -- 年商上限
  --   capital_max?: number,         -- 資本金上限
  --   prefecture?: string,          -- 指定都道府県
  --   requires?: string[],          -- "賃金アップ" "設備投資" 等の要件タグ
  -- }
  conditions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  description    TEXT NOT NULL,          -- 概要（1〜2文）
  benefits       TEXT,                   -- 補助対象・特徴
  application_url TEXT,                  -- 申請ページURL
  priority       INTEGER NOT NULL DEFAULT 50, -- 表示優先度（高いほど上）
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subsidies_active_priority
  ON subsidies(is_active, priority DESC);

-- 全店舗が閲覧可能（マスターデータ）
DROP POLICY IF EXISTS anon_read ON subsidies;
CREATE POLICY anon_read ON subsidies
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- ─── 主要な補助金・助成金 10種を投入 ─────────────────────────
-- 更新: 2026-07-13 時点の情報。金額・条件は毎年変わる可能性あり。

INSERT INTO subsidies (id, name, short_name, provider, category, max_amount, typical_amount, deadline_date, conditions_json, description, benefits, application_url, priority) VALUES

('gyoumu-kaizen-2026', '業務改善助成金', '業務改善', '厚生労働省', 'national', 6000000, 1500000, '2026-12-27',
  '{"industries":["飲食業","小売業","製造業","サービス業","宿泊業"],"employee_max":100,"requires":["最低賃金アップ","設備投資"]}',
  '事業場内最低賃金を引き上げ、生産性向上のための設備投資を行う中小企業向け。',
  '対象: 設備投資費用（機械・POS・調理器具等）。賃上げ額と人数で支給額が決定。', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html', 100),

('hataraki-kata-2026', '働き方改革推進支援助成金', '働き方改革', '厚生労働省', 'national', 2500000, 500000, '2026-11-30',
  '{"industries":["飲食業","小売業","運輸業","建設業","サービス業"],"employee_max":300,"requires":["労働時間削減","有給取得促進"]}',
  '労働時間削減や年次有給休暇の取得促進の取り組みを支援。',
  '対象: 労務管理システム導入・研修費・POS導入も対象。加藤さん(名古屋イタリアン)233万→46万の実績。', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/jikan/hatarakikata/index.html', 100),

('it-doonyuu-2026', 'IT導入補助金', 'IT補助金', '経済産業省', 'national', 4500000, 800000, '2026-11-15',
  '{"industries":["飲食業","小売業","製造業","サービス業"],"employee_max":300,"requires":["IT投資","デジタル化"]}',
  '中小企業のITツール導入経費を最大3/4補助。POSレジ・予約管理・会計ソフト等が対象。',
  '対象: POSレジ・キャッシュレス決済端末・会計ソフト。FLOWS POS導入で活用可能。', 'https://www.it-hojo.jp/', 95),

('mono-zukuri-2026', 'ものづくり補助金', 'ものづくり', '中小企業庁', 'national', 12500000, 5000000, '2026-10-15',
  '{"industries":["製造業","飲食業","サービス業"],"employee_max":300,"requires":["新製品開発","設備投資"]}',
  '革新的な製品・サービスの開発や生産プロセス改善に必要な設備投資を支援。',
  '対象: 高額な業務用設備・専用機器。中小企業にとって最大級の補助金。', 'https://portal.monodukuri-hojo.jp/', 80),

('jizokuka-2026', '小規模事業者持続化補助金', '持続化', '中小企業庁', 'national', 2000000, 500000, '2026-09-30',
  '{"industries":["飲食業","小売業","サービス業"],"employee_max":20,"requires":["販路開拓","新規顧客"]}',
  '小規模事業者(飲食業は5名以下)の販路開拓・広告費・HP制作等を支援。',
  '対象: 広告費・HP制作・チラシ・展示会出展。小さな店舗こそ使いやすい。', 'https://s23.jizokukahojokin.info/', 90),

('carrier-up-2026', 'キャリアアップ助成金', 'キャリアアップ', '厚生労働省', 'national', 1080000, 720000, NULL,
  '{"industries":["飲食業","小売業","サービス業"],"employee_max":300,"requires":["非正規→正社員転換"]}',
  '非正規雇用労働者の正社員化・処遇改善を実施した場合の助成金。',
  '対象: 1人あたり最大72万円/年、複数人での申請可能。飲食業界で人手不足対策に。', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000073200.html', 85),

('shouryoku-2026', '中小企業省力化投資補助金', '省力化', '中小企業庁', 'national', 15000000, 3000000, '2026-12-20',
  '{"industries":["飲食業","小売業","製造業","運輸業"],"employee_max":300,"requires":["自動化設備","省力化"]}',
  'カタログから選定した省力化設備の導入を補助（配膳ロボット・自動釣銭機等）。',
  '対象: 配膳ロボット・自動釣銭機・自動レジ。人手不足解消の切り札。', 'https://shoryokuka.smrj.go.jp/', 75),

('ryouritsu-shien-2026', '両立支援等助成金', '両立支援', '厚生労働省', 'national', 950000, 400000, NULL,
  '{"industries":["飲食業","小売業","製造業","サービス業"],"employee_max":300,"requires":["育児休業","介護休業"]}',
  '育児・介護と仕事の両立支援を行う企業への助成金。',
  '対象: 育児休業取得・復帰支援・介護休業取得の実施。従業員定着に効果的。', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyoukintou/pamphlet/30.html', 70),

('sougyou-hojokin', '創業補助金', '創業', '中小企業庁', 'national', 2000000, 800000, '2026-08-31',
  '{"employee_max":300,"requires":["新規開業","事業計画"]}',
  '新たに創業する中小企業や個人事業主向けの補助金。',
  '対象: 新規開業に必要な設備・広告・人件費の一部。', 'https://www.chusho.meti.go.jp/', 60),

('jigyou-saikouchiku-2026', '事業再構築補助金', '再構築', '中小企業庁', 'national', 100000000, 15000000, '2026-11-30',
  '{"industries":["飲食業","小売業","製造業","サービス業"],"employee_max":300,"requires":["業態転換","新分野展開"]}',
  '思い切った事業再構築（新分野展開・業態転換等）に必要な設備投資を支援。',
  '対象: コロナ後の業態転換・多店舗展開・新業態立ち上げ。額が大きい。', 'https://jigyou-saikouchiku.go.jp/', 65)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  max_amount = EXCLUDED.max_amount,
  deadline_date = EXCLUDED.deadline_date,
  conditions_json = EXCLUDED.conditions_json,
  description = EXCLUDED.description,
  benefits = EXCLUDED.benefits,
  application_url = EXCLUDED.application_url,
  priority = EXCLUDED.priority,
  updated_at = NOW();
