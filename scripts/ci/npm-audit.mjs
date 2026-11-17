// npm audit for CI (security.yml): fails on any high or critical advisory except the reviewed
// ones listed in .github/npm-audit-allow.json (id, package, reason, date). npm audit has no
// ignore list of its own. An allowed advisory that npm no longer reports prints a warning: its
// entry should then be removed.
// Usage: node scripts/ci/npm-audit.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOCKING = new Set(['high', 'critical']);

/** "https://github.com/advisories/GHSA-xxxx-xxxx-xxxx" → "GHSA-xxxx-xxxx-xxxx". */
export const advisoryId = (url) => /GHSA(-[0-9a-z]{4}){3}/i.exec(url ?? '')?.[0] ?? String(url);

/**
 * The advisories of an `npm audit --json` report (v7+ format), once each: the objects in each
 * vulnerability's `via` (strings there only name another vulnerable package).
 */
export function advisories(report) {
  const seen = new Map();
  for (const [pkg, v] of Object.entries(report?.vulnerabilities ?? {}))
    for (const via of v.via ?? [])
      if (typeof via === 'object' && via !== null) {
        const id = advisoryId(via.url);
        if (!seen.has(id))
          seen.set(id, { id, package: via.name ?? pkg, severity: via.severity, title: via.title });
      }
  return [...seen.values()];
}

/** The high/critical advisories not on the allow list, and allowed ids npm no longer reports. */
export function check(report, allow) {
  const ids = new Set(allow.map((a) => a.id));
  const all = advisories(report);
  return {
    blocking: all.filter((a) => BLOCKING.has(a.severity) && !ids.has(a.id)),
    allowed: all.filter((a) => ids.has(a.id)),
    stale: allow.filter((a) => !all.some((x) => x.id === a.id)).map((a) => a.id),
  };
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const allow = JSON.parse(readFileSync(resolve(root, '.github/npm-audit-allow.json'), 'utf8'));
  const run = spawnSync('npm', ['audit', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    console.error(`npm audit gave no report (exit ${String(run.status)}):\n${run.stderr}`);
    process.exit(1);
  }
  const r = check(report, allow);
  for (const a of r.allowed) console.log(`allowed (reviewed): ${a.id} ${a.package} — ${a.title}`);
  for (const id of r.stale)
    console.log(
      `::warning::${id} is no longer reported by npm audit: remove it from .github/npm-audit-allow.json`,
    );
  for (const a of r.blocking)
    console.log(`::error::${a.severity}: ${a.id} ${a.package} — ${a.title}`);
  console.log(`${String(r.blocking.length)} blocking advisories (high or critical, not allowed).`);
  process.exit(r.blocking.length > 0 ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
