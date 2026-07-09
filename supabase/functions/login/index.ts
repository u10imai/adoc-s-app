import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { verifyPassword } from "../_shared/passwords.ts";
import { issueToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";

const SESSION_SECONDS = 60 * 60 * 8; // 8時間

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 405);
  }

  let subjectCode = "";
  let password = "";
  try {
    const body = await req.json();
    subjectCode = String(body.subject_code ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return jsonResponse({ ok: false, message: MESSAGES.AUTH_ERROR }, 400);
  }

  if (!subjectCode || !password) {
    return jsonResponse({ ok: false, message: MESSAGES.AUTH_ERROR }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("id, subject_code, password_hash, age_group, basic_info_completed")
      .eq("subject_code", subjectCode)
      .maybeSingle();

    if (subjectError) throw subjectError;

    if (!subject) {
      return jsonResponse({ ok: false, message: MESSAGES.AUTH_ERROR }, 401);
    }

    const passwordOk = await verifyPassword(password, subject.password_hash);
    if (!passwordOk) {
      return jsonResponse({ ok: false, message: MESSAGES.AUTH_ERROR }, 401);
    }

    const token = await issueToken(
      { sub: subject.id, subject_code: subject.subject_code, role: "subject" },
      SESSION_SECONDS,
    );

    return jsonResponse({
      ok: true,
      token,
      subject_code: subject.subject_code,
      is_first_login: !subject.basic_info_completed,
      age_group: subject.age_group,
    });
  } catch (e) {
    console.error("login failed:", e);
    await logErrorToDb(`login failed: ${String(e)}`, subjectCode);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
