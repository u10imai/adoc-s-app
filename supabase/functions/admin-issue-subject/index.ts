import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractBearerToken, verifyToken } from "../_shared/jwt.ts";
import { hashPassword } from "../_shared/passwords.ts";
import { logErrorToDb } from "../_shared/errorLog.ts";
import { MESSAGES } from "../_shared/messages.ts";

// 覚えやすいパスワードにするため、動物・果物・植物の単語+2桁の数字で生成する
// (例: tiger48)。ID(subject_code)とセットでないとログインできないため、
// 単語自体の強度は問わない。
const WORDS = [
  "tiger", "panda", "koala", "zebra", "otter", "rabbit", "turtle", "dolphin", "penguin", "giraffe",
  "elephant", "monkey", "kangaroo", "hedgehog", "squirrel", "raccoon", "badger", "walrus", "falcon", "sparrow",
  "apple", "mango", "cherry", "banana", "orange", "lemon", "grape", "peach", "melon", "papaya",
  "coconut", "apricot", "maple", "cedar", "willow", "bamboo", "clover", "tulip", "daisy", "lotus",
];

function generatePassword(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${word}${num}`;
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

  if (payload.role !== "admin") {
    return jsonResponse({ ok: false, message: MESSAGES.SESSION_EXPIRED }, 401);
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: subjectCode, error: rpcError } = await supabase.rpc("next_subject_code");
    if (rpcError) throw rpcError;

    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    const { error: insertError } = await supabase
      .from("subjects")
      .insert({ subject_code: subjectCode, password_hash: passwordHash });
    if (insertError) throw insertError;

    return jsonResponse({ ok: true, subject_code: subjectCode, password });
  } catch (e) {
    console.error("admin-issue-subject failed:", e);
    await logErrorToDb(`admin-issue-subject failed: ${String(e)}`, null);
    return jsonResponse({ ok: false, message: MESSAGES.NETWORK_ERROR }, 500);
  }
});
