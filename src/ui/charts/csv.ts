/**
 * CSV with a UTF-8 BOM (Excel opens Vietnamese text correctly); empty cells for gaps. `note`, when
 * given, is a first line of its own (e.g. which stretch of a long run the rows hold).
 */
export function toCsv(header: string[], rows: (number | null)[][], note?: string): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = note ? [esc(note), header.map(esc).join(',')] : [header.map(esc).join(',')];
  for (const r of rows)
    lines.push(r.map((v) => (v !== null && Number.isFinite(v) ? String(v) : '')).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
