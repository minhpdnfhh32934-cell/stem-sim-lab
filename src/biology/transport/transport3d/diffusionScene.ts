/**
 * The three.js scene of the diffusion half of "Khuếch tán & thẩm thấu" in 3D: a glass box split
 * into two compartments (widths V₁ : V₂) by a membrane slab with `pores` round channels, and the
 * solute particles (the palette's solute cube) on the side the model puts them, crossing only
 * through a channel (`diffusionLayout.ts`). `setFrame` allocates nothing; one SceneKit owns every
 * geometry and material.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { roundedBox } from '@/ui/three/materials';
import { visibleHits } from '@/ui/three/pick';
import type { TagLayer } from '@/ui/three/tagLayer';
import { SceneKit } from '../../view3d/kit';
import { ROLES } from '../../view3d/palette';
import type { TransportPart, TransportSelection } from './components';
import type { DiffusionFrame, DiffusionModel3D } from './diffusion';
import { BOX, diffusionPlan, particleAt, type DiffusionPlan, type Vec3 } from './diffusionLayout';

export interface SceneOptions {
  tier: QualityTier;
  /** Sphere segments of the tier. */
  segments: number;
  /** Reads a CSS colour token. */
  token: (name: string) => string;
}

export interface LabelAnchor {
  id: TransportPart;
  point: Vec3;
}

/** Words of the tags over the picture (from the view, localized). */
export interface TagText {
  /** "112 hạt". */
  count: (n: number) => string;
  /** "Δh = 2,6 cm". */
  dh: (cm: number) => string;
  /** A ruler tick, "10 cm". */
  tick: (cm: number) => string;
}

export interface DiffusionScene {
  readonly mode: 'diffusion';
  readonly kit: SceneKit;
  readonly scene: THREE.Scene;
  readonly plan: DiffusionPlan;
  /** Shows a moment of the model; `jitter` false freezes the Brownian walk. No allocation. */
  setFrame(frame: DiffusionFrame, jitter: boolean): void;
  setSelection(sel: TransportSelection | null): void;
  pick(ray: THREE.Raycaster): TransportSelection | null;
  /** Where a picked thing is now (camera focus, tests), or null when it is not drawn. */
  focusPoint(sel: TransportSelection): Vec3 | null;
  /** Points the camera must show. */
  framePoints(): Vec3[];
  labelAnchors(): LabelAnchor[];
  tags(layer: TagLayer, text: TagText): void;
  /** Particles drawn left and right of the membrane now (counted from their places). */
  sides(): { left: number; right: number };
  drawStats(): DrawStats;
  dispose(): void;
}

/** A shape in the membrane's plane (X = −z, Y = y) with a round hole per pore. */
function membraneGeometry(plan: DiffusionPlan, seg: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-BOX.hz, -BOX.hy);
  s.lineTo(BOX.hz, -BOX.hy);
  s.lineTo(BOX.hz, BOX.hy);
  s.lineTo(-BOX.hz, BOX.hy);
  s.closePath();
  for (const p of plan.layout.pores) {
    const h = new THREE.Path();
    h.absarc(-p.z, p.y, BOX.poreR, 0, 2 * Math.PI, true);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 2 * BOX.mh,
    bevelEnabled: false,
    curveSegments: Math.max(8, Math.round(seg / 2)),
  });
  // Extrusion along +z of the shape → along x of the scene, centred on the membrane.
  g.translate(0, 0, -BOX.mh);
  g.rotateY(Math.PI / 2);
  g.translate(plan.layout.xm, 0, 0);
  g.computeBoundingSphere();
  return g;
}

export function buildDiffusionScene(m: DiffusionModel3D, o: SceneOptions): DiffusionScene {
  const plan = diffusionPlan(m);
  const lay = plan.layout;
  const kit = new SceneKit({
    tier: o.tier,
    segments: o.segments,
    maxParticles: Math.max(1, m.total),
    token: o.token,
  });
  const { scene } = kit;
  const nPores = lay.pores.length;

  // ── Materials (theme tokens; the palette's roles) ────────────────────────────────────
  const muted = kit.color('--text-muted');
  const boxMat = kit.glass(muted, {
    opacity: 0.05,
    rim: { color: kit.color('--text'), alpha: 0.22, strength: 0.35, power: 2.4 },
  });
  const edgeMat = kit.own(
    new THREE.LineBasicMaterial({ color: muted, transparent: true, opacity: 0.6 }),
  );
  const membraneColor = kit.color(ROLES.membrane.token);
  const membraneMat = kit.glass(membraneColor, {
    opacity: 0.5,
    roughness: 0.5,
    side: THREE.DoubleSide,
    rim: { color: membraneColor, alpha: 0.75, strength: 0.6, power: 1.8 },
  });
  const rimMat = kit.solid(kit.color('--text'), { roughness: 0.45 });
  const liningMat = kit.own(
    new THREE.MeshStandardMaterial({
      color: membraneColor,
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
  );
  const soluteMat = kit.solid(kit.color(ROLES.solute.token), { roughness: 0.3, clearcoat: 0.5 });
  const haloMat = kit.glass(kit.color('--accent'), {
    opacity: 0.1,
    rim: { color: kit.color('--accent'), alpha: 0.95, strength: 1, power: 1.6 },
  });
  const outlineMat = kit.own(
    new THREE.LineBasicMaterial({ color: kit.color('--accent'), transparent: true, opacity: 0.95 }),
  );

  // ── Box: two compartments (pickable glass) and the outline ──────────────────────────
  const unitBox = kit.geometry(new THREE.BoxGeometry(1, 1, 1));
  const compartment = (s: 1 | 2) => {
    const mesh = kit.mesh(unitBox, boxMat);
    const w = s === 1 ? lay.w1 : lay.w2;
    const x = s === 1 ? lay.x0 + w / 2 : lay.xm + BOX.mh + w / 2;
    mesh.scale.set(w, 2 * BOX.hy, 2 * BOX.hz);
    mesh.position.set(x, 0, 0);
    mesh.renderOrder = 2;
    return mesh;
  };
  const comp1 = compartment(1);
  const comp2 = compartment(2);
  const outerW = lay.x1 - lay.x0;
  const boxGeo = new THREE.BoxGeometry(outerW, 2 * BOX.hy, 2 * BOX.hz);
  const edges = new THREE.LineSegments(kit.geometry(new THREE.EdgesGeometry(boxGeo)), edgeMat);
  boxGeo.dispose();
  edges.position.set((lay.x0 + lay.x1) / 2, 0, 0);
  scene.add(edges);
  kit.shadow(-BOX.hy - 0.3, outerW / 2 + 1, BOX.hz + 1.2, 0.2);

  // ── Membrane slab with round channels ────────────────────────────────────────────────
  const membrane = kit.mesh(kit.geometry(membraneGeometry(plan, kit.seg)), membraneMat);
  membrane.renderOrder = 3;
  const sides = Math.max(12, kit.seg);
  const ringGeo = kit.geometry(new THREE.TorusGeometry(BOX.poreR, 0.035, 6, sides));
  const rims = kit.instanced(ringGeo, rimMat, 2 * nPores);
  const linings = kit.instanced(kit.cylinder(sides, true), liningMat, nPores);
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const faceX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const alongX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  lay.pores.forEach((p, k) => {
    for (const side of [-1, 1]) {
      pos.set(lay.xm + side * BOX.mh, p.y, p.z);
      m4.compose(pos, faceX, scl.set(1, 1, 1));
      rims.setMatrixAt(2 * k + (side < 0 ? 0 : 1), m4);
    }
    pos.set(lay.xm, p.y, p.z);
    m4.compose(pos, alongX, scl.set(BOX.poreR, 2 * BOX.mh, BOX.poreR));
    linings.setMatrixAt(k, m4);
  });
  for (const mesh of [rims, linings]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = mesh.count > 0;
  }

  // ── Solute particles ─────────────────────────────────────────────────────────────────
  const soluteGeo = kit.geometry(
    roundedBox(Math.max(8, Math.round(kit.seg / 2)), 6).scale(0.74, 0.74, 0.74),
  );
  const particles = kit.instanced(soluteGeo, soluteMat, Math.max(1, m.total));
  particles.count = m.total;
  /** Places now (x, y, z per particle) for picking, focus and counting. */
  const places = new Float32Array(m.total * 3);
  const at: Vec3 = [0, 0, 0];
  const euler = new THREE.Euler();

  // ── Selection: a halo (particle, pore) or an outline (compartment, membrane) ─────────
  const halo = kit.mesh(kit.sphere(), haloMat);
  halo.visible = false;
  halo.renderOrder = 4;
  const outlineBox = new THREE.BoxGeometry(1, 1, 1);
  const outline = new THREE.LineSegments(
    kit.geometry(new THREE.EdgesGeometry(outlineBox)),
    outlineMat,
  );
  outlineBox.dispose();
  outline.visible = false;
  scene.add(outline);

  let frame: DiffusionFrame | null = null;
  let selected: TransportSelection | null = null;

  function pointOf(sel: TransportSelection, out: THREE.Vector3): number | null {
    if (sel.kind === 'particle') {
      if (sel.index < 0 || sel.index >= m.total) return null;
      out.set(
        places[3 * sel.index] ?? 0,
        places[3 * sel.index + 1] ?? 0,
        places[3 * sel.index + 2] ?? 0,
      );
      return BOX.r * 2.4;
    }
    if (sel.kind === 'pore') {
      const p = lay.pores[sel.index];
      if (!p) return null;
      out.set(lay.xm, p.y, p.z);
      return BOX.poreR * 1.5;
    }
    if (sel.kind === 'membrane') {
      out.set(lay.xm, 0, 0);
      return BOX.hy;
    }
    if (sel.kind === 'compartment') {
      const mesh = sel.side === 1 ? comp1 : comp2;
      out.copy(mesh.position);
      return Math.max(mesh.scale.x, BOX.hy * 2) / 2;
    }
    return null;
  }

  const haloAt = new THREE.Vector3();
  function placeSelection(): void {
    halo.visible = false;
    outline.visible = false;
    if (!selected) return;
    if (selected.kind === 'particle' || selected.kind === 'pore') {
      const r = pointOf(selected, haloAt);
      if (r === null) return;
      halo.position.copy(haloAt);
      halo.scale.setScalar(r);
      halo.visible = true;
      return;
    }
    if (selected.kind === 'compartment') {
      const mesh = selected.side === 1 ? comp1 : comp2;
      outline.position.copy(mesh.position);
      outline.scale.copy(mesh.scale).multiplyScalar(1.01);
      outline.visible = true;
    } else if (selected.kind === 'membrane') {
      outline.position.set(lay.xm, 0, 0);
      outline.scale.set(2 * BOX.mh * 1.6, 2 * BOX.hy * 1.01, 2 * BOX.hz * 1.01);
      outline.visible = true;
    }
  }

  function setFrame(f: DiffusionFrame, jitter: boolean): void {
    frame = f;
    for (let j = 0; j < m.total; j++) {
      particleAt(plan, f, j, jitter, at);
      places[3 * j] = at[0];
      places[3 * j + 1] = at[1];
      places[3 * j + 2] = at[2];
      pos.set(at[0], at[1], at[2]);
      // A fixed tilt per particle (illustration): the cubes do not all line up.
      rot.setFromEuler(euler.set(j * 1.37, j * 0.71, j * 0.29));
      m4.compose(pos, rot, scl.setScalar(BOX.r));
      particles.setMatrixAt(j, m4);
    }
    particles.instanceMatrix.needsUpdate = true;
    particles.boundingSphere = null;
    particles.visible = m.total > 0;
    placeSelection();
  }

  // ── Picking: particles and pores first, then the membrane, then a compartment ───────
  const pickables: THREE.Object3D[] = [particles, linings, rims, membrane, comp1, comp2];
  function pick(ray: THREE.Raycaster): TransportSelection | null {
    // Parts placed since the last frame are where they are now.
    scene.updateMatrixWorld();
    const hits = visibleHits(ray, pickables, 0.01);
    const inner = hits.find(
      (h) => h.object === particles || h.object === linings || h.object === rims,
    );
    if (inner) {
      const id = inner.instanceId ?? -1;
      if (id < 0) return null;
      if (inner.object === particles) return id < m.total ? { kind: 'particle', index: id } : null;
      const k = inner.object === rims ? Math.floor(id / 2) : id;
      return k < nPores ? { kind: 'pore', index: k } : null;
    }
    if (hits.some((h) => h.object === membrane)) return { kind: 'membrane' };
    const box = hits.find((h) => h.object === comp1 || h.object === comp2);
    if (box) return { kind: 'compartment', side: box.object === comp1 ? 1 : 2 };
    return null;
  }

  function labelAnchors(): LabelAnchor[] {
    const out: LabelAnchor[] = [
      { id: 'compartment1', point: [lay.x0 + lay.w1 * 0.25, BOX.hy, BOX.hz] },
      { id: 'compartment2', point: [lay.x1 - lay.w2 * 0.25, BOX.hy, BOX.hz] },
      { id: 'membrane', point: [lay.xm, -BOX.hy * 0.8, BOX.hz] },
    ];
    const p = lay.pores[0];
    if (p) out.push({ id: 'pore', point: [lay.xm + BOX.mh, p.y - BOX.poreR, p.z] });
    // A particle on the side nearest the viewer (side 2 when it holds any).
    const f = frame;
    if (f && m.total > 0) {
      let j = -1;
      for (let k = 0; k < m.total; k++) {
        const right = (places[3 * k] ?? 0) > lay.xm;
        if (right === f.n2 > 0) {
          j = k;
          break;
        }
      }
      if (j >= 0)
        out.push({
          id: 'particle',
          point: [places[3 * j] ?? 0, (places[3 * j + 1] ?? 0) - BOX.r, places[3 * j + 2] ?? 0],
        });
    }
    return out;
  }

  function tags(layer: TagLayer, text: TagText): void {
    const f = frame;
    if (!f) return;
    for (const [s, n] of [
      [1, f.n1],
      [2, f.n2],
    ] as const) {
      const mesh = s === 1 ? comp1 : comp2;
      const words = text.count(n);
      layer.add(words, mesh.position.x, BOX.hy + 0.45, 0, 'word', words.length);
    }
  }

  return {
    mode: 'diffusion',
    kit,
    scene,
    plan,
    setFrame,
    setSelection(sel) {
      selected = sel;
      placeSelection();
    },
    pick,
    focusPoint(sel) {
      const out = new THREE.Vector3();
      return pointOf(sel, out) === null ? null : [out.x, out.y, out.z];
    },
    framePoints() {
      const pts: Vec3[] = [];
      for (const x of [lay.x0, lay.x1])
        for (const y of [-BOX.hy, BOX.hy + 0.6])
          for (const z of [-BOX.hz, BOX.hz]) pts.push([x, y, z]);
      return pts;
    },
    labelAnchors,
    tags,
    sides() {
      let left = 0;
      for (let j = 0; j < m.total; j++) if ((places[3 * j] ?? 0) < lay.xm) left++;
      return { left, right: m.total - left };
    },
    drawStats: () => drawStats(scene),
    dispose: () => {
      kit.dispose();
    },
  };
}
