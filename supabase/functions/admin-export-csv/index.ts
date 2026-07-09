import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractBearerToken, verifyToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";
import { fetchSubjectsCsv, fetchResponsesCsv, csvResponse } from "../_shared/csvExport.ts";

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

  let table = "";
  try {
    const body = await req.json();
    table = String(body.table ?? "");
  } catch {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }

  if (table !== "subjects" && table !== "responses") {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const csvText = table === "subjects"
      ? await fetchSubjectsCsv(supabase)
      : await fetchResponsesCsv(supabase);
    return csvResponse(table, csvText);
  } catch (e) {
    console.error("admin-export-csv failed:", e);
    await logErrorToDb(`admin-export-csv failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
