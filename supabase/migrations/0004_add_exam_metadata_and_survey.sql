-- 検査日・生年月日(月齢の自動計算用)と、
-- イラスト回答終了後に1被験者につき1回だけ聞く感想アンケート2問を追加する。
alter table subjects
  add column if not exists birth_date date,
  add column if not exists exam_date date,
  add column if not exists child_difficulty_rating text check (
    child_difficulty_rating in ('とても簡単だった','簡単だった','普通','難しかった','とても難しかった')
  ),
  add column if not exists caregiver_comprehension_rating text check (
    caregiver_comprehension_rating in (
      'とても理解できていたと思う','理解できていたと思う','まあまあ理解できたと思う',
      'あまり理解できていなかったと思う','全く理解できていなかったと思う'
    )
  );

comment on column subjects.birth_date is '生年月日。不明・未入力の場合はnull。exam_dateと合わせてage_monthsをサーバー側で自動計算する。';
comment on column subjects.exam_date is '検査実施日。';
comment on column subjects.child_difficulty_rating is 'イラスト回答終了後に聞く、子ども本人の感想(難易度)。1被験者につき1回のみ。';
comment on column subjects.caregiver_comprehension_rating is 'イラスト回答終了後に聞く、保護者/検査者からみた子どもの理解度。1被験者につき1回のみ。';
