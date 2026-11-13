import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import itemsJson from '../../content/items.json';
import { type ContainerDefinition, ItemDefinitionSchema } from '../../gameplay/item';
import { heldBelow, levelIn } from '../../simulation/liquid';
import { shapeOf } from './ContainerView';
import { SQUARE_SCALE, VesselKit } from './vessels';

// The physical lab's vessels as their shipped items describe them (graphics-fidelity audit §3):
// each kind's own parts, where they stand, and that drawing them changes no volume.

const container = (id: string): ContainerDefinition => {
  const raw = itemsJson.find((i) => i.id === id);
  const item = ItemDefinitionSchema.parse(raw);
  if (!item.container) throw new Error(`${id} has no container`);
  return item.container;
};

const named = (parts: readonly THREE.Object3D[], name: string) =>
  parts.filter((p) => p.name === name);

const box = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object);

describe('vessel fittings (render/vessels.ts)', () => {
  it.each([1, 2, 5, 10])(
    'the %s mL pipette: a bulb, the mark on the stem above it, print on the bulb',
    (ml) => {
      const def = container(`dil-pipette-${ml}`);
      const profile = def.profile ?? [];
      const bulb = Math.max(...profile.map(([r]) => r));
      const top = Math.max(...profile.filter(([r]) => r === bulb).map(([, y]) => y));
      const mark = { y: 0, r: 0 };
      levelIn(profile, heldBelow(profile), ml, mark);
      expect(bulb).toBeGreaterThan(2.5 * (profile[profile.length - 1]?.[0] ?? 0)); // a bulb, not a tube
      expect(mark.y).toBeGreaterThan(top); // a volumetric pipette's single mark: on the upper stem
      expect(mark.r).toBe(profile[profile.length - 1]?.[0]);
      const kit = new VesselKit();
      const { fixed, closed } = kit.build(def, 'pipette');
      const [print] = named(fixed, 'print');
      expect(print).toBeDefined();
      const b = box(print!);
      expect(b.min.y).toBeGreaterThanOrEqual(
        Math.min(...profile.filter(([r]) => r === bulb).map(([, y]) => y)) - 1e-9,
      );
      expect(b.max.y).toBeLessThanOrEqual(top + 1e-9);
      expect(closed).toEqual([]);
      kit.dispose();
    },
  );

  it('a stock bottle: its label round the body, a screw cap only to show while closed', () => {
    const kit = new VesselKit();
    const { fixed, closed } = kit.build(
      container('dil-stock-20'),
      'Crystal violet stock, 20.0 µmol/L',
    );
    expect(named(fixed, 'label')).toHaveLength(1);
    expect(named(closed, 'stopper')).toHaveLength(1);
    kit.dispose();
  });

  it('a volumetric flask: print on the bulb, an octagonal-head stopper while closed', () => {
    const kit = new VesselKit();
    const def = container('dil-flask-50');
    const { fixed, closed } = kit.build(def, 'flask');
    expect(named(fixed, 'print')).toHaveLength(1);
    const [stopper] = named(closed, 'stopper');
    expect(stopper?.position.toArray()).toEqual(def.mouth?.center);
    kit.dispose();
  });

  it('the wash bottle: its delivery tube ends at the pour spout, inside the item box', () => {
    const kit = new VesselKit();
    const def = container('dil-wash-bottle');
    const spout = new THREE.Vector3(...(def.pour?.spout ?? [0, 0, 0]));
    const [nozzle] = named(kit.build(def, 'wash bottle').fixed, 'nozzle');
    const position = (nozzle as THREE.Mesh).geometry.getAttribute('position');
    let nearest = Infinity;
    const p = new THREE.Vector3();
    for (let i = 0; i < position.count; i++)
      nearest = Math.min(nearest, p.fromBufferAttribute(position, i).distanceTo(spout));
    expect(nearest).toBeLessThan(0.003); // the tube's open end, 2.2 mm round the spout
    expect(Math.hypot(spout.x, spout.z)).toBeGreaterThan(0.02); // a nozzle out past the cap
    kit.dispose();
  });

  it('the cuvette is square, with the area of its profile’s circle: the level mapping stays exact', () => {
    const def = container('dilution-colorimeter');
    const profile = def.profile ?? [];
    const r = profile[0]?.[0] ?? 0;
    const shape = shapeOf(profile, true);
    shape.liquid.computeBoundingBox();
    const size = shape.liquid.boundingBox!.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(size.z, 9);
    expect(size.x * size.z).toBeCloseTo(Math.PI * (r - 0.0003) ** 2, 9); // the inside, inset 0.3 mm
    expect(SQUARE_SCALE).toBeCloseTo(Math.sqrt(Math.PI / 2), 12);
    shape.glass.dispose();
    shape.liquid.dispose();
  });
});
