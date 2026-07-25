// cloudinary-illustrations.csv の public_id を、ADOC-S全項目マスタ(no・イラストファイル名・タイトル)
// と突き合わせて correct_label / display_order を自動で埋めるスクリプト。
// (public_idはCloudinaryが元ファイル名+ランダムな接尾辞を付けた形になっているため、
//  「元ファイル名の先頭一致」でマッチングする)
//
// 使い方:
//   node scripts/fill-correct-labels.mjs
//
// 入力: cloudinary-illustrations.csv (list-cloudinary-illustrations.mjsで生成したもの)
// 出力: 同じファイルを上書き(correct_label / display_order列のみ更新。age_groupは未確定のため触らない)

import fs from "node:fs/promises";

const CSV_PATH = "cloudinary-illustrations.csv";

// ADOC-S 全項目マスタ(Google Drive「ADOCs 項目32&全項目 ヘルプ」より)
const MASTER_ITEMS = [
  [1, "01_meal", "食事"],
  [2, "02_appearance", "みだしなみ"],
  [3, "03_changeclothes", "着替え"],
  [4, "04_bathing", "入浴"],
  [5, "05_toilet", "トイレ"],
  [6, "06_move", "移動（平地）"],
  [7, "07_updown", "階の移動"],
  [8, "08_shopping", "買い物"],
  [9, "09_healthcare", "健康に気をつける"],
  [10, "10_money", "お金の使い方"],
  [11, "11_schedule", "スケジュール"],
  [12, "12_cleanup", "部屋・家のそうじ"],
  [13, "13_help", "お手伝い"],
  [14, "14_cooking", "料理"],
  [15, "15_rest", "睡眠・休息"],
  [16, "16_transport", "バス・電車など"],
  [17, "17_drive", "運転"],
  [18, "18_friends", "友達"],
  [19, "19_teacher", "教師"],
  [20, "20_family", "家族"],
  [21, "21_bros", "兄弟・先輩･後輩"],
  [22, "22_othersex", "異性"],
  [23, "23_neighbor", "近所・地域の人"],
  [24, "24_firstmeeting", "初対面の人"],
  [25, "25_phonecall", "電話"],
  [26, "26_mail", "手紙・メール"],
  [27, "27_study", "勉強"],
  [28, "28_art", "美術・図工・音楽"],
  [29, "29_gym", "体育"],
  [30, "30_computer", "情報・PC"],
  [31, "31_homework", "宿題"],
  [32, "32_teaching", "授業"],
  [33, "33_preparation", "準備・片づけ"],
  [34, "34_waytoschool", "登下校"],
  [35, "35_schoolmeals", "給食"],
  [36, "36_club", "クラブ活動"],
  [37, "37_sweep", "学校のそうじ"],
  [38, "38_recess", "休み時間"],
  [39, "39_shift", "係・当番・委員会"],
  [40, "40_schooltrip", "遠足・修学旅行"],
  [41, "41_schoolevent", "入学式・卒業式"],
  [42, "42_schoolfestival", "文化祭"],
  [43, "43_sportsday", "運動会・体育祭"],
  [44, "44_cource", "進路学習"],
  [45, "45_cramming", "塾など"],
  [46, "46_qualifying", "資格･検定"],
  [47, "47_volunteer", "ボランティア"],
  [48, "48_parttime", "アルバイト"],
  [49, "49_reading", "読書・絵本"],
  [50, "50_singasong", "歌・楽器"],
  [51, "51_toy", "おもちゃ"],
  [52, "52_playingoutside", "外遊び"],
  [53, "53_comic", "絵・漫画・物語"],
  [54, "54_tvdvdcd", "TV・DVD・CD"],
  [55, "55_game", "ゲーム"],
  [56, "56_sports", "スポーツ"],
  [57, "57_dance", "ダンス"],
  [58, "58_militaryarts", "武道･武術"],
  [59, "59_running", "ジョギング・ランニング"],
  [60, "60_swimming", "泳ぐ"],
  [61, "61_bike", "自転車など"],
  [62, "62_festival", "お祭"],
  [63, "63_trip", "旅行"],
  [64, "64_outdoor", "アウトドア"],
  [65, "65_gardening", "自然・動物"],
  [66, "66_park", "遊園地・水族館・動物園"],
  [67, "67_restaurant", "デパート･レストラン"],
  [68, "68_theater", "コンサート・映画館"],
];

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

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const raw = await fs.readFile(CSV_PATH, "utf-8");
const lines = raw.split("\n").filter((l) => l.length > 0);
const header = parseCsvLine(lines[0]);
const rows = lines.slice(1).map(parseCsvLine);

const idx = Object.fromEntries(header.map((h, i) => [h, i]));

let matchedCount = 0;
const unmatched = [];

for (const row of rows) {
  const publicId = row[idx.public_id];
  const match = MASTER_ITEMS.find(([, stem]) => publicId.startsWith(stem));
  if (match) {
    const [no, , label] = match;
    row[idx.correct_label] = label;
    row[idx.display_order] = String(no);
    matchedCount++;
  } else {
    unmatched.push(publicId);
  }
}

const output = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
await fs.writeFile(CSV_PATH, output, "utf-8");

console.log(`${rows.length}件中${matchedCount}件をマッチングし、correct_label/display_orderを埋めました。`);
if (unmatched.length > 0) {
  console.log(`マッチしなかったpublic_id(${unmatched.length}件):`);
  for (const id of unmatched) console.log(`  - ${id}`);
}
