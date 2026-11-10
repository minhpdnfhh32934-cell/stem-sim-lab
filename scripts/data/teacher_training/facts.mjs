// Collects what a training conversation for AI Teacher may state: the numbers, formulas and
// quantity names the app's own engines produce. No AI and no GPU here; the wording comes later.
//
//   npx vite --port 1440 --strictPort     (dev server of this checkout)
//   node scripts/data/teacher_training/facts.mjs --out <file.jsonl> [--base http://localhost:1440]
//        [--per-scene 30] [--seed 1]
//
// Runs the app's modules in headless Chromium through the dev server, as
// scripts/teaching/eval-gemma.mjs does, so there is no second copy of any formula. Parameters are
// drawn on each slider's own grid; a set the scene's `validate` refuses, that does not solve, or
// whose answer disagrees with its numerical cross-check by more than 1 % is left out.
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
const perScene = Number(arg('per-scene', '30'));
const seed = Number(arg('seed', '1'));
if (!Number.isInteger(perScene) || perScene < 1) throw new Error('--per-scene: a whole number');
if (!Number.isInteger(seed)) throw new Error('--seed: a whole number');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(base);
await page.waitForLoadState('networkidle');

const result = await page.evaluate(
  async ({ perScene, seed }) => {
    const { loadScene, sceneIds } = await import('/src/physics/registry.ts');
    const { toSI, fromSI, unitLabel } = await import('/src/core/units.ts');
    const { formatNumber } = await import('/src/app/i18n/index.ts');

    // mulberry32: the same seed gives the same parameter sets on every machine.
    let state = seed >>> 0;
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = (list) => list[Math.floor(random() * list.length)];
    const shown = (value) => {
      const digits = { maximumSignificantDigits: 4 };
      const power = value ? Math.floor(Math.log10(Math.abs(value))) : 0;
      if (power < 6 && power > -4) return formatNumber('vi', value, digits);
      // "8,988·10⁹", as a book writes it: never "8.988.000.000" or a run of zeros.
      const exponent = String(power)
        .replace('-', '⁻')
        .replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]);
      return `${formatNumber('vi', value / 10 ** power, digits)}·10${exponent}`;
    };
    // Near the lesson's own default (a slider's far end gives "t = 34 000 s"), on about 12 round
    // stops 1, 2 or 5 × 10ⁿ apart: a problem says 25 kg, not 25,85 kg.
    const nearDefault = (d, current) => {
      // A default of 0 keeps to the positive side: "-46 m/s" reads as a thrown stone in no lesson,
      // and a body moving backwards off the track has no defined end of the run.
      const ends = current
        ? [current * 0.4, current * 2.5]
        : [Math.max(0, d.min), Math.max(0, d.min) + (d.max - Math.max(0, d.min)) * 0.2];
      const from = Math.max(d.min, Math.min(...ends));
      const to = Math.min(d.max, Math.max(...ends));
      const fine = d.step ?? (d.max - d.min) / 100;
      const wanted = (to - from) / 12;
      if (!(wanted > 0)) return Number(current.toPrecision(6));
      const power = 10 ** Math.floor(Math.log10(wanted));
      const round = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= wanted) ?? wanted;
      const step = Math.max(fine, round);
      const low = Math.ceil(from / step);
      const high = Math.floor(to / step);
      if (high < low) return Number(current.toPrecision(6));
      return Number(((low + Math.floor(random() * (high - low + 1))) * step).toPrecision(6));
    };
    /** The answers that really change with this parameter (the engine says, not the wording). */
    const answersDependingOn = (scene, p, d, solution) => {
      const q = {
        ...p,
        [d.key]: p[d.key] ? p[d.key] * 1.2 : d.unit ? toSI(d.step ?? 1, d.unit) : 1,
      };
      try {
        if ((scene.validate?.(q).length ?? 0) > 0) return [];
        const other = scene.solve(q, 'vi').answers;
        return solution.answers
          .filter((a) => {
            const b = other.find((x) => x.id === a.id);
            return b && Math.abs(b.value - a.value) > 1e-6 * Math.abs(a.value);
          })
          .map((a) => a.id);
      } catch {
        return [];
      }
    };

    const facts = [];
    const counts = {};
    for (const id of sceneIds()) {
      const scene = await loadScene(id);
      const start = scene.usesGravity ? { ...scene.defaults, g: 9.81 } : { ...scene.defaults };
      const card = scene.scienceCard(start);
      const seen = new Set();
      let made = 0;
      for (let attempt = 0; made < perScene && attempt < perScene * 40; attempt += 1) {
        const p = { ...start };
        // Choices first: they decide which numbers apply (`when`).
        for (const d of scene.params) {
          if (d.kind === 'choice' && d.choices?.length) p[d.key] = pick(d.choices).value;
          if (d.kind === 'toggle') p[d.key] = random() < 0.5 ? 0 : 1;
        }
        const given = [];
        for (const d of scene.params) {
          if (d.when && !d.when(p)) continue;
          if (d.kind === 'number' && d.min !== undefined && d.max !== undefined) {
            // A constant of nature is not a slider of the problem: k = 9,1·10⁹ is simply false.
            if (d.key !== 'g' && !(id === 'electricField' && d.key === 'k')) {
              const current = d.unit ? fromSI(start[d.key], d.unit) : start[d.key];
              const value = nearDefault(d, current);
              p[d.key] = d.unit ? toSI(value, d.unit) : value;
            }
            const display = d.unit ? fromSI(p[d.key], d.unit) : p[d.key];
            given.push({
              key: d.key,
              name: d.label.vi,
              symbol: d.symbol,
              value: shown(display),
              unit: d.unit ? unitLabel(d.unit, 'vi') : '',
              required: scene.required.includes(d.key),
            });
          } else if (d.kind === 'choice') {
            const chosen = d.choices?.find((c) => c.value === p[d.key]);
            if (chosen) given.push({ key: d.key, name: d.label.vi, value: chosen.label.vi });
          }
        }
        const key = JSON.stringify(given);
        if (seen.has(key) || (scene.validate?.(p).length ?? 0) > 0) continue;
        let solution;
        try {
          solution = scene.solve(p, 'vi');
        } catch {
          continue;
        }
        const agrees = (a) =>
          Number.isFinite(a.value) &&
          (a.check === undefined || Math.abs(a.check - a.value) <= 0.01 * Math.abs(a.value));
        if (!solution.answers.length || !solution.answers.every(agrees)) continue;
        seen.add(key);
        made += 1;
        for (const g of given) {
          const d = scene.params.find((x) => x.key === g.key);
          if (d?.kind === 'number') g.changes = answersDependingOn(scene, p, d, solution);
        }
        // The app's curve is not in a problem's text: the answers need how high the bead starts.
        let stated = given;
        if (id === 'energyConservation') {
          const reached = solution.answers.find((a) => a.id === 'h_max').value;
          const h0 = reached - p.v0 ** 2 / (2 * p.g);
          if (h0 < 0.01) continue; // a release in the valley: "h₀ = 7,9·10⁻⁷ m" is no problem
          stated = [
            ...given.filter((g) => !['H', 'a', 'x0'].includes(g.key)),
            {
              key: 'h0',
              name: 'Độ cao vị trí thả (so với mặt đất)',
              symbol: 'h_0',
              value: shown(h0),
              unit: 'm',
              required: true,
              changes: ['energy', 'v_low', 'h_max'],
            },
          ];
        }
        facts.push({
          id: `physics.${id}.${String(made).padStart(3, '0')}`,
          subject: 'physics',
          topic: id,
          title: scene.title.vi,
          given: stated,
          answers: solution.answers.map((a) => ({
            id: a.id,
            name: a.label.vi,
            value: shown(fromSI(a.value, a.unit)),
            unit: unitLabel(a.unit, 'vi'),
          })),
          steps: solution.steps.map((s) => ({ text: s.text.vi, tex: s.tex ?? '' })),
          notes: (solution.notes ?? []).map((n) => n.vi),
          model: card.model.vi,
          assumptions: card.assumptions.map((a) => a.vi),
          validity: card.validity?.vi ?? '',
        });
      }
      counts[id] = made;
    }
    return { facts, counts };
  },
  { perScene, seed },
);
await browser.close();
if (pageErrors.length) console.warn('page errors while loading:', pageErrors.slice(0, 3));

mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, result.facts.map((f) => JSON.stringify(f)).join('\n') + '\n', 'utf8');
console.log(`${result.facts.length} facts → ${out}`);
console.log(result.counts);
const short = Object.entries(result.counts).filter(([, n]) => n < perScene);
if (short.length) console.warn('scenes with fewer sets than asked:', Object.fromEntries(short));
