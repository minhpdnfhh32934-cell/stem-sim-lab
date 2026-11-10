// Puts a rewritten decoder weights file into a benchmark Edge profile that already holds Gemma 4
// E2B, in place of the stored one, so the app loads it through its normal code path.
//
//   node scripts/training/install_in_profile.mjs <profile> <file.onnx_data> [app base url]
//
// Nothing goes online: the file is served to the page from this process on 127.0.0.1.
import { createRequire } from 'node:module';
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('@playwright/test');

const [profile, file, base = 'http://localhost:1430'] = process.argv.slice(2);
if (!profile || !file) throw new Error('usage: install_in_profile.mjs <profile> <file> [base]');
const size = statSync(file).size;

const server = createServer((_, res) => {
  res.writeHead(200, {
    'access-control-allow-origin': '*',
    'content-type': 'application/octet-stream',
    'content-length': size,
  });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/data`;

// No GPU work here: the page only copies a file into its private storage.
const context = await chromium.launchPersistentContext(profile, {
  channel: 'msedge',
  headless: true,
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(base);
await page.waitForLoadState('networkidle');
const result = await page.evaluate(
  async ({ url }) => {
    const { storagePath } = await import('/src/ai/modelStore.ts');
    const { repo, file } = storagePath(
      'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/resolve/x/onnx/decoder_model_merged_q4.onnx_data',
    );
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('stemsim-models')).getDirectoryHandle(repo);
    const handle = await dir.getFileHandle(file);
    const before = (await handle.getFile()).size;
    const writable = await handle.createWritable();
    const response = await fetch(url);
    await response.body.pipeTo(writable);
    return { repo, file, before, after: (await handle.getFile()).size };
  },
  { url },
);
await context.close();
server.close();
console.log(JSON.stringify(result));
if (result.after !== size || result.before !== size) {
  console.error(`size mismatch: file ${size}, stored ${result.before} → ${result.after}`);
  process.exit(1);
}
