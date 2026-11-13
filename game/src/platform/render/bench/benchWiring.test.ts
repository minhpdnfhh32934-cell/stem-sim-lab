import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Disposables } from '../../../core/EventBus';
import { ENGLISH } from '../../../core/i18n';
import { benchFixture, ohmModel } from '../../../game/benchFixture';
import { bootTestGame } from '../../../game/testing';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { BUILT_IN_MODELS } from '../../../simulation/models';
import { deskReadings } from '../ExperimentView';
import { WorldRenderer } from '../WorldRenderer';
import type { BenchFrame, BenchRig } from './registry';

// A bench in the renderer, without WebGL (init() is never called; its subscriptions are made here,
// as in propsWiring.test.ts, whose private members it reads alike): the fixture's board drawn by
// its registered model and its rig posed from the station every frame; an item naming a model
// nothing builds drawn as its plain box, said once.

const H = 1 / 60;
const BOARD = 'physics-lab/demo-board-station';
/** The board again, twice, under a model key nothing builds. */
const LOST = {
  id: 'lost-board',
  displayName: 'Board',
  category: 'equipment',
  physical: { massKg: 2 },
  bench: { model: 'no-such-board', top: [0, 0.03, 0] },
  visual: { shape: 'box', size: [0.4, 0.03, 0.3], color: '#2e6b4f' },
};

interface Wiring {
  readonly subscriptions: Disposables;
  followScenes(s: Disposables): void;
  followEntities(s: Disposables): void;
  readonly views: ReadonlyMap<
    string,
    { readonly group: THREE.Group; readonly mesh: THREE.Mesh; readonly bench: BenchFrame | null }
  >;
  readonly geometries: ReadonlyMap<string, THREE.BufferGeometry>;
  readonly experiment: {
    attach(s: Disposables): void;
    update(dt: number): void;
    readonly rigs: ReadonlyMap<
      string,
      { readonly kind: string; readonly model: BenchRig | null; readonly pose: BenchPose | null }
    >;
  };
}

const cleanup: (() => void)[] = [];
beforeEach(() => {
  // Screens and labels draw on a canvas: none in Node (no 2D context, so nothing is painted).
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
});
afterEach(() => {
  for (const done of cleanup.splice(0)) done();
  vi.unstubAllGlobals();
});

/** The fixture (and two lost boards) in the Physics Lab, a renderer following it. */
async function withRenderer() {
  const content = benchFixture();
  const raw = content as unknown as {
    items: object[];
    rooms: { id: string; placements: object[] }[];
  };
  // One more under a key every object has: a registry lookup must not find Object.prototype's.
  raw.items.push(LOST, {
    ...LOST,
    id: 'proto-board',
    bench: { ...LOST.bench, model: 'constructor' },
  });
  raw.rooms
    .find((r) => r.id === 'physics-lab')!
    .placements.push(
      { id: 'lost-1', item: 'lost-board', position: [-0.2, 0.9, -1.8] },
      { id: 'lost-2', item: 'lost-board', position: [0.2, 0.9, -1.8] },
      { id: 'lost-3', item: 'proto-board', position: [0.6, 0.9, -1.8] },
    );
  const { game, logs } = await bootTestGame({ content, models: [...BUILT_IN_MODELS, ohmModel] });
  await game.newGame('researcher-male');
  const renderer = new WorldRenderer({} as HTMLElement, game, {} as HTMLCanvasElement);
  const view = renderer as unknown as Wiring;
  view.followScenes(view.subscriptions);
  view.followEntities(view.subscriptions);
  view.experiment.attach(view.subscriptions);
  await game.scenes.load('physics-lab');
  cleanup.push(() => {
    renderer.dispose();
    game.dispose();
  });
  /** A frame of the game, then of the experiment view, as the renderer runs them. */
  const frame = () => {
    game.update(H);
    view.experiment.update(H);
  };
  return { game, view, logs, frame };
}

describe('bench apparatus in the renderer', () => {
  it('draws the frame as the entity’s view and poses the rig from its station every frame', async () => {
    const { game, view, frame } = await withRenderer();
    const { group, mesh, bench } = view.views.get(BOARD)!;
    expect(bench).not.toBeNull();
    expect(mesh.geometry).toBe(bench!.body); // focus shows on the board
    expect(bench!.parts.parent).toBe(group);
    const rig = view.experiment.rigs.get(BOARD)!;
    expect(rig.kind).toBe('bench');
    expect(rig.model!.group.parent).toBe(group);
    const station = game.stations.view(BOARD);
    expect(station?.kind === 'bench' && rig.pose === station.pose).toBe(true); // its own object

    const lamp = rig.model!.group.getObjectByName('lamp') as THREE.Mesh;
    const gauge = rig.model!.group.getObjectByName('gauge')!;
    const off = lamp.material;
    expect(game.interaction.perform('physics-lab/demo-run', 'run')).toBe(true);
    for (let i = 0; i < 30; i++) frame(); // 0.5 s of the 1 s ramp to 2 V
    expect(lamp.material).not.toBe(off);
    const level = rig.pose!.sample.level!;
    expect(level).toBeGreaterThan(0.4);
    expect(gauge.scale.y).toBeCloseTo(level * 0.2, 12); // this frame's model state
    const definition = game.stations.view(BOARD)!.definition;
    // The lines the desk shows while running, pinned for a known sample. Not covered here: the
    // desk's canvas drawing (no 2D context in Node), which picks these lines, then the results.
    expect(deskReadings(definition, { v: 1.234567, i: 0.1234567, level: 0.6 }, ENGLISH)).toEqual([
      ['U', '1.235 V'],
      ['I', '0.1235 A'],
    ]);
    expect(deskReadings(definition, { v: NaN, i: NaN, level: NaN }, ENGLISH)).toEqual([
      ['U', 'NaN V'],
      ['I', 'NaN A'],
    ]);
    for (let i = 0; i < 60 && game.experiments.find(BOARD)?.state === 'running'; i++) frame();
    frame();
    expect(game.experiments.find(BOARD)?.state).toBe('completed');
    expect(lamp.material).toBe(off);
    expect(gauge.scale.y).toBeCloseTo(0.2, 12); // the full ramp
  });

  it('draws a bench whose model nothing builds as its plain box, said once, with nothing posed', async () => {
    const { view, logs } = await withRenderer();
    for (const id of ['physics-lab/lost-1', 'physics-lab/lost-2', 'physics-lab/lost-3']) {
      const lost = view.views.get(id)!;
      expect(lost.bench).toBeNull();
      expect(lost.mesh.geometry).toBe(view.geometries.get('box:0.4,0.03,0.3'));
      expect(view.experiment.rigs.get(id)?.model).toBeNull();
    }
    expect(logs.filter((l) => l.message.includes('no-such-board'))).toEqual([
      {
        level: 'warn',
        channel: 'SIMLAB',
        message: 'No bench model "no-such-board" (item "lost-board"): drawn as its box',
      },
    ]);
    expect(logs.filter((l) => l.message.includes('"constructor"'))).toHaveLength(1);
  });

  it('frees the frame and the rig with the view', async () => {
    const { view } = await withRenderer();
    const { bench } = view.views.get(BOARD)!;
    const rig = view.experiment.rigs.get(BOARD)!.model!;
    const freed: string[] = [];
    bench!.body.addEventListener('dispose', () => freed.push('frame'));
    (rig.group.getObjectByName('gauge') as THREE.Mesh).geometry.addEventListener('dispose', () =>
      freed.push('rig'),
    );
    for (const done of cleanup.splice(0)) done();
    expect(freed.sort()).toEqual(['frame', 'rig']);
    expect(view.experiment.rigs.size).toBe(0);
  });
});
