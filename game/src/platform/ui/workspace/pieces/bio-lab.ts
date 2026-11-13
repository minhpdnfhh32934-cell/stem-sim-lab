import { GAS_CONSTANT } from '../../../../simulation/models/osmosis';
import { arrowWidth } from '../../../labVisuals/biology';
import { clockText, fraction, thermalTint } from '../../../labVisuals/readouts';
import { el } from '../../dom';
import { bubbleShare, cylinderFraction, plungerFraction, RunMax } from './bio-maps';
import { bottle } from './bio-microscope';
import {
  bindAttr,
  bindNumber,
  bindNumberAttr,
  bound,
  bindings,
  type ChoiceIcon,
  choices,
  classNamer,
  defineBio,
  drawing,
  inputRow,
  instrumentReadout,
  liveRow,
  num,
  parameterOf,
  parameterRow,
  resultRow,
  S,
} from './bio-kit';

/*
 * The wet-lab pieces of osmosis and enzyme activity (docs/experiment-workspace-design.md,
 * Biology D2 and D3): the bottles and potato cylinders of the library, the boiling tube, the
 * membrane lens, the timer and stopwatch, the balance, the extract syringe, the water bath, the
 * reaction tube and the gas syringe. Each draws only what the model's variables and the run's
 * settings say; colourless solutions stay colourless (the definitions give no colour), the
 * reaction shows bubbles in proportion to the rate and no colour change (the model has none).
 */

const LIQUID = '#d9eaf2';

// ---- the library: solutions, buffers and potato cylinders -------------------------------------

export const solutionBottle = defineBio('solution-bottle', (kit) => {
  const choose = choices(kit, kit.host, kit.owned(), () => bottle(LIQUID));
  return { draw: choose };
});

export const bufferBottle = defineBio('buffer-bottle', (kit) => {
  // A label only: the definition gives no indicator colour for a buffer.
  const choose = choices(kit, kit.host, kit.owned(), () => bottle(LIQUID));
  return { draw: choose };
});

/** A potato cylinder drawn to length in proportion to its set mass (its length is m₀·ρ⁻¹·πr⁻²). */
export const tissueSample = defineBio('tissue-sample', (kit) => {
  const parameter = kit.owned();
  const choose = choices(kit, kit.host, parameter, (preset, f) => {
    const max = Math.max(
      ...(parameterOf(f.view.definition, parameter)?.presets ?? []).map((p) => p.value),
    );
    const root = S('svg', { viewBox: '0 0 60 24', 'aria-hidden': 'true', class: 'bio-cylinder' });
    const length = max > 0 ? (52 * preset.value) / max : 0;
    S('rect', { x: 4, y: 6, width: length, height: 12, rx: 5, class: 'bio-flesh' }, root);
    return { node: root } satisfies ChoiceIcon;
  });
  return { draw: choose };
});

// ---- the boiling tube -------------------------------------------------------------------------

/** The hero of osmosis: the sucrose solution (a fixed volume), its label, the cylinder while it soaks. */
export const boilingTube = defineBio('boiling-tube', (kit) => {
  const root = drawing(kit.host, 90, 230, kit.label);
  const top = 20;
  const bottomY = 205;
  S(
    'path',
    { d: `M20 ${top - 8}V${bottomY - 24}a25 25 0 0 0 50 0V${top - 8}`, class: 'bio-glass' },
    root,
  );
  S(
    'path',
    {
      d: `M21 ${top + 40}V${bottomY - 24}a24 24 0 0 0 48 0V${top + 40}z`,
      fill: LIQUID,
      opacity: 0.8,
    },
    root,
  );
  const cylinder = S(
    'rect',
    { x: 39, y: 100, width: 12, height: 0, rx: 5, class: 'bio-flesh' },
    root,
  );
  const height = bindAttr(cylinder, 'height');
  const y = bindAttr(cylinder, 'y');
  const concentration = bound(kit, 'parameter', 'concentration');
  const mass = bound(kit, 'variable', 'mass');
  const label = parameterRow(kit, kit.host, concentration);
  const potential = resultRow(kit, kit.host, bound(kit, 'result', 'solutionPotential'));
  const inner = bottomY - top - 28; // the straight bore, in drawing units
  return {
    draw(f) {
      // In the tube while it soaks (running or stopped), then on the balance.
      const soaking = f.status === 'running' || f.status === 'stopped';
      const h = soaking ? cylinderFraction(num(f.s, mass), num(f.p, 'initialMass')) * inner : 0;
      height(h);
      y(bottomY - 24 - h);
      label(f);
      potential(f);
    },
  };
});

// ---- the membrane lens ------------------------------------------------------------------------

/** A cell-membrane line with arrows for the water's way, as wide as the potential difference: none without a run. */
export const membraneLens = defineBio('membrane-lens', (kit) => {
  const root = drawing(kit.host, 140, 140, kit.label);
  S('circle', { cx: 70, cy: 70, r: 66, class: 'bio-lens-frame' }, root);
  S('path', { d: 'M70 8V132', class: 'bio-membrane' }, root);
  const arrows = S('g', { class: 'bio-arrows', opacity: 0 }, root);
  const a = S('path', { d: 'M22 48H62M50 38L62 48L50 58', class: 'bio-arrow' }, arrows);
  const b = S('path', { d: 'M22 92H62M50 82L62 92L50 102', class: 'bio-arrow' }, arrows);
  const show = bindAttr(arrows, 'opacity');
  const flip = bindAttr(arrows, 'transform');
  const widthA = bindAttr(a, 'stroke-width');
  const widthB = bindAttr(b, 'stroke-width');
  const name = classNamer(kit.texts, 'direction');
  const text = el('p', 'bio-class');
  kit.host.append(text);
  const difference = liveRow(kit, kit.host, 'potentialDifference');
  const tissue = liveRow(kit, kit.host, 'tissuePotential');
  let lastName = '';
  let maxC: number | null = null; // the strongest solution the parameter offers (fixed by the data)
  return {
    draw(f) {
      const direction = num(f.s, 'direction');
      const delta = num(f.s, 'potentialDifference');
      // Full scale: the difference a 1 mol/L solution makes at the run's temperature, R·T·C (kPa).
      if (maxC === null) {
        const param = parameterOf(f.view.definition, bound(kit, 'parameter', 'concentration'));
        maxC = Math.max(...(param?.presets ?? []).map((p) => p.value));
      }
      const fullScale =
        GAS_CONSTANT * (273.15 + (f.view.session.run?.inputs.temperature ?? NaN)) * maxC;
      const w = arrowWidth(delta, fullScale);
      const showing = f.run && Number.isFinite(direction) && direction !== 0 && w > 0;
      show(showing ? 1 : 0);
      // Water in (+): solution on the left to the tissue on the right; out (−): the other way.
      flip(direction < 0 ? 'translate(140 0) scale(-1 1)' : 'translate(0 0)'); // SVG has no transform "none"
      widthA(w);
      widthB(w);
      const named = f.run ? name(f, direction) : '';
      if (named !== lastName) {
        lastName = named;
        text.textContent = named;
      }
      difference(f);
      tissue(f);
    },
  };
});

// ---- timer and stopwatch ----------------------------------------------------------------------

function clockPiece(kind: string, inputs: readonly string[], variables: readonly string[]) {
  return defineBio(kind, (kit) => {
    const lcd = el('output', 'bio-lcd');
    kit.host.append(lcd);
    const variable = bound(kit, 'variable', '');
    const shown = bindings(kit, 'input');
    const rows = (shown.length ? shown : inputs).map((id) => inputRow(kit.host, id));
    const owned = kit.owned();
    const choose = owned ? choices(kit, kit.host, owned) : null;
    const write = bindNumber(lcd, clockText);
    let name = variable;
    return {
      draw(f) {
        if (!name && f.run) name = variables.find((v) => v in f.s) ?? '';
        write(num(f.s, name));
        for (const row of rows) row(f);
        choose?.(f);
      },
    };
  });
}

/** Lab time (osmosis): the soak time to set, the time-lapse factor shown. */
export const timer = clockPiece('timer', ['timeLapse'], ['labTime']);
/** The run's own clock (enzymes: collection time; plants: the measuring time). */
export const stopwatch = clockPiece(
  'stopwatch',
  ['collectionTime', 'duration'],
  ['clock', 'elapsed', 'labTime'],
);

// ---- the balance ------------------------------------------------------------------------------

/** The balance: no reading until the run has completed, then the cylinder's mass to d (u and d/2 beside it). */
export const balance = defineBio('balance', (kit) => {
  const root = drawing(kit.host, 160, 90, kit.label);
  S('rect', { x: 10, y: 58, width: 140, height: 26, rx: 6, class: 'bio-metal' }, root);
  S('rect', { x: 50, y: 52, width: 60, height: 6, rx: 2, class: 'bio-metal' }, root);
  const cylinder = S(
    'rect',
    { x: 62, y: 38, width: 36, height: 12, rx: 5, class: 'bio-flesh', opacity: 0 },
    root,
  );
  const show = bindAttr(cylinder, 'opacity');
  const resultId = bound(kit, 'instrument', 'finalMass');
  const readout = instrumentReadout(kit, kit.host, () => resultId);
  const choose = choices(kit, kit.host, kit.owned());
  return {
    draw(f) {
      show(readout(f) ? 1 : 0);
      choose(f);
    },
  };
});

// ---- the extract syringe ----------------------------------------------------------------------

/** The syringe barrel filled to the set volume (a set value, as the dial). */
export const dispensingSyringe = defineBio('dispensing-syringe', (kit) => {
  const root = drawing(kit.host, 180, 44, kit.label);
  S('rect', { x: 30, y: 10, width: 120, height: 24, rx: 3, class: 'bio-glass' }, root);
  const liquid = S(
    'rect',
    { x: 31, y: 11, width: 0, height: 22, fill: LIQUID, opacity: 0.85 },
    root,
  );
  S('path', { d: 'M150 22H172', class: 'bio-metal-line' }, root);
  S('rect', { x: 8, y: 6, width: 4, height: 32, class: 'bio-metal' }, root);
  S('path', { d: 'M12 22H30', class: 'bio-metal-line' }, root);
  const width = bindAttr(liquid, 'width');
  const parameter = kit.owned();
  const choose = choices(kit, kit.host, parameter);
  return {
    draw(f) {
      const max = parameterOf(f.view.definition, parameter)?.max ?? NaN;
      width(118 * fraction(num(f.p, parameter), 0, max));
      choose(f);
    },
  };
});

// ---- the water bath ---------------------------------------------------------------------------

/** The bath: its tint warm or cool from the set temperature, the thermometer at that temperature. */
export const waterBath = defineBio('water-bath', (kit) => {
  const root = drawing(kit.host, 160, 110, kit.label);
  S('rect', { x: 10, y: 30, width: 140, height: 72, rx: 8, class: 'bio-glass' }, root);
  const water = S('rect', { x: 12, y: 44, width: 136, height: 56, rx: 6, opacity: 0.8 }, root);
  S('rect', { x: 126, y: 6, width: 8, height: 60, rx: 4, class: 'bio-glass' }, root);
  const mercury = S('rect', { x: 128, y: 64, width: 4, height: 0, class: 'bio-mercury' }, root);
  const tint = bindAttr(water, 'fill');
  const column = bindNumberAttr(mercury, 'y', (h) => String(64 - h));
  const columnHeight = bindAttr(mercury, 'height');
  const parameter = kit.owned();
  const set = parameterRow(kit, kit.host, parameter);
  const choose = choices(kit, kit.host, parameter);
  let lastT = Number.NaN;
  return {
    draw(f) {
      const param = parameterOf(f.view.definition, parameter);
      const t = fraction(num(f.p, parameter), param?.min ?? 0, param?.max ?? 0);
      if (!Object.is(t, lastT)) {
        lastT = t;
        tint(thermalTint(t));
      }
      const h = 58 * t;
      column(h);
      columnHeight(h);
      set(f);
      choose(f);
    },
  };
});

// ---- the reaction tube and the gas syringe ----------------------------------------------------

const BUBBLES = 8;

/** The reaction: bubbles in proportion to the rate against the run's fastest, none without a run; no colour change. */
export const reactionTube = defineBio('reaction-tube', (kit) => {
  const root = drawing(kit.host, 90, 200, kit.label);
  S('path', { d: 'M20 10V160a25 25 0 0 0 50 0V10', class: 'bio-glass' }, root);
  S('path', { d: 'M21 60V160a24 24 0 0 0 48 0V60z', fill: LIQUID, opacity: 0.8 }, root);
  const dots = Array.from({ length: BUBBLES }, (_, i) =>
    S(
      'circle',
      { cx: 28 + ((i * 11) % 34), cy: 170, r: 2.5 + (i % 3), class: 'bio-bubble', opacity: 0 },
      root,
    ),
  );
  const shown = dots.map((d) => bindAttr(d, 'opacity'));
  const rises = dots.map((d) => bindAttr(d, 'cy'));
  const max = new RunMax();
  const substrate = liveRow(kit, kit.host, 'substrate');
  const conversion = liveRow(kit, kit.host, 'conversion');
  const mixture = inputRow(kit.host, 'mixtureVolume');
  return {
    draw(f) {
      const rate = num(f.s, 'rate');
      const clock = num(f.s, 'clock');
      const share = bubbleShare(rate, max.update(f.view.session.run, rate));
      const count = f.run ? Math.ceil(share * BUBBLES) : 0;
      for (let i = 0; i < BUBBLES; i++) {
        const on = i < count && Number.isFinite(clock);
        shown[i]?.(on ? 1 : 0);
        // Rising with the model's clock (the same every time, still when the run is).
        if (on) rises[i]?.(Math.round((165 - 130 * ((clock * 0.4 + i * 0.37) % 1)) * 10) / 10);
      }
      substrate(f);
      conversion(f);
      mixture(f);
    },
  };
});

/** The gas syringe: the plunger at the oxygen collected on its scale. */
export const gasSyringe = defineBio('gas-syringe', (kit) => {
  const root = drawing(kit.host, 220, 50, kit.label);
  S('rect', { x: 20, y: 12, width: 170, height: 26, rx: 3, class: 'bio-glass' }, root);
  for (let i = 0; i <= 10; i++) {
    S('path', { d: `M${20 + i * 17}.5 12v${i % 5 ? 5 : 9}`, class: 'bio-metal-line' }, root);
  }
  const plunger = S('rect', { x: 20, y: 13, width: 4, height: 24, class: 'bio-metal' }, root);
  const x = bindAttr(plunger, 'x');
  const oxygen = liveRow(kit, kit.host, 'oxygen');
  return {
    draw(f) {
      x(20 + 166 * plungerFraction(num(f.s, 'oxygen')));
      oxygen(f);
    },
  };
});
