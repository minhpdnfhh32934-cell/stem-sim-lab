import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import { Registry } from '../../../core/Registry';
import { buildContent, type RawContent } from '../../../game/content';
import { BUILT_IN_BEHAVIORS } from '../../../gameplay/interaction/behaviors';
import { BUILT_IN_MODELS } from '../../../simulation/models';
import { benchFixture, ohmModel } from '../../../game/benchFixture';
import { type ItemDefinition, ItemDefinitionSchema } from '../../../gameplay/item';
import type { SessionState } from '../../../simulation/ExperimentSession';
import type { SimulationModel } from '../../../simulation/SimulationModel';
import { BENCH_MODELS, benchModel } from './registry';

// Every bench model content names has a builder (none ships yet: the check runs on what will),
// and every registered builder frees all it makes and leaves the entity material alone.

const parsed = (raw: readonly unknown[]) => raw.map((item) => ItemDefinitionSchema.parse(item));
/** Bench items whose model nothing builds. */
const unbuilt = (list: readonly ItemDefinition[]) =>
  list.flatMap((item) => (item.bench && !benchModel(item.bench.model) ? [item.id] : []));

/** What the game boots: every item file, not one of them. */
const items = bundledContent.items as unknown[];
const board = parsed(benchFixture().items as unknown[]).find((i) => i.id === 'fixture-board')!;

/** Each placed bench whose rig reads a variable its experiment's model does not output. */
function unread(raw: RawContent, ohm: SimulationModel = ohmModel): string[] {
  const models = new Registry('simulation model', [...BUILT_IN_MODELS, ohm]);
  const c = buildContent(raw, { behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS), models });
  return c.rooms.all().flatMap((room) =>
    room.placements.flatMap((placement) => {
      const bench = c.items.tryGet(placement.item)?.bench;
      const experiment = bench && c.experiments.tryGet(String(placement.params.experimentId));
      if (!experiment) return [];
      const outputs = models.get(experiment.model).variables;
      const reads = benchModel(bench.model)?.reads ?? [];
      return reads
        .filter((v) => !outputs.includes(v))
        .map((v) => `${room.id}/${placement.id}: ${v}`);
    }),
  );
}

const STATES: readonly SessionState[] = ['idle', 'configured', 'running', 'stopped', 'completed'];

describe('bench models', () => {
  it('has a model for every bench item in content, and names the item that has none', () => {
    expect(unbuilt(parsed(items))).toEqual([]);
    const lost = (id: string, model: string) =>
      ItemDefinitionSchema.parse({ ...board, id, bench: { model, top: [0, 0, 0] } });
    expect(
      unbuilt([
        ...parsed(items),
        board,
        lost('lost-board', 'no-such-board'),
        lost('proto', 'constructor'),
      ]),
    ).toEqual(['lost-board', 'proto']);
  });

  it('poses each placed bench only from variables its experiment’s model outputs', () => {
    expect(unread(bundledContent)).toEqual([]);
    expect(unread(benchFixture())).toEqual([]);
    const noLevel = { ...ohmModel, variables: ohmModel.variables.filter((v) => v !== 'level') };
    expect(unread(benchFixture(), noLevel)).toEqual(['physics-lab/demo-board-station: level']);
  });

  it('draws the buoyancy rig at full scale from its definition’s largest values', () => {
    const definition = (
      bundledContent.experiments as {
        id: string;
        parameters: { id: string; max: number }[];
        initialConditions: Record<string, number>;
      }[]
    ).find((e) => e.id === 'buoyancy')!;
    const max = (id: string) => definition.parameters.find((p) => p.id === id)!.max;
    const { gravity, clearance } = definition.initialConditions;
    const a = max('edgeLength');
    const full = BENCH_MODELS['buoyancy-rig']!.fullScale!;
    // The cube lowered a + c; all of it under; the sensor's largest reading, its weight in air.
    expect(full.depth).toBeCloseTo(a + clearance!, 12);
    expect(full.submergedVolume).toBeCloseTo(a ** 3, 12);
    expect(full.reading).toBeCloseTo(max('objectDensity') * a ** 3 * gravity!, 9);
  });

  it.each(Object.keys(BENCH_MODELS))(
    '%s frees every geometry, material and instance buffer it made, never the entity material',
    (key) => {
      const model = BENCH_MODELS[key]!;
      const item = { ...board, bench: { model: key, top: board.bench!.top } };
      const painted = new THREE.MeshStandardMaterial();
      const frame = model.frame(item, painted);
      const rig = model.rig?.(item);
      const root = new THREE.Group();
      root.add(new THREE.Mesh(frame.body, painted), frame.parts, ...(rig ? [rig.group] : []));
      // Posed in every state first, with every variable of the board's fixture model, so a
      // material swapped in by any pose is on a mesh too.
      const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
      const collect = () =>
        root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            made.add(o.geometry as THREE.BufferGeometry);
            made.add(o.material as THREE.Material);
          }
          if (o instanceof THREE.InstancedMesh) made.add(o);
        });
      const sample = Object.fromEntries(ohmModel.variables.map((v) => [v, 0.5]));
      for (const status of STATES) {
        rig?.pose({ status, parameters: {}, sample }, 1 / 60);
        collect();
      }
      made.delete(painted);
      const freed = new Set<unknown>();
      for (const resource of made) resource.addEventListener('dispose', () => freed.add(resource));
      let paintedFreed = false;
      painted.addEventListener('dispose', () => (paintedFreed = true));
      frame.dispose();
      rig?.dispose();
      expect(freed.size).toBe(made.size);
      expect(paintedFreed).toBe(false);
    },
  );
});
