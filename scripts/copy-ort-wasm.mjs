// Copies the onnxruntime WebGPU/WASM binaries next to the app so the in-browser
// Gemma engine (Transformers.js) runs fully offline, with no CDN and no Ollama.
// Runs automatically after `npm install` (see postinstall). Regenerable: stays
// out of git and of the source ZIP. The app points onnxruntime at /ort/ (see
// ortPaths() in src/ai/webGemma.ts).
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const to = join(root, 'public', 'ort');

// Only the asyncify build (WebGPU-capable) is ever loaded: its loader and its binary. The other
// builds (plain, jsep, jspi) are about 59 MB that every installer and in-app update would carry
// without using them. Keep this list equal to ortPaths() (tested in tests/ort-files.test.ts).
const FILES = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'];

let copied = 0;
mkdirSync(to, { recursive: true });
// Remove builds copied by older versions of this script, so they do not end up in a bundle.
for (const file of readdirSync(to)) {
  if (file.startsWith('ort-wasm') && !FILES.includes(file)) rmSync(join(to, file));
}
for (const file of FILES) {
  const src = join(from, file);
  if (!existsSync(src)) {
    console.warn(`[copy-ort-wasm] missing ${file}, skipping.`);
    continue;
  }
  copyFileSync(src, join(to, file));
  copied++;
}
console.log(`[copy-ort-wasm] copied ${copied}/${FILES.length} onnxruntime files to ${to}`);
