import { describe, expect, it } from 'vitest';
import { Registry } from '../core/Registry';
import { bundledContent } from '../content';
import { buildContent, ContentError, type RawContent } from '../game/content';
import { pendingBeforeRun, setupRefusal, stepApplies } from '../gameplay/experiment/setupGate';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { ExperimentDefinitionSchema, type SetupStep } from './experiment';
import { BUILT_IN_MODELS } from './models';

// The workspace contract in data: `presentation`, `workspace` and its definition-level checks,
// the `setup` milestone, result `format`; the setup gate; the checks that need models or rooms.

type Raw = Record<string, unknown> & {
  parameters: { id: string }[];
  procedure: object[];
  results: { format?: string }[];
};
/**
 * The bundled content with the titration bench as these tests knew it (shipped physical since
 * Phase B): the `titration-stand` rig at the station, none of the physical bench's glassware.
 */
function withTitrationRig<T>(raw: T): T {
  type Placement = { id: string; item: string; params?: Record<string, unknown> };
  const rooms = (raw as unknown as { rooms: { id: string; placements: Placement[] }[] }).rooms;
  const lab = rooms.find((r) => r.id === 'chemistry-lab');
  if (lab) {
    lab.placements = lab.placements
      .filter((p) => p.params?.station !== 'titration')
      .map((p) =>
        p.id === 'titration'
          ? { ...p, item: 'titration-stand', params: { experimentId: 'acid-base-titration' } }
          : p,
      );
  }
  // The physical bench's guided task names its glassware: it goes with it.
  const withTasks = raw as unknown as { tasks?: { id: string }[] };
  if (withTasks.tasks)
    withTasks.tasks = withTasks.tasks.filter((t) => t.id !== 'titration-by-hand');
  return raw;
}

/** The shipped titration as a plain 3D station: the contract tests give it their own workspace. */
const plain = (e: Raw): Raw => {
  const plain: Raw = {
    ...e,
    presentation: 'physical-3d',
    procedure: e.procedure.filter((s) => (s as { done: { kind: string } }).done.kind !== 'setup'),
  };
  delete plain.workspace;
  return plain;
};
const titration = () =>
  plain(
    structuredClone(
      (bundledContent.experiments as { id: string }[]).find((e) => e.id === 'acid-base-titration'),
    ) as unknown as Raw,
  );

const workspace = () => ({
  pieces: [
    {
      id: 'burette',
      kind: 'burette',
      slot: 'stand',
      label: 'Burette',
      vi: { label: 'Buret' },
      owns: ['baseConcentration', 'resolution'],
      shows: [{ variable: 'volume' }, { instrument: 'endpoint-volume' }],
    },
    {
      id: 'flask',
      kind: 'conical-flask',
      slot: 'bench',
      label: 'Conical flask',
      owns: ['acidVolume', 'endpointPH'],
      shows: [{ result: 'endpoint-pH' }, { parameter: 'acidVolume' }, { input: 'kw' }],
    },
  ],
  materials: [
    { id: 'phenolphthalein', kind: 'indicator', label: 'Phenolphthalein', formula: 'C₂₀H₁₄O₄' },
    { id: 'mo', kind: 'indicator', label: 'MO', sets: { parameter: 'endpointPH', value: 4.4 } },
  ],
  setup: [
    {
      id: 'clamp',
      instruction: 'Clamp it.',
      refusal: 'Clamp it first.',
      place: 'burette',
      onto: 'flask',
    },
  ],
  runLabel: 'Open the tap',
  vi: { runLabel: 'Mở khoá' },
});

const parse = (raw: object) => ExperimentDefinitionSchema.safeParse(raw);
const messages = (raw: object) => {
  const result = parse(raw);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
const withWorkspace = (change: (w: ReturnType<typeof workspace>) => void = () => undefined) => {
  const raw = titration();
  const w = workspace();
  change(w);
  return { ...raw, presentation: '2d-workspace', workspace: w };
};

describe('experiment workspace (definition)', () => {
  it('defaults to physical-3d: every bundled definition parses unchanged', () => {
    for (const raw of bundledContent.experiments as object[]) {
      const result = parse(raw);
      expect(result.success).toBe(true);
      if (result.success && !('presentation' in raw)) {
        expect(result.data.presentation).toBe('physical-3d');
      }
    }
  });

  it('parses a workspace with its pieces, materials, setup, run label and bindings', () => {
    const result = parse(withWorkspace());
    expect(result.success).toBe(true);
    const w = result.data?.workspace;
    expect(w?.pieces[1]?.shows).toEqual([
      { result: 'endpoint-pH' },
      { parameter: 'acidVolume' },
      { input: 'kw' },
    ]);
    expect(w?.setup[0]?.phase).toBe('before-run');
    expect(w?.setup[0]?.after).toEqual([]);
    expect(w?.pieces[0]?.vi?.label).toBe('Buret');
  });

  it('needs a workspace unless physical-3d', () => {
    expect(messages({ ...titration(), presentation: 'microscopy' })).toEqual([
      'workspace: a "microscopy" experiment needs a workspace',
    ]);
    // Nothing could open it, so its setup could never be done.
    expect(messages({ ...withWorkspace(), presentation: 'physical-3d' })).toEqual([
      'workspace: a "physical-3d" experiment has no workspace',
    ]);
  });

  it('checks owned parameters, bindings, presets, setup references and setup milestones', () => {
    const problems = messages({
      ...withWorkspace((w) => {
        w.pieces[0]!.owns = ['baseConcentration', 'acidVolume', 'nope']; // resolution unowned
        w.pieces[0]!.shows = [
          { result: 'nope' },
          { instrument: 'endpoint-pH' }, // a result no instrument reads
          { input: 'nope' },
          { parameter: 'nope' },
        ] as never;
        w.materials[1]!.sets = { parameter: 'endpointPH', value: 6 };
        w.setup.push(
          {
            id: 'b',
            instruction: 'B.',
            refusal: 'B.',
            place: 'nope',
            onto: 'mo',
            after: ['c'],
          } as never,
          {
            id: 'c',
            instruction: 'C.',
            refusal: 'C.',
            place: 'mo',
            onto: 'flask',
            phase: 'after-run',
          } as never,
          {
            id: 'd',
            instruction: 'D.',
            refusal: 'D.',
            place: 'mo',
            onto: 'flask',
            after: ['c'],
          } as never,
        );
      }),
      procedure: [{ id: 'x', instruction: 'X.', done: { kind: 'setup', step: 'nope' } }],
    });
    expect(problems).toEqual([
      'workspace.pieces.0.owns.2: no parameter "nope"',
      'workspace.pieces.0.shows.0: no result "nope"',
      'workspace.pieces.0.shows.1: no instrument reads "endpoint-pH"',
      'workspace.pieces.0.shows.2: no shown input "nope"',
      'workspace.pieces.0.shows.3: no parameter "nope"',
      'workspace.pieces.1.owns.0: "acidVolume" is already owned by "burette"',
      'workspace.pieces: parameter "resolution" is owned by no piece',
      'workspace.materials.1.sets: 6 is not a preset of "endpointPH"',
      'workspace.setup.1.place: no piece or material "nope"',
      'workspace.setup.1.onto: no piece "mo"',
      'workspace.setup.1.after.0: no earlier step "c"',
      'workspace.setup.3.after.0: before-run cannot wait for after-run "c"',
      'procedure.0.done.step: no setup step "nope"',
    ]);
  });

  it('accepts a setup milestone and an integer result format', () => {
    const raw = withWorkspace();
    raw.procedure = [
      { id: 'clamp', instruction: 'Clamp.', done: { kind: 'setup', step: 'clamp' } },
    ];
    raw.results[0]!.format = 'integer';
    const result = parse(raw);
    expect(result.success).toBe(true);
    expect(result.data?.results[0]?.format).toBe('integer');
    expect(messages({ ...raw, results: [{ ...raw.results[0], format: 'x' }] })).not.toEqual([]);
  });
});

describe('setup gate', () => {
  const step = (id: string, after: string[] = [], phase: SetupStep['phase'] = 'before-run') =>
    ({
      id,
      instruction: id,
      refusal: `${id} first`,
      place: 'p',
      onto: 'q',
      after,
      phase,
    }) as SetupStep;
  const steps = [step('a'), step('b', ['a']), step('c', ['b']), step('r', ['c'], 'after-run')];
  const doneOf =
    (...ids: string[]) =>
    (id: string) =>
      ids.includes(id);

  it('names the next before-run step, none once all are done', () => {
    expect(pendingBeforeRun(steps, doneOf())?.id).toBe('a');
    expect(pendingBeforeRun(steps, doneOf('a'))?.id).toBe('b');
    expect(pendingBeforeRun(steps, doneOf('a', 'b', 'c'))).toBeNull();
    expect(pendingBeforeRun([], doneOf())).toBeNull();
  });

  it('refuses out of order with the earliest missing step, done, unknown, after-run before a run', () => {
    expect(setupRefusal(steps, 'a', doneOf(), false)).toBeNull();
    expect(setupRefusal(steps, 'c', doneOf(), false)).toEqual({ kind: 'waits', step: steps[0] });
    expect(setupRefusal(steps, 'c', doneOf('a'), false)).toEqual({ kind: 'waits', step: steps[1] });
    expect(setupRefusal(steps, 'a', doneOf('a'), false)).toEqual({ kind: 'done' });
    expect(setupRefusal(steps, 'z', doneOf(), false)).toEqual({ kind: 'unknown' });
    expect(setupRefusal(steps, 'r', doneOf('a', 'b', 'c'), false)).toEqual({ kind: 'needs-run' });
    expect(setupRefusal(steps, 'r', doneOf('a', 'b', 'c'), true)).toBeNull();
  });

  it('skips a step whose material is not chosen (`when`): the gate sees only those that apply', () => {
    const onion = { ...step('stain', ['a']), when: { parameter: 'specimen', values: [1] } };
    const all = [step('a'), onion, step('focus', ['stain'])];
    expect(stepApplies(onion, { specimen: 1 })).toBe(true);
    expect(stepApplies(onion, { specimen: 2 })).toBe(false);
    expect(stepApplies(onion, {})).toBe(false);
    expect(stepApplies(step('a'), {})).toBe(true);
    const cheek = all.filter((s) => stepApplies(s, { specimen: 2 }));
    expect(cheek.map((s) => s.id)).toEqual(['a', 'focus']);
    // What it waited for no longer applies: only the steps that do are asked for.
    expect(setupRefusal(cheek, 'focus', doneOf('a'), false)).toBeNull();
    expect(pendingBeforeRun(cheek, doneOf('a', 'focus'))).toBeNull();
    expect(setupRefusal(cheek, 'stain', doneOf('a'), false)).toEqual({ kind: 'unknown' });
  });

  it('checks `when` at load: an existing parameter, values among its presets', () => {
    const when = (w: object) =>
      messages(withWorkspace((ws) => Object.assign(ws.setup[0]!, { when: w })));
    expect(when({ parameter: 'endpointPH', values: [4.4, 8.2] })).toEqual([]);
    expect(when({ parameter: 'nope', values: [1] })).toEqual([
      'workspace.setup.0.when: no parameter "nope"',
    ]);
    expect(when({ parameter: 'endpointPH', values: [4.4, 7] })).toEqual([
      'workspace.setup.0.when: 7 is not a preset of "endpointPH"',
    ]);
    expect(when({ parameter: 'endpointPH', values: [] })).not.toEqual([]);
    // A procedure milestone on such a step could never be ticked with the other material.
    const raw = withWorkspace((ws) =>
      Object.assign(ws.setup[0]!, { when: { parameter: 'endpointPH', values: [4.4] } }),
    );
    const id = raw.workspace.setup[0]!.id;
    raw.procedure = [
      ...raw.procedure,
      { id: 'p', instruction: 'p', done: { kind: 'setup', step: id } },
    ];
    expect(messages(raw)).toEqual([
      `procedure.${raw.procedure.length - 1}.done.step: setup step "${id}" has a "when"`,
    ]);
  });
});

describe('workspace content checks (models and rooms)', () => {
  const code = {
    behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
    models: new Registry('simulation model', BUILT_IN_MODELS),
  };
  const problemsOf = (raw: RawContent) => {
    try {
      buildContent(raw, code);
    } catch (error) {
      if (error instanceof ContentError) return error.problems;
      throw error;
    }
    return [];
  };
  const content = (
    change: (raw: { experiments: Raw[]; items: { id: string; interactions: string[] }[] }) => void,
  ) => {
    const raw = withTitrationRig(structuredClone(bundledContent)) as unknown as {
      experiments: Raw[];
      items: { id: string; interactions: string[] }[];
    };
    // The titration and its stand as the contract tests start from: no workspace, no way in.
    raw.experiments = raw.experiments.map((e) =>
      (e as { id?: string }).id === 'acid-base-titration' ? plain(e) : e,
    );
    const stand = raw.items.find((i) => i.id === 'titration-stand')!;
    stand.interactions = stand.interactions.filter((i) => i !== 'open-workspace');
    change(raw);
    return raw as unknown as RawContent;
  };

  it('checks shown model variables against the model', () => {
    const raw = content((c) => {
      const i = c.experiments.findIndex((e) => e.id === 'acid-base-titration');
      const w = workspace();
      w.pieces[0]!.shows = [{ variable: 'nope' }] as never;
      c.experiments[i] = { ...c.experiments[i]!, presentation: '2d-workspace', workspace: w };
    });
    expect(problemsOf(raw)).toEqual([
      'experiments.acid-base-titration.workspace.pieces.0: shows unknown model variable "nope"',
    ]);
  });

  it('offers open-workspace only for an experiment with a workspace', () => {
    const raw = content((c) => {
      c.items.find((i) => i.id === 'titration-stand')!.interactions.push('open-workspace');
    });
    expect(problemsOf(raw)).toEqual([
      'rooms.chemistry-lab.placements.titration.params[open-workspace]: "acid-base-titration" has no workspace',
    ]);
    const fine = content((c) => {
      c.items.find((i) => i.id === 'titration-stand')!.interactions.push('open-workspace');
      const i = c.experiments.findIndex((e) => e.id === 'acid-base-titration');
      c.experiments[i] = {
        ...c.experiments[i]!,
        presentation: '2d-workspace',
        workspace: workspace(),
      };
    });
    expect(problemsOf(fine)).toEqual([]);
  });
});
