import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import items from '../../../content/items.json';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { microscopeModel, SPECIMENS, STAINS } from '../../../simulation/models/microscope';
import { swapsOf } from '../assembly';
import {
  blurLevel,
  CELLS,
  digitalMicroscope,
  FINE_PITCH,
  FOCAL_PLANE,
  INK,
  NOSEPIECE,
  PATCH,
  PATCH_SHAPE,
  scaleBar,
} from './digital-microscope';

// The digital microscope against its shipped item: frame and rig stay in the
// item's box, the dialled objective hangs over the specimen at its working distance, the lamp and
// the slide light while a run exists, the specimen takes its slide's shape and stain's tint, the
// fine focus turns with the stage's offset, the monitor shows standby without a run and the run's
// field once one exists, redrawn only when what it shows changes, posing only assigns, and it frees
// all it made. Samples are the model's own state at a stage offset.

const item = ItemDefinitionSchema.parse(items.find((i) => i.id === 'digital-microscope'));
const [w, h, d] = item.visual.size;
const AXIS_X = -0.125; // the optical axis, in the item's frame (stage centre at z 0)

/** The run's inputs: onion, iodine, 4× (the definition's defaults), in focus. */
const INPUTS = {
  specimen: 0,
  stain: 1,
  objective: 4,
  focus: 0,
  eyepiece: 10,
  fieldNumber: 18,
  wavelength: 0.55,
  focusStart: 100,
  focusRate: 20,
};
type Inputs = typeof INPUTS;
/** The dials alone, as the station gives them without a run. */
const dials = ({ specimen, stain, objective, focus }: Inputs) => ({
  specimen,
  stain,
  objective,
  focus,
});
const NO_RUN = Object.fromEntries(microscopeModel.variables.map((v) => [v, NaN]));
/** The model's state with the stage at `offset` µm (it depends on nothing else), by name. */
function sampleAt(inputs: Inputs, offset: number): Record<string, number> {
  const state = new Float64Array(microscopeModel.variables.length);
  microscopeModel.init({ ...inputs, focusStart: offset }, state);
  return Object.fromEntries(microscopeModel.variables.map((v, i) => [v, state[i]!]));
}
const idle = (inputs: Inputs = INPUTS): BenchPose => ({
  status: 'configured',
  parameters: dials(inputs),
  sample: NO_RUN,
});
const running = (
  offset: number,
  inputs: Inputs = INPUTS,
  status: BenchPose['status'] = 'running',
) => ({ status, parameters: inputs, sample: sampleAt(inputs, offset) }) as BenchPose;

interface Recorder {
  readonly calls: [string, unknown[]][];
  readonly sets: [string, unknown][];
}
/** Canvases whose 2D context records every call and assignment, and draws nothing. */
function stubCanvas(): Recorder[] {
  const recorders: Recorder[] = [];
  vi.stubGlobal('document', {
    createElement: () => {
      const rec: Recorder = { calls: [], sets: [] };
      recorders.push(rec);
      const context = new Proxy<Record<string, unknown>>(
        {},
        {
          get: (target, key) =>
            key in target
              ? target[key as string]
              : (...args: unknown[]) => void rec.calls.push([String(key), args]),
          set: (target, key, value) => {
            target[key as string] = value;
            rec.sets.push([String(key), value]);
            return true;
          },
        },
      );
      return { width: 0, height: 0, getContext: () => context };
    },
  });
  return recorders;
}
afterEach(() => vi.unstubAllGlobals());

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = digitalMicroscope.frame(item, painted);
  const rig = digitalMicroscope.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  /** The world box of what is drawn now. */
  const bounds = () => {
    root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(root, true);
  };
  /** Where an object is, in the item's frame. */
  const where = (name: string) => {
    root.updateMatrixWorld(true);
    return root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
  };
  return { frame, rig, root, painted, named, bounds, where };
}

const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => (n += c instanceof THREE.Mesh ? 1 : 0));
  return n;
};

describe('digital microscope bench model', () => {
  it('reads only variables the microscope model outputs', () => {
    for (const v of digitalMicroscope.reads ?? []) expect(microscopeModel.variables).toContain(v);
  });

  it('draws in a few meshes and keeps frame and rig, at every objective, inside the item’s box', () => {
    stubCanvas();
    const { frame, rig, bounds } = build();
    expect(meshes(frame.parts) + 1).toBe(4); // body + plastic, metal, glass
    expect(meshes(rig.group)).toBe(5); // turret, specimen, lamp, fine-focus knobs, screen
    for (const objective of [4, 10, 40]) {
      for (const p of [idle({ ...INPUTS, objective }), running(-60, { ...INPUTS, objective })]) {
        rig.pose(p, 1 / 60);
        const box = bounds();
        expect(box.min.y).toBeCloseTo(-h / 2, 6); // the pads on the item's floor
        for (const [lo, hi, size] of [
          [box.min.x, box.max.x, w],
          [box.min.y, box.max.y, h],
          [box.min.z, box.max.z, d],
        ] as const) {
          expect(lo).toBeGreaterThanOrEqual(-size / 2 - 1e-6);
          expect(hi).toBeLessThanOrEqual(size / 2 + 1e-6);
        }
      }
    }
    // bench.top [-0.125, 0.129, 0] is from the base: the specimen, on the optical axis.
    const top = rig.group.position;
    expect(top.x).toBeCloseTo(AXIS_X, 12);
    expect(top.y).toBeCloseTo(FOCAL_PLANE - h / 2, 12);
    expect(top.z).toBe(0);
  });

  it('turns the dialled objective over the specimen, its working distance above it', () => {
    const { rig, where } = build();
    for (const objective of [40, 4, 10, 40]) {
      rig.pose(idle({ ...INPUTS, objective }), 1 / 60);
      for (const lens of NOSEPIECE) {
        const tip = where(`objective-${lens.magnification}`);
        const off = Math.hypot(tip.x - AXIS_X, tip.z);
        if (lens.magnification !== objective) {
          expect(off).toBeGreaterThan(0.02); // turned aside
          // The inclined nosepiece leans it back, its tip well clear of the slide.
          expect(tip.y + h / 2 - FOCAL_PLANE).toBeGreaterThan(0.01);
          continue;
        }
        expect(off).toBeLessThan(1e-9);
        // Parfocal: each in focus at its own working distance (0.6 mm for the 40×).
        expect(tip.y + h / 2 - FOCAL_PLANE).toBeCloseTo(lens.workingDistance, 9);
      }
    }
    // A run keeps its own objective; a value no slot has leaves the nosepiece as it is.
    rig.pose(running(0, { ...INPUTS, objective: 10 }), 1 / 60);
    rig.pose(idle({ ...INPUTS, objective: 20 }), 1 / 60);
    expect(Math.hypot(where('objective-10').x - AXIS_X, where('objective-10').z)).toBeLessThan(
      1e-9,
    );
  });

  it('lights the lamp and the slide while a run exists, and puts both out without one', () => {
    const { rig, named } = build();
    const lamp = named('lamp');
    const specimen = named('specimen');
    const tint = specimen.material as THREE.MeshStandardMaterial;
    rig.pose(idle(), 1 / 60);
    const off = lamp.material;
    expect(tint.emissiveIntensity).toBe(0);
    for (const status of ['running', 'stopped', 'completed'] as const) {
      rig.pose(running(20, INPUTS, status), 1 / 60);
      expect(lamp.material).not.toBe(off);
      expect((lamp.material as THREE.MeshBasicMaterial).isMeshBasicMaterial).toBe(true); // glows
      expect(swapsOf(lamp)).toContain(lamp.material); // compiled with the scene, not at first use
      expect(tint.emissiveIntensity).toBeGreaterThan(0);
    }
    rig.pose(idle(), 1 / 60); // RESET
    expect(lamp.material).toBe(off);
    expect(tint.emissiveIntensity).toBe(0);
  });

  it('shapes and tints the specimen by slide and stain, its opacity the stated contrast', () => {
    const { rig, named } = build();
    const specimen = named('specimen');
    const tint = specimen.material as THREE.MeshStandardMaterial;
    // Drawn after the glass, so the slide's top face under it does not veil it (the coverslip's
    // veil over it would not show); both see-through without writing depth.
    expect(specimen.renderOrder).toBeGreaterThan(named('glass').renderOrder);
    expect(tint.depthWrite).toBe(false);
    expect((named('glass').material as THREE.Material).depthWrite).toBe(false);
    const colors = new Set<string>();
    for (let s = 0; s < 3; s++) {
      for (let st = 0; st < 3; st++) {
        rig.pose(idle({ ...INPUTS, specimen: s, stain: st }), 1 / 60);
        expect(specimen.visible).toBe(true);
        expect(tint.opacity).toBeCloseTo(0.25 + 0.7 * SPECIMENS[s]!.contrast[st]!, 12);
        colors.add(tint.color.getHexString());
      }
    }
    expect(colors.size).toBe(9);
    // Unstained onion is faint; iodine stains it yellow-brown (red over blue), methylene blue blue.
    rig.pose(idle({ ...INPUTS, specimen: 0, stain: 0 }), 1 / 60);
    const faint = tint.opacity;
    rig.pose(idle({ ...INPUTS, specimen: 0, stain: 1 }), 1 / 60);
    expect(tint.opacity).toBeGreaterThan(faint + 0.4);
    expect(tint.color.r).toBeGreaterThan(tint.color.b * 2);
    rig.pose(idle({ ...INPUTS, specimen: 0, stain: 2 }), 1 / 60);
    expect(tint.color.b).toBeGreaterThan(tint.color.r * 1.5);
    // Elodea: a narrow leaf, green unstained.
    rig.pose(idle({ ...INPUTS, specimen: 2, stain: 0 }), 1 / 60);
    expect(specimen.scale.z).toBeLessThan(specimen.scale.x / 2);
    expect(tint.color.g).toBeGreaterThan(tint.color.r);
    // No slide dialled (another model's pose): nothing drawn.
    rig.pose({ status: 'configured', parameters: {}, sample: {} }, 1 / 60);
    expect(specimen.visible).toBe(false);
  });

  it('turns the fine focus a turn per 0.2 mm the stage has moved since the run started', () => {
    const { rig, named } = build();
    const knobs = named('fine-focus') as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const angle = (i: number) => {
      knobs.getMatrixAt(i, m);
      return Math.atan2(m.elements[6], m.elements[5]); // about x
    };
    expect(FINE_PITCH).toBe(200);
    rig.pose(idle(), 1 / 60);
    expect(angle(0)).toBe(0);
    rig.pose(running(100), 1 / 60); // the start: not turned yet
    expect(angle(0)).toBeCloseTo(0, 12);
    rig.pose(running(50), 1 / 60); // 50 µm down: a quarter turn
    expect(angle(0)).toBeCloseTo(Math.PI / 2, 9);
    expect(angle(1)).toBeCloseTo(Math.PI / 2, 9);
    rig.pose(running(0, INPUTS, 'completed'), 1 / 60); // half a turn
    expect(Math.abs(angle(0))).toBeCloseTo(Math.PI, 9);
    rig.pose(idle(), 1 / 60);
    expect(angle(0)).toBe(0);
    // Each knob turns about its own axis, on either side of the arm.
    knobs.getMatrixAt(0, m);
    const left = new THREE.Vector3().setFromMatrixPosition(m);
    knobs.getMatrixAt(1, m);
    const right = new THREE.Vector3().setFromMatrixPosition(m);
    expect(left.x + right.x).toBeCloseTo(2 * AXIS_X, 6); // instance matrices are float32
    expect(right.x - left.x).toBeGreaterThan(0.07);
  });

  it('shows standby without a run, then the run’s field, redrawn only when what it shows changes', () => {
    const canvases = stubCanvas();
    const { rig, named } = build();
    const [screen, field] = canvases; // the screen, and the sharp picture under its blur
    const texture = (named('screen').material as THREE.MeshBasicMaterial).map!;
    expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    const drawn = () => texture.version;
    const painted = () => field!.calls.filter(([k]) => k === 'clip').length; // sharp pictures
    const lastBlur = () => screen!.sets.filter(([k]) => k === 'filter').at(-2)?.[1];
    const texts = () => screen!.calls.filter(([k]) => k === 'fillText').map(([, a]) => a[0]);
    rig.pose(idle(), 1 / 60);
    const standby = drawn();
    expect(standby).toBeGreaterThan(0);
    for (let i = 0; i < 50; i++) rig.pose(idle(), 1 / 60);
    expect(drawn()).toBe(standby); // nothing redrawn while nothing changes
    expect(painted()).toBe(0); // no picture without a run

    // The run starts 100 µm above focus: at 4× (d = 55 µm) far out of focus, blurred 12 px.
    rig.pose(running(100), 1 / 60);
    expect(drawn()).toBe(standby + 1);
    expect(painted()).toBe(1);
    expect(lastBlur()).toBe('blur(12px)');
    expect(texts().slice(-2)).toEqual(['40×', '1 mm']); // M = 40×, FOV 4.5 mm: a 1 mm bar
    // The stage lowered to focus at 20 µm/s, a frame at a time: a few redraws, one picture.
    const calls = screen!.calls.length;
    for (let i = 1; i <= 300; i++) rig.pose(running(100 - i / 3), 1 / 60);
    expect(drawn() - standby - 1).toBeGreaterThan(3);
    expect(drawn() - standby - 1).toBeLessThanOrEqual(8); // the blur levels it passes
    expect(painted()).toBe(1);
    expect(lastBlur()).toBe('none'); // in focus: sharp
    // Held there: no canvas work at all.
    const settled = drawn();
    const before = screen!.calls.length;
    for (let i = 0; i < 100; i++) rig.pose(running(0), 1 / 60);
    expect(drawn()).toBe(settled);
    expect(screen!.calls.length).toBe(before);
    expect(before).toBeGreaterThan(calls);

    // Another run at 400× on cheek cells: a new picture at its own scale.
    const cheek = { ...INPUTS, specimen: 1, stain: 2, objective: 40 };
    rig.pose(running(0, cheek), 1 / 60);
    expect(painted()).toBe(2);
    expect(texts().slice(-2)).toEqual(['400×', '100 µm']);
    // RESET: standby again; the same run's field after it is painted afresh.
    rig.pose(idle(cheek), 1 / 60);
    expect(drawn()).toBe(settled + 2);
    rig.pose(running(0, cheek), 1 / 60);
    expect(painted()).toBe(3);
  });

  it('draws as many cells as the count implies, in bounded canvas work', () => {
    const canvases = stubCanvas();
    const { rig } = build();
    const field = canvases[1]!;
    for (let specimen = 0; specimen < SPECIMENS.length; specimen++) {
      for (let stain = 0; stain < STAINS.length; stain++) {
        for (const objective of [4, 10, 40]) {
          const inputs = { ...INPUTS, specimen, stain, objective };
          const [calls, sets] = [field.calls.length, field.sets.length];
          const pose = running(0, inputs);
          rig.pose(pose, 1 / 60);
          const drawn = field.calls.slice(calls);
          // Once per run, yet bounded: tissue too fine for detail is one fill and one stroke.
          const ops = drawn.filter(([k]) => /^(fill|stroke)(Rect)?$/.test(k)).length;
          expect(ops).toBeLessThanOrEqual(2500);
          expect(drawn.length).toBeLessThanOrEqual(15000);
          expect(field.sets.length - sets).toBeLessThanOrEqual(5000);
          if (specimen !== 1) continue;
          // Cheek cells tile the field one per L: about π/4 (FOV/L)² of them in its circle (each
          // outline starts with one moveTo), as the n = ⌊FOV/L⌋ the results report implies.
          const across = pose.sample.cellsAcross!;
          const cells = drawn.filter(([k]) => k === 'moveTo').length;
          expect(cells).toBeGreaterThanOrEqual(0.9 * (Math.PI / 4) * across ** 2);
          expect(cells).toBeLessThanOrEqual((Math.PI / 4) * (across + 2) ** 2);
        }
      }
    }
  });

  it('keeps one tint, shape, cell style and ink per slide and stain the model lists', () => {
    expect(PATCH).toHaveLength(SPECIMENS.length);
    for (const row of PATCH) expect(row).toHaveLength(STAINS.length);
    expect(PATCH_SHAPE).toHaveLength(SPECIMENS.length);
    expect(CELLS).toHaveLength(SPECIMENS.length);
    for (const inks of Object.values(INK)) expect(inks).toHaveLength(STAINS.length);
  });

  it('blurs in levels that only grow out of focus, and sizes its scale bar to the field', () => {
    expect(blurLevel(1)).toBe(0);
    expect(blurLevel(0.5)).toBe(3); // the depth of field's edge: 3 px
    expect(blurLevel(0)).toBe(9); // 40 px
    let last = 0;
    for (let k = 1000; k >= 0; k--) {
      const level = blurLevel(k / 1000);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
    expect([4500, 1800, 450].map(scaleBar)).toEqual([1000, 200, 100]);
    expect(scaleBar(30)).toBe(10);
  });

  it('turns every face the way its normals point', () => {
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
    stubCanvas();
    const { rig, root } = build();
    const snapshot = () => {
      const objects: unknown[] = [];
      root.traverse((o) => {
        objects.push(o);
        if (o instanceof THREE.Mesh) {
          const g = o.geometry as THREE.BufferGeometry;
          objects.push(o.material, g, g.getAttribute('position').array);
          if (o instanceof THREE.InstancedMesh) objects.push(o.instanceMatrix.array);
          const map = (o.material as THREE.MeshBasicMaterial).map;
          if (map) objects.push(map);
        }
      });
      return objects;
    };
    rig.pose(idle(), 1 / 60);
    const before = snapshot();
    for (let i = 0; i <= 200; i++) {
      const status = i % 3 ? 'running' : i % 2 ? 'stopped' : 'completed';
      const inputs = {
        ...INPUTS,
        specimen: i % 3,
        stain: (i >> 1) % 3,
        objective: [4, 10, 40][i % 3]!,
      };
      rig.pose(running(100 - i, inputs, status), 1 / 60);
    }
    rig.pose(idle(), 1 / 60);
    const after = snapshot();
    expect(after.length).toBe(before.length);
    after.forEach((o, i) => expect(o).toBe(before[i]));
  });

  it('frees every geometry, material, instance buffer and the screen, never the entity material', () => {
    stubCanvas();
    const { frame, rig, root, painted, named } = build();
    rig.pose(running(10), 0.1);
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        made.add(o.geometry as THREE.BufferGeometry);
        made.add(o.material as THREE.Material);
      }
      if (o instanceof THREE.InstancedMesh) made.add(o);
    });
    // Both lamp materials (one is on a mesh at a time) and the screen's texture.
    rig.pose(idle(), 0.1);
    made.add(named('lamp').material as THREE.Material);
    made.add((named('screen').material as THREE.MeshBasicMaterial).map!);
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
