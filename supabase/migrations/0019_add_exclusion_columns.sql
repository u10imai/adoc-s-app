-- 分析・採点から除外する被験者を扱うための列。
-- 生データ(subjects/responses)は削除せず保持し、集計・エクスポート・採点画面で
-- 絞り込むためのフラグとして使う。理由の内訳は exclusion_category、経緯は
-- exclusion_note に残す。
--
--   excluded            … 除外フラグ(絞り込みキー)
--   exclusion_category  … 除外理由の分類。excluded=true のとき必須
--   exclusion_note      … 自由記述。excluded=false でもデータ品質メモとして使用可

alter table subjects
  add column if not exists excluded boolean not null default false,
  add column if not exists exclusion_category text
    check (exclusion_category in ('重複','途中離脱','技術エラー','その他')),
  add column if not exists exclusion_note text;

alter table subjects
  drop constraint if exists subjects_exclusion_category_required;

alter table subjects
  add constraint subjects_exclusion_category_required
  check (not excluded or exclusion_category is not null);

comment on column subjects.excluded is '分析・採点から除外する被験者。生データは保持し、集計・エクスポート・採点画面で絞り込むためのフラグ。';
comment on column subjects.exclusion_category is '除外理由の分類(内訳集計用)。excluded=true のとき必須。';
comment on column subjects.exclusion_note is '除外理由・データ品質メモの自由記述。excluded=false でも記入可。';
