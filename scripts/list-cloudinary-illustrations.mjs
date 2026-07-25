// Cloudinaryにアップロード済みのイラスト一覧(public_id・URL・タグ)を
// 一括取得してCSVに書き出す補助スクリプト。
// 68枚分をMedia Libraryで1枚ずつコピーする手間を省くためのもの。
//
// 使い方:
//   CLOUDINARY_CLOUD_NAME=xxx \
//   CLOUDINARY_API_KEY=xxx \
//   CLOUDINARY_API_SECRET=xxx \
//   node scripts/list-cloudinary-illustrations.mjs
//
// CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET は
// Cloudinaryダッシュボード → Settings → Access Keys で確認できます。
//
// 出力: cloudinary-illustrations.csv (プロジェクト直下)
//   public_id, secure_url, tags, width, height, format, age_group, correct_label, display_order
//   age_groupはタグに5区分のいずれか1つだけが付いていれば自動で埋めます。
//   correct_label / display_orderは空欄なので、Excel等で手入力してください。

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const FOLDER = process.env.CLOUDINARY_FOLDER ?? "adoc-s_illust";
const OUTPUT_PATH = "cloudinary-illustrations.csv";

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error("CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET を環境変数で指定してください。");
  process.exit(1);
}

const AGE_GROUPS = ["年中以下", "年長", "小学校低学年", "小学校高学年", "中学生以上"];
const AUTH = Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function fetchAllResources() {
  const resources = [];
  let nextCursor;

  do {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expression: `folder:${FOLDER}`,
        with_field: ["tags"],
        max_results: 500,
        next_cursor: nextCursor,
      }),
    });

    if (!res.ok) {
      throw new Error(`Cloudinary API error: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    resources.push(...body.resources);
    nextCursor = body.next_cursor;
  } while (nextCursor);

  return resources;
}

const resources = await fetchAllResources();
resources.sort((a, b) => a.public_id.localeCompare(b.public_id));

const header = [
  "public_id",
  "secure_url",
  "tags",
  "width",
  "height",
  "format",
  "age_group",
  "correct_label",
  "display_order",
];

const rows = resources.map((r) => {
  const tags = r.tags ?? [];
  const matchedGroups = tags.filter((t) => AGE_GROUPS.includes(t));
  const ageGroup = matchedGroups.length === 1 ? matchedGroups[0] : "";
  return [r.public_id, r.secure_url, tags.join(";"), r.width, r.height, r.format, ageGroup, "", ""];
});

const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
await import("node:fs/promises").then((fs) => fs.writeFile(OUTPUT_PATH, csv, "utf-8"));

console.log(`${resources.length}件を取得し、${OUTPUT_PATH} に書き出しました。`);
const untagged = rows.filter((r) => r[6] === "").length;
if (untagged > 0) {
  console.log(`age_groupが自動判定できなかった行が${untagged}件あります(タグ未設定、または複数の年齢群タグが付いている可能性)。CSVを開いて手動で補ってください。`);
}
