-- human_scoreを「正解/不正解/未評価」の3択から、正誤+回答傾向を組み合わせた
-- 5分類に変更する。
--   未評価
--   1. 正解:正答
--   2. 正解:文脈関連回答
--   3. 不正解:特定の視覚要素への言及
--   4. 不正解:無関連回答_不正解
--
-- 既存データは以下のルールで新しい分類名に変換する:
--   正解   -> 1. 正解:正答
--   不正解 -> 4. 不正解:無関連回答_不正解

-- 1. 一旦既存の制約を外す(先に外さないと、下のupdate文が古い制約に違反してエラーになる)
alter table responses drop constraint if exists responses_human_score_check;

-- 2. 既存データを新しい分類名に変換
update responses set human_score = '1. 正解:正答' where human_score = '正解';
update responses set human_score = '4. 不正解:無関連回答_不正解' where human_score = '不正解';

-- 3. 新しい制約を追加
alter table responses
  add constraint responses_human_score_check
  check (human_score in (
    '未評価',
    '1. 正解:正答',
    '2. 正解:文脈関連回答',
    '3. 不正解:特定の視覚要素への言及',
    '4. 不正解:無関連回答_不正解'
  ));
