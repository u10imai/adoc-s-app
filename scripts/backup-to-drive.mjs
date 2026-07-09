import { google } from "googleapis";
import fs from "node:fs";

// 個人のGoogleアカウントにはGoogle Workspaceの共有ドライブがなく、
// サービスアカウントは自分自身のストレージ容量を持たないため
// (storageQuotaExceededエラーになる)、ここでは本人のGoogleアカウントに
// リフレッシュトークンで認可されたOAuthクライアントを使ってアップロードする。
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });

const drive = google.drive({ version: "v3", auth: oauth2Client });

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
