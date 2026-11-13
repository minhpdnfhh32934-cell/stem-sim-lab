import type { Texts } from '../../../../core/i18n';
import type { SessionState } from '../../../../simulation/ExperimentSession';
import {
  type ExperimentDefinition,
  type ExperimentParameter,
  resultClass,
} from '../../../../simulation/experiment';
import { formatUncertainty, type Reading, readings } from '../../../../simulation/measurement';
import type { SetupProgress, StationView } from '../../../../gameplay/experiment/StationSystem';
import { runExists } from '../../../labVisuals/biology';
import { el, formatQuantity, svg } from '../../dom';
import type { PieceContext, PieceView, PieceViewFactory } from '../types';

/*
 * The shared parts of the Biology piece views (presentation only). A piece is built once by
 * `defineBio`; every `draw` reads a `Frame` (the station view's pose, the dials, the run's results)
 * and assigns what changed, nothing else: values are never smoothed, adjusted or invented, a
 * model value that is NaN (no run) is the idle look, and a control only ever sends a command
 * through `ctx.send`, disabled with `ctx.refusal`'s reason while that is not null.
 */

const EMPTY: Readonly<Record<string, number>> = Object.freeze({});
const STATES: readonly SessionState[] = ['idle', 'configured', 'running', 'stopped', 'completed'];

/** What a piece draws from, refilled in place at every update (no allocation per frame). */
export interface Frame {
  view: StationView;
  status: SessionState;
  /** A run exists: in progress, stopped or completed. */
  run: boolean;
  running: boolean;
  completed: boolean;
  /** The settings drawn: the run's own inputs while a run exists, else the dials. */
  p: Readonly<Record<string, number>>;
  /** Every model variable now (NaN without a run). */
  s: Readonly<Record<string, number>>;
  /** The dials: the settings a control shows and sets. */
  dials: Readonly<Record<string, number>>;
  /** Changes when the state or the setup (steps that apply, steps done) changes: what a control's refusal depends on. */
  sig: number;
}

export function makeFrame(view: StationView): Frame {
  const f = { view } as Frame;
  fillFrame(f, view);
  return f;
}

export function fillFrame(f: Frame, view: StationView): void {
  f.view = view;
  f.dials = view.session.parameters;
  if (view.kind === 'bench') {
    const { pose } = view;
    f.status = pose.status;
    f.p = pose.parameters;
    f.s = pose.sample;
  } else {
    f.status = view.session.state;
    f.p = f.dials;
    f.s = EMPTY;
  }
  f.run = runExists(f.status);
  f.running = f.status === 'running';
  f.completed = f.status === 'completed';
  let done = 0;
  for (const progress of view.setup) if (progress.done) done++;
  f.sig = STATES.indexOf(f.status) * 100_000 + view.setup.length * 1000 + done;
}

/** A value of a model variable, parameter or fixed input; NaN where there is none. */
export const num = (record: Readonly<Record<string, number>>, id: string): number =>
  record[id] ?? Number.NaN;

/** A fixed input's value now: the run's own, else the definition's. */
export function inputValue(f: Frame, id: string): number {
  return f.view.session.run?.inputs[id] ?? f.view.definition.initialConditions[id] ?? Number.NaN;
}

const ANSWERS = new WeakMap<ExperimentDefinition, Map<string, boolean>>();

/** Whether a result is an answer the student works out (looked up once per definition, not per frame). */
function isAnswer(definition: ExperimentDefinition, id: string): boolean {
  let known = ANSWERS.get(definition);
  if (!known) ANSWERS.set(definition, (known = new Map<string, boolean>()));
  let answer = known.get(id);
  if (answer === undefined)
    known.set(id, (answer = !!definition.results.find((r) => r.id === id)?.answer));
  return answer;
}

/** A completed run's result (NaN before; an answer the student works out is never read). */
export function resultValue(f: Frame, id: string): number {
  const definition = f.view.definition;
  if (isAnswer(definition, id)) return Number.NaN;
  return f.view.session.run?.results?.[id] ?? Number.NaN;
}

/** The text of a variable's value in its unit (a dash for none). */
export function valueText(value: number, unit: string): string {
  return Number.isFinite(value) ? formatQuantity(value, unit) : '—';
}

// ---- write only on change ---------------------------------------------------------------------

export function bindAttr(node: Element, name: string): (value: string | number) => void {
  let last: string | number | undefined;
  return (value) => {
    if (Object.is(value, last)) return;
    last = value;
    node.setAttribute(name, String(value));
  };
}

export function bindText(node: Node): (value: string) => void {
  let last: string | undefined;
  return (value) => {
    if (value === last) return;
    last = value;
    node.textContent = value;
  };
}

/** Text from a number, formatted only when the number changes. */
export function bindNumber(node: Node, format: (value: number) => string): (value: number) => void {
  let last: number | undefined;
  return (value) => {
    if (Object.is(value, last)) return;
    last = value;
    node.textContent = format(value);
  };
}

/** An attribute from a number, formatted (and written) only when the number changes. */
export function bindNumberAttr(
  node: Element,
  name: string,
  format: (value: number) => string,
): (value: number) => void {
  let last: number | undefined;
  return (value) => {
    if (Object.is(value, last)) return;
    last = value;
    node.setAttribute(name, format(value));
  };
}

/** Remembers numbers between draws: `put` says (1 or 0, so several combine with |) whether one changed. */
export class Memo {
  private readonly values: number[];

  constructor(size: number) {
    this.values = new Array<number>(size).fill(Number.NaN);
  }

  put(i: number, value: number): 0 | 1 {
    if (Object.is(this.values[i], value)) return 0;
    this.values[i] = value;
    return 1;
  }
}

/** A DOM property that is written only when it changes. */
export function bindChecked(input: { checked: boolean }): (value: boolean) => void {
  let last: boolean | undefined;
  return (value) => {
    if (value === last) return;
    last = value;
    input.checked = value;
  };
}

// ---- SVG --------------------------------------------------------------------------------------

type Attrs = Record<string, string | number>;

/** An SVG node with its attributes, appended to `parent`. */
export function S<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = svg(tag, attrs);
  parent?.append(node);
  return node;
}

/** An SVG drawing of the given viewBox, sized by CSS, described for assistive technology. */
export function drawing(
  parent: Element,
  width: number,
  height: number,
  label: string,
): SVGSVGElement {
  const root = S('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label });
  root.classList.add('bio-drawing');
  parent.append(root);
  return root;
}

// ---- the piece --------------------------------------------------------------------------------

export interface Part {
  draw(f: Frame): void;
  dispose?(): void;
}

export interface Kit {
  /** The piece's own element, inside the host's slot. */
  readonly host: HTMLElement;
  readonly ctx: PieceContext;
  readonly texts: Texts;
  /** The localized label of the piece. */
  readonly label: string;
  /** The nth parameter the piece owns (its data), or '' where it owns fewer. */
  owned(n?: number): string;
  /** A listener released at dispose. */
  listen(target: EventTarget, type: string, handler: (event: Event) => void): void;
}

/**
 * Makes the factory of a Biology piece: `build` draws the piece into `kit.host` and returns what
 * redraws it from a `Frame`.
 */
export function defineBio(kind: string, build: (kit: Kit) => Part): PieceViewFactory {
  return (): PieceView => {
    let host: HTMLElement | null = null;
    let part: Part | null = null;
    let frame: Frame | null = null;
    const releases: (() => void)[] = [];
    return {
      mount(root, ctx) {
        const h = el('div', 'bio-piece');
        h.dataset.kind = kind;
        h.setAttribute('role', 'group');
        const label = ctx.texts.of(ctx.piece, 'label');
        h.setAttribute('aria-label', label);
        h.append(el('h3', 'bio-title', label));
        root.append(h);
        host = h;
        part = build({
          host: h,
          ctx,
          texts: ctx.texts,
          label,
          owned: (n = 0) => ctx.piece.owns[n] ?? '',
          listen: (target, type, handler) => {
            // The host updates pieces only while a run goes: a piece's own toggle redraws it here.
            const handle = (event: Event) => {
              handler(event);
              if (part && frame) part.draw(frame);
            };
            target.addEventListener(type, handle);
            releases.push(() => target.removeEventListener(type, handle));
          },
        });
      },
      update(view) {
        if (!part) return;
        if (frame) fillFrame(frame, view);
        else frame = makeFrame(view);
        part.draw(frame);
      },
      dispose() {
        part?.dispose?.();
        for (const release of releases) release();
        releases.length = 0;
        host?.remove();
        part = host = frame = null;
      },
    };
  };
}

// ---- values from the definition ---------------------------------------------------------------

type Measurement =
  ExperimentDefinition['measurements'][number] | ExperimentDefinition['results'][number];
const MEASUREMENTS = new WeakMap<ExperimentDefinition, Map<string, Measurement | undefined>>();
const PARAMETERS = new WeakMap<
  ExperimentDefinition,
  Map<string, ExperimentParameter | undefined>
>();

/** The measurement (else the result) of a model variable: its label, symbol and unit. */
export function measurementOf(definition: ExperimentDefinition, variable: string) {
  let known = MEASUREMENTS.get(definition);
  if (!known) MEASUREMENTS.set(definition, (known = new Map<string, Measurement | undefined>()));
  if (!known.has(variable)) {
    known.set(
      variable,
      definition.measurements.find((m) => m.variable === variable) ??
        definition.results.find((r) => r.variable === variable && !r.answer),
    );
  }
  return known.get(variable);
}

/** A parameter of the definition by id (looked up once per definition, not per frame). */
export function parameterOf(definition: ExperimentDefinition, id: string) {
  let known = PARAMETERS.get(definition);
  if (!known)
    PARAMETERS.set(definition, (known = new Map<string, ExperimentParameter | undefined>()));
  if (!known.has(id))
    known.set(
      id,
      definition.parameters.find((p) => p.id === id),
    );
  return known.get(id);
}

type ResultClass = NonNullable<ExperimentDefinition['results'][number]['classes']>[number];

/**
 * The name of the class a variable's value falls in (by the classes of the result that reads it),
 * the text found again only when the class changes: '' for no value or no classes.
 */
export function classNamer(texts: Texts, variable: string): (f: Frame, value: number) => string {
  let result: ExperimentDefinition['results'][number] | undefined | null = null;
  let hit: object | null = null;
  let text = '';
  return (f, value) => {
    if (result === null) {
      result = f.view.definition.results.find((r) => r.variable === variable && r.classes);
    }
    const classes = result?.classes;
    let found: ResultClass | null = null;
    if (classes && Number.isFinite(value)) {
      for (let i = 0; i < classes.length && !found; i++) {
        const c = classes[i];
        if (c && value <= (c.max ?? Infinity)) found = c;
      }
    }
    if (found !== hit) {
      hit = found;
      text = found ? texts.of(found, 'label') : '';
    }
    return text;
  };
}

/** One variable as a labelled row: "S = 0.45 mol/L". Built on the first draw (it needs the definition). */
export function liveRow(kit: Kit, parent: HTMLElement, variable: string): (f: Frame) => void {
  let write: ((value: number) => void) | null = null;
  return (f) => {
    if (!write) {
      const { definition } = f.view;
      // Never an answer the student works out.
      if (definition.results.some((r) => r.answer && r.variable === variable))
        write = () => undefined;
    }
    if (!write) {
      const m = measurementOf(f.view.definition, variable);
      const row = el('p', 'bio-row');
      const name = el('span', 'bio-name', m ? kit.texts.of(m, 'label') : variable);
      const output = el('output', 'bio-value');
      row.append(name, ' ', el('span', 'bio-symbol', m?.symbol ?? ''), ' ', output);
      parent.append(row);
      const unit = m?.unit ?? '';
      write = bindNumber(output, (v) => valueText(v, unit));
    }
    write(num(f.s, variable));
  };
}

/** One fixed input as a labelled row: "M_eye 10 ×"; none for a hidden input. */
export function inputRow(parent: HTMLElement, id: string): (f: Frame) => void {
  let write: ((value: number) => void) | null = null;
  return (f) => {
    if (!write) {
      const shown = f.view.definition.inputs[id];
      if (!shown || shown.hidden) write = () => undefined;
      else {
        const output = el('output', 'bio-value');
        const row = el('p', 'bio-row');
        row.append(el('span', 'bio-symbol', shown.symbol), ' ', output);
        parent.append(row);
        write = bindNumber(output, (v) => valueText(v, shown.unit));
      }
    }
    write(inputValue(f, id));
  };
}

type BindingKey = 'variable' | 'parameter' | 'input' | 'result' | 'instrument';

/** The names the definition binds to the piece (`shows`) under a key, in order. */
export function bindings(kit: Kit, key: BindingKey): string[] {
  const names: string[] = [];
  for (const binding of kit.ctx.piece.shows) {
    const name = (binding as Readonly<Record<string, string | undefined>>)[key];
    if (name !== undefined) names.push(name);
  }
  return names;
}

/** The first name bound under a key, else `fallback` (what the kind reads when the data binds nothing). */
export const bound = (kit: Kit, key: BindingKey, fallback: string): string =>
  bindings(kit, key)[0] ?? fallback;

/** A parameter as a labelled row of the settings drawn: "Temperature 30 °C" (the run's input while a run exists). */
export function parameterRow(kit: Kit, parent: HTMLElement, id: string): (f: Frame) => void {
  let write: ((value: number) => void) | null = null;
  return (f) => {
    if (!write) {
      const param = parameterOf(f.view.definition, id);
      if (!param) write = () => undefined;
      else {
        const output = el('output', 'bio-value');
        const row = el('p', 'bio-row');
        row.append(el('span', 'bio-name', kit.texts.of(param, 'label')), ' ', output);
        parent.append(row);
        write = bindNumber(output, (v) => valueText(v, param.unit));
      }
    }
    write(num(f.p, id));
  };
}

/** A completed run's result as a labelled row, with the class name the definition gives it. */
export function resultRow(kit: Kit, parent: HTMLElement, id: string): (f: Frame) => void {
  let write: ((value: number) => void) | null = null;
  return (f) => {
    if (!write) {
      const result = f.view.definition.results.find((r) => r.id === id && !r.answer);
      if (!result) write = () => undefined;
      else {
        const output = el('output', 'bio-value');
        const row = el('p', 'bio-row');
        row.append(
          el('span', 'bio-name', kit.texts.of(result, 'label')),
          ' ',
          el('span', 'bio-symbol', result.symbol ?? ''),
          ' ',
          output,
        );
        parent.append(row);
        write = bindNumber(output, (v) => {
          const named = resultClass(result, Number.isFinite(v) ? v : null, kit.texts);
          return valueText(v, result.unit) + (named ? ` · ${named}` : '');
        });
      }
    }
    write(resultValue(f, id));
  };
}

// ---- an instrument's reading, after the run completed ----------------------------------------

/**
 * The reading of the instrument on a result, once the run completed: the value to d on a display,
 * and u = d/√12 ("from the resolution alone") with d/2 beside it (`measurement.ts`'s numbers, the
 * simulated value never rounded or replaced). A dash before. Returns the reading shown, or null.
 */
export function instrumentReadout(
  kit: Kit,
  parent: HTMLElement,
  resultId: () => string,
): (f: Frame) => Reading | null {
  const read = readingReader();
  const lcd = el('output', 'bio-lcd');
  const note = el('p', 'bio-note');
  parent.append(lcd, note);
  const setLcd = bindText(lcd);
  const setNote = bindText(note);
  let shown: Reading | null | undefined;
  return (f) => {
    const reading = read(f, resultId());
    if (reading !== shown) {
      shown = reading;
      setLcd(reading ? `${reading.text} ${reading.unit}`.trim() : '—');
      setNote(
        reading
          ? kit.texts.ui(
              'bio.uncertainty',
              'u = {u} {unit} from the resolution alone · d/2 = {bound} {unit}',
              {
                u: formatUncertainty(reading.uncertainty),
                bound: Number(reading.bound.toPrecision(2)),
                unit: reading.unit,
              },
            )
          : '',
      );
    }
    return reading;
  };
}

/** The instrument reading of a result, cached for the run it was read from. */
export function readingReader(): (f: Frame, resultId: string) => Reading | null {
  let run: unknown = null;
  let status: SessionState | null = null;
  let cached: readonly Reading[] = [];
  return (f, resultId) => {
    const current = f.view.session.run;
    if (current !== run || f.status !== status) {
      run = current;
      status = f.status;
      cached = current && f.completed ? readings(f.view.definition, current) : [];
    }
    return isAnswer(f.view.definition, resultId)
      ? null
      : (cached.find((r) => r.result === resultId) ?? null);
  };
}

// ---- preset choices ---------------------------------------------------------------------------

type Preset = ExperimentParameter['presets'][number];

export interface ChoiceIcon {
  readonly node: Element;
  /** Redraws the icon when the frame changes something it shows. */
  draw?(f: Frame): void;
}

/**
 * The presets of an owned parameter as native radio inputs (arrow keys step them, as a dial
 * does), each optionally with an icon: a library of cards in one piece, nothing offered that the
 * definition does not list. Choosing sends `set`; a choice the station refuses is not sent, is
 * disabled with its reason (aria-disabled, so it still takes focus and shows why) and the radio
 * returns to the dial's value.
 */
export function choices(
  kit: Kit,
  parent: HTMLElement,
  parameter: string,
  icon?: (preset: Preset, f: Frame) => ChoiceIcon,
): (f: Frame) => void {
  const { ctx, texts } = kit;
  const group = el('div', 'bio-choices');
  group.setAttribute('role', 'radiogroup');
  const reason = el('p', 'bio-refusal');
  reason.setAttribute('role', 'status');
  reason.setAttribute('aria-live', 'polite');
  parent.append(group, reason);
  const name = `bio-${ctx.stationId}-${ctx.piece.id}-${parameter}`;
  const options: {
    value: number;
    input: HTMLInputElement;
    label: HTMLElement;
    icon: ChoiceIcon | null;
    check: (value: boolean) => void;
    why: string | null;
  }[] = [];
  const showReason = bindText(reason);
  let built = false;
  let sig = NaN;

  let shownValue = NaN;
  const restore = () => {
    for (const o of options) o.input.checked = Math.abs(o.value - shownValue) < 1e-9;
  };

  return (f) => {
    if (!built) {
      const param = parameterOf(f.view.definition, parameter);
      if (!param) return;
      built = true;
      group.setAttribute('aria-label', texts.of(param, 'label'));
      param.presets.forEach((preset) => {
        const label = el('label', icon ? 'bio-card' : 'bio-chip');
        const input = el('input');
        input.type = 'radio';
        input.name = name;
        input.value = String(preset.value);
        const made = icon ? icon(preset, f) : null;
        if (made) label.append(made.node);
        label.append(input, el('span', 'bio-choice-label', texts.of(preset, 'label')));
        group.append(label);
        const option = {
          value: preset.value,
          input,
          label,
          icon: made,
          check: bindChecked(input),
          why: null as string | null,
        };
        options.push(option);
        kit.listen(input, 'change', () => {
          if (!option.why) ctx.send({ command: 'set', parameter, value: option.value });
          restore();
        });
      });
    }
    shownValue = num(f.dials, parameter);
    for (const o of options) {
      o.check(Math.abs(o.value - shownValue) < 1e-9);
      o.icon?.draw?.(f);
    }
    if (f.sig !== sig) {
      sig = f.sig;
      let first: string | null = null;
      for (const o of options) {
        o.why = ctx.refusal('set', parameter, o.value);
        first ??= o.why;
        o.input.setAttribute('aria-disabled', o.why ? 'true' : 'false');
        o.label.title = o.why ?? '';
      }
      showReason(first ?? '');
    }
  };
}

// ---- setup steps this piece owns --------------------------------------------------------------

/**
 * One button per setup step that `select` picks (the steps that apply now, `view.setup`): done
 * shows pressed; one the station refuses is not sent and says why. The station is the only rule
 * authority: the button only sends `setup`.
 */
export function stepButtons(
  kit: Kit,
  parent: HTMLElement,
  select: (progress: SetupProgress, f: Frame) => boolean,
): (f: Frame) => void {
  const { ctx, texts } = kit;
  const list = el('div', 'bio-steps');
  const reason = el('p', 'bio-refusal');
  parent.append(list, reason);
  const showReason = bindText(reason);
  let sig = NaN;
  let current: readonly object[] = [];
  return (f) => {
    // The steps that apply can change with a dial (`when`) while their number and the done count stay:
    // compared by step, with no allocation while they are the same.
    let n = 0;
    let same = true;
    for (const progress of f.view.setup) {
      if (!select(progress, f)) continue;
      if (current[n++] !== progress.step) same = false;
    }
    if (same && n === current.length && f.sig === sig) return;
    sig = f.sig;
    const mine = f.view.setup.filter((progress) => select(progress, f));
    if (!same || n !== current.length) {
      current = mine.map(({ step }) => step);
      list.replaceChildren();
      for (const { step } of mine) {
        const button = el('button', 'bio-step', texts.of(step, 'instruction'));
        button.type = 'button';
        button.dataset.step = step.id;
        // Not released one by one: a removed button goes with its listener.
        button.addEventListener('click', () => {
          if (button.getAttribute('aria-disabled') !== 'true') {
            ctx.send({ command: 'setup', step: step.id });
          }
        });
        list.append(button);
      }
    }
    let first = '';
    mine.forEach(({ step, done }, i) => {
      const button = list.children[i] as HTMLButtonElement;
      const why = done ? null : ctx.refusal('setup', step.id);
      if (why && !first) first = why;
      button.setAttribute('aria-pressed', done ? 'true' : 'false');
      button.setAttribute('aria-disabled', done || why ? 'true' : 'false');
      button.title = why ?? '';
    });
    showReason(first);
  };
}
