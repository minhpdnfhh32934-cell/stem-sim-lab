// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Version numbers of the two parts of the app (docs/RELEASE.md, "Quy tắc số phiên bản").
 *
 * - Web part: package.json.
 * - Native part: src-tauri/tauri.conf.json, src-tauri/Cargo.toml and the root package in
 *   src-tauri/Cargo.lock. They must be equal: the app reports CARGO_PKG_VERSION as its native
 *   version (webupdate.rs), while the update's minNative and the MSIX version come from
 *   tauri.conf.json. If they differed, an app could refuse its own release.
 * - A Rust change bumps both parts to the same number and a web-only change bumps package.json
 *   alone, so the native version is never newer than the web version.
 */
const root = resolve(import.meta.dirname, '..');
const text = (path: string) => readFileSync(resolve(root, path), 'utf8');

interface Versions {
  web: string | undefined;
  tauriConf: string | undefined;
  cargoToml: string | undefined;
  cargoLock: string | undefined;
}

/** `version` of the `[package]` table of a Cargo.toml, and its `name`. */
function cargoPackage(toml: string): { name?: string; version?: string } {
  const table = /^\[package\]\s*$([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(toml)?.[1] ?? '';
  const field = (key: string) => new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm').exec(table)?.[1];
  const out: { name?: string; version?: string } = {};
  const name = field('name');
  const version = field('version');
  if (name !== undefined) out.name = name;
  if (version !== undefined) out.version = version;
  return out;
}

/** Version of package `name` in a Cargo.lock (undefined when it is missing or listed twice). */
function lockVersion(lock: string, name: string): string | undefined {
  const entries = lock
    .split(/^\[\[package\]\]\s*$/m)
    .filter((e) => new RegExp(`^name = "${name}"\\s*$`, 'm').test(e));
  if (entries.length !== 1) return undefined;
  return /^version = "([^"]*)"\s*$/m.exec(entries[0] ?? '')?.[1];
}

const parse = (v: string) => v.split('.').map(Number);

/** Every broken rule, in words (empty when the versions agree). */
function versionProblems(v: Versions): string[] {
  const problems: string[] = [];
  for (const where of ['web', 'tauriConf', 'cargoToml', 'cargoLock'] as const) {
    const value = v[where];
    if (!value || !/^\d+\.\d+\.\d+$/.test(value)) {
      problems.push(`${where}: "${value ?? 'missing'}" is not x.y.z`);
    }
  }
  if (problems.length) return problems;
  const { web = '', tauriConf = '', cargoToml = '', cargoLock = '' } = v;
  if (cargoToml !== tauriConf) {
    problems.push(`Cargo.toml ${cargoToml} differs from tauri.conf.json ${tauriConf}`);
  }
  if (cargoLock !== cargoToml) {
    problems.push(`Cargo.lock ${cargoLock} differs from Cargo.toml ${cargoToml} (run cargo build)`);
  }
  const [w, n] = [parse(web), parse(tauriConf)];
  const diff = [0, 1, 2].map((i) => (w[i] ?? 0) - (n[i] ?? 0)).find((d) => d !== 0) ?? 0;
  if (diff < 0) {
    problems.push(`native ${tauriConf} is newer than web ${web}: bump package.json to it too`);
  }
  return problems;
}

function repoVersions(): Versions {
  const toml = cargoPackage(text('src-tauri/Cargo.toml'));
  const pkg = JSON.parse(text('package.json')) as { version?: string };
  const conf = JSON.parse(text('src-tauri/tauri.conf.json')) as { version?: string };
  return {
    web: pkg.version,
    tauriConf: conf.version,
    cargoToml: toml.version,
    cargoLock: lockVersion(text('src-tauri/Cargo.lock'), toml.name ?? ''),
  };
}

describe('version numbers', () => {
  it('agree between the web part and the native part files', () => {
    const versions = repoVersions();
    expect(cargoPackage(text('src-tauri/Cargo.toml')).name).toBe('stem-sim-lab');
    expect(versionProblems(versions)).toEqual([]);
  });

  it('notice a native file left behind, a stale Cargo.lock and a native part ahead of the web', () => {
    const ok = { web: '0.6.1', tauriConf: '0.6.0', cargoToml: '0.6.0', cargoLock: '0.6.0' };
    expect(versionProblems(ok)).toEqual([]);
    expect(versionProblems({ ...ok, web: '0.6.0' })).toEqual([]);
    expect(versionProblems({ ...ok, tauriConf: '0.6.1' })).toEqual([
      'Cargo.toml 0.6.0 differs from tauri.conf.json 0.6.1',
    ]);
    expect(versionProblems({ ...ok, cargoLock: '0.5.1' })).toHaveLength(1);
    expect(
      versionProblems({ web: '0.6.0', tauriConf: '0.7.0', cargoToml: '0.7.0', cargoLock: '0.7.0' }),
    ).toHaveLength(1);
    // Numeric, not text, comparison: 0.10.0 is newer than 0.9.0.
    expect(
      versionProblems({
        web: '0.10.0',
        tauriConf: '0.9.0',
        cargoToml: '0.9.0',
        cargoLock: '0.9.0',
      }),
    ).toEqual([]);
    expect(versionProblems({ ...ok, cargoLock: undefined })).toEqual([
      'cargoLock: "missing" is not x.y.z',
    ]);
  });

  it('read the root package of Cargo.toml and Cargo.lock, not a dependency', () => {
    const toml = '[package]\nname = "app"\nversion = "1.2.3"\n\n[dependencies]\nversion = "9"\n';
    expect(cargoPackage(toml)).toEqual({ name: 'app', version: '1.2.3' });
    const lock =
      'version = 4\n\n[[package]]\nname = "app-helper"\nversion = "5.0.0"\n\n' +
      '[[package]]\nname = "app"\nversion = "1.2.3"\ndependencies = [\n "app-helper",\n]\n';
    expect(lockVersion(lock, 'app')).toBe('1.2.3');
    expect(lockVersion(lock, 'missing')).toBeUndefined();
  });
});
