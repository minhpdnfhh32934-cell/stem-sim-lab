import { CAPILLARY_ML, fanPeriod, stomatalOpening } from '../../../labVisuals/biology';
import { fraction } from '../../../labVisuals/readouts';
import { BUBBLE_POOL, BubbleRing, columnFraction, scaleMarks, unitRatio } from './bio-maps';
import {
  bindAttr,
  bindNumberAttr,
  bound,
  choices,
  defineBio,
  drawing,
  inputRow,
  inputValue,
  instrumentReadout,
  liveRow,
  measurementOf,
  num,
  parameterOf,
  parameterRow,
  S,
} from './bio-kit';

/*
 * The plant pieces of photosynthesis and transpiration (docs/experiment-workspace-design.md,
 * Biology D4 and D5): the lamp on its rule, the heat filter, the plant (a pondweed under a
 * funnel, or a leafy shoot in its chamber), the capillary scale, the fan, the hygrometer, the
 * stomata lens and the transpiration lamp. Bubbles appear one per increment of the model's
 * bubble count and move with the model's time; leaves sway with the run's clock; the fan turns
 * at a speed set by the air speed; nothing is drawn that a variable does not say.
 */

// ---- the lamp on its rule ---------------------------------------------------------------------

/** The lamp at its distance on the rule, marked at the presets; its glow is on while the run is. */
export const lampRule = defineBio('lamp-rule', (kit) => {
  const root = drawing(kit.host, 260, 90, kit.label);
  S('rect', { x: 30, y: 62, width: 200, height: 8, class: 'bio-metal' }, root);
  const marks = S('path', { d: '', class: 'bio-metal-line' }, root);
  const lamp = S('g', {}, root);
  const glow = S('circle', { cx: 0, cy: 40, r: 26, class: 'bio-glow', opacity: 0 }, lamp);
  S('rect', { x: -10, y: 28, width: 20, height: 26, rx: 4, class: 'bio-lamp-body' }, lamp);
  S('path', { d: 'M0 54V62', class: 'bio-metal-line' }, lamp);
  const move = bindNumberAttr(lamp, 'transform', (x) => `translate(${x} 0)`);
  const lit = bindAttr(glow, 'opacity');
  const parameter = kit.owned();
  const intensity = liveRow(kit, kit.host, 'intensity');
  const squared = liveRow(kit, kit.host, 'distanceSquared');
  const choose = choices(kit, kit.host, parameter);
  let drawn = false;
  const x = (d: number, min: number, max: number) => 30 + 200 * fraction(d, min, max);
  return {
    draw(f) {
      const param = parameterOf(f.view.definition, parameter);
      const min = param?.min ?? 0;
      const max = param?.max ?? 0;
      if (!drawn && param) {
        drawn = true;
        marks.setAttribute(
          'd',
          param.presets.map((p) => `M${x(p.value, min, max)} 56v18`).join(''),
        );
      }
      const d = num(f.p, parameter);
      move(Number.isFinite(d) ? x(d, min, max) : 30);
      lit(f.running ? 0.9 : 0);
      intensity(f);
      squared(f);
      choose(f);
    },
  };
});

// ---- the heat filter (fixed) ------------------------------------------------------------------

/** The water tank between lamp and plant that takes out the heat: fixed, it has no parameter. */
export const heatFilter = defineBio('heat-filter', (kit) => {
  const root = drawing(kit.host, 60, 120, kit.label);
  S('rect', { x: 14, y: 8, width: 32, height: 104, rx: 3, class: 'bio-glass' }, root);
  S('rect', { x: 16, y: 20, width: 28, height: 90, fill: '#d9eaf2', opacity: 0.7 }, root);
  return { draw: () => undefined };
});

// ---- the plant --------------------------------------------------------------------------------

/**
 * The plant: pondweed under an inverted funnel with one bubble rising per increment of `bubbles`,
 * or a leafy shoot in its chamber whose leaves sway with the run's clock in proportion to the air
 * speed (a variant per model: told apart by its variables).
 */
export const plant = defineBio('plant', (kit) => {
  const root = drawing(kit.host, 220, 270, kit.label);
  const weed = S('g', {}, root);
  S('path', { d: 'M40 250H180V120H40z', class: 'bio-glass' }, weed);
  S('path', { d: 'M42 150H178V250H42z', fill: '#d9eaf2', opacity: 0.6 }, weed);
  S('path', { d: 'M70 240L110 150L150 240z', class: 'bio-glass' }, weed);
  S('path', { d: 'M110 150V60', class: 'bio-glass' }, weed);
  S('path', { d: 'M110 236C100 220 120 210 106 196S118 176 110 166', class: 'bio-stem' }, weed);
  const pool = Array.from({ length: BUBBLE_POOL }, (_, i) =>
    S(
      'circle',
      { cx: 110 + (i % 2 ? 3 : -3), cy: 160, r: 4, class: 'bio-bubble', opacity: 0 },
      weed,
    ),
  );
  const shoot = S('g', {}, root);
  S('rect', { x: 40, y: 40, width: 140, height: 210, rx: 12, class: 'bio-glass' }, shoot);
  S('path', { d: 'M110 250V90', class: 'bio-stem' }, shoot);
  const leaves = [
    S(
      'path',
      { d: 'M110 190C70 170 60 130 70 120C100 130 110 160 110 190', class: 'bio-leaf' },
      shoot,
    ),
    S(
      'path',
      { d: 'M110 150C150 130 160 90 150 80C120 90 110 120 110 150', class: 'bio-leaf' },
      shoot,
    ),
    S('path', { d: 'M110 110C80 100 76 70 84 62C104 70 110 90 110 110', class: 'bio-leaf' }, shoot),
  ];
  const sway = leaves.map((leaf, i) =>
    bindNumberAttr(leaf, 'transform', (a) => `rotate(${a} 110 ${190 - 40 * i})`),
  );
  const rise = pool.map((b) => bindAttr(b, 'cy'));
  const show = pool.map((b) => bindAttr(b, 'opacity'));
  const ring = new BubbleRing();
  const count = liveRow(kit, kit.host, 'bubbles');
  let variant: boolean | null = null; // true: pondweed
  return {
    draw(f) {
      const pondweed = 'bubbles' in f.s;
      if (pondweed !== variant) {
        variant = pondweed;
        weed.setAttribute('display', pondweed ? 'inline' : 'none');
        shoot.setAttribute('display', pondweed ? 'none' : 'inline');
      }
      if (pondweed) {
        const now = num(f.s, 'elapsed');
        ring.update(num(f.s, 'bubbles'), now);
        for (let i = 0; i < BUBBLE_POOL; i++) {
          const k = ring.progress(i, now);
          show[i]?.(k >= 0 ? 0.9 : 0);
          if (k >= 0) rise[i]?.(Math.round((160 - 90 * k) * 10) / 10);
        }
        count(f);
        return;
      }
      // Leaves sway with the run's own clock, as far as the air speed is a fraction of its range.
      const speed = parameterOf(f.view.definition, 'airSpeed');
      const time = f.view.session.run?.time ?? Number.NaN;
      const amplitude = f.run ? 18 * fraction(num(f.p, 'airSpeed'), 0, speed?.max ?? 0) : 0;
      for (let i = 0; i < sway.length; i++) {
        sway[i]?.(
          Math.round(amplitude * Math.sin(2 * Math.PI * time * (0.8 + 0.2 * i)) * 10) / 10 || 0,
        );
      }
    },
  };
});

// ---- the capillary scale ----------------------------------------------------------------------

/**
 * A graduated capillary: the gas column under the cap (photosynthesis, `volume`) or the bubble's
 * leading edge along the scale (transpiration, `distance`), marks every resolution δ the
 * parameter gives (none where the units are not known), and the reading to δ after completion.
 */
export const capillaryScale = defineBio('capillary-scale', (kit) => {
  const root = drawing(kit.host, 280, 90, kit.label);
  S('rect', { x: 20, y: 30, width: 240, height: 24, rx: 4, class: 'bio-glass' }, root);
  const column = S('rect', { x: 21, y: 32, width: 0, height: 20, class: 'bio-gas' }, root);
  const ticks = S('path', { d: '', class: 'bio-metal-line' }, root);
  const width = bindAttr(column, 'width');
  const parameter = kit.owned();
  let variableName: string | null = null;
  let resultId = '';
  const reading = instrumentReadout(kit, kit.host, () => resultId);
  const choose = choices(kit, kit.host, parameter);
  const marks: number[] = [];
  let step = Number.NaN;
  let length = Number.NaN;
  return {
    draw(f) {
      if (variableName === null) {
        variableName = bound(kit, 'variable', 'volume' in f.s ? 'volume' : 'distance');
        resultId = bound(kit, 'instrument', variableName);
      }
      const volume = variableName === 'volume';
      const value = num(f.s, variableName);
      // The scale: the capillary's own capacity, or the apparatus' scale length (an input).
      const full = volume ? CAPILLARY_ML : inputValue(f, 'scaleLength');
      width(238 * (volume ? columnFraction(value) : fraction(value, 0, full)));
      const param = parameterOf(f.view.definition, parameter);
      const unit = measurementOf(f.view.definition, variableName)?.unit ?? '';
      // The run's own resolution (what its reading was taken at), not the dial changed since.
      const resolution = num(f.p, parameter) * unitRatio(param?.unit ?? '', unit);
      if (!Object.is(resolution, step) || !Object.is(full, length)) {
        step = resolution;
        length = full;
        scaleMarks(resolution, full, marks);
        ticks.setAttribute('d', marks.map((m) => `M${20 + 240 * m} 54v5`).join(''));
      }
      reading(f);
      choose(f);
    },
  };
});

// ---- the fan ----------------------------------------------------------------------------------

/** The fan: its blades turn faster with the air speed, stopped at the slowest the model allows. */
export const fan = defineBio('fan', (kit) => {
  const root = drawing(kit.host, 100, 100, kit.label);
  const blades = S('g', { class: 'bio-blades' }, root);
  for (let i = 0; i < 3; i++) {
    S(
      'ellipse',
      { cx: 50, cy: 28, rx: 9, ry: 22, class: 'bio-blade', transform: `rotate(${i * 120} 50 50)` },
      blades,
    );
  }
  S('circle', { cx: 50, cy: 50, r: 7, class: 'bio-metal' }, root);
  const parameter = kit.owned();
  const set = parameterRow(kit, kit.host, parameter);
  const choose = choices(kit, kit.host, parameter);
  const turn = bindNumberAttr(blades, 'transform', (a) => `rotate(${a} 50 50)`);
  return {
    draw(f) {
      const param = parameterOf(f.view.definition, parameter);
      const period = fanPeriod(num(f.p, parameter), param?.min ?? Number.NaN);
      // Turned by the run's own clock (still when the run or the game is), stopped at the slowest speed or without a run.
      const time = f.view.session.run?.time ?? Number.NaN;
      turn(
        f.run && period !== null && Number.isFinite(time)
          ? Math.round(((time / period) % 1) * 3600) / 10
          : 0,
      );
      set(f);
      choose(f);
    },
  };
});

// ---- the hygrometer ---------------------------------------------------------------------------

/** The humidity gauge: the needle at the set relative humidity; the air temperature beside it. */
export const hygrometer = defineBio('hygrometer', (kit) => {
  const root = drawing(kit.host, 140, 90, kit.label);
  S('path', { d: 'M20 80A50 50 0 0 1 120 80', class: 'bio-gauge' }, root);
  const needle = S('path', { d: 'M70 80L70 38', class: 'bio-needle' }, root);
  const turn = bindNumberAttr(needle, 'transform', (a) => `rotate(${a} 70 80)`);
  const parameter = kit.owned();
  const set = parameterRow(kit, kit.host, parameter);
  const temperature = inputRow(kit.host, 'temperature');
  const choose = choices(kit, kit.host, parameter);
  return {
    draw(f) {
      const param = parameterOf(f.view.definition, parameter);
      turn(-80 + 160 * fraction(num(f.p, parameter), param?.min ?? 0, param?.max ?? 0));
      set(f);
      temperature(f);
      choose(f);
    },
  };
});

// ---- the stomata lens -------------------------------------------------------------------------

/** A stomatal pore between two guard cells, as open as the conductance says; closed without a run. */
export const stomataLens = defineBio('stomata-lens', (kit) => {
  const root = drawing(kit.host, 140, 140, kit.label);
  S('circle', { cx: 70, cy: 70, r: 66, class: 'bio-lens-frame' }, root);
  S('path', { d: 'M20 70C20 30 120 30 120 70', class: 'bio-guard' }, root);
  S('path', { d: 'M20 70C20 110 120 110 120 70', class: 'bio-guard' }, root);
  const pore = S('ellipse', { cx: 70, cy: 70, rx: 44, ry: 1, class: 'bio-pore' }, root);
  const open = bindNumberAttr(pore, 'ry', (k) => String(1 + 25 * k));
  const conductance = liveRow(kit, kit.host, 'stomatalConductance');
  return {
    draw(f) {
      open(f.run ? stomatalOpening(num(f.s, 'stomatalConductance')) : 0);
      conductance(f);
    },
  };
});

// ---- the transpiration lamp -------------------------------------------------------------------

/** The lamp with a light meter reading the set illuminance; its glow follows it, off at 0. */
export const lamp = defineBio('lamp', (kit) => {
  const root = drawing(kit.host, 100, 100, kit.label);
  const glow = S('circle', { cx: 50, cy: 44, r: 34, class: 'bio-glow', opacity: 0 }, root);
  S('rect', { x: 36, y: 30, width: 28, height: 30, rx: 5, class: 'bio-lamp-body' }, root);
  S('path', { d: 'M50 60V90', class: 'bio-metal-line' }, root);
  const shine = bindAttr(glow, 'opacity');
  const parameter = kit.owned();
  const meter = parameterRow(kit, kit.host, parameter);
  const choose = choices(kit, kit.host, parameter);
  return {
    draw(f) {
      const param = parameterOf(f.view.definition, parameter);
      shine(0.9 * fraction(num(f.p, parameter), 0, param?.max ?? 0));
      meter(f);
      choose(f);
    },
  };
});
