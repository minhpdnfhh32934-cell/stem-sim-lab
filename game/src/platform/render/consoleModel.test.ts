import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import items from '../../content/items.json';
import labPlacements from '../../content/lab-placements.json';
import { type ItemDefinition, ItemDefinitionSchema } from '../../gameplay/item';
import { type ControlModel, controlShapes } from './consoleModel';

// The station controls against the items that use them and where the rooms place them: every
// shape is finite and inside its item's box (the collider and the interaction box) — but the
// display's foot, which reaches behind and before the screen; each stands on its box's bottom; the
// desk's top is its box's top; and every control placed on a desk sits on its top, inside its edge.

const ITEMS = new Map(
  items.map((raw) => {
    const item = ItemDefinitionSchema.parse(raw);
    return [item.id, item] as const;
  }),
);
const CONTROLS = [...ITEMS.values()].filter((i) => i.visual.model);
const MODELS: ControlModel[] = ['desk', 'push-button', 'knob', 'display'];

function boxOf(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

describe('station control models', () => {
  it('are used: every model by at least one item', () => {
    for (const model of MODELS) expect(CONTROLS.some((i) => i.visual.model === model)).toBe(true);
  });

  describe.each(CONTROLS.map((i) => [i.id, i] as const))('%s', (_, item: ItemDefinition) => {
    const [w, h, d] = item.visual.size;
    const shapes = controlShapes(item.visual.model!, item.visual.size);
    const parts = [shapes.body, shapes.trim].filter((g) => g !== null);

    it('is finite, with unit normals and indices in range', () => {
      for (const geometry of parts) {
        const position = geometry.getAttribute('position');
        const normal = geometry.getAttribute('normal');
        for (let i = 0; i < position.count; i++) {
          const p = new THREE.Vector3().fromBufferAttribute(position, i);
          expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
          expect(new THREE.Vector3().fromBufferAttribute(normal, i).length()).toBeCloseTo(1, 5);
        }
        const index = geometry.getIndex();
        if (index)
          for (let i = 0; i < index.count; i++) expect(index.getX(i)).toBeLessThan(position.count);
      }
    });

    it('stays inside its box, standing on its bottom', () => {
      const e = 1e-6; // float32 positions
      for (const geometry of parts) {
        const box = boxOf(geometry);
        expect(box.min.y).toBeGreaterThanOrEqual(-h / 2 - e);
        expect(box.max.y).toBeLessThanOrEqual(h / 2 + e);
        expect(box.min.x).toBeGreaterThanOrEqual(-w / 2 - e);
        expect(box.max.x).toBeLessThanOrEqual(w / 2 + e);
        // The display's foot reaches 2 cm before and behind its 4 cm screen, under its bottom.
        const reach = geometry === shapes.trim && item.visual.model === 'display' ? 0.04 : d / 2;
        expect(box.min.z).toBeGreaterThanOrEqual(-reach - e);
        expect(box.max.z).toBeLessThanOrEqual(reach + e);
      }
      // Its lowest part (a plinth, a bezel, a skirt, a foot) on the box's bottom, and the body up
      // to the box's top (the desk's top board, a button's cap, a knob's top).
      expect(Math.min(...parts.map((g) => boxOf(g).min.y))).toBeCloseTo(-h / 2, 6);
      expect(boxOf(shapes.body).max.y).toBeCloseTo(h / 2, 6);
    });
  });

  it('puts every control placed on a desk on its top board', () => {
    let checked = 0;
    for (const room of labPlacements) {
      // Control desks and their controls are lab items, placed by the lab pack.
      // A desk's half extents along x and z, turned a quarter turn or not (the Biology Lab's
      // west desk faces east).
      const half = (k: (typeof room.placements)[number]) => {
        const [w, , d] = ITEMS.get(k.item)!.visual.size;
        const turned = Math.abs(Math.sin('rotationY' in k ? k.rotationY : 0)) > 0.5;
        return turned ? [d / 2, w / 2] : [w / 2, d / 2];
      };
      // A control stands on a control desk, or on the lab bench its own station's apparatus stands
      // on: the dilution bench is the physical lab's, its dial and two buttons beside the
      // glassware, with no desk.
      const desks = room.placements.filter((p) => ITEMS.get(p.item)?.visual.model === 'desk');
      const benches = room.placements.filter((p) =>
        ITEMS.get(p.item)?.tags.includes('work-surface'),
      );
      const on = (k: (typeof room.placements)[number], [x = 0, , z = 0]: readonly number[]) => {
        const [hx = 0, hz = 0] = half(k);
        return Math.abs(x - (k.position[0] ?? 0)) < hx && Math.abs(z - (k.position[2] ?? 0)) < hz;
      };
      for (const p of room.placements) {
        const item = ITEMS.get(p.item);
        const model = item?.visual.model;
        if (!item || !model || model === 'desk') continue;
        const [px = 0, py = 0, pz = 0] = p.position;
        const station = (p as { params?: { station?: string } }).params?.station;
        const apparatus = room.placements.find((q) => q.id === station);
        const desk =
          desks.find((k) => on(k, p.position)) ??
          (apparatus && benches.find((k) => on(k, p.position) && on(k, apparatus.position)));
        expect(desk, `${room.room}/${p.id} stands on a desk`).toBeDefined();
        const [kx = 0, ky = 0, kz = 0] = desk!.position;
        const dh = ITEMS.get(desk!.item)!.visual.size[1];
        const [hx = 0, hz = 0] = half(desk!);
        expect(py).toBeCloseTo(ky + dh, 9); // on the top board
        // The control's footprint, turned as placed, on the top. (Two displays end flush with
        // their desk's end, as they were placed; nothing reaches past it.)
        const shapes = controlShapes(model, item.visual.size);
        const turn = new THREE.Matrix4().makeRotationY('rotationY' in p ? p.rotationY : 0);
        for (const geometry of [shapes.body, shapes.trim].filter((g) => g !== null)) {
          const box = boxOf(geometry).clone().applyMatrix4(turn);
          const x = Math.max(Math.abs(box.min.x + px - kx), Math.abs(box.max.x + px - kx));
          const z = Math.max(Math.abs(box.min.z + pz - kz), Math.abs(box.max.z + pz - kz));
          expect(x).toBeLessThanOrEqual(hx + 1e-6);
          expect(z).toBeLessThanOrEqual(hz + 1e-6);
        }
        checked++;
      }
    }
    // 109 on the 14 desks of Phase T-1a (the older Chemistry and Biology stations work in
    // workspaces), 46 on the six desks of T-2, T-5 and T-6, 52 on the seven of T-3 (24 knobs, 21
    // buttons, 7 displays), and the dilution and titration benches' dial, RESET and Clear the
    // bench on their lab benches; T-6b's Biology desks, 8 each (4 knobs, 3 buttons, a display:
    // respiration, pea cross) and 7 at mark and recapture and at the food tests (3 knobs); T-4's
    // seven Physics desks, 53. Phase X: the practice room's desks, 8 each.
    expect(checked).toBe(520);
  });
});
