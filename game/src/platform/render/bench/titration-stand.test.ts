import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { titrationModel, titrationPH } from '../../../simulation/models/titration';
import {
  baseFraction,
  buretteLevel,
  flaskLevel,
  indicatorFor,
  titrationStand,
} from './titration-stand';

// The titration stand against its item (as drafted for content): the frame and the rig stay in the
// item's box, the burette's column falls 9 mm per mL from the 0 mark, the flask holds the acid
// sample plus the volume delivered, its colour is the indicator's at the model's pH, the tap is open
// and drops fall only while a run is in progress, posing only assigns, and it frees all it made.

const item = ItemDefinitionSchema.parse({
  id: 'titration-stand',
  displayName: 'Titration stand',
  category: 'equipment',
  physical: { massKg: 4 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'titration-stand', top: [-0.16, 0.018, -0.02] },
  visual: { shape: 'box', size: [0.56, 0.76, 0.34], color: '#34465c', material: 'painted' },
});
const [w, h, d] = item.visual.size;
/** The station's inputs at its defaults (definition draft: 25 mL, 0.1 mol/L, phenolphthalein). */
const INPUTS = {
  acidConcentration: 0.085,
  acidVolume: 25,
  baseConcentration: 0.1,
  kw: 1e-14,
  flowRate: 0.25,
  endpointPH: 8.2,
};
const pose = (
  status: BenchPose['status'],
  volume: number,
  pH: number,
  parameters: Record<string, number> = INPUTS,
): BenchPose => ({ status, parameters, sample: { volume, pH, inferredAcidConcentration: NaN } });
const idle = pose('configured', NaN, NaN);

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

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = titrationStand.frame(item, painted);
  const rig = titrationStand.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  /** The world box of what is drawn now. */
  const bounds = () => {
    root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(root, true);
  };
  return { frame, rig, root, painted, named, bounds };
}

const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => (n += c instanceof THREE.Mesh ? 1 : 0));
  return n;
};

describe('titration stand bench model', () => {
  it('reads only variables the titration model outputs', () => {
    for (const v of titrationStand.reads ?? []) expect(titrationModel.variables).toContain(v);
  });

  it('draws in a few meshes and keeps frame and rig, at full scale, inside the item’s box', () => {
    stubCanvas();
    const { frame, rig, root, bounds } = build();
    expect(meshes(frame.parts) + 1).toBe(6); // body + steel, plastic, glass, NaOH, print
    expect(meshes(rig.group)).toBe(5); // column, solution and its sheen, stopcock, drops
    for (const p of [idle, pose('running', 50, 12.6, { ...INPUTS, acidVolume: 25 })]) {
      rig.pose(p, 0.1);
      const box = bounds();
      expect(box.min.y).toBeCloseTo(-h / 2, 6); // the foot on the item's floor
      for (const [lo, hi, size] of [
        [box.min.x, box.max.x, w],
        [box.min.y, box.max.y, h],
        [box.min.z, box.max.z, d],
      ] as const) {
        expect(lo).toBeGreaterThanOrEqual(-size / 2 - 1e-6);
        expect(hi).toBeLessThanOrEqual(size / 2 + 1e-6);
      }
    }
    // bench.top [-0.16, 0.018, -0.02] is from the base: the tile's top under the burette.
    expect(rig.group.position.toArray().map((v) => +v.toFixed(9))).toEqual([
      -0.16,
      0.018 - h / 2,
      -0.02,
    ]);
    expect(root.getObjectByName('print')).toBeDefined();
    // renderOrder is global: never after the other bench models' glass (2).
    root.traverse((o) => expect(o.renderOrder).toBeLessThanOrEqual(2));
  });

  it('lowers the burette’s column by the volume delivered and fills the flask with the sample', () => {
    const { rig, named } = build();
    const column = named('column');
    const solution = named('solution');
    const top = (m: THREE.Mesh) => {
      m.geometry.computeBoundingBox();
      return m.position.y + m.geometry.boundingBox!.max.y * m.scale.y;
    };
    rig.pose(idle, 1 / 60); // no run: full to the 0 mark, the 25 mL sample in the flask
    expect(top(column)).toBeCloseTo(0.68, 9);
    expect(buretteLevel(NaN)).toBe(0.68);
    const idleLevel = top(solution);
    rig.pose(pose('running', 21.25, 7), 1 / 60);
    expect(top(column)).toBeCloseTo(0.68 - 21.25 * 0.009, 9);
    expect(top(solution)).toBeGreaterThan(idleLevel);
    // The drawn frustum holds what is in the flask: the 25 mL sample plus 21.25 mL, read from the
    // posed mesh's rings (radius, height above its bottom ring).
    const p = solution.geometry.getAttribute('position');
    let [y0, y1, r0, r1] = [Infinity, -Infinity, 0, 0];
    for (let i = 0; i < p.count; i++) {
      const [y, r] = [p.getY(i), Math.hypot(p.getX(i), p.getZ(i))];
      if (y < y0 - 1e-9) [y0, r0] = [y, r];
      else if (Math.abs(y - y0) < 1e-9) r0 = Math.max(r0, r);
      if (y > y1 + 1e-9) [y1, r1] = [y, r];
      else if (Math.abs(y - y1) < 1e-9) r1 = Math.max(r1, r);
    }
    const drawn = ((Math.PI * (y1 - y0)) / 3) * (r0 * r0 + r0 * r1 + r1 * r1) * 1e6;
    expect(drawn).toBeCloseTo(46.25, 3);
    const level = flaskLevel(46.25);
    const { radius: R, slope: k } = { radius: 0.0425 - 0.0015 - 0.0004, slope: 0.0255 / 0.1025 };
    const r = R - k * level;
    const ml = ((Math.PI * level) / 3) * (R * R + R * r + r * r) * 1e6;
    expect(ml).toBeCloseTo(46.25, 6);
    expect(level).toBeGreaterThan(0.005);
    expect(level).toBeLessThan(0.02);
    rig.pose(pose('configured', NaN, NaN, { ...INPUTS, acidVolume: 10 }), 1 / 60); // smaller pipette
    expect(top(solution)).toBeLessThan(idleLevel);
  });

  it('colours the flask by the indicator the endpoint names, at the model’s pH', () => {
    const { rig, named } = build();
    const solution = named('solution');
    const material = solution.material as THREE.MeshBasicMaterial;
    const { color } = material;
    // Drawn after the glass, so the flask's far wall never washes it out.
    expect(solution.renderOrder).toBeGreaterThan(named('glass').renderOrder);
    // A filter, not paint: what is behind it times its colour (premultiplied multiply, opacity 1),
    // so a dark background stays dark through it; its sheen adds highlights only (black, additive).
    expect(material.blending).toBe(THREE.MultiplyBlending);
    expect(material.premultipliedAlpha).toBe(true);
    expect(material.toneMapped).toBe(false);
    expect(material.opacity).toBe(1);
    const sheen = named('sheen').material as THREE.MeshStandardMaterial;
    expect(sheen.blending).toBe(THREE.AdditiveBlending);
    expect(sheen.color.getHex()).toBe(0);
    /** What is seen through the liquid over a background (1: the white tile). */
    const at = (ph: number, endpointPH: number, behind = 1) => {
      rig.pose(pose('running', 1, ph, { ...INPUTS, endpointPH }), 1 / 60);
      return { r: behind * color.r, g: behind * color.g, b: behind * color.b };
    };
    const srgb = (linear: number) => new THREE.Color(linear, 0, 0).convertLinearToSRGB().r * 255;
    // The change must show on screen: phenolphthalein's first pink against neutral, in sRGB.
    const pink = at(8.2, 8.2);
    const clear = at(7, 8.2);
    expect(srgb(clear.g) - srgb(pink.g)).toBeGreaterThan(15);
    for (const c of [pink, clear]) for (const v of Object.values(c)) expect(v).toBeLessThan(1);
    // Phenolphthalein: colourless in acid, faint pink at its endpoint 8.2, deep pink by 10.
    const start = at(titrationPH(INPUTS, 0), 8.2);
    expect(start.g / start.r).toBeGreaterThan(1); // the clear solution's own tint
    const neutral = at(7, 8.2);
    expect(neutral.g / neutral.r).toBeGreaterThan(0.99);
    const faint = at(8.2, 8.2);
    expect(faint.g / faint.r).toBeLessThan(0.9);
    expect(faint.g / faint.r).toBeGreaterThan(0.6);
    const deep = at(10, 8.2);
    expect(deep.g / deep.r).toBeLessThan(0.2);
    expect(deep.b).toBeGreaterThan(deep.g); // magenta, not red
    // Methyl orange: red in the acid, yellow (orange-yellow) at its endpoint 4.4.
    const red = at(titrationPH(INPUTS, 0), 4.4);
    expect(red.g / red.r).toBeLessThan(0.1);
    const yellow = at(4.4, 4.4);
    expect(yellow.g / yellow.r).toBeGreaterThan(0.35);
    expect(yellow.b / yellow.r).toBeLessThan(0.05);
    // Over the dark foot the coloured solution stays as dark as what is behind it.
    const dark = at(4.4, 4.4, 0.05);
    for (const v of Object.values(dark)) expect(v).toBeLessThanOrEqual(0.05);
    // The real equilibrium: phenolphthalein is 6 % pink at 8.2, methyl orange 90 % yellow at 4.4.
    expect(baseFraction(indicatorFor(8.2), 8.2)).toBeCloseTo(1 / (1 + 10 ** 1.2), 12);
    expect(baseFraction(indicatorFor(4.4), 4.4)).toBeCloseTo(1 / (1 + 10 ** -0.93), 12);
    expect(baseFraction(indicatorFor(8.2), NaN)).toBe(0); // no run: the acid form
  });

  it('opens the stopcock and lets drops fall only while a run is in progress', () => {
    const { rig, named } = build();
    const key = named('stopcock');
    const drops = named('drops') as THREE.InstancedMesh;
    rig.pose(idle, 1 / 60);
    expect(key.rotation.x).toBeCloseTo(Math.PI / 2, 12); // handle across the burette: closed
    expect(drops.count).toBe(0);
    // Their own, denser material: not the column's faint one.
    const dropLook = drops.material as THREE.MeshStandardMaterial;
    expect(dropLook).not.toBe(named('column').material);
    expect(dropLook.opacity).toBeGreaterThan(0.5);
    const solution = named('solution');
    const m = new THREE.Matrix4();
    let seen = 0;
    // 1 ms steps: a drop that fell past the surface would show within a few of them.
    for (let i = 0; i < 1000; i++) {
      rig.pose(pose('running', i / 4000, 1.2), 1 / 1000);
      seen = Math.max(seen, drops.count);
      solution.geometry.computeBoundingBox();
      const surface = solution.position.y + solution.geometry.boundingBox!.max.y; // stand frame
      for (let n = 0; n < drops.count; n++) {
        drops.getMatrixAt(n, m);
        const y = new THREE.Vector3().setFromMatrixPosition(m).y;
        expect(y).toBeLessThanOrEqual(0.15); // below the tip,
        expect(y).toBeGreaterThanOrEqual(surface - 1e-6); // never under the liquid's surface
      }
    }
    expect(key.rotation.x).toBe(0); // handle along the burette: open
    expect(seen).toBeGreaterThan(0);
    rig.pose(pose('completed', 21.2507, 8.2), 1 / 60);
    expect(key.rotation.x).toBeCloseTo(Math.PI / 2, 12);
    expect(drops.count).toBe(0);
    rig.pose(pose('running', 1, 1.2, { ...INPUTS, flowRate: 0 }), 1); // no flow: no drops
    expect(drops.count).toBe(0);
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
    const { rig, root } = build();
    const snapshot = () => {
      const objects: unknown[] = [];
      root.traverse((o) => {
        objects.push(o);
        if (o instanceof THREE.Mesh) {
          const g = o.geometry as THREE.BufferGeometry;
          objects.push(o.material, g, g.getAttribute('position').array);
          if (o instanceof THREE.InstancedMesh) objects.push(o.instanceMatrix.array);
        }
      });
      return objects;
    };
    const before = snapshot();
    for (let i = 0; i <= 200; i++) {
      const status = i % 3 ? 'running' : i % 2 ? 'stopped' : 'completed';
      rig.pose(
        pose(status, i / 10, 1 + i / 30, { ...INPUTS, endpointPH: i % 2 ? 4.4 : 8.2 }),
        1 / 60,
      );
    }
    rig.pose(idle, 1 / 60);
    const after = snapshot();
    expect(after.length).toBe(before.length);
    after.forEach((o, i) => expect(o).toBe(before[i]));
    // A run's pH changes every frame: the indicator (picked by a reduce) is not picked again.
    const reduce = vi.spyOn(Array.prototype, 'reduce');
    for (let i = 0; i < 100; i++) rig.pose(pose('running', i / 10, 1 + i / 15), 1 / 60);
    expect(reduce).not.toHaveBeenCalled();
    reduce.mockRestore();
  });

  it('frees every geometry, material, instance buffer and the atlas, never the entity material', () => {
    stubCanvas();
    const { frame, rig, root, painted, named } = build();
    rig.pose(pose('running', 3, 1.2), 0.1);
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
