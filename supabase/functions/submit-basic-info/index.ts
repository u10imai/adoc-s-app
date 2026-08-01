import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractBearerToken, verifyToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";
import { gradeToAgeGroup } from "../_shared/ageGroup.ts";

const EXAMINER_TYPES = ["保護者", "研究者", "その他"];
const GENDERS = ["男", "女"];
const DIAGNOSIS_STATUSES = ["none", "current", "past"];
const GUARDIAN_PROFESSIONS = ["作業療法士", "理学療法士", "言語聴覚士", "心理士", "社会福祉士", "その他"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 生年月日と検査日から、満月齢(切り捨て)を計算する。
function calculateAgeMonths(birthDate: string, examDate: string): number {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const exam = new Date(`${examDate}T00:00:00Z`);
  let months = (exam.getUTCFullYear() - birth.getUTCFullYear()) * 12
    + (exam.getUTCMonth() - birth.getUTCMonth());
  if (exam.getUTCDate() < birth.getUTCDate()) months -= 1;
  return months;
}

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

  let examinerType = "";
  let examDate = "";
  let birthDate: string | null = null;
  let gender = "";
  let grade = "";
  let diagnosisStatus = "";
  let guardianProfession: string | null = null;
  let guardianProfessionOther: string | null = null;

  try {
    const body = await req.json();
    examinerType = String(body.examiner_type ?? "");
    examDate = String(body.exam_date ?? "");
    birthDate = body.birth_date === "" || body.birth_date === null || body.birth_date === undefined
      ? null
      : String(body.birth_date);
    gender = String(body.gender ?? "");
    grade = String(body.grade ?? "");
    diagnosisStatus = String(body.diagnosis_status ?? "");
    guardianProfession = examinerType === "保護者" ? String(body.guardian_profession ?? "") : null;
    guardianProfessionOther = examinerType === "保護者" && guardianProfession === "その他"
      ? String(body.guardian_profession_other ?? "").trim() || null
      : null;
  } catch {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }

  const ageGroup = gradeToAgeGroup(grade);
  if (!ageGroup) {
    return jsonResponse({ ok: false, message: "学年の選択が正しくありません。もう一度お選びください。" }, 400);
  }

  if (!EXAMINER_TYPES.includes(examinerType)) {
    return jsonResponse({ ok: false, message: "検査者の選択が正しくありません。もう一度お選びください。" }, 400);
  }

  if (!GENDERS.includes(gender)) {
    return jsonResponse({ ok: false, message: "性別の選択が正しくありません。もう一度お選びください。" }, 400);
  }

  if (!DIAGNOSIS_STATUSES.includes(diagnosisStatus)) {
    return jsonResponse({ ok: false, message: "個別の指導の受診状況の選択が正しくありません。もう一度お選びください。" }, 400);
  }

  if (examinerType === "保護者" && !GUARDIAN_PROFESSIONS.includes(guardianProfession ?? "")) {
    return jsonResponse({ ok: false, message: "保護者の方の専門職属性の選択が正しくありません。もう一度お選びください。" }, 400);
  }

  if (!DATE_RE.test(examDate) || Number.isNaN(new Date(examDate).getTime())) {
    return jsonResponse({ ok: false, message: "検査日の入力内容をご確認ください。" }, 400);
  }

  if (birthDate !== null && (!DATE_RE.test(birthDate) || Number.isNaN(new Date(birthDate).getTime()))) {
    return jsonResponse({ ok: false, message: "生年月日の入力内容をご確認ください。" }, 400);
  }

  let ageMonths: number | null = null;
  if (birthDate !== null) {
    ageMonths = calculateAgeMonths(birthDate, examDate);
    if (ageMonths < 0 || ageMonths > 300) {
      return jsonResponse({ ok: false, message: "生年月日と検査日の入力内容をご確認ください。" }, 400);
    }
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("subjects")
      .update({
        examiner_type: examinerType,
        exam_date: examDate,
        birth_date: birthDate,
        age_months: ageMonths,
        gender,
        grade,
        age_group: ageGroup,
        has_diagnosis: diagnosisStatus !== "none",
        diagnosis_status: diagnosisStatus,
        diagnosis_note: null,
        guardian_profession: guardianProfession,
        guardian_profession_other: guardianProfessionOther,
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
