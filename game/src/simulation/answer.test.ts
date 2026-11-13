import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { runCsv } from './csv';
import {
  type ExperimentDefinition,
  ExperimentDefinitionSchema,
  shownInputs,
  shownResults,
} from './experiment';
import { ExperimentRuntime } from './ExperimentRuntime';
import { ExperimentSession } from './ExperimentSession';
import { checkAnswer, readings } from './measurement';
import { titrationModel } from './models/titration';

// Information hiding: a `hidden` input and an `answer` result stay in the model, the session and
// the record, are refused wherever a view would show them, and the answer is checked against the
// run's own reading (`checkAnswer`).

type Raw = Record<string, unknown> & {
  inputs: Record<string, Record<string, unknown>>;
  results: Record<string, unknown>[];
  measurements: Record<string, unknown>[];
  graphs: Record<string, unknown>[];
  analyses?: Record<string, unknown>[];
  scatters?: Record<string, unknown>[];
  workspace?: unknown;
};
/** The shipped titration as a plain 3D station: these tests are about its answer, not its bench. */
const raw = () => {
  const e = structuredClone(
    (bundledContent.experiments as { id: string }[]).find((e) => e.id === 'acid-base-titration'),
  ) as unknown as Raw & { procedure: { done: { kind: string } }[] };
  delete e.workspace;
  e.presentation = 'physical-3d';
  e.procedure = e.procedure.filter((s) => s.done.kind !== 'setup');
  return e;
};
const messages = (r: object) =>
  ExperimentDefinitionSchema.safeParse(r).error?.issues.map(
    (i) => `${i.path.join('.')}: ${i.message}`,
  ) ?? [];
const titration: ExperimentDefinition = ExperimentDefinitionSchema.parse(raw());
const answerIndex = titration.results.findIndex((r) => r.id === 'acid-concentration');

/** A completed titration at these dials (the fixed HCl from the definition). */
function titrate(settings: Record<string, number> = {}) {
  const session = new ExperimentSession('lab/titration', titration, titrationModel);
  for (const [id, value] of Object.entries(settings)) session.setParameter(id, value);
  session.setReady(true);
  expect(session.start()).toBeNull();
  for (let i = 0; i < 1000 && session.state === 'running'; i++) session.advance(1);
  expect(session.state).toBe('completed');
  const record = session.history.at(-1);
  if (record?.status !== 'completed') throw new Error('no completed record');
  return { session, record };
}

describe('information hiding in the titration definition', () => {
  it('keeps the HCl concentration in the record and out of what is shown', () => {
    const { record } = titrate();
    expect(record.inputs.acidConcentration).toBe(0.085); // the model and the record keep it
    expect(record.theory()?.acidConcentration).toBe(0.085);
    expect(record.results['acid-concentration']?.toFixed(3)).toBe('0.085');
    expect(shownInputs(titration).map(([id]) => id)).toEqual(['flowRate', 'kw']);
    expect(shownResults(titration).map((r) => r.id)).not.toContain('acid-concentration');
    expect(titration.results[answerIndex]?.answer).toEqual({ proportionalTo: 'endpoint-volume' });
  });

  it('exports neither the value, its theory nor the answer in CSV', () => {
    const csv = runCsv(titrate().record);
    expect(csv).not.toMatch(/0[.,]085/);
    expect(csv).not.toContain('acidConcentration');
    expect(csv).toContain('# Result acid-concentration (');
    expect(csv).toContain('not exported, the student works it out');
    expect(csv).toContain('# Input flowRate (Q) = 0.25 mL/s'); // other inputs as before
    expect(csv).not.toContain('# Theory'); // V_eq = c_a·V_a/c_b would give c_a back
  });
});

describe('checkAnswer', () => {
  const { session, record } = titrate();
  const reading = readings(titration, record)[0]!;
  const truth = record.results['acid-concentration']!;
  const fromReading = (0.1 * reading.reading) / 25; // c_b·R/V_a, as the student works it out

  it('is incomplete without a completed run or a number', () => {
    expect(checkAnswer(titration, record, 'acid-concentration', '')).toBe('incomplete');
    expect(checkAnswer(titration, record, 'acid-concentration', '  ')).toBe('incomplete');
    expect(checkAnswer(titration, record, 'acid-concentration', 'about a tenth')).toBe(
      'incomplete',
    );
    const running = new ExperimentRuntime('r', titration, titrationModel, session.inputs());
    running.start();
    running.advance(1);
    expect(checkAnswer(titration, running, 'acid-concentration', String(truth))).toBe('incomplete');
    expect(checkAnswer(titration, record, 'endpoint-volume', '21.25')).toBe('incomplete');
  });

  it('accepts the answer worked out from the reading, with a point or a comma', () => {
    expect(checkAnswer(titration, record, 'acid-concentration', String(fromReading))).toBe(
      'correct',
    );
    expect(
      checkAnswer(titration, record, 'acid-concentration', String(fromReading).replace('.', ',')),
    ).toBe('correct');
    expect(checkAnswer(titration, record, 'acid-concentration', String(truth))).toBe('correct');
  });

  it('draws the line at |x|·(d/2)/R', () => {
    // x = truth/(1 ∓ (d/2)/R) are the edges: |x − truth| = |x|·(d/2)/R.
    const share = reading.bound / reading.reading;
    const at = (k: number) =>
      checkAnswer(titration, record, 'acid-concentration', String(truth / (1 - k * share)));
    expect([at(0.99), at(-0.99), at(1.01), at(-1.01)]).toEqual([
      'correct',
      'correct',
      'incorrect',
      'incorrect',
    ]);
    expect(checkAnswer(titration, record, 'acid-concentration', '0.1')).toBe('incorrect');
  });

  // Includes V_a 10 mL, c_b 0.2 mol/L, phenolphthalein, d 0.1 mL: V_end just above 4.25 mL reads
  // R = 4.3, which the brief's truth·(d/2)/R refused.
  it('accepts c_b·R/V_a for every preset combination', () => {
    const value = (id: string) => titration.parameters.find((p) => p.id === id)!.presets;
    const missed: string[] = [];
    for (const va of value('acidVolume')) {
      for (const cb of value('baseConcentration')) {
        for (const pH of value('endpointPH')) {
          for (const d of value('resolution')) {
            const run = titrate({
              acidVolume: va.value,
              baseConcentration: cb.value,
              endpointPH: pH.value,
              resolution: d.value,
            }).record;
            const r = readings(titration, run)[0]!.reading;
            const x = String((cb.value * r) / va.value);
            const check = checkAnswer(titration, run, 'acid-concentration', x);
            if (check !== 'correct') missed.push(`${va.value} ${cb.value} ${pH.value} ${d.value}`);
          }
        }
      }
    }
    expect(missed).toEqual([]);
  });
});

describe('what the schema refuses for a hidden input or an answer', () => {
  it('ships the titration valid', () => {
    expect(messages(raw())).toEqual([]);
  });

  it('needs an instrument for the answer, and no other way to see it', () => {
    const r = raw();
    r.results[answerIndex]!.answer = { proportionalTo: 'endpoint-pH' };
    expect(messages(r)).toEqual([
      `results.${answerIndex}.answer: no instrument reads "endpoint-pH"`,
    ]);
    const shared = raw();
    shared.results.push({ ...shared.results[answerIndex], id: 'copy', answer: undefined });
    expect(messages(shared)).toContainEqual(
      `results.${answerIndex}.answer: another result shows its variable "inferredAcidConcentration"`,
    );
    const measured = raw();
    measured.measurements.push({
      id: 'ca',
      label: 'c_a',
      unit: 'mol/L',
      variable: 'inferredAcidConcentration',
    });
    expect(messages(measured)).toContainEqual(
      `results.${answerIndex}.answer: a measurement shows its variable "inferredAcidConcentration"`,
    );
    const marked = raw();
    marked.graphs[0]!.mark = 'acidConcentration';
    expect(messages(marked)).toContainEqual(
      `results.${answerIndex}.answer: its theory "acidConcentration" is shown elsewhere`,
    );
  });

  it('refuses an analysis, a scatter or a workspace binding that would show either', () => {
    const r = raw();
    r.analyses = [
      {
        id: 'ca',
        title: 'c_a',
        x: 'acidVolume',
        y: 'acid-concentration',
        group: ['baseConcentration'],
        columns: ['acidConcentration'],
        slope: { label: 'a', symbol: 'a', unit: '', theory: 'equivalenceVolume' },
      },
    ];
    r.scatters = [{ id: 's', title: 'S', x: 'acidVolume', y: 'acid-concentration' }];
    expect(messages(r)).toEqual([
      'analyses.0.y: "acid-concentration" is an answer the student works out',
      'analyses.0.columns.0: "acidConcentration" is hidden',
      'inputs: an experiment with a hidden input shows no theory: no analyses or oscillation',
      'scatters.0.y: "acid-concentration" is an answer the student works out',
    ]);
    const w = raw();
    w.presentation = '2d-workspace';
    w.workspace = {
      pieces: [
        {
          id: 'flask',
          kind: 'conical-flask',
          slot: 'bench',
          label: 'Flask',
          owns: ['acidVolume', 'baseConcentration', 'endpointPH', 'resolution'],
          shows: [
            { input: 'acidConcentration' },
            { result: 'acid-concentration' },
            { variable: 'inferredAcidConcentration' },
            { input: 'flowRate' },
          ],
        },
      ],
    };
    expect(messages(w)).toEqual([
      'workspace.pieces.0.shows.0: "acidConcentration" is hidden',
      'workspace.pieces.0.shows.1: "acid-concentration" is an answer the student works out',
      'workspace.pieces.0.shows.2: variable "inferredAcidConcentration" is an answer the student works out',
    ]);
  });
});

describe('records-only scatters in data', () => {
  it('takes a parameter against a shown result, each id once', () => {
    const r = raw();
    r.scatters = [
      {
        id: 'v',
        title: 'V_end',
        vi: { title: 'V_end' },
        x: 'baseConcentration',
        y: 'endpoint-volume',
      },
    ];
    expect(messages(r)).toEqual([]);
    r.scatters.push({ id: 'v', title: 'Again', x: 'acidConcentration', y: 'nope' });
    expect(messages(r)).toEqual([
      'scatters.1.id: duplicate id "v"',
      'scatters.1.x: no parameter "acidConcentration"',
      'scatters.1.y: no result "nope"',
    ]);
  });
});
