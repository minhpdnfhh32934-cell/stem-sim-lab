// @vitest-environment node
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { afterAll, describe, expect, it } from 'vitest';
import { signedMessageV2 } from '../scripts/release/manifest-message.mjs';

/**
 * Supply-chain and release-integrity rules for the GitHub workflows (audit SEC-01 / SEC-05,
 * 2026-10-13; workflow hygiene 2026-10-14). Text checks on purpose: no YAML parser dependency for
 * a handful of invariants.
 */
const root = resolve(import.meta.dirname, '..');
const dir = resolve(root, '.github/workflows');
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

/** The names of the jobs of a workflow. */
function jobNames(text: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  const names: string[] = [];
  for (const l of lines.slice(start + 1)) {
    if (/^[^\s#]/.test(l)) break;
    const m = /^ {2}([\w-]+):\s*$/.exec(l);
    if (m?.[1]) names.push(m[1]);
  }
  return names;
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

/** Every step of a job, named or not (`- uses: …` and `- run: …` included). */
function steps(jobText: string): string[] {
  const lines = jobText.split('\n');
  const start = lines.findIndex((l) => /^\s+steps:\s*$/.test(l));
  if (start < 0) return [];
  const first = lines.slice(start + 1).find((l) => /^\s*- /.test(l));
  const dash = first?.indexOf('-') ?? -1;
  const out: string[][] = [];
  for (const l of lines.slice(start + 1)) {
    if (l.trim() && !l.trim().startsWith('#') && l.search(/\S/) < dash) break;
    if (l.indexOf('- ') === dash && !l.slice(0, dash).trim()) out.push([l]);
    else out.at(-1)?.push(l);
  }
  return out.map((s) => s.join('\n'));
}

/** The script of every `run:` key of a workflow: the inline value or the whole block scalar. */
function runScripts(text: string): string[] {
  const lines = text.split('\n');
  const out: string[] = [];
  lines.forEach((line, i) => {
    const m = /^(\s*)(- )?run:(.*)$/.exec(line);
    if (!m) return;
    const keyIndent = (m[1] ?? '').length + (m[2] ? 2 : 0);
    const value = (m[3] ?? '').trim();
    if (!/^[|>]/.test(value)) {
      out.push(value);
      return;
    }
    const body: string[] = [];
    for (const l of lines.slice(i + 1)) {
      if (l.trim() && l.search(/\S/) <= keyIndent) break;
      body.push(l);
    }
    out.push(body.join('\n'));
  });
  return out;
}

/** A block scalar's text without its common indentation. */
function dedent(block: string): string {
  const lines = block.split('\n');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.search(/\S/)));
  return lines.map((l) => l.slice(indent)).join('\n');
}

/**
 * Write scopes a workflow may grant at the top level, i.e. to all its jobs (audit 2026-10-14).
 * Every other top-level scope must be `read` or `none`.
 */
const TOP_LEVEL_WRITES: Readonly<Record<string, readonly string[]>> = {
  // Its one job runs actions/deploy-pages, which needs the Pages write and the OIDC token.
  'pages.yml': ['pages', 'id-token'],
};

/**
 * Write scopes one job may add (`<workflow>/<job>` → scopes). Only the job that creates the
 * GitHub Release writes to the repository; it checks nothing out and runs no project code.
 */
const JOB_WRITES: Readonly<Record<string, readonly string[]>> = {
  'release.yml/publish': ['contents'],
};

/**
 * Checkouts allowed to keep the job token in `.git/config` (`<workflow>/<job>`). None: no
 * workflow pushes to the repository.
 */
const CHECKOUT_KEEPS_TOKEN: readonly string[] = [];

/**
 * The `permissions:` block at one indentation (`''` = the workflow, 4 spaces = inside a job) as
 * `scope → access` (`*` for read-all/write-all).
 */
function permissionsAt(text: string, indent: string): Record<string, string> | undefined {
  const lines = text.split('\n');
  const key = `${indent}permissions:`;
  const start = lines.findIndex((l) => l.startsWith(key));
  if (start < 0) return undefined;
  const inline = (lines[start] ?? '').slice(key.length).replace(/#.*$/, '').trim();
  if (inline === 'read-all' || inline === 'write-all') return { '*': inline.slice(0, -4) };
  let entries: string[];
  if (inline) {
    entries = inline.replace(/^\{|\}$/g, '').split(',');
  } else {
    // The block ends at the next key at the same or a lower indentation (comments do not end it).
    const end = lines.findIndex(
      (l, i) =>
        i > start && !!l.trim() && !l.trim().startsWith('#') && l.search(/\S/) <= indent.length,
    );
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

/** The top-level `permissions:` of a workflow as `scope → access` (`*` for read-all/write-all). */
const topPermissions = (text: string) => permissionsAt(text, '');

/** Top-level scopes of workflow `f` that are neither read-only nor allow-listed. */
function extraWrites(f: string, text: string): string[] {
  const scopes = topPermissions(text);
  if (!scopes) return ['no top-level permissions (the token gets the repository default)'];
  const allowed = TOP_LEVEL_WRITES[f] ?? [];
  return Object.entries(scopes)
    .filter(([scope, access]) => access !== 'read' && access !== 'none' && !allowed.includes(scope))
    .map(([scope, access]) => `${scope}: ${access}`);
}

/** Job-level write scopes of workflow `f` that are not allow-listed, as `<job>: <scope>`. */
function extraJobWrites(f: string, text: string): string[] {
  const out: string[] = [];
  for (const name of jobNames(text)) {
    const scopes = permissionsAt(job(text, name), '    ') ?? {};
    const allowed = JOB_WRITES[`${f}/${name}`] ?? [];
    for (const [scope, access] of Object.entries(scopes)) {
      if (access === 'write' && !allowed.includes(scope)) out.push(`${name}: ${scope}`);
    }
  }
  return out;
}

/** The jobs of workflow `f` with an `actions/checkout` step that keeps the token. */
function checkoutsKeepingToken(f: string, text: string): string[] {
  const out: string[] = [];
  for (const name of jobNames(text)) {
    for (const s of steps(job(text, name))) {
      if (!/uses:\s*actions\/checkout@/.test(s)) continue;
      if (/^\s+persist-credentials:\s*false\s*(#.*)?$/m.test(s)) continue;
      if (!CHECKOUT_KEEPS_TOKEN.includes(`${f}/${name}`)) out.push(name);
    }
  }
  return out;
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

  it('let only the release publish job write to the repository', () => {
    for (const f of files) {
      expect(extraJobWrites(f, read(f)), f).toEqual([]);
    }
    const release = read('release.yml');
    expect(permissionsAt(job(release, 'publish'), '    ')).toEqual({ contents: 'write' });
    // A write scope added to another job is noticed, in block and inline form.
    const signJob = /^ {2}web:\n/m;
    const widened = release.replace(signJob, '$&    permissions:\n      contents: write\n');
    expect(widened).not.toBe(release);
    expect(extraJobWrites('release.yml', widened)).toEqual(['web: contents']);
    expect(
      extraJobWrites(
        'release.yml',
        release.replace(signJob, '$&    permissions: { actions: write }\n'),
      ),
    ).toEqual(['web: actions']);
  });

  it('use no trigger that runs with secrets on untrusted input', () => {
    for (const f of files) {
      const code = read(f)
        .split('\n')
        .map((l) => l.replace(/#.*$/, ''))
        .join('\n');
      expect(code, f).not.toMatch(/\b(pull_request_target|workflow_run|issue_comment)\b/);
    }
  });

  it('never put a ${{ }} expression inside a run script (expression injection)', () => {
    for (const f of files) {
      for (const script of runScripts(read(f))) {
        expect(script, `${f}: ${script}`).not.toContain('${{');
      }
    }
    // The scan sees inline values and block scalars.
    const ci = read('ci.yml');
    const inline = ci.replace('- run: npm ci', '- run: echo ${{ github.head_ref }}');
    expect(runScripts(inline).some((s) => s.includes('${{'))).toBe(true);
    const block = ci.replace(
      '- run: npm ci',
      '- run: |\n          npm ci\n          echo "${{ github.event.pull_request.title }}"',
    );
    expect(runScripts(block).some((s) => s.includes('${{'))).toBe(true);
  });

  it('never leave the job token in .git/config after a checkout', () => {
    for (const f of files) {
      expect(checkoutsKeepingToken(f, read(f)), f).toEqual([]);
    }
    const ci = read('ci.yml');
    const opened = ci.replace(/\n {10}persist-credentials: false/, '');
    expect(opened).not.toBe(ci);
    expect(checkoutsKeepingToken('ci.yml', opened)).toHaveLength(1);
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

  it('restore no cache into the jobs of the release environment', () => {
    // Caches are written by other runs; signing and publishing use only this commit's files and
    // this run's artifacts.
    const release = read('release.yml');
    for (const name of ['web', 'publish']) {
      expect(job(release, name), name).not.toMatch(/^\s+cache:|actions\/cache@|rust-cache@/m);
    }
  });

  it('run one release at a time and never cancel one half-way', () => {
    const lines = read('release.yml').split('\n');
    const start = lines.findIndex((l) => /^concurrency:\s*$/.test(l));
    expect(start).toBeGreaterThanOrEqual(0);
    const end = lines.findIndex((l, i) => i > start && /^[^\s#]/.test(l));
    const block = lines.slice(start + 1, end).join('\n');
    expect(block).toMatch(/^ {2}group: release\s*$/m);
    expect(block).not.toMatch(/cancel-in-progress:\s*true/);
  });

  it('publish SHA-256 checksums of the installers with the release', () => {
    const publish = job(read('release.yml'), 'publish');
    const sums = step(publish, 'Installer checksums');
    expect(sums).toContain('sha256sum -- *.exe *.msi');
    expect(sums).toContain('SHA256SUMS.txt');
    expect(publish).toMatch(/^\s+out\/SHA256SUMS\.txt$/m);
    // The checksums are made before the release is created.
    expect(publish.indexOf('Installer checksums')).toBeLessThan(
      publish.indexOf('softprops/action-gh-release@'),
    );
  });
});

/**
 * The mandatory-update floor step of release.yml carries the `minRequired` of the latest release
 * into the next signed manifest. Anyone with write access can edit a release, so a floor is
 * carried only when the latest manifest verifies with the app's own key and message format.
 * These tests run the step's Node script (its heredoc) on real and forged manifests.
 */
describe('release.yml: mandatory-update floor', () => {
  const floorStep = step(job(read('release.yml'), 'web'), 'Mandatory-update floor');
  const run = dedent(runScripts(floorStep)[0] ?? '');
  const script = /<<'JS'\n([\s\S]*?)\nJS\n/.exec(run)?.[1] ?? '';

  const work = mkdtempSync(resolve(tmpdir(), 'floor-'));
  afterAll(() => {
    rmSync(work, { recursive: true, force: true });
  });

  /** A minimal repository copy whose webupdate.rs holds `key` (the script reads both files). */
  function fakeRepo(key: KeyObject): string {
    const repo = mkdtempSync(resolve(work, 'repo-'));
    mkdirSync(resolve(repo, 'scripts/release'), { recursive: true });
    mkdirSync(resolve(repo, 'src-tauri/src'), { recursive: true });
    copyFileSync(
      resolve(root, 'scripts/release/manifest-message.mjs'),
      resolve(repo, 'scripts/release/manifest-message.mjs'),
    );
    const x = String(key.export({ format: 'jwk' }).x);
    const b64 = Buffer.from(x, 'base64url').toString('base64');
    writeFileSync(
      resolve(repo, 'src-tauri/src/webupdate.rs'),
      `const PUBLIC_KEY_B64: &str = "${b64}";\n`,
    );
    return repo;
  }

  let n = 0;
  /** Runs the floor script in `cwd` on `manifest` (undefined = download failed), as the step does. */
  function floor(cwd: string, manifest: object | undefined) {
    const file = resolve(work, `manifest-${n++}.json`);
    if (manifest) writeFileSync(file, JSON.stringify(manifest));
    const r = spawnSync(process.execPath, ['--input-type=module', '-'], {
      cwd,
      input: script,
      encoding: 'utf8',
      env: { ...process.env, LATEST_MANIFEST: file },
    });
    return { status: r.status, out: r.stdout, err: r.stderr };
  }

  const release = generateKeyPairSync('ed25519');
  const stranger = generateKeyPairSync('ed25519');
  const repo = fakeRepo(release.publicKey);
  const base = {
    webVersion: '0.6.1',
    minNative: '0.6.0',
    sha256: 'ab'.repeat(32),
    size: 1234,
    url: 'https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/download/v0.6.1/web-bundle.zip',
    edition: 'main',
  };
  const signed = (m: typeof base & { minRequired: string }, key = release.privateKey) => ({
    ...m,
    signatureV2: sign(null, Buffer.from(signedMessageV2(m)), key).toString('base64'),
  });

  it('is the Node heredoc the step runs on the downloaded manifest', () => {
    expect(script).toContain('signedMessageV2');
    expect(run).toMatch(/v=\$\(LATEST_MANIFEST="\$latest" node --input-type=module - <<'JS'/);
    // The unchecked read of the old step is gone.
    expect(floorStep).not.toContain('JSON.parse(s).minRequired');
  });

  it('carries forward a floor signed with the release key', () => {
    expect(floor(repo, signed({ ...base, minRequired: '0.6.0' }))).toEqual({
      status: 0,
      out: '0.6.0',
      err: '',
    });
  });

  it('ignores a floor that is not signed, with a warning', () => {
    const raised = { ...signed({ ...base, minRequired: '' }), minRequired: '0.6.1' };
    const r = floor(repo, raised);
    expect(r).toMatchObject({ status: 0, out: '' });
    expect(r.err).toContain('::warning::');
    const unsigned = { ...base, minRequired: '0.6.0' };
    expect(floor(repo, unsigned)).toMatchObject({ status: 0, out: '' });
    expect(floor(repo, { ...unsigned, signatureV2: 'not base64 at all' })).toMatchObject({
      status: 0,
      out: '',
    });
    const foreign = floor(repo, signed({ ...base, minRequired: '0.6.0' }, stranger.privateKey));
    expect(foreign).toMatchObject({ status: 0, out: '' });
    expect(foreign.err).toContain('::warning::');
  });

  it('has no floor without a readable manifest or without minRequired', () => {
    const missing = floor(repo, undefined);
    expect(missing).toMatchObject({ status: 0, out: '' });
    expect(missing.err).toContain('::notice::');
    expect(floor(repo, signed({ ...base, minRequired: '' }))).toEqual({
      status: 0,
      out: '',
      err: '',
    });
  });

  it('verifies with the key compiled into the app (published v0.5.2 manifest)', () => {
    // web-update.json of release v0.5.2 as published (the notes are not signed: shortened here).
    // If the release key is ever rotated, replace this with a manifest signed by the new key.
    const published = {
      webVersion: '0.5.2',
      minNative: '0.5.1',
      sha256: 'b05be422fcdbbcc092739e584663cc5c626b43a8869c329d5e140762c1ec490a',
      size: 18244185,
      url: 'https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/download/v0.5.2/web-bundle.zip',
      notes: '…',
      date: '2026-10-13',
      edition: 'main',
      minRequired: '',
      signature:
        'DO5aQl5Eo5h2IdKAPufOmSbukC0G/VFKy8BDo+7UHaX7HBzTk+I+v1rZrR+L7T4GsSiTz0ECdlAbSxVIsubqDA==',
      signatureV2:
        'mU6Pcea5boY9V+BJrDn0qWyDHO5iHILM9EzDVJXAkkwL22voenN2DdhwVI2EVgrXRmDdRyqWLgEF6Hu9pbbOBw==',
    };
    expect(floor(root, published)).toEqual({ status: 0, out: '', err: '' });
    // The same release with a floor added afterwards (attack E of the 2026-10-14 review).
    const forged = floor(root, { ...published, minRequired: '0.5.2' });
    expect(forged).toMatchObject({ status: 0, out: '' });
    expect(forged.err).toContain('::warning::');
    // A floor signed with any other key is not trusted either.
    expect(floor(root, signed({ ...base, minRequired: '0.6.0' })).out).toBe('');
  });
});

describe('dependency checks', () => {
  it('fail cargo audit on any unsound or yanked crate except the two reviewed GTK3 notices', () => {
    const audit = job(read('security.yml'), 'cargo-audit');
    const commands = runScripts(audit).filter((s) => s.startsWith('cargo audit'));
    expect(commands).toEqual(['cargo audit --deny unsound --deny yanked']);
    // cargo-audit reads <working directory>/.cargo/audit.toml; a src-tauri/audit.toml is ignored.
    const config = readFileSync(resolve(root, 'src-tauri/.cargo/audit.toml'), 'utf8');
    const ignore = /^ignore\s*=\s*\[([^\]]*)\]/m.exec(config.replace(/#.*$/gm, ''))?.[1] ?? '';
    expect(ignore.match(/RUSTSEC-\d{4}-\d{4}/g)).toEqual([
      'RUSTSEC-2024-0429',
      'RUSTSEC-2024-0370',
    ]);
  });

  it('let Dependabot wait a week before proposing a new version, grouped', () => {
    const text = readFileSync(resolve(root, '.github/dependabot.yml'), 'utf8');
    const updates = text.split(/^ {2}- package-ecosystem:/m).slice(1);
    expect(updates).toHaveLength(3);
    for (const u of updates) {
      const days = /^ {4}cooldown:\n {6}default-days: (\d+)\s*$/m.exec(u)?.[1];
      expect(Number(days), u).toBeGreaterThanOrEqual(7);
      expect(u).toMatch(/^ {4}groups:$/m);
    }
  });

  it('give the release-critical paths a code owner', () => {
    const path = resolve(root, '.github/CODEOWNERS');
    expect(existsSync(path)).toBe(true);
    const rules = readFileSync(path, 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/));
    for (const [, ...owners] of rules) expect(owners).toEqual(['@minhpdnfhh32934-cell']);
    const patterns = rules.map(([p]) => p);
    for (const p of [
      '/.github/',
      '/scripts/release/',
      '/src-tauri/src/webupdate.rs',
      '/src-tauri/tauri.conf.json',
      '/src-tauri/capabilities/',
      '/src-tauri/.cargo/',
      '/package.json',
      '/package-lock.json',
      '/scripts/copy-ort-wasm.mjs',
      '/vite.config.ts',
    ]) {
      expect(patterns, p).toContain(p);
    }
  });
});
