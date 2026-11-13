import type { Texts } from '../../../../core/i18n';
import type {
  BenchPose,
  SetupProgress,
  StationView,
} from '../../../../gameplay/experiment/StationSystem';
import type { ExperimentDefinition } from '../../../../simulation/experiment';
import { el, svg } from '../../dom';
import type { PieceContext, PieceView, PieceViewFactory } from '../types';

/*
 * The shared parts of the Chemistry piece views (presentation only). A piece is built once by
 * `defineChem`; its `draw` reads a `Frame` (the station view's pose, the setup progress) and
 * assigns what changed, nothing else. A model value that is NaN (no run) is the idle look. The
 * model variables a piece may draw are those its `shows` list names (`Frame.v`): the data decides
 * what a piece shows, so nothing unlisted is ever drawn. A control only sends a command through
 * `ctx.send`; one the station would refuse is disabled and says why (`ctx.refusal`).
 */

export const IDLE: BenchPose = Object.freeze({
  status: 'idle',
  parameters: Object.freeze({}),
  sample: Object.freeze({}),
});

/** What a piece draws from, refilled in place at every update (no allocation per frame). */
export interface Frame {
  view: StationView;
  pose: BenchPose;
  running: boolean;
  completed: boolean;
  /** Changes with the state and the setup progress: what a control's refusal depends on. */
  sig: number;
  /** Changes with the settings: a station refuses a run, or a step, by what is set. */
  settings: number;
  /** Model variables this piece's `shows` names (never an answer the student works out). */
  declared: ReadonlySet<string>;
}

const STATES = ['idle', 'configured', 'running', 'stopped', 'completed'] as const;

function fill(f: Frame, view: StationView): void {
  f.view = view;
  f.pose = view.kind === 'bench' ? view.pose : IDLE;
  f.running = f.pose.status === 'running';
  f.completed = f.pose.status === 'completed';
  let done = 0;
  for (const s of view.setup) if (s.done) done++;
  f.sig = STATES.indexOf(f.pose.status) * 100_000 + view.setup.length * 1000 + done;
  let h = 0;
  for (const name in f.pose.parameters) {
    const x = f.pose.parameters[name] ?? 0;
    h = (h * 31 + (Number.isFinite(x) ? x : 0)) % 1e9;
  }
  f.settings = h;
}

/** A model variable now: NaN when this piece does not show it, or there is no run. */
export const v = (f: Frame, name: string): number =>
  f.declared.has(name) ? (f.pose.sample[name] ?? Number.NaN) : Number.NaN;

/** A setting now (the run's own while a run exists, else the dials): NaN where there is none. */
export const p = (f: Frame, name: string): number => f.pose.parameters[name] ?? Number.NaN;

/** The model variables a piece shows: bound variables, and those of bound results and instruments. */
export function declaredVariables(
  definition: ExperimentDefinition,
  shows: PieceContext['piece']['shows'],
): Set<string> {
  const out = new Set<string>();
  const result = (id: string) => {
    const r = definition.results.find((x) => x.id === id);
    if (r && !r.answer) out.add(r.variable);
  };
  for (const b of shows) {
    if ('variable' in b) {
      if (!definition.results.some((r) => r.answer && r.variable === b.variable))
        out.add(b.variable);
    } else if ('result' in b) result(b.result);
    else if ('instrument' in b) result(b.instrument);
  }
  return out;
}

/** The name of the class a variable's value falls in (the classes of the result that reads it), '' for none. */
export function classLabel(
  definition: ExperimentDefinition,
  texts: Texts,
  variable: string,
  value: number,
): string {
  const classes = definition.results.find((r) => r.variable === variable && !r.answer)?.classes;
  if (!classes || !Number.isFinite(value)) return '';
  const hit = classes.find((c) => value <= (c.max ?? Infinity));
  return hit ? texts.of(hit, 'label') : '';
}

// ---- write only on change ---------------------------------------------------------------------

export type Put<T> = (value: T) => void;

export function putAttr(node: Element, name: string): Put<string | number> {
  let last: string | number | undefined;
  return (value) => {
    if (Object.is(value, last)) return;
    last = value;
    node.setAttribute(name, String(value));
  };
}

export function putText(node: Node): Put<string> {
  let last: string | undefined;
  return (value) => {
    if (value === last) return;
    last = value;
    node.textContent = value;
  };
}

/** Text from a number, formatted only when the number changes. */
export function putNumber(node: Node, format: (value: number) => string): Put<number> {
  let last: number | undefined;
  return (value) => {
    if (Object.is(value, last)) return;
    last = value;
    node.textContent = format(value);
  };
}

/** Whether any of three numbers differs from the last call (the first call: yes); allocates nothing. */
export function changes(): (a: number, b: number, c: number) => boolean {
  let la: number | undefined;
  let lb = 0;
  let lc = 0;
  return (a, b, c) => {
    const same = la !== undefined && Object.is(a, la) && Object.is(b, lb) && Object.is(c, lc);
    la = a;
    lb = b;
    lc = c;
    return !same;
  };
}

/** An attribute from a number, formatted (and written) only when the number changes. */
export function putFormat(
  node: Element,
  name: string,
  format: (value: number) => string,
): Put<number> {
  let last: number | undefined;
  return (value) => {
    if (Object.is(value, last)) return;
    last = value;
    node.setAttribute(name, format(value));
  };
}

/** A paint from linear RGB, formatted and written only when it changes. */
export function putFill(
  node: Element,
  name: 'fill' | 'stroke',
  css: (r: number, g: number, b: number) => string,
): (r: number, g: number, b: number) => void {
  let [lr, lg, lb] = [Number.NaN, Number.NaN, Number.NaN];
  return (r, g, b) => {
    if (r === lr && g === lg && b === lb) return;
    [lr, lg, lb] = [r, g, b];
    node.setAttribute(name, css(r, g, b));
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

let ids = 0;
/** A document-unique id for an SVG definition. */
export const uid = (prefix: string): string => `${prefix}-${++ids}`;

/** A clip path of a polygon `points`, appended to `parent`; returns its `clip-path` value. */
export function clipOf(parent: Element, points: string): string {
  const id = uid('chem-clip');
  const clip = S('clipPath', { id }, parent);
  S('polygon', { points }, clip);
  return `url(#${id})`;
}

/** The points of a profile (r, y in metres, y up) as SVG millimetres about `cx`, the floor at `floor`. */
export function polygon(
  profile: readonly (readonly [number, number])[],
  cx: number,
  floor: number,
): string {
  const left = profile.map(([r, y]) => `${cx - r * 1000},${floor - y * 1000}`);
  const right = [...profile].reverse().map(([r, y]) => `${cx + r * 1000},${floor - y * 1000}`);
  return [...left, ...right].join(' ');
}

// ---- the piece --------------------------------------------------------------------------------

export interface Part {
  draw(f: Frame): void;
  /** A text name for what the drawing shows in colour (and its state); '' for none. */
  twin?(f: Frame): string;
  dispose?(): void;
}

export interface Kit {
  /** The piece's own element, inside the host's slot. */
  readonly host: HTMLElement;
  /** The drawing: an SVG of `width` × `height` (millimetres), described for assistive technology. */
  drawing(width: number, height: number, role?: 'img' | 'group'): SVGSVGElement;
  readonly ctx: PieceContext;
  readonly texts: Texts;
  readonly label: string;
  /** The nth parameter the piece owns, or '' where it owns fewer. */
  owned(n?: number): string;
  /** Says why a press was refused (or '' to clear it), in the piece's own line. */
  say(text: string): void;
  /** A listener released at dispose. */
  listen(target: EventTarget, type: string, handler: (event: Event) => void): void;
  /** A button sending `command` (or `onPress`); `shown` says when it is there. Its refusal is shown beside it. */
  action(
    label: () => string,
    command: 'run' | 'stop' | 'reset',
    shown?: (f: Frame) => boolean,
  ): (f: Frame) => void;
  /** One button per setup step onto this piece. */
  steps(): (f: Frame) => void;
}

/** Makes the factory of a Chemistry piece: `build` draws the piece into `kit.host`. */
export function defineChem(kind: string, build: (kit: Kit) => Part): PieceViewFactory {
  return (): PieceView => {
    let host: HTMLElement | null = null;
    let part: Part | null = null;
    let frame: Frame | null = null;
    let showTwin: Put<string> | null = null;
    let context: PieceContext | null = null;
    const releases: (() => void)[] = [];
    return {
      mount(root: HTMLElement, ctx: PieceContext) {
        context = ctx;
        const h = el('div', 'chem-piece');
        h.dataset.kind = ctx.piece.kind || kind;
        h.setAttribute('role', 'group');
        const label = ctx.texts.of(ctx.piece, 'label');
        h.setAttribute('aria-label', label);
        root.append(h);
        host = h;
        const twin = el('p', 'chem-twin');
        const tray = el('div', 'chem-actions');
        const note = el('p', 'chem-reason');
        note.setAttribute('role', 'status');
        h.append(twin, tray, note);
        const say = putText(note);
        const kit: Kit = {
          host: h,
          ctx,
          texts: ctx.texts,
          label,
          drawing(width, height, role = 'img') {
            const art = S('svg', {
              viewBox: `0 0 ${width} ${height}`,
              role,
              'aria-label': label,
              preserveAspectRatio: 'xMidYMax meet',
            });
            art.classList.add('chem-art');
            twin.before(art);
            return art;
          },
          say,
          owned: (n = 0) => ctx.piece.owns[n] ?? '',
          listen: (target, type, handler) => {
            target.addEventListener(type, handler);
            releases.push(() => target.removeEventListener(type, handler));
          },
          action(text, command, shown) {
            const wrap = el('div', 'chem-action');
            const button = el('button', 'chem-button');
            button.type = 'button';
            const why = el('p', 'chem-reason');
            why.setAttribute('role', 'status');
            wrap.append(button, why);
            tray.append(wrap);
            const label$ = putText(button);
            const reason$ = putText(why);
            let sig = Number.NaN;
            let settings = Number.NaN;
            kit.listen(button, 'click', () => {
              if (button.getAttribute('aria-disabled') !== 'true') ctx.send({ command });
            });
            let visibleNow: boolean | undefined;
            return (f) => {
              const visible = shown ? shown(f) : true;
              if (visible !== visibleNow) {
                visibleNow = visible;
                wrap.hidden = !visible;
              }
              if (!visible || (f.sig === sig && f.settings === settings)) return;
              sig = f.sig;
              settings = f.settings;
              label$(text());
              const reason = ctx.refusal(command);
              button.setAttribute('aria-disabled', reason ? 'true' : 'false');
              reason$(reason ?? '');
            };
          },
          steps() {
            const list = el('div', 'chem-steps');
            tray.append(list);
            let sig = Number.NaN;
            let settings = Number.NaN;
            const mine = (s: SetupProgress) => s.step.onto === ctx.piece.id;
            return (f) => {
              if (f.sig === sig && f.settings === settings) return;
              sig = f.sig;
              settings = f.settings;
              const own = f.view.setup.filter(mine);
              if (list.children.length !== own.length) {
                list.replaceChildren();
                for (const { step } of own) {
                  const b = el('button', 'chem-step', ctx.texts.of(step, 'instruction'));
                  b.type = 'button';
                  b.dataset.step = step.id;
                  list.append(b);
                  kit.listen(b, 'click', () => {
                    if (b.getAttribute('aria-disabled') !== 'true') {
                      kit.say('');
                      ctx.send({ command: 'setup', step: step.id });
                    } else if (b.getAttribute('aria-pressed') !== 'true') {
                      kit.say(ctx.refusal('setup', step.id) ?? '');
                    }
                  });
                }
              }
              own.forEach(({ step, done }, i) => {
                const b = list.children[i] as HTMLElement;
                const why = done ? null : ctx.refusal('setup', step.id);
                b.setAttribute('aria-pressed', done ? 'true' : 'false');
                b.setAttribute('aria-disabled', done || why ? 'true' : 'false');
                b.title = why ?? '';
              });
            };
          },
        };
        part = build(kit);
        showTwin = putText(twin);
      },
      update(view: StationView) {
        if (!part || !context) return;
        frame ??= {
          view,
          pose: IDLE,
          running: false,
          completed: false,
          sig: 0,
          settings: 0,
          declared: declaredVariables(view.definition, context.piece.shows),
        };
        fill(frame, view);
        part.draw(frame);
        if (part.twin && showTwin) showTwin(part.twin(frame));
      },
      dispose() {
        part?.dispose?.();
        for (const release of releases) release();
        releases.length = 0;
        host?.remove();
        part = host = frame = showTwin = context = null;
      },
    };
  };
}
