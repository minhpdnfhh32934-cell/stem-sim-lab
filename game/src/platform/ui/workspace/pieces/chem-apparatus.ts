import { chartFamily, chartLinear, DROP_ML, linearCss, WATER } from '../../../labVisuals/chemistry';
import {
  defineChem,
  p,
  putAttr,
  putFill,
  putFormat,
  S,
  uid,
  v,
  type Kit,
  type Part,
} from './chem-kit';
import {
  BURETTES,
  buretteScale,
  delivered,
  DONE,
  emptied,
  intoState,
  NO_STEPS,
  precipitateTint,
  share,
} from './chem-look';
import type { PieceViewFactory } from '../types';

/*
 * Apparatus drawn from the model's values: burette, pipette, retort stand, wash bottle, filter
 * funnel, reagent rack, spotting tile. SVG built once, attributes written when they change. Nothing
 * moves unless the model says so: drops fall and the stream runs only while the run is going.
 */

const GLASS = 'chem-glass';
const css = (r: number, g: number, b: number) => linearCss([r, g, b]);
const hundredths = (x: number) => Math.round(x * 100) / 100;

// ---- burette ----------------------------------------------------------------------------------

const TOP = 26; // the 0 mark (mm from the top of the drawing)
const SCALE = 240; // the 0 to full scale distance (mm)
const LENS = { x: 98, y: 104, r: 24, pitch: 20 }; // magnifier window: centre, radius, mm per mL
const TUBE_X = 40;
const FOOT = TOP + SCALE + 26; // the tube's foot, above the stopcock

function burette(kit: Kit): Part {
  const { texts } = kit;
  const art = kit.drawing(140, 330);
  const x = TUBE_X;
  S('rect', { x: x - 7, y: TOP - 14, width: 14, height: SCALE + 40, class: GLASS }, art);
  const column = S('rect', { x: x - 6, y: TOP, width: 12, height: 0, class: 'chem-liquid' }, art);
  const ticks = S('path', { class: 'chem-ticks' }, art);
  const labels = S('g', { class: 'chem-scale-text' }, art);
  // The stopcock: its handle lies across the tube when shut, along it when open.
  S('rect', { x: x - 3, y: FOOT, width: 6, height: 20, class: 'chem-steel' }, art);
  const handle = S(
    'rect',
    { x: x - 11, y: FOOT + 7, width: 22, height: 5, rx: 2, class: 'chem-handle' },
    art,
  );
  S(
    'path',
    { d: `M${x - 3} ${FOOT + 20} L${x} ${FOOT + 36} L${x + 3} ${FOOT + 20}`, class: GLASS },
    art,
  );
  const drop = S(
    'circle',
    { cx: x, cy: FOOT + 40, r: 2.4, class: 'chem-drop', display: 'none' },
    art,
  );

  // The magnifier over the meniscus: the scale at 20 mm per mL, the meniscus at the lens centre.
  const clip = uid('chem-lens');
  S('circle', { cx: LENS.x, cy: LENS.y, r: LENS.r }, S('clipPath', { id: clip }, art));
  const lens = S('g', { 'clip-path': `url(#${clip})` }, art);
  S(
    'rect',
    {
      x: LENS.x - LENS.r,
      y: LENS.y - LENS.r,
      width: 2 * LENS.r,
      height: 2 * LENS.r,
      class: 'chem-lens-bg',
    },
    lens,
  );
  const strip = S('g', {}, lens);
  const lensTicks = S('path', { class: 'chem-ticks' }, strip);
  const lensLabels = S('g', { class: 'chem-scale-text' }, strip);
  S(
    'rect',
    { x: LENS.x - LENS.r, y: LENS.y, width: 2 * LENS.r, height: LENS.r, class: 'chem-liquid' },
    lens,
  );
  S(
    'line',
    { x1: LENS.x - LENS.r, x2: LENS.x + LENS.r, y1: LENS.y, y2: LENS.y, class: 'chem-meniscus' },
    lens,
  );
  S('circle', { cx: LENS.x, cy: LENS.y, r: LENS.r, class: 'chem-lens-rim' }, art);

  /** The scale for a burette of `cap` mL, once. */
  const build = (cap: number) => {
    let d = '';
    for (let ml = 0; ml <= cap; ml++) {
      const y = TOP + (ml / cap) * SCALE;
      d += `M${x + 7} ${y.toFixed(2)}h${ml % 10 === 0 ? 8 : ml % 5 === 0 ? 6 : 4}`;
    }
    ticks.setAttribute('d', d);
    for (let ml = 0; ml <= cap; ml += 10) {
      S('text', { x: x + 18, y: TOP + (ml / cap) * SCALE + 3 }, labels).textContent = String(ml);
    }
    let l = '';
    for (let tenth = 0; tenth <= cap * 10; tenth++) {
      const len = tenth % 10 === 0 ? 14 : tenth % 5 === 0 ? 10 : 6;
      l += `M${LENS.x + LENS.r - len} ${(LENS.y + (tenth / 10) * LENS.pitch).toFixed(2)}h${len}`;
    }
    lensTicks.setAttribute('d', l);
    for (let ml = 0; ml <= cap; ml++) {
      S(
        'text',
        { x: LENS.x - LENS.r + 4, y: LENS.y + ml * LENS.pitch + 3 },
        lensLabels,
      ).textContent = String(ml);
    }
  };

  const putTop = putAttr(column, 'y');
  const putLength = putAttr(column, 'height');
  const putStrip = putFormat(strip, 'transform', (ml) => `translate(0 ${-ml * LENS.pitch})`);
  const putHandle = putAttr(handle, 'transform');
  const OPEN = `rotate(90 ${x} ${FOOT + 9.5})`;
  const putDrop = putAttr(drop, 'display');
  const putRate = putFormat(drop, 'style', (s) => `animation-duration:${s}s`);
  const run = kit.action(
    () => texts.ui('chem.burette.open', 'Open tap'),
    'run',
    (f) => !f.running,
  );
  const stop = kit.action(
    () => texts.ui('chem.burette.close', 'Close tap'),
    'stop',
    (f) => f.running,
  );
  const steps = kit.steps();
  let cap = 0;

  return {
    draw(f) {
      // The scale is the definition's size; a model that delivers more is drawn on the next size up, never clipped.
      const out = delivered(f);
      if (cap === 0 || out > cap) {
        cap = cap === 0 ? buretteScale(f.view.definition.initialConditions) : cap;
        if (out > cap) cap = BURETTES.find((size) => size >= out) ?? Math.ceil(out);
        labels.replaceChildren();
        lensLabels.replaceChildren();
        build(cap);
      }
      // Full to the 0 mark until the model delivers; empty until the burette is filled, where a step says so.
      const into = intoState(f, kit.ctx.piece.id);
      const filled = into === NO_STEPS || into === DONE;
      const ml = hundredths(out);
      const meniscus = hundredths(TOP + (ml / cap) * SCALE);
      putTop(filled ? meniscus : FOOT);
      putLength(filled ? hundredths(FOOT - meniscus) : 0);
      putStrip(ml);
      putHandle(f.running ? OPEN : 'rotate(0)');
      putDrop(f.running ? 'inline' : 'none');
      const flow = p(f, 'flowRate');
      if (flow > 0) putRate(hundredths(DROP_ML / flow));
      run(f);
      stop(f);
      steps(f);
    },
  };
}

// ---- pipette ----------------------------------------------------------------------------------

function pipette(kit: Kit): Part {
  const art = kit.drawing(80, 300);
  const cx = 40;
  const bulb = S('ellipse', { cx, cy: 120, rx: 10, ry: 16, class: GLASS }, art);
  S('rect', { x: cx - 2.5, y: 20, width: 5, height: 80, class: GLASS }, art);
  S('path', { d: `M${cx - 2.5} 140 V250 L${cx} 270 L${cx + 2.5} 250 V140`, class: GLASS }, art);
  const wet = S(
    'ellipse',
    { cx, cy: 120, rx: 9, ry: 15, class: 'chem-liquid', display: 'none' },
    art,
  );
  const stem = S(
    'rect',
    { x: cx - 1.8, y: 140, width: 3.6, height: 110, class: 'chem-liquid', display: 'none' },
    art,
  );
  S('line', { x1: cx - 6, x2: cx + 6, y1: 60, y2: 60, class: 'chem-mark' }, art);
  const size = [
    putAttr(bulb, 'rx'),
    putAttr(bulb, 'ry'),
    putAttr(wet, 'rx'),
    putAttr(wet, 'ry'),
  ] as const;
  const putBulb = putAttr(wet, 'display');
  const putStem = putAttr(stem, 'display');
  const steps = kit.steps();
  return {
    draw(f) {
      // The bulb holds the capacity the setting names: an ellipsoid of that volume (1 mL = 1000 mm³).
      const own = p(f, 'acidVolume');
      const ml = Number.isFinite(own)
        ? own
        : Number.isFinite(p(f, 'stockVolume'))
          ? p(f, 'stockVolume')
          : 10;
      const r = hundredths(Math.cbrt((3 * ml * 1000) / (4 * Math.PI * 1.6)));
      size[0](r);
      size[1](hundredths(r * 1.6));
      size[2](hundredths(r - 1));
      size[3](hundredths(r * 1.6 - 1));
      // Holding what a step put in, until the step that moves it on is done.
      const id = kit.ctx.piece.id;
      const full = intoState(f, id) === DONE && !emptied(f, id);
      putBulb(full ? 'inline' : 'none');
      putStem(full ? 'inline' : 'none');
      steps(f);
    },
  };
}

// ---- retort stand -----------------------------------------------------------------------------

function retortStand(kit: Kit): Part {
  const art = kit.drawing(160, 360);
  S('rect', { x: 20, y: 340, width: 120, height: 10, rx: 2, class: 'chem-steel' }, art);
  S('rect', { x: 36, y: 20, width: 7, height: 322, class: 'chem-steel' }, art);
  S('rect', { x: 30, y: 60, width: 22, height: 14, rx: 2, class: 'chem-steel' }, art);
  S('rect', { x: 52, y: 63, width: 72, height: 5, class: 'chem-steel' }, art);
  return { draw: () => undefined };
}

// ---- wash bottle ------------------------------------------------------------------------------

function washBottle(kit: Kit): Part {
  const { texts } = kit;
  const art = kit.drawing(140, 220);
  S('rect', { x: 30, y: 90, width: 60, height: 110, rx: 14, class: GLASS }, art);
  S('rect', { x: 36, y: 118, width: 48, height: 76, rx: 10, class: 'chem-liquid' }, art);
  S('path', { d: 'M60 90 V62 H100 L120 82', class: GLASS, fill: 'none' }, art);
  const stream = S(
    'line',
    { x1: 120, x2: 120, y1: 84, y2: 200, class: 'chem-stream', display: 'none' },
    art,
  );
  const putStream = putAttr(stream, 'display');
  const run = kit.action(
    () => texts.ui('chem.wash.fill', 'Fill to the mark'),
    'run',
    (f) => !f.running,
  );
  const steps = kit.steps();
  return {
    draw(f) {
      putStream(f.running ? 'inline' : 'none');
      run(f);
      steps(f);
    },
  };
}

// ---- filter funnel ----------------------------------------------------------------------------

function filterFunnel(kit: Kit): Part {
  const art = kit.drawing(140, 190);
  S('path', { d: 'M20 20 H120 L76 100 V150 H64 V100 Z', class: GLASS }, art);
  S('path', { d: 'M32 26 H108 L70 92 Z', class: 'chem-paper' }, art);
  const residue = S(
    'path',
    { class: 'chem-residue', d: 'M70 92 L50 66 H90 Z', display: 'none' },
    art,
  );
  const putShow = putAttr(residue, 'display');
  const putTall = putFormat(
    residue,
    'transform',
    (s) => `translate(0 ${hundredths(92 * (1 - s))}) scale(1 ${s})`,
  );
  const paint = putFill(residue, 'fill', css);
  const tint: [number, number, number] = [0, 0, 0];
  const steps = kit.steps();
  return {
    draw(f) {
      // The solid left on the paper: the model's residue, or the precipitate once its mass is known.
      const sand = v(f, 'residueMass');
      const have = sand > 0 || v(f, 'precipitateMass') > 0;
      putShow(have ? 'inline' : 'none');
      putTall(hundredths(sand > 0 ? Math.max(share(sand, p(f, 'sandMass')), 0.15) : 0.6));
      if (precipitateTint(f, tint) > 0) paint(tint[0], tint[1], tint[2]);
      else paint(WATER[0], WATER[1], WATER[2]);
      steps(f);
    },
  };
}

// ---- reagent rack -----------------------------------------------------------------------------

/** A rack of the bottles, jars or tubes the owned parameter's presets name; the one in use has its cap off. */
function reagentRack(kit: Kit): Part {
  const { ctx } = kit;
  const parameter = kit.owned();
  let bottles: { value: number; open: (v: string | number) => void }[] | null = null;
  const steps = kit.steps();
  return {
    draw(f) {
      if (!bottles) {
        const presets = f.view.definition.parameters.find((x) => x.id === parameter)?.presets ?? [];
        const art = kit.drawing(Math.max(presets.length, 1) * 24 + 16, 120);
        S(
          'rect',
          { x: 4, y: 100, width: presets.length * 24 + 8, height: 8, rx: 2, class: 'chem-steel' },
          art,
        );
        bottles = presets.map((preset, i) => {
          const g = S('g', { class: 'chem-bottle', 'aria-hidden': 'true' }, art);
          const x = 12 + i * 24;
          S('title', {}, g).textContent = ctx.texts.of(preset, 'label');
          const body = S('rect', { x, y: 52, width: 16, height: 48, rx: 3, class: GLASS }, g);
          S('rect', { x: x + 5, y: 38, width: 6, height: 14, class: GLASS }, g);
          const cap = S(
            'rect',
            { x: x + 3, y: 32, width: 10, height: 6, rx: 1, class: 'chem-cap' },
            g,
          );
          S('rect', { x: x + 2, y: 70, width: 12, height: 14, class: 'chem-label' }, g);
          kit.listen(g, 'click', () => {
            const why = ctx.refusal('set', parameter, preset.value);
            kit.say(why ?? '');
            if (why === null) ctx.send({ command: 'set', parameter, value: preset.value });
          });
          const putCap = putAttr(cap, 'display');
          const putChosen = putAttr(body, 'data-chosen');
          return {
            value: preset.value,
            open: (open) => {
              putCap(open ? 'none' : 'inline');
              putChosen(open);
            },
          };
        });
      }
      const chosen = f.view.session.parameters[parameter] ?? Number.NaN;
      for (const b of bottles) b.open(Math.abs(b.value - chosen) < 1e-9 ? 1 : 0);
      steps(f);
    },
  };
}

// ---- spotting tile ----------------------------------------------------------------------------

function colourName(texts: Kit['texts'], family: number): string {
  switch (family) {
    case 0:
      return texts.ui('chem.colour.red', 'red');
    case 1:
      return texts.ui('chem.colour.orange', 'orange');
    case 2:
      return texts.ui('chem.colour.yellow', 'yellow');
    case 3:
      return texts.ui('chem.colour.green', 'green');
    case 4:
      return texts.ui('chem.colour.blue', 'blue');
    default:
      return texts.ui('chem.colour.violet', 'violet');
  }
}

function spottingTile(kit: Kit): Part {
  const { texts } = kit;
  const art = kit.drawing(150, 90);
  S('rect', { x: 10, y: 20, width: 130, height: 56, rx: 4, class: 'chem-tile' }, art);
  for (const cx of [40, 75, 110]) S('circle', { cx, cy: 48, r: 14, class: 'chem-well' }, art);
  const drop = S('circle', { cx: 40, cy: 48, r: 9, class: 'chem-liquid', display: 'none' }, art);
  const putShow = putAttr(drop, 'display');
  const paint = putFill(drop, 'fill', css);
  const rgb: [number, number, number] = [0, 0, 0];
  let key = -2;
  let text = '';
  return {
    draw(f) {
      // The universal indicator's colour at the model's pH; no drop without a run.
      const pH = v(f, 'pH');
      putShow(Number.isFinite(pH) ? 'inline' : 'none');
      if (Number.isFinite(pH)) {
        chartLinear(pH, rgb);
        paint(rgb[0], rgb[1], rgb[2]);
      }
    },
    twin(f) {
      const pH = v(f, 'pH');
      const family = Number.isFinite(pH) ? chartFamily(pH) : -1;
      if (family === key) return text;
      key = family;
      text =
        family < 0
          ? ''
          : texts.ui(
              'chem.twin.universal',
              'Universal indicator: {colour} (a guide to about 1 pH)',
              {
                colour: colourName(texts, family),
              },
            );
      return text;
    },
  };
}

export const APPARATUS: Readonly<Record<string, PieceViewFactory>> = {
  burette: defineChem('burette', burette),
  pipette: defineChem('pipette', pipette),
  'retort-stand': defineChem('retort-stand', retortStand),
  'wash-bottle': defineChem('wash-bottle', washBottle),
  'filter-funnel': defineChem('filter-funnel', filterFunnel),
  'reagent-rack': defineChem('reagent-rack', reagentRack),
  'spotting-tile': defineChem('spotting-tile', spottingTile),
};
