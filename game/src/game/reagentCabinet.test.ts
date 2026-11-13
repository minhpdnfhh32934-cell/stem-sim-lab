import { describe, expect, it } from 'vitest';
import { Registry } from '../core/Registry';
import { bundledContent } from '../content';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { BUILT_IN_MODELS } from '../simulation/models';
import { buildContent, type Content, type RawContent } from './content';

// The reagent cabinet holds only what a migrated experiment lists (docs/physical-lab-architecture.md
// §2.3, decision 13; spec map G1: the cabinet itself is the user's direction, not the spec). A
// placement standing inside a cabinet must be a container bound to a `physical-lab` experiment: its
// `piece` one of that experiment's pieces and its `material` (if any) one of its materials — so
// nothing can be shelved there that no experiment's definition names.

const code = {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', BUILT_IN_MODELS),
};
const build = (raw: RawContent) => buildContent(raw, code);

/** Whether the point (x, y, z) is inside the box of `size` turned by `yaw` about +y at `base`. */
function within(
  [px, py, pz]: readonly number[],
  [bx, by, bz]: readonly number[],
  yaw: number,
  [w, h, d]: readonly number[],
): boolean {
  const dx = (px ?? 0) - (bx ?? 0);
  const dz = (pz ?? 0) - (bz ?? 0);
  const u = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const v = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const y = (py ?? 0) - (by ?? 0);
  return Math.abs(u) <= (w ?? 0) / 2 && Math.abs(v) <= (d ?? 0) / 2 && y >= 0 && y <= (h ?? 0);
}

/** Why a placement stands in a cabinet it does not belong in, for every cabinet of the content. */
export function cabinetProblems(c: Content): string[] {
  const problems: string[] = [];
  for (const room of c.rooms.all()) {
    const cabinets = room.placements.filter(
      (p) => c.items.tryGet(p.item)?.visual.prop === 'reagent-cabinet',
    );
    for (const cabinet of cabinets) {
      const size = c.items.get(cabinet.item).visual.size;
      for (const p of room.placements) {
        if (p === cabinet || !within(p.position, cabinet.position, cabinet.rotationY, size))
          continue;
        const where = `${room.id}/${p.id} in ${room.id}/${cabinet.id}`;
        const item = c.items.tryGet(p.item);
        const { piece, material, station } = p.params;
        const apparatus = room.placements.find((q) => q.id === station);
        const experiment = c.experiments.tryGet(String(apparatus?.params.experimentId));
        const workspace = experiment?.workspace;
        if (!item?.container || typeof piece !== 'string') {
          problems.push(`${where}: not a container bound to an experiment's piece`);
        } else if (experiment?.presentation !== 'physical-lab' || !workspace) {
          problems.push(`${where}: its station is not a "physical-lab" experiment`);
        } else if (!workspace.pieces.some((x) => x.id === piece)) {
          problems.push(`${where}: "${piece}" is no piece of "${experiment.id}"`);
        } else if (material !== undefined && !workspace.materials.some((m) => m.id === material)) {
          problems.push(`${where}: "${String(material)}" is no material of "${experiment.id}"`);
        }
      }
    }
  }
  return problems;
}

/** The raw chemistry lab's placements, to put something else in the cabinet. */
const chemistry = (raw: RawContent) =>
  (raw.rooms as { id: string; placements: Record<string, unknown>[] }[]).find(
    (r) => r.id === 'chemistry-lab',
  )!.placements;

describe('the reagent cabinet', () => {
  it('holds exactly the dilution slice’s glassware, each a piece and material of the experiment', () => {
    const c = build(bundledContent);
    expect(cabinetProblems(c)).toEqual([]);
    const room = c.rooms.get('chemistry-lab');
    const cabinet = room.placements.find((p) => p.item === 'chem-reagent-cabinet')!;
    const size = c.items.get('chem-reagent-cabinet').visual.size;
    const held = room.placements
      .filter((p) => p !== cabinet && within(p.position, cabinet.position, cabinet.rotationY, size))
      .map((p) => `${String(p.params.piece)}:${String(p.params.material)}`)
      .sort();
    expect(held).toEqual(
      [
        ...[5, 10, 20, 40].map((n) => `stock-bottle:stock-${n}`),
        ...[25, 50, 100, 250].map((n) => `flask:flask-${n}`),
        ...[1, 2, 5, 10].map((n) => `pipette:pipette-${n}`),
        'wash-bottle:water',
      ].sort(),
    );
  });

  it('refuses anything else shelved in it: a stool, a ball', () => {
    const raw = structuredClone(bundledContent);
    const at = [3.286, 1.5, -10.71];
    chemistry(raw).push(
      { id: 'a-stool', item: 'lab-stool', position: at },
      { id: 'a-ball', item: 'steel-ball', position: [3.486, 1, -10.71] },
    );
    expect(cabinetProblems(build(raw))).toEqual([
      expect.stringContaining(
        'a-stool in chemistry-lab/reagent-cabinet: not a container',
      ) as string,
      expect.stringContaining('a-ball in chemistry-lab/reagent-cabinet: not a container') as string,
    ]);
  });

  it('refuses a piece or material the definition does not list (content validation does too)', () => {
    const raw = structuredClone(bundledContent);
    chemistry(raw).push({
      id: 'a-beaker',
      item: 'dil-flask-50',
      position: [3.486, 1, -10.71],
      params: { station: 'dilution', piece: 'beaker', material: 'flask-50' },
    });
    expect(() => build(raw)).toThrow(/"beaker" is no piece of "dilution"/);
  });
});
