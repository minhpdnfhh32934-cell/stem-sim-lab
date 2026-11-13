import { describe, expect, it } from 'vitest';
import { Registry } from '../core/Registry';
import { bundledContent } from '../content';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { BUILT_IN_MODELS } from '../simulation/models';
import { buildContent, ContentError, type RawContent } from './content';

const code = {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', BUILT_IN_MODELS),
};

const clone = (): RawContent => structuredClone(bundledContent);

function problemsOf(raw: RawContent): readonly string[] {
  try {
    buildContent(raw, code);
  } catch (error) {
    if (error instanceof ContentError) return error.problems;
    throw error;
  }
  return [];
}

describe('content', () => {
  it('ships valid, fully cross-referenced content', () => {
    const content = buildContent(bundledContent, code);
    // The cast of the character page: four men and four women, the first two the oldest saves'.
    expect(
      content.characters
        .all()
        .map((c) => c.gender)
        .sort(),
    ).toEqual([...Array<string>(4).fill('female'), ...Array<string>(4).fill('male')]);
    expect(
      content.characters
        .all()
        .slice(0, 2)
        .map((c) => c.id),
    ).toEqual(['researcher-male', 'researcher-female']);
    // Builds differ: short and tall people; a broad, muscled man and a slim one; curvy women
    // (the hips well over the waist, a fuller bust) and others of an ordinary figure.
    const cast = content.characters.all().map((c) => c.appearance);
    expect(Math.min(...cast.map((a) => a.heightM))).toBeLessThan(1.55);
    expect(Math.max(...cast.map((a) => a.heightM))).toBeGreaterThan(1.82);
    const men = content.characters.all().filter((c) => c.gender === 'male');
    expect(men.some((c) => c.appearance.muscle >= 0.8 && c.appearance.build >= 1.2)).toBe(true);
    expect(men.some((c) => c.appearance.build <= 0.85)).toBe(true);
    const women = content.characters.all().filter((c) => c.gender === 'female');
    const curvy = (a: (typeof cast)[number]) => a.hipM - a.waistM >= 0.15 && a.bustM >= 0.04;
    expect(women.filter((c) => curvy(c.appearance)).length).toBe(2);
    expect(content.scenes.all().map((s) => s.id)).toEqual([
      'main-menu',
      'preparation-room',
      'teacher-room',
      'simlab-hub',
      'physics-lab',
      'chemistry-lab',
      'biology-lab',
    ]);
    expect(content.laboratories.all().map((l) => l.type)).toEqual([
      'physics',
      'chemistry',
      'biology',
    ]);
    expect(content.experiments.get('free-fall').model).toBe('kinematics.free-fall');
  });

  it('reports schema errors with the path to the bad value', () => {
    const raw = clone();
    (raw.items as { physical: { massKg: number } }[])[0]!.physical.massKg = -1;
    expect(problemsOf(raw)).toEqual([
      'items.0.physical.massKg: Too small: expected number to be >0',
    ]);
  });

  it('rejects nonsensical physical properties and shapes', () => {
    const raw = clone();
    const items = raw.items as {
      physical: Record<string, unknown>;
      visual: { shape: string; size: number[] };
    }[];
    Object.assign(items[0]!.physical, { friction: 3, linearDamping: -1, body: 'kinematic' });
    Object.assign(items[1]!.physical, { restitution: 1.5 });
    items[2]!.visual.size = [1.2, 0, 0.6];
    items[3]!.visual.size = [0.16, 0.4, 0.2]; // cylinder with an elliptic footprint
    const problems = problemsOf(raw);
    expect(problems).toHaveLength(6);
    for (const path of [
      'items.0.physical.body',
      'items.0.physical.friction',
      'items.0.physical.linearDamping',
      'items.1.physical.restitution',
      'items.2.visual.size.1',
      'items.3.visual.size',
    ]) {
      expect(problems.some((p) => p.startsWith(`${path}:`))).toBe(true);
    }
  });

  it('collects every broken cross-reference at once', () => {
    const raw = clone();
    const rooms = raw.rooms as {
      placements: { id: string; item: string; params: Record<string, unknown> }[];
    }[];
    rooms[0]!.placements[0]!.item = 'unicorn';
    rooms[0]!.placements.find((p) => p.id === 'door-teacher')!.params.targetScene = 'atlantis';
    (raw.laboratories as { rooms: string[] }[])[0]!.rooms = ['nowhere'];
    (raw.experiments as { model: string }[])[0]!.model = 'kinematics.warp-drive';
    (raw.items as { interactions: string[] }[])[0]!.interactions.push('teleport');
    expect(problemsOf(raw)).toEqual([
      'items.door.interactions: unknown behaviour "teleport"',
      'rooms.preparation-room.placements.bed: unknown item "unicorn"',
      'rooms.preparation-room.placements.door-teacher.params: unknown scene "atlantis"',
      'laboratories.physics.rooms: unknown room "nowhere"',
      'experiments.free-fall.model: unknown simulation model "kinematics.warp-drive"',
    ]);
  });

  it('validates behaviour parameters per placement', () => {
    const raw = clone();
    const rooms = raw.rooms as { placements: { id: string; params: Record<string, unknown> }[] }[];
    delete rooms[0]!.placements.find((p) => p.id === 'door-teacher')!.params.targetScene;
    expect(problemsOf(raw)[0]).toMatch(
      /^rooms\.preparation-room\.placements\.door-teacher\.params\[travel\]\.targetScene: /,
    );
  });

  it('rejects placements and spawns outside their rooms, and duplicate ids', () => {
    const raw = clone();
    const rooms = raw.rooms as { placements: { position: number[] }[] }[];
    rooms[0]!.placements[0]!.position = [50, 0, 0];
    (raw.scenes as { spawn?: { position: number[] } }[])[1]!.spawn!.position = [50, 0, 0];
    (raw.characters as { id: string }[])[1]!.id = 'researcher-male';
    expect(problemsOf(raw)).toEqual(['characters: duplicate id "researcher-male"']);
    (raw.characters as { id: string }[])[1]!.id = 'researcher-female';
    expect(problemsOf(raw)).toEqual([
      'rooms.preparation-room.placements.bed: position is outside the room bounds',
      "scenes.preparation-room.spawn: position is not inside any of the scene's rooms",
    ]);
  });

  it('carries in the inventory only small objects the hands can grab, never PPE', () => {
    const content = buildContent(bundledContent, code);
    const carried = content.items.all().filter((i) => i.inventory);
    expect(carried.map((i) => [i.id, i.inventory])).toEqual([
      ['test-paper', { stack: 1, decorative: false, virtual: true, ruled: true }],
      ['phone', { stack: 1, decorative: false, virtual: true, ruled: false }], // Phase E-2b
      ['steel-ball', { stack: 8, decorative: false, virtual: false, ruled: false }],
      ['microscope', { stack: 1, decorative: true, virtual: false, ruled: false }],
      ['projectile-ball', { stack: 8, decorative: false, virtual: false, ruled: false }],
    ]);

    const raw = clone();
    type RawItem = { id: string; inventory?: object; visual: { size: number[] } };
    const items = raw.items as RawItem[];
    const item = (id: string) => items.find((i) => i.id === id)!;
    item('desk').inventory = {}; // static, no grab
    item('lab-coat').inventory = {};
    item('desk-lamp').inventory = { stack: 2 }; // grabbable: fine
    item('microscope').visual.size = [0.25, 0.6, 0.3]; // half its diagonal: 0.36 m
    expect(problemsOf(raw)).toEqual([
      'items.desk.inventory: needs the "grab" interaction',
      'items.lab-coat.inventory: PPE is worn, never carried',
      // The lab pack's items come after the core's.
      'items.microscope.inventory: too big to carry: half its diagonal must be at most 0.3 m',
    ]);
    item('desk-lamp').inventory = { stack: 65 };
    expect(problemsOf(raw)).toEqual([
      'items.3.inventory.stack: Too big: expected number to be <=64',
    ]);
  });

  it('puts each room in one world scene', () => {
    const raw = clone();
    const scenes = raw.scenes as { id: string; rooms?: string[] }[];
    scenes.find((s) => s.id === 'physics-lab')!.rooms!.push('teacher-bathroom');
    expect(problemsOf(raw)).toContain(
      'scenes.physics-lab.rooms: "teacher-bathroom" is already in scene "teacher-room"',
    );
  });

  describe('translations', () => {
    /** Fields that hold player-facing text; ids, symbols and units are never translated. */
    const TEXT_FIELDS = new Set([
      'displayName',
      'description',
      'name',
      'label',
      'title',
      'note',
      'instruction',
      'message',
      'quantity',
      'excludes',
      'text',
      // The Explain view's summary (Phase X; its parts' 'role' is also a light's: not here), worked
      // examples and question banks (Phase Y).
      'summary',
      'question',
      'say',
      'stem',
      'explain',
      'advice',
    ]);

    /** Paths of text fields (with words in them) that have no Vietnamese beside them. */
    function untranslated(value: unknown, path: string): string[] {
      if (Array.isArray(value)) return value.flatMap((v, i) => untranslated(v, `${path}.${i}`));
      if (!value || typeof value !== 'object') return [];
      const fields = value as Record<string, unknown>;
      const vi = fields.vi as Record<string, unknown> | undefined;
      return Object.entries(fields).flatMap(([key, v]) => {
        if (key === 'vi') return [];
        // A placement translates its text parameters (a door's label) in its own `vi`.
        const scope = key === 'params' && typeof v === 'object' ? { ...v, vi } : v;
        if (!TEXT_FIELDS.has(key) || typeof v !== 'string') {
          return untranslated(scope, `${path}.${key}`);
        }
        return /\p{L}{2}/u.test(v) && typeof vi?.[key] !== 'string' ? [`${path}.${key}`] : [];
      });
    }

    it('ships every content text in Vietnamese too, and keeps it through validation', () => {
      expect(untranslated(bundledContent, 'content')).toEqual([]);
      const c = buildContent(bundledContent, code);
      const registries = [c.characters, c.items, c.rooms, c.laboratories, c.scenes];
      const parsed = [...registries, c.experiments, c.procedures, c.topics, c.questions].map((r) =>
        r.all(),
      );
      expect(untranslated(parsed, 'parsed')).toEqual([]);
    });

    it('rejects an empty translation, or one of a field the object does not translate', () => {
      const raw = clone();
      const characters = raw.characters as { vi: Record<string, string> }[];
      characters[0]!.vi = { displayName: '' };
      expect(problemsOf(raw)).toEqual([
        expect.stringMatching(/^characters\.0\.vi\.displayName: /) as string,
      ]);
      characters[0]!.vi = { displayName: 'Nhà nghiên cứu nam', gender: 'nam' };
      expect(problemsOf(raw)).toEqual([expect.stringMatching(/^characters\.0\.vi: /) as string]);
      characters[0]!.vi = { displayName: 'Nhà nghiên cứu nam' };
      (raw.strings as { vi: Record<string, string> }).vi['menu.newGame'] = '';
      expect(problemsOf(raw)).toEqual([
        expect.stringMatching(/^strings\.vi\.menu\.newGame: /) as string,
      ]);
    });

    it('covers result classes: each label needs its Vietnamese, which validation keeps', () => {
      const raw = clone();
      const experiments = raw.experiments as { id: string; results: Record<string, unknown>[] }[];
      const k = experiments.findIndex((e) => e.id === 'hookes-law');
      const classes = [
        { max: 5, label: 'Light' },
        { label: 'Heavy', vi: { label: 'Nặng' } },
      ];
      experiments[k]!.results[0]!.classes = classes;
      expect(untranslated(raw, 'content')).toEqual([
        `content.experiments.${k}.results.0.classes.0.label`,
      ]);
      Object.assign(classes[0]!, { vi: { label: 'Nhẹ' } });
      expect(untranslated(raw, 'content')).toEqual([]);
      const parsed = buildContent(raw, code).experiments.get('hookes-law').results[0]?.classes;
      expect(parsed?.map((c) => c.vi?.label)).toEqual(['Nhẹ', 'Nặng']);
      expect(untranslated(parsed, 'parsed')).toEqual([]);
    });
  });

  describe('topics', () => {
    interface RawTopic {
      id: string;
      subject: string;
      experiments: string[];
    }
    const topics = (raw: RawContent) => raw.topics as RawTopic[];

    it('puts every shipped experiment under a topic of its own subject', () => {
      const c = buildContent(bundledContent, code);
      expect(c.topics.all().map((t) => [t.id, t.subject, t.experiments])).toEqual([
        [
          'kinematics',
          'physics',
          ['free-fall', 'projectile-motion', 'measuring-speed', 'newtons-second-law'],
        ],
        [
          'dynamics',
          'physics',
          [
            'newtons-second-law',
            'atwood-machine',
            'hookes-law',
            'inclined-plane',
            'circular-motion',
            'force-composition',
            'moment-of-force',
          ],
        ],
        ['conservation-laws', 'physics', ['mechanical-energy', 'collisions']],
        ['fluids', 'physics', ['buoyancy', 'liquid-pressure']],
        [
          'oscillations-and-waves',
          'physics',
          [
            'pendulum',
            'resonance',
            'sound-frequency',
            'ripple-tank',
            'standing-wave',
            'speed-of-sound',
          ],
        ],
        [
          'electricity',
          'physics',
          ['electric-field', 'ohms-law', 'electrical-power', 'capacitor', 'cell-emf'],
        ],
        ['optics', 'physics', ['refraction', 'reflection', 'converging-lens', 'double-slit']],
        ['thermal-physics', 'physics', ['specific-heat', 'latent-heat']],
        ['ideal-gases', 'physics', ['boyle', 'charles']],
        ['magnetism', 'physics', ['magnetic-force', 'induction', 'ac-generator']],
        ['nuclear-physics', 'physics', ['radioactive-decay']],
        ['acids-and-bases', 'chemistry', ['acid-base-titration', 'ph-measurement']],
        ['solutions', 'chemistry', ['dilution', 'solubility']],
        ['reaction-kinetics', 'chemistry', ['reaction-rate', 'collision-theory']],
        ['states-of-matter', 'chemistry', ['heating-curve']],
        ['ions-and-precipitation', 'chemistry', ['precipitation']],
        ['separating-mixtures', 'chemistry', ['separation']],
        ['energy-in-reactions', 'chemistry', ['neutralisation']],
        ['chemical-equilibrium', 'chemistry', ['le-chatelier']],
        [
          'electrochemistry',
          'chemistry',
          ['galvanic-cell', 'electrolysis', 'halogens', 'corrosion'],
        ],
        ['organic-chemistry', 'chemistry', ['saponification']],
        [
          'particle-models',
          'chemistry',
          ['gas-speeds', 'atomic-structure', 'orbitals', 'molecule-shapes', 'balancing'],
        ],
        ['cells', 'biology', ['microscope', 'cell-division']],
        ['biological-molecules', 'biology', ['food-tests']],
        ['membrane-transport', 'biology', ['osmosis', 'agar-diffusion', 'plasmolysis']],
        ['enzymes', 'biology', ['enzyme-activity']],
        ['photosynthesis', 'biology', ['photosynthesis']],
        ['water-in-plants', 'biology', ['transpiration']],
        ['respiration', 'biology', ['seed-respiration', 'fermentation']],
        ['inheritance', 'biology', ['mendelian-cross']],
        ['ecology', 'biology', ['mark-recapture', 'logistic-growth', 'predator-prey']],
        ['genes-and-proteins', 'biology', ['protein-synthesis', 'dna-extraction', 'karyotype']],
        ['evolution', 'biology', ['population-genetics']],
        ['human-physiology', 'biology', ['heart-rate']],
        ['plant-responses', 'biology', ['tropism']],
      ]);
      // A topic is not a place: its experiments stay at their stations in their laboratory.
      expect(c.laboratories.get('physics').experiments).toEqual([
        'free-fall',
        'projectile-motion',
        'pendulum',
        'hookes-law',
        'inclined-plane',
        'ohms-law',
        'refraction',
        'mechanical-energy',
        'collisions',
        'circular-motion',
        'buoyancy',
        'electrical-power',
        'reflection',
        'converging-lens',
        'measuring-speed',
        'newtons-second-law',
        'atwood-machine',
        'force-composition',
        'moment-of-force',
        'liquid-pressure',
        'resonance',
        'sound-frequency',
        'double-slit',
        'ripple-tank',
        'standing-wave',
        'speed-of-sound',
        'capacitor',
        'cell-emf',
        'electric-field',
        'specific-heat',
        'latent-heat',
        'boyle',
        'charles',
        'magnetic-force',
        'induction',
        'radioactive-decay',
        'ac-generator',
      ]);
      expect(c.laboratories.get('chemistry').experiments).toEqual([
        'acid-base-titration',
        'reaction-rate',
        'heating-curve',
        'dilution',
        'solubility',
        'ph-measurement',
        'precipitation',
        'separation',
        'neutralisation',
        'le-chatelier',
        'galvanic-cell',
        'electrolysis',
        'halogens',
        'corrosion',
        'saponification',
        'gas-speeds',
        'collision-theory',
        'atomic-structure',
        'orbitals',
        'molecule-shapes',
        'balancing',
      ]);
      expect(c.laboratories.get('biology').experiments).toEqual([
        'microscope',
        'osmosis',
        'enzyme-activity',
        'photosynthesis',
        'transpiration',
        'seed-respiration',
        'mendelian-cross',
        'mark-recapture',
        'food-tests',
        'cell-division',
        'protein-synthesis',
        'population-genetics',
        'logistic-growth',
        'predator-prey',
        'agar-diffusion',
        'plasmolysis',
        'fermentation',
        'heart-rate',
        'tropism',
        'dna-extraction',
        'karyotype',
      ]);
    });

    it('rejects unknown, other-subject and unlisted experiments, empty and duplicate topics', () => {
      const raw = clone();
      const kinematics = topics(raw).find((t) => t.id === 'kinematics');
      const oscillations = topics(raw).find((t) => t.id === 'oscillations-and-waves');
      kinematics!.experiments.push('warp-drive');
      oscillations!.subject = 'chemistry';
      expect(problemsOf(raw)).toEqual([
        'topics.kinematics.experiments: unknown experiment "warp-drive"',
        'topics.oscillations-and-waves.experiments: "pendulum" is a physics experiment, not chemistry',
        'topics.oscillations-and-waves.experiments: "resonance" is a physics experiment, not chemistry',
        'topics.oscillations-and-waves.experiments: "sound-frequency" is a physics experiment, not chemistry',
        'topics.oscillations-and-waves.experiments: "ripple-tank" is a physics experiment, not chemistry',
        'topics.oscillations-and-waves.experiments: "standing-wave" is a physics experiment, not chemistry',
        'topics.oscillations-and-waves.experiments: "speed-of-sound" is a physics experiment, not chemistry',
      ]);
      oscillations!.subject = 'physics';
      kinematics!.experiments = ['free-fall', 'measuring-speed'];
      expect(problemsOf(raw)).toEqual(['experiments.projectile-motion: in no topic']);
      kinematics!.experiments = [];
      expect(problemsOf(raw)).toEqual([
        expect.stringMatching(/^topics\.0\.experiments: /) as string,
      ]);
      kinematics!.experiments = ['free-fall', 'projectile-motion', 'measuring-speed'];
      topics(raw).push({ ...oscillations! });
      expect(problemsOf(raw)).toEqual(['topics: duplicate id "oscillations-and-waves"']);
    });
  });

  describe('experiments', () => {
    interface RawExperiment {
      id: string;
      parameters: { id: string; presets?: { label: string; value: number }[] }[];
      results: { id: string; theory?: string }[];
      graphs: { id: string; x: string; y: string[] }[];
    }
    const projectile = (raw: RawContent) =>
      (raw.experiments as RawExperiment[]).find((e) => e.id === 'projectile-motion')!;

    it('ships projectile motion with a theory for every result and its graphs', () => {
      const e = buildContent(bundledContent, code).experiments.get('projectile-motion');
      expect(e.model).toBe('kinematics.projectile');
      expect(e.parameters.map((p) => `${p.symbol} ${p.min}–${p.max} ${p.unit}`)).toEqual([
        'v₀ 1–15 m/s',
        'θ 0–90 °',
        'g 1–25 m/s²',
        'd 0.001–0.1 m',
      ]);
      expect(e.results.map((r) => r.theory)).toEqual([
        'flightTime',
        'range',
        'maxHeight',
        'impactSpeed',
      ]);
      expect(e.graphs.map((g) => `${g.y.join('+')} vs ${g.x}`)).toEqual([
        'y vs time',
        'y vs x',
        'vx+vy+speed vs time',
      ]);
    });

    it('rejects malformed definitions with the path to the problem', () => {
      const raw = clone();
      const p = projectile(raw);
      p.parameters[2]!.presets!.push({ label: 'Sun', value: 274 });
      p.parameters[1]!.id = 'velocity';
      p.graphs[0]!.y = ['altitude'];
      expect(problemsOf(raw)).toEqual([
        'experiments.1.parameters.2.presets: every preset must lie within min … max',
        'experiments.1.parameters.1.id: duplicate id "velocity"',
        'experiments.1.graphs.0.y: "altitude" is not "time" or a measurement',
      ]);
    });

    it('rejects a theory the model cannot predict', () => {
      const raw = clone();
      projectile(raw).results[1]!.theory = 'distance';
      expect(problemsOf(raw)).toEqual([
        'experiments.projectile-motion: "range" compares with unknown model prediction "distance"',
      ]);
    });

    it('checks station controls against the apparatus and its experiment', () => {
      const raw = clone();
      type Placement = { id: string; params: Record<string, unknown> };
      const placements = (raw.rooms as { id: string; placements: Placement[] }[]).find(
        (r) => r.id === 'projectile-range',
      )!.placements;
      const param = (id: string) => placements.find((p) => p.id === id)!.params;
      param('dial-velocity').parameter = 'mass';
      param('button-run').station = 'cart';
      param('monitor').station = 'nowhere';
      const where = 'rooms.projectile-range.placements';
      expect(problemsOf(raw)).toEqual([
        `${where}.dial-velocity.params: station "launcher" (projectile-motion) has no parameter "mass"`,
        `${where}.button-run.params: "cart" is not an experiment apparatus`,
        `${where}.monitor.params: no placement "nowhere" in room "projectile-range"`,
      ]);
    });

    it('needs the items a checklist names', () => {
      const raw = clone();
      const procedure = (projectile(raw) as unknown as { procedure: { done: object }[] }).procedure;
      procedure[0]!.done = { kind: 'inspected', item: 'manual' };
      expect(problemsOf(raw)).toEqual([
        'experiments.projectile-motion.procedure.0: unknown item "manual"',
      ]);
    });

    it('ships the pendulum: small-angle and exact theory, θ and ω graphs, a live θ–t monitor', () => {
      const e = buildContent(bundledContent, code).experiments.get('pendulum');
      expect(e.model).toBe('mechanics.pendulum');
      expect(e.parameters.map((p) => `${p.symbol} ${p.min}…${p.max} ${p.unit}`)).toEqual([
        'L 0.25…3 m',
        'θ₀ -60…60 °',
        'g 1…25 m/s²',
        'd 0.001…0.1 s',
      ]);
      expect(e.results.map((r) => `${r.id}: ${r.theory}`)).toEqual([
        'period-small-angle: smallAnglePeriod',
        'period: period',
        'amplitude: amplitude',
        'max-speed: maxSpeed',
        'energy: energy',
      ]);
      expect(e.graphs.map((g) => `${g.y.join('+')} vs ${g.x}`)).toEqual([
        'theta vs time',
        'omega vs time',
        'omega vs theta',
        'kinetic+potential+energy vs time',
      ]);
      expect(e.monitor).toBe('angle-time');
    });

    it('ships one instrument per experiment, reading a result in SI to a resolution d', () => {
      const content = buildContent(bundledContent, code);
      const shipped = ['free-fall', 'projectile-motion', 'pendulum'].map((id) => {
        const e = content.experiments.get(id);
        return e.instruments.map((m) => {
          const d = e.parameters.find((p) => p.id === m.resolution);
          const presets = d?.presets.map((s) => s.value);
          return `${m.result} by ${m.name} to ${d?.default} ${d?.unit} (${presets?.join(', ')})`;
        });
      });
      // h, g, v₀, θ, L, θ₀ are inputs: nothing reads them.
      expect(shipped).toEqual([
        ['fall-time by Timer (light gates) to 0.01 s (0.001, 0.01, 0.1)'],
        ['range by Tape measure to 0.01 m (0.001, 0.01, 0.1)'],
        ['period by Timer (period mode) to 0.01 s (0.001, 0.01, 0.1)'],
      ]);
    });

    it('rejects an instrument that cannot read its result to a positive resolution', () => {
      const raw = clone();
      const e = (raw.experiments as Record<string, unknown>[])[2]!;
      expect(e.id).toBe('pendulum');
      const timer = (e.instruments as Record<string, unknown>[])[0]!;
      e.instruments = [
        { ...timer, result: 'frequency' },
        { ...timer },
        { ...timer }, // a second instrument on the same result
        { ...timer, result: 'amplitude' }, // in rad: no linear scale here
        { ...timer, result: 'period-small-angle', resolution: 'tick' },
      ];
      expect(problemsOf(raw)).toEqual([
        'experiments.2.instruments.0: no result "frequency"',
        'experiments.2.instruments.2: result "period" already has an instrument',
        'experiments.2.instruments.3: cannot read "rad": instruments read m, m³, s, mL, g, kg, N, V, A, J, Pa, °C, °, pH, mol/L',
        'experiments.2.instruments.4: no parameter "tick"',
      ]);
      e.instruments = [{ ...timer, resolution: 'length' }];
      expect(problemsOf(raw)).toEqual([
        'experiments.2.instruments.0: resolution "length" is in "m", its result in "s"',
      ]);
      e.instruments = [timer];
      const parameters = e.parameters as { id: string; min: number }[];
      parameters.find((p) => p.id === 'resolution')!.min = 0;
      expect(problemsOf(raw)).toEqual([
        'experiments.2.instruments.0: resolution "resolution" must stay above 0, not from 0',
      ]);
    });

    it('takes result classes ascending by max, only the last without one', () => {
      const raw = clone();
      const experiments = raw.experiments as { id: string; results: Record<string, unknown>[] }[];
      const k = experiments.findIndex((e) => e.id === 'hookes-law');
      const result = experiments[k]!.results[0]!;
      const named = (label: string, max?: number) => ({
        label,
        vi: { label },
        ...(max !== undefined && { max }),
      });
      const refused = `experiments.${k}.results.0.classes: classes must ascend by max, last may omit it`;
      for (const classes of [
        [named('Heavy', 5), named('Light', 2)],
        [named('Same', 2), named('Same again', 2)],
        [named('Open'), named('Light', 2)],
      ]) {
        result.classes = classes;
        expect(problemsOf(raw)).toEqual([refused]);
      }
      result.classes = [named('Light', 2), named('Medium', 5), named('Heavy')];
      expect(problemsOf(raw)).toEqual([]);
    });

    it('rejects a monitor, display input or checklist parameter that does not exist', () => {
      const raw = clone();
      const p = (raw.experiments as Record<string, unknown>[])[2]!;
      expect(p.id).toBe('pendulum');
      p.monitor = 'spectrum';
      (p.inputs as Record<string, object>).radius = { symbol: 'r', unit: 'm' };
      (p.procedure as { done: object }[])[1]!.done = { kind: 'adjusted', parameter: 'mass' };
      expect(problemsOf(raw)).toEqual([
        'experiments.2.monitor: no graph "spectrum"',
        'experiments.2.inputs.radius: "radius" is not an initial condition',
        'experiments.2.procedure.1.done.parameter: no parameter "mass"',
      ]);
    });

    it('rejects a graph mark the model cannot predict', () => {
      const raw = clone();
      const p = (raw.experiments as RawExperiment[]).find((e) => e.id === 'pendulum')!;
      (p.graphs[0] as { mark?: string }).mark = 'frequency';
      expect(problemsOf(raw)).toEqual([
        'experiments.pendulum: graph "angle-time" marks unknown model prediction "frequency"',
      ]);
    });

    it('compares runs only on graphs that make sense for each experiment', () => {
      const content = buildContent(bundledContent, code);
      const compared = (id: string) =>
        content.experiments
          .get(id)
          .compare.map((c) => (c.series ? `${c.graph}:${c.series}` : c.graph));
      expect(compared('projectile-motion')).toEqual(['trajectory', 'height-time']);
      expect(compared('pendulum')).toEqual([
        'angle-time',
        'angular-velocity-time',
        'phase',
        'energy-time:energy',
      ]);
    });

    it('rejects a comparison of a missing graph or series, or of several series at once', () => {
      const raw = clone();
      const p = (raw.experiments as Record<string, unknown>[])[2]!;
      expect(p.id).toBe('pendulum');
      p.compare = [
        { graph: 'spectrum' },
        { graph: 'angle-time', series: 'omega' },
        { graph: 'energy-time' },
      ];
      expect(problemsOf(raw)).toEqual([
        'experiments.2.compare.0: no graph "spectrum"',
        'experiments.2.compare.1: graph "angle-time" does not plot "omega"',
        'experiments.2.compare.2: graph "energy-time" plots 3 series: name one as "series"',
      ]);
    });
  });

  describe('door arrivals and spawns', () => {
    interface RawPlacement {
      id: string;
      position: number[];
      params: Record<string, unknown>;
    }
    const placement = (raw: RawContent, room: string, id: string) =>
      (raw.rooms as { id: string; placements: RawPlacement[] }[])
        .find((r) => r.id === room)!
        .placements.find((p) => p.id === id)!;
    const toTeacher = 'rooms.preparation-room.placements.door-teacher.params.arrival';

    it('names a door of the target scene for every shipped door', () => {
      const content = buildContent(bundledContent, code);
      // Every door: what offers travel (the walk-through doors are of item "sliding-door").
      const doors = content.rooms
        .all()
        .flatMap((r) =>
          r.placements.filter((p) => content.items.get(p.item).interactions.includes('travel')),
        );
      expect(doors).toHaveLength(10);
      expect(doors.map((d) => d.params.arrival)).not.toContain(undefined);
    });

    it('rejects arrivals that are not a door of the target scene', () => {
      for (const [arrival, problem] of [
        [
          'teacher-room/wardrobe',
          '"teacher-room/wardrobe" is not a placement in scene "teacher-room"',
        ],
        [
          'simlab-hub/door-physics',
          '"simlab-hub/door-physics" is not a placement in scene "teacher-room"',
        ],
        ['teacher-room', '"teacher-room" is not a placement in scene "teacher-room"'],
        ['teacher-room/desk', '"teacher-room/desk" is not a door'],
      ]) {
        const raw = clone();
        placement(raw, 'preparation-room', 'door-teacher').params.arrival = arrival;
        expect(problemsOf(raw)).toEqual([`${toTeacher}: ${problem}`]);
      }
    });

    it('rejects an arrival point that is blocked or has no inside face', () => {
      let raw = clone();
      placement(raw, 'teacher-room', 'desk').position = [-1.2, 0, 0]; // in front of the door
      expect(problemsOf(raw)).toEqual([
        `${toTeacher}: the arrival point in front of "teacher-room/door-preparation" overlaps placement "desk"`,
        'scenes.teacher-room.spawn: overlaps placement "desk"', // the spawn is there too
      ]);

      raw = clone();
      placement(raw, 'teacher-room', 'door-preparation').position = [0, 0, 0]; // mid-room
      expect(problemsOf(raw)).toEqual([
        `${toTeacher}: cannot arrive at "teacher-room/door-preparation": it stands free in the room, so it has no inside face`,
      ]);
    });

    it('rejects spawns inside furniture or against a wall', () => {
      const raw = clone();
      const scenes = raw.scenes as { id: string; spawn?: { position: number[] } }[];
      scenes.find((s) => s.id === 'preparation-room')!.spawn!.position = [-2.3, 0, 1.8]; // the bed
      scenes.find((s) => s.id === 'teacher-room')!.spawn!.position = [-2.4, 0, 1]; // west wall
      expect(problemsOf(raw)).toEqual([
        'scenes.preparation-room.spawn: overlaps placement "bed"',
        'scenes.teacher-room.spawn: too close to a wall of the room',
      ]);
    });
  });

  describe('procedures', () => {
    interface RawProcedure {
      entrance: string;
      exits: string[];
      requiredEquipment: string[];
      steps: Record<string, unknown>[];
    }
    const entry = (raw: RawContent) => (raw.procedures as RawProcedure[])[0]!;
    const where = 'procedures.cleanroom-entry';

    it('ships the cleanroom entry procedure, gating the corridor door to the hub', () => {
      const p = buildContent(bundledContent, code).procedures.get('cleanroom-entry');
      expect(p.entrance).toBe('cleanroom-corridor/door-hub');
      expect(p.steps.map((s) => s.stage)).toEqual([
        'briefing',
        ...Array<string>(2).fill('gowning'),
        ...Array<string>(10).fill('handwashing'),
        'disinfection',
        'gloving',
      ]);
    });

    it('checks every step against what is placed in the scene', () => {
      const raw = clone();
      const p = entry(raw);
      p.entrance = 'cleanroom-corridor/wash-basin'; // not a door
      p.requiredEquipment.push('wardrobe'); // not wearable
      p.steps[0]!.action = 'read'; // the notice board offers "inspect"
      p.steps[3]!.condition = { item: 'kettle', key: 'running', value: true };
      expect(problemsOf(raw)).toEqual([
        `${where}.entrance: "cleanroom-corridor/wash-basin" is not a door placed in scene "preparation-room"`,
        `${where}.requiredEquipment.3: "wardrobe" is not wearable equipment placed in the scene`,
        `${where}.steps.0: no "notice-board" in the scene offers action "read"`,
        `${where}.steps.3.condition: no "kettle" is placed in scene "preparation-room"`,
      ]);
    });

    it('needs every exit to be a door of the scene other than the entrance', () => {
      const raw = clone();
      entry(raw).exits.push('cleanroom-corridor/door-hub', 'preparation-room/bed', 'nowhere');
      expect(problemsOf(raw)).toEqual([
        `${where}.exits.1: "cleanroom-corridor/door-hub" is the entrance`,
        `${where}.exits.2: "preparation-room/bed" is not a door placed in scene "preparation-room"`,
        `${where}.exits.3: "nowhere" is not a door placed in scene "preparation-room"`,
      ]);
    });

    it('rejects duplicate steps, unknown stages and malformed steps', () => {
      const raw = clone();
      const p = entry(raw);
      p.steps[1]!.id = 'read-rules';
      p.steps[2]!.stage = 'lunch';
      p.steps[4]!.durationS = -1;
      expect(problemsOf(raw)).toEqual([
        'procedures.0.steps.4.durationS: Too small: expected number to be >=0',
        'procedures.0.steps.1.id: duplicate step id "read-rules"',
        'procedures.0.steps.2.stage: unknown stage "lunch"',
      ]);
    });

    it('rejects "wear" on items that are not PPE and containers that are not in the room', () => {
      const raw = clone();
      (raw.items as { id: string; interactions: string[] }[])
        .find((i) => i.id === 'chair')!
        .interactions.push('wear');
      const rooms = raw.rooms as { placements: { id: string; params?: object }[] }[];
      rooms[0]!.placements.find((pl) => pl.id === 'lab-coat')!.params = { container: 'closet' };
      expect(problemsOf(raw)).toEqual([
        'items.chair.interactions: "wear" needs category "ppe" and "wornOn"',
        'rooms.preparation-room.placements.lab-coat.params: no placement "closet" in room "preparation-room"',
      ]);
    });
  });

  describe('doorways', () => {
    interface RawRoom {
      bounds: { max: number[] };
      openings: { wall: string; center: number; width: number; height: number }[];
    }
    // rooms.json: [0] Preparation Room (north opening), [1] cleanroom corridor (south opening).
    const rooms = (raw: RawContent) => raw.rooms as RawRoom[];
    const lost = (room: string, index: number, wall: string) =>
      `scenes.preparation-room: rooms.${room}.openings.${index} (${wall} wall) does not lead ` +
      'into another room of the scene (same opening, 0.25 m away)';

    it('ships the Preparation Room and the corridor joined by one doorway', () => {
      const content = buildContent(bundledContent, code);
      const scene = content.scenes.get('preparation-room');
      expect(scene.kind === 'world' && scene.rooms).toEqual([
        'preparation-room',
        'cleanroom-corridor',
      ]);
      expect(content.rooms.get('preparation-room').openings).toEqual([
        { wall: 'north', center: 0, width: 1.2, height: 2.2 },
        // Behind the Teacher Room door: a walk-through doorway into the other scene.
        { wall: 'east', center: 1, width: 0.9, height: 2 },
      ]);
    });

    it('rejects an opening that is not on a wall shared with another room of the scene', () => {
      let raw = clone();
      rooms(raw)[0]!.openings[0]!.wall = 'south'; // nothing behind the south wall
      expect(problemsOf(raw)).toEqual([
        lost('preparation-room', 0, 'south'),
        lost('cleanroom-corridor', 0, 'south'),
      ]);

      raw = clone();
      rooms(raw)[1]!.bounds.max[2] = -3.5; // corridor moved 0.25 m further away
      expect(problemsOf(raw)).toEqual([
        lost('preparation-room', 0, 'north'),
        lost('cleanroom-corridor', 0, 'south'),
      ]);

      raw = clone();
      rooms(raw)[1]!.openings[0]!.width = 1; // the two sides of the doorway disagree
      expect(problemsOf(raw)).toEqual([
        lost('preparation-room', 0, 'north'),
        lost('cleanroom-corridor', 0, 'south'),
      ]);
    });

    it('rejects openings that do not fit their wall or overlap', () => {
      const raw = clone();
      rooms(raw)[0]!.openings.push(
        { wall: 'north', center: 0.8, width: 1, height: 2 }, // overlaps the doorway
        { wall: 'east', center: 0, width: 7, height: 2 }, // wider than the 6 m wall
        { wall: 'west', center: 0, width: 1, height: 3.5 }, // taller than the room
      );
      expect(problemsOf(raw)).toEqual([
        // (Index 1 is the doorway behind the Teacher Room door: the 7 m one overlaps it too.)
        'rooms.preparation-room.openings.2: overlaps another opening in the same wall',
        'rooms.preparation-room.openings.3: does not fit in the east wall',
        'rooms.preparation-room.openings.3: overlaps another opening in the same wall',
        'rooms.preparation-room.openings.4: does not fit in the west wall',
        lost('preparation-room', 2, 'north'),
        lost('preparation-room', 3, 'east'),
        lost('preparation-room', 4, 'west'),
      ]);
    });
  });
  describe('walk-through doors', () => {
    interface RawPlacement {
      id: string;
      item: string;
      position: number[];
      rotationY?: number;
      params: Record<string, unknown>;
    }
    interface RawRoom {
      id: string;
      bounds: { min: number[]; max: number[] };
      openings: { wall: string; center: number; width: number; height: number }[];
      placements: RawPlacement[];
    }
    const room = (raw: RawContent, id: string) =>
      (raw.rooms as RawRoom[]).find((r) => r.id === id)!;
    const placement = (raw: RawContent, roomId: string, id: string) =>
      room(raw, roomId).placements.find((p) => p.id === id)!;
    const BIO = 'rooms.biology-lab.placements.door-hub';
    const HUB = 'rooms.simlab-hub.placements.door-biology';

    it('ships every door as a sliding pair with its doorways', () => {
      const content = buildContent(bundledContent, code);
      const doors = content.rooms
        .all()
        .flatMap((r) => r.placements.filter((p) => content.items.get(p.item).door));
      expect(doors).toHaveLength(10);
      expect(content.items.get('sliding-door')).toMatchObject({
        physical: { body: 'kinematic' },
        door: { travel: 1, openS: 0.6, closeS: 0.6 }, // UX3.1: one leaf after the other, 1.4 s in all
        interactions: ['travel'],
        visual: content.items.get('door').visual, // looks like the teleport door
      });
    });

    it('moves only door leaves, and door leaves only kinematically', () => {
      const raw = clone();
      const items = raw.items as { id: string; physical: { body?: string }; door?: object }[];
      items.find((i) => i.id === 'desk')!.physical.body = 'kinematic';
      items.find((i) => i.id === 'bed')!.door = { travel: 1, openS: 1, closeS: 1 };
      const problems = problemsOf(raw);
      expect(
        problems.some((p) => /^items\.\d+\.physical\.body: "kinematic" needs "door"/.test(p)),
      ).toBe(true);
      expect(
        problems.some((p) => /^items\.\d+\.door: "door" needs physical.body "kinematic"/.test(p)),
      ).toBe(true);
    });

    it('needs room lights under the room’s own glowing fixtures, one key per room', () => {
      const raw = clone();
      const lights = (id: string) =>
        (room(raw, id) as unknown as { lights: Record<string, unknown>[] }).lights;
      lights('teacher-room').push({ fixture: 'nowhere', role: 'fill' });
      lights('teacher-room').push({ fixture: 'bed', role: 'fill' });
      lights('teacher-bathroom').push({ fixture: 'light-1', role: 'key' });
      expect(problemsOf(raw)).toEqual([
        'rooms.teacher-room.lights.1: no placement "nowhere" in the room',
        'rooms.teacher-room.lights.2: "bed" is not a light fixture (its item does not glow)',
        "rooms.teacher-bathroom.lights: one key light at most (it casts the room's shadows)",
      ]);
    });

    it('takes reachHeight on a key light only, below its fixture', () => {
      const raw = clone();
      const lights = (id: string) =>
        (room(raw, id) as unknown as { lights: Record<string, unknown>[] }).lights;
      lights('physics-lab')[1]!.reachHeight = 0.9; // its fill
      lights('chemistry-lab')[0]!.reachHeight = 4.5; // its key, at the ceiling (4.5 m since U-2)
      expect(problemsOf(raw)).toEqual([
        'rooms.physics-lab.lights.1: reachHeight is for a key light, below its fixture',
        'rooms.chemistry-lab.lights.0: reachHeight is for a key light, below its fixture',
      ]);
    });

    it('fits the renderer’s pool of room lights, alone and with the scene through each door', () => {
      const raw = clone();
      const lights = (id: string) =>
        (room(raw, id) as unknown as { lights: Record<string, unknown>[] }).lights;
      // The Physics wing's rooms and the hub take the four keys and all eight others (Phase T-1a:
      // the teacher's corner lit). One more in the hub is too many through the
      // Physics Lab's door; the other labs leave room.
      lights('simlab-hub').push({ fixture: 'light-1', role: 'fill' });
      const over = (lab: string, keys: number, others: number) =>
        `doors "simlab-hub/door-${lab}" and "${lab}-lab/door-hub": scenes "simlab-hub" and ` +
        `"${lab}-lab" together have ${keys} key and ${others} other room lights, more than the renderer ` +
        'keeps (4 and 8)';
      // Phase X: the Chemistry and Biology Labs' practice rooms fill their scenes' share too.
      expect(problemsOf(raw)).toEqual([
        over('chemistry', 3, 9),
        over('physics', 4, 9),
        over('biology', 3, 9),
      ]);
    });

    it('needs the scenes a door joins lit alike (one lights the view, the other is seen)', () => {
      const raw = clone();
      const scenes = raw.scenes as { id: string; lighting?: string }[];
      scenes.find((s) => s.id === 'preparation-room')!.lighting = 'basic';
      const joined = (door: string, other: string, scene: string) =>
        `doors "${door}" and "${other}": scenes "preparation-room" (basic) and "${scene}" ` +
        '(enhanced) need the same lighting: one is seen through the door while the other lights ' +
        'the view';
      expect(problemsOf(raw)).toEqual([
        joined('preparation-room/door-teacher', 'teacher-room/door-preparation', 'teacher-room'),
        joined('cleanroom-corridor/door-hub', 'simlab-hub/door-preparation', 'simlab-hub'),
      ]);
    });

    it('needs the other leaf to name it back', () => {
      const raw = clone();
      // A door of the preparation scene, but not the one that names the Teacher Room door.
      placement(raw, 'teacher-room', 'door-preparation').params.arrival =
        'cleanroom-corridor/door-hub';
      const lone =
        'a walk-through door needs as its arrival a door of another scene, on the ' +
        'facing wall, that names it back';
      expect(problemsOf(raw)).toEqual([
        `rooms.preparation-room.placements.door-teacher: ${lone}`,
        `rooms.teacher-room.placements.door-preparation: ${lone}`,
      ]);
    });

    it('needs the doorway behind both leaves, covered by them and alike', () => {
      let raw = clone();
      // Its hub doorway only (Phase X: the west one leads to the practice room).
      room(raw, 'biology-lab').openings = room(raw, 'biology-lab').openings.filter(
        (o) => o.wall !== 'east',
      );
      expect(problemsOf(raw)).toEqual([
        `${BIO}: no opening in the east wall behind it (centred at 0)`,
      ]);

      raw = clone();
      room(raw, 'biology-lab').openings[0]!.width = 1.2;
      room(raw, 'simlab-hub').openings.find((o) => o.wall === 'west')!.width = 1.2;
      expect(problemsOf(raw)).toEqual([
        `${HUB}: the leaf does not cover the opening behind it`,
        `${BIO}: the leaf does not cover the opening behind it`,
      ]);

      raw = clone();
      placement(raw, 'biology-lab', 'door-hub').position = [4.95, 0.3, 0]; // a gap below it
      expect(problemsOf(raw)).toEqual([`${BIO}: the leaf does not cover the opening behind it`]);

      raw = clone();
      room(raw, 'biology-lab').openings[0]!.height = 1.9;
      expect(problemsOf(raw)).toEqual([
        'doors "simlab-hub/door-biology" and "biology-lab/door-hub": the openings behind the two leaves differ',
      ]);
    });

    it('needs the leaves back to back, sliding free along their wall', () => {
      let raw = clone();
      placement(raw, 'biology-lab', 'door-hub').position = [4.9, 0, 0]; // 0.1 m from its wall
      expect(problemsOf(raw)).toEqual([
        'doors "simlab-hub/door-biology" and "biology-lab/door-hub": not back to back: 0.4 m apart, not 0.35 m (each 0.05 m inside its wall face)',
      ]);

      raw = clone();
      // The bench turned against the east wall, where the leaf slides open (z −1.5 … 0.5).
      Object.assign(placement(raw, 'biology-lab', 'bench'), {
        position: [4.55, 0, -1.5],
        rotationY: Math.PI / 2,
      });
      expect(problemsOf(raw)).toEqual([`${BIO}: "bench" is in the way of the leaf sliding open`]);

      raw = clone();
      const sliding = (raw.items as { id: string; door?: { travel: number } }[]).find(
        (i) => i.id === 'sliding-door',
      )!;
      sliding.door!.travel = 3; // past the 3 m corridor's side wall, among others
      expect(problemsOf(raw)).toContain(
        'rooms.cleanroom-corridor.placements.door-hub: slides out of its wall',
      );
    });

    it('lets only solids block a leaf: door trim without a body is the content tests’ to place', () => {
      const raw = clone();
      // The biology lab's jamb (decor, no body) moved into the leaf's slide path (z −1.5 … 0.5).
      placement(raw, 'biology-lab', 'door-hub-jamb').position = [4.95, 0, -1];
      expect(problemsOf(raw)).toEqual([]);
    });

    it('places every scene once in the campus, its rooms a wall apart from the others', () => {
      let raw = clone();
      // A second hub ⇄ biology pair, 1 m along the wall from where the first puts biology (clear
      // of the pilasters on the hub's west wall).
      const leaf = (id: string, position: number[], arrival: string, targetScene: string) => ({
        id,
        item: 'sliding-door',
        position,
        rotationY: 1.5708,
        params: { targetScene, arrival },
      });
      room(raw, 'simlab-hub').placements.push(
        leaf('door-biology-2', [-12.95, 0, 0], 'biology-lab/door-hub-2', 'biology-lab'),
      );
      room(raw, 'simlab-hub').openings.push({ wall: 'west', center: 0, width: 0.9, height: 2 });
      room(raw, 'biology-lab').placements.push(
        leaf('door-hub-2', [4.95, 0, 2], 'simlab-hub/door-biology-2', 'simlab-hub'),
      );
      room(raw, 'biology-lab').openings.push({ wall: 'east', center: 2, width: 0.9, height: 2 });
      expect(problemsOf(raw)).toEqual([
        'doors "simlab-hub/door-biology-2" and "biology-lab/door-hub-2": put scene "biology-lab" elsewhere than the doors before them (a loop of doors that does not close)',
      ]);

      raw = clone();
      room(raw, 'pendulum-bay').bounds.min[0] = -6; // 0.75 m into the hub, behind its east wall
      expect(problemsOf(raw)).toEqual([
        'rooms "simlab-hub" (simlab-hub) and "pendulum-bay" (physics-lab) overlap in the campus: less than a wall apart',
      ]);
    });
  });
});
