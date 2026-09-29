/** CSV with a UTF-8 BOM (Excel opens Vietnamese text correctly); empty cells for gaps. */
export function toCsv(header: string[], rows: (number | null)[][]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [header.map(esc).join(',')];
  for (const r of rows)
    lines.push(r.map((v) => (v !== null && Number.isFinite(v) ? String(v) : '')).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
