import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mixLinear } from '@/ui/three/color';
import { TagLayer } from '@/ui/three/tagLayer';
import { expectDisposes } from '@/ui/three/testing';
import { muted } from '../../view3d/palette';
import { VISIBLE_LIQUID_ALPHA, waterLineColor } from '../../view3d/recipes';
import { osmosisData } from '../osmosisData';
import { diffusionFrameAt, diffusionModel3d, type DiffusionInputs } from './diffusion';
import { BOX, waterSplit } from './diffusionLayout';
import { TANK, WATER_DOTS, WATER_LINE_R, buildDiffusionScene } from './diffusionScene';
import {
  SOLUTE_DRAWN,
  TUBE,
  WATER_DRAWN,
  levelY,
  osmosisFrameAt,
  osmosisModel3d,
  rulerMinorTicks,
  rulerTicks,
  tubeTop,
} from './osmosis';
import { MENISCUS, buildOsmosisScene } from './osmosisScene';
import { ARM_START } from './uTube';

const token = () => '#808080';
const opts = (tier: 'medium' | 'high' = 'medium') => ({
  tier,
  segments: tier === 'high' ? 24 : 16,
  token,
});
const inputs = (over: Partial<DiffusionInputs> = {}): DiffusionInputs => ({
  particles: 160,
  pores: 4,
  c1: 10,
  c2: 0,
  v1: 1,
  v2: 1,
  pa: 0.2,
  run: 0,
  ...over,
});
const osmosis = (over: Partial<{ c0: number; i: number; tC: number; h0: number }> = {}) =>
  osmosisModel3d(osmosisData({ c0: 1, i: 1, tC: 25, h0: 0.2, ...over }));

/** How strongly a material's rim darkens its outline (0: no ink). */
const inkOf = (m: THREE.Material) =>
  (m.userData.rim as { uRimInkAmount: { value: number } } | undefined)?.uRimInkAmount.value ?? 0;
/** Straight down. */
const DOWN = new THREE.Vector3(0, -1, 0);
/** A ray from the front (+z) straight onto a point. */
const frontRay = (x: number, y: number) =>
  new THREE.Raycaster(new THREE.Vector3(x, y, 40), new THREE.Vector3(0, 0, -1));

const meshes = (scene: THREE.Scene) => {
  const out: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o as THREE.Mesh);
  });
  return out;
};
const instancedOf = (scene: THREE.Scene, kind: new (...a: never[]) => THREE.BufferGeometry) =>
  meshes(scene).filter(
    (x): x is THREE.InstancedMesh => x instanceof THREE.InstancedMesh && x.geometry instanceof kind,
  );
/** An instance's place and scale (read from the matrix: a zero scale must read as zero). */
const at = (mesh: THREE.InstancedMesh, k: number) => {
  const m4 = new THREE.Matrix4();
  mesh.getMatrixAt(k, m4);
  const p = new THREE.Vector3().setFromMatrixPosition(m4);
  const s = new THREE.Vector3().setFromMatrixScale(m4);
  return { p, s };
};
/** Theme colours that differ per token (the membrane's muted colour can be told apart). */
const COLOURS: Record<string, string> = {
  '--subject-biology': '#2e9e5b',
  '--bg-stage': '#fbfcfe',
  '--chart-6': '#56b4e9',
};
const tinted = (name: string) => COLOURS[name] ?? '#808080';
const shadowed = (scene: THREE.Scene) => {
  let receive = 0;
  let cast = 0;
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (o.receiveShadow) receive++;
    if (o.castShadow) cast++;
  });
  return { receive, cast };
};

const instances = (scene: THREE.Scene) => {
  let n = 0;
  scene.traverse((o) => {
    if (o instanceof THREE.InstancedMesh && o.visible) n += o.count;
  });
  return n;
};

describe('3D diffusion scene', () => {
  it('draws the model’s count on each side at every t, on every tier', () => {
    for (const tier of ['medium', 'high'] as const)
      for (const over of [{}, { c1: 2, c2: 18, v1: 3, v2: 0.5, pores: 1 }]) {
        const m = diffusionModel3d(inputs(over));
        const sc = buildDiffusionScene(m, opts(tier));
        for (let s = 0; s <= 20; s++) {
          const f = diffusionFrameAt(m, (s / 20) * m.tEnd);
          sc.setFrame(f, true);
          expect(sc.sides()).toEqual({ left: f.n1, right: f.n2 });
        }
        sc.dispose();
      }
  });

  it('picks a particle, a pore, the membrane and each compartment', () => {
    const m = diffusionModel3d(inputs());
    const sc = buildDiffusionScene(m, opts());
    sc.setFrame(diffusionFrameAt(m, m.tEnd / 3), true);
    const at = sc.focusPoint({ kind: 'particle', index: 120 });
    expect(at).not.toBeNull();
    expect(sc.pick(frontRay(at?.[0] ?? 0, at?.[1] ?? 0))?.kind).toBe('particle');
    const lay = sc.plan.layout;
    // The front pore of the top row (pores 0 and 1: z = −1,05 and 1,05).
    const pore = lay.pores[1];
    expect(sc.pick(frontRay(lay.xm, (pore?.y ?? 0) + BOX.poreR))).toEqual({
      kind: 'pore',
      index: 1,
    });
    expect(sc.pick(frontRay(lay.xm, 0))).toEqual({ kind: 'membrane' });
    sc.dispose();
    // Without solute the compartments are clear to pick.
    const empty = diffusionModel3d(inputs({ c1: 0, c2: 0, v1: 1, v2: 3 }));
    const sc2 = buildDiffusionScene(empty, opts());
    sc2.setFrame(diffusionFrameAt(empty, 0), true);
    const l2 = sc2.plan.layout;
    expect(sc2.pick(frontRay(l2.x0 + l2.w1 / 2, 1))).toEqual({ kind: 'compartment', side: 1 });
    expect(sc2.pick(frontRay(l2.x1 - l2.w2 / 2, 1))).toEqual({ kind: 'compartment', side: 2 });
    sc2.dispose();
  });

  it('"Hạt chất tan" never points at a particle inside a pore (UI-49)', () => {
    const m = diffusionModel3d(inputs());
    const sc = buildDiffusionScene(m, opts());
    const xm = sc.plan.layout.xm;
    // Early on, side 2 holds only particles that have just crossed (some still in a pore).
    for (let k = 0; k <= 400; k++) {
      sc.setFrame(diffusionFrameAt(m, (m.tEnd * k) / 1600), true);
      const p = sc.labelAnchors().find((a) => a.id === 'particle')?.point;
      if (p) expect(Math.abs(p[0] - xm)).toBeGreaterThan(BOX.mh);
    }
    sc.dispose();
  });

  it('names its parts and puts each side’s count over it', () => {
    const m = diffusionModel3d(inputs());
    const sc = buildDiffusionScene(m, opts());
    const f = diffusionFrameAt(m, m.tEnd / 2);
    sc.setFrame(f, true);
    expect(sc.labelAnchors().map((a) => a.id)).toEqual(
      expect.arrayContaining(['compartment1', 'compartment2', 'membrane', 'pore', 'particle']),
    );
    const host = document.createElement('div');
    const layer = new TagLayer(host);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    cam.position.set(0, 4, 30);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    layer.begin(cam, 800, 800, { left: 0, top: 0, right: 800, bottom: 800 });
    sc.tags(layer, { count: (n) => `${String(n)} hạt`, dh: () => '', tick: () => '' });
    layer.end();
    const shown = [...host.querySelectorAll('span')]
      .filter((e) => !e.hidden)
      .map((e) => e.textContent);
    expect(shown).toEqual([`${String(f.n1)} hạt`, `${String(f.n2)} hạt`]);
    layer.dispose();
    sc.dispose();
  });

  it('a glass tank, not a wire box: one liquid body per compartment, widths V₁ : V₂', () => {
    for (const over of [{}, { v1: 3, v2: 0.5 }, { c1: 0, c2: 0 }]) {
      const m = diffusionModel3d(inputs(over));
      for (const tier of ['medium', 'high'] as const) {
        const sc = buildDiffusionScene(m, opts(tier));
        sc.setFrame(diffusionFrameAt(m, 0), true);
        let lines = 0;
        sc.scene.traverse((o) => {
          if (o instanceof THREE.LineSegments && o.visible) lines++;
        });
        expect(lines).toBe(0);
        const bodies = meshes(sc.scene).filter(
          (x) =>
            x.geometry.hasAttribute('color') && x.geometry.getAttribute('color').itemSize === 4,
        );
        expect(bodies).toHaveLength(2);
        const [b1, b2] = bodies;
        expect((b1?.scale.x ?? 0) / (b2?.scale.x ?? 1)).toBeCloseTo(m.inputs.v1 / m.inputs.v2, 9);
        expect((b1?.scale.x ?? 0) * 2).toBeCloseTo(sc.plan.layout.w1, 9);
        sc.dispose();
      }
    }
  });

  it('the membrane: a muted, see-through fibrous sheet with one real hole per pore', () => {
    for (const pores of [0, 1, 4, 8]) {
      const m = diffusionModel3d(inputs({ pores }));
      const sc = buildDiffusionScene(m, { ...opts(), token: tinted });
      const sheet = meshes(sc.scene).find((x) => x.geometry instanceof THREE.ExtrudeGeometry);
      const mat = sheet?.material as THREE.MeshStandardMaterial;
      // A structure colour (not the saturated subject token), translucent, bumped in fibres.
      expect(`#${mat.color.getHexString()}`).toBe(muted(tinted, '--subject-biology'));
      expect(mat.opacity).toBeLessThan(1);
      expect(mat.bumpMap).not.toBeNull();
      const shapes = [(sheet?.geometry as THREE.ExtrudeGeometry).parameters.shapes].flat();
      expect(shapes[0]?.holes).toHaveLength(pores);
      // Each hole: a rim on both faces and a lined channel.
      const rims = instancedOf(sc.scene, THREE.TorusGeometry);
      const linings = instancedOf(sc.scene, THREE.CylinderGeometry);
      expect(rims.map((x) => (x.visible ? x.count : 0))).toEqual([2 * pores]);
      expect(linings.map((x) => (x.visible ? x.count : 0))).toEqual([pores]);
      sc.dispose();
    }
  });

  it('light stage: each compartment shows its extent (water line, denser liquid, inked glass)', () => {
    const light: Record<string, string> = {
      ...COLOURS,
      '--text': '#172033',
      '--bio3d-liquid': '#b8d6ea',
      '--bio3d-glass': '#e6edf5',
      '--m3d-shell-ink': '1',
      '--m3d-water-line': '0.5',
    };
    for (const theme of ['light', 'dark'] as const)
      for (const tier of ['medium', 'high'] as const)
        for (const over of [
          { v1: 1, v2: 1 },
          { v1: 3, v2: 0.5 },
        ]) {
          const dark: Record<string, string> = {
            '--m3d-shell-ink': '0',
            '--m3d-water-line': '0.12',
          };
          const token = (n: string) =>
            (theme === 'dark' ? dark[n] : undefined) ?? light[n] ?? '#808080';
          const m = diffusionModel3d(inputs(over));
          const sc = buildDiffusionScene(m, { ...opts(tier), token });
          const lay = sc.plan.layout;
          const all = meshes(sc.scene);
          // The water line: one mesh, not pickable, at the surface, in the line colour.
          const lines = all.filter((x) => {
            x.geometry.computeBoundingBox();
            const b = x.geometry.boundingBox;
            return (
              !(x instanceof THREE.InstancedMesh) &&
              b !== null &&
              Math.abs((b.min.y + b.max.y) / 2 - (BOX.hy - 0.005)) < 1e-4 &&
              b.max.y - b.min.y < 3 * WATER_LINE_R
            );
          });
          expect(lines).toHaveLength(1);
          const line = lines[0] as THREE.Mesh;
          const hits: THREE.Intersection[] = [];
          line.raycast(new THREE.Raycaster(new THREE.Vector3(lay.x0 + 0.1, 10, 0), DOWN), hits);
          expect(hits).toEqual([]);
          expect(`#${(line.material as THREE.MeshStandardMaterial).color.getHexString()}`).toBe(
            waterLineColor('#b8d6ea', '#172033', theme === 'light' ? 0.5 : 0.12),
          );
          // Two loops, one round each compartment's surface: their widths follow V₁ : V₂.
          const xs = line.geometry.getAttribute('position');
          const span = (left: boolean) => {
            let lo = Infinity;
            let hi = -Infinity;
            for (let i = 0; i < xs.count; i++) {
              const x = xs.getX(i);
              if (x < lay.xm === left) [lo, hi] = [Math.min(lo, x), Math.max(hi, x)];
            }
            return hi - lo;
          };
          // (The tube's six-sided section reaches its radius R, or R cos 30° between corners.)
          for (const [left, w] of [
            [true, lay.w1],
            [false, lay.w2],
          ] as const) {
            const extra = span(left) - (w - 0.06);
            expect(extra).toBeLessThanOrEqual(2 * WATER_LINE_R + 1e-5);
            expect(extra).toBeGreaterThanOrEqual(2 * WATER_LINE_R * Math.cos(Math.PI / 6) - 1e-5);
          }
          // The liquid bodies never fade below the visible minimum.
          const bodies = all.filter((x) => x.geometry.hasAttribute('color'));
          expect(bodies).toHaveLength(2);
          for (const b of bodies) {
            const a = b.geometry.getAttribute('color');
            let min = 1;
            for (let i = 0; i < a.count; i++) min = Math.min(min, a.getW(i));
            expect(min).toBeCloseTo(VISIBLE_LIQUID_ALPHA.top, 6);
          }
          // The glass's front face darkens towards its edges on the light stage only.
          const inked = all.filter((x) => inkOf(x.material as THREE.Material) > 0);
          if (theme === 'light') {
            expect(inked).toHaveLength(1);
            expect(inked[0]?.scale.z).toBeCloseTo(BOX.hz + TANK.outer, 9);
          } else expect(inked).toEqual([]);
          sc.dispose();
        }
  });

  it('High: faint water dots in both sides, never counted, never crossing; none on Medium', () => {
    const m = diffusionModel3d(inputs({ v1: 3, v2: 1 }));
    const hi = buildDiffusionScene(m, opts('high'));
    const lay = hi.plan.layout;
    const dots = instancedOf(hi.scene, THREE.IcosahedronGeometry)[0] as THREE.InstancedMesh;
    const hits: THREE.Intersection[] = [];
    dots.raycast(
      new THREE.Raycaster(new THREE.Vector3(0, 0, 40), new THREE.Vector3(0, 0, -1)),
      hits,
    );
    expect(hits).toEqual([]);
    const split = waterSplit(lay, WATER_DOTS);
    expect(split / WATER_DOTS).toBeCloseTo(0.75, 2);
    for (const t of [0, m.tEnd / 2, m.tEnd]) {
      const f = diffusionFrameAt(m, t);
      hi.setFrame(f, true);
      expect(hi.sides()).toEqual({ left: f.n1, right: f.n2 });
      expect(hi.waterDots()).toBe(WATER_DOTS);
      let left = 0;
      for (let j = 0; j < dots.count; j++) {
        const { p } = at(dots, j);
        if (p.x < lay.xm) left++;
        expect(Math.abs(p.x - lay.xm)).toBeGreaterThan(BOX.mh);
      }
      expect(left).toBe(split);
    }
    hi.dispose();
    const med = buildDiffusionScene(m, opts());
    med.setFrame(diffusionFrameAt(m, 0), true);
    expect(med.waterDots()).toBe(0);
    med.dispose();
  });

  it('shadow maps only when asked (High on a discrete GPU): the base takes the particles’', () => {
    const m = diffusionModel3d(inputs());
    const off = buildDiffusionScene(m, opts('high'));
    expect(shadowed(off.scene)).toEqual({ receive: 0, cast: 0 });
    off.dispose();
    const on = buildDiffusionScene(m, { ...opts('high'), shadows: true });
    const s = shadowed(on.scene);
    expect(s.receive).toBeGreaterThanOrEqual(1);
    expect(s.cast).toBeGreaterThanOrEqual(1);
    on.dispose();
  });

  it('frees every geometry and material it made', () => {
    expectDisposes(
      () => {
        const m = diffusionModel3d(inputs({ particles: 400, pores: 8 }));
        const sc = buildDiffusionScene(m, opts());
        sc.setFrame(diffusionFrameAt(m, m.tEnd / 2), true);
        sc.setSelection({ kind: 'pore', index: 2 });
        sc.setSelection({ kind: 'compartment', side: 2 });
        return sc;
      },
      (sc) => {
        sc.dispose();
        expect(sc.scene.children).toHaveLength(0);
      },
    );
  });

  it('draw budget at 400 particles: one call per instanced set, never one per particle', () => {
    const m = diffusionModel3d(inputs({ particles: 400, pores: 8 }));
    const sc = buildDiffusionScene(m, opts());
    sc.setFrame(diffusionFrameAt(m, m.tEnd / 2), true);
    sc.setSelection({ kind: 'particle', index: 0 });
    const stats = sc.drawStats();
    // Measured 2026-10-21 (CPU count, no GPU) after the light-stage pass (0.7.1 round 2): 12
    // calls, about 39 900 triangles on Medium (High: 14 calls, about 95 800) — one more call
    // for the water lines (both loops in one mesh). Was 11 calls with the first glass tank, 9
    // with the wire box. A bigger change must update this budget on purpose.
    expect(stats.calls).toBeLessThanOrEqual(12);
    expect(stats.triangles).toBeLessThan(45_000);
    // Medium's 3D instance budget is 600 (quality3d: 4000 × 15 %).
    expect(instances(sc.scene)).toBeLessThanOrEqual(600);
    sc.dispose();
  });
});

describe('3D osmosis scene', () => {
  it('the columns stand at the model’s heights on one scale; the solute sample stays whole', () => {
    for (const over of [{}, { c0: 5, i: 3, h0: 0.05 }]) {
      const m = osmosis(over);
      const sc = buildOsmosisScene(m, opts());
      for (const k of [0, 30, 120, 240]) {
        const f = osmosisFrameAt(m, m.traj.t[k] ?? 0);
        sc.setFrame(f);
        const lv = sc.levels();
        expect(lv.left / m.perMetre).toBeCloseTo(f.hL, 9);
        expect(lv.right / m.perMetre).toBeCloseTo(f.hR, 9);
        expect(sc.drawn()).toEqual({ solute: SOLUTE_DRAWN, water: WATER_DRAWN });
      }
      sc.dispose();
    }
  });

  it('picks a column, the membrane and a molecule', () => {
    const m = osmosis();
    const sc = buildOsmosisScene(m, opts());
    const f = osmosisFrameAt(m, m.tEnd / 2);
    sc.setFrame(f);
    const yl = f.hL * m.perMetre;
    // Beside the solute (which stays within 0,9 of the bore).
    expect(sc.pick(frontRay(-TUBE.a + 0.92 * TUBE.r, yl / 2))).toEqual({
      kind: 'column',
      side: 'solution',
    });
    expect(sc.pick(frontRay(TUBE.a + 0.92 * TUBE.r, 0.1))).toEqual({
      kind: 'column',
      side: 'water',
    });
    // The membrane's rim in the bottom channel.
    expect(sc.pick(frontRay(0.02, -TUBE.r + 0.3))).toEqual({ kind: 'membrane' });
    const s = sc.focusPoint({ kind: 'solute', index: 7 });
    expect(sc.pick(frontRay(s?.[0] ?? 0, s?.[1] ?? 0))?.kind).toBe('solute');
    const w = sc.focusPoint({ kind: 'water', index: 3 });
    expect(sc.pick(frontRay(w?.[0] ?? 0, w?.[1] ?? 0))?.kind).toMatch(/water|solute/);
    sc.dispose();
  });

  it('one glass tube along the U; each liquid’s meniscus bottoms out at its exact level', () => {
    for (const over of [{}, { c0: 5, i: 3, h0: 0.05 }]) {
      const m = osmosis(over);
      const sc = buildOsmosisScene(m, opts());
      // Medium: the glass is one mesh (front faces) spanning both arms, from the channel's
      // bottom to the tops.
      const spans = meshes(sc.scene).filter((x) => {
        const mat = x.material as THREE.Material;
        x.geometry.computeBoundingBox();
        const b = x.geometry.boundingBox;
        return (
          mat.transparent &&
          b !== null &&
          b.min.x <= -TUBE.a - TUBE.r + 1e-6 &&
          b.max.x >= TUBE.a + TUBE.r - 1e-6 &&
          b.max.y >= tubeTop() &&
          b.min.y <= -2 * TUBE.r + 1e-6
        );
      });
      expect(spans).toHaveLength(1);
      const menisci = instancedOf(sc.scene, THREE.LatheGeometry)[0] as THREE.InstancedMesh;
      // The bowl in its own frame: lowest point (its centre) at 0, rim MENISCUS above it.
      menisci.geometry.computeBoundingBox();
      const bowl = menisci.geometry.boundingBox as THREE.Box3;
      expect(bowl.min.y).toBeCloseTo(0, 6);
      expect(bowl.max.y).toBeCloseTo(MENISCUS, 6);
      for (const k of [0, 30, 120, 239]) {
        const f = osmosisFrameAt(m, m.traj.t[k] ?? 0);
        sc.setFrame(f);
        const yl = levelY(m, f.hL);
        const yr = levelY(m, f.hR);
        // The meniscus' lowest point sits at the level (the standard reading), in its arm
        // (hidden only inside a bend). (Instance matrices are float32.)
        const want: [number, number][] = [
          [-TUBE.a, yl],
          [TUBE.a, yr],
        ];
        want.forEach(([x, y], i) => {
          const { p, s } = at(menisci, i);
          expect(p.x).toBeCloseTo(x, 5);
          expect(p.y + bowl.min.y).toBeCloseTo(y, 5);
          expect(s.x).toBe(y >= ARM_START ? 1 : 0);
        });
        // Each liquid is cut where its meniscus' rim meets the glass (at the level in a bend).
        const cut = (y: number) => (y >= ARM_START ? y + MENISCUS : y);
        const planes = meshes(sc.scene)
          .flatMap((x) => (x.material as THREE.Material).clippingPlanes ?? [])
          .map((p) => p.constant)
          .sort((a, b) => a - b);
        expect(planes).toHaveLength(2);
        expect(planes[0]).toBeCloseTo(Math.min(cut(yl), cut(yr)), 12);
        expect(planes[1]).toBeCloseTo(Math.max(cut(yl), cut(yr)), 12);
        // The levels the scene reports are still the model's.
        expect(sc.levels()).toEqual({ left: yl, right: yr });
      }
      sc.dispose();
    }
  });

  it('the membrane disc stands out (stronger tint, outline on the light stage); its label sits on it', () => {
    const m = osmosis();
    for (const ink of ['1', '0']) {
      const token = (n: string) => (n === '--m3d-shell-ink' ? ink : tinted(n));
      const sc = buildOsmosisScene(m, { ...opts(), token });
      sc.setFrame(osmosisFrameAt(m, m.tEnd));
      const disc = meshes(sc.scene).find(
        (x) => x.position.x === 0 && x.position.y === -TUBE.r && x.rotation.z === Math.PI / 2,
      );
      const mat = disc?.material as THREE.MeshStandardMaterial;
      const plain = muted(tinted, '--subject-biology');
      // Half way from the plain muted colour back to the subject colour (both themes).
      expect(`#${mat.color.getHexString()}`).toBe(mixLinear(plain, '#2e9e5b', 0.5));
      expect(mat.bumpMap).not.toBeNull();
      expect(inkOf(mat) > 0).toBe(ink === '1');
      // The label's point: on the disc's front, above its centre (not its lowest point).
      const p = sc.labelAnchors().find((a) => a.id === 'semipermeable')?.point;
      expect(p).toBeDefined();
      const [x, y, z] = p ?? [9, 9, 9];
      expect(x).toBe(0);
      expect(y).toBeGreaterThan(-TUBE.r);
      expect(z).toBeGreaterThan(0);
      expect(Math.hypot(y + TUBE.r, z)).toBeLessThanOrEqual(TUBE.r * 1.05);
      sc.dispose();
    }
  });

  it('a ray above a surface does not pick the liquid (the cut is drawn and picked alike)', () => {
    const m = osmosis();
    const sc = buildOsmosisScene(m, opts());
    const f = osmosisFrameAt(m, m.tEnd);
    sc.setFrame(f);
    const yl = levelY(m, f.hL);
    const x = -TUBE.a - 0.85 * TUBE.r;
    expect(sc.pick(frontRay(x, yl - 0.3))).toEqual({ kind: 'column', side: 'solution' });
    expect(sc.pick(frontRay(x, yl + 0.4))).toBeNull();
    sc.dispose();
  });

  it('the ruler: engraved marks at the model’s scale, numbered by the page; framing holds it', () => {
    const m = osmosis();
    const sc = buildOsmosisScene(m, opts());
    const f = osmosisFrameAt(m, m.tEnd);
    sc.setFrame(f);
    const ticks = rulerTicks(m);
    const minor = rulerMinorTicks(m);
    const ink = instancedOf(sc.scene, THREE.BoxGeometry).find(
      (x) => x.count === 3 + ticks.length + minor.length,
    ) as THREE.InstancedMesh;
    expect(ink).toBeDefined();
    // (Instance matrices are float32.)
    ticks.forEach((cm, k) => {
      expect(at(ink, 3 + k).p.y).toBeCloseTo(levelY(m, cm / 100), 5);
    });
    minor.forEach((cm, k) => {
      expect(at(ink, 3 + ticks.length + k).p.y).toBeCloseTo(levelY(m, cm / 100), 5);
    });
    const words: string[] = [];
    const layer = {
      add: (w: string) => {
        words.push(w);
      },
    } as unknown as TagLayer;
    sc.tags(layer, {
      count: () => '',
      dh: (cm) => `Δh ${cm.toFixed(2)}`,
      tick: (cm) => `${String(cm)} cm`,
    });
    expect(words).toEqual([
      `Δh ${(f.dh * 100).toFixed(2)}`,
      ...ticks.map((cm) => `${String(cm)} cm`),
    ]);
    // The camera frames the tube tops, the top mark and the stand.
    const pts = sc.framePoints();
    const ys = pts.map((p) => p[1]);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(tubeTop());
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(levelY(m, m.rulerCm / 100));
    expect(Math.min(...ys)).toBeLessThan(-2 * TUBE.r);
    expect(Math.max(...pts.map((p) => p[0]))).toBeGreaterThan(TUBE.rulerX);
    sc.dispose();
  });

  it('shadow maps only when asked: the stand takes the molecules’ and the ruler’s', () => {
    const m = osmosis();
    const off = buildOsmosisScene(m, opts('high'));
    expect(shadowed(off.scene)).toEqual({ receive: 0, cast: 0 });
    off.dispose();
    const on = buildOsmosisScene(m, { ...opts('high'), shadows: true });
    expect(shadowed(on.scene)).toEqual({ receive: 1, cast: 3 });
    on.dispose();
  });

  it('frees every geometry and material it made', () => {
    expectDisposes(
      () => {
        const m = osmosis();
        const sc = buildOsmosisScene(m, opts('high'));
        sc.setFrame(osmosisFrameAt(m, m.tEnd));
        sc.setPhase(1.5);
        sc.setSelection({ kind: 'column', side: 'water' });
        return sc;
      },
      (sc) => {
        sc.dispose();
        expect(sc.scene.children).toHaveLength(0);
      },
    );
  });

  it('draw budget: about a dozen calls (glass, stand and marks merged or instanced)', () => {
    const m = osmosis();
    const sc = buildOsmosisScene(m, opts());
    sc.setFrame(osmosisFrameAt(m, m.tEnd / 2));
    sc.setSelection({ kind: 'solute', index: 0 });
    const stats = sc.drawStats();
    // Measured 2026-10-21 after the glassware pass (0.7.1): 14 calls, about 15 000 triangles on
    // Medium (High: 16 calls, about 38 000). Was 13 calls. A bigger change must update this on
    // purpose.
    expect(stats.calls).toBeLessThanOrEqual(14);
    expect(stats.triangles).toBeLessThan(20_000);
    expect(instances(sc.scene)).toBeLessThanOrEqual(600);
    sc.dispose();
  });
});
