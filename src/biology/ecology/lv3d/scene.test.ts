import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SceneKit } from '../../view3d/kit';
import { expectAllFreed, testKit } from '../../view3d/testing';
import { lotkaVolterra, lvDrift } from '../ecology';
import { PREDATOR_TOKEN, PREY_TOKEN, lvModel3d, momentAt, type LvModel3D } from './binding';
import { ARROW_MIN, ARROW_SHARE } from './columns';
import { buildLvHabitat } from './scene';

const P = { alpha: 1, beta: 0.1, delta: 0.075, gamma: 1.5 };
const model = (): LvModel3D => {
  const traj = lotkaVolterra(P, 10, 5, 30, 800);
  return lvModel3d({ p: P, traj, tEnd: 30, drift: lvDrift(P, traj) }, 200);
};
const texts = {
  columns: { prey: 'x', predators: 'y', xStar: 'x* = 20', yStar: 'y* = 10' },
  board: { title: 'pha', x: 'x', y: 'y', xStar: 'x*', yStar: 'y*' },
};
const TOKENS: Record<string, string> = {
  '--chart-1': '#0072b2',
  '--chart-4': '#d55e00',
};

function instanced(kit: SceneKit, name: string): THREE.InstancedMesh {
  const m: unknown = kit.scene.getObjectByName(name);
  if (!(m instanceof THREE.InstancedMesh)) throw new Error(`no ${name}`);
  return m as THREE.InstancedMesh;
}

describe('predator–prey habitat scene', () => {
  it('draws round(x/per) prey and round(y/per) predators of the nearest computed sample; frees all', () => {
    const { kit, track, start } = testKit();
    const m = model();
    const scene = buildLvHabitat(kit, { model: m, texts });
    for (const t of [0, 2.5, 7.31, 12, 20, 30, 4]) {
      scene.setTime?.(t);
      const want = momentAt(m, t);
      const s = scene.state();
      expect(s.k).toBe(want.k);
      expect(s.t).toBe(m.traj.t[want.k]);
      expect(s.x).toBe(m.traj.x[want.k]);
      expect(s.y).toBe(m.traj.y[want.k]);
      expect(s.drawn).toEqual({
        prey: Math.round(s.x / m.per),
        predators: Math.round(s.y / m.per),
      });
      expect(instanced(kit, 'lv-prey-figures').count).toBe(s.drawn.prey);
      expect(instanced(kit, 'lv-predator-figures').count).toBe(s.drawn.predators);
      expect(instanced(kit, 'lv-prey-shadows').count).toBe(s.drawn.prey);
      // Both columns on one scale: each liquid's height is its value over `top`.
      expect(s.fill.prey / s.column).toBeCloseTo(s.x / m.top, 12);
      expect(s.fill.predators / s.column).toBeCloseTo(s.y / m.top, 12);
      // Arrows: the rate over the run's largest computed rate (hidden near 0).
      for (const k of ['prey', 'predators'] as const) {
        const a = want.arrow[k];
        expect(s.arrow[k]).toBeCloseTo(Math.abs(a) < ARROW_MIN ? 0 : a * ARROW_SHARE * s.column, 9);
      }
      // The board's bead is the sample's (x / xMax, y / yMax).
      expect(s.bead[0]).toBeCloseTo(s.x / m.xMax, 12);
      expect(s.bead[1]).toBeCloseTo(s.y / m.yMax, 12);
    }
    const s = scene.state();
    expect(s.per).toBe(1);
    expect(s.equilibrium[0]).toBeCloseTo(m.eq.x / m.xMax, 9);
    expect(s.equilibrium[1]).toBeCloseTo(m.eq.y / m.yMax, 9);
    expectAllFreed(kit, track, start);
  });

  it('the rings sit at x* and y* on the columns’ shared scale', () => {
    const { kit, track, start } = testKit();
    const m = model();
    const scene = buildLvHabitat(kit, { model: m, texts });
    scene.setTime?.(12);
    const s = scene.state();
    const liquid = kit.scene.getObjectByName('lv-liquid-prey');
    const base = (liquid?.position.y ?? 0) - s.fill.prey / 2;
    const ring = (n: string) => kit.scene.getObjectByName(n)?.position.y ?? 0;
    expect((ring('lv-ring-prey') - base) / s.column).toBeCloseTo(m.eq.x / m.top, 9);
    expect((ring('lv-ring-predators') - base) / s.column).toBeCloseTo(m.eq.y / m.top, 9);
    expectAllFreed(kit, track, start);
  });

  it('prey and predators carry the 2D chart’s x(t) and y(t) colours', () => {
    const kit = new SceneKit({
      tier: 'medium',
      segments: 16,
      maxParticles: 4000,
      token: (n) => TOKENS[n] ?? '#808080',
      look: 'outdoor',
    });
    const scene = buildLvHabitat(kit, { model: model(), texts });
    scene.setTime?.(3);
    const c = new THREE.Color();
    for (const [name, token] of [
      ['lv-prey-figures', PREY_TOKEN],
      ['lv-predator-figures', PREDATOR_TOKEN],
    ] as const) {
      const body = instanced(kit, name);
      expect(body.count).toBeGreaterThan(0);
      for (let i = 0; i < body.count; i++) {
        body.getColorAt(i, c);
        expect(c.getHexString()).toBe(new THREE.Color(TOKENS[token]).getHexString());
      }
    }
    const liquid = (n: string) =>
      (
        (kit.scene.getObjectByName(n) as THREE.Mesh | undefined)?.material as
          THREE.MeshStandardMaterial | undefined
      )?.color.getHexString();
    expect(liquid('lv-liquid-prey')).toBe(new THREE.Color(TOKENS[PREY_TOKEN]).getHexString());
    expect(liquid('lv-liquid-predators')).toBe(
      new THREE.Color(TOKENS[PREDATOR_TOKEN]).getHexString(),
    );
    kit.dispose();
  });

  it('newcomers grow in while it animates; standing animals never move between moments', () => {
    const { kit, track, start } = testKit();
    const m = model();
    const scene = buildLvHabitat(kit, { model: m, texts });
    // From a prey low (t ≈ 4.6) to the next prey peak (t ≈ 7.8): more prey.
    scene.setTime?.(4.6);
    const body = instanced(kit, 'lv-prey-figures');
    const mat = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const before: number[][] = [];
    for (let i = 0; i < body.count; i++) {
      body.getMatrixAt(i, mat);
      p.setFromMatrixPosition(mat);
      before.push([p.x, p.z]);
    }
    scene.tick?.(0.016);
    scene.setTime?.(7.8);
    expect(scene.state().drawn.prey).toBeGreaterThan(before.length);
    expect(scene.state().settling).toBe(true);
    for (let k = 0; k < 60; k++) scene.tick?.(0.05);
    expect(scene.state().settling).toBe(false);
    scene.rest?.();
    before.forEach(([x, z], i) => {
      body.getMatrixAt(i, mat);
      p.setFromMatrixPosition(mat);
      expect(p.x).toBeCloseTo(x ?? 0, 9);
      expect(p.z).toBeCloseTo(z ?? 0, 9);
    });
    expectAllFreed(kit, track, start);
  });

  it('frames every pick; a pick marks it and an animal’s close-up hides the far labels', () => {
    const { kit, track, start } = testKit();
    const m = model();
    const scene = buildLvHabitat(kit, { model: m, texts });
    scene.setTime?.(12);
    const frames = Object.keys(scene.frames ?? {});
    expect(frames).toEqual(expect.arrayContaining(['closeup', 'columns', 'board']));
    expect(frames).toContain(`prey:${String(m.slots.prey - 1)}`);
    expect(frames).toContain(`predator:${String(m.slots.predators - 1)}`);
    const title = kit.scene.getObjectByName('lv-title-prey');
    const boardTitle = kit.scene.getObjectByName('lv-board-title');
    scene.select?.('prey:0');
    expect(kit.scene.getObjectByName('lv-prey-pick-ring')?.visible).toBe(true);
    expect(title?.visible).toBe(false);
    expect(boardTitle?.visible).toBe(false);
    scene.select?.('board');
    expect(kit.scene.getObjectByName('lv-board-pick')?.visible).toBe(true);
    expect(boardTitle?.visible).toBe(true);
    scene.select?.('columns');
    expect(kit.scene.getObjectByName('lv-columns-ring')?.visible).toBe(true);
    expect(title?.visible).toBe(true);
    scene.select?.(null);
    expect(kit.scene.getObjectByName('lv-columns-ring')?.visible).toBe(false);
    expect(title?.visible).toBe(true);
    expect(boardTitle?.visible).toBe(true);
    expectAllFreed(kit, track, start);
  });

  it('a tap on an animal, the columns or the board names it', () => {
    const { kit, track, start } = testKit();
    const scene = buildLvHabitat(kit, { model: model(), texts });
    scene.setTime?.(12);
    const s = scene.state();
    // The renderer updates world matrices each frame; here, once.
    kit.scene.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(35, 2, 0.1, 1000);
    const ray = new THREE.Raycaster();
    const aim = (p: readonly [number, number, number], from: THREE.Vector3) => {
      camera.position.copy(from);
      camera.lookAt(p[0], p[1], p[2]);
      camera.updateMatrixWorld(true);
      ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      return scene.pick?.(ray) ?? null;
    };
    const pp = s.preyPoint;
    expect(pp).not.toBeNull();
    if (pp)
      expect(aim(pp, new THREE.Vector3(pp[0], pp[1] + 12, pp[2] + 0.5))).toMatch(/^prey:\d+$/);
    const q = s.predatorPoint;
    if (q) expect(aim(q, new THREE.Vector3(q[0], q[1] + 12, q[2] + 0.5))).toMatch(/^predator:\d+$/);
    const c = s.columnsPoint;
    expect(aim([c[0], c[1] - 0.2, c[2]], new THREE.Vector3(c[0], c[1] + 1, c[2] + 20))).toBe(
      'columns',
    );
    const b = s.boardPoint;
    expect(aim(b, new THREE.Vector3(b[0] - 4, b[1] + 6, b[2] + 20))).toBe('board');
    expectAllFreed(kit, track, start);
  });
});
