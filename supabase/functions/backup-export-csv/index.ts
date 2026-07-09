import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";
import { fetchSubjectsCsv, fetchResponsesCsv, csvResponse } from "../_shared/csvExport.ts";

// GitHub Actionsの週次バックアップ専用エンドポイント。
// 管理者JWT(12時間で失効しCI向きでない)は使わず、固定の共有シークレット
// (BACKUP_EXPORT_SECRET)のみで認証する。ブラウザから直接呼ばれることはない。
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sha256(input: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));
}

async function isValidSecret(provided: string | null): Promise<boolean> {
  const expected = Deno.env.get("BACKUP_EXPORT_SECRET");
  if (!expected || !provided) return false;
  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  return timingSafeEqualBytes(a, b);
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 405);
  }

  if (!(await isValidSecret(req.headers.get("X-Backup-Secret")))) {
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
    console.error("backup-export-csv failed:", e);
    await logErrorToDb(`backup-export-csv failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
