-- 進捗確認(admin-progress-list)・採点サマリ(admin-score-list)は
-- responsesを全行取得してedge function側で件数を数えていたが、PostgRESTの
-- 最大行数(このプロジェクトは既定の1000)で頭打ちになり、回答が1000件を
-- 超えると一部の被験者の回答数が過少表示になっていた。
--
-- 全行を転送せず、Postgres側で被験者ごとに集計するRPCを追加する。
-- 返るのは被験者数分の行だけなので、回答が何万件になっても影響を受けない。

create or replace function public.response_counts_by_subject()
returns table (
  subject_id uuid,
  total bigint,
  scored bigint
)
language sql
security definer
set search_path = public
as $$
  select
    r.subject_id,
    count(*) as total,
    count(*) filter (
      where r.human_score is not null and r.human_score <> '未評価'
    ) as scored
  from responses r
  group by r.subject_id
$$;

revoke all on function public.response_counts_by_subject() from public;
grant execute on function public.response_counts_by_subject() to service_role;
