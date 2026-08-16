import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractBearerToken, verifyToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";

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

  let illustrationId = "";
  let verbalResponse = "";
  let usedChoices = false;
  let presentedChoices: string[] | null = null;
  let selectedChoiceLabel: string | null = null;

  try {
    const body = await req.json();
    illustrationId = String(body.illustration_id ?? "").trim();
    verbalResponse = String(body.verbal_response ?? "").trim();
    usedChoices = Boolean(body.used_choices);
    presentedChoices = Array.isArray(body.presented_choices)
      ? body.presented_choices.map((c: unknown) => String(c))
      : null;
    selectedChoiceLabel = body.selected_choice_label ? String(body.selected_choice_label) : null;
  } catch {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }

  if (!illustrationId) {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }

  if (!verbalResponse && !selectedChoiceLabel) {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    // 通信不良等で同じ設問への保存が二重送信された場合、既存行への
    // UPDATEはresponses側の回答本体列ロックトリガーで必ず失敗するため、
    // ignoreDuplicatesで「既に保存済みなら何もしない」を明示し、
    // 再送信自体は成功扱いにする(初回保存の内容を正として扱う)。
    const { error } = await supabase.from("responses").upsert(
      {
        subject_id: subjectId,
        illustration_id: illustrationId,
        verbal_response: verbalResponse || null,
        used_choices: usedChoices,
        presented_choices: usedChoices ? presentedChoices : null,
        selected_choice_label: usedChoices ? selectedChoiceLabel : null,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "subject_id,illustration_id", ignoreDuplicates: true },
    );
    if (error) throw error;

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("submit-response failed:", e);
    await logErrorToDb(`submit-response failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
