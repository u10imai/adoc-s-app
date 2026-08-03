-- 検査者が「その他」の場合に、具体的に誰なのかを自由記述で入力できるようにする。

alter table subjects
  add column if not exists examiner_type_other text;

comment on column subjects.examiner_type_other is '検査者がその他の場合の自由記述。検査者がその他以外の場合はnull。';

-- 学年選択肢に中学1〜3年・高校1〜3年を追加する(age_groupの区分自体は変更なし、
-- 「中学生」でまとめていたものをより詳細な学年で記録できるようにするだけ)。

alter table subjects
  drop constraint if exists subjects_grade_check;

alter table subjects
  add constraint subjects_grade_check check (
    grade in (
      '年少','年中','年長',
      '小学校1年','小学校2年','小学校3年','小学校4年','小学校5年','小学校6年',
      '中学1年','中学2年','中学3年',
      '高校1年','高校2年','高校3年'
    )
  );
