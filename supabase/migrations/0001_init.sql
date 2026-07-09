-- ADOC-S イラスト認知研究アプリ 初期スキーマ
-- 適用方法: Supabaseダッシュボード > SQL Editor に貼り付けて実行するか、
--          supabase db push (Supabase CLIでプロジェクトをリンク済みの場合) を使用してください。
--
-- 設計方針:
--   ・すべてのテーブルでRLSを有効化する。
--   ・フロントエンド(anonキー)には illustrations の SELECT のみを許可する
--     (画像・正解ラベル・age_groupは機密情報ではなく、出題ロジックに必要なため)。
--   ・subjects / responses / admins / error_logs は anon / authenticated ロールから
--     一切アクセスできない(ポリシーを作らない = デフォルト拒否)。
--     これらは Supabase Edge Function 内で service_role キーを使ってのみ読み書きする。

-- =========================================================
-- 拡張機能
-- =========================================================
create extension if not exists pgcrypto;

-- =========================================================
-- subjects (被験者)
-- =========================================================
create sequence if not exists subject_code_seq start 1;

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  subject_code text not null unique,
  password_hash text not null,
  age_months integer,
  grade text check (
    grade in ('年少','年中','年長','小学校1年','小学校2年','小学校3年','小学校4年','小学校5年','小学校6年','中学生')
  ),
  age_group text check (
    age_group in ('年中以下','年長','小学校低学年','小学校高学年','中学生以上')
  ),
  has_diagnosis boolean,
  diagnosis_note text,
  examiner_type text check (examiner_type in ('保護者','研究者','その他')),
  created_at timestamptz not null default now()
);

comment on column subjects.age_months is '月齢。不明・未入力の場合はnull。';
comment on column subjects.age_group is 'gradeから自動判定される年齢群カテゴリー。';

alter table subjects enable row level security;
-- anon/authenticated 向けのポリシーは意図的に作成しない(Edge Function経由のみ許可)。

-- =========================================================
-- illustrations (イラストマスタ)
-- =========================================================
create table if not exists illustrations (
  id uuid primary key default gen_random_uuid(),
  age_group text not null check (
    age_group in ('年中以下','年長','小学校低学年','小学校高学年','中学生以上')
  ),
  image_url text not null,
  correct_label text not null,
  display_order integer,
  created_at timestamptz not null default now()
);

alter table illustrations enable row level security;

-- 画像メタデータは機密情報ではないため、フロントエンドから直接の読み取りのみ許可する。
create policy "illustrations_select_anon"
  on illustrations
  for select
  to anon
  using (true);
-- insert/update/delete のポリシーは作らない(管理はSQL EditorまたはEdge Function経由)。

-- =========================================================
-- responses (回答記録)
-- =========================================================
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  illustration_id uuid not null references illustrations(id) on delete restrict,
  verbal_response text,
  used_choices boolean not null default false,
  presented_choices jsonb,
  selected_choice_label text,
  recorded_at timestamptz not null default now(),
  human_score text check (human_score in ('正解','不正解','未評価')) default '未評価',
  human_scorer text,
  human_scored_at timestamptz,
  ai_score text check (ai_score in ('正解','不正解','未評価')) default '未評価',
  ai_confidence numeric,
  ai_scored_at timestamptz,
  final_score text check (final_score in ('正解','不正解')),
  agreement_flag boolean,
  unique (subject_id, illustration_id)
);

comment on column responses.presented_choices is '「わからない」選択時に画面に実際に表示された選択肢一覧(JSON配列)。再現性確認のため必須記録。';
comment on column responses.agreement_flag is 'human_scoreとai_scoreが両方入力された時点でのみ計算する一致/不一致フラグ。';

alter table responses enable row level security;
-- anon/authenticated 向けのポリシーは意図的に作成しない(Edge Function経由のみ許可)。

-- human_score / ai_score が両方確定したら agreement_flag を自動計算するトリガー
create or replace function responses_set_agreement_flag()
returns trigger as $$
begin
  if new.human_score is not null and new.human_score <> '未評価'
     and new.ai_score is not null and new.ai_score <> '未評価' then
    new.agreement_flag := (new.human_score = new.ai_score);
  else
    new.agreement_flag := null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_responses_agreement_flag on responses;
create trigger trg_responses_agreement_flag
  before insert or update on responses
  for each row execute function responses_set_agreement_flag();

-- =========================================================
-- admins (管理者)
-- =========================================================
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  admin_code text not null unique check (admin_code ~ '^[A-Za-z]'),
  password_hash text not null,
  name text not null,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;
-- anon/authenticated 向けのポリシーは意図的に作成しない(Edge Function経由のみ許可)。

-- =========================================================
-- error_logs (エラーログ)
-- =========================================================
create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  subject_code text,
  error_detail text,
  created_at timestamptz not null default now()
);

alter table error_logs enable row level security;
-- anon/authenticated 向けのポリシーは意図的に作成しない(Edge Function経由のみ許可)。

-- =========================================================
-- インデックス
-- =========================================================
create index if not exists idx_responses_subject_id on responses(subject_id);
create index if not exists idx_responses_illustration_id on responses(illustration_id);
create index if not exists idx_illustrations_age_group on illustrations(age_group);
create index if not exists idx_error_logs_occurred_at on error_logs(occurred_at desc);

-- =========================================================
-- ダミーイラストデータ(仮)
-- 実データが揃い次第、本SQLの実行前にこのセクションを削除するか、
-- 別途本データのINSERT文に差し替えてください。
-- age_group ごとに13〜14枚ずつ、合計68枚のダミーを用意しています。
-- =========================================================
do $$
declare
  groups text[] := array['年中以下','年長','小学校低学年','小学校高学年','中学生以上'];
  counts int[] := array[14,14,14,13,13]; -- 合計68枚
  g text;
  c int;
  i int;
  gi int;
begin
  for gi in 1..array_length(groups,1) loop
    g := groups[gi];
    c := counts[gi];
    for i in 1..c loop
      insert into illustrations (age_group, image_url, correct_label, display_order)
      values (
        g,
        format('https://placehold.co/600x400?text=%s-%s', g, i),
        format('%s_ダミー正解ラベル%s', g, i),
        i
      );
    end loop;
  end loop;
end $$;
