import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractBearerToken, verifyToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";
import { formatJst } from "../_shared/datetime.ts";

const VALID_SCORES = ["正解", "不正解", "未評価"];

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 405);
  }

  const token = extractBearerToken(req);
  if (!token) {
    return jsonResponse({ ok: false, message: MESSAGES.SESSION_EXPIRED }, 401);
  }

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    return jsonResponse({ ok: false, message: MESSAGES.SESSION_EXPIRED }, 401);
  }

  if (payload.role !== "admin" || typeof payload.name !== "string") {
    return jsonResponse({ ok: false, message: MESSAGES.SESSION_EXPIRED }, 401);
  }

  const scorerName = payload.name;

  let responseId = "";
  let humanScore = "";
  try {
    const body = await req.json();
    responseId = String(body.response_id ?? "").trim();
    humanScore = String(body.human_score ?? "").trim();
  } catch {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }

  if (!responseId) {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }

  if (!VALID_SCORES.includes(humanScore)) {
    return jsonResponse({ ok: false, message: "採点内容の選択が正しくありません。もう一度お選びください。" }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const humanScoredAt = new Date().toISOString();

    const { error } = await supabase
      .from("responses")
      .update({
        human_score: humanScore,
        human_scorer: scorerName,
        human_scored_at: humanScoredAt,
      })
      .eq("id", responseId);
    if (error) throw error;

    return jsonResponse({
      ok: true,
      human_score: humanScore,
      human_scorer: scorerName,
      human_scored_at: formatJst(humanScoredAt),
    });
  } catch (e) {
    console.error("admin-submit-score failed:", e);
    await logErrorToDb(`admin-submit-score failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
