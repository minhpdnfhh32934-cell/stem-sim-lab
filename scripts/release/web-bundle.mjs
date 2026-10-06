// Packs dist/ into a signed web update (docs/RELEASE.md).
//
//   WEB_UPDATE_SIGNING_KEY="-----BEGIN PRIVATE KEY-----…" node scripts/release/web-bundle.mjs [main|pilot]
//
// Two update channels, one per edition (PROMPT_PHAN_2 3b.6):
//   main  → release/web-bundle.zip       + release/web-update.json
//   pilot → release/web-bundle-pilot.zip + release/web-update-pilot.json
// dist/ must have been built for that edition (dist/web-edition.txt). The signed message must
// match `signed_message` in src-tauri/src/webupdate.rs (main keeps the original format, other
// editions add an "edition:" line, so a manifest can never be moved to the other channel).
import { execFileSync } from 'node:child_process';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signedMessage, signedMessageV2 } from './manifest-message.mjs';

const REPO = 'minhpdnfhh32934-cell/stem-sim-lab';
const edition = process.argv[2] ?? 'main';
if (!['main', 'pilot'].includes(edition)) throw new Error(`unknown edition ${edition}`);
const suffix = edition === 'main' ? '' : `-${edition}`;
// Mandatory-update floor: learners on an older web part must update (empty = none).
const minRequired = (process.env.MIN_REQUIRED ?? '').trim();
if (minRequired && !/^\d+\.\d+\.\d+$/.test(minRequired))
  throw new Error(`MIN_REQUIRED must look like 1.2.3, got "${minRequired}"`);

const root = resolve(import.meta.dirname, '../..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const conf = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const webVersion = pkg.version;
const minNative = conf.version;
const num = (v) => v.split('.').map(Number);
const older = (a, b) => {
  const [x, y] = [num(a), num(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
};
// The app refuses a floor above the release itself (nobody could ever satisfy it).
if (minRequired && older(webVersion, minRequired))
  throw new Error(`MIN_REQUIRED ${minRequired} is newer than this release ${webVersion}`);

const dist = resolve(root, 'dist');
const inner = readFileSync(resolve(dist, 'web-version.txt'), 'utf8').trim();
if (inner !== webVersion)
  throw new Error(`dist is ${inner}, package.json is ${webVersion}: rebuild`);
const built = readFileSync(resolve(dist, 'web-edition.txt'), 'utf8').trim();
if (built !== edition) throw new Error(`dist/ was built for ${built}, not ${edition}: rebuild`);
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('dist/index.html missing');

const pem = process.env.WEB_UPDATE_SIGNING_KEY;
if (!pem)
  throw new Error('WEB_UPDATE_SIGNING_KEY is not set (GitHub → Settings → Secrets → Actions)');
const key = createPrivateKey(pem);

const out = resolve(root, 'release');
mkdirSync(out, { recursive: true });
const zipName = `web-bundle${suffix}.zip`;
const zipPath = resolve(out, zipName);
rmSync(zipPath, { force: true });
// -X: no extra file attributes, so the zip only depends on the file contents.
execFileSync('zip', ['-r', '-X', '-q', zipPath, '.'], { cwd: dist });

const zip = readFileSync(zipPath);
const manifest = {
  webVersion,
  minNative,
  sha256: createHash('sha256').update(zip).digest('hex'),
  size: zip.length,
  url: `https://github.com/${REPO}/releases/download/v${webVersion}/${zipName}`,
  notes: process.env.RELEASE_NOTES ?? '',
  date: new Date().toISOString().slice(0, 10),
  edition,
  minRequired,
};
const sig = (message) => sign(null, Buffer.from(message), key).toString('base64');
manifest.signature = sig(signedMessage(manifest));
manifest.signatureV2 = sig(signedMessageV2(manifest));
writeFileSync(resolve(out, `web-update${suffix}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `web update ${webVersion} [${edition}] (needs app ≥ ${minNative}` +
    `${minRequired ? `, required from ${minRequired}` : ''}): ${zip.length} bytes`,
);
