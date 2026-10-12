/** Helpers for the board diagrams (kept apart from the components for React fast refresh). */

/** Direction of a force from its usual name (P/mg down, N up, F right, Fms left, T up). */
export function forceAngle(name: string): number {
  const n = name.toLowerCase().replace(/[\s_{}\\]/g, '');
  if (/^(phảnlực|n|q)/.test(n)) return -Math.PI / 2;
  if (/^(fms|ms|lựcmasát|masát)/.test(n)) return Math.PI;
  if (/^(trọnglực|p|mg|w|fg)/.test(n)) return Math.PI / 2;
  if (/^(lựccăng|t)/.test(n)) return -Math.PI / 2 + 0.6;
  return 0;
}
