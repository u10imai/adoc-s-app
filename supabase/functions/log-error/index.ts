import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";

// フロントエンドで起きたエラーをベストエフォートで記録する公開エンドポイント。
// ログイン前(認証エラーそのもの等)でも記録できるよう、意図的に認証を要求しない。
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false }, 405);
  }

  try {
    const body = await req.json();
    const subjectCode = body.subject_code ? String(body.subject_code).slice(0, 100) : null;
    const detail = String(body.error_detail ?? "unknown client error").slice(0, 4000);
    await logErrorToDb(detail, subjectCode);
  } catch (_e) {
    // リクエスト自体が壊れていても、ログ記録の失敗でクライアントに追加のエラーを見せない
  }

  return jsonResponse({ ok: true });
});
