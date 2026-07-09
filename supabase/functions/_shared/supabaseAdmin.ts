import { createClient } from "npm:@supabase/supabase-js@2";

// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY はSupabase Edge Functionランタイムが
// 自動的に注入する予約環境変数のため、手動でsecrets登録する必要はない。
export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
