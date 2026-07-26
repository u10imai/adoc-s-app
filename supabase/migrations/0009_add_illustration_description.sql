-- 採点画面で、正解ラベルだけでなくイラストの詳細説明も表示できるようにするための列追加。
-- 値の投入は別途、評価者作成のスプレッドシート(詳細説明列)からdisplay_order基準で
-- 一括updateする形で行う。

alter table illustrations
  add column if not exists description text;

comment on column illustrations.description is 'イラストの詳細説明(採点時に正解ラベルと合わせて参考表示する)。評価者作成のスプレッドシートより投入。';
