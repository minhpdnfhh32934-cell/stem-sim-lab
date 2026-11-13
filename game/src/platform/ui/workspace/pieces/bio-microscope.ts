import type { Texts } from '../../../../core/i18n';
import { SPECIMENS } from '../../../../simulation/models/microscope';
import { countTicks, knobTurns, objectiveSlot, runExists } from '../../../labVisuals/biology';
import {
  blurLevel,
  createFieldPainter,
  drawnStructures,
  fieldIsLive,
  INK,
  NOSEPIECE,
  paintCells,
  PATCH_INK,
  PATCH_SHAPE,
  pixelsPerMicron,
  type Structure,
  structureInk,
} from '../../../labVisuals/specimenPicture';
import { el } from '../../dom';
import { type SlideStages, slideStages } from './bio-maps';
import {
  bindAttr,
  bindNumberAttr,
  bindText,
  type ChoiceIcon,
  choices,
  classNamer,
  defineBio,
  drawing,
  type Frame,
  inputRow,
  inputValue,
  liveRow,
  Memo,
  num,
  resultValue,
  S,
  stepButtons,
  valueText,
} from './bio-kit';

/*
 * The microscopy pieces (docs/experiment-workspace-design.md, Biology D1): specimen cards, stain
 * bottles, the slide, the coverslip, the stage, the nosepiece, the fine-focus knob, the lamp
 * indicator and the eyepiece field. Every picture is the 3D bench's own (the shared painter and
 * tables in labVisuals/specimenPicture); the field shows nothing without a run (standby), is
 * never panned or digitally zoomed (the objective is the zoom), and Inspect names only the
 * structures the painter draws at that scale.
 *
 * Variables read: offset, sharpness, magnification, fieldOfView, contrast (the run's) and the
 * parameters specimen, stain, objective, focus (the run's inputs while a run exists, else the dials).
 */

const specimenOf = (f: Frame) => num(f.p, 'specimen');
const stainOf = (f: Frame) => {
  const stain = num(f.p, 'stain');
  return Number.isFinite(stain) ? stain : 0;
};

// ---- specimen cards ---------------------------------------------------------------------------

const THUMB = 56;

/** A slide's cells in a small round, as the painter draws them (2.5 cell lengths across, no blur). */
function thumbnail(specimen: number): ChoiceIcon {
  const canvas = el('canvas', 'bio-thumb');
  canvas.width = canvas.height = THUMB;
  const c = canvas.getContext('2d');
  let shown = NaN;
  return {
    node: canvas,
    draw(f) {
      const dial = num(f.dials, 'stain');
      const stain = Number.isFinite(dial) ? dial : 0;
      if (!c || Object.is(stain, shown)) return;
      shown = stain;
      const r = THUMB / 2 - 1;
      const slide = SPECIMENS[specimen];
      c.clearRect(0, 0, THUMB, THUMB);
      c.save();
      c.translate(THUMB / 2, THUMB / 2);
      c.beginPath();
      c.arc(0, 0, r, 0, 2 * Math.PI);
      c.clip();
      c.fillStyle = INK.background[stain] ?? INK.background[0];
      c.fillRect(-r, -r, 2 * r, 2 * r);
      const px = pixelsPerMicron(r, 2.5 * (slide?.length ?? 100), specimen);
      paintCells(c, r, specimen, stain, px, slide?.contrast[stain] ?? 0);
      c.restore();
    },
  };
}

export const specimen = defineBio('specimen', (kit) => {
  const choose = choices(kit, kit.host, kit.owned(), (preset) => thumbnail(preset.value));
  // The step putting a specimen of this library on the slide is done here, beside its cards.
  const steps = stepButtons(
    kit,
    kit.host,
    ({ step }, f) =>
      f.view.definition.workspace?.materials.find((m) => m.id === step.place)?.sets?.parameter ===
      kit.owned(),
  );
  return {
    draw(f) {
      choose(f);
      steps(f);
    },
  };
});

// ---- stain bottles ----------------------------------------------------------------------------

/** A dropper bottle whose liquid is the stain's nucleus ink; the unstained slide has an empty one. */
export function bottle(ink: string | null): ChoiceIcon {
  const root = S('svg', { viewBox: '0 0 40 56', 'aria-hidden': 'true', class: 'bio-bottle' });
  S('rect', { x: 15, y: 2, width: 10, height: 10, rx: 2, class: 'bio-glass' }, root);
  S('rect', { x: 7, y: 12, width: 26, height: 40, rx: 6, class: 'bio-glass' }, root);
  if (ink) S('rect', { x: 9, y: 26, width: 22, height: 24, rx: 4, fill: ink, opacity: 0.85 }, root);
  return { node: root };
}

export const stainBottle = defineBio('stain-bottle', (kit) => {
  const choose = choices(kit, kit.host, kit.owned(), (preset) =>
    bottle(preset.value > 0 ? (INK.nucleus[preset.value] ?? null) : null),
  );
  // A step that puts these bottles' stain on the slide is done here, once the stain is chosen.
  const steps = stepButtons(kit, kit.host, ({ step }) => step.place === kit.ctx.piece.id);
  return {
    draw(f) {
      choose(f);
      steps(f);
    },
  };
});

// ---- the slide, the coverslip and the stage ---------------------------------------------------

/** A 75 × 25 mm slide (drawn 150 × 50) with the specimen's patch and the coverslip over it. */
function slideGlyph(parent: Element, x: number, y: number) {
  const g = S('g', { transform: `translate(${x} ${y})` }, parent);
  const glass = S('rect', { width: 150, height: 50, rx: 3, class: 'bio-glass' }, g);
  const patch = S('ellipse', { cx: 75, cy: 25, rx: 10, ry: 10, opacity: 0 }, g);
  const cover = S(
    'rect',
    { x: 57, y: 7, width: 36, height: 36, class: 'bio-glass bio-cover', opacity: 0 },
    g,
  );
  const setGlass = bindAttr(glass, 'stroke-dasharray');
  const setFill = bindAttr(patch, 'fill');
  const setOpacity = bindAttr(patch, 'opacity');
  const setRx = bindAttr(patch, 'rx');
  const setRy = bindAttr(patch, 'ry');
  const setCover = bindAttr(cover, 'opacity');
  return {
    node: g,
    draw(f: Frame, stages: SlideStages) {
      const i = specimenOf(f);
      const shape = PATCH_SHAPE[i];
      setGlass(stages.tile ? 'none' : '4 3');
      const tint = PATCH_INK[i]?.[stages.stained ? stainOf(f) : 0];
      const visible = stages.specimen && tint !== undefined && shape !== undefined;
      setOpacity(visible ? 1 : 0);
      if (visible) {
        setFill(tint);
        setRx(10.8 * shape[0]);
        setRy(10.8 * shape[1]);
      }
      setCover(stages.covered && stages.tile ? 0.55 : 0);
    },
  };
}

const newStages = (): SlideStages => ({
  tile: true,
  specimen: true,
  stained: true,
  covered: true,
  onStage: true,
});

export const slide = defineBio('slide', (kit) => {
  const root = drawing(kit.host, 150, 50, kit.label);
  const glyph = slideGlyph(root, 0, 0);
  const stages = newStages();
  // A step putting the slide on the stage is the stage's button, not a second one here.
  const steps = stepButtons(
    kit,
    kit.host,
    ({ step }, f) =>
      step.place === kit.ctx.piece.id &&
      f.view.definition.workspace?.pieces.find((p) => p.id === step.onto)?.kind !==
        'microscope-stage',
  );
  return {
    draw(f) {
      glyph.draw(f, slideStages(f.view.setup, f.view.definition.workspace, stages));
      steps(f);
    },
  };
});

export const coverslip = defineBio('coverslip', (kit) => {
  const root = drawing(kit.host, 60, 60, kit.label);
  const glass = S('rect', { x: 12, y: 12, width: 36, height: 36, class: 'bio-glass' }, root);
  const turn = bindAttr(glass, 'transform');
  const steps = stepButtons(kit, kit.host, ({ step }) => step.place === kit.ctx.piece.id);
  return {
    draw(f) {
      // Held at an angle until the step lowering it is done, then flat on the slide.
      let flat = true;
      for (const { step, done } of f.view.setup) {
        if (step.place === kit.ctx.piece.id && !done) flat = false;
      }
      turn(flat ? 'rotate(0 30 30)' : 'rotate(-30 30 30)');
      steps(f);
    },
  };
});

export const microscopeStage = defineBio('microscope-stage', (kit) => {
  const root = drawing(kit.host, 200, 90, kit.label);
  S('rect', { x: 5, y: 8, width: 190, height: 74, rx: 8, class: 'bio-metal' }, root);
  S('circle', { cx: 100, cy: 45, r: 14, class: 'bio-hole' }, root);
  const glyph = slideGlyph(root, 25, 20);
  S('rect', { x: 20, y: 14, width: 16, height: 4, class: 'bio-clip' }, root);
  S('rect', { x: 164, y: 14, width: 16, height: 4, class: 'bio-clip' }, root);
  const stages = newStages();
  const onto = kit.ctx.piece.id;
  const steps = stepButtons(kit, kit.host, ({ step }) => step.onto === onto);
  const setShown = bindAttr(glyph.node, 'opacity');
  return {
    draw(f) {
      slideStages(f.view.setup, f.view.definition.workspace, stages);
      // The slide shows as lying on the stage once the step putting it there is done (or none asks for it).
      setShown(stages.onStage ? 1 : 0.25);
      stages.tile = true;
      glyph.draw(f, stages);
      steps(f);
    },
  };
});

// ---- the nosepiece ----------------------------------------------------------------------------

export const nosepiece = defineBio('nosepiece', (kit) => {
  const root = drawing(kit.host, 140, 140, kit.label);
  const turret = S('g', {}, root);
  S('circle', { cx: 70, cy: 70, r: 56, class: 'bio-metal' }, turret);
  NOSEPIECE.forEach((lens, i) => {
    const a = (i * 2 * Math.PI) / NOSEPIECE.length - Math.PI / 2;
    const x = 70 + 36 * Math.cos(a);
    const y = 70 + 36 * Math.sin(a);
    const r = 10 + (lens.magnification >= 40 ? 3 : 0);
    S('circle', { cx: x, cy: y, r, class: 'bio-lens' }, turret);
    S('circle', { cx: x, cy: y, r: 6, fill: lens.band }, turret);
  });
  // The one in use stands at the top, under the marker.
  S('path', { d: 'M70 4 l-6 10 h12 z', class: 'bio-marker' }, root);
  const turn = bindNumberAttr(turret, 'transform', (a) => `rotate(${a} 70 70)`);
  const magnification = liveRow(kit, kit.host, 'magnification');
  const eyepiece = inputRow(kit.host, 'eyepiece');
  const choose = choices(kit, kit.host, kit.owned());
  return {
    draw(f) {
      const slot = objectiveSlot(num(f.p, kit.owned()));
      turn(slot < 0 ? 0 : (-slot * 360) / NOSEPIECE.length);
      magnification(f);
      eyepiece(f);
      choose(f);
    },
  };
});

// ---- the fine focus ---------------------------------------------------------------------------

export const focusKnob = defineBio('focus-knob', (kit) => {
  const root = drawing(kit.host, 100, 100, kit.label);
  const knob = S('g', {}, root);
  S('circle', { cx: 50, cy: 50, r: 40, class: 'bio-knob' }, knob);
  S('rect', { x: 46, y: 14, width: 8, height: 18, rx: 2, class: 'bio-index' }, knob);
  const turn = bindNumberAttr(knob, 'transform', (a) => `rotate(${a} 50 50)`);
  const offset = liveRow(kit, kit.host, 'offset');
  const start = inputRow(kit.host, 'focusStart');
  const choose = choices(kit, kit.host, kit.owned());
  return {
    draw(f) {
      const turns = knobTurns(f.run, inputValue(f, 'focusStart'), num(f.s, 'offset'));
      turn(Math.round((turns % 1) * 3600) / 10);
      offset(f);
      start(f);
      choose(f);
    },
  };
});

// ---- the lamp (an indicator, never a control) -------------------------------------------------

export const lampIndicator = defineBio('lamp-indicator', (kit) => {
  const root = drawing(kit.host, 60, 60, kit.label);
  const lens = S('circle', { cx: 30, cy: 30, r: 20, class: 'bio-lamp' }, root);
  const status = el('p', 'bio-status');
  kit.host.append(status);
  let shown: boolean | null = null;
  return {
    draw(f) {
      const on = runExists(f.status);
      if (on === shown) return;
      shown = on;
      lens.setAttribute('fill', on ? '#fff3d8' : '#d9d3c6');
      status.textContent = on
        ? kit.texts.ui('bio.lampOn', 'Lamp on')
        : kit.texts.ui('bio.lampOff', 'Lamp off');
    },
  };
});

// ---- the eyepiece field -----------------------------------------------------------------------

const FIELD = 640;

/** The name of a structure the painter draws; its ink is `structureInk`. */
export function structureName(texts: Texts, structure: Structure): string {
  switch (structure) {
    case 'wall':
      return texts.ui('bio.structure.wall', 'Cell wall');
    case 'membrane':
      return texts.ui('bio.structure.membrane', 'Cell membrane');
    case 'cytoplasm':
      return texts.ui('bio.structure.cytoplasm', 'Cytoplasm');
    case 'nucleus':
      return texts.ui('bio.structure.nucleus', 'Nucleus');
    case 'chloroplast':
      return texts.ui('bio.structure.chloroplast', 'Chloroplast');
  }
}

export const eyepieceField = defineBio('eyepiece-field', (kit) => {
  const { texts } = kit;
  const frame = el('div', 'bio-field');
  const canvas = el('canvas', 'bio-field-canvas');
  canvas.width = canvas.height = FIELD;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', kit.label);
  const buffer = el('canvas');
  buffer.width = buffer.height = FIELD;
  const screen = canvas.getContext('2d');
  const sharp = buffer.getContext('2d');
  const paint =
    screen && sharp
      ? createFieldPainter({
          screen,
          buffer: sharp,
          bufferImage: buffer,
          width: FIELD,
          height: FIELD,
        })
      : null;
  frame.append(canvas);
  // The measure overlay: the field's diameter and, after a completed run, the n cells counted.
  const overlay = S(
    'svg',
    { viewBox: `0 0 ${FIELD} ${FIELD}`, 'aria-hidden': 'true', class: 'bio-overlay' },
    frame,
  );
  const r = FIELD * 0.47;
  const mid = FIELD / 2;
  const line = S(
    'path',
    {
      d: `M${mid - r} ${mid}H${mid + r}M${mid - r} ${mid - 10}v20M${mid + r} ${mid - 10}v20`,
      class: 'bio-measure-line',
      opacity: 0,
    },
    overlay,
  );
  const ticks = S('path', { d: '', class: 'bio-measure-ticks' }, overlay);
  const standby = el('p', 'bio-standby');
  frame.append(standby);
  const bar = el('div', 'bio-toolbar');
  const measure = el('button', 'bio-toggle', texts.ui('bio.measure', 'Measure'));
  const inspect = el('button', 'bio-toggle', texts.ui('bio.inspect', 'Inspect'));
  for (const b of [measure, inspect]) {
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
  }
  bar.append(measure, inspect);
  const classes = el('p', 'bio-class');
  const count = el('p', 'bio-count');
  count.setAttribute('aria-live', 'polite');
  const legend = el('ul', 'bio-legend');
  kit.host.append(frame, bar, classes, count, legend);
  const fieldNumber = inputRow(kit.host, 'fieldNumber');

  let measuring = false;
  let inspecting = false;
  let dirty = true;
  kit.listen(measure, 'click', () => {
    measuring = !measuring;
    measure.setAttribute('aria-pressed', String(measuring));
    dirty = true;
  });
  kit.listen(inspect, 'click', () => {
    inspecting = !inspecting;
    inspect.setAttribute('aria-pressed', String(inspecting));
    dirty = true;
  });

  const showLine = bindAttr(line, 'opacity');
  const setStandby = bindText(standby);
  const setClasses = bindText(classes);
  const nameSharpness = classNamer(texts, 'sharpness');
  const nameContrast = classNamer(texts, 'contrast');
  const memo = new Memo(9);
  const marks: number[] = [];
  const lampOff = texts.ui('bio.lampOff', 'Lamp off');
  let lastSharp = '';
  let lastContrast = '';
  let lastLive: boolean | null = null;

  return {
    draw(f) {
      fieldNumber(f);
      const fov = num(f.s, 'fieldOfView');
      const sharpness = num(f.s, 'sharpness');
      const contrast = num(f.s, 'contrast');
      const live = fieldIsLive(f.run, fov, sharpness);
      const specimenIndex = specimenOf(f);
      const stain = stainOf(f);
      paint?.(
        live,
        specimenIndex,
        stain,
        fov,
        num(f.s, 'magnification'),
        contrast,
        live ? blurLevel(sharpness) : 0,
      );

      // The text twin of the blur and the contrast: the definition's own class names.
      const sharpText = live ? nameSharpness(f, sharpness) : '';
      const contrastText = live ? nameContrast(f, contrast) : '';
      if (sharpText !== lastSharp || contrastText !== lastContrast || live !== lastLive) {
        lastSharp = sharpText;
        lastContrast = contrastText;
        if (live !== lastLive) setStandby(live ? '' : lampOff);
        lastLive = live;
        setClasses([sharpText, contrastText].filter(Boolean).join(' · '));
      }
      showLine(measuring && live ? 1 : 0);

      const n = resultValue(f, 'cellsCounted');
      const length = resultValue(f, 'measuredLength');
      const changed =
        memo.put(0, fov) |
        memo.put(1, n) |
        memo.put(2, length) |
        memo.put(3, live ? 1 : 0) |
        memo.put(4, f.completed ? 1 : 0) |
        memo.put(5, specimenIndex) |
        memo.put(6, stain) |
        memo.put(7, measuring ? 1 : 0) |
        memo.put(8, inspecting ? 1 : 0);
      if (!changed && !dirty) return;
      dirty = false;

      // Measure: the diameter is the field of view; the ticks and the count only once completed.
      countTicks(n, f.completed && live, marks);
      ticks.setAttribute(
        'd',
        measuring ? marks.map((x) => `M${(mid + x * r).toFixed(1)} ${mid - 14}v28`).join('') : '',
      );
      let text = '';
      if (measuring && live) {
        text = texts.ui('bio.fieldDiameter', 'Field of view {length}', {
          length: valueText(fov, 'µm'),
        });
        if (f.completed) {
          text += ` · ${texts.ui('bio.cellsCounted', '{n} cells counted', { n: valueText(n, '') })}`;
          if (n > 0) {
            text += ` · ${texts.ui('bio.cellLength', 'Length from the count {length}', {
              length: valueText(length, 'µm'),
            })}`;
          }
        }
      }
      count.textContent = text;

      // Inspect: names only what the painter draws at this scale, each with its ink.
      const shown =
        inspecting && live
          ? drawnStructures(specimenIndex, pixelsPerMicron(r, fov, specimenIndex))
          : [];
      legend.replaceChildren();
      for (const structure of shown) {
        const item = el('li', 'bio-legend-item');
        const swatch = el('span', 'bio-swatch');
        swatch.style.backgroundColor = structureInk(structure, stain);
        item.append(swatch, structureName(texts, structure));
        legend.append(item);
      }
    },
  };
});
