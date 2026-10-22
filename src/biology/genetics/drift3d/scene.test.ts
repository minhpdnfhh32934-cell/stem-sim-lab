import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SceneKit } from '../../view3d/kit';
import { expectAllFreed, testKit } from '../../view3d/testing';
import { driftRuns } from '../population';
import {
  driftModel3d,
  figureBudget,
  islandAt,
  islandCap,
  summaryAt,
  type DriftModel3D,
} from './binding';
import { driftLayout } from './layout';
import { FATE_GLYPH, buildDriftArchipelago, islandFrame } from './scene';

const LESSON = { N: 50, p0: 0.5, generations: 150, runs: 20, seed: 1 };
const TOKENS: Record<string, string> = {
  '--chart-1': '#0072b2',
  '--chart-3': '#009e73',
  '--bio3d-grass': '#b5ccb0',
  '--bio3d-island-grass': '#4e6640',
  '--bio3d-island-grass-2': '#4e6640',
  '--bio3d-sand': '#dcd3c0',
  '--bio3d-creature': '#ebe4d6',
};

function model(st = LESSON): DriftModel3D {
  return driftModel3d(st, driftRuns(st), islandCap(figureBudget(4000), st.runs));
}

function kitWithTokens(): SceneKit {
  return new SceneKit({
    tier: 'medium',
    segments: 16,
    maxParticles: 4000,
    token: (n) => TOKENS[n] ?? '#808080',
    look: 'outdoor',
  });
}

describe('genetic drift archipelago scene', () => {
  it('draws every island’s beads, band, fate and tag from the model, and frees everything', () => {
    const { kit, track, start } = testKit();
    const m = model();
    const scene = buildDriftArchipelago(kit, { model: m });
    for (const g of [0, 1, 40, 150, 7]) {
      scene.setTime?.(g + 0.6);
      const s = scene.state();
      expect(s.generation).toBe(g);
      expect(s.islands).toBe(LESSON.runs);
      expect(s.figures).toBe(m.figures);
      expect(s.per).toBe(m.per);
      let sumA = 0;
      for (let r = 0; r < LESSON.runs; r++) {
        const x = islandAt(m, r, g);
        if (!x) throw new Error('no island');
        expect(s.beadsA[r]).toBe(x.beads.A);
        expect(s.bands[r]).toBe(x.p);
        expect(s.fates[r]).toBe(x.fate);
        const glyph = FATE_GLYPH[x.fate];
        expect(s.tags[r]).toBe(glyph ? `${String(r + 1)} ${glyph}` : String(r + 1));
        sumA += x.beads.A;
      }
      // The two bead meshes draw exactly 2 beads per figure, the A ones as the model shares them.
      expect(s.tips.A).toBe(sumA);
      expect(s.tips.A + s.tips.a).toBe(2 * m.figures * LESSON.runs);
    }
    // A close-up framing per island.
    expect(Object.keys(scene.frames ?? {})).toHaveLength(LESSON.runs);
    expect(scene.frames?.[islandFrame(3)]?.bounds.radius).toBeGreaterThan(0);
    expectAllFreed(kit, track, start);
  });

  it('every island keeps the same grass; a fixed island flies A’s flag, a lost one a’s', () => {
    const kit = kitWithTokens();
    const m = model();
    const scene = buildDriftArchipelago(kit, { model: m });
    const L = driftLayout(m.runs.length, m.figures);
    const mesh = (name: string) => kit.scene.getObjectByName(name) as THREE.InstancedMesh;
    const islandAtPoint = (x: number, z: number) =>
      L.islands.reduce(
        (best, is) =>
          Math.hypot(x - is.x, z - is.z) <
          Math.hypot(x - (L.islands[best]?.x ?? 0), z - (L.islands[best]?.z ?? 0))
            ? is.index
            : best,
        0,
      );
    const m4 = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const flagged = (name: string) => {
      const f = mesh(name);
      return Array.from({ length: f.count }, (_, j) => {
        f.getMatrixAt(j, m4);
        p.setFromMatrixPosition(m4);
        return islandAtPoint(p.x, p.z);
      }).sort((a, b) => a - b);
    };
    const ids = (fate: string, fates: readonly string[]) =>
      fates.flatMap((f, i) => (f === fate ? [i] : []));

    scene.setTime?.(m.generations);
    const s = scene.state();
    const sum = summaryAt(m, m.generations);
    expect(ids('fixed', s.fates)).toHaveLength(sum.fixed);
    expect(ids('lost', s.fates)).toHaveLength(sum.lost);
    expect(sum.fixed).toBeGreaterThan(0);
    expect(sum.lost).toBeGreaterThan(0);
    expect(sum.polymorphic).toBeGreaterThan(0);
    // One flag per fixed / lost island, on that island: banner and finial in the allele's colour,
    // the finial in its bead's shape (A a cube, a a sphere).
    expect(flagged('drift-flags-A')).toEqual(ids('fixed', s.fates));
    expect(flagged('drift-finials-A')).toEqual(ids('fixed', s.fates));
    expect(flagged('drift-flags-a')).toEqual(ids('lost', s.fates));
    expect(flagged('drift-finials-a')).toEqual(ids('lost', s.fates));
    expect(mesh('drift-flag-poles').count).toBe(sum.fixed + sum.lost);
    const color = (name: string) =>
      (mesh(name).material as THREE.MeshStandardMaterial).color.getHexString();
    expect(color('drift-flags-A')).toBe(new THREE.Color(TOKENS['--chart-1']).getHexString());
    expect(color('drift-finials-A')).toBe(new THREE.Color(TOKENS['--chart-1']).getHexString());
    expect(color('drift-flags-a')).toBe(new THREE.Color(TOKENS['--chart-3']).getHexString());
    expect(color('drift-finials-a')).toBe(new THREE.Color(TOKENS['--chart-3']).getHexString());
    // A cube reaches its corners (|x| + |y| + |z| ≈ 3), a sphere never past √3.
    const reach = (name: string) => {
      const q = mesh(name).geometry.getAttribute('position');
      let r = 0;
      for (let i = 0; i < q.count; i++)
        r = Math.max(r, Math.abs(q.getX(i)) + Math.abs(q.getY(i)) + Math.abs(q.getZ(i)));
      return r;
    };
    expect(reach('drift-finials-A')).toBeGreaterThan(2.2);
    expect(reach('drift-finials-a')).toBeLessThan(1.75);

    // The ground never takes a fate's colour: each island's grassy centre is the islands' grass.
    const ground = kit.scene.getObjectByName('drift-islands') as THREE.Mesh;
    const colors = ground.geometry.getAttribute('color');
    const perIsland = colors.count / m.runs.length;
    const grass = new THREE.Color(TOKENS['--bio3d-island-grass']).getHexString();
    const at = (r: number) =>
      new THREE.Color(
        colors.getX(r * perIsland),
        colors.getY(r * perIsland),
        colors.getZ(r * perIsland),
      ).getHexString();
    for (let r = 0; r < m.runs.length; r++) expect(at(r)).toBe(grass);

    // Back at generation 0 both alleles are on every island: no flags.
    scene.setTime?.(0);
    expect(scene.state().fates.every((f) => f === 'polymorphic')).toBe(true);
    for (const name of ['drift-flag-poles', 'drift-flags-A', 'drift-flags-a'])
      expect(mesh(name).count).toBe(0);
    for (let r = 0; r < m.runs.length; r++) expect(at(r)).toBe(grass);
    // The animals all wear one neutral colour: the model counts gene copies, not genotypes.
    const body = kit.scene.getObjectByName('drift-figures') as THREE.InstancedMesh;
    const c = new THREE.Color();
    for (let i = 0; i < body.count; i += 17) {
      body.getColorAt(i, c);
      expect(c.getHexString()).toBe(new THREE.Color(TOKENS['--bio3d-creature']).getHexString());
    }
    kit.dispose();
  });

  it('a tap picks the figure under it, else the island', () => {
    const { kit, track, start } = testKit();
    const m = model();
    const scene = buildDriftArchipelago(kit, { model: m });
    scene.setTime?.(10);
    scene.rest?.();
    kit.scene.updateMatrixWorld(true);
    const s = scene.state();
    const fp = s.figurePoint;
    if (!fp) throw new Error('no figure');
    const down = new THREE.Vector3(0, -1, 0);
    const from = (x: number, z: number) =>
      new THREE.Raycaster(new THREE.Vector3(x, 30, z), down, 0, 100);
    expect(scene.pick?.(from(fp[0], fp[2]))).toBe('figure:0');
    // Island 5's beach (between the figures and the water).
    const L = driftLayout(m.runs.length, m.figures);
    const is = L.islands[5];
    if (!is) throw new Error('no island 5');
    expect(scene.pick?.(from(is.x + is.coast * 0.93, is.z))).toBe('island:5');
    // Open water (beyond every island) picks nothing.
    expect(scene.pick?.(from(L.extent + 4, 0))).toBeNull();
    scene.select?.('island:5');
    expect(kit.scene.getObjectByName('drift-pick-island')?.visible).toBe(true);
    expect(kit.scene.getObjectByName('drift-pick-figure')?.visible).toBe(false);
    scene.select?.('figure:3');
    expect(kit.scene.getObjectByName('drift-pick-island')?.visible).toBe(false);
    // The picked animal gets a pointer over its antennae.
    const mark = kit.scene.getObjectByName('drift-pick-figure');
    const fig = scene.state().figurePoint;
    expect(mark?.visible).toBe(true);
    expect(mark?.position.y ?? 0).toBeGreaterThan((fig?.[1] ?? 0) + 0.5);
    scene.select?.(null);
    expect(mark?.visible).toBe(false);
    expectAllFreed(kit, track, start);
  });

  it('names its parts; the instance budget holds at 30 islands of N = 500', () => {
    const { kit, track, start } = testKit();
    const m = model({ ...LESSON, N: 500, runs: 30 });
    const scene = buildDriftArchipelago(kit, { model: m });
    scene.setTime?.(150);
    const body = kit.scene.getObjectByName('drift-figures') as THREE.InstancedMesh;
    expect(body.count).toBe(30 * m.figures);
    expect(body.count).toBeLessThanOrEqual(300);
    const camera = new THREE.PerspectiveCamera(30, 1.7, 0.1, 1000);
    const b = scene.bounds;
    camera.position.set(b.center[0], b.center[1] + b.radius * 1.6, b.center[2] + b.radius * 2.4);
    camera.lookAt(...b.center);
    camera.updateMatrixWorld();
    const ids = (scene.callouts?.(camera) ?? []).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['island', 'band', 'genes', 'figure']));
    for (const id of ids)
      expect(['island', 'band', 'genes', 'figure', 'fixed', 'lost']).toContain(id);
    expectAllFreed(kit, track, start);
  });
});
