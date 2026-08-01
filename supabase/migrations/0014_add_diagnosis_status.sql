-- 個別の指導(言語療法・作業療法など)の受診経験を「ある/ない」の2択から
-- 「受けていない/現在受けている/以前受けていた」の3択に拡張する。
-- 既存の has_diagnosis(boolean)はそのまま残し、後方互換のため
-- 「現在受けている」「以前受けていた」のいずれもtrueとして書き込む。

alter table subjects
  add column if not exists diagnosis_status text check (diagnosis_status in ('none','current','past'));

comment on column subjects.diagnosis_status is '個別の指導(言語療法・作業療法など)の受診状況。none=受けていない, current=現在受けている, past=以前受けていた。has_diagnosisはこの値から自動算出される後方互換フィールド。';
