import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { verifyPassword } from "../_shared/passwords.ts";
import { issueToken } from "../_shared/jwt.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";

const SESSION_SECONDS = 60 * 60 * 12; // 12時間

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 405);
  }

  let adminCode = "";
  let password = "";
  try {
    const body = await req.json();
    adminCode = String(body.admin_code ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return jsonResponse({ ok: false, message: MESSAGES.AUTH_ERROR }, 400);
  }

  if (!adminCode || !password) {
    return jsonResponse({ ok: false, message: MESSAGES.AUTH_ERROR }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select("id, admin_code, password_hash, name")
      .eq("admin_code", adminCode)
      .maybeSingle();

    if (adminError) throw adminError;

    if (!admin) {
      return jsonResponse({ ok: false, message: MESSAGES.AUTH_ERROR }, 401);
    }

    const passwordOk = await verifyPassword(password, admin.password_hash);
    if (!passwordOk) {
      return jsonResponse({ ok: false, message: MESSAGES.AUTH_ERROR }, 401);
    }

    const token = await issueToken(
      { sub: admin.id, admin_code: admin.admin_code, name: admin.name, role: "admin" },
      SESSION_SECONDS,
    );

    return jsonResponse({
      ok: true,
      token,
      admin_code: admin.admin_code,
      name: admin.name,
    });
  } catch (e) {
    console.error("admin-login failed:", e);
    await logErrorToDb(`admin-login failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
