-- 本番用ID(001〜、subject_code_seq)を一括発行すると、既存のテスト用ID
-- (201〜238)と subject_code の一意制約でぶつかり発行が止まってしまう。
-- 本番=001〜999 / テスト=1000番台 と範囲で明確に分離する。
--
-- 既存テストデータは残したいので、番号の先頭に「1」を付けるだけにする
-- (201→1201 … 238→1238)。回答データ(responses)は subject_id(UUID)で
-- 紐づいているため影響なし。error_logs.subject_code(デバッグ用の非正規化列)は
-- 旧番号のまま放置する運用とする。

update subjects
  set subject_code = '1' || subject_code
  where subject_type = 'テスト'
    and subject_code ~ '^[0-9]{3}$';

-- 次のテスト用ID発行を 1239 からにする。
select setval('test_subject_code_seq', 1238, true);
