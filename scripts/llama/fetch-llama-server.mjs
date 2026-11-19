/**
 * Fetches the pinned llama.cpp Vulkan build for "Qwen trong app" (#190) and keeps only what
 * `llama-server` needs, in src-tauri/binaries/llama-server/ (bundled by tauri.conf.json
 * `bundle.resources`; the folder is git-ignored except the llama.cpp licence).
 *
 *   node scripts/llama/fetch-llama-server.mjs     # download, check SHA-256, extract
 *
 * Nothing is replaced when the folder already holds this pin. Pins: docs/AI_TUTOR.md
 * "Qwen 3.5 9B inside the app". Windows only (the zip holds Windows x64 programs).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const LLAMA = {
  tag: 'b12246',
  commit: '78ffbaa18533c2ed51eab2ef5ae0702330efc3e9',
  file: 'llama-b12246-bin-win-vulkan-x64.zip',
  size: 37892147,
  sha256: 'ca8cfe89b00fd447ac3b816d095871bc9b6ca9835fd96e06238a9ff5d1640639',
};
export const URL = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA.tag}/${LLAMA.file}`;

/** `llama-server.exe` only starts `llama-server-impl.dll`; ggml loads its backends from the folder. */
export const KEEP = [
  'llama-server.exe',
  'llama-server-impl.dll',
  'llama-common.dll',
  'llama.dll',
  'mtmd.dll',
  'ggml.dll',
  'ggml-base.dll',
  'ggml-vulkan.dll',
  // ggml picks the CPU variant for the learner's processor at start-up: all of them ship.
  'ggml-cpu-x64.dll',
  'ggml-cpu-sse42.dll',
  'ggml-cpu-sandybridge.dll',
  'ggml-cpu-ivybridge.dll',
  'ggml-cpu-piledriver.dll',
  'ggml-cpu-haswell.dll',
  'ggml-cpu-skylakex.dll',
  'ggml-cpu-cannonlake.dll',
  'ggml-cpu-cascadelake.dll',
  'ggml-cpu-icelake.dll',
  'ggml-cpu-cooperlake.dll',
  'ggml-cpu-alderlake.dll',
  'ggml-cpu-zen4.dll',
  'ggml-cpu-sapphirerapids.dll',
  'libomp.dll',
  'LICENSE-LLVM-OpenMP',
];

/** Written last: the folder holds a complete copy of this pin. */
export const STAMP = '.pinned';

export function checkZip(bytes, pin = LLAMA) {
  if (bytes.length !== pin.size) {
    throw new Error(`${pin.file}: ${String(bytes.length)} bytes, expected ${String(pin.size)}`);
  }
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== pin.sha256) throw new Error(`${pin.file}: SHA-256 ${sha}, expected ${pin.sha256}`);
}

/** True when `dir` already holds every kept file of this pin. */
export function isCurrent(dir, pin = LLAMA) {
  const stamp = join(dir, STAMP);
  return (
    existsSync(stamp) &&
    readFileSync(stamp, 'utf8').trim() === pin.sha256 &&
    KEEP.every((f) => existsSync(join(dir, f)))
  );
}

async function main() {
  if (process.platform !== 'win32') throw new Error('llama-server is fetched on Windows only');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const dest = join(root, 'src-tauri', 'binaries', 'llama-server');
  if (isCurrent(dest)) {
    console.log(`llama-server ${LLAMA.tag}: already in ${dest}`);
    return;
  }
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`${URL}: HTTP ${String(res.status)}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  checkZip(bytes);

  mkdirSync(dest, { recursive: true });
  rmSync(join(dest, STAMP), { force: true });
  for (const f of KEEP) rmSync(join(dest, f), { force: true });
  const zip = join(dirname(dest), LLAMA.file);
  writeFileSync(zip, bytes);
  try {
    // Windows' own bsdtar reads zip files (Git Bash's GNU tar does not); a missing name fails.
    const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
    execFileSync(tar, ['-xf', zip, '-C', dest, ...KEEP], { stdio: 'inherit' });
  } finally {
    rmSync(zip, { force: true });
  }
  writeFileSync(join(dest, STAMP), `${LLAMA.sha256}\n`);
  console.log(`llama-server ${LLAMA.tag}: ${String(KEEP.length)} files in ${dest}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
