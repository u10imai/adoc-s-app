import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractBearerToken, verifyToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";
import { gradeToAgeGroup } from "../_shared/ageGroup.ts";

const EXAMINER_TYPES = ["保護者", "研究者", "その他"];

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

  let ageMonths: number | null = null;
  let grade = "";
  let hasDiagnosis = false;
  let diagnosisNote: string | null = null;
  let examinerType = "";

  try {
    const body = await req.json();
    ageMonths = body.age_months === "" || body.age_months === null || body.age_months === undefined
      ? null
      : Number(body.age_months);
    grade = String(body.grade ?? "");
    hasDiagnosis = Boolean(body.has_diagnosis);
    diagnosisNote = hasDiagnosis ? String(body.diagnosis_note ?? "").trim() || null : null;
    examinerType = String(body.examiner_type ?? "");
  } catch {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }

  const ageGroup = gradeToAgeGroup(grade);
  if (!ageGroup) {
    return jsonResponse({ ok: false, message: "学年の選択が正しくありません。もう一度お選びください。" }, 400);
  }

  if (!EXAMINER_TYPES.includes(examinerType)) {
    return jsonResponse({ ok: false, message: "検査者区分の選択が正しくありません。もう一度お選びください。" }, 400);
  }

  if (ageMonths !== null && (!Number.isFinite(ageMonths) || ageMonths < 0 || ageMonths > 300)) {
    return jsonResponse({ ok: false, message: "月齢の入力内容をご確認ください。" }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("subjects")
      .update({
        age_months: ageMonths,
        grade,
        age_group: ageGroup,
        has_diagnosis: hasDiagnosis,
        diagnosis_note: diagnosisNote,
        examiner_type: examinerType,
        basic_info_completed: true,
      })
      .eq("id", subjectId);

    if (error) throw error;

    return jsonResponse({ ok: true, age_group: ageGroup });
  } catch (e) {
    console.error("submit-basic-info failed:", e);
    await logErrorToDb(`submit-basic-info failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
