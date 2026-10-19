// Prepares blind judging of AI Teacher answers by AI judges (scripts/teaching/judge-rubric.md).
// For every question, one answer per group is given an anonymous code (A, B, …) in an order that
// is shuffled per question and per judge (seeded, so it can be reproduced); the judge files hold
// the question, the reference answer and the coded answers only — never the prompt, the decoding
// or the group. The key that maps codes back to groups is written to a separate file the judges
// must not read: it goes to a sibling folder "<out>-key", never into the folder the judges get, and
// it holds the SHA-256 of every judge file (judge-score.mjs --inputs checks them). Both folders must
// be new: an existing key is never replaced. Reads result files only: no browser, no GPU.
//
//   node scripts/teaching/judge-prep.mjs --out <folder> --groups <g1,g2,…> --judges 2
//        [--seed simlab-2026-10-14] <eval-….json> [more files…]
//
// A group is "model/variant/decoding/temperature" (rubric.mjs groupKey). Each group must have
// exactly one answered run per question (greedy runs), from one app build; the script stops
// otherwise.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConflicts, evalSetPath, fileRuns, groupKey, writeNew } from './rubric.mjs';

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
const valued = new Set(['--out', '--groups', '--judges', '--seed', '--set']);
const files = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1] ?? ''));
if (!out || groups.length < 2 || !files.length)
  throw new Error('usage: --out <folder> --groups <g1,g2,…> [--judges 2] <files…>');
if (!Number.isInteger(judges) || judges < 1 || judges > 5)
  throw new Error('--judges must be a whole number from 1 to 5');
const codes = 'ABCDEFGHIJKL'.split('');
if (groups.length > codes.length) throw new Error(`at most ${codes.length} groups`);
const keyDir = `${out.replace(/[\\/]+$/, '')}-key`;
for (const dir of [out, keyDir]) {
  if (existsSync(dir) && readdirSync(dir).length)
    throw new Error(`${dir} is not empty: choose another --out (an earlier key is never replaced)`);
  mkdirSync(dir, { recursive: true });
}

const set = JSON.parse(readFileSync(evalSetPath(root, process.argv), 'utf8'));
const runs = files
  .flatMap((f) => fileRuns(JSON.parse(readFileSync(f, 'utf8')), f))
  .filter((r) => r.ok && r.answer.trim())
  .map((r) => ({ ...r, group: groupKey(r) }));
// Two app builds under one group would be judged as one configuration: stop, like compare.mjs.
const conflicts = buildConflicts(runs).filter((c) => groups.includes(c.key));
if (conflicts.length)
  throw new Error(
    `results of different builds in one group: ${conflicts.map((c) => `${c.key} (${c.builds.join(' | ')})`).join('; ')}`,
  );

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
const inputs = {};
for (let j = 0; j < judges; j++) {
  for (const [subject, list] of Object.entries(perJudge[j])) {
    const name = `judge-input-j${j}-${subject}.json`;
    const text = JSON.stringify(list, null, 1);
    writeNew(resolve(out, name), text);
    inputs[name] = createHash('sha256').update(text).digest('hex');
  }
}
writeNew(
  resolve(keyDir, 'judge-key.SECRET.json'),
  JSON.stringify(
    { seed, groups, files: files.map((f) => f.split(/[\\/]/).pop()), inputs, key },
    null,
    1,
  ),
);
console.log(
  `${set.items.length} questions × ${groups.length} answers, ${judges} judge orders → ${out} (key: ${keyDir})`,
);
