import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Supply-chain and release-integrity rules for the GitHub workflows (audit SEC-01 / SEC-05,
 * 2026-10-13). Text checks on purpose: no YAML parser dependency for a handful of invariants.
 */
const dir = resolve(import.meta.dirname, '../.github/workflows');
const files = readdirSync(dir).filter((f) => f.endsWith('.yml'));
const read = (f: string) => readFileSync(resolve(dir, f), 'utf8');

/** The lines of one job (from `  <name>:` to the next job at the same indentation). */
function job(text: string, name: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === `  ${name}:`);
  if (start < 0) throw new Error(`job ${name} not found`);
  const end = lines.findIndex((l, i) => i > start && /^ {2}[\w-]+:\s*$/.test(l));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

describe('GitHub workflows', () => {
  it('pin every action to a full commit SHA', () => {
    for (const f of files) {
      for (const line of read(f).split('\n')) {
        const m = /uses:\s*([^\s#]+)/.exec(line);
        if (!m?.[1]) continue;
        expect(m[1], `${f}: ${line.trim()}`).toMatch(/@[0-9a-f]{40}$/);
      }
    }
  });

  it('give the token read-only permissions by default', () => {
    for (const f of files) {
      expect(read(f), f).toMatch(/^permissions:\n {2}contents: read$/m);
    }
  });

  it('publish only commits that are already on main', () => {
    const release = read('release.yml');
    const check = job(release, 'check');
    expect(check).toContain('git merge-base --is-ancestor "${GITHUB_SHA}" origin/main');
    expect(check).toContain('"${GITHUB_REF}" != "refs/heads/main"');
  });

  it('sign and publish in the release environment, signing without npm install scripts', () => {
    const release = read('release.yml');
    const sign = job(release, 'web');
    expect(sign).toContain('environment: release');
    expect(sign).toContain('WEB_UPDATE_SIGNING_KEY');
    expect(sign).not.toMatch(/run:\s*npm (ci|install)/);
    expect(job(release, 'publish')).toContain('environment: release');
    // The signing key appears in that one job only.
    expect(release.split('WEB_UPDATE_SIGNING_KEY').length - 1).toBe(
      sign.split('WEB_UPDATE_SIGNING_KEY').length - 1,
    );
  });
});
