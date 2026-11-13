import { describe, expect, it } from 'vitest';
import { createTexts } from '../../core/i18n';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';
import { analysisRows, fitLine } from '../../simulation/analysis';
import { resultClass } from '../../simulation/experiment';
import { readings } from '../../simulation/measurement';
import { refractionModel } from '../../simulation/models/refraction';
import type { BenchView } from './StationSystem';

// Refraction on the projectile range's ray-optics board (content: rooms.json), played through its
// desk: the board read, the dials, RUN (the ray box turns from 0° to i), the record with its class
// and protractor readings, RESET. Snell's law and the Fresnel reflectance are written out here in
// their sine/tangent form, not taken from the model.

const H = 1 / 60;
const LAB = 'physics-lab';
const ROOM = 'waves-optics'; // Phase T-1a: on the optics room's east wall
const BOARD = `${ROOM}/refraction`;
const DEG = Math.PI / 180;

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};
const act = (game: Game, id: string, action: string) =>
  game.interaction.perform(`${ROOM}/${id}`, action);
const dial = (game: Game, id: string, action: 'raise' | 'lower', times = 1) => {
  for (let i = 0; i < times; i++) act(game, id, action);
};
const view = (game: Game): BenchView => {
  const station = game.stations.view(BOARD);
  if (station?.kind !== 'bench') throw new Error(`${BOARD} is not a bench station`);
  return station;
};
const session = (game: Game) => view(game).session;
const runUntilDone = (game: Game) => {
  for (let i = 0; session(game).state === 'running' && i < 100_000; i++) game.update(H);
};

/** Angle of refraction (°) from air into n at i (°): sin i = n·sin r. */
const refracted = (n: number, iDeg: number) => Math.asin(Math.sin(iDeg * DEG) / n) / DEG;
/** Unpolarised Fresnel reflectance, (Rs + Rp)/2, in the sine/tangent form (i ≠ 0). */
const reflectance = (iDeg: number, rDeg: number) => {
  const [i, r] = [iDeg * DEG, rDeg * DEG];
  return ((Math.sin(i - r) / Math.sin(i + r)) ** 2 + (Math.tan(i - r) / Math.tan(i + r)) ** 2) / 2;
};

/** New game, then the developer jump to the Physics Lab (setup only). */
async function lab() {
  const booted = await bootTestGame();
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 1);
  return booted;
}

describe('refraction station (projectile range)', () => {
  it('is ready at once: acrylic, air into the block, i = 20°, no sample before a run', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('refraction');
    expect(v.model).toBe('ray-optics-board');
    expect(v.session.state).toBe('configured');
    expect(v.runBlock).toBeNull();
    expect(v.session.parameters).toEqual({ index: 1.49, direction: 0, angle: 20, resolution: 1 });
    expect(game.entityStates.get(BOARD, 'param.index')).toBe(1.49);
    expect(Object.keys(v.pose.sample)).toEqual([...refractionModel.variables]);
    expect(Object.values(v.pose.sample).every(Number.isNaN)).toBe(true);
    expect(v.checklist.map((s) => s.done)).toEqual(Array(7).fill(false));
  });

  it('turns the ray box to 40° on crown glass: Snell’s law, Fresnel, the protractor, RESET', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, 'refraction-instructions', 'inspect')).toBe(true);
    expect(act(game, 'refraction-dial-index', 'raise')).toBe(true); // n 1.52
    expect(act(game, 'refraction-dial-angle', 'raise')).toBe(true); // i 40°
    expect(act(game, 'refraction-run', 'run')).toBe(true);
    const run = session(game).run!;
    expect(run.inputs).toEqual({
      index: 1.52,
      direction: 0,
      angle: 40,
      resolution: 1,
      sweepRate: 10,
    });
    const pose = view(game).pose;
    const turned: number[] = [];
    while (session(game).state === 'running') {
      game.update(H);
      expect(pose.sample.incidence).toBe(run.value('incidence')); // drawn from the run, by name
      expect(pose.sample.tir).toBe(0); // entering: always refracted
      turned.push(pose.sample.incidence! / DEG);
    }
    // At 10 °/s from 0° to 40°: 4 s, the angle only ever growing, ending on the set angle.
    expect(turned.length).toBeGreaterThan(230);
    expect(turned.every((a, k) => k === 0 || a >= turned[k - 1]!)).toBe(true);
    expect(turned.at(-1)).toBeCloseTo(40, 9);
    expect(session(game).state).toBe('completed');

    const r = refracted(1.52, 40);
    const results = completed[0]!.results;
    expect(results.incidence).toBeCloseTo(40, 9);
    expect(results.reflection).toBeCloseTo(40, 9); // i′ = i
    expect(results.tir).toBe(0);
    expect(results.refraction).toBeCloseTo(r, 9);
    expect(results['last-incidence']).toBeCloseTo(40, 9);
    expect(results['sin-air']! / results['sin-block']!).toBeCloseTo(1.52, 9);
    expect(results.reflectance).toBeCloseTo(reflectance(40, r), 12);
    expect(game.state.progression.completedExperiments).toEqual(['refraction']);

    const [record] = session(game).history;
    expect(record?.status).toBe('completed');
    expect(record?.results).toEqual(results);
    expect(record?.theory()?.criticalAngleDeg).toBeUndefined(); // entering: no critical angle
    const tir = record!.definition.results.find((x) => x.id === 'tir')!;
    expect(resultClass(tir, results.tir!)).toBe('No');
    // The protractor at d = 1° reads the record's own angles; the values stay exact.
    const read = readings(record!.definition, record!);
    expect(read.map((x) => [x.result, x.text, x.bound])).toEqual([
      ['incidence', '40', 0.5],
      ['reflection', '40', 0.5],
      ['refraction', String(Math.round(r)), 0.5],
      ['last-incidence', '40', 0.5],
    ]);
    expect(read[2]?.simulated).toBe(results.refraction);

    expect(act(game, 'refraction-monitor', 'view-results')).toBe(true);
    expect(act(game, 'refraction-dial-direction', 'raise')).toBe(true); // block → air
    expect(act(game, 'refraction-reset', 'reset')).toBe(true);
    expect(session(game).state).toBe('configured');
    expect(Object.values(pose.sample).every(Number.isNaN)).toBe(true);
    expect(session(game).history).toHaveLength(1);
    expect(view(game).checklist.every((s) => s.done)).toBe(true);
  });

  it('leaving crown glass at 60°: totally reflected past C = asin(1/n), the grazing ray kept', async () => {
    const { game } = await lab();
    act(game, 'refraction-dial-index', 'raise'); // 1.52
    act(game, 'refraction-dial-direction', 'raise'); // block → air
    dial(game, 'refraction-dial-angle', 'raise', 3); // 40°, 60°, … then 80°: back to 60°
    act(game, 'refraction-dial-angle', 'lower');
    expect(session(game).parameters.angle).toBe(60);
    act(game, 'refraction-run', 'run');
    runUntilDone(game);
    const c = Math.asin(1 / 1.52) / DEG; // 41.14°
    const record = session(game).history.at(-1)!;
    const results = record.results!;
    expect(results.incidence).toBeCloseTo(60, 9);
    expect(results.tir).toBe(1);
    expect(results.reflectance).toBe(1);
    expect(results['last-incidence']).toBeCloseTo(c, 9); // the last refracted ray, at C …
    expect(results.refraction).toBe(90); // … grazing the face
    expect(results['sin-air']).toBe(1);
    expect(results['sin-block']).toBeCloseTo(1 / 1.52, 12);
    expect(record.theory()?.criticalAngleDeg).toBeCloseTo(c, 9);
    expect(view(game).pose.sample.tir).toBe(1); // the board hides the refracted ray
    const tir = record.definition.results.find((x) => x.id === 'tir')!;
    expect(resultClass(tir, 1)).toBe('Yes');
    expect(
      resultClass(
        tir,
        1,
        createTexts({}, () => 'vi'),
      ),
    ).toBe('Có');
  });

  it('fits sin(air angle) against sin(block angle) over runs both ways: the slope is n', async () => {
    const { game } = await lab(); // i 20°
    for (const direction of ['raise', 'lower'] as const) {
      for (const angle of ['raise', 'lower'] as const) {
        act(game, 'refraction-run', 'run');
        runUntilDone(game);
        act(game, 'refraction-reset', 'reset');
        act(game, 'refraction-dial-angle', angle); // 40°, then back to 20°
      }
      act(game, 'refraction-dial-direction', direction); // then out of the block
    }
    const { definition, history } = session(game);
    expect(history.map((h) => [h.inputs.direction, h.inputs.angle])).toEqual([
      [0, 20],
      [0, 40],
      [1, 20],
      [1, 40],
    ]);
    const rows = analysisRows(definition, definition.analyses[0]!, history);
    expect(new Set(rows.map((row) => row.groupKey)).size).toBe(1); // one line: n 1.49
    const fit = fitLine(rows);
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    expect(fit.slope).toBeCloseTo(1.49, 9);
    expect(fit.intercept).toBeCloseTo(0, 9);
  });

  it('offers only its presets, none refused, and the HUD follows it from its desk', async () => {
    const { game } = await lab();
    const stops: Record<string, number[]> = {};
    for (const [dialId, parameter, presets] of [
      ['refraction-dial-index', 'index', 4],
      ['refraction-dial-direction', 'direction', 2],
      ['refraction-dial-angle', 'angle', 4],
      ['refraction-dial-resolution', 'resolution', 4],
    ] as const) {
      dial(game, dialId, 'lower', presets);
      stops[parameter] = [];
      for (let i = 0; i < presets; i++) {
        expect(view(game).runBlock).toBeNull();
        stops[parameter].push(session(game).parameters[parameter]!);
        act(game, dialId, 'raise');
      }
      expect(act(game, dialId, 'raise')).toBe(false); // at the top already
    }
    expect(stops).toEqual({
      index: [1.33, 1.49, 1.52, 1.62],
      direction: [0, 1],
      angle: [20, 40, 60, 80],
      resolution: [0.5, 1, 2, 5],
    });
    placePlayer(game, [27.35, 0, -2.3]); // at its desk (the optics room moved 6 m east in Phase U-2)
    expect(game.stations.activeStation()?.id).toBe(BOARD);
  });
});
