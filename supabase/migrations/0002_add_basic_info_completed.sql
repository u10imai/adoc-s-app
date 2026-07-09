-- subjectsに「基本情報入力が完了しているか」を表す専用フラグを追加する。
-- 初回ログイン判定を responses件数(0件かどうか) から このフラグ に切り替えるための変更。
-- 理由: 基本情報だけ入力して1問も回答せずに中断した場合でも、
--       次回ログイン時に基本情報入力をやり直させないようにするため。

alter table subjects
  add column if not exists basic_info_completed boolean not null default false;
