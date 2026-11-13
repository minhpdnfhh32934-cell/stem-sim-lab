import { describe, expect, it } from 'vitest';
import { Registry } from '../core/Registry';
import { routeBetween, type RouteStep, subjectCatalog, topicCatalog } from './catalog';
import { bootTestGame } from './testing';

const ids = (catalog: ReturnType<typeof topicCatalog>) =>
  catalog.map(({ topic, experiments }) => [
    topic.id,
    experiments.map(({ experiment, places }) => [
      experiment.id,
      places.map(({ scene, room }) => `${scene.id}/${room.id}`),
    ]),
  ]);

describe('topic catalog', () => {
  it('lists each topic with its experiments and the rooms their stations stand in', async () => {
    const { game } = await bootTestGame();
    await game.loadLab(); // the experiments and topics are the lab pack's
    expect(ids(topicCatalog(game.content))).toEqual([
      [
        'kinematics',
        [
          ['free-fall', ['physics-lab/physics-lab']],
          ['projectile-motion', ['physics-lab/projectile-range']],
          ['measuring-speed', ['physics-lab/physics-lab']],
          ['newtons-second-law', ['physics-lab/physics-lab']],
        ],
      ],
      [
        'dynamics',
        [
          ['newtons-second-law', ['physics-lab/physics-lab']],
          ['atwood-machine', ['physics-lab/physics-lab']],
          ['hookes-law', ['physics-lab/physics-lab']],
          ['inclined-plane', ['physics-lab/physics-lab']],
          ['circular-motion', ['physics-lab/pendulum-bay']],
          ['force-composition', ['physics-lab/physics-lab']],
          ['moment-of-force', ['physics-lab/physics-lab']],
        ],
      ],
      [
        'conservation-laws',
        [
          ['mechanical-energy', ['physics-lab/physics-lab']],
          ['collisions', ['physics-lab/physics-lab']],
        ],
      ],
      [
        'fluids',
        [
          ['buoyancy', ['physics-lab/physics-lab']],
          ['liquid-pressure', ['physics-lab/physics-lab']],
        ],
      ],
      [
        'oscillations-and-waves',
        [
          ['pendulum', ['physics-lab/pendulum-bay']],
          ['resonance', ['physics-lab/pendulum-bay']],
          ['sound-frequency', ['physics-lab/waves-optics']],
          ['ripple-tank', ['physics-lab/waves-optics']],
          ['standing-wave', ['physics-lab/waves-optics']],
          ['speed-of-sound', ['physics-lab/waves-optics']],
        ],
      ],
      [
        'electricity',
        [
          ['electric-field', ['physics-lab/waves-optics']],
          ['ohms-law', ['physics-lab/physics-lab']],
          ['electrical-power', ['physics-lab/physics-lab']],
          ['capacitor', ['physics-lab/physics-lab']],
          ['cell-emf', ['physics-lab/physics-lab']],
        ],
      ],
      [
        'optics',
        [
          ['refraction', ['physics-lab/waves-optics']],
          ['reflection', ['physics-lab/waves-optics']],
          ['converging-lens', ['physics-lab/waves-optics']],
          ['double-slit', ['physics-lab/waves-optics']],
        ],
      ],
      [
        'thermal-physics',
        [
          ['specific-heat', ['physics-lab/physics-lab']],
          ['latent-heat', ['physics-lab/physics-lab']],
        ],
      ],
      [
        'ideal-gases',
        [
          ['boyle', ['physics-lab/physics-lab']],
          ['charles', ['physics-lab/physics-lab']],
        ],
      ],
      [
        'magnetism',
        [
          ['magnetic-force', ['physics-lab/physics-lab']],
          ['induction', ['physics-lab/physics-lab']],
          ['ac-generator', ['physics-lab/pendulum-bay']],
        ],
      ],
      ['nuclear-physics', [['radioactive-decay', ['physics-lab/pendulum-bay']]]],
      [
        'acids-and-bases',
        [
          ['acid-base-titration', ['chemistry-lab/chemistry-lab']],
          ['ph-measurement', ['chemistry-lab/chemistry-annex']],
        ],
      ],
      [
        'solutions',
        [
          ['dilution', ['chemistry-lab/chemistry-lab']],
          ['solubility', ['chemistry-lab/chemistry-lab']],
        ],
      ],
      [
        'reaction-kinetics',
        [
          ['reaction-rate', ['chemistry-lab/chemistry-lab']],
          ['collision-theory', ['chemistry-lab/chemistry-annex']],
        ],
      ],
      ['states-of-matter', [['heating-curve', ['chemistry-lab/chemistry-lab']]]],
      ['ions-and-precipitation', [['precipitation', ['chemistry-lab/chemistry-annex']]]],
      ['separating-mixtures', [['separation', ['chemistry-lab/chemistry-annex']]]],
      ['energy-in-reactions', [['neutralisation', ['chemistry-lab/chemistry-annex']]]],
      ['chemical-equilibrium', [['le-chatelier', ['chemistry-lab/chemistry-annex']]]],
      [
        'electrochemistry',
        [
          ['galvanic-cell', ['chemistry-lab/chemistry-annex']],
          ['electrolysis', ['chemistry-lab/chemistry-annex']],
          ['halogens', ['chemistry-lab/chemistry-annex']],
          ['corrosion', ['chemistry-lab/chemistry-annex']],
        ],
      ],
      ['organic-chemistry', [['saponification', ['chemistry-lab/chemistry-annex']]]],
      [
        'particle-models',
        [
          ['gas-speeds', ['chemistry-lab/chemistry-annex']],
          ['atomic-structure', ['chemistry-lab/chemistry-annex']],
          ['orbitals', ['chemistry-lab/chemistry-annex']],
          ['molecule-shapes', ['chemistry-lab/chemistry-annex']],
          ['balancing', ['chemistry-lab/chemistry-annex']],
        ],
      ],
      [
        'cells',
        [
          ['microscope', ['biology-lab/biology-lab']],
          ['cell-division', ['biology-lab/biology-annex']],
        ],
      ],
      ['biological-molecules', [['food-tests', ['biology-lab/biology-lab']]]],
      [
        'membrane-transport',
        [
          ['osmosis', ['biology-lab/biology-lab']],
          ['agar-diffusion', ['biology-lab/biology-annex']],
          ['plasmolysis', ['biology-lab/biology-annex']],
        ],
      ],
      ['enzymes', [['enzyme-activity', ['biology-lab/biology-lab']]]],
      ['photosynthesis', [['photosynthesis', ['biology-lab/biology-lab']]]],
      ['water-in-plants', [['transpiration', ['biology-lab/biology-lab']]]],
      [
        'respiration',
        [
          ['seed-respiration', ['biology-lab/biology-lab']],
          ['fermentation', ['biology-lab/biology-annex']],
        ],
      ],
      ['inheritance', [['mendelian-cross', ['biology-lab/biology-lab']]]],
      [
        'ecology',
        [
          ['mark-recapture', ['biology-lab/biology-lab']],
          ['logistic-growth', ['biology-lab/biology-annex']],
          ['predator-prey', ['biology-lab/biology-annex']],
        ],
      ],
      [
        'genes-and-proteins',
        [
          ['protein-synthesis', ['biology-lab/biology-annex']],
          ['dna-extraction', ['biology-lab/biology-annex']],
          ['karyotype', ['biology-lab/biology-annex']],
        ],
      ],
      ['evolution', [['population-genetics', ['biology-lab/biology-annex']]]],
      ['human-physiology', [['heart-rate', ['biology-lab/biology-annex']]]],
      ['plant-responses', [['tropism', ['biology-lab/biology-annex']]]],
    ]);
  });

  it('gives an experiment without a station no place: it is not playable', async () => {
    const { game } = await bootTestGame();
    await game.loadLab(); // the experiments and topics are the lab pack's
    const rooms = game.content.rooms.all().filter((r) => r.id !== 'projectile-range');
    const content = { ...game.content, rooms: new Registry('room', rooms) };
    expect(ids(topicCatalog(content))[0]).toEqual([
      'kinematics',
      [
        ['free-fall', ['physics-lab/physics-lab']],
        ['projectile-motion', []],
        ['measuring-speed', ['physics-lab/physics-lab']],
        ['newtons-second-law', ['physics-lab/physics-lab']],
      ],
    ]);
  });
});

describe('subject catalog', () => {
  it('groups the topics by subject, named by its laboratory; a planned laboratory has none', async () => {
    const { game } = await bootTestGame();
    await game.loadLab(); // the experiments and topics are the lab pack's
    const subjects = subjectCatalog(game.content);
    expect(subjects.map((s) => [s.laboratory.id, s.topics.map((t) => t.topic.id)])).toEqual([
      [
        'physics',
        [
          'kinematics',
          'dynamics',
          'conservation-laws',
          'fluids',
          'oscillations-and-waves',
          'electricity',
          'optics',
          'thermal-physics',
          'ideal-gases',
          'magnetism',
          'nuclear-physics',
        ],
      ],
      [
        'chemistry',
        [
          'acids-and-bases',
          'solutions',
          'reaction-kinetics',
          'states-of-matter',
          'ions-and-precipitation',
          'separating-mixtures',
          'energy-in-reactions',
          'chemical-equilibrium',
          'electrochemistry',
          'organic-chemistry',
          'particle-models',
        ],
      ],
      [
        'biology',
        [
          'cells',
          'biological-molecules',
          'membrane-transport',
          'enzymes',
          'photosynthesis',
          'water-in-plants',
          'respiration',
          'inheritance',
          'ecology',
          'genes-and-proteins',
          'evolution',
          'human-physiology',
          'plant-responses',
        ],
      ],
    ]);
  });

  it('lists every topic of the content exactly once, with its experiments unchanged', async () => {
    const { game } = await bootTestGame();
    await game.loadLab(); // the experiments and topics are the lab pack's
    const listed = subjectCatalog(game.content).flatMap((s) => s.topics);
    expect(ids(listed)).toEqual(ids(topicCatalog(game.content)));
  });
});

describe('route between scenes', () => {
  const steps = (route: RouteStep[] | null) =>
    route?.map((s) => (s.kind === 'scene' ? s.scene.id : `[${s.procedure.id}]`)) ?? null;

  it('goes through the fewest doors, naming the procedure that gates one', async () => {
    const { game } = await bootTestGame();
    const way = (from: string, to: string) => steps(routeBetween(game.content, from, to));
    expect(way('preparation-room', 'physics-lab')).toEqual([
      'preparation-room',
      '[cleanroom-entry]',
      'simlab-hub',
      'physics-lab',
    ]);
    expect(way('teacher-room', 'physics-lab')).toEqual([
      'teacher-room',
      'preparation-room',
      '[cleanroom-entry]',
      'simlab-hub',
      'physics-lab',
    ]);
    // The way out passes no entrance, so no procedure.
    expect(way('physics-lab', 'preparation-room')).toEqual([
      'physics-lab',
      'simlab-hub',
      'preparation-room',
    ]);
    expect(way('physics-lab', 'physics-lab')).toEqual(['physics-lab']);
  });

  it('finds no way when no door leads there', async () => {
    const { game } = await bootTestGame();
    const rooms = game.content.rooms
      .all()
      .map((r) =>
        r.id === 'simlab-hub'
          ? { ...r, placements: r.placements.filter((p) => p.id !== 'door-physics') }
          : r,
      );
    const content = { ...game.content, rooms: new Registry('room', rooms) };
    expect(routeBetween(content, 'preparation-room', 'physics-lab')).toBeNull();
  });

  it("reaches every station's scene from where a new game starts", async () => {
    const { game } = await bootTestGame();
    await game.loadLab(); // the experiments and topics are the lab pack's
    const start = game.config.game.newGameScene;
    const scenes = topicCatalog(game.content).flatMap(({ experiments }) =>
      experiments.flatMap(({ places }) => places.map(({ scene }) => scene.id)),
    );
    expect(scenes.length).toBeGreaterThan(0);
    for (const scene of scenes)
      expect(routeBetween(game.content, start, scene), scene).not.toBeNull();
  });
});

// A laboratory with no experiments says so where a player meets it — on every door into it and on
// a sign inside, in English and in Vietnamese — and a laboratory with experiments never does.
describe('planned laboratories', () => {
  const sayNone = (english: unknown, vietnamese: unknown) =>
    typeof english === 'string' &&
    english.toLowerCase().includes('no experiments yet') &&
    typeof vietnamese === 'string' &&
    vietnamese.toLowerCase().includes('chưa có thí nghiệm');

  it('are labelled on their doors and inside; laboratories with experiments are not', async () => {
    const { content } = (await bootTestGame()).game;
    const placements = content.rooms.all().flatMap((room) => room.placements);
    for (const lab of content.laboratories.all()) {
      const planned = lab.experiments.length === 0;
      const scenes = content.scenes
        .all()
        .filter((s) => s.kind === 'world' && s.rooms.some((id) => lab.rooms.includes(id)))
        .map((s) => s.id);
      const doors = placements.filter((p) => scenes.includes(String(p.params.targetScene)));
      expect(doors.length, lab.id).toBeGreaterThan(0);
      for (const door of doors) {
        expect(sayNone(door.params.label, door.vi?.label), `${lab.id}: ${door.id}`).toBe(planned);
      }
      const signs = lab.rooms
        .flatMap((id) => content.rooms.get(id).placements)
        .map((p) => content.items.get(p.item).visual.label)
        .filter((label) => label !== undefined);
      expect(signs.some((label) => sayNone(label.text, label.vi?.text), lab.id)).toBe(planned);
    }
  });
});
