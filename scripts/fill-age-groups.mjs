// cloudinary-illustrations.csv の public_id を、評価者3名の集計シート
// (「比較・集計用（横版）」タブの最終導入年齢列)と突き合わせて
// age_group を自動で埋めるスクリプト。
// (public_idはCloudinaryが元ファイル名+ランダムな接尾辞を付けた形になっているため、
//  「元ファイル名の先頭一致」でマッチングする。fill-correct-labels.mjsと同じ方式)
//
// 使い方:
//   node scripts/fill-age-groups.mjs
//
// 入力: cloudinary-illustrations.csv
// 出力: 同じファイルを上書き(age_group列のみ更新)

import fs from "node:fs/promises";

const CSV_PATH = "cloudinary-illustrations.csv";

// 評価者3名(今井/栗田さん/とし)の集計シート「比較・集計用（横版）」の
// 最終導入年齢列(2026-07-23時点で確定済み、判定困難は0件)より。
// シート側の表記 → illustrations.age_group の制約値への変換:
//   年中 → 年中以下 / 年長 → 年長 / 小1-3 → 小学校低学年 /
//   小4-6 → 小学校高学年 / 中学生以上 → 中学生以上
const AGE_GROUP_MAP = { 年中: "年中以下", 年長: "年長", "小1-3": "小学校低学年", "小4-6": "小学校高学年", 中学生以上: "中学生以上" };

const FINAL_AGE_BY_NO = {
  1: "年中", 2: "年中", 3: "年中", 4: "年中", 5: "年中", 6: "年中", 7: "年中", 8: "年中",
  9: "小1-3", 10: "小1-3", 11: "中学生以上", 12: "年中", 13: "年中", 14: "年中", 15: "年中",
  16: "年中", 17: "年中", 18: "年中", 19: "小1-3", 20: "年中", 21: "年中", 22: "中学生以上",
  23: "小1-3", 24: "小1-3", 25: "小4-6", 26: "年長", 27: "年長", 28: "年中", 29: "小1-3",
  30: "年中", 31: "小1-3", 32: "小1-3", 33: "小1-3", 34: "小1-3", 35: "年中", 36: "小1-3",
  37: "年長", 38: "小1-3", 39: "小1-3", 40: "中学生以上", 41: "小4-6", 42: "中学生以上",
  43: "年長", 44: "中学生以上", 45: "中学生以上", 46: "年中", 47: "小1-3", 48: "中学生以上",
  49: "年中", 50: "年中", 51: "年中", 52: "年中", 53: "年中", 54: "年中", 55: "年中",
  56: "年長", 57: "小1-3", 58: "小1-3", 59: "小1-3", 60: "年中", 61: "年中", 62: "年中",
  63: "年長", 64: "小1-3", 65: "年中", 66: "年中", 67: "年中", 68: "年長",
};

// 全項目マスタの no ↔ イラストファイル名(先頭一致用stem) 対応
const NO_TO_STEM = {
  1: "01_meal", 2: "02_appearance", 3: "03_changeclothes", 4: "04_bathing", 5: "05_toilet",
  6: "06_move", 7: "07_updown", 8: "08_shopping", 9: "09_healthcare", 10: "10_money",
  11: "11_schedule", 12: "12_cleanup", 13: "13_help", 14: "14_cooking", 15: "15_rest",
  16: "16_transport", 17: "17_drive", 18: "18_friends", 19: "19_teacher", 20: "20_family",
  21: "21_bros", 22: "22_othersex", 23: "23_neighbor", 24: "24_firstmeeting", 25: "25_phonecall",
  26: "26_mail", 27: "27_study", 28: "28_art", 29: "29_gym", 30: "30_computer",
  31: "31_homework", 32: "32_teaching", 33: "33_preparation", 34: "34_waytoschool", 35: "35_schoolmeals",
  36: "36_club", 37: "37_sweep", 38: "38_recess", 39: "39_shift", 40: "40_schooltrip",
  41: "41_schoolevent", 42: "42_schoolfestival", 43: "43_sportsday", 44: "44_cource", 45: "45_cramming",
  46: "46_qualifying", 47: "47_volunteer", 48: "48_parttime", 49: "49_reading", 50: "50_singasong",
  51: "51_toy", 52: "52_playingoutside", 53: "53_comic", 54: "54_tvdvdcd", 55: "55_game",
  56: "56_sports", 57: "57_dance", 58: "58_militaryarts", 59: "59_running", 60: "60_swimming",
  61: "61_bike", 62: "62_festival", 63: "63_trip", 64: "64_outdoor", 65: "65_gardening",
  66: "66_park", 67: "67_restaurant", 68: "68_theater",
};

const STEM_TO_AGE_GROUP = Object.fromEntries(
  Object.entries(NO_TO_STEM).map(([no, stem]) => [stem, AGE_GROUP_MAP[FINAL_AGE_BY_NO[no]]]),
);

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
  const stem = Object.keys(STEM_TO_AGE_GROUP).find((s) => publicId.startsWith(s));
  if (stem) {
    row[idx.age_group] = STEM_TO_AGE_GROUP[stem];
    matchedCount++;
  } else {
    unmatched.push(publicId);
  }
}

const output = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
await fs.writeFile(CSV_PATH, output, "utf-8");

console.log(`${rows.length}件中${matchedCount}件をマッチングし、age_groupを埋めました。`);
if (unmatched.length > 0) {
  console.log(`マッチしなかったpublic_id(${unmatched.length}件):`);
  for (const id of unmatched) console.log(`  - ${id}`);
}
