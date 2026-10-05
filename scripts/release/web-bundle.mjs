// Packs dist/ into a signed web update (docs/RELEASE.md).
//
//   WEB_UPDATE_SIGNING_KEY="-----BEGIN PRIVATE KEY-----…" node scripts/release/web-bundle.mjs
//
// Writes release/web-bundle.zip and release/web-update.json. The signed message must match
// `signed_message` in src-tauri/src/webupdate.rs.
import { execFileSync } from 'node:child_process';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = 'minhpdnfhh32934-cell/stem-sim-lab';
const root = resolve(import.meta.dirname, '../..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const conf = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const webVersion = pkg.version;
const minNative = conf.version;

const dist = resolve(root, 'dist');
const inner = readFileSync(resolve(dist, 'web-version.txt'), 'utf8').trim();
if (inner !== webVersion)
  throw new Error(`dist is ${inner}, package.json is ${webVersion}: rebuild`);
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('dist/index.html missing');

const pem = process.env.WEB_UPDATE_SIGNING_KEY;
if (!pem)
  throw new Error('WEB_UPDATE_SIGNING_KEY is not set (GitHub → Settings → Secrets → Actions)');
const key = createPrivateKey(pem);

const out = resolve(root, 'release');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
const zipPath = resolve(out, 'web-bundle.zip');
// -X: no extra file attributes, so the zip only depends on the file contents.
execFileSync('zip', ['-r', '-X', '-q', zipPath, '.'], { cwd: dist });

const zip = readFileSync(zipPath);
const manifest = {
  webVersion,
  minNative,
  sha256: createHash('sha256').update(zip).digest('hex'),
  size: zip.length,
  url: `https://github.com/${REPO}/releases/download/v${webVersion}/web-bundle.zip`,
  notes: process.env.RELEASE_NOTES ?? '',
  date: new Date().toISOString().slice(0, 10),
};
const message = [
  'stemsim-web-update',
  manifest.webVersion,
  manifest.minNative,
  manifest.sha256,
  String(manifest.size),
  manifest.url,
].join('\n');
manifest.signature = sign(null, Buffer.from(message), key).toString('base64');
writeFileSync(resolve(out, 'web-update.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`web update ${webVersion} (needs app ≥ ${minNative}): ${zip.length} bytes`);
