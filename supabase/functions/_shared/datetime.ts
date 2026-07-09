// 全ての日時はSupabase内部ではUTCで保存されているため、
// 管理者画面に表示・CSV出力する直前にこの関数で日本時間(Asia/Tokyo)の
// 文字列に変換する。JST変換をここに一本化することで、表示漏れを防ぐ。
export function formatJst(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}
