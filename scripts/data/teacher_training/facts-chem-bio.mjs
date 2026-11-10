// The chemistry and biology twin of facts.mjs: what a training conversation may state, computed by
// the app's own models and data tables. No AI and no GPU here.
//
//   npx vite --port 1440 --strictPort     (dev server of this checkout)
//   node scripts/data/teacher_training/facts-chem-bio.mjs --out <file.jsonl>
//        [--base http://localhost:1440] [--per-topic 30] [--seed 2]
//
// Same row as facts.mjs. A given with `changes` is one the listed answers depend on, which is what
// lets write.mjs tell a true "the problem is missing this" story. Only formulas, numbers and names
// leave this file: the app's explanatory sentences (STAGE_NOTE, EFFECT[…].desc) stay out on purpose.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('@playwright/test');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const out = arg('out');
if (!out) throw new Error('--out <file.jsonl> is required');
const base = arg('base', 'http://localhost:1440');
const perTopic = Number(arg('per-topic', '30'));
const seed = Number(arg('seed', '2'));
if (!Number.isInteger(perTopic) || perTopic < 1) throw new Error('--per-topic: a whole number');
if (!Number.isInteger(seed)) throw new Error('--seed: a whole number');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(base);
await page.waitForLoadState('networkidle');

const result = await page.evaluate(
  async ({ perTopic, seed }) => {
    const { formatNumber } = await import('/src/app/i18n/index.ts');
    const { texNum } = await import('/src/physics/common/tex.ts');
    const { parseEquation, balance } = await import('/src/chemistry/balance.ts');
    const { parseFormula } = await import('/src/chemistry/formula.ts');
    const { REACTIONS } = await import('/src/chemistry/data/reactions.ts');
    const elements = await import('/src/chemistry/data/elements.ts');
    const { runDivision, countsOf } = await import('/src/biology/division/division.ts');
    const { STAGE_NAME } = await import('/src/biology/division/state.ts');
    const dogma = await import('/src/biology/central/dogma.ts');
    const { EFFECT } = await import('/src/biology/central/state.ts');
    const { cross, ratio } = await import('/src/biology/genetics/mendel.ts');
    const { hardyWeinberg } = await import('/src/biology/genetics/population.ts');
    const { rate } = await import('/src/biology/enzyme/enzyme.ts');
    const { logistic } = await import('/src/biology/ecology/ecology.ts');

    // mulberry32, as in facts.mjs: the same seed gives the same sets on every machine.
    let state = seed >>> 0;
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = (list) => list[Math.floor(random() * list.length)];
    const shown = (v) => formatNumber('vi', v, { maximumSignificantDigits: 4 });
    const tex = (v) => texNum('vi', v);

    const facts = [];
    const counts = {};
    const seen = new Set();
    const add = (subject, topic, title, given, answers, steps, extra = {}) => {
      const key = `${topic}|${JSON.stringify(given)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      counts[topic] = (counts[topic] ?? 0) + 1;
      facts.push({
        id: `${subject}.${topic}.${String(counts[topic]).padStart(3, '0')}`,
        subject,
        topic,
        title,
        given,
        answers,
        steps: steps.map((t) => ({ text: '', tex: t })),
        notes: [],
        model: '',
        assumptions: [],
        validity: '',
        ...extra,
      });
      return true;
    };
    /** Keeps drawing until the topic is full; a draw that repeats or does not apply adds nothing. */
    const fill = (topic, draw) => {
      for (let i = 0; (counts[topic] ?? 0) < perTopic && i < perTopic * 40; i += 1) draw();
    };
    const number = (key, name, symbol, value, unit, changes) => ({
      key,
      name,
      symbol,
      value: shown(value),
      unit,
      required: true,
      changes,
    });
    const text = (key, name, symbol, value) => ({
      key,
      name,
      symbol,
      value,
      unit: '',
      required: true,
    });
    const answer = (id, name, value, unit = '') => ({
      id,
      name,
      value: typeof value === 'number' ? shown(value) : value,
      unit,
    });

    // ---- Chemistry ----
    /** Masses as Vietnamese textbooks round them (Cl alone keeps its half), stated in the problem. */
    const atomicMass = (symbol) =>
      symbol === 'Cl' ? 35.5 : Math.round(elements.elementBySymbol(symbol).atomic_weight);
    const countsIn = (formula) => [...parseFormula(formula).counts];
    const usable = (formula) => {
      if (!/^[A-Z][A-Za-z0-9()]*$/.test(formula)) return false;
      try {
        return countsIn(formula).every(([el]) => elements.elementBySymbol(el));
      } catch {
        return false;
      }
    };
    const massOf = (formula) => countsIn(formula).reduce((s, [el, n]) => s + atomicMass(el) * n, 0);
    const massStep = (formula) => {
      const atoms = countsIn(formula);
      const sum = atoms
        .map(([el, n]) => (n === 1 ? tex(atomicMass(el)) : `${n}\\cdot ${tex(atomicMass(el))}`))
        .join(' + ');
      const single = atoms.length === 1 && atoms[0][1] === 1;
      return `M_{${formula}} = ${single ? '' : `${sum} = `}${tex(massOf(formula))}\\,\\text{g/mol}`;
    };
    const atomsNote = (...formulas) =>
      [...new Set(formulas.flatMap((f) => countsIn(f).map(([el]) => el)))]
        .map((el) => `${el} = ${shown(atomicMass(el))}`)
        .join(', ');
    const atomsGiven = (...formulas) =>
      text('atoms', 'Nguyên tử khối', 'NTK', atomsNote(...formulas));
    const side = (terms, withCoef) =>
      terms.map((t) => `${withCoef && t.coef !== 1 ? t.coef : ''}${t.formula}`).join(' + ');
    const MASSES = [1, 2, 4, 5, 8, 10, 12, 16, 20, 24, 25, 30, 32, 40, 50];
    const VOLUMES = [50, 100, 200, 250, 400, 500, 1000];

    const whole = REACTIONS.filter((r) =>
      [...r.reactants, ...r.products].every((t) => usable(t.formula)),
    );
    const substances = [
      ...new Set(whole.flatMap((r) => [...r.reactants, ...r.products]).map((t) => t.formula)),
    ];

    for (const r of whole) {
      const terms = [...r.reactants, ...r.products];
      let eq;
      try {
        eq = parseEquation(`${side(r.reactants, false)} -> ${side(r.products, false)}`);
      } catch {
        continue;
      }
      const solved = balance(eq);
      if (solved.kind !== 'balanced') continue;
      // The library's coefficients and the exact balancer must say the same.
      const c = solved.coefficients.map(Number);
      if (!c.every((v, i) => v * terms[0].coef === terms[i].coef * c[0])) continue;
      const elementsHere = [
        ...new Set(terms.flatMap((t) => countsIn(t.formula).map(([el]) => el))),
      ];
      const atoms = (list, el) =>
        list.reduce((s, t) => s + t.coef * (new Map(countsIn(t.formula)).get(el) ?? 0), 0);
      const arrow = r.reversible ? '⇌' : '→';
      add(
        'chemistry',
        'balance',
        'Cân bằng phương trình hóa học',
        [
          text(
            'equation',
            'Phương trình chưa cân bằng',
            'PT',
            `${side(r.reactants, false)} ${arrow} ${side(r.products, false)}`,
          ),
        ],
        [
          answer(
            'equation',
            'Phương trình đã cân bằng',
            `${side(r.reactants, true)} ${arrow} ${side(r.products, true)}`,
          ),
          answer('coefficients', 'Các hệ số theo thứ tự', terms.map((t) => t.coef).join(', ')),
        ],
        elementsHere.map(
          (el) => `\\text{${el}}: ${atoms(r.reactants, el)} = ${atoms(r.products, el)}`,
        ),
        { tool: 'balance' },
      );
    }

    fill('moles', () => {
      const f = pick(substances);
      const m = pick(MASSES);
      const M = massOf(f);
      add(
        'chemistry',
        'moles',
        'Số mol từ khối lượng',
        [
          text('substance', 'Chất', 'chất', f),
          number('m', 'Khối lượng', 'm', m, 'g', ['n']),
          atomsGiven(f),
        ],
        [answer('M', 'Khối lượng mol', M, 'g/mol'), answer('n', 'Số mol', m / M, 'mol')],
        [
          massStep(f),
          `n = \\frac{m}{M} = \\frac{${tex(m)}}{${tex(M)}} = ${tex(m / M)}\\,\\text{mol}`,
        ],
      );
    });

    fill('concentration', () => {
      const f = pick(substances);
      const m = pick(MASSES);
      const V = pick(VOLUMES);
      const M = massOf(f);
      const n = m / M;
      add(
        'chemistry',
        'concentration',
        'Nồng độ mol của dung dịch',
        [
          text('substance', 'Chất tan', 'chất', f),
          number('m', 'Khối lượng chất tan', 'm', m, 'g', ['CM']),
          number('V', 'Thể tích dung dịch', 'V', V, 'mL', ['CM']),
          atomsGiven(f),
        ],
        [
          answer('M', 'Khối lượng mol', M, 'g/mol'),
          answer('n', 'Số mol chất tan', n, 'mol'),
          answer('CM', 'Nồng độ mol', n / (V / 1000), 'mol/L'),
        ],
        [
          massStep(f),
          `n = \\frac{${tex(m)}}{${tex(M)}} = ${tex(n)}\\,\\text{mol}`,
          `C_M = \\frac{n}{V} = \\frac{${tex(n)}}{${tex(V / 1000)}} = ${tex(n / (V / 1000))}\\,\\text{mol/L}`,
        ],
      );
    });

    const oneWay = whole.filter((r) => !r.reversible);
    fill('stoichiometry', () => {
      const r = pick(oneWay);
      const a = pick(r.reactants);
      const b = pick(r.products);
      const m = pick(MASSES);
      const nA = m / massOf(a.formula);
      const nB = (nA * b.coef) / a.coef;
      const mB = nB * massOf(b.formula);
      add(
        'chemistry',
        'stoichiometry',
        'Tính theo phương trình hóa học',
        [
          text(
            'equation',
            'Phương trình',
            'PT',
            `${side(r.reactants, true)} → ${side(r.products, true)}`,
          ),
          text('reactant', 'Chất phản ứng hết', 'chất A', a.formula),
          number('m', `Khối lượng ${a.formula}`, 'm', m, 'g', ['mB']),
          text('product', 'Chất cần tính', 'chất B', b.formula),
          atomsGiven(a.formula, b.formula),
        ],
        [
          answer('nA', `Số mol ${a.formula}`, nA, 'mol'),
          answer('nB', `Số mol ${b.formula}`, nB, 'mol'),
          answer('mB', `Khối lượng ${b.formula}`, mB, 'g'),
        ],
        [
          massStep(a.formula),
          massStep(b.formula),
          `n_{${a.formula}} = \\frac{${tex(m)}}{${tex(massOf(a.formula))}} = ${tex(nA)}\\,\\text{mol}`,
          `n_{${b.formula}} = ${tex(nA)}\\cdot\\frac{${b.coef}}{${a.coef}} = ${tex(nB)}\\,\\text{mol}`,
          `m_{${b.formula}} = ${tex(nB)}\\cdot ${tex(massOf(b.formula))} = ${tex(mB)}\\,\\text{g}`,
        ],
      );
    });

    // From the data table, so Cr, Cu and the other exceptions are right.
    for (const e of elements.ELEMENTS.filter((x) => x.z <= 36)) {
      add(
        'chemistry',
        'electronConfiguration',
        'Cấu hình electron',
        [
          text(
            'element',
            'Nguyên tố',
            'nguyên tố',
            `${e.aliases_vi[0] ?? e.name} (${e.symbol}), Z = ${e.z}`,
          ),
        ],
        [
          answer('config', 'Cấu hình electron', elements.configString(e.configuration)),
          answer('shells', 'Số electron trên mỗi lớp', elements.electronsPerShell(e).join(', ')),
          answer('unpaired', 'Số electron độc thân', elements.unpairedElectrons(e)),
          answer('period', 'Chu kì', e.period),
        ],
        [],
      );
    }

    // ---- Biology ----
    const SPECIES_PAIRS = [2, 3, 4, 5, 6, 7, 8, 10, 12, 23];
    for (const [kind, label] of [
      ['mitosis', 'Nguyên phân'],
      ['meiosis', 'Giảm phân'],
    ]) {
      fill(kind, () => {
        const n = pick(SPECIES_PAIRS);
        const stages = runDivision(kind, n).filter(
          (s) => s.stage !== 'g1' && !s.stage.startsWith('telophase'),
        );
        const s = pick(stages);
        const c = countsOf(s);
        const asked = ['chromosomes', 'chromatids', 'centromeres', 'dna'];
        add(
          'biology',
          kind,
          label,
          [
            number('n2', 'Bộ nhiễm sắc thể lưỡng bội', '2n', 2 * n, '', asked),
            text('stage', 'Giai đoạn', 'kì', STAGE_NAME[s.stage].vi),
          ],
          [
            answer('chromosomes', 'Số nhiễm sắc thể trong một tế bào', c.chromosomes),
            answer('state', 'Trạng thái nhiễm sắc thể', c.state === 'double' ? 'kép' : 'đơn'),
            answer('chromatids', 'Số cromatit trong một tế bào', c.chromatids),
            answer('centromeres', 'Số tâm động trong một tế bào', c.centromeres),
            answer('dna', 'Số phân tử ADN trong một tế bào', c.dnaMolecules),
          ],
          [`2n = ${2 * n}`],
        );
      });
    }

    const toDna = (codon) => codon.replace(/U/g, 'T');
    const sense = dogma.GENETIC_CODE.filter((c) => !c.stop);
    const stops = dogma.GENETIC_CODE.filter((c) => c.stop);
    const gene = () => {
      const middle = Array.from({ length: 2 + Math.floor(random() * 5) }, () => pick(sense));
      return ['ATG', ...middle.map((c) => toDna(c.codon)), toDna(pick(stops).codon)].join('');
    };
    const chain = (t) =>
      t.codons
        .slice(0, t.stopIndex < 0 ? undefined : t.stopIndex)
        .map((c) => c.entry?.three)
        .join('-');

    fill('geneExpression', () => {
      const coding = gene();
      const mrna = dogma.codingToMrna(coding);
      const t = dogma.translate(mrna);
      if (t.start !== 0 || t.stopIndex < 0) return;
      add(
        'biology',
        'geneExpression',
        'Từ ADN đến prôtêin',
        [text('coding', "Mạch mã hóa (5'→3')", 'mạch mã hóa', coding)],
        [
          answer('template', "Mạch khuôn (3'→5')", dogma.complement(coding)),
          answer('mrna', "mARN (5'→3')", mrna),
          answer('chain', 'Chuỗi axit amin', chain(t)),
          answer('length', 'Số axit amin', t.protein.length),
        ],
        ["5' \\to 3'"],
      );
    });

    fill('pointMutation', () => {
      const coding = gene();
      const pos = 3 + Math.floor(random() * (coding.length - 6));
      const base = pick(['A', 'T', 'G', 'C'].filter((b) => b !== coding[pos]));
      const [m, what] = pick([
        [{ kind: 'substitution', pos, base }, `Thay nuclêôtit thứ ${pos + 1} bằng ${base}`],
        [
          { kind: 'insertion', pos, bases: base },
          `Thêm ${base} vào trước nuclêôtit thứ ${pos + 1}`,
        ],
        [{ kind: 'deletion', pos, count: 1 }, `Mất nuclêôtit thứ ${pos + 1}`],
      ]);
      const a = dogma.analyzeMutation(coding, m);
      if (!['silent', 'missense', 'nonsense', 'frameshift'].includes(a.effect)) return;
      add(
        'biology',
        'pointMutation',
        'Đột biến điểm',
        [
          text('coding', "Mạch mã hóa (5'→3')", 'mạch mã hóa', coding),
          text('mutation', 'Đột biến', 'đột biến', what),
        ],
        [
          answer('after', 'Mạch mã hóa sau đột biến', dogma.mutate(coding, m)),
          answer('effect', 'Loại đột biến', EFFECT[a.effect].name.vi),
          answer('before', 'Chuỗi axit amin ban đầu', chain(a.before)),
          answer('chain', 'Chuỗi axit amin sau đột biến', chain(a.after)),
        ],
        ["5' \\to 3'", `k = ${pos + 1}`],
      );
    });

    const ratioText = (map) => {
      const parts = ratio([...map.values()]);
      return [...map.keys()].map((k, i) => `${parts[i]} ${k}`).join(' : ');
    };
    const ONE = ['AA', 'Aa', 'aa'];
    const TWO = ['AABB', 'AABb', 'AaBB', 'AaBb', 'Aabb', 'aaBb', 'aabb', 'AAbb', 'aaBB'];
    fill('mendel', () => {
      const two = random() < 0.5;
      const dominance = !two && random() < 0.25 ? 'incomplete' : 'complete';
      const loci = two
        ? [
            { letter: 'A', dominance },
            { letter: 'B', dominance },
          ]
        : [{ letter: 'A', dominance }];
      const p1 = pick(two ? TWO : ONE);
      const p2 = pick(two ? TWO : ONE);
      const c = cross(p1, p2, loci);
      add(
        'biology',
        'mendel',
        'Quy luật di truyền Mendel',
        [
          text('cross', 'Phép lai', 'P', `${p1} × ${p2}`),
          text(
            'dominance',
            'Quan hệ giữa các alen',
            'trội',
            dominance === 'complete' ? 'trội hoàn toàn' : 'trội không hoàn toàn',
          ),
        ],
        [
          answer('genotypes', 'Tỉ lệ kiểu gen ở đời con', ratioText(c.genotypes)),
          answer('phenotypes', 'Tỉ lệ kiểu hình ở đời con', ratioText(c.phenotypes)),
        ],
        [],
      );
    });

    fill('hardyWeinberg', () => {
      const p = pick([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.15, 0.25, 0.35, 0.45]);
      const N = pick([200, 400, 500, 800, 1000, 2000, 5000]);
      const f = hardyWeinberg(p);
      add(
        'biology',
        'hardyWeinberg',
        'Cân bằng Hardy–Weinberg',
        [
          number('N', 'Số cá thể của quần thể', 'N', N, 'cá thể', ['nAA', 'nAa', 'naa']),
          number('p', 'Tần số alen A', 'p', p, '', ['fAA', 'fAa', 'faa']),
        ],
        [
          answer('fAA', 'Tần số kiểu gen AA', f.AA),
          answer('fAa', 'Tần số kiểu gen Aa', f.Aa),
          answer('faa', 'Tần số kiểu gen aa', f.aa),
          answer('nAA', 'Số cá thể AA', f.AA * N, 'cá thể'),
          answer('nAa', 'Số cá thể Aa', f.Aa * N, 'cá thể'),
          answer('naa', 'Số cá thể aa', f.aa * N, 'cá thể'),
        ],
        [
          `q = 1 - p = ${tex(1 - p)}`,
          `f(AA) = p^2 = ${tex(f.AA)}`,
          `f(Aa) = 2pq = ${tex(f.Aa)}`,
          `f(aa) = q^2 = ${tex(f.aa)}`,
        ],
      );
    });

    fill('enzymeKinetics', () => {
      const vmax = pick([5, 10, 20, 40, 50, 100]);
      const km = pick([0.5, 1, 2, 4, 5, 10]);
      const s = pick([0.5, 1, 2, 4, 5, 10, 20]);
      const v = rate({ vmax, km, inhibitor: 0, ki: 1, kind: 'none' }, s);
      add(
        'biology',
        'enzymeKinetics',
        'Động học enzim Michaelis–Menten',
        [
          number('vmax', 'Tốc độ cực đại', 'V_{max}', vmax, 'µM/s', ['v']),
          number('km', 'Hằng số Michaelis', 'K_m', km, 'mM', ['v']),
          number('s', 'Nồng độ cơ chất', '[S]', s, 'mM', ['v']),
        ],
        [answer('v', 'Tốc độ phản ứng ban đầu', v, 'µM/s')],
        [
          `v = \\frac{V_{max}[S]}{K_m + [S]} = \\frac{${tex(vmax)}\\cdot ${tex(s)}}{${tex(km)} + ${tex(s)}} = \\frac{${tex(vmax * s)}}{${tex(km + s)}} = ${tex(v)}`,
        ],
      );
    });

    fill('logisticGrowth', () => {
      const N0 = pick([10, 20, 50, 100, 200]);
      const r = pick([0.1, 0.2, 0.3, 0.5, 0.8]);
      const K = pick([500, 1000, 2000, 5000]);
      const t = pick([2, 5, 8, 10, 15, 20]);
      const N = logistic(N0, r, K, t);
      // Every intermediate is given: the writer may not compute one itself.
      const ratio0 = (K - N0) / N0;
      const decay = Math.exp(-r * t);
      const denominator = 1 + ratio0 * decay;
      if (Math.abs(K / denominator - N) > 1e-9 * N)
        throw new Error('logistic steps differ from the model');
      add(
        'biology',
        'logisticGrowth',
        'Tăng trưởng logistic của quần thể',
        [
          number('N0', 'Số cá thể ban đầu', 'N_0', N0, 'cá thể', ['N']),
          number('r', 'Tốc độ tăng trưởng nội tại', 'r', r, '/năm', ['N']),
          number('K', 'Sức chứa của môi trường', 'K', K, 'cá thể', ['N']),
          number('t', 'Thời gian', 't', t, 'năm', ['N']),
        ],
        [answer('N', `Số cá thể sau ${t} năm`, N, 'cá thể')],
        [
          `N(t) = \\frac{K}{1 + \\frac{K - N_0}{N_0} e^{-rt}}`,
          `\\frac{K - N_0}{N_0} = \\frac{${tex(K)} - ${tex(N0)}}{${tex(N0)}} = \\frac{${tex(K - N0)}}{${tex(N0)}} = ${tex(ratio0)}`,
          `e^{-rt} = e^{-${tex(r)}\\cdot ${tex(t)}} = e^{-${tex(r * t)}} = ${tex(decay)}`,
          `1 + ${tex(ratio0)}\\cdot ${tex(decay)} = 1 + ${tex(ratio0 * decay)} = ${tex(denominator)}`,
          `N = \\frac{${tex(K)}}{${tex(denominator)}} = ${tex(N)}`,
        ],
      );
    });

    return { facts, counts };
  },
  { perTopic, seed },
);
await browser.close();
if (pageErrors.length) console.warn('page errors while loading:', pageErrors.slice(0, 3));

mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, result.facts.map((f) => JSON.stringify(f)).join('\n') + '\n', 'utf8');
console.log(`${result.facts.length} facts → ${out}`);
console.log(result.counts);
