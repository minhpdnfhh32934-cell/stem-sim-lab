import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { quantize } from '../../../simulation/measurement';
import { phModel } from '../../../simulation/models/ph';
import { POINT, SURFACE, phMeterStation, slotOf } from './ph-meter-station';

// The pH meter station against its item (as drafted for content): frame and rig stay in the item's
// box, the LCD reads the model's `reading` to the dialled resolution (dashes without a run), the arm
// lowers the electrode into the sample over the first 0.5 s of `immersionTime`, the tile's drop
// takes the universal indicator's colour at the model's `pH`, the dialled pair's bottle stands beside
// the beaker, posing only assigns, and it frees all it made.

const item = ItemDefinitionSchema.parse({
  id: 'ph-meter-station',
  displayName: 'pH meter and samples',
  category: 'equipment',
  physical: { massKg: 3 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'ph-meter-station', top: [0, 0, 0] },
  visual: { shape: 'box', size: [0.7, 0.45, 0.35], color: '#dfe3e6', material: 'painted' },
});
const [w, h, d] = item.visual.size;
/** The station's inputs at the definition draft's defaults (ethanoic acid, 0.1 mol/L, d 0.01). */
const INPUTS = {
  pKa: 4.76,
  baseFraction: 0,
  concentration: 0.1,
  kw: 1e-14,
  temperature: 25,
  timeConstant: 3,
  readTime: 30,
  startPH: 7,
  meterResolution: 0.01,
};
const pose = (
  status: BenchPose['status'],
  sample: Partial<Record<'immersionTime' | 'reading' | 'pH', number>>,
  parameters: Record<string, number> = INPUTS,
): BenchPose => ({
  status,
  parameters,
  sample: { immersionTime: NaN, reading: NaN, pH: NaN, potential: NaN, ...sample },
});
const idle = pose('configured', {});

/** A 2D context that draws nothing: every method a no-op, every property settable. */
function stubCanvas() {
  const context = new Proxy<Record<string, unknown>>(
    {},
    {
      get: (target, key) => target[key as string] ?? (() => undefined),
      set: (target, key, value) => ((target[key as string] = value), true),
    },
  );
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  });
}
afterEach(() => vi.unstubAllGlobals());

const MASKS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = phMeterStation.frame(item, painted);
  const rig = phMeterStation.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  const lcd = named('lcd') as THREE.InstancedMesh;
  const ink = new THREE.Color('#1c211d');
  const c = new THREE.Color();
  /** What the LCD shows, decoded from its segments' colours (the point after the units digit). */
  const read = () => {
    let text = '';
    for (let digit = 0; digit < POINT / 7; digit++) {
      let mask = 0;
      for (let s = 0; s < 7; s++) {
        lcd.getColorAt(digit * 7 + s, c);
        if (c.getHex() === ink.getHex()) mask |= 1 << s;
      }
      const glyph = MASKS.indexOf(mask);
      text += mask === 0 ? ' ' : mask === 0x40 ? '-' : glyph < 0 ? '?' : String(glyph);
      if (digit === 1) text += '.';
    }
    return text.trim();
  };
  /** The world box of what is drawn now. */
  const bounds = () => {
    root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(root, true);
  };
  return { frame, rig, root, painted, named, lcd, read, bounds };
}

const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => (n += c instanceof THREE.Mesh ? 1 : 0));
  return n;
};

describe('pH meter station bench model', () => {
  it('reads only variables the pH model outputs', () => {
    for (const v of phMeterStation.reads ?? []) expect(phModel.variables).toContain(v);
  });

  it('draws in a few meshes and keeps frame and rig, raised or lowered, inside the item’s box', () => {
    stubCanvas();
    const { frame, rig, root, bounds } = build();
    expect(meshes(frame.parts) + 1).toBe(6); // body + steel, plastic, glass, liquids, print
    expect(meshes(rig.group)).toBe(7); // lcd, arm steel, holder, electrode, cable, drop, bottles
    for (const p of [idle, pose('running', { immersionTime: 30, reading: 2.88, pH: 2.88 })]) {
      rig.pose(p, 0.1);
      const box = bounds();
      expect(box.min.y).toBeCloseTo(-h / 2, 6); // standing on the item's floor
      for (const [lo, hi, size] of [
        [box.min.x, box.max.x, w],
        [box.min.y, box.max.y, h],
        [box.min.z, box.max.z, d],
      ] as const) {
        expect(lo).toBeGreaterThanOrEqual(-size / 2 - 1e-6);
        expect(hi).toBeLessThanOrEqual(size / 2 + 1e-6);
      }
    }
    // bench.top [0, 0, 0] is the base centre on the item's floor.
    expect(rig.group.position.toArray()).toEqual([0, -h / 2, 0]);
    expect(root.getObjectByName('print')).toBeDefined();
    // renderOrder is global: never after the other bench models' glass (2).
    root.traverse((o) => expect(o.renderOrder).toBeLessThanOrEqual(2));
  });

  it('shows the reading to the dialled resolution, as the instrument reads it, dashes without a run', () => {
    const { rig, read } = build();
    rig.pose(idle, 1 / 60);
    expect(read()).toBe('--.--');
    const at = (reading: number, meterResolution: number) => {
      rig.pose(
        pose('running', { immersionTime: 1, reading, pH: 3 }, { ...INPUTS, meterResolution }),
        1 / 60,
      );
      return read();
    };
    expect(at(2.8834, 0.01)).toBe('2.88');
    expect(at(2.8834, 0.001)).toBe('2.883');
    expect(at(2.8834, 0.1)).toBe('2.9');
    expect(at(13.0004, 0.001)).toBe('13.000');
    expect(at(7, 0.01)).toBe('7.00');
    expect(at(0.5, 0.1)).toBe('0.5');
    expect(at(NaN, 0.001)).toBe('--.---');
    // The same number `quantize` gives, at every resolution, across the pH range (ties included).
    for (const res of [0.001, 0.01, 0.1]) {
      for (let i = 0; i <= 1400; i++) {
        const value = i / 100 + (i % 2 ? 0.005 : 0.0004);
        const shown = at(value, res);
        expect(Number(shown)).toBe(quantize(value, res));
        expect(shown.split('.')[1]?.length ?? 0).toBe(Math.round(-Math.log10(res)));
      }
    }
    // Completed: held at the last reading.
    rig.pose(pose('completed', { immersionTime: 30, reading: 2.8834, pH: 2.88 }), 1 / 60);
    expect(read()).toBe('2.88');
  });

  it('lowers the electrode into the sample over the first half second and raises it without a run', () => {
    const { rig, root, named } = build();
    const arm = named('arm');
    const electrode = named('electrode');
    const cable = named('cable');
    const floor = -h / 2;
    /** The bulb's lowest point above the item's floor. */
    const bulb = () => {
      electrode.geometry.computeBoundingBox();
      arm.updateMatrixWorld(true);
      return arm.position.y + electrode.geometry.boundingBox!.min.y;
    };
    rig.pose(idle, 1 / 60);
    const raised = bulb();
    expect(raised).toBeGreaterThan(0.076 + 0.03); // well clear of the beaker's rim
    rig.pose(pose('running', { immersionTime: 0, reading: 7, pH: 2.88 }), 1 / 60);
    expect(bulb()).toBe(raised);
    rig.pose(pose('running', { immersionTime: 0.25, reading: 6.9, pH: 2.88 }), 1 / 60);
    expect(bulb()).toBeLessThan(raised);
    expect(bulb()).toBeGreaterThan(SURFACE);
    rig.pose(pose('running', { immersionTime: 0.5, reading: 6.8, pH: 2.88 }), 1 / 60);
    const dipped = bulb();
    expect(dipped).toBeLessThan(SURFACE - 0.01); // the bulb more than 1 cm under the surface
    expect(dipped).toBeGreaterThan(0.006 + 0.0012); // and off the beaker's bottom
    rig.pose(pose('completed', { immersionTime: 30, reading: 2.88, pH: 2.88 }), 1 / 60);
    expect(bulb()).toBe(dipped);
    // The cable always reaches from the cap to the boom's clip, 0.386 m up.
    const top = () => {
      root.updateMatrixWorld(true);
      return new THREE.Vector3(0, 1, 0).applyMatrix4(cable.matrixWorld).y;
    };
    expect(top()).toBeCloseTo(floor + 0.386, 9);
    expect(cable.scale.y).toBeGreaterThan(0.1);
    rig.pose(idle, 1 / 60);
    expect(bulb()).toBe(raised);
    expect(top()).toBeCloseTo(floor + 0.386, 9);
  });

  it('colours the tile’s drop with the universal indicator at the model’s pH', () => {
    const { rig, named } = build();
    const drop = named('drop');
    const { color } = drop.material as THREE.MeshStandardMaterial;
    rig.pose(idle, 1 / 60);
    expect(drop.visible).toBe(false); // no run: nothing on the tile
    const at = (pH: number) => {
      rig.pose(pose('running', { immersionTime: 1, reading: 7, pH }), 1 / 60);
      expect(drop.visible).toBe(true);
      return { r: color.r, g: color.g, b: color.b };
    };
    const acid = at(1);
    expect(acid.r).toBeGreaterThan(3 * acid.g); // red
    const orange = at(4);
    expect(orange.r).toBeGreaterThan(orange.g);
    expect(orange.g).toBeGreaterThan(orange.b * 3);
    const neutral = at(7);
    expect(neutral.g).toBeGreaterThan(neutral.r); // green
    expect(neutral.g).toBeGreaterThan(neutral.b);
    const base = at(9);
    expect(base.b).toBeGreaterThan(base.r); // blue
    const alkali = at(13);
    expect(alkali.b).toBeGreaterThan(alkali.g); // violet
    expect(alkali.r).toBeGreaterThan(alkali.g);
    // Between whole values it blends; outside the chart it clamps (a drawing limit only).
    const half = at(6.5);
    const six = at(6);
    const seven = at(7);
    for (const k of ['r', 'g', 'b'] as const)
      expect(half[k]).toBeCloseTo((six[k] + seven[k]) / 2, 9);
    expect(at(15)).toEqual(at(14));
    rig.pose(pose('configured', {}), 1 / 60); // RESET
    expect(drop.visible).toBe(false);
  });

  it('stands the dialled pair’s bottle beside the beaker and the others in their slots', () => {
    const { rig, named } = build();
    const bottles = named('bottles') as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3();
    const where = (i: number) => {
      bottles.getMatrixAt(i, m);
      return v.setFromMatrixPosition(m).clone();
    };
    expect(bottles.count).toBe(4);
    rig.pose(pose('configured', {}, { ...INPUTS, pKa: NaN }), 1 / 60);
    const rack = [0, 1, 2, 3].map(where);
    for (const p of rack) expect(p.z).toBeLessThan(-0.08); // all in the rack at the back
    expect(slotOf(-6)).toBe(0);
    expect(slotOf(4.76)).toBe(1);
    expect(slotOf(9.25)).toBe(2);
    expect(slotOf(20)).toBe(3);
    expect(slotOf(NaN)).toBe(-1);
    for (const [pKa, slot] of [
      [-6, 0],
      [4.76, 1],
      [9.25, 2],
      [20, 3],
    ] as const) {
      rig.pose(pose('configured', {}, { ...INPUTS, pKa }), 1 / 60);
      for (let i = 0; i < 4; i++) {
        if (i === slot) {
          expect(where(i).z).toBeGreaterThan(0); // beside the beaker, at the front
          expect(where(i).y).toBe(0); // on the bench
        } else expect(where(i)).toEqual(rack[i]);
      }
    }
    // A run keeps the pair it was started with (the pose gives the run's inputs).
    rig.pose(
      pose('running', { immersionTime: 1, reading: 7, pH: 1 }, { ...INPUTS, pKa: -6 }),
      1 / 60,
    );
    expect(where(0).z).toBeGreaterThan(0);
    expect(where(1)).toEqual(rack[1]);
  });

  it('turns every face the way its normals point (glass shows its far wall from inside)', () => {
    stubCanvas();
    const { root } = build();
    const [a, b, c, n, t] = [1, 2, 3, 4, 5].map(() => new THREE.Vector3()) as [
      THREE.Vector3,
      THREE.Vector3,
      THREE.Vector3,
      THREE.Vector3,
      THREE.Vector3,
    ];
    const wrong: string[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const g = o.geometry as THREE.BufferGeometry;
      const p = g.getAttribute('position');
      const normal = g.getAttribute('normal');
      const index = g.index!;
      let bad = 0;
      let faces = 0;
      for (let i = 0; i < index.count; i += 3) {
        const [ia, ib, ic] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        a.fromBufferAttribute(p, ia);
        b.fromBufferAttribute(p, ib).sub(a);
        c.fromBufferAttribute(p, ic).sub(a);
        t.crossVectors(b, c);
        if (t.lengthSq() < 1e-14) continue; // degenerate (a lathe's axis)
        faces++;
        n.fromBufferAttribute(normal, ia)
          .add(t.set(0, 0, 0).fromBufferAttribute(normal, ib))
          .add(t.fromBufferAttribute(normal, ic));
        if (n.dot(a.crossVectors(b, c)) <= 0) bad++;
      }
      if (bad > faces * 0.01) wrong.push(`${o.name || 'body'}: ${bad}/${faces}`);
    });
    expect(wrong).toEqual([]);
  });

  it('poses by assignment: the same objects, materials and buffers, however often', () => {
    const { rig, root, lcd } = build();
    const snapshot = () => {
      const objects: unknown[] = [];
      root.traverse((o) => {
        objects.push(o);
        if (o instanceof THREE.Mesh) {
          const g = o.geometry as THREE.BufferGeometry;
          objects.push(o.material, g, g.getAttribute('position').array);
          if (o instanceof THREE.InstancedMesh) {
            objects.push(o.instanceMatrix.array);
            if (o.instanceColor) objects.push(o.instanceColor.array);
          }
        }
      });
      return objects;
    };
    const before = snapshot();
    for (let i = 0; i <= 200; i++) {
      const status = i % 3 ? 'running' : i % 2 ? 'stopped' : 'completed';
      rig.pose(
        pose(
          status,
          { immersionTime: i / 10, reading: 7 - i / 50, pH: 1 + i / 20 },
          {
            ...INPUTS,
            pKa: [-6, 4.76, 9.25, 20][i % 4] ?? 0,
            meterResolution: i % 2 ? 0.01 : 0.001,
          },
        ),
        1 / 60,
      );
    }
    rig.pose(idle, 1 / 60);
    const after = snapshot();
    expect(after.length).toBe(before.length);
    after.forEach((o, i) => expect(o).toBe(before[i]));
    // A reading that does not change to its last place rewrites no segment.
    rig.pose(pose('running', { immersionTime: 5, reading: 2.8834, pH: 2.88 }), 1 / 60);
    const version = lcd.instanceColor!.version;
    rig.pose(pose('running', { immersionTime: 5.1, reading: 2.8836, pH: 2.88 }), 1 / 60);
    expect(lcd.instanceColor!.version).toBe(version);
  });

  it('frees every geometry, material, instance buffer and the atlas, never the entity material', () => {
    stubCanvas();
    const { frame, rig, root, painted, named } = build();
    rig.pose(pose('running', { immersionTime: 3, reading: 3, pH: 2.88 }), 0.1);
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        made.add(o.geometry as THREE.BufferGeometry);
        made.add(o.material as THREE.Material);
      }
      if (o instanceof THREE.InstancedMesh) made.add(o);
    });
    const atlas = (named('print').material as THREE.MeshStandardMaterial).map!;
    made.add(atlas);
    made.delete(painted);
    const freed = new Set<unknown>();
    for (const r of made) r.addEventListener('dispose', () => freed.add(r));
    let paintedFreed = false;
    painted.addEventListener('dispose', () => (paintedFreed = true));
    frame.dispose();
    rig.dispose();
    expect(freed.size).toBe(made.size);
    expect(paintedFreed).toBe(false);
  });
});
