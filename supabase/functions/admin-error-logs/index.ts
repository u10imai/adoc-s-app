import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractBearerToken, verifyToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";
import { formatJst } from "../_shared/datetime.ts";

const LIMIT = 200;

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
    const { data, error } = await supabase
      .from("error_logs")
      .select("id, occurred_at, subject_code, error_detail")
      .order("occurred_at", { ascending: false })
      .limit(LIMIT);
    if (error) throw error;

    const logs = (data ?? []).map((l) => ({ ...l, occurred_at: formatJst(l.occurred_at) }));

    return jsonResponse({ ok: true, logs });
  } catch (e) {
    console.error("admin-error-logs failed:", e);
    await logErrorToDb(`admin-error-logs failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
