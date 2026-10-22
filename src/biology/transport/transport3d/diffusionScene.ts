/**
 * The three.js scene of the diffusion half of "Khuếch tán & thẩm thấu" in 3D: a two-chamber
 * glass tank on a base — glass walls with a thickness, a liquid in each compartment (widths
 * V₁ : V₂) — split by a fibrous membrane sheet held in a frame, with `pores` real holes (a rim
 * on each face and a lined channel), and the solute particles (the particle recipe's cube) on the
 * side the model puts them, crossing only through a channel (`diffusionLayout.ts`). On High,
 * faint small water dots wander in both compartments (illustration, never counted). `setFrame`
 * allocates nothing; one SceneKit owns every geometry and material.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { QualityTier } from '@/perf/tiers';
import { mixLinear } from '@/ui/three/color';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { roundedBox } from '@/ui/three/materials';
import { visibleHits } from '@/ui/three/pick';
import type { TagLayer } from '@/ui/three/tagLayer';
import { SceneKit } from '../../view3d/kit';
import { structureColor } from '../../view3d/palette';
import {
  fibrousMembrane,
  glassMeshes,
  glassware,
  liquidBody,
  liquidBodyGeometry,
  liquidSurface,
  particleMaterial,
  roundedPlane,
  waterLine,
  waterLineGeometry,
  VISIBLE_LIQUID_ALPHA,
} from '../../view3d/recipes';
import type { TransportPart, TransportSelection } from './components';
import type { DiffusionFrame, DiffusionModel3D } from './diffusion';
import {
  BOX,
  brownianWalks,
  diffusionPlan,
  knotOf,
  particleAt,
  placeIn,
  waterSplit,
  walkAt,
  type DiffusionPlan,
  type Vec3,
} from './diffusionLayout';

export interface SceneOptions {
  tier: QualityTier;
  /** Sphere segments of the tier. */
  segments: number;
  /** Reads a CSS colour token. */
  token: (name: string) => string;
  /** Shadow maps onto the base (High tier on a discrete GPU). */
  shadows?: boolean;
  /** Fill and rim lights, lit back faces of see-through shells (off with software WebGL). */
  accents?: boolean;
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
  /** Faint water dots drawn (High only; illustration, never counted). */
  waterDots(): number;
  drawStats(): DrawStats;
  dispose(): void;
}

/**
 * The tank around the compartments (scene units): the glass's outer face beyond the liquid, room
 * above the liquid, the membrane frame's width, the base slab and its margin.
 */
export const TANK = {
  outer: 0.18,
  headroom: 0.5,
  frame: 0.24,
  slab: 0.26,
  margin: 0.5,
} as const;

/** Radius of the water line along each compartment's surface. */
export const WATER_LINE_R = 0.05;

/** Faint water dots on High (illustration) and their radius. */
export const WATER_DOTS = 160;
const WATER_DOT_R = 0.06;

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

/** A box from its centre and half sizes. */
const block = (x: number, y: number, z: number, hx: number, hy: number, hz: number) =>
  new THREE.BoxGeometry(2 * hx, 2 * hy, 2 * hz).translate(x, y, z);

export function buildDiffusionScene(m: DiffusionModel3D, o: SceneOptions): DiffusionScene {
  const plan = diffusionPlan(m);
  const lay = plan.layout;
  const kit = new SceneKit({
    tier: o.tier,
    segments: o.segments,
    maxParticles: Math.max(1, m.total),
    token: o.token,
    // No refraction: the particles behind the glass are data and keep their colour.
    shadows: o.shadows ?? false,
    accents: o.accents ?? true,
  });
  const { scene } = kit;
  const high = kit.tier === 'high';
  const nPores = lay.pores.length;
  const tok = (name: string) => kit.color(name);

  // ── Materials (theme tokens; the palette's roles and structures) ────────────────────
  const ink = tok('--text');
  const membraneColor = structureColor(tok, 'membrane');
  const membraneMat = fibrousMembrane(kit, { opacity: 0.56, repeat: [1.6, 0.22] });
  // Pore rims and linings: the membrane's colour drawn towards the text colour (contrast on both
  // themes), so each hole reads as a hole.
  const rimMat = kit.solid(mixLinear(membraneColor, ink, 0.5), { roughness: 0.45 });
  const liningMat = kit.solid(mixLinear(membraneColor, ink, 0.3), {
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  // The base and frame: diffuse only below High, no clear coat on High (a broad surface that
  // software rendering and integrated GPUs pay for on every pixel).
  const standColor = tok('--border-strong');
  const standMat = high
    ? kit.solid(standColor, { roughness: 0.6 })
    : kit.own(new THREE.MeshLambertMaterial({ color: standColor }));
  const soluteMat = particleMaterial(kit, 'solute');
  const haloMat = kit.glass(tok('--accent'), {
    opacity: 0.1,
    rim: { color: tok('--accent'), alpha: 0.95, strength: 1, power: 1.6 },
  });
  const outlineMat = kit.own(
    new THREE.LineBasicMaterial({ color: tok('--accent'), transparent: true, opacity: 0.95 }),
  );

  // ── Tank: glass walls with a thickness around both compartments ─────────────────────
  const cx = (lay.x0 + lay.x1) / 2;
  const hx = (lay.x1 - lay.x0) / 2;
  const glassTop = BOX.hy + TANK.outer + TANK.headroom;
  const tankSegments = Math.round(kit.seg * 1.5);
  const wall = kit.shared('diffusion-tank-wall', () => roundedBox(tankSegments, 14));
  // The glass reaches from below the liquid to the room above it.
  const fit = (mesh: THREE.Object3D, out: number) => {
    mesh.scale.set(hx + out, BOX.hy + out + TANK.headroom / 2, BOX.hz + out);
    mesh.position.set(cx, TANK.headroom / 2, 0);
  };
  // The far walls' faint back faces on High only (one more see-through layer over the whole
  // tank costs software and integrated GPUs); the near walls' rim still draws the tank, and on
  // the light stage its darker outline (ink) keeps the pale glass apart from the pale stage.
  for (const g of glassMeshes(kit, glassware(kit, { ink: true }), wall, 5, high))
    fit(g, TANK.outer);

  // ── Liquid: one body per compartment (pickable), a glossy surface and a water line on each
  const liquidGeo = kit.geometry(liquidBodyGeometry(tankSegments, VISIBLE_LIQUID_ALPHA));
  const centreOf = (s: 1 | 2) => (s === 1 ? lay.x0 + lay.w1 / 2 : lay.x1 - lay.w2 / 2);
  const widthOf = (s: 1 | 2) => (s === 1 ? lay.w1 : lay.w2);
  const compartment = (s: 1 | 2) => {
    const mesh = kit.mesh(liquidGeo, liquidBody(kit, { unlit: !high }));
    mesh.scale.set(widthOf(s) / 2, BOX.hy, BOX.hz);
    mesh.position.set(centreOf(s), 0, 0);
    mesh.renderOrder = 2;
    return mesh;
  };
  const comp1 = compartment(1);
  const comp2 = compartment(2);
  const surfaces = kit.instanced(kit.geometry(roundedPlane(1, 1, 0.06, 4)), liquidSurface(kit), 2);
  surfaces.renderOrder = 3;
  surfaces.raycast = () => undefined;
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  ([1, 2] as const).forEach((s, k) => {
    m4.compose(
      pos.set(centreOf(s), BOX.hy - 0.005, 0),
      rot.identity(),
      scl.set(widthOf(s) / 2 - 0.03, 1, BOX.hz - 0.03),
    );
    surfaces.setMatrixAt(k, m4);
  });
  surfaces.instanceMatrix.needsUpdate = true;
  // Where each surface meets the glass: one thin line round each compartment (one merged mesh,
  // not pickable), the liquid's colour drawn towards the text colour (`waterLine`, both
  // themes). Its two loops show the compartments' widths V₁ : V₂ even where the liquid is faint.
  const lineParts = ([1, 2] as const).map((s) =>
    waterLineGeometry(widthOf(s) / 2 - 0.03, BOX.hz - 0.03, 0.12, WATER_LINE_R).translate(
      centreOf(s),
      BOX.hy - 0.005,
      0,
    ),
  );
  const waterLines = kit.mesh(kit.geometry(mergeGeometries(lineParts)), waterLine(kit));
  for (const g of lineParts) g.dispose();
  waterLines.renderOrder = 3;
  waterLines.raycast = () => undefined;

  // ── The stand: base slab and the membrane's frame (one merged mesh) ─────────────────
  const baseTop = -BOX.hy - TANK.outer;
  const baseBottom = baseTop - TANK.slab;
  const baseHx = hx + TANK.outer + TANK.margin;
  const baseHz = BOX.hz + TANK.outer + TANK.margin;
  const fw = TANK.frame;
  // Half thickness of the frame along x: a little more than the membrane's.
  const fx = BOX.mh + 0.08;
  // The frame runs round the membrane's edge (outside the liquid), through the glass walls and
  // up to the glass top; it is apparatus, not part of the membrane.
  const frameTop = glassTop + 0.04;
  const standParts: THREE.BufferGeometry[] = [
    roundedBox(Math.max(8, kit.seg), 6)
      .scale(baseHx, TANK.slab / 2, baseHz)
      .translate(cx, (baseTop + baseBottom) / 2, 0),
    // Top bar: from the liquid's top up to the glass top.
    block(lay.xm, (BOX.hy + frameTop) / 2, 0, fx, (frameTop - BOX.hy) / 2, BOX.hz + fw),
    // Bottom bar: from the base up to the liquid's bottom.
    block(lay.xm, (baseTop - BOX.hy) / 2, 0, fx, (-BOX.hy - baseTop) / 2, BOX.hz + fw),
    // Side bars along the front and back walls.
    ...[-1, 1].map((s) =>
      block(
        lay.xm,
        (frameTop + baseTop) / 2,
        s * (BOX.hz + fw / 2),
        fx,
        (frameTop - baseTop) / 2,
        fw / 2,
      ),
    ),
  ];
  const stand = kit.mesh(kit.geometry(mergeGeometries(standParts)), standMat);
  for (const g of standParts) g.dispose();
  stand.raycast = () => undefined;
  kit.shadow(baseBottom - 0.02, baseHx + 1, baseHz + 1, 0.24).position.x = cx;

  // ── Membrane sheet with round channels (pores: holes with rims and a lining) ────────
  const membrane = kit.mesh(kit.geometry(membraneGeometry(plan, kit.seg)), membraneMat);
  membrane.renderOrder = 4;
  const poreSides = Math.max(12, kit.seg);
  const ringGeo = kit.geometry(new THREE.TorusGeometry(BOX.poreR, 0.035, 6, poreSides));
  const rims = kit.instanced(ringGeo, rimMat, 2 * nPores);
  const linings = kit.instanced(kit.cylinder(poreSides, true), liningMat, nPores);
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
  const unitAt: Vec3 = [0, 0, 0];
  const euler = new THREE.Euler();

  // ── Faint water dots (High only; illustration, never counted, never crossing) ───────
  const nWater = high ? WATER_DOTS : 0;
  const water1 = waterSplit(lay, nWater);
  const waterWalks = nWater > 0 ? brownianWalks(nWater, m.inputs.run + 31) : null;
  // The particle recipe's water colour (muted --chart-6) drawn halfway into the liquid's: faint
  // by colour, not by blending (opaque, diffuse, 20 faces: a dot a few pixels wide).
  const waterMat = kit.own(
    new THREE.MeshLambertMaterial({
      color: mixLinear(structureColor(tok, 'nucleus'), structureColor(tok, 'liquid'), 0.45),
    }),
  );
  const waterDots = kit.instanced(
    kit.geometry(new THREE.IcosahedronGeometry(1, 0)),
    waterMat,
    Math.max(1, nWater),
  );
  waterDots.count = nWater;
  waterDots.visible = nWater > 0;
  waterDots.raycast = () => undefined;

  // ── Shadow maps (High on a discrete GPU): particles and the frame onto the base ──────
  if (kit.groundShadows([cx, baseTop, 0], Math.hypot(baseHx, glassTop - baseTop, baseHz))) {
    stand.receiveShadow = true;
    stand.castShadow = true;
    particles.castShadow = true;
  }

  // ── Selection: a halo (particle, pore) or an outline (compartment, membrane) ─────────
  const halo = kit.mesh(kit.sphere(), haloMat);
  halo.visible = false;
  halo.renderOrder = 8;
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
      out.set(centreOf(sel.side), 0, 0);
      return Math.max(widthOf(sel.side), BOX.hy * 2) / 2;
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
      outline.position.set(centreOf(selected.side), 0, 0);
      outline.scale.set(widthOf(selected.side), 2 * BOX.hy, 2 * BOX.hz).multiplyScalar(1.01);
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
    if (waterWalks) {
      const knot = jitter ? knotOf(m, f.t) : 0;
      rot.identity();
      for (let j = 0; j < nWater; j++) {
        walkAt(waterWalks, j, knot, unitAt);
        placeIn(lay, j < water1 ? 1 : 2, unitAt, at);
        m4.compose(pos.set(at[0], at[1], at[2]), rot, scl.setScalar(WATER_DOT_R));
        waterDots.setMatrixAt(j, m4);
      }
      waterDots.instanceMatrix.needsUpdate = true;
      waterDots.boundingSphere = null;
    }
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
      const words = text.count(n);
      layer.add(words, centreOf(s), glassTop + 0.4, 0, 'word', words.length);
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
      for (const x of [cx - baseHx, cx + baseHx])
        for (const y of [baseBottom, glassTop + 0.6])
          for (const z of [-BOX.hz - TANK.outer, BOX.hz + TANK.outer]) pts.push([x, y, z]);
      return pts;
    },
    labelAnchors,
    tags,
    sides() {
      let left = 0;
      for (let j = 0; j < m.total; j++) if ((places[3 * j] ?? 0) < lay.xm) left++;
      return { left, right: m.total - left };
    },
    waterDots: () => (waterDots.visible ? waterDots.count : 0),
    drawStats: () => drawStats(scene),
    dispose: () => {
      kit.dispose();
    },
  };
}
