-- テスト用ID発行(200番台)を本番用ID発行(subject_code_seq、001番台)とは別の連番で管理する。
create sequence if not exists test_subject_code_seq start with 201 increment by 1;

create or replace function public.next_test_subject_code()
returns text
language sql
security definer
set search_path = public
as $$
  select nextval('test_subject_code_seq')::text;
$$;

revoke all on function public.next_test_subject_code() from public;
grant execute on function public.next_test_subject_code() to service_role;

-- ID発行時に選択した本番/テストの区分と、管理者ダッシュボードの
-- 発行済み一覧に表示し続けるための平文パスワードを保存する列を追加する。
-- (通常のログイン認証には従来通りpassword_hashのみを使用する。
--  password_plainはCSVエクスポートには含めない運用とする。)
alter table subjects
  add column if not exists subject_type text not null default '本番' check (subject_type in ('本番','テスト')),
  add column if not exists password_plain text;

comment on column subjects.subject_type is 'ID発行時に選択した区分。本番は001から、テストは201からの連番。';
comment on column subjects.password_plain is '管理者ダッシュボードの発行済み一覧表示用に保存する平文パスワード。CSVエクスポートには含めない。';
