import type { Texts } from '../../../../core/i18n';
import {
  classCells,
  genotypeLetters,
  phenotypeClass,
  punnettCells,
  SEED,
} from '../../../labVisuals/biology';
import { el } from '../../dom';
import {
  bindAttr,
  bindNumber,
  bindText,
  type ChoiceIcon,
  choices,
  defineBio,
  drawing,
  liveRow,
  Memo,
  num,
  S,
} from './bio-kit';

/*
 * The genetics pieces (docs/experiment-workspace-design.md, Biology D6): the parent plants, the
 * Punnett board, the seed tray and the seed counter. The board's sixteen cells are the genetics
 * model's own `offspringGenotype` over the sixteen equally likely bit patterns; a seed's colour
 * and shape come from its genotype code; the tray fills with the model's counts.
 *
 * Variables read: counted, yellowRound, yellowWrinkled, greenRound, greenWrinkled, lastGenotype;
 * parameters parent1, parent2 (the pots, from the dials), offspring, sample.
 */

/** "yellow, round": the phenotype class `cls` (0 yellow round … 3 green wrinkled) in words. */
export function phenotypeName(texts: Texts, cls: number): string {
  const colour = cls < 2 ? texts.ui('bio.yellow', 'yellow') : texts.ui('bio.green', 'green');
  const shape =
    cls % 2 === 0 ? texts.ui('bio.round', 'round') : texts.ui('bio.wrinkled', 'wrinkled');
  return texts.ui('bio.phenotype', '{colour}, {shape}', { colour, shape });
}

/** A seed in its colour and shape: round, or wrinkled (a squarer, creased outline). */
function seed(parent: Element, cx: number, cy: number, cls: number): SVGElement {
  const style = SEED[cls];
  if (style?.round) {
    return S('circle', { cx, cy, r: 8, fill: style.fill, class: 'bio-seed' }, parent);
  }
  const d = `M${cx - 8} ${cy - 5}l5-3 6 2 5-2 3 6-2 5 2 5-5 3-6-2-5 2-3-5z`;
  return S('path', { d, fill: style?.fill ?? 'none', class: 'bio-seed bio-wrinkled' }, parent);
}

function seedIcon(code: number): ChoiceIcon {
  const root = S('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'bio-seed-icon' });
  const cls = phenotypeClass(code);
  if (cls >= 0) seed(root, 12, 12, cls);
  return { node: root };
}

// ---- a parent plant ---------------------------------------------------------------------------

/** A pot: the parent chosen from the genotypes the definition lists, its pod open with its seeds. */
export const parentPlant = defineBio('parent-plant', (kit) => {
  const { texts } = kit;
  const root = drawing(kit.host, 120, 110, kit.label);
  S('path', { d: 'M60 100V50', class: 'bio-stem' }, root);
  S('path', { d: 'M60 70C40 60 34 40 40 32C56 38 62 54 60 70', class: 'bio-leaf' }, root);
  const pod = S('g', {}, root);
  S('path', { d: 'M24 100H96L88 80H32z', class: 'bio-pot' }, root);
  S('rect', { x: 28, y: 6, width: 64, height: 26, rx: 13, class: 'bio-pod' }, root);
  const tag = el('p', 'bio-genotype');
  const name = el('p', 'bio-class');
  kit.host.append(tag, name);
  const setTag = bindText(tag);
  const setName = bindText(name);
  const parameter = kit.owned();
  let seeds: SVGElement[] = [];
  let shown = Number.NaN;
  const choose = choices(kit, kit.host, parameter, (preset) => seedIcon(preset.value));
  return {
    draw(f) {
      const code = num(f.dials, parameter);
      if (!Object.is(code, shown)) {
        shown = code;
        const cls = phenotypeClass(code);
        for (const s of seeds) s.remove();
        seeds = cls < 0 ? [] : [0, 1, 2, 3].map((i) => seed(pod, 40 + i * 14, 19, cls));
        setName(cls < 0 ? '' : phenotypeName(texts, cls));
        setTag(genotypeLetters(code));
      }
      choose(f);
    },
  };
});

// ---- the Punnett board ------------------------------------------------------------------------

/** The sixteen cells of the dihybrid cross of the two chosen parents; redrawn when a parent changes. */
export const punnettBoard = defineBio('punnett-board', (kit) => {
  const root = drawing(kit.host, 168, 168, kit.label);
  const cells = Array.from({ length: 16 }, (_, i) => {
    const x = 4 + (i % 4) * 40;
    const y = 4 + Math.floor(i / 4) * 40;
    const rect = S('rect', { x, y, width: 38, height: 38, rx: 4, class: 'bio-cell' }, root);
    const text = S(
      'text',
      { x: x + 19, y: y + 24, 'text-anchor': 'middle', class: 'bio-cell-text' },
      root,
    );
    return { fill: bindAttr(rect, 'fill'), round: bindAttr(rect, 'rx'), text: bindText(text) };
  });
  const memo = new Memo(2);
  const codes: number[] = [];
  return {
    draw(f) {
      const p1 = num(f.dials, 'parent1');
      const p2 = num(f.dials, 'parent2');
      if (!(memo.put(0, p1) | memo.put(1, p2))) return;
      punnettCells(p1, p2, codes);
      cells.forEach((cell, i) => {
        const code = codes[i] ?? Number.NaN;
        const style = SEED[phenotypeClass(code)];
        cell.fill(style?.fill ?? 'none');
        cell.round(style?.round ? 16 : 3);
        cell.text(codes.length ? genotypeLetters(code) : '');
      });
    },
  };
});

// ---- the seed tray ----------------------------------------------------------------------------

const COUNTS = ['yellowRound', 'yellowWrinkled', 'greenRound', 'greenWrinkled'] as const;

/**
 * Four piles that fill with the model's counts against N, a mark at the Punnett share (cells/16)
 * of each, and the newest seed from `lastGenotype`: empty while there is none.
 */
export const seedTray = defineBio('seed-tray', (kit) => {
  const { texts } = kit;
  const root = drawing(kit.host, 200, 150, kit.label);
  const newest = S('g', { opacity: 0 }, root);
  const bars = COUNTS.map((_, i) => {
    const x = 12 + i * 46;
    S('rect', { x, y: 30, width: 34, height: 80, class: 'bio-tray' }, root);
    const fill = S(
      'rect',
      { x, y: 110, width: 34, height: 0, fill: SEED[i]?.fill ?? 'none' },
      root,
    );
    const mark = S('path', { d: `M${x - 3} 110h40`, class: 'bio-expected' }, root);
    const label = S(
      'text',
      { x: x + 17, y: 128, 'text-anchor': 'middle', class: 'bio-cell-text' },
      root,
    );
    label.textContent = String(i + 1);
    const count = S(
      'text',
      { x: x + 17, y: 144, 'text-anchor': 'middle', class: 'bio-cell-text' },
      root,
    );
    return {
      y: bindAttr(fill, 'y'),
      height: bindAttr(fill, 'height'),
      mark: bindAttr(mark, 'transform'),
      count: bindNumber(count, (n) => (Number.isFinite(n) ? String(n) : '—')),
    };
  });
  const names = el('ol', 'bio-legend');
  for (let i = 0; i < 4; i++) names.append(el('li', 'bio-legend-item', phenotypeName(texts, i)));
  kit.host.append(names);
  const counted = liveRow(kit, kit.host, 'counted');
  const showNewest = bindAttr(newest, 'opacity');
  let flying: SVGElement | null = null;
  let flyingClass = -1;
  const memo = new Memo(2);
  const codes: number[] = [];
  const cells: [number, number, number, number] = [0, 0, 0, 0];
  return {
    draw(f) {
      const total = num(f.p, 'offspring');
      for (let i = 0; i < 4; i++) {
        const count = num(f.s, COUNTS[i] ?? '');
        const share = total > 0 && Number.isFinite(count) ? Math.min(1, count / total) : 0;
        const bar = bars[i];
        bar?.height(80 * share);
        bar?.y(110 - 80 * share);
        bar?.count(count);
      }
      // The expected share: the Punnett cells of this class, of 16, for the run's own parents.
      if (memo.put(0, num(f.p, 'parent1')) | memo.put(1, num(f.p, 'parent2'))) {
        punnettCells(num(f.p, 'parent1'), num(f.p, 'parent2'), codes);
        classCells(codes, cells);
        bars.forEach((bar, i) =>
          bar.mark(
            codes.length ? `translate(0 ${-80 * ((cells[i] ?? 0) / 16)})` : 'translate(0 0)',
          ),
        );
      }
      // At most one seed in flight: the latest, in its colour and shape.
      const cls = f.run ? phenotypeClass(num(f.s, 'lastGenotype')) : -1;
      if (cls !== flyingClass) {
        flyingClass = cls;
        flying?.remove();
        flying = cls >= 0 ? seed(newest, 100, 16, cls) : null;
      }
      showNewest(cls >= 0 ? 1 : 0);
      counted(f);
    },
  };
});

// ---- the seed counter -------------------------------------------------------------------------

/** The number of offspring and the sample (the seeds are the same every time for a sample), and the count so far. */
export const seedCounter = defineBio('seed-counter', (kit) => {
  const first = choices(kit, kit.host, kit.owned(0));
  const second = kit.owned(1) ? choices(kit, kit.host, kit.owned(1)) : null;
  const counted = liveRow(kit, kit.host, 'counted');
  return {
    draw(f) {
      first(f);
      second?.(f);
      counted(f);
    },
  };
});
