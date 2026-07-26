-- Supabase Table Editor等でresponsesテーブルを直接確認する際、
-- illustration_id(UUID)だけでは正解ラベルが分からず確認しづらいため、
-- illustrationsを結合した閲覧専用ビューを追加する。
-- (データを変更しない読み取り専用のビューなので、ロック/履歴トリガーとは無関係)

create or replace view responses_with_illustration as
select
  r.*,
  i.correct_label,
  i.image_url as illustration_image_url,
  i.age_group as illustration_age_group
from responses r
join illustrations i on i.id = r.illustration_id;
