// Prepares blind judging of AI Teacher answers by AI judges (scripts/teaching/judge-rubric.md).
// For every question, one answer per group is given an anonymous code (A, B, …) in an order that
// is shuffled per question and per judge (seeded, so it can be reproduced); the judge files hold
// the question, the reference answer and the coded answers only — never the prompt, the decoding
// or the group. The key that maps codes back to groups is written to a separate file the judges
// must not read. Reads result files only: no browser, no GPU.
//
//   node scripts/teaching/judge-prep.mjs --out <folder> --groups <g1,g2,…> --judges 2
//        [--seed simlab-2026-10-14] <eval-….json> [more files…]
//
// A group is "model/variant/decoding/temperature" (rubric.mjs groupKey). Each group must have
// exactly one answered run per question (greedy runs); the script stops otherwise.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupKey } from './rubric.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const out = opt('out');
const groups = String(opt('groups', '')).split(',').filter(Boolean);
const judges = Number(opt('judges', '2'));
const seed = opt('seed', 'simlab-2026-10-14');
const valued = new Set(['--out', '--groups', '--judges', '--seed']);
const files = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1] ?? ''));
if (!out || groups.length < 2 || !files.length)
  throw new Error('usage: --out <folder> --groups <g1,g2,…> [--judges 2] <files…>');
mkdirSync(out, { recursive: true });

const set = JSON.parse(readFileSync(resolve(root, 'tests/teaching/teaching-eval.json'), 'utf8'));
const runs = files.flatMap((f) => {
  const file = JSON.parse(readFileSync(f, 'utf8'));
  return file.results
    .filter((r) => r.ok && r.answer.trim())
    .map((r) => ({
      ...r,
      model: r.model ?? file.model,
      group: groupKey({ ...r, model: r.model ?? file.model }),
    }));
});

/** Deterministic shuffle (Fisher–Yates driven by SHA-256 of seed + parts). */
function shuffled(list, ...parts) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const h = createHash('sha256')
      .update([seed, ...parts, i].join('|'))
      .digest();
    const j = h.readUInt32BE(0) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const codes = 'ABCDEFGHIJKL'.split('');
const key = {};
const perJudge = Array.from({ length: judges }, () => ({}));
for (const item of set.items) {
  const answers = groups.map((g) => {
    const found = runs.filter((r) => r.group === g && r.id === item.id);
    if (found.length !== 1)
      throw new Error(`${item.id}: group ${g} has ${found.length} answered runs (need exactly 1)`);
    return { group: g, text: found[0].answer.trim() };
  });
  for (let j = 0; j < judges; j++) {
    const order = shuffled(answers, item.id, `judge${j}`);
    const coded = order.map((a, k) => ({ code: codes[k], text: a.text }));
    (key[`j${j}`] ??= {})[item.id] = Object.fromEntries(order.map((a, k) => [codes[k], a.group]));
    (perJudge[j][item.subject] ??= []).push({
      id: item.id,
      question: item.question,
      ...(item.history?.length ? { conversationBefore: item.history } : {}),
      reference: item.expected ?? null,
      keyPoints: item.keyPoints ?? null,
      ...(item.derivation ? { derivation: item.derivation } : {}),
      ...(item.expectsClarify ? { note: 'The problem is missing data on purpose.' } : {}),
      answers: coded,
    });
  }
}
for (let j = 0; j < judges; j++) {
  for (const [subject, list] of Object.entries(perJudge[j])) {
    writeFileSync(resolve(out, `judge-input-j${j}-${subject}.json`), JSON.stringify(list, null, 1));
  }
}
writeFileSync(
  resolve(out, 'judge-key.SECRET.json'),
  JSON.stringify({ seed, groups, files: files.map((f) => f.split(/[\\/]/).pop()), key }, null, 1),
);
console.log(
  `${set.items.length} questions × ${groups.length} answers, ${judges} judge orders → ${out}`,
);
