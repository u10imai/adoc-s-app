-- responsesの変更履歴(行全体スナップショット方式)を残すためのテーブルとトリガー。
--
-- 0006で回答本体列(id/subject_id/illustration_id/verbal_response/used_choices/
-- presented_choices/selected_choice_label/recorded_at)はUPDATEをロック済みだが、
-- 以下の2点は依然として防げないため、その保険として用意する。
--   1. DELETE(行の削除)はロック対象外
--   2. 採点列(human_score等)は意図的にロックしておらず、随時更新される
--
-- 方針: UPDATE/DELETEが起きるたびに、変更"前"(OLD)の行をまるごと1行、
-- このテーブルに追加する。「何から何に変わったか」は、この履歴テーブルの
-- 前の行(または現在のresponses)と見比べれば分かる。

create table if not exists responses_history (
  history_id uuid primary key default gen_random_uuid(),
  response_id uuid not null,
  operation text not null check (operation in ('UPDATE', 'DELETE')),
  changed_at timestamptz not null default now(),
  -- 以下、変更前(OLD)のresponses行のスナップショット
  subject_id uuid,
  illustration_id uuid,
  verbal_response text,
  used_choices boolean,
  presented_choices jsonb,
  selected_choice_label text,
  recorded_at timestamptz,
  human_score text,
  human_scorer text,
  human_scored_at timestamptz,
  ai_score text,
  ai_confidence numeric,
  ai_scored_at timestamptz,
  final_score text,
  agreement_flag boolean
);

comment on table responses_history is 'responsesのUPDATE/DELETE発生時に、変更前の行をまるごと保存する変更履歴(復旧・監査用)。';

create index if not exists idx_responses_history_response_id on responses_history(response_id);

alter table responses_history enable row level security;
-- anon/authenticated向けのポリシーは意図的に作成しない(他テーブルと同様、Edge Function等の
-- service_roleキー、またはSupabaseダッシュボードからのみアクセス可能とする)。

create or replace function responses_log_history()
returns trigger as $$
begin
  insert into responses_history (
    response_id, operation, changed_at,
    subject_id, illustration_id, verbal_response, used_choices,
    presented_choices, selected_choice_label, recorded_at,
    human_score, human_scorer, human_scored_at,
    ai_score, ai_confidence, ai_scored_at,
    final_score, agreement_flag
  )
  values (
    old.id, tg_op, now(),
    old.subject_id, old.illustration_id, old.verbal_response, old.used_choices,
    old.presented_choices, old.selected_choice_label, old.recorded_at,
    old.human_score, old.human_scorer, old.human_scored_at,
    old.ai_score, old.ai_confidence, old.ai_scored_at,
    old.final_score, old.agreement_flag
  );
  return old;
end;
$$ language plpgsql;

drop trigger if exists responses_log_history_trigger on responses;

create trigger responses_log_history_trigger
after update or delete on responses
for each row execute function responses_log_history();
