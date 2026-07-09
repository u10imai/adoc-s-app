-- admin-issue-subject Edge Functionから subject_code_seq(0001で作成済み)の
-- 次の値を安全に払い出すためのRPCラッパー。
-- supabase-jsはnextval()を直接呼べないため、SECURITY DEFINER関数を経由する。
create or replace function public.next_subject_code()
returns text
language sql
security definer
set search_path = public
as $$
  select lpad(nextval('subject_code_seq')::text, 3, '0');
$$;

revoke all on function public.next_subject_code() from public;
grant execute on function public.next_subject_code() to service_role;
