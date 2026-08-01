-- 基本情報入力に性別項目を追加する。

alter table subjects
  add column if not exists gender text check (gender in ('男','女'));

comment on column subjects.gender is '対象児の性別。基本情報入力画面で選択。';
