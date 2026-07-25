// 完成した cloudinary-illustrations.csv (public_id, secure_url, age_group,
// correct_label, display_order が埋まったもの) から、illustrations テーブルへの
// insert文(SQL)を生成するスクリプト。
//
// 使い方:
//   node scripts/generate-illustrations-sql.mjs
//
// 入力: cloudinary-illustrations.csv
// 出力: illustrations-insert.sql (プロジェクト直下。Supabase SQL Editorに貼り付けて実行する)

import fs from "node:fs/promises";

const CSV_PATH = "cloudinary-illustrations.csv";
const OUTPUT_PATH = "illustrations-insert.sql";

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

const raw = await fs.readFile(CSV_PATH, "utf-8");
const lines = raw.split("\n").filter((l) => l.length > 0);
const header = parseCsvLine(lines[0]);
const rows = lines.slice(1).map(parseCsvLine);
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

const VALID_AGE_GROUPS = ["年中以下", "年長", "小学校低学年", "小学校高学年", "中学生以上"];

const incomplete = rows.filter((row) => {
  const ageGroup = row[idx.age_group];
  const label = row[idx.correct_label];
  const order = row[idx.display_order];
  return !ageGroup || !label || !order || !VALID_AGE_GROUPS.includes(ageGroup);
});

if (incomplete.length > 0) {
  console.error(`age_group / correct_label / display_order が未入力(または不正なage_group値)の行が${incomplete.length}件あります。SQL生成を中止しました。`);
  for (const row of incomplete) {
    console.error(`  - ${row[idx.public_id]}: age_group="${row[idx.age_group]}" correct_label="${row[idx.correct_label]}" display_order="${row[idx.display_order]}"`);
  }
  process.exit(1);
}

const sorted = [...rows].sort((a, b) => Number(a[idx.display_order]) - Number(b[idx.display_order]));

const values = sorted.map((row) => {
  const ageGroup = sqlEscape(row[idx.age_group]);
  const imageUrl = sqlEscape(row[idx.secure_url]);
  const label = sqlEscape(row[idx.correct_label]);
  const order = Number(row[idx.display_order]);
  return `  ('${ageGroup}', '${imageUrl}', '${label}', ${order})`;
});

const sql = `-- cloudinary-illustrations.csv (${rows.length}件) から自動生成
-- Supabaseダッシュボード → SQL Editor に貼り付けて実行してください。

delete from illustrations;

insert into illustrations (age_group, image_url, correct_label, display_order) values
${values.join(",\n")};
`;

await fs.writeFile(OUTPUT_PATH, sql, "utf-8");
console.log(`${rows.length}件分のSQLを ${OUTPUT_PATH} に書き出しました。`);
