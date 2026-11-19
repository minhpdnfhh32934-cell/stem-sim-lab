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
import { lookKey, sharedKey } from '../assembly';
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

/**
 * Each placed bench model's settings: its experiment's parameters all at their minimum, default
 * and maximum, and the variables its model outputs.
 */
function settings(raw: RawContent) {
  const models = new Registry('simulation model', [...BUILT_IN_MODELS, ohmModel]);
  const c = buildContent(raw, { behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS), models });
  const out = new Map<string, { parameters: Record<string, number>[]; variables: string[] }>();
  for (const room of c.rooms.all()) {
    for (const placement of room.placements) {
      const bench = c.items.tryGet(placement.item)?.bench;
      const experiment = bench && c.experiments.tryGet(String(placement.params.experimentId));
      if (!experiment) continue;
      const entry = out.get(bench.model) ?? { parameters: [], variables: [] };
      for (const pick of ['min', 'default', 'max'] as const)
        entry.parameters.push(
          Object.fromEntries(experiment.parameters.map((p) => [p.id, p[pick]])),
        );
      entry.variables.push(...models.get(experiment.model).variables);
      out.set(bench.model, entry);
    }
  }
  return out;
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

  // A material an assembly shares (`own`) is every rig's with the same values: none may change it.
  const placed = settings(bundledContent);
  const benchItems = parsed(items);
  it.each(Object.keys(BENCH_MODELS))(
    '%s never changes a material it shares, built or posed',
    (key) => {
      const model = BENCH_MODELS[key]!;
      const { parameters = [{}], variables = ohmModel.variables } = placed.get(key) ?? {};
      const reads = [...new Set([...variables, ...(model.reads ?? [])])];
      const builds = benchItems.filter((i) => i.bench?.model === key);
      if (builds.length === 0)
        builds.push({ ...board, bench: { model: key, top: board.bench!.top } });
      const changed = new Set<string>();
      const check = (root: THREE.Object3D, when: string) =>
        root.traverse((o) => {
          for (const m of [(o as Partial<THREE.Mesh>).material ?? []].flat()) {
            const was = sharedKey(m);
            if (was !== undefined && lookKey(m) !== was)
              changed.add(`${when}: ${o.name || o.type}`);
          }
        });
      for (const item of builds) {
        const frame = model.frame(item, new THREE.MeshStandardMaterial());
        const rig = model.rig?.(item);
        const root = new THREE.Group().add(frame.parts, ...(rig ? [rig.group] : []));
        check(root, 'built');
        for (const scale of [0, 0.5, 1, Number.NaN]) {
          const sample = Object.fromEntries(
            reads.map((v) => [v, scale * (model.fullScale?.[v] || 1)]),
          );
          for (const values of parameters) {
            for (const status of STATES) {
              rig?.pose({ status, parameters: values, sample, state: () => scale === 1 }, 1 / 60);
              check(root, `${status} at ${scale}`);
            }
          }
        }
        frame.dispose();
        rig?.dispose();
      }
      expect([...changed]).toEqual([]);
    },
  );
});
