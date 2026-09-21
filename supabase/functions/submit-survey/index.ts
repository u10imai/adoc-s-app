import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractBearerToken, verifyToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";

const DIFFICULTY_RATINGS = ["とても簡単だった", "簡単だった", "普通", "難しかった", "とても難しかった"];
const COMPREHENSION_RATINGS = [
  "とても理解できていたと思う", "理解できていたと思う", "まあまあ理解できたと思う",
  "あまり理解できていなかったと思う", "全く理解できていなかったと思う",
];

// イラスト回答が全て終わった直後に1回だけ呼ばれる、感想アンケート保存用エンドポイント。
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

  if (payload.role !== "subject" || typeof payload.sub !== "string") {
    return jsonResponse({ ok: false, message: MESSAGES.SESSION_EXPIRED }, 401);
  }

  const subjectId = payload.sub;

  let childDifficultyRating = "";
  let caregiverComprehensionRating = "";
  let caregiverSkipped = false;

  try {
    const body = await req.json();
    childDifficultyRating = String(body.child_difficulty_rating ?? "");
    caregiverComprehensionRating = String(body.caregiver_comprehension_rating ?? "");
    caregiverSkipped = body.caregiver_skipped === true;
  } catch {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }

  // 保護者が「実施の様子を見ていない(中学生以上が本人のみで回答)」を選んだ場合のみ、
  // 保護者向け設問は空欄(null)で保存する。それ以外は従来どおり必須。
  if (!DIFFICULTY_RATINGS.includes(childDifficultyRating)) {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }
  if (!caregiverSkipped && !COMPREHENSION_RATINGS.includes(caregiverComprehensionRating)) {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("subjects")
      .update({
        child_difficulty_rating: childDifficultyRating,
        caregiver_comprehension_rating: caregiverSkipped ? null : caregiverComprehensionRating,
      })
      .eq("id", subjectId);

    if (error) throw error;

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("submit-survey failed:", e);
    await logErrorToDb(`submit-survey failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
