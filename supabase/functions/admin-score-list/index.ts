import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractBearerToken, verifyToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";
import { formatJst } from "../_shared/datetime.ts";

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

  let subjectId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    subjectId = body?.subject_id ? String(body.subject_id) : null;
  } catch {
    // ボディなしも許可(サマリ取得時)
  }

  try {
    const supabase = getSupabaseAdmin();

    if (!subjectId) {
      const [{ data: subjects, error: subjectsError }, { data: responses, error: respError }] = await Promise.all([
        supabase.from("subjects").select("id, subject_code"),
        supabase.from("responses").select("subject_id, human_score"),
      ]);
      if (subjectsError) throw subjectsError;
      if (respError) throw respError;

      const totalBySubject = new Map<string, number>();
      const scoredBySubject = new Map<string, number>();
      for (const r of responses ?? []) {
        totalBySubject.set(r.subject_id, (totalBySubject.get(r.subject_id) ?? 0) + 1);
        if (r.human_score && r.human_score !== "未評価") {
          scoredBySubject.set(r.subject_id, (scoredBySubject.get(r.subject_id) ?? 0) + 1);
        }
      }

      const summary = (subjects ?? [])
        .map((s) => {
          const total = totalBySubject.get(s.id) ?? 0;
          const scored = scoredBySubject.get(s.id) ?? 0;
          return {
            subject_id: s.id,
            subject_code: s.subject_code,
            total,
            scored,
            unscored: total - scored,
          };
        })
        .filter((s) => s.total > 0)
        .sort((a, b) => a.subject_code.localeCompare(b.subject_code, "en"));

      return jsonResponse({ ok: true, mode: "summary", subjects: summary });
    }

    const { data: rows, error: rowsError } = await supabase
      .from("responses")
      .select(`
        id, verbal_response, used_choices, presented_choices, selected_choice_label, recorded_at,
        human_score, human_scorer, human_scored_at,
        illustrations ( image_url, correct_label, age_group )
      `)
      .eq("subject_id", subjectId)
      .order("recorded_at", { ascending: true });
    if (rowsError) throw rowsError;

    const detail = (rows ?? []).map((r) => ({
      id: r.id,
      verbal_response: r.verbal_response,
      used_choices: r.used_choices,
      presented_choices: r.presented_choices,
      selected_choice_label: r.selected_choice_label,
      recorded_at: formatJst(r.recorded_at),
      human_score: r.human_score,
      human_scorer: r.human_scorer,
      human_scored_at: formatJst(r.human_scored_at),
      illustration: Array.isArray(r.illustrations) ? r.illustrations[0] : r.illustrations,
    }));

    return jsonResponse({ ok: true, mode: "detail", responses: detail });
  } catch (e) {
    console.error("admin-score-list failed:", e);
    await logErrorToDb(`admin-score-list failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
