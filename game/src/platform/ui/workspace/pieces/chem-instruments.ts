import { decimals, type Reading, readings } from '../../../../simulation/measurement';
import {
  BATH_THERMOMETER,
  LAB_THERMOMETER,
  linearCss,
  thermometerFraction,
  timerShown,
  violetLinear,
  WATER,
} from '../../../labVisuals/chemistry';
import { formatQuantity } from '../../dom';
import {
  changes,
  defineChem,
  type Frame,
  type Kit,
  p,
  type Part,
  putAttr,
  putFill,
  putFormat,
  putText,
  S,
  v,
} from './chem-kit';
import { DONE, electrodeDepth, intoState, NO_STEPS, share } from './chem-look';
import type { PieceViewFactory } from '../types';

/*
 * Instruments, drawn from the model's values: hot plate, balance, pH meter, colorimeter, timer,
 * thermometer, water bath. A display shows a model value only once the model has one (a dash
 * before); the reading of an instrument after the run is the one `measurement.ts` gives. Lamps
 * and glows follow the run state; nothing is animated that the model does not do.
 */

const DASH = '–';
const GLASS = 'chem-glass';
const css = (r: number, g: number, b: number) => linearCss([r, g, b]);
const hundredths = (x: number) => Math.round(x * 100) / 100;

/** The instrument reading of a result once the run completed, found again only for a new run. */
function readingReader(): (f: Frame, result: string) => Reading | null {
  let run: unknown = null;
  let completed = false;
  let list: Reading[] = [];
  return (f, result) => {
    const current = f.view.session.run;
    if (current !== run || f.completed !== completed) {
      run = current;
      completed = f.completed;
      // An answer the student works out is never read out.
      const { definition } = f.view;
      list =
        current && f.completed
          ? readings(definition, current).filter(
              (r) => !definition.results.find((x) => x.id === r.result)?.answer,
            )
          : [];
    }
    return list.find((r) => r.result === result) ?? null;
  };
}

/** A display: a dark window with `text` in it; returns the writer of its text. */
function display(art: SVGSVGElement, x: number, y: number, w: number, h: number, size = 14) {
  S('rect', { x, y, width: w, height: h, rx: 2, class: 'chem-lcd' }, art);
  const text = S(
    'text',
    { x: x + w - 4, y: y + h - 5, 'text-anchor': 'end', class: 'chem-lcd-text', 'font-size': size },
    art,
  );
  text.textContent = DASH;
  return putText(text);
}

/** The first parameter the piece owns, with its definition (its range and unit). */
const ownedParameter = (kit: Kit, f: Frame) =>
  f.view.definition.parameters.find((x) => x.id === kit.owned());

// ---- hot plate --------------------------------------------------------------------------------

function hotPlate(kit: Kit): Part {
  const { texts } = kit;
  const art = kit.drawing(220, 120);
  S('rect', { x: 20, y: 56, width: 180, height: 52, rx: 6, class: 'chem-body' }, art);
  const plate = S('ellipse', { cx: 110, cy: 54, rx: 74, ry: 9, class: 'chem-plate' }, art);
  const lamp = S('circle', { cx: 44, cy: 82, r: 5, class: 'chem-lamp' }, art);
  const knob = S('g', { transform: 'translate(176 82)' }, art);
  S('circle', { r: 13, class: 'chem-knob' }, knob);
  const pointer = S('line', { x1: 0, y1: 0, x2: 0, y2: -11, class: 'chem-pointer' }, knob);
  const setting = display(art, 70, 70, 76, 24);
  const putOn = putAttr(plate, 'data-on');
  const putLamp = putAttr(lamp, 'data-on');
  const putTurn = putFormat(pointer, 'transform', (turn) => `rotate(${turn})`);
  let last = Number.NaN;
  let unit = '';
  return {
    draw(f) {
      const set = ownedParameter(kit, f);
      const value = set ? (f.view.session.parameters[set.id] ?? Number.NaN) : Number.NaN;
      if (set && !Object.is(value, last)) {
        last = value;
        unit = set.unit;
        // The knob turns through 270° over the setting's range.
        putTurn(hundredths(-135 + 270 * share(value - set.min, set.max - set.min)));
        setting(formatQuantity(value, unit));
      }
      // Hot while a run is going with the plate set above zero.
      const hot = f.running && (value > 0 || !set);
      putOn(hot ? 1 : 0);
      putLamp(hot ? 1 : 0);
    },
    twin: (f) => (f.running ? texts.ui('chem.plate.on', 'Plate on') : ''),
  };
}

// ---- balance ----------------------------------------------------------------------------------

function balance(kit: Kit): Part {
  const art = kit.drawing(200, 140);
  S('rect', { x: 20, y: 96, width: 160, height: 30, rx: 5, class: 'chem-body' }, art);
  S('rect', { x: 50, y: 88, width: 100, height: 6, class: 'chem-steel' }, art);
  const heap = S(
    'path',
    { d: 'M80 88 Q100 52 120 88 Z', class: 'chem-solid', display: 'none' },
    art,
  );
  const read = display(art, 120, 104, 52, 16, 11);
  const putHeap = putAttr(heap, 'display');
  const putTall = putFormat(
    heap,
    'transform',
    (s) => `translate(0 ${hundredths(88 * (1 - s))}) scale(1 ${s})`,
  );
  const reading = readingReader();
  const shown = kit.ctx.piece.shows;
  const weighed = shown.find((b) => 'parameter' in b)?.parameter;
  const measured = shown.find((b) => 'instrument' in b)?.instrument;
  const changed = changes();
  return {
    draw(f) {
      const def = f.view.definition;
      const d = p(f, kit.owned());
      const places = d > 0 ? decimals(d) : 2;
      // The weight is the setting before the run (where the definition has the solid weighed), the
      // instrument's reading once the run is complete.
      const r = measured ? reading(f, measured) : null;
      const set = weighed ? (f.view.session.parameters[weighed] ?? Number.NaN) : Number.NaN;
      const param = def.parameters.find((x) => x.id === weighed);
      const fresh = changed(set, d, r ? 1 : 0);
      if (r) read(r.text);
      else if (fresh) read(Number.isFinite(set) ? set.toFixed(places) : DASH);
      const load = share(set, param?.max ?? 0);
      putHeap(load > 0 ? 'inline' : 'none');
      putTall(hundredths(Math.max(load, 0.2)));
    },
  };
}

// ---- pH meter ---------------------------------------------------------------------------------

function phMeter(kit: Kit): Part {
  const { texts } = kit;
  const art = kit.drawing(200, 220);
  S('rect', { x: 20, y: 130, width: 100, height: 70, rx: 6, class: 'chem-body' }, art);
  const read = display(art, 30, 142, 80, 30, 18);
  S('rect', { x: 130, y: 20, width: 8, height: 180, class: 'chem-steel' }, art);
  S('rect', { x: 70, y: 22, width: 68, height: 6, class: 'chem-steel' }, art);
  const probe = S('g', {}, art);
  S('rect', { x: 66, y: 28, width: 6, height: 58, class: 'chem-steel' }, probe);
  S('rect', { x: 64, y: 86, width: 10, height: 24, rx: 5, class: GLASS }, probe);
  const putDepth = putFormat(
    probe,
    'transform',
    (depth) => `translate(0 ${hundredths(depth * 60)})`,
  );
  const run = kit.action(
    () => texts.ui('chem.ph.lower', 'Lower the electrode'),
    'run',
    (f) => !f.running && !f.completed,
  );
  const rinse = kit.action(() => texts.ui('chem.ph.rinse', 'Rinse the electrode'), 'reset');
  const steps = kit.steps();
  const instrument = kit.ctx.piece.shows.find((b) => 'instrument' in b)?.instrument;
  const settled = readingReader();
  const changed = changes();
  return {
    draw(f) {
      putDepth(hundredths(electrodeDepth(f)));
      const d = p(f, kit.owned());
      const live = v(f, 'reading');
      // Once the run is complete, the instrument's reading from measurement.ts; until then the model's, to the dial.
      const r = instrument ? settled(f, instrument) : null;
      const places = d > 0 ? decimals(d) : 2;
      // Formatted only when the displayed digits change.
      const fresh = changed(
        Number.isFinite(live) ? Math.round(live * 10 ** places) : live,
        places,
        r ? 1 : 0,
      );
      if (r) read(r.text);
      else if (fresh) read(Number.isFinite(live) ? live.toFixed(places) : DASH);
      run(f);
      rinse(f);
      steps(f);
    },
    twin: () => texts.ui('chem.ph.calibrated', 'Calibrated (taken as perfect; not modelled)'),
  };
}

// ---- colorimeter ------------------------------------------------------------------------------

function colorimeter(kit: Kit): Part {
  const art = kit.drawing(220, 170);
  S('rect', { x: 20, y: 70, width: 180, height: 80, rx: 8, class: 'chem-body' }, art);
  const lamp = S('circle', { cx: 40, cy: 90, r: 5, class: 'chem-lamp' }, art);
  S('rect', { x: 80, y: 50, width: 36, height: 30, class: 'chem-slot' }, art);
  const cuvette = S(
    'rect',
    { x: 88, y: 20, width: 20, height: 56, rx: 2, class: 'chem-glass' },
    art,
  );
  const dye = S(
    'rect',
    { x: 89, y: 36, width: 18, height: 39, class: 'chem-liquid', display: 'none' },
    art,
  );
  const absorbance = display(art, 130, 84, 60, 24, 14);
  const concentration = display(art, 130, 114, 60, 24, 14);
  const putLamp = putAttr(lamp, 'data-on');
  const putDye = putAttr(dye, 'display');
  const paint = putFill(dye, 'fill', css);
  const putOpacity = putAttr(dye, 'fill-opacity');
  const rgb: [number, number, number] = [0, 0, 0];
  const reading = readingReader();
  const measured = kit.ctx.piece.shows.find((b) => 'instrument' in b)?.instrument;
  const steps = kit.steps();
  const putCuvette = putAttr(cuvette, 'data-in');
  let lastA: number | undefined;
  let lastC = '';
  return {
    draw(f) {
      putLamp(f.running ? 1 : 0);
      // The cuvette is in the slot once the step that puts it there is done (where there is one).
      const into = intoState(f, kit.ctx.piece.id);
      putCuvette(into === NO_STEPS || into === DONE ? 1 : 0);
      const a = v(f, 'absorbance');
      putDye(Number.isFinite(a) ? 'inline' : 'none');
      if (Number.isFinite(a)) {
        putOpacity(hundredths(violetLinear(a, rgb)));
        paint(rgb[0], rgb[1], rgb[2]);
      } else paint(WATER[0], WATER[1], WATER[2]);
      if (!Object.is(a, lastA)) {
        lastA = a;
        absorbance(Number.isFinite(a) ? a.toFixed(3) : DASH);
      }
      const r = measured ? reading(f, measured) : null;
      const text = r ? r.text : DASH;
      if (text !== lastC) concentration((lastC = text));
      steps(f);
    },
  };
}

// ---- timer and stopwatch ----------------------------------------------------------------------

function timer(kit: Kit): Part {
  const art = kit.drawing(180, 100);
  S('rect', { x: 20, y: 14, width: 140, height: 72, rx: 10, class: 'chem-body' }, art);
  const clock = display(art, 34, 26, 112, 36, 24);
  const mark = S('circle', { cx: 46, cy: 74, r: 4, class: 'chem-lamp' }, art);
  const putMark = putAttr(mark, 'data-on');
  const time = kit.ctx.piece.shows.find((b) => 'variable' in b)?.variable ?? '';
  const changed = changes();
  return {
    draw(f) {
      const d = p(f, kit.owned());
      const places = d > 0 ? decimals(d) : 1;
      // Whole steps of the resolution while running, the nearest step once stopped; a dash without a run.
      const t = v(f, time);
      const shown = Number.isFinite(t) ? timerShown(t, d, f.running) : t;
      if (changed(shown, places, 0)) clock(Number.isFinite(t) ? shown.toFixed(places) : DASH);
      putMark(v(f, 'halfTime') > 0 ? 1 : 0);
    },
  };
}

// ---- thermometer and water bath ---------------------------------------------------------------

/** A thermometer's column in an SVG, `from` to `to` °C over 200 mm: returns the writer of its temperature. */
function column(art: SVGSVGElement, x: number, top: number, from: number, to: number) {
  S('rect', { x: x - 4, y: top, width: 8, height: 206, rx: 4, class: 'chem-glass' }, art);
  S('circle', { cx: x, cy: top + 214, r: 9, class: 'chem-glass' }, art);
  const liquid = S(
    'rect',
    { x: x - 2, y: top + 206, width: 4, height: 0, class: 'chem-mercury' },
    art,
  );
  S('circle', { cx: x, cy: top + 214, r: 7, class: 'chem-mercury' }, art);
  const putY = putAttr(liquid, 'y');
  const putH = putAttr(liquid, 'height');
  const y0 = top + 206;
  for (let t = Math.ceil(from / 20) * 20; t <= to; t += 20) {
    const y = y0 - thermometerFraction(t, from, to) * 200;
    S('line', { x1: x + 6, x2: x + 12, y1: y, y2: y, class: 'chem-ticks' }, art);
    S('text', { x: x + 15, y: y + 3, class: 'chem-scale-text' }, art).textContent = String(t);
  }
  return (celsius: number) => {
    // The column rises over the 200 mm scale (into the bulb below it); none without a temperature.
    const rise = thermometerFraction(celsius, from, to) * 200;
    putY(hundredths(y0 - rise));
    putH(Number.isFinite(celsius) ? hundredths(rise + 8) : 0);
  };
}

function thermometer(kit: Kit): Part {
  const art = kit.drawing(110, 250);
  const set = column(art, 40, 10, LAB_THERMOMETER.low, LAB_THERMOMETER.high);
  return {
    // The model's temperature; before a run, the temperature the dial sets.
    draw(f) {
      const t = v(f, 'temperature');
      set(Number.isFinite(t) ? t : p(f, 'startTemperature'));
    },
  };
}

function waterBath(kit: Kit): Part {
  const art = kit.drawing(250, 250);
  S('rect', { x: 20, y: 90, width: 170, height: 130, rx: 6, class: 'chem-glass' }, art);
  S('rect', { x: 23, y: 120, width: 164, height: 97, class: 'chem-liquid chem-bathwater' }, art);
  const set = column(art, 215, 10, BATH_THERMOMETER.from, BATH_THERMOMETER.to);
  return {
    draw(f) {
      set(p(f, kit.owned()));
    },
  };
}

export const INSTRUMENTS: Readonly<Record<string, PieceViewFactory>> = {
  'hot-plate': defineChem('hot-plate', hotPlate),
  balance: defineChem('balance', balance),
  'ph-meter': defineChem('ph-meter', phMeter),
  colorimeter: defineChem('colorimeter', colorimeter),
  timer: defineChem('timer', timer),
  stopwatch: defineChem('stopwatch', timer),
  thermometer: defineChem('thermometer', thermometer),
  'water-bath': defineChem('water-bath', waterBath),
};
