-- 検査者が「保護者」の場合に、保護者の専門職属性を入力できるようにする。

alter table subjects
  add column if not exists guardian_profession text check (
    guardian_profession in ('作業療法士','理学療法士','言語聴覚士','心理士','社会福祉士','その他')
  ),
  add column if not exists guardian_profession_other text;

comment on column subjects.guardian_profession is '検査者が保護者の場合の、保護者の専門職属性。検査者が保護者以外の場合はnull。';
comment on column subjects.guardian_profession_other is 'guardian_professionが「その他」の場合の自由記述。';
