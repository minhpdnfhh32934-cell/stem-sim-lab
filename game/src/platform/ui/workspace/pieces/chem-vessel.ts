import { BOILING } from '../../../../simulation/models/heating';
import {
  BEAKER_250,
  CONICAL_FLASK_250,
  CONICAL_LIQUID_250,
  conicalFlaskLevel,
  FLASK_GLASS,
  FLASKS,
  flaskLevel,
  heldBelow,
  ICE_SUBMERGED,
  iceHeight,
  levelIn,
  linearCss,
  solutionLevel,
  waterLevel,
  WATER_MASS,
  WATER_DENSITY,
} from '../../../labVisuals/chemistry';
import {
  classLabel,
  clipOf,
  defineChem,
  p,
  polygon,
  putAttr,
  putFill,
  S,
  uid,
  v,
  type Kit,
  type Part,
} from './chem-kit';
import {
  bedOf,
  contentsMl,
  crystalShare,
  DONE,
  intoState,
  newTint,
  NO_STEPS,
  precipitateTint,
  tintReader,
} from './chem-look';
import type { PieceViewFactory } from '../types';

/*
 * A vessel: the glass and what is in it, drawn from the model. The level is the volume the model
 * (or the setting) gives, through the same maps as the 3D benches; the colour is the indicator's
 * at the model's pH, the dye's at its absorbance, a precipitate's by the model's product code.
 * Where the model gives a colour but no volume (a cuvette, a mixing beaker), the liquid is drawn at
 * a fixed fill: a drawing convention, not a quantity.
 */

type Profile = readonly (readonly [number, number])[];

/** A vessel's glass: its inside (r, y in metres from the inside floor), how it holds `ml`, and its floor. */
interface Shape {
  readonly profile: Profile;
  readonly floor: number;
  readonly level: (ml: number) => number;
  /** Where a mark ring is (volumetric flasks). */
  readonly mark?: number;
}

const FIXED_FILL = 0.6;
const LEVEL = { y: 0, r: 0 };

/** A shape whose level comes from the shared frustum maps over its own profile. */
function profiled(profile: Profile, floor = FLASK_GLASS): Shape {
  const held = heldBelow(profile);
  return {
    profile,
    floor,
    level: (ml) => {
      levelIn(profile, held, ml, LEVEL);
      return LEVEL.y;
    },
  };
}

const { neck, shoulder, height, wall } = CONICAL_FLASK_250;
const CONE_NECK = CONICAL_LIQUID_250.radius - CONICAL_LIQUID_250.slope * (shoulder - wall);
const INNER = BEAKER_250.radius - BEAKER_250.wall;

const CONICAL: Shape = {
  profile: [
    [CONICAL_LIQUID_250.radius, 0],
    [CONE_NECK, shoulder - wall],
    [neck - wall, height - wall],
  ],
  floor: wall,
  level: conicalFlaskLevel,
};
const BEAKER: Shape = {
  profile: [
    [INNER, 0],
    [INNER, BEAKER_250.height - BEAKER_250.base],
  ],
  floor: BEAKER_250.base,
  level: (ml) => waterLevel((ml * WATER_DENSITY) / 1e6),
};
const TUBE = profiled([
  [0.0125, 0],
  [0.0125, 0.15],
]);
const DISH = profiled([
  [0.018, 0],
  [0.034, 0.012],
  [0.044, 0.028],
]);
const CUVETTE = profiled([
  [0.0055, 0],
  [0.0055, 0.045],
]);

const SHAPES: Readonly<Record<string, readonly Shape[]>> = {
  'conical-flask': [CONICAL],
  beaker: [BEAKER],
  'boiling-tube': [TUBE],
  'evaporating-dish': [DISH],
  cuvette: [CUVETTE],
  'volumetric-flask': FLASKS.map((flask) => ({
    profile: flask.profile,
    floor: FLASK_GLASS,
    level: (ml: number) => flaskLevel(flask, ml),
    mark: flask.mark,
  })),
};

/** The index of the volumetric flask whose nominal volume is nearest `ml`. */
function nearestFlask(ml: number): number {
  let best = 0;
  for (let i = 1; i < FLASKS.length; i++) {
    if (Math.abs((FLASKS[i]?.ml ?? 0) - ml) < Math.abs((FLASKS[best]?.ml ?? 0) - ml)) best = i;
  }
  return best;
}

const insideTop = (shape: Shape): number => shape.profile[shape.profile.length - 1]?.[1] ?? 0;
const widest = (shape: Shape): number => Math.max(...shape.profile.map(([r]) => r));

/** One glass drawn once: its outline, the clipped layers inside it, and the writers of those. */
function drawGlass(art: SVGSVGElement, shape: Shape, cx: number, floorY: number, span: number) {
  const g = S('g', {}, art);
  const insideFloor = floorY - shape.floor * 1000;
  const outer: Profile = [
    [(shape.profile[0]?.[0] ?? 0) + shape.floor, -shape.floor],
    ...shape.profile.map(([r, y]): readonly [number, number] => [r + shape.floor, y]),
  ];
  S('polygon', { points: polygon(outer, cx, insideFloor), class: 'chem-glass' }, g);
  const layers = S('g', { 'clip-path': clipOf(art, polygon(shape.profile, cx, insideFloor)) }, g);
  const rect = (cls: string) =>
    S('rect', { x: cx - span, width: 2 * span, y: insideFloor, height: 0, class: cls }, layers);
  const liquid = rect('chem-liquid');
  const turbid = rect('chem-turbid');
  const ice = rect('chem-ice');
  const solid = rect('chem-solid');
  // Bubbles rise inside the liquid only: clipped to it.
  const surface = S('rect', { x: cx - span, width: 2 * span, y: insideFloor, height: 0 });
  const clip = S('clipPath', { id: uid('chem-surface') }, art);
  clip.append(surface);
  const bubbles = S('g', { class: 'chem-bubbles', 'clip-path': `url(#${clip.id})` }, layers);
  [-0.5, -0.1, 0.3, 0.6].forEach((at, i) =>
    S(
      'circle',
      {
        cx: cx + at * span * 0.8,
        cy: insideFloor - 3,
        r: 1.6 + 0.4 * (i % 2),
        style: `animation-delay:${i * 0.35}s`,
      },
      bubbles,
    ),
  );
  if (shape.mark !== undefined) {
    const y = insideFloor - shape.mark * 1000;
    const r = (shape.profile[shape.profile.length - 1]?.[0] ?? 0) * 1000 + 2.5;
    S('line', { x1: cx - r, x2: cx + r, y1: y, y2: y, class: 'chem-mark' }, g);
  }
  const put = {
    visible: putAttr(g, 'display'),
    liquidY: putAttr(liquid, 'y'),
    liquidH: putAttr(liquid, 'height'),
    liquidFill: putFill(liquid, 'fill', (r, gr, b) => linearCss([r, gr, b])),
    liquidOpacity: putAttr(liquid, 'fill-opacity'),
    turbY: putAttr(turbid, 'y'),
    turbH: putAttr(turbid, 'height'),
    turbFill: putFill(turbid, 'fill', (r, gr, b) => linearCss([r, gr, b])),
    turbOpacity: putAttr(turbid, 'fill-opacity'),
    iceY: putAttr(ice, 'y'),
    iceH: putAttr(ice, 'height'),
    iceOpacity: putAttr(ice, 'fill-opacity'),
    solidY: putAttr(solid, 'y'),
    solidH: putAttr(solid, 'height'),
    boiling: putAttr(bubbles, 'display'),
    surfaceY: putAttr(surface, 'y'),
    surfaceH: putAttr(surface, 'height'),
  };
  return { insideFloor, put };
}

const TURBID = [0, 0, 0] as [number, number, number];

function vessel(kit: Kit): Part {
  const { texts } = kit;
  const shapes = SHAPES[kit.ctx.piece.kind] ?? [BEAKER];
  const span = Math.max(...shapes.map(widest)) * 1000 + 3;
  const width = 2 * span + 24;
  const tall = Math.max(...shapes.map((s) => insideTop(s) + s.floor)) * 1000;
  const art = kit.drawing(width, tall + 14);
  const cx = width / 2;
  const floorY = tall + 8;
  const glasses = shapes.map((shape) => drawGlass(art, shape, cx, floorY, span));
  const steps = kit.steps();
  const readTint = tintReader();
  const tint = newTint();
  const volumetric = kit.ctx.piece.kind === 'volumetric-flask';
  let wanted = Number.NaN;
  let chosen = 0;
  const last = {
    kind: '',
    form: -1,
    end: Number.NaN,
    product: Number.NaN,
    state: Number.NaN,
  };
  let twinText = '';
  let shown = -1;

  return {
    draw(f) {
      // The volumetric flask drawn is the one the final-volume setting names.
      if (volumetric) {
        const want = p(f, 'finalVolume');
        if (!Object.is(want, wanted)) {
          wanted = want;
          chosen = Number.isFinite(want) ? nearestFlask(want) : 1;
        }
      }
      const which = chosen;
      const shape = shapes[which] ?? BEAKER;
      const glass = glasses[which];
      if (!glass) return;
      if (which !== shown) {
        shown = which;
        glasses.forEach((gl, i) => gl.put.visible(i === which ? 'inline' : 'none'));
      }
      const { put, insideFloor } = glass;
      const top = insideTop(shape);
      readTint(f, tint);
      const into = intoState(f, kit.ctx.piece.id);
      const kind = kit.ctx.piece.kind;

      // What the glass holds: by mass for the ice and water of a heating curve, a volume otherwise.
      let level = 0;
      let iceFrom = 0;
      let iceTall = 0;
      const heating = f.declared.has('iceFraction');
      const crystals = f.declared.has('undissolved');
      if (heating) {
        const run = Number.isFinite(v(f, 'waterMass'));
        const mass = p(f, 'mass');
        const iceKg = run ? v(f, 'iceFraction') * mass : mass;
        level = run ? waterLevel(v(f, 'waterMass')) : 0;
        iceTall = Number.isFinite(iceKg) ? iceHeight(iceKg) : 0;
        iceFrom = level > 0 ? Math.max(0, level - ICE_SUBMERGED * iceTall) : 0;
      } else if (into !== NO_STEPS && into !== DONE) {
        level = 0;
      } else if (crystals) {
        // The 3D solubility beaker's level: the water, the dissolved solid and the crystals' own volume.
        const run = Number.isFinite(v(f, 'undissolved')) && Number.isFinite(v(f, 'dissolved'));
        const water = Number.isFinite(p(f, 'waterMass')) ? p(f, 'waterMass') : WATER_MASS;
        level = solutionLevel(
          water,
          run ? v(f, 'dissolved') : Number.NaN,
          run && !f.completed ? v(f, 'undissolved') : 0,
          p(f, 'solute'),
        );
      } else {
        const ml = kind === 'evaporating-dish' ? v(f, 'waterMass') : contentsMl(f);
        if (ml > 0) level = shape.level(ml);
        else if (tint.kind !== 'none' || into === DONE) level = FIXED_FILL * top;
      }
      level = Math.min(Math.max(level, 0), top);
      const y = insideFloor - level * 1000;
      put.liquidY(y);
      put.liquidH(level * 1000);
      put.liquidFill(tint.rgb[0], tint.rgb[1], tint.rgb[2]);
      put.liquidOpacity(tint.opacity);
      put.surfaceY(y);
      put.surfaceH(level * 1000);

      const turb = level > 0 ? precipitateTint(f, TURBID) : 0;
      put.turbY(y);
      put.turbH(level * 1000);
      put.turbFill(TURBID[0], TURBID[1], TURBID[2]);
      put.turbOpacity(turb);

      iceTall = Math.min(iceTall, top);
      put.iceY(insideFloor - (iceFrom + iceTall) * 1000);
      put.iceH(iceTall * 1000);
      put.iceOpacity(iceTall > 0 ? 0.55 : 0);

      const solidShare = Math.max(bedOf(f), crystalShare(f));
      // A heap or crust: up to a third of the glass at the fullest bed or the full weighed amount.
      const solidH = solidShare * 0.33 * top * 1000;
      put.solidY(insideFloor - solidH);
      put.solidH(solidH);

      put.boiling(f.running && v(f, 'state') >= BOILING && level > 0 ? 'inline' : 'none');
      steps(f);
    },

    twin(f) {
      const { definition } = f.view;
      const saturated = v(f, 'saturation') >= 1;
      const product = saturated ? v(f, 'product') : 0;
      const state = v(f, 'state');
      const end = p(f, 'endpointPH');
      // The words are found again only when what they name changes.
      if (
        tint.kind === last.kind &&
        tint.form === last.form &&
        Object.is(end, last.end) &&
        Object.is(product, last.product) &&
        Object.is(state, last.state)
      ) {
        return twinText;
      }
      Object.assign(last, { kind: tint.kind, form: tint.form, end, product, state });
      const parts: string[] = [];
      if (tint.kind === 'indicator') {
        const preset = definition.parameters
          .find((x) => x.id === 'endpointPH')
          ?.presets.find((s) => Math.abs(s.value - p(f, 'endpointPH')) < 1e-9);
        const form =
          tint.form === 0
            ? texts.ui('chem.form.acid', 'colour of the acid form')
            : tint.form === 2
              ? texts.ui('chem.form.base', 'colour of the base form')
              : texts.ui('chem.form.change', 'colour changing');
        parts.push(
          texts.ui('chem.twin.indicator', '{indicator}: {form}', {
            indicator: preset ? texts.of(preset, 'label') : '',
            form,
          }),
        );
      } else if (tint.kind === 'violet') {
        parts.push(texts.ui('chem.twin.violet', 'Violet solution'));
      }
      if (saturated) parts.push(classLabel(definition, texts, 'product', product));
      if (Number.isFinite(state)) parts.push(classLabel(definition, texts, 'state', state));
      twinText = parts.filter(Boolean).join('; ');
      return twinText;
    },
  };
}

const factory: PieceViewFactory = defineChem('vessel', vessel);
/** The vessel kinds: the generic `vessel` (a beaker) and one kind per glass shape. */
export const VESSELS: Readonly<Record<string, PieceViewFactory>> = {
  vessel: factory,
  'conical-flask': factory,
  beaker: factory,
  'volumetric-flask': factory,
  'boiling-tube': factory,
  'evaporating-dish': factory,
  cuvette: factory,
};
