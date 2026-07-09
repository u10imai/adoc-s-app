import { getSupabaseAdmin } from "./supabaseAdmin.ts";

// error_logsへの記録自体が失敗しても、その例外で本来の処理を巻き込んで
// 落とさないよう、常に握りつぶす(ベストエフォート)。
export async function logErrorToDb(detail: string, subjectCode?: string | null): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("error_logs").insert({
      subject_code: subjectCode ?? null,
      error_detail: String(detail).slice(0, 4000),
    });
  } catch (_e) {
    // 記録失敗は無視する
  }
}
