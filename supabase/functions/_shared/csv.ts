// 全フィールドを常にダブルクォートする単純な実装。
// カンマ・改行・引用符を含む日本語自由記述(diagnosis_note等)でも壊れないようにするため、
// 条件分岐でのエスケープ判定はせず、常時クォートする方針にしている。
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(escapeCsvField).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvField(row[c])).join(","));
  return [header, ...lines].join("\r\n");
}
