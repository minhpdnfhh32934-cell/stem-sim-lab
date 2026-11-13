import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bundledContent } from '../../content';
import strings from '../../content/strings.json';
import { createTexts, ENGLISH, type Texts } from '../../core/i18n';
import type { StationView } from '../../gameplay/experiment/StationSystem';
import { runCsv } from '../../simulation/csv';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from '../../simulation/experiment';
import { ExperimentSession } from '../../simulation/ExperimentSession';
import { readings } from '../../simulation/measurement';
import { titrationModel } from '../../simulation/models/titration';
import { ExperimentView } from '../render/ExperimentView';
import { DebugPanel } from './DebugPanel';
import { ResultsPanel } from './ResultsPanel';
import { comparisonGraphs, formatResult, resultRows, resultSummary, runOutcome } from './results';

// Every student-facing view of a completed titration, rendered or serialised: the HCl
// concentration (0.085 mol/L, hidden) and the acid concentration the student works out (an
// answer) appear in none of them. Also the answer check, integer results and records-only scatters
// in the results panel. The panel is drawn into a minimal DOM stand-in (tests run in node).

/** Just enough DOM for the panel: elements, text, attributes, listeners; everything readable. */
class FakeNode {
  children: FakeNode[] = [];
  data = '';
  className = '';
  title = '';
  id = '';
  htmlFor = '';
  value = '';
  readonly attrs = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly listeners = new Map<string, ((event: unknown) => void)[]>();
  readonly classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  readonly style = {};
  constructor(readonly tag: string) {}
  append(...nodes: (FakeNode | string)[]) {
    for (const n of nodes) this.children.push(typeof n === 'string' ? text(n) : n);
  }
  replaceChildren(...nodes: (FakeNode | string)[]) {
    this.children = [];
    this.append(...nodes);
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }
  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  fire(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener({ preventDefault() {} });
  }
  get textContent(): string {
    return this.tag === '#text' ? this.data : this.children.map((c) => c.textContent).join('');
  }
  set textContent(value: string) {
    if (this.tag === '#text') this.data = value;
    else this.children = value ? [text(value)] : [];
  }
  get childElementCount() {
    return this.children.filter((c) => c.tag !== '#text').length;
  }
  querySelector() {
    return null;
  }
  contains() {
    return false;
  }
  focus() {}
  scrollBy() {}
  remove() {}
  /** Every node below, depth first. */
  all(): FakeNode[] {
    return [this, ...this.children.flatMap((c) => c.all())];
  }
  /** All a student could see or hear: text, attribute values (aria, title…), data, field values. */
  dump(): string {
    return this.all()
      .flatMap((n) => [n.data, n.title, n.value, ...n.attrs.values(), ...Object.values(n.dataset)])
      .join('\n');
  }
}
const text = (data: string) => Object.assign(new FakeNode('#text'), { data });

beforeAll(() => {
  vi.stubGlobal('document', {
    createElement: (tag: string) => new FakeNode(tag),
    createElementNS: (_: string, tag: string) => new FakeNode(tag),
    createTextNode: (data: string) => text(data),
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const LEAK = /0[.,]085/;
const raw = () =>
  structuredClone(
    (bundledContent.experiments as { id: string }[]).find((e) => e.id === 'acid-base-titration'),
  ) as Record<string, unknown>;
/**
 * The shipped titration stepped to its endpoint (the 2D run), not driven by a tap: the views read a
 * completed run's record either way, and a stepped run completes here without a bench.
 */
const stepped = () => {
  const d = raw() as {
    presentation: string;
    workspace: { drive?: unknown; setup: { by?: string }[] };
  };
  d.presentation = '2d-workspace';
  delete d.workspace.drive;
  for (const step of d.workspace.setup) delete step.by;
  return d;
};
const titration: ExperimentDefinition = ExperimentDefinitionSchema.parse(stepped());
const VI = createTexts(strings, () => 'vi');

/** A titration station with completed runs at these settings, the last one current. */
function station(definition = titration, ...settings: Record<string, number>[]) {
  const session = new ExperimentSession('lab/titration', definition, titrationModel);
  session.setReady(true);
  for (const s of settings.length ? settings : [{}]) {
    session.reset();
    for (const [id, value] of Object.entries(s)) session.setParameter(id, value);
    expect(session.start()).toBeNull();
    for (let i = 0; i < 1000 && session.state === 'running'; i++) session.advance(1);
    expect(session.state).toBe('completed');
  }
  const view = {
    id: session.id,
    kind: 'bench',
    model: 'titration-stand',
    definition,
    session,
    checklist: [],
    next: 0,
    runBlock: null,
    setup: [],
    pose: { status: session.state, parameters: session.parameters, sample: {} },
  } as unknown as StationView;
  return { session, view };
}

const panelFor = (view: StationView, texts: Texts) => {
  const panel = new ResultsPanel(texts);
  panel.show(view);
  return { panel, root: panel.root as unknown as FakeNode };
};

describe('the titration views never show the HCl concentration', () => {
  const { session, view } = station(titration, { baseConcentration: 0.2 }, {});
  const record = session.history.at(-1)!;

  it('holds it in the record (so the checks below would see a leak)', () => {
    expect(record.inputs.acidConcentration).toBe(0.085);
    expect(record.results!['acid-concentration']!.toFixed(3)).toBe('0.085');
  });

  for (const [language, texts] of [
    ['en', ENGLISH],
    ['vi', VI],
  ] as const) {
    it(`results panel (${language}): one run, a comparison, the run list`, () => {
      const { panel, root } = panelFor(view, texts);
      const single = root.dump();
      expect(single).toContain(readings(titration, record)[0]!.text); // the burette reading
      expect(single).not.toMatch(LEAK);
      expect(root.all().some((n) => n.dataset.answer === 'acid-concentration')).toBe(true);
      expect(root.all().some((n) => n.dataset.result === 'acid-concentration')).toBe(false);
      for (const r of session.history) {
        (panel as unknown as { toggle(s: unknown, r: unknown): void }).toggle(session, r);
      }
      const compare = root.dump();
      expect(compare).toContain('#1');
      expect(compare).not.toMatch(LEAK);
    });

    it(`notices, run outcomes and the desk display (${language})`, () => {
      const summary = resultSummary(titration, record.results!, texts);
      expect(summary.map(([name]) => name)).toEqual(['V_end', 'pH']);
      expect(JSON.stringify(summary)).not.toMatch(LEAK);
      expect(runOutcome(record, texts)).not.toMatch(LEAK);
      expect(JSON.stringify(resultRows(titration, record, texts))).not.toMatch(LEAK);
      // Theory comes from every input, the hidden one too (V_eq = c_a·V_a/c_b): none is shown.
      expect(resultRows(titration, record, texts).map((row) => row.theory)).toEqual([
        null,
        null,
        null,
      ]);
      const [graph] = comparisonGraphs(titration, session.history, texts);
      expect(graph?.markName).toBeNull();
      expect(graph?.lines.map((l) => l.mark)).toEqual([null, null]);

      const drawn: string[] = [];
      const ctx = {
        fillText: (s: string) => drawn.push(s),
        measureText: (s: string) => ({ width: s.length * 8 }),
        fillRect() {},
      };
      const paint = (
        ExperimentView.prototype as unknown as Record<
          string,
          (this: unknown, ...args: unknown[]) => unknown
        >
      ).paintStatus!;
      paint.call({ game: { texts } }, { ctx, canvas: { width: 1000, height: 640 } }, view);
      expect(drawn).toContain('Q'); // the other inputs are still on the desk
      expect(drawn).not.toContain('c_a');
      expect(drawn.join('\n')).not.toMatch(LEAK);
    });
  }

  it('CSV of every run, and the debug panel line', () => {
    for (const r of session.history) expect(runCsv(r)).not.toMatch(LEAK);
    const line = (
      DebugPanel.prototype as unknown as Record<
        string,
        (this: unknown, ...args: unknown[]) => unknown
      >
    ).stationText!.call({
      game: { stations: { activeStation: () => view } },
    }) as string;
    expect(line).toContain('endpoint-volume=');
    expect(line).not.toContain('acid-concentration');
    expect(line).not.toMatch(LEAK);
  });
});

describe('Check my answer', () => {
  const { session, view } = station();
  const record = session.history.at(-1)!;
  const r = readings(titration, record)[0]!.reading;
  const answer = (root: FakeNode) => {
    const form = root.all().find((n) => n.dataset.answer === 'acid-concentration')!;
    const input = form.all().find((n) => n.tag === 'input')!;
    const feedback = root.all().find((n) => n.className === 'results-answer-feedback')!;
    return { form, input, feedback };
  };

  it('says only right or not, keeps a wrong answer’s text, and is view state for that run', () => {
    const { panel, root } = panelFor(view, ENGLISH);
    const { form, input, feedback } = answer(root);
    form.fire('submit');
    expect(feedback.textContent).toBe('Enter a number first.');
    input.value = '0.1';
    input.fire('input');
    form.fire('submit');
    expect(feedback.textContent).toBe(
      "Not right yet: check your working from this run's reading and try again.",
    );
    expect(input.value).toBe('0.1');
    panel.show(view); // drawn again (a station change): the text and the verdict stay
    expect(answer(root).input.value).toBe('0.1');
    expect(answer(root).feedback.dataset.check).toBe('incorrect');
    const again = answer(root);
    again.input.value = String((0.1 * r) / 25);
    again.form.fire('submit');
    expect(again.feedback.textContent).toBe("Correct: it agrees with this run's reading.");
    // Nothing but the student's own field holds the value they worked out.
    again.input.value = '';
    expect(root.dump()).not.toMatch(LEAK);
    // A new panel (the view state is never saved) starts empty.
    expect(answer(panelFor(view, ENGLISH).root).input.value).toBe('');
    // A new session (a new game whose run ids start again at #1) does not inherit it.
    again.input.value = '0.1';
    again.form.fire('submit');
    const next = station();
    expect(next.session.history.at(-1)!.runId).toBe(record.runId);
    panel.show(next.view);
    expect(answer(root).input.value).toBe('');
    expect(answer(root).feedback.dataset.check).toBe('');
  });

  it('labels the field and describes it by its hint and feedback', () => {
    const { root } = panelFor(view, ENGLISH);
    const { input } = answer(root);
    const label = root.all().find((n) => n.tag === 'label')!;
    expect(label.htmlFor).toBe(input.id);
    const described = input.attrs.get('aria-describedby')!.split(' ');
    expect(described.map((id) => root.all().some((n) => n.id === id))).toEqual([true, true]);
  });

  it('offers no field before a run has completed', () => {
    const fresh = new ExperimentSession('lab/t2', titration, titrationModel);
    const { root } = panelFor({ ...view, session: fresh }, ENGLISH);
    expect(root.all().some((n) => n.dataset.answer !== undefined)).toBe(false);
  });
});

describe('integer results and records-only scatters', () => {
  it('shows an integer result as a whole number in the table, comparison and summaries', () => {
    expect(formatResult(12.4, 'cells', true)).toBe('12 cells');
    expect(formatResult(-2.6, '', true)).toBe('−3');
    expect(formatResult(null, '', true)).toBe('—');
    const r = stepped() as unknown as { results: { id: string; format?: string }[] };
    r.results.find((x) => x.id === 'endpoint-pH')!.format = 'integer';
    const counted = ExperimentDefinitionSchema.parse(r);
    const { session, view } = station(counted, {}, { endpointPH: 4.4 });
    const record = session.history.at(-1)!;
    const ph = resultRows(counted, record).find((x) => x.id === 'endpoint-pH')!;
    expect(ph.integer).toBe(true);
    expect(resultSummary(counted, record.results!)[1]).toEqual(['pH', '4']);
    const { panel, root } = panelFor(view, ENGLISH);
    const cell = () =>
      root
        .all()
        .find((n) => n.dataset.result === 'endpoint-pH')!
        .all()
        .filter((n) => n.className === 'measured')
        .map((n) => n.textContent);
    expect(cell()).toEqual(['4']);
    for (const run of session.history) {
      (panel as unknown as { toggle(s: unknown, r: unknown): void }).toggle(session, run);
    }
    expect(cell()).toEqual(['8', '4']); // pH 8.2 and 4.4
    expect(runCsv(record)).toMatch(
      /# Result endpoint-pH \(pH in the flask at the reading\) = 4\.\d+ /,
    );
  });

  it('draws the station’s completed records as points, one per run, nothing fitted', () => {
    const r = stepped() as unknown as Record<string, unknown>;
    r.scatters = [
      { id: 'vend', title: 'V_end by NaOH', x: 'baseConcentration', y: 'endpoint-volume' },
    ];
    const scattered = ExperimentDefinitionSchema.parse(r);
    const { view } = station(
      scattered,
      { baseConcentration: 0.05 },
      { baseConcentration: 0.1 },
      { baseConcentration: 0.2 },
    );
    const { root } = panelFor(view, ENGLISH);
    const plot = root.all().find((n) => n.attrs.get('data-scatter') === 'vend')!;
    expect(plot.attrs.get('data-points')).toBe('3');
    expect(plot.all().filter((n) => n.tag === 'circle')).toHaveLength(3);
    expect(plot.all().filter((n) => n.tag === 'polyline')).toHaveLength(0);
    expect(plot.dump()).toContain('c_b (mol/L)');
    expect(plot.dump()).toContain('V_end (mL)');
    // Before any completed run: no empty plot.
    const fresh = new ExperimentSession('lab/t3', scattered, titrationModel);
    const empty = panelFor({ ...view, session: fresh }, ENGLISH).root;
    expect(empty.all().some((n) => n.attrs.get('data-scatter') !== undefined)).toBe(false);
  });
});
