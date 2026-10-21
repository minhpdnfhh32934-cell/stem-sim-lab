import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SceneKit } from '../../view3d/kit';
import { expectAllFreed, testKit } from '../../view3d/testing';
import { driftRuns } from '../population';
import { driftModel3d, figureBudget, islandAt, islandCap, type DriftModel3D } from './binding';
import { FATE_TINT } from './island';
import { driftLayout } from './layout';
import { FATE_GLYPH, buildDriftArchipelago, islandFrame } from './scene';

const LESSON = { N: 50, p0: 0.5, generations: 150, runs: 20, seed: 1 };
const TOKENS: Record<string, string> = {
  '--chart-1': '#0072b2',
  '--chart-3': '#009e73',
  '--bio3d-grass': '#b5ccb0',
  '--bio3d-grass-2': '#b5ccb0',
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

  it('a fixed island’s grass takes A’s colour, a lost one a’s; the others stay grass', () => {
    const kit = kitWithTokens();
    const m = model();
    const scene = buildDriftArchipelago(kit, { model: m });
    scene.setTime?.(m.generations);
    const s = scene.state();
    const fixed = s.fates.indexOf('fixed');
    const lost = s.fates.indexOf('lost');
    const both = s.fates.indexOf('polymorphic');
    expect(fixed).toBeGreaterThanOrEqual(0);
    expect(lost).toBeGreaterThanOrEqual(0);
    expect(both).toBeGreaterThanOrEqual(0);
    const ground = kit.scene.getObjectByName('drift-islands') as THREE.Mesh;
    const colors = ground.geometry.getAttribute('color');
    const perIsland = colors.count / m.runs.length;
    // The first vertex of an island is its grassy centre: grass lerped FATE_TINT towards the allele.
    const grass = new THREE.Color(TOKENS['--bio3d-grass']);
    const at = (r: number) =>
      new THREE.Color(
        colors.getX(r * perIsland),
        colors.getY(r * perIsland),
        colors.getZ(r * perIsland),
      );
    const want = (to: string) => grass.clone().lerp(new THREE.Color(to), FATE_TINT);
    expect(at(fixed).getHexString()).toBe(want(TOKENS['--chart-1'] ?? '').getHexString());
    expect(at(lost).getHexString()).toBe(want(TOKENS['--chart-3'] ?? '').getHexString());
    expect(at(both).getHexString()).toBe(grass.getHexString());
    // Back at generation 0 every island is grass again.
    scene.setTime?.(0);
    expect(at(fixed).getHexString()).toBe(grass.getHexString());
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
    scene.select?.('figure:3');
    expect(kit.scene.getObjectByName('drift-pick-island')?.visible).toBe(false);
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
