-- 基本情報入力の後に表示する「説明ページ」への同意状態を保存するためのフラグ。
-- 練習画面については専用フラグを持たず、responses件数が0件かどうかで
-- (=まだ本番の設問に1問も回答していないか)判定する。

alter table subjects
  add column if not exists intro_agreed boolean not null default false;

comment on column subjects.intro_agreed is 'クイズの説明ページで「いっしょにやってくれますか?」に「はい」と答えたか。';
