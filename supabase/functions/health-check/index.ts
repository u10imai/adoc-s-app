import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";

// GitHub Actionsから1日2回叩かれるkeep-alive用エンドポイント。
// Supabase無料枠プロジェクトが非アクティブ判定で休止しないよう、
// 実際にDBへ軽量なクエリを1本発行して「活動」を発生させる。
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 405);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("subjects")
      .select("subject_code", { count: "exact", head: true });
    if (error) throw error;
    return jsonResponse({ ok: true, checked_at: new Date().toISOString() }, 200);
  } catch (e) {
    console.error("health-check failed:", e);
    await logErrorToDb(`health-check failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
