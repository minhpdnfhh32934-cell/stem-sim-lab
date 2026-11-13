import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { resolveConfig } from '../core/config';
import { Registry } from '../core/Registry';
import { bundledContent } from '../content';
import { routeBetween } from '../game/catalog';
import { buildContent, type Content, type RawContent } from '../game/content';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { ItemDefinitionSchema } from '../gameplay/item';
import { BUILT_IN_MODELS } from '../simulation/models';
import { RoomDefinitionSchema, SceneDefinitionSchema } from './definitions';
import {
  CONTACT_TOLERANCE,
  EPS,
  HEAD_CLEARANCE,
  type LayoutInput,
  layoutProblems,
  MIN_OPENING_WIDTH,
  PANEL_EMBED,
  PASSAGE_DEPTH,
} from './layout';
import { WALL_THICKNESS as T } from './roomGeometry';

const shipped = buildContent(bundledContent, {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', BUILT_IN_MODELS),
});
const START = resolveConfig().game.newGameScene;
const TALLEST = Math.max(...shipped.characters.all().map((c) => c.appearance.heightM));

/** Placements whose item offers travel (doors), with the arrival door they name, if any. */
const travellers = (c: Content) =>
  c.rooms
    .all()
    .flatMap((room) =>
      room.placements
        .filter((p) => c.items.tryGet(p.item)?.interactions.includes('travel'))
        .map((p) => ({ where: `rooms.${room.id}.placements.${p.id}`, arrival: p.params.arrival })),
    );

const inputOf = (c: Content): LayoutInput => ({
  scenes: c.scenes.all(),
  roomOf: (id) => c.rooms.tryGet(id),
  itemOf: (id) => c.items.tryGet(id),
  maxCharacterHeight: TALLEST,
  arrivals: travellers(c).flatMap(({ arrival }) => (typeof arrival === 'string' ? [arrival] : [])),
});

/** P6: every world scene is reached through doors from the new-game scene, and leads back. */
function routeProblems(c: Content): string[] {
  const problems: string[] = [];
  for (const scene of c.scenes.all()) {
    if (scene.kind !== 'world') continue;
    if (!routeBetween(c, START, scene.id)) {
      problems.push(`P6 scenes.${scene.id}: no door route from "${START}"`);
    }
    if (!routeBetween(c, scene.id, START)) {
      problems.push(`P6 scenes.${scene.id}: no door route back to "${START}"`);
    }
  }
  return problems;
}

/** P7: every placement that offers travel names the door the player comes out of. */
const arrivalProblems = (c: Content): string[] =>
  travellers(c)
    .filter(({ arrival }) => typeof arrival !== 'string' || arrival === '')
    .map(({ where }) => `P7 ${where}: offers travel but names no arrival door`);

// Fixtures: the bundled content, cloned and broken in memory, then parsed by its schemas only
// (the boot checks are not run on it).
interface RawOpening {
  wall: string;
  center: number;
  width: number;
  height: number;
}
interface RawRoom {
  id: string;
  displayName: string;
  bounds: { min: number[]; max: number[] };
  openings?: RawOpening[];
  placements: { id: string; position: number[]; params?: Record<string, unknown> }[];
}
interface RawItem {
  id: string;
  interactions?: string[];
  pendulum?: { pivot: number[] };
}
type Breaker = (raw: RawContent) => void;

const roomIn = (raw: RawContent, id: string) => (raw.rooms as RawRoom[]).find((r) => r.id === id)!;
/** The hub's east wall face (x); fixtures put an annex beyond it. */
const E = roomIn(bundledContent, 'simlab-hub').bounds.max[0]!;
const placementIn = (raw: RawContent, room: string, id: string) =>
  roomIn(raw, room).placements.find((p) => p.id === id)!;
const itemIn = (raw: RawContent, id: string) => (raw.items as RawItem[]).find((i) => i.id === id)!;

function move(raw: RawContent, room: string, id: string, position: number[]) {
  placementIn(raw, room, id).position = position;
}

/** Changes the doorway both rooms of a pair list (their only opening). */
function setDoorway(raw: RawContent, rooms: string[], change: Partial<RawOpening>) {
  for (const id of rooms) Object.assign(roomIn(raw, id).openings![0]!, change);
}

/** The teacher's bathroom, `depth` m deep behind its doorway and emptied. */
function shrinkBathroom(raw: RawContent, depth: number) {
  const bathroom = roomIn(raw, 'teacher-bathroom');
  bathroom.bounds.max[2] = bathroom.bounds.min[2]! + depth;
  bathroom.placements = [];
}

/** Adds room "annex" to the hub's scene, joined to the hub's east wall when a doorway is given. */
function addAnnex(
  raw: RawContent,
  min: number[],
  max: number[],
  doorway?: Omit<RawOpening, 'wall'>,
) {
  (raw.rooms as RawRoom[]).push({
    id: 'annex',
    displayName: 'Annex',
    bounds: { min, max },
    openings: doorway ? [{ wall: 'west', ...doorway }] : [],
    placements: [],
  });
  if (doorway) roomIn(raw, 'simlab-hub').openings = [{ wall: 'east', ...doorway }];
  (raw.scenes as { id: string; rooms?: string[] }[])
    .find((s) => s.id === 'simlab-hub')!
    .rooms!.push('annex');
}

/** Every problem of the bundled content after `breakIt`: P1–P5 and P8, then P6, then P7. */
function problemsAfter(breakIt: Breaker): string[] {
  const raw = structuredClone(bundledContent);
  breakIt(raw);
  const c: Content = {
    ...shipped,
    items: new Registry('item', z.array(ItemDefinitionSchema).parse(raw.items)),
    rooms: new Registry('room', z.array(RoomDefinitionSchema).parse(raw.rooms)),
    scenes: new Registry('scene', z.array(SceneDefinitionSchema).parse(raw.scenes)),
  };
  return [...layoutProblems(inputOf(c)), ...routeProblems(c), ...arrivalProblems(c)];
}

describe('the shipped content', () => {
  const tightest: Record<string, number> = {};
  const problems = layoutProblems(inputOf(shipped), tightest);
  const RULES: [rule: string, what: string, measures: string[]][] = [
    ['P1', 'the rooms of a scene are at least a wall apart', ['P1']],
    [
      'P2',
      'every opening lets the tallest character through',
      ['P2 width', 'P2 height', 'P2 depth'],
    ],
    ['P3', 'solids, panels and apparatus anchors stay inside their rooms', ['P3a', 'P3b', 'P3c']],
    ['P4', 'dynamic bodies start free of other solids and of the room shells', ['P4', 'P4 shell']],
    ['P5', 'no solid stands in a doorway passage', ['P5']],
    ['P8', 'every room is reached from the spawn or an arrival door', []],
  ];
  // The title carries the tightest value each rule measured (m; negative: within its allowance).
  const tightestOf = (measures: string[]) =>
    measures
      .map((rule) => {
        const value = tightest[rule];
        return `${rule} ${value === undefined ? 'not measured' : +value.toFixed(7)}`;
      })
      .join(', ') || 'none';

  it.each(
    RULES.map(([rule, what, measures]): [string, string, string, string[]] => [
      rule,
      what,
      tightestOf(measures),
      measures,
    ]),
  )('%s: %s (tightest, m: %s)', (rule, _what, _tightest, measures) => {
    expect(problems.filter((p) => p.startsWith(rule))).toEqual([]);
    for (const measure of measures) expect(tightest[measure], measure).toBeDefined();
  });

  it('P6: every world scene is reached through doors from the new-game scene, and leads back', () => {
    expect(routeProblems(shipped)).toEqual([]);
  });

  it('P7: every placement that offers travel names its arrival door', () => {
    expect(arrivalProblems(shipped)).toEqual([]);
  });
});

describe('malformed layouts are reported by their rule', () => {
  const fixtures: [string, Breaker, string][] = [
    [
      'P1: a room inside the hub',
      (raw) => addAnnex(raw, [4, 0, -2], [8, 3, 2]),
      'P1 scenes.simlab-hub: rooms "simlab-hub" and "annex"',
    ],
    [
      'P1: a room 0.1 m from the hub',
      (raw) => addAnnex(raw, [E + 0.1, 0, -1.5], [E + 4, 3, 2.5]),
      'P1 scenes.simlab-hub: rooms "simlab-hub" and "annex"',
    ],
    [
      'P2: a doorway 0.5 m wide',
      (raw) => setDoorway(raw, ['teacher-room', 'teacher-bathroom'], { width: 0.5 }),
      'P2 width rooms.teacher-room.openings.0',
    ],
    [
      'P2: a doorway 1.7 m high',
      (raw) => setDoorway(raw, ['preparation-room', 'cleanroom-corridor'], { height: 1.7 }),
      'P2 height rooms.preparation-room.openings.0',
    ],
    [
      'P2: a room 0.6 m deep behind its doorway',
      (raw) => shrinkBathroom(raw, 0.6),
      'P2 depth rooms.teacher-bathroom.openings.0',
    ],
    [
      'P3a: the bed 0.1 m into a wall',
      (raw) => move(raw, 'preparation-room', 'bed', [-2.6, 0, 1.8]),
      'P3a rooms.preparation-room.placements.bed',
    ],
    [
      'P3a: the fume hood through the ceiling',
      (raw) => move(raw, 'chemistry-lab', 'fume-hood', [3, 2.4, -3.5]),
      'P3a rooms.chemistry-lab.placements.fume-hood',
    ],
    [
      'P3a: the bench below the floor',
      (raw) => move(raw, 'chemistry-lab', 'bench', [0, -0.1, -1.5]),
      'P3a rooms.chemistry-lab.placements.bench',
    ],
    [
      'P3b: a ceiling light 1 m past a wall',
      (raw) => move(raw, 'physics-lab', 'light-1', [-4.5, 4.94, 0]),
      'P3b rooms.physics-lab.placements.light-1',
    ],
    [
      'P3c: the pendulum pivot above the ceiling',
      (raw) => {
        itemIn(raw, 'pendulum-stand').pendulum!.pivot = [0, 4.6, 0];
      },
      'P3c rooms.pendulum-bay.placements.pendulum: its pendulum.pivot',
    ],
    [
      'P4: the microscope 100 mm into the bench',
      (raw) => move(raw, 'biology-lab', 'microscope', [-9.286, 0.8, -3.421]),
      'P4 rooms.biology-lab.placements.microscope: overlaps biology-lab/bench',
    ],
    [
      'P4: two balls overlapping by 40 mm',
      (raw) => move(raw, 'projectile-range', 'ball-2', [-3.83, 0.8, 9.5]),
      'P4 rooms.projectile-range.placements.ball-1: overlaps projectile-range/ball-2',
    ],
    [
      'P4: the desk lamp inside the closed PPE cabinet (in front of its open box)',
      (raw) => move(raw, 'preparation-room', 'desk-lamp', [-2.5, 0, -1.2]),
      'P4 rooms.preparation-room.placements.desk-lamp: overlaps preparation-room/wardrobe',
    ],
    [
      // Closed, a hinged door stands in its passage by design; swung open it must not.
      'P5: the washroom door moved along its wall, its open leaf in the doorway',
      (raw) => move(raw, 'teacher-room', 'door', [-1.2, 0, 2.45]),
      'P5 rooms.teacher-room.openings.0: teacher-room/door when open reaches',
    ],
    [
      'P4: the desk lamp in a wall',
      (raw) => move(raw, 'preparation-room', 'desk-lamp', [2.95, 0.75, -2.55]),
      'P4 shell rooms.preparation-room.placements.desk-lamp: overlaps the wall of room "preparation-room"',
    ],
    [
      'P5: a chair in a doorway passage',
      (raw) => move(raw, 'preparation-room', 'chair', [0, 0, -2.4]),
      'P5 rooms.preparation-room.openings.0: preparation-room/chair',
    ],
    [
      'P6: a scene no door leads to',
      (raw) => {
        Object.assign(placementIn(raw, 'simlab-hub', 'door-biology').params!, {
          targetScene: 'physics-lab',
          arrival: 'physics-lab/door-hub',
        });
      },
      'P6 scenes.biology-lab: no door route from "preparation-room"',
    ],
    [
      'P6: a scene whose only door leads back into it',
      (raw) => {
        Object.assign(placementIn(raw, 'chemistry-lab', 'door-hub').params!, {
          targetScene: 'chemistry-lab',
          arrival: 'chemistry-lab/door-hub',
        });
      },
      'P6 scenes.chemistry-lab: no door route back to "preparation-room"',
    ],
    [
      'P7: a door without its arrival',
      (raw) => {
        delete placementIn(raw, 'simlab-hub', 'door-chemistry').params!.arrival;
      },
      'P7 rooms.simlab-hub.placements.door-chemistry',
    ],
    [
      'P7: a travel item that is not a door, without an arrival',
      (raw) => {
        itemIn(raw, 'notice-board').interactions!.push('travel');
        placementIn(raw, 'preparation-room', 'notice-board').params = {
          targetScene: 'teacher-room',
        };
      },
      'P7 rooms.preparation-room.placements.notice-board',
    ],
    [
      'P8: a room no opening leads into',
      (raw) => {
        const lab = roomIn(raw, 'physics-lab');
        lab.openings = lab.openings!.filter((o) => o.wall !== 'north');
        roomIn(raw, 'pendulum-bay').openings = [];
      },
      'P8 scenes.physics-lab: room "pendulum-bay"',
    ],
  ];

  it.each(fixtures)('%s', (_name, breakIt, problem) => {
    expect(problemsAfter(breakIt)).toContainEqual(expect.stringContaining(problem));
  });
});

// Just inside and just outside each allowance: the value goes past its limit by 90 % and by 110 %
// of the allowance.
describe.each<[string, (raw: RawContent, past: number) => void, string, number]>([
  [
    'P1: a room nearer the hub than a wall',
    (raw, past) => addAnnex(raw, [E + T - past, 0, -1.5], [E + 4, 3, 2.5]),
    'P1 scenes.simlab-hub: rooms "simlab-hub" and "annex"',
    EPS,
  ],
  [
    'P2: a doorway narrower than MIN_OPENING_WIDTH',
    (raw, past) =>
      setDoorway(raw, ['teacher-room', 'teacher-bathroom'], { width: MIN_OPENING_WIDTH - past }),
    'P2 width rooms.teacher-room.openings.0',
    EPS,
  ],
  [
    'P2: a doorway lower than the tallest character + HEAD_CLEARANCE',
    (raw, past) =>
      setDoorway(raw, ['preparation-room', 'cleanroom-corridor'], {
        height: TALLEST + HEAD_CLEARANCE - past,
      }),
    'P2 height rooms.preparation-room.openings.0',
    EPS,
  ],
  [
    'P2: a room shallower than PASSAGE_DEPTH behind its doorway',
    (raw, past) => shrinkBathroom(raw, PASSAGE_DEPTH - past),
    'P2 depth rooms.teacher-bathroom.openings.0',
    EPS,
  ],
  [
    'P3a: the bed into the west wall',
    (raw, past) => move(raw, 'preparation-room', 'bed', [-2.5 - past, 0, 1.8]),
    'P3a rooms.preparation-room.placements.bed',
    CONTACT_TOLERANCE,
  ],
  [
    'P3b: a ceiling light set into the ceiling',
    (raw, past) => move(raw, 'physics-lab', 'light-1', [-2.5, 4.94 + past, 0]),
    'P3b rooms.physics-lab.placements.light-1',
    PANEL_EMBED,
  ],
  [
    'P4: the microscope sunk into the bench',
    (raw, past) => move(raw, 'biology-lab', 'microscope', [-9.286, 0.9 - past, -3.421]),
    'P4 rooms.biology-lab.placements.microscope: overlaps biology-lab/bench',
    CONTACT_TOLERANCE,
  ],
  [
    'P5: a chair at the edge of a doorway passage',
    // The passage reaches PASSAGE_DEPTH in front of the north wall (z −3); the chair is 0.45 deep.
    (raw, past) =>
      move(raw, 'preparation-room', 'chair', [0, 0, -3 + PASSAGE_DEPTH + 0.225 - past]),
    'P5 rooms.preparation-room.openings.0: preparation-room/chair',
    CONTACT_TOLERANCE,
  ],
])('%s', (_name, breakIt, problem, allowance) => {
  const past = (share: number) => problemsAfter((raw) => breakIt(raw, share * allowance));

  it('is accepted 90 % of its allowance past the limit', () => {
    expect(past(0.9)).not.toContainEqual(expect.stringContaining(problem));
  });

  it('is reported 110 % of its allowance past the limit', () => {
    expect(past(1.1)).toContainEqual(expect.stringContaining(problem));
  });
});

describe('well-formed layouts pass every rule', () => {
  it('a room one wall from the hub, joined by mirrored 1.0 × 2.1 m doorways', () => {
    expect(
      problemsAfter((raw) =>
        addAnnex(raw, [E + T, 0, -1.5], [E + 4, 3, 2.5], { center: 0.5, width: 1, height: 2.1 }),
      ),
    ).toEqual([]);
  });

  it('a ceiling light set 100 mm into the ceiling', () => {
    expect(problemsAfter((raw) => move(raw, 'physics-lab', 'light-1', [-2.5, 5.04, 0]))).toEqual(
      [],
    );
  });
});
