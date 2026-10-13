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

/** The lines of one step of a job (from `- name: <name>` to the next step of that job). */
function step(jobText: string, name: string): string {
  const lines = jobText.split('\n');
  const start = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  if (start < 0) throw new Error(`step ${name} not found`);
  const dash = lines[start]?.indexOf('-') ?? 0;
  const end = lines.findIndex(
    (l, i) => i > start && l.indexOf('- ') === dash && !l.slice(0, dash).trim(),
  );
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

/**
 * Write scopes a workflow may grant at the top level, i.e. to all its jobs (audit 2026-10-14).
 * Every other top-level scope must be `read` or `none`.
 */
const TOP_LEVEL_WRITES: Readonly<Record<string, readonly string[]>> = {
  // Its one job runs actions/deploy-pages, which needs the Pages write and the OIDC token.
  'pages.yml': ['pages', 'id-token'],
};

/** The top-level `permissions:` of a workflow as `scope → access` (`*` for read-all/write-all). */
function topPermissions(text: string): Record<string, string> | undefined {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('permissions:'));
  if (start < 0) return undefined;
  const inline = (lines[start] ?? '').slice('permissions:'.length).replace(/#.*$/, '').trim();
  if (inline === 'read-all' || inline === 'write-all') return { '*': inline.slice(0, -4) };
  let entries: string[];
  if (inline) {
    entries = inline.replace(/^\{|\}$/g, '').split(',');
  } else {
    // The block ends at the next top-level key (comment lines do not end it).
    const end = lines.findIndex((l, i) => i > start && /^[^\s#]/.test(l));
    entries = lines.slice(start + 1, end < 0 ? undefined : end);
  }
  const scopes: Record<string, string> = {};
  for (const entry of entries) {
    const body = entry.replace(/#.*$/, '').trim();
    if (!body) continue;
    const m = /^([\w-]+):\s*([\w-]+)$/.exec(body);
    if (!m?.[1] || !m[2]) throw new Error(`unreadable permissions entry: ${entry}`);
    scopes[m[1]] = m[2];
  }
  return scopes;
}

/** Top-level scopes of workflow `f` that are neither read-only nor allow-listed. */
function extraWrites(f: string, text: string): string[] {
  const scopes = topPermissions(text);
  if (!scopes) return ['no top-level permissions (the token gets the repository default)'];
  const allowed = TOP_LEVEL_WRITES[f] ?? [];
  return Object.entries(scopes)
    .filter(([scope, access]) => access !== 'read' && access !== 'none' && !allowed.includes(scope))
    .map(([scope, access]) => `${scope}: ${access}`);
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
      expect(extraWrites(f, read(f)), f).toEqual([]);
    }
  });

  it('notice every write scope in the top-level permissions', () => {
    const release = read('release.yml');
    const block = /^permissions:\n {2}contents: read$/m;
    const widened = release.replace(block, '$&\n  actions: write # added later');
    expect(widened).not.toBe(release);
    expect(extraWrites('release.yml', widened)).toEqual(['actions: write']);
    expect(extraWrites('release.yml', release.replace(block, 'permissions: write-all'))).toEqual([
      '*: write',
    ]);
    expect(
      extraWrites('release.yml', release.replace(block, 'permissions: { pages: write }')),
    ).toEqual(['pages: write']);
    expect(extraWrites('release.yml', release.replace(block, ''))).toHaveLength(1);
    // The pages.yml allow-list is for pages.yml only.
    expect(extraWrites('ci.yml', read('pages.yml'))).toEqual(['pages: write', 'id-token: write']);
  });

  it('publish only commits that are already on main', () => {
    const release = read('release.yml');
    const check = job(release, 'check');
    expect(check).toContain('git merge-base --is-ancestor "${GITHUB_SHA}" origin/main');
    expect(check).toContain('"${GITHUB_REF}" != "refs/heads/main"');
  });

  it('publish only to a version tag that already names this commit', () => {
    // softprops/action-gh-release attaches the release to an existing tag and ignores
    // target_commitish: a v<version> tag pushed earlier must point at this very commit.
    const release = read('release.yml');
    const guard = step(job(release, 'check'), 'Only reviewed code (already on main) is published');
    expect(guard).toContain("if: github.event_name == 'push' || inputs.publish");
    expect(guard).toContain(`v=$(node -p "require('./package.json').version")`);
    expect(guard).toContain('git ls-remote origin "refs/tags/v${v}" "refs/tags/v${v}^{}"');
    expect(guard).toContain('head=$(git rev-parse "${GITHUB_SHA}^{commit}")');
    expect(guard).toMatch(
      /if \[ -n "\$\{tag_commit\}" \] && \[ "\$\{tag_commit\}" != "\$\{head\}" \]; then\n\s+echo "::error::[^\n]+"; exit 1/,
    );
    expect(job(release, 'publish')).toContain('tag_name: v${{ needs.check.outputs.version }}');
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
