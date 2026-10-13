/**
 * Wraps the Tauri executable in an MSIX package for the Microsoft Store (Windows only).
 *
 *   npx tauri build --no-bundle          # builds src-tauri/target/release/stem-sim-lab.exe
 *   node scripts/store/make-msix.mjs     # → store/out/SimLab_<version>.0_x64.msix
 *
 * Options:
 *   --exe <path>   executable to package (default: src-tauri/target/release/stem-sim-lab.exe;
 *                  CARGO_TARGET_DIR is honoured)
 *   --out <dir>    output folder (default: store/out)
 *   --test         use a local test identity instead of store/identity.json (the package can
 *                  then be registered on this PC for a try-out; it cannot go to the Store)
 *
 * The package is not signed: Microsoft signs it after Store certification. Needs makeappx.exe
 * from the Windows SDK (found automatically, or set MAKEAPPX). Steps: docs/STORE.md.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSETS, buildManifest, checkIdentity, msixVersion } from './manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const test = args.includes('--test');

const LOCAL_TEST = {
  identityName: 'SimLab.LocalTest',
  publisher: 'CN=SimLab Local Test',
  publisherDisplayName: 'SimLab (local test)',
};

function fail(message) {
  console.error(`make-msix: ${message}`);
  process.exit(1);
}

function findMakeappx() {
  if (process.env.MAKEAPPX) return process.env.MAKEAPPX;
  const kits = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (!existsSync(kits)) return null;
  const versions = readdirSync(kits)
    .filter((d) => /^10\.\d+\.\d+\.\d+$/.test(d))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .reverse();
  for (const v of versions) {
    const exe = join(kits, v, 'x64', 'makeappx.exe');
    if (existsSync(exe)) return exe;
  }
  return null;
}

const identity = test
  ? LOCAL_TEST
  : JSON.parse(readFileSync(join(root, 'store', 'identity.json'), 'utf8'));
const problems = checkIdentity(identity);
if (problems.length) {
  fail(
    `store/identity.json is not filled in yet:\n  - ${problems.join('\n  - ')}\n` +
      'Copy the values from Partner Center (docs/STORE.md, step 3), or use --test for a local try-out.',
  );
}

const version = JSON.parse(
  readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'),
).version;
const targetDir = process.env.CARGO_TARGET_DIR ?? join(root, 'src-tauri', 'target');
const exe = resolve(option('--exe') ?? join(targetDir, 'release', 'stem-sim-lab.exe'));
if (!existsSync(exe)) fail(`${exe} not found — run "npx tauri build --no-bundle" first`);
const makeappx = findMakeappx();
if (!makeappx) fail('makeappx.exe not found: install the Windows SDK or set MAKEAPPX');

const out = resolve(option('--out') ?? join(root, 'store', 'out'));
const layout = join(out, test ? 'layout-test' : 'layout');
rmSync(layout, { recursive: true, force: true });
mkdirSync(join(layout, 'Assets'), { recursive: true });
copyFileSync(exe, join(layout, 'stem-sim-lab.exe'));
for (const asset of ASSETS) {
  copyFileSync(join(root, 'src-tauri', 'icons', asset), join(layout, 'Assets', asset));
}
writeFileSync(join(layout, 'AppxManifest.xml'), buildManifest({ ...identity, version }), 'utf8');

const file = join(out, `SimLab_${msixVersion(version)}_x64${test ? '_test' : ''}.msix`);
try {
  execFileSync(makeappx, ['pack', '/o', '/h', 'SHA256', '/d', layout, '/p', file], {
    stdio: 'inherit',
  });
} catch {
  fail('makeappx could not build the package (see its message above)');
}
console.log(`make-msix: ${file}`);
