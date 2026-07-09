// 一度だけ手元(自分のPC)で実行して、Google Driveアップロード用の
// リフレッシュトークンを取得するための補助スクリプト。
// GitHub Actions上では実行しない。
//
// 使い方:
//   GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=xxx node scripts/get-refresh-token.mjs
import { google } from "googleapis";
import http from "node:http";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET を環境変数で指定してください。");
  process.exit(1);
}

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive"],
});

console.log("以下のURLをブラウザで開き、バックアップ先に使いたいGoogleアカウントでログイン・許可してください:\n");
console.log(authUrl, "\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  if (!code) {
    res.end("codeが見つかりませんでした。");
    return;
  }
  res.end("認証できました。このタブは閉じて構いません。ターミナルに戻ってください。");
  server.close();

  const { tokens } = await oauth2Client.getToken(code);
  console.log("取得できました。以下の値を GitHub Secrets の GOOGLE_OAUTH_REFRESH_TOKEN に登録してください:\n");
  console.log(tokens.refresh_token);
});

server.listen(PORT, () => {
  console.log(`ローカルサーバーを起動しました(http://localhost:${PORT})。上記URLでの許可を待っています…`);
});
