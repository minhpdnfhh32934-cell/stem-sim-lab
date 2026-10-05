#!/usr/bin/env node
/**
 * Builds and/or checks the web bundle of an edition (PROMPT_PHAN_2 A2).
 *
 *   node scripts/edition-bundle.mjs build pilot   # VITE_EDITION=pilot npm run build, then check
 *   node scripts/edition-bundle.mjs check pilot   # only check dist/
 *
 * The pilot edition (supervised high-school students) must not contain any Gemini code:
 * the check fails if dist/ contains the Gemini API host or its key header. For the main
 * edition the same markers must be present (proves the check looks at the right files).
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [cmd, edition] = process.argv.slice(2);
if (!['build', 'check'].includes(cmd) || !['main', 'pilot'].includes(edition)) {
  console.error('usage: node scripts/edition-bundle.mjs build|check main|pilot');
  process.exit(2);
}

if (cmd === 'build') {
  const r = spawnSync('npm', ['run', 'build'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, VITE_EDITION: edition },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const GEMINI_MARKERS = ['generativelanguage.googleapis.com', 'x-goog-api-key'];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const dist = 'dist';
const built = readFileSync(join(dist, 'web-edition.txt'), 'utf8').trim();
if (built !== edition) {
  console.error(`dist/ was built for edition "${built}", expected "${edition}"`);
  process.exit(1);
}
const hits = [];
for (const f of files(dist)) {
  if (!/\.(js|html|css|json|txt|map)$/.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  for (const m of GEMINI_MARKERS) if (text.includes(m)) hits.push(`${f}: ${m}`);
}
if (edition === 'pilot' && hits.length) {
  console.error('Gemini code found in the pilot bundle:\n' + hits.join('\n'));
  process.exit(1);
}
if (edition === 'main' && hits.length === 0) {
  console.error('Gemini markers not found in the main bundle — is the check looking at dist/?');
  process.exit(1);
}
console.log(`edition ${edition}: bundle check passed`);
