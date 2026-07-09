import { google } from "googleapis";
import fs from "node:fs";

// サービスアカウントはDriveストレージを持たないため、明示的に共有されたフォルダ
// にしかアクセスできない。drive.fileスコープは「アプリ自身が作成したファイル」
// または「ユーザーがピッカーで開いたファイル」にしかアクセスを保証しないため、
// 後から共有したフォルダへの書き込みには広い drive スコープを使う。
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GDRIVE_SA_KEY),
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });

const folderId = process.env.GDRIVE_FOLDER_ID;
const today = new Date().toISOString().slice(0, 10);

async function upload(localPath, driveFileName) {
  await drive.files.create({
    requestBody: { name: driveFileName, parents: [folderId] },
    media: { mimeType: "text/csv", body: fs.createReadStream(localPath) },
  });
  console.log(`Uploaded ${driveFileName}`);
}

await upload("subjects.csv", `subjects_${today}.csv`);
await upload("responses.csv", `responses_${today}.csv`);
