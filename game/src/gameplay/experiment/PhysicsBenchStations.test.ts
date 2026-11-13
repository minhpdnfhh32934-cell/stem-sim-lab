import { describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';
import type { BenchView } from './StationSystem';

// The projectile range's seven later physics benches (content: lab-placements.json), each played
// through its desk as every station is: the board read, a dial, RUN, the record against theory,
// the monitor, RESET; its dials offer only their presets, none refused; the HUD follows it from its
// desk and its board. One closed form per experiment is written out here, not taken from its model; every result
// is then checked against the model's own theory, which the run must reach (it is exact).

const H = 1 / 60;
const LAB = 'physics-lab';
const G = 9.81;

/** Relative closeness, for values from 1e-5 to 1e3. */
const near = (a: number | undefined, b: number | undefined, rel = 1e-6) =>
  a !== undefined && b !== undefined && Math.abs(a - b) <= rel * Math.max(1e-3, Math.abs(b));

interface Case {
  experiment: string;
  /** The room its bench stands in (Phase T-1a). */
  room: string;
  /** The apparatus placement: the station's id in the room. */
  station: string;
  model: string;
  /** Where the e2e spec stands at its desk. */
  desk: [number, number];
  /** Where it stands to read the board (and the monitor, where the desk is out of its reach). */
  board: [number, number];
  /** Its dial suffixes (`<station>-dial-<suffix>`) by parameter, left to right. */
  dials: Record<string, string>;
  /** The dial raised once in the run test. */
  raise: string;
  /** Closed-form checks of the completed run, written out from the physics. */
  check(results: Record<string, number>, inputs: Record<string, number>): void;
}

const CASES: Case[] = [
  {
    experiment: 'mechanical-energy',
    station: 'energy',
    room: 'physics-lab',
    model: 'energy-track',
    desk: [4.867, 1.132],
    board: [5.717, 1.132],
    dials: { releaseHeight: 'height', mass: 'mass', sailArea: 'sail', timerResolution: 'timer' },
    raise: 'releaseHeight', // 0.2 → 0.25 m
    check(r, i) {
      expect(i.releaseHeight).toBe(0.25);
      // Eₚ at release above the level track: m·g·h; Eₖ at gate A from the flag's mean speed w/Δt.
      expect(r.startEnergy).toBeCloseTo(0.5 * G * 0.25, 12);
      expect(r.speedA).toBeCloseTo(0.025 / r.gateTimeA!, 9);
      expect(r.kineticA).toBeCloseTo(0.5 * 0.5 * r.speedA! ** 2, 9);
      expect(r.idealSpeedA).toBeCloseTo(Math.sqrt(2 * G * 0.25), 9); // no losses
      // Rolling resistance loses energy: below the ideal, and the cart turns below h.
      expect(r.speedA!).toBeLessThan(r.idealSpeedA!);
      expect(r.turnHeight!).toBeLessThan(0.25);
    },
  },
  {
    experiment: 'collisions',
    station: 'collision',
    room: 'physics-lab',
    model: 'air-track',
    desk: [10.2, -1.132],
    board: [9.35, -1.132],
    dials: { massA: 'mass', speed: 'speed', restitution: 'bumpers', timerResolution: 'timer' },
    raise: 'massA', // 0.3 → 0.4 kg, onto B at rest (0.3 kg), elastic bumpers
    check(r, i) {
      const [mA, mB, u] = [0.4, 0.3, i.speed!];
      expect(i.massA).toBe(mA);
      // Elastic: vA′ = (mA − mB)/(mA + mB)·u, vB′ = 2mA/(mA + mB)·u; momentum and Eₖ kept.
      expect(r.velocityA).toBeCloseTo(((mA - mB) / (mA + mB)) * u, 9);
      expect(r.velocityB).toBeCloseTo(((2 * mA) / (mA + mB)) * u, 9);
      expect(r.momentumBefore).toBeCloseTo(mA * u, 12);
      expect(r.momentumAfter).toBeCloseTo(mA * u, 9);
      expect(r.kineticPercent).toBeCloseTo(100, 6);
    },
  },
  {
    experiment: 'circular-motion',
    station: 'whirl',
    room: 'pendulum-bay',
    model: 'whirling-apparatus',
    desk: [-2.95, -14.2],
    board: [-2.95, -13.35],
    dials: {
      length: 'length',
      hangingMass: 'hanging-mass',
      bungMass: 'bung-mass',
      stopwatchResolution: 'stopwatch',
    },
    raise: 'hangingMass', // 0.2 → 0.3 kg
    check(r, i) {
      const [L, M, m] = [i.length!, 0.3, i.bungMass!];
      expect(i.hangingMass).toBe(M);
      // The cord's tension M·g; its horizontal part m·ω²·r with r = L·cos β gives ω² = M·g/(m·L).
      const omega = Math.sqrt((M * G) / (m * L));
      expect(r.tension).toBeCloseTo(M * G, 9);
      expect(r.angularVelocity).toBeCloseTo(omega, 9);
      expect(r.period).toBeCloseTo((2 * Math.PI) / omega, 9);
      expect(r.radius).toBeCloseTo(L * Math.sqrt(1 - (m / M) ** 2), 9); // sin β = m/M
    },
  },
  {
    experiment: 'buoyancy',
    station: 'buoyancy',
    room: 'physics-lab',
    model: 'buoyancy-rig',
    desk: [16.8, -5.6],
    board: [15.217, -5.6],
    dials: {
      objectDensity: 'material',
      fluidDensity: 'liquid',
      edgeLength: 'edge',
      forceResolution: 'resolution',
    },
    raise: 'objectDensity', // aluminium → copper, 8960 kg/m³, in water
    check(r, i) {
      const V = i.edgeLength! ** 3;
      expect(i.objectDensity).toBe(8960);
      // Archimedes: F_b = ρ_liquid·V·g; the sensor reads W − F_b with the cube under.
      expect(r.weightInAir).toBeCloseTo(8960 * V * G, 9);
      expect(r.buoyantForce).toBeCloseTo(i.fluidDensity! * V * G, 9);
      expect(r.apparentWeight).toBeCloseTo((8960 - i.fluidDensity!) * V * G, 9);
      expect(r.displacedVolume).toBeCloseTo(V, 12);
      expect(r.density).toBeCloseTo(8960, 6);
    },
  },
  {
    experiment: 'electrical-power',
    station: 'power',
    room: 'physics-lab',
    model: 'power-board',
    desk: [6.2, 5.6],
    board: [7.05, 5.6],
    dials: { configuration: 'circuit', voltage: 'voltage', ammeterResolution: 'ammeter' },
    raise: 'configuration', // series → parallel, 12 V across 10 Ω ∥ 20 Ω
    check(r, i) {
      expect(i.configuration).toBe(2);
      // One voltage: I = U/R1 + U/R2, P = U·I = P1 + P2 with Pk = U²/Rk; the smaller R takes more.
      const [P1, P2] = [144 / 10, 144 / 20];
      expect(r.current).toBeCloseTo(12 / 10 + 12 / 20, 12);
      expect(r.power).toBeCloseTo(12 * r.current!, 12);
      expect(r.power1).toBeCloseTo(P1, 9);
      expect(r.power2).toBeCloseTo(P2, 9);
      expect(r.power).toBeCloseTo(P1 + P2, 9);
      expect(r.largerPower).toBe(1);
      expect(r.voltageSquared).toBeCloseTo(144, 12);
    },
  },
  {
    experiment: 'reflection',
    station: 'mirror',
    room: 'waves-optics',
    model: 'mirror-board',
    desk: [27.35, 2.3],
    board: [27.35, 1.45],
    dials: { rayAngle: 'angle', mirrorTurn: 'mirror', resolution: 'resolution' },
    raise: 'rayAngle', // 30 → 45°, the mirror square
    check(r, i) {
      expect([i.rayAngle, i.mirrorTurn]).toEqual([45, 0]);
      // i′ = i, measured from the normal; the rays 2i apart.
      expect(r.incidence).toBeCloseTo(45, 9);
      expect(r.reflection).toBeCloseTo(45, 9);
      expect(r.between).toBeCloseTo(90, 9);
    },
  },
  {
    experiment: 'converging-lens',
    station: 'lens',
    room: 'waves-optics',
    model: 'optical-bench',
    desk: [26.2, 3.8],
    board: [27.05, 3.8],
    dials: { focalLength: 'focal', objectDistance: 'object', resolution: 'resolution' },
    raise: 'objectDistance', // 0.3 → 0.4 m, f = 0.1 m
    check(r, i) {
      const [f, u] = [0.1, 0.4];
      expect([i.focalLength, i.objectDistance]).toEqual([f, u]);
      // 1/f = 1/u + 1/v; k = −v/u, the image h′ = k·h upside down on the screen.
      const v = 1 / (1 / f - 1 / u);
      expect(r.imageDistance).toBeCloseTo(v, 9);
      expect(r.magnification).toBeCloseTo(-v / u, 9);
      expect(r.imageHeight).toBeCloseTo((-v / u) * i.objectHeight!, 9);
      expect(r.screenDistance).toBeCloseTo(v, 9); // the screen stops where the image is sharp
    },
  },
];

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};

/** New game, then the developer jump to the Physics Lab (setup only). */
async function lab() {
  const booted = await bootTestGame();
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 1);
  return booted;
}

describe.each(CASES)('$experiment station ($room, $station)', (c) => {
  const id = `${c.room}/${c.station}`;
  const act = (game: Game, placement: string, action: string) =>
    game.interaction.perform(`${c.room}/${placement}`, action);
  const dialOf = (parameter: string) => `${c.station}-dial-${c.dials[parameter]}`;
  const view = (game: Game): BenchView => {
    const station = game.stations.view(id);
    if (station?.kind !== 'bench') throw new Error(`${id} is not a bench station`);
    return station;
  };
  const session = (game: Game) => view(game).session;

  it('is ready at once at its defaults, no sample before a run', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe(c.experiment);
    expect(v.model).toBe(c.model);
    expect(v.session.state).toBe('configured');
    expect(v.runBlock).toBeNull();
    expect(v.session.parameters).toEqual(
      Object.fromEntries(v.definition.parameters.map((p) => [p.id, p.default])),
    );
    expect(Object.keys(c.dials).sort()).toEqual(v.definition.parameters.map((p) => p.id).sort());
    expect(Object.values(v.pose.sample).every(Number.isNaN)).toBe(true);
    expect(v.checklist.every((s) => !s.done)).toBe(true);
  });

  it('runs from its desk: the board, a dial, RUN, the record against theory, RESET', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, `${c.station}-instructions`, 'inspect')).toBe(true);
    expect(act(game, dialOf(c.raise), 'raise')).toBe(true);
    expect(game.entityStates.get(id, `param.${c.raise}`)).toBe(session(game).parameters[c.raise]);
    expect(act(game, `${c.station}-run`, 'run')).toBe(true);
    const run = session(game).run!;
    expect(run.inputs).toMatchObject(session(game).parameters);
    const pose = view(game).pose;
    let live = 0;
    for (let i = 0; session(game).state === 'running' && i < 100_000; i++) {
      game.update(H);
      // The rig is drawn from the model's own values this frame.
      const [variable] = Object.keys(pose.sample);
      if (Number.isFinite(pose.sample[variable!])) live++;
      expect(pose.sample[variable!]).toBe(run.value(variable!));
    }
    expect(live).toBeGreaterThan(0);
    expect(session(game).state).toBe('completed');
    expect(completed).toHaveLength(1);
    const { results } = completed[0]!;
    c.check(results, run.inputs);

    const [record] = session(game).history;
    expect(record?.status).toBe('completed');
    expect(record?.results).toEqual(results);
    const theory = record!.theory()!;
    for (const r of view(game).definition.results) {
      if (r.theory) expect(near(results[r.id], theory[r.theory]), r.id).toBe(true);
    }
    expect(game.state.progression.completedExperiments).toEqual([c.experiment]);

    expect(act(game, `${c.station}-monitor`, 'view-results')).toBe(true);
    expect(act(game, `${c.station}-reset`, 'reset')).toBe(true);
    expect(session(game).state).toBe('configured');
    expect(Object.values(pose.sample).every(Number.isNaN)).toBe(true);
    expect(session(game).history).toHaveLength(1); // the record outlives the reset
  });

  it('offers only its presets, none refused; the HUD follows it from its desk and board', async () => {
    const { game } = await lab();
    for (const p of view(game).definition.parameters) {
      const presets = p.presets.map((x) => x.value).sort((a, b) => a - b); // a dial raises
      for (let i = 0; i < presets.length; i++) act(game, dialOf(p.id), 'lower');
      const stops: number[] = [];
      for (let i = 0; i < presets.length; i++) {
        expect(view(game).runBlock, `${p.id} = ${presets[i]}`).toBeNull();
        stops.push(session(game).parameters[p.id]!);
        act(game, dialOf(p.id), 'raise');
      }
      expect(act(game, dialOf(p.id), 'raise')).toBe(false); // at the top already
      expect(stops).toEqual(presets);
      for (let i = 0; i < presets.length; i++) act(game, dialOf(p.id), 'lower');
      for (let i = 0; i < presets.length && session(game).parameters[p.id] !== p.default; i++) {
        act(game, dialOf(p.id), 'raise');
      }
      expect(session(game).parameters[p.id]).toBe(p.default);
    }
    placePlayer(game, [c.desk[0], 0, c.desk[1]]);
    expect(game.stations.activeStation()?.id).toBe(id);
    // At its board (and monitor) too, 0.3 m either way along the wall (the e2e walk's tolerance).
    for (const dx of [-0.3, 0, 0.3]) {
      placePlayer(game, [c.board[0] + dx, 0, c.board[1]]);
      expect(game.stations.activeStation()?.id, `board stand ${dx}`).toBe(id);
    }
  });
});

describe('the range keeps only the launcher (Phase T-1a)', () => {
  it('keeps the launcher at the projectile desk and monitor, the incline at its island desk', async () => {
    const { game } = await lab();
    for (const at of [
      [-1.2, 0, 13.1],
      [2.2, 0, 14.1],
    ] as const) {
      placePlayer(game, [...at]);
      expect(game.stations.activeStation()?.id).toBe('projectile-range/launcher');
    }
    placePlayer(game, [10.2, 0, 1.132]); // the inclined plane's desk, on the lab's south island
    expect(game.stations.activeStation()?.id).toBe('physics-lab/incline');
  });
});
