import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractBearerToken, verifyToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";
import { formatJst } from "../_shared/datetime.ts";
import { AGE_GROUPS, cumulativeAgeGroups, type AgeGroup } from "../_shared/ageGroup.ts";

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

  if (payload.role !== "admin") {
    return jsonResponse({ ok: false, message: MESSAGES.SESSION_EXPIRED }, 401);
  }

  try {
    const supabase = getSupabaseAdmin();

    const [{ data: subjects, error: subjectsError }, { data: illustrations, error: illError }, { data: responses, error: respError }] =
      await Promise.all([
        supabase.from("subjects").select("id, subject_code, subject_type, password_plain, age_group, basic_info_completed, created_at"),
        supabase.from("illustrations").select("age_group"),
        supabase.from("responses").select("subject_id"),
      ]);

    if (subjectsError) throw subjectsError;
    if (illError) throw illError;
    if (respError) throw respError;

    const countByGroup = new Map<string, number>();
    for (const i of illustrations ?? []) {
      countByGroup.set(i.age_group, (countByGroup.get(i.age_group) ?? 0) + 1);
    }

    const totalByGroup = new Map<string, number>();
    for (const g of AGE_GROUPS) {
      const total = cumulativeAgeGroups(g).reduce((sum, cg) => sum + (countByGroup.get(cg) ?? 0), 0);
      totalByGroup.set(g, total);
    }

    const answeredBySubject = new Map<string, number>();
    for (const r of responses ?? []) {
      answeredBySubject.set(r.subject_id, (answeredBySubject.get(r.subject_id) ?? 0) + 1);
    }

    const list = (subjects ?? []).map((s) => ({
      subject_code: s.subject_code,
      subject_type: s.subject_type,
      password: s.password_plain,
      age_group: s.age_group,
      basic_info_completed: s.basic_info_completed,
      created_at: formatJst(s.created_at),
      answered: answeredBySubject.get(s.id) ?? 0,
      total: s.age_group ? totalByGroup.get(s.age_group as AgeGroup) ?? 0 : null,
    }));

    list.sort((a, b) => a.subject_code.localeCompare(b.subject_code, "en"));

    return jsonResponse({ ok: true, subjects: list });
  } catch (e) {
    console.error("admin-progress-list failed:", e);
    await logErrorToDb(`admin-progress-list failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
