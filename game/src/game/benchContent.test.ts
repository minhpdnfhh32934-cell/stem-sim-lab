import { describe, expect, it } from 'vitest';
import { Registry } from '../core/Registry';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { BUILT_IN_MODELS } from '../simulation/models';
import { layoutProblems } from '../world/layout';
import { benchFixture, ohmModel } from './benchFixture';
import { buildContent, ContentError, type RawContent } from './content';

// The content rules of bench stations, on the fixture (benchFixture.ts: a bench in no content
// file): it is a station like any other, its desk holds four dials, and its rig's anchor stays
// in its room.

const code = {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', [...BUILT_IN_MODELS, ohmModel]),
};

function problemsOf(raw: RawContent): readonly string[] {
  try {
    buildContent(raw, code);
  } catch (error) {
    if (error instanceof ContentError) return error.problems;
    throw error;
  }
  return [];
}

type RawExperiment = { id: string; parameters: object[] };
const ohm = (raw: RawContent) =>
  (raw.experiments as RawExperiment[]).find((e) => e.id === 'fixture-ohm')!;
const board = (raw: RawContent) =>
  (raw.items as { id: string; interactions: string[]; bench?: { top: number[] } }[]).find(
    (i) => i.id === 'fixture-board',
  )!;
const WHERE = 'rooms.physics-lab.placements.demo-board-station';

describe('bench stations in content', () => {
  it('takes a bench as the station its controls name', () => {
    expect(problemsOf(benchFixture())).toEqual([]);
  });

  it('needs the bench geometry for the bench behaviour, and as the station of a control', () => {
    const raw = benchFixture();
    delete board(raw).bench;
    expect(problemsOf(raw)).toEqual([
      'items.fixture-board.interactions: "bench" needs the item\'s bench geometry',
      ...['dial-resistance', 'dial-voltage', 'run', 'stop', 'reset', 'monitor'].map(
        (id) =>
          `rooms.physics-lab.placements.demo-${id}.params: "demo-board-station" is not an experiment apparatus`,
      ),
    ]);
  });

  it('keeps a bench desk to four dials: it lists every parameter', () => {
    const raw = benchFixture();
    const e = ohm(raw);
    e.parameters.push({ ...e.parameters[1], id: 'u2' }, { ...e.parameters[1], id: 'u3' });
    expect(problemsOf(raw)).toEqual([
      `${WHERE}: "fixture-ohm" overfills its desk: 4 dials, 6 rows`,
    ]);
    e.parameters.pop(); // four
    expect(problemsOf(raw)).toEqual([]);
  });

  it('keeps a bench desk to six settings: its parameters, then its shown inputs', () => {
    const raw = benchFixture();
    const e = ohm(raw) as RawExperiment & {
      inputs?: Record<string, object>;
      initialConditions?: Record<string, number>;
    };
    e.parameters.push({ ...e.parameters[1], id: 'u2' }); // four
    const shown = { symbol: 'x', unit: 'm' };
    e.initialConditions = { ...e.initialConditions, a: 0, b: 0, c: 0 };
    e.inputs = { ...e.inputs, a: shown, b: shown, c: shown };
    expect(problemsOf(raw)).toEqual([
      `${WHERE}: "fixture-ohm" overfills its desk: 4 dials, 6 rows`,
    ]);
    e.inputs.c = { ...shown, desk: false }; // four and two on the desk, c in the panel only
    expect(problemsOf(raw)).toEqual([]);
  });

  it('keeps the point its rig stands on inside its room (P3c)', () => {
    const raw = benchFixture();
    board(raw).bench!.top = [0, 4.5, 0]; // 0.9 m + 4.5 m: 0.4 m above the lab's 5 m ceiling (U-2)
    const c = buildContent(raw, code);
    const problems = layoutProblems({
      scenes: c.scenes.all(),
      roomOf: (id) => c.rooms.tryGet(id),
      itemOf: (id) => c.items.tryGet(id),
      maxCharacterHeight: 2,
      arrivals: [],
    });
    expect(problems.filter((p) => p.startsWith('P3c'))).toEqual([
      `P3c ${WHERE}: its bench.top is 0.4 m outside the room`,
    ]);
  });
});
