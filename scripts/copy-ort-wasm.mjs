// Copies the onnxruntime WebGPU/WASM binaries next to the app so the in-browser
// Gemma engine (Transformers.js) runs fully offline, with no CDN and no Ollama.
// Runs automatically after `npm install` (see postinstall). Regenerable: stays
// out of git and of the source ZIP. The app points onnxruntime at /ort/ (see
// src/ai/webGemmaWorker.ts).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const to = join(root, 'public', 'ort');

const FILES = [
  // The asyncify build (WebGPU-capable) is the one the app uses: loader + binary.
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jspi.wasm',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
];

let copied = 0;
mkdirSync(to, { recursive: true });
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
