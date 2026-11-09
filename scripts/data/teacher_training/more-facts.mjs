// Picks new facts for one more write.mjs run: only for topics still short of --target, never a
// parameter set the earlier facts already hold, and with ids that cannot replace an old fact.
// No AI and no GPU here.
//
//   node scripts/data/teacher_training/more-facts.mjs --rows a.jsonl,b.jsonl
//        --facts f1.jsonl,f2.jsonl --new s101=n1.jsonl,s102=n2.jsonl --out <file.jsonl>
//        [--target 40] [--margin 1.15] [--first mendel,pointMutation]
//
// Each --rows file needs its <file>.rejected.jsonl beside it: a topic's past acceptance rate decides
// how many facts it gets. --new gives each file of facts.mjs / facts-chem-bio.mjs a tag, because
// those number from 001 on every run and export.mjs maps facts by id. --first comes first in the
// output, so an interrupted write has done those topics; the rest follow, fewest rows first.
//
// --check runs the file's own assertions and writes nothing.
import assert from 'node:assert';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const topicOf = (id) => id.split('.')[1];

/** Two facts with this key are the same exercise, whatever their ids say. */
const drawn = (f) => `${f.topic}|${JSON.stringify(f.given.map((g) => [g.key, g.value]))}`;

/** `past`: one { fact, kept } per earlier row, kept or rejected. `fresh`: [{ tag, facts }]. */
function pick({ past, oldFacts, fresh, target, margin, first }) {
  const stats = {};
  for (const { fact, kept } of past) {
    const s = (stats[topicOf(fact)] ??= { kept: 0, rejected: 0, facts: new Set() });
    s[kept ? 'kept' : 'rejected'] += 1;
    s.facts.add(fact);
  }

  const oldIds = new Set(oldFacts.map((f) => f.id));
  const seen = new Set(oldFacts.map(drawn));
  const available = {};
  for (const { tag, facts } of fresh) {
    for (const f of facts) {
      const key = drawn(f);
      if (seen.has(key)) continue;
      seen.add(key);
      (available[f.topic] ??= []).push({ ...f, id: f.id.replace(/\.(\d+)$/, `.${tag}-$1`) });
    }
  }

  const rest = Object.keys(stats)
    .filter((t) => !first.includes(t))
    .sort((a, b) => stats[a].kept - stats[b].kept);
  const picked = [];
  const report = [];
  for (const topic of [...first, ...rest]) {
    const s = stats[topic];
    assert.ok(s, `--first names a topic with no earlier rows: ${topic}`);
    const rate = s.kept / (s.kept + s.rejected);
    const jobsPerFact = (s.kept + s.rejected) / s.facts.size;
    const want =
      s.kept >= target ? 0 : Math.ceil(((target - s.kept) / rate / jobsPerFact) * margin);
    const free = available[topic] ?? [];
    const take = free.slice(0, want);
    picked.push(...take);
    report.push({
      topic,
      kept: s.kept,
      rate,
      jobsPerFact,
      free: free.length,
      want,
      take: take.length,
    });
  }

  assert.equal(new Set(picked.map((f) => f.id)).size, picked.length, 'ids repeat');
  assert.ok(
    picked.every((f) => !oldIds.has(f.id)),
    'an id collides with an old fact',
  );
  assert.ok(
    picked.every((f) => topicOf(f.id) === f.topic),
    'an id no longer names its topic',
  );
  return { picked, report };
}

function check() {
  const fact = (id, value) => ({
    id,
    topic: topicOf(id),
    given: [{ key: 'x', value: String(value) }],
  });
  const rows = (topic, kept, rejected) => [
    ...Array.from({ length: kept }, (_, i) => ({ fact: `p.${topic}.${i}`, kept: true })),
    ...Array.from({ length: rejected }, (_, i) => ({ fact: `p.${topic}.r${i}`, kept: false })),
  ];
  const fresh = [
    {
      tag: 's9',
      facts: [
        fact('p.short.001', 1), // the same exercise as an old fact, under the same number
        fact('p.short.002', 2),
        fact('p.short.003', 2), // the same exercise twice in the new file
        fact('p.short.004', 3),
        fact('p.short.005', 4),
        fact('p.short.006', 5),
        fact('p.full.001', 9),
        fact('p.other.001', 7),
      ],
    },
  ];
  const { picked, report } = pick({
    past: [...rows('other', 2, 0), ...rows('full', 4, 0), ...rows('short', 1, 1)],
    oldFacts: [fact('p.short.001', 1), fact('p.short.002', 99)],
    fresh,
    target: 4,
    margin: 1,
    first: ['short'],
  });
  assert.deepEqual(
    picked.map((f) => f.id),
    ['p.short.s9-002', 'p.short.s9-004', 'p.short.s9-005', 'p.short.s9-006', 'p.other.s9-001'],
    'a repeat is dropped, --first leads, ids are tagged',
  );
  assert.equal(report[0].want, 6, 'three more rows at a rate of one half are six jobs');
  assert.equal(report[0].take, 4, 'never more than the new facts that are left');
  assert.ok(!picked.some((f) => f.topic === 'full'), 'a topic at its target gets nothing');
  assert.equal(report[1].topic, 'other', 'the fewest rows come first after --first');

  assert.throws(
    () => pick({ past: [], oldFacts: [], fresh: [], target: 4, margin: 1, first: ['nope'] }),
    /--first/,
    'a misspelt topic stops the run',
  );
  assert.throws(
    () =>
      pick({
        past: rows('a', 1, 0),
        oldFacts: [fact('p.a.s9-001', 1)],
        fresh: [{ tag: 's9', facts: [fact('p.a.001', 2)] }],
        target: 4,
        margin: 1,
        first: [],
      }),
    /collides/,
    'a tag used before stops the run',
  );
  console.log('more-facts.mjs checks passed');
}

function main() {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
  };
  const list = (name) => String(arg(name, '')).split(',').filter(Boolean);
  const jsonl = (file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  const out = arg('out');
  if (!out || !list('rows').length || !list('facts').length || !list('new').length) {
    throw new Error('--rows, --facts, --new and --out are required');
  }
  const target = Number(arg('target', '40'));
  const margin = Number(arg('margin', '1.15'));
  if (!Number.isInteger(target) || target < 1) throw new Error('--target: a whole number');
  if (!(margin >= 1)) throw new Error('--margin: 1 or more');

  const past = list('rows').flatMap((file) => [
    ...jsonl(file).map((r) => ({ fact: r.fact, kept: true })),
    ...jsonl(`${file}.rejected.jsonl`).map((r) => ({
      fact: r.id.split('.').slice(0, 3).join('.'),
      kept: false,
    })),
  ]);
  const fresh = list('new').map((pair) => {
    const [tag, file] = pair.split(/=(.*)/s);
    if (!/^[a-z0-9]+$/.test(tag) || !file) throw new Error(`--new: tag=file, got ${pair}`);
    return { tag, facts: jsonl(file) };
  });

  const { picked, report } = pick({
    past,
    oldFacts: list('facts').flatMap(jsonl),
    fresh,
    target,
    margin,
    first: list('first'),
  });
  for (const r of report) {
    console.log(
      `${r.topic}: kept ${r.kept}, rate ${r.rate.toFixed(2)}, jobs/fact ${r.jobsPerFact.toFixed(1)}, ` +
        `new available ${r.free}, want ${r.want}, picked ${r.take}`,
    );
  }
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, picked.map((f) => JSON.stringify(f)).join('\n') + '\n', 'utf8');
  console.log(`${picked.length} facts → ${out}`);
}

if (process.argv.includes('--check')) check();
else main();
