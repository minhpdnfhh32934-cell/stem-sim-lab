export interface Advisory {
  id: string;
  package: string;
  severity: string;
  title: string;
}
export interface AllowEntry {
  id: string;
  package: string;
  reviewed: string;
  reason: string;
}
export function advisoryId(url: string | undefined): string;
export function advisories(report: unknown): Advisory[];
export function check(
  report: unknown,
  allow: readonly AllowEntry[],
): { blocking: Advisory[]; allowed: Advisory[]; stale: string[] };
