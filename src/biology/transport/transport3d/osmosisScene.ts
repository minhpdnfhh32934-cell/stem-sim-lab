/**
 * The three.js scene of the osmosis half of "Khuếch tán & thẩm thấu" in 3D: a glass U-tube (one
 * continuous tube along the U, `uTube.ts`) on a stand, a semipermeable membrane disc at the
 * bottom junction, the solution (left) and pure water (right) at the model's heights — each
 * liquid one tube capped by a concave meniscus whose lowest point is the exact level (the standard
 * reading; the rim rising to the glass is illustration), clipped where that rim meets the wall —
 * on one vertical scale with a cm ruler (a plate with engraved marks; numbers drawn by the
 * page), the Δh bracket, the starting level, the solute sample (the particle recipe's cube) spread
 * over the solution column and illustrative water molecules crossing the membrane (`osmosis.ts`).
 * `setFrame`/`setPhase` allocate nothing; one SceneKit owns every geometry and material.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { glass, roundedBox } from '@/ui/three/materials';
import { visibleHits } from '@/ui/three/pick';
import type { TagLayer } from '@/ui/three/tagLayer';
import { NEUTRAL, SceneKit } from '../../view3d/kit';
import { ROLES, structureColor } from '../../view3d/palette';
import {
  fibrousMembrane,
  glassMeshes,
  glassware,
  meniscusGeometry,
  particleMaterial,
  shellLook,
} from '../../view3d/recipes';
import type { TransportSelection } from './components';
import type { LabelAnchor, SceneOptions, TagText } from './diffusionScene';
import {
  SOLUTE_DRAWN,
  TUBE,
  WATER_DRAWN,
  levelY,
  rulerMinorTicks,
  rulerTicks,
  soluteAt,
  tubeTop,
  waterAt,
  type OsmosisFrame,
  type OsmosisModel3D,
  type Vec3,
} from './osmosis';
import { ARM_START, GLASS_INNER, LIQUID_SHARE, halfAxis, sweepTube, uAxis } from './uTube';

export interface OsmosisScene {
  readonly mode: 'osmosis';
  readonly kit: SceneKit;
  readonly scene: THREE.Scene;
  /** Shows a moment of the model (heights, solute spread, water moved); no allocation. */
  setFrame(frame: OsmosisFrame): void;
  /** Illustrative wobble of the molecules (seconds of animation); no allocation. */
  setPhase(phase: number): void;
  setSelection(sel: TransportSelection | null): void;
  pick(ray: THREE.Raycaster): TransportSelection | null;
  focusPoint(sel: TransportSelection): Vec3 | null;
  framePoints(): Vec3[];
  labelAnchors(): LabelAnchor[];
  tags(layer: TagLayer, text: TagText): void;
  /** Scene heights of the two liquid surfaces now (tests). */
  levels(): { left: number; right: number };
  /** Molecules drawn now. */
  drawn(): { solute: number; water: number };
  drawStats(): DrawStats;
  dispose(): void;
}

const { a: A, r: R } = TUBE;
/** Liquid radius inside the glass. */
const LR = R * LIQUID_SHARE;
/** The membrane disc's radius (a little wider than the glass). */
const MEMBRANE_R = R * 1.05;
/**
 * How far the meniscus' rim rises above its lowest point (illustration). The lowest point is the
 * model's level — where a learner reads a concave water meniscus.
 */
export const MENISCUS = 0.07;
/** The stand: saddles under the channel, the base slab, room around the subject. */
export const STAND = { saddle: 0.2, slab: 0.24, margin: 0.55 } as const;
/** The ruler plate: half width and depth, room above its top mark, mark lengths. */
export const PLATE = { hw: 0.3, hd: 0.07, above: 0.4, major: 0.3, minor: 0.15 } as const;

type Side = 'solution' | 'water';

export function buildOsmosisScene(m: OsmosisModel3D, o: SceneOptions): OsmosisScene {
  const kit = new SceneKit({
    tier: o.tier,
    segments: o.segments,
    maxParticles: SOLUTE_DRAWN + WATER_DRAWN,
    token: o.token,
    // No refraction: the liquids and molecules behind the glass are data and keep their colours.
    shadows: o.shadows ?? false,
    accents: o.accents ?? true,
  });
  const { scene } = kit;
  const high = kit.tier === 'high';
  const top = tubeTop();
  const sides = Math.max(16, kit.seg * 2);
  const bendSteps = Math.max(6, Math.round(kit.seg / 2));
  const tok = (name: string) => kit.color(name);

  // ── Materials (theme tokens; the palette's roles) ────────────────────────────────────
  const muted = tok('--text-muted');
  // Liquids are tints, not roles: the solution takes the solute's hue, pure water the 2D's.
  const tints: Record<Side, string> = {
    solution: tok(ROLES.solute.token),
    water: tok('--chart-1'),
  };
  const surfacePlanes: Record<Side, THREE.Plane> = {
    solution: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
    water: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
  };
  const liquidMat = (side: Side, opacity: number) => {
    const c = tints[side];
    const mat = kit.own(
      glass(c, {
        opacity,
        roughness: 0.12,
        rim: { color: c, alpha: 0.3, strength: 0.35, power: 2.2 },
      }),
    );
    // Each liquid ends at its own surface (renderer.localClippingEnabled; the meniscus closes
    // the cut).
    mat.clippingPlanes = [surfacePlanes[side]];
    return mat;
  };
  const meniscusMat = kit.own(
    glass(NEUTRAL, { opacity: 0.5, roughness: 0.05, side: THREE.DoubleSide }),
  );
  const soluteMat = particleMaterial(kit, 'solute');
  // The water molecules keep the role's own token (the legend's swatch).
  const waterMat = kit.solid(tok(ROLES.water.token), { roughness: 0.25, clearcoat: 0.6 });
  const inkMat = kit.solid(tok('--text'), { roughness: 0.5 });
  const faintMat = kit.solid(muted, { roughness: 0.5 });
  const plateMat = kit.solid(tok('--border'), { roughness: 0.55, clearcoat: 0.2 });
  const standMat = kit.solid(tok('--border-strong'), { roughness: 0.6, clearcoat: 0.2 });
  const accent = tok('--accent');
  const haloMat = kit.glass(accent, {
    opacity: 0.1,
    rim: { color: accent, alpha: 0.95, strength: 1, power: 1.6 },
  });
  const markMat = kit.solid(accent, { roughness: 0.4 });

  // ── Glass U-tube: one tube along the U, a lip at each open top (one merged geometry) ──
  const lipR = (R * (1 + GLASS_INNER)) / 2;
  const lipT = (R * (1 - GLASS_INNER)) / 2 + 0.02;
  const glassParts = [
    sweepTube(uAxis(top, bendSteps), R, sides),
    ...[-A, A].map((x) =>
      new THREE.TorusGeometry(lipR, lipT, 6, sides).rotateX(Math.PI / 2).translate(x, top, 0),
    ),
  ];
  const glassGeo = kit.geometry(mergeGeometries(glassParts));
  for (const g of glassParts) g.dispose();
  // The far wall's faint back face and the wall's inner face on High only (two more see-through
  // layers over the tall tube cost software and integrated GPUs); the rim still draws the tube.
  glassMeshes(kit, glassware(kit), glassGeo, 5, high);
  if (high) {
    const inner = shellLook(kit, structureColor(tok, 'glass'), {
      radius: 1,
      opacity: 0.025,
      rim: 0.5,
    });
    const innerGeo = kit.geometry(sweepTube(uAxis(top, bendSteps), R * GLASS_INNER, sides, true));
    glassMeshes(kit, { refract: null, back: null, front: inner.front }, innerGeo, 3, false);
  }

  // ── Liquids: each side one tube from the membrane up its arm, clipped at its surface ──
  // The model's level of each side, and where its liquid is cut (the meniscus' rim).
  const surfaces: Record<Side, number> = { solution: 0, water: 0 };
  const cuts: Record<Side, number> = { solution: 0, water: 0 };
  const liquidTube = (s: -1 | 1, side: Side, opacity: number) => {
    const geo = kit.geometry(sweepTube(halfAxis(s, top, bendSteps), LR, sides));
    const mesh = kit.mesh(geo, liquidMat(side, opacity));
    mesh.renderOrder = 2;
    // Rays see the liquid only up to its surface (the clipping plane is a drawing rule only).
    mesh.raycast = (rc, hits) => {
      const n = hits.length;
      THREE.Mesh.prototype.raycast.call(mesh, rc, hits);
      for (let i = hits.length - 1; i >= n; i--)
        if ((hits[i]?.point.y ?? 0) > cuts[side] + 1e-6) hits.splice(i, 1);
    };
    return mesh;
  };
  const leftLiquid = liquidTube(-1, 'solution', 0.26);
  const rightLiquid = liquidTube(1, 'water', 0.22);
  // The recipe's bowl has its rim at y = 0; lifted so its lowest point is at y = 0 (the level).
  const menisci = kit.instanced(
    meniscusGeometry(kit, LR, MENISCUS).translate(0, MENISCUS, 0),
    meniscusMat,
    2,
  );
  menisci.renderOrder = 3;
  menisci.setColorAt(0, new THREE.Color(tints.solution));
  menisci.setColorAt(1, new THREE.Color(tints.water));
  if (menisci.instanceColor) menisci.instanceColor.needsUpdate = true;

  // ── Semipermeable membrane: a thin fibrous disc across the bottom junction ──────────
  // The lesson's key part: its muted colour half way back to --subject-biology and, on the light
  // stage, a darker outline, so it stands apart from both liquids and the stand. A little wider
  // than the glass with a round bead at its edge, as if held between the two halves of the tube
  // (one merged geometry: disc + bead; illustration).
  const discParts = [
    new THREE.CylinderGeometry(MEMBRANE_R, MEMBRANE_R, 0.1, sides),
    new THREE.TorusGeometry(MEMBRANE_R, 0.05, 6, sides).rotateX(Math.PI / 2),
  ];
  const discGeo = kit.geometry(mergeGeometries(discParts));
  for (const g of discParts) g.dispose();
  const membrane = kit.mesh(
    discGeo,
    fibrousMembrane(kit, { opacity: 0.9, repeat: [3, 0.45], emphasis: 0.5, ink: true }),
  );
  membrane.rotation.z = Math.PI / 2;
  membrane.position.set(0, -R, 0);
  membrane.renderOrder = 4;

  // ── Starting level h₀ on both arms ───────────────────────────────────────────────────
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const upright = new THREE.Quaternion();
  const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const ringGeo = kit.geometry(new THREE.TorusGeometry(R * 1.05, 0.03, 6, sides));
  const startY = levelY(m, m.p.h0);
  const rings = kit.instanced(ringGeo, faintMat, 2);
  [-A, A].forEach((x, k) => {
    m4.compose(pos.set(x, startY, 0), flat, scl.set(1, 1, 1));
    rings.setMatrixAt(k, m4);
  });
  rings.instanceMatrix.needsUpdate = true;

  // ── The stand: a base slab with two saddles under the channel (one merged mesh) ──────
  const baseTop = -2 * R - STAND.saddle;
  const baseBottom = baseTop - STAND.slab;
  const baseX0 = -A - R - STAND.margin;
  const baseX1 = TUBE.rulerX + PLATE.hw + STAND.margin;
  const baseCx = (baseX0 + baseX1) / 2;
  const baseHz = R + STAND.margin;
  const block = (cx: number, cy: number, hx: number, hy: number, hz: number) =>
    roundedBox(Math.max(8, kit.seg), 6).scale(hx, hy, hz).translate(cx, cy, 0);
  const standParts = [
    block(baseCx, (baseTop + baseBottom) / 2, (baseX1 - baseX0) / 2, STAND.slab / 2, baseHz),
    ...[-1, 1].map((s) =>
      block(s * (A - 0.9), baseTop + STAND.saddle / 2, 0.22, STAND.saddle / 2 + 0.02, R * 0.8),
    ),
  ];
  const stand = kit.mesh(kit.geometry(mergeGeometries(standParts)), standMat);
  for (const g of standParts) g.dispose();
  stand.raycast = () => undefined;
  kit.shadow(baseBottom - 0.02, (baseX1 - baseX0) / 2 + 0.6, baseHz + 0.6, 0.22).position.x =
    baseCx;

  // ── Ruler: a plate standing on the base, marks engraved at the model's scale ─────────
  const ticks = rulerTicks(m);
  const minor = rulerMinorTicks(m);
  const plateTop = levelY(m, m.rulerCm / 100) + PLATE.above;
  const plate = kit.mesh(kit.roundedBox(6), plateMat);
  plate.scale.set(PLATE.hw, (plateTop - baseTop) / 2, PLATE.hd);
  plate.position.set(TUBE.rulerX, (plateTop + baseTop) / 2, 0);
  plate.raycast = () => undefined;
  const unit = kit.geometry(new THREE.BoxGeometry(1, 1, 1));
  // Instances: 0 the Δh bracket, 1–2 its caps, then one per numbered mark, then the small marks.
  const ink = kit.instanced(unit, inkMat, 3 + ticks.length + minor.length);
  ink.raycast = () => undefined;
  const box = (
    mesh: THREE.InstancedMesh,
    k: number,
    x: number,
    y: number,
    sx: number,
    sy: number,
    z = 0,
    sz = Math.min(sx, sy, 0.05),
  ) => {
    m4.compose(pos.set(x, y, z), upright, scl.set(sx, sy, sz));
    mesh.setMatrixAt(k, m4);
  };
  // Marks run in from the plate's left edge (towards the tube) and sit in its front face.
  const left = TUBE.rulerX - PLATE.hw;
  ticks.forEach((cm, k) => {
    box(
      ink,
      3 + k,
      left + PLATE.major / 2,
      levelY(m, cm / 100),
      PLATE.major,
      0.032,
      PLATE.hd,
      0.02,
    );
  });
  minor.forEach((cm, k) => {
    const y = levelY(m, cm / 100);
    box(ink, 3 + ticks.length + k, left + PLATE.minor / 2, y, PLATE.minor, 0.02, PLATE.hd, 0.02);
  });
  const guides = kit.instanced(unit, faintMat, 2);
  guides.raycast = () => undefined;

  // ── Molecules ────────────────────────────────────────────────────────────────────────
  const soluteGeo = kit.geometry(
    roundedBox(Math.max(8, Math.round(kit.seg / 2)), 6).scale(0.74, 0.74, 0.74),
  );
  const solutes = kit.instanced(soluteGeo, soluteMat, SOLUTE_DRAWN);
  const waters = kit.instanced(kit.sphere(0.6), waterMat, WATER_DRAWN);
  const soluteAtNow = new Float32Array(SOLUTE_DRAWN * 3);
  const waterAtNow = new Float32Array(WATER_DRAWN * 3);

  // ── Shadow maps (High on a discrete GPU): molecules and the ruler onto the stand ─────
  const shadowRadius = Math.hypot((baseX1 - baseX0) / 2, top - baseTop, baseHz);
  if (kit.groundShadows([baseCx, baseTop, 0], shadowRadius)) {
    stand.receiveShadow = true;
    for (const mesh of [solutes, waters, plate]) mesh.castShadow = true;
  }

  // ── Selection: a halo (molecule) or an accent ring (column surface, membrane) ────────
  const halo = kit.mesh(kit.sphere(), haloMat);
  halo.visible = false;
  halo.renderOrder = 8;
  const mark = kit.mesh(kit.geometry(new THREE.TorusGeometry(1, 0.05, 6, sides)), markMat);
  mark.visible = false;

  let frame: OsmosisFrame | null = null;
  let phase = 0;
  let selected: TransportSelection | null = null;
  const at: Vec3 = [0, 0, 0];
  const euler = new THREE.Euler();

  function placeMolecules(): void {
    const f = frame;
    if (!f) return;
    for (let j = 0; j < SOLUTE_DRAWN; j++) {
      soluteAt(m, f, j, phase, at);
      soluteAtNow.set(at, 3 * j);
      pos.set(at[0], at[1], at[2]);
      rot.setFromEuler(euler.set(j * 1.37 + phase * 0.2, j * 0.71, j * 0.29));
      m4.compose(pos, rot, scl.setScalar(TUBE.soluteR));
      solutes.setMatrixAt(j, m4);
    }
    rot.identity();
    for (let j = 0; j < WATER_DRAWN; j++) {
      waterAt(m, f, j, phase, at);
      waterAtNow.set(at, 3 * j);
      pos.set(at[0], at[1], at[2]);
      m4.compose(pos, rot, scl.setScalar(TUBE.waterR));
      waters.setMatrixAt(j, m4);
    }
    solutes.instanceMatrix.needsUpdate = true;
    waters.instanceMatrix.needsUpdate = true;
    solutes.boundingSphere = null;
    waters.boundingSphere = null;
  }

  const read = (arr: Float32Array, j: number, out: THREE.Vector3) =>
    out.set(arr[3 * j] ?? 0, arr[3 * j + 1] ?? 0, arr[3 * j + 2] ?? 0);

  function pointOf(sel: TransportSelection, out: THREE.Vector3): number | null {
    const f = frame;
    if (sel.kind === 'solute') {
      if (sel.index < 0 || sel.index >= SOLUTE_DRAWN) return null;
      read(soluteAtNow, sel.index, out);
      return TUBE.soluteR * 2.4;
    }
    if (sel.kind === 'water') {
      if (sel.index < 0 || sel.index >= WATER_DRAWN) return null;
      read(waterAtNow, sel.index, out);
      return TUBE.waterR * 2.6;
    }
    if (sel.kind === 'membrane') {
      out.set(0, -R, 0);
      return R * 1.2;
    }
    if (sel.kind === 'column' && f) {
      const isLeft = sel.side === 'solution';
      const y = levelY(m, isLeft ? f.hL : f.hR);
      out.set(isLeft ? -A : A, (y - R) / 2, 0);
      return Math.max(R, (y + R) / 2);
    }
    return null;
  }

  const haloAt = new THREE.Vector3();
  function placeSelection(): void {
    halo.visible = false;
    mark.visible = false;
    const f = frame;
    if (!selected || !f) return;
    if (selected.kind === 'solute' || selected.kind === 'water') {
      const r = pointOf(selected, haloAt);
      if (r === null) return;
      halo.position.copy(haloAt);
      halo.scale.setScalar(r);
      halo.visible = true;
    } else if (selected.kind === 'column') {
      const isLeft = selected.side === 'solution';
      mark.rotation.set(Math.PI / 2, 0, 0);
      mark.scale.setScalar(R * 1.12);
      mark.position.set(isLeft ? -A : A, levelY(m, isLeft ? f.hL : f.hR), 0);
      mark.visible = true;
    } else if (selected.kind === 'membrane') {
      mark.rotation.set(0, Math.PI / 2, 0);
      // Outside the disc's bead.
      mark.scale.setScalar(MEMBRANE_R + 0.12);
      mark.position.set(0, -R, 0);
      mark.visible = true;
    }
  }

  /**
   * One side's level y: its meniscus (lowest point at y) where the arm is straight, and the
   * clipping plane at the meniscus' rim (at y itself in a bend, where no meniscus is drawn).
   */
  function setSurface(side: Side, k: 0 | 1, x: number, y: number): void {
    // In a bend (only an arm nearly emptied) the cut is not a circle: no meniscus then.
    const straight = y >= ARM_START - 1e-9;
    surfaces[side] = y;
    cuts[side] = straight ? y + MENISCUS : y;
    surfacePlanes[side].constant = cuts[side];
    m4.compose(pos.set(x, y, 0), upright, scl.setScalar(straight ? 1 : 0));
    menisci.setMatrixAt(k, m4);
  }

  function setFrame(f: OsmosisFrame): void {
    frame = f;
    const yl = levelY(m, f.hL);
    const yr = levelY(m, f.hR);
    setSurface('solution', 0, -A, yl);
    setSurface('water', 1, A, yr);
    menisci.instanceMatrix.needsUpdate = true;
    menisci.boundingSphere = null;
    const lo = Math.min(yl, yr);
    const hi = Math.max(yl, yr);
    const bx = TUBE.bracketX;
    // Hidden (zero size) while the levels are equal.
    const k = hi - lo > 0.02 ? 1 : 0;
    box(ink, 0, bx, (lo + hi) / 2, 0.04 * k, Math.max(0.001, hi - lo) * k);
    box(ink, 1, bx, yl, 0.3 * k, 0.035 * k);
    box(ink, 2, bx, yr, 0.3 * k, 0.035 * k);
    ink.instanceMatrix.needsUpdate = true;
    // Faint guides: from each surface across to the bracket.
    const fromL = -A + R;
    const fromR = A - R;
    box(guides, 0, (bx + fromL) / 2, yl, (bx - fromL) * k, 0.015 * k);
    box(guides, 1, (bx + fromR) / 2, yr, (fromR - bx) * k, 0.015 * k);
    guides.instanceMatrix.needsUpdate = true;
    placeMolecules();
    placeSelection();
  }

  // ── Picking: molecules first, then the membrane, then a column ───────────────────────
  const columns = new Map<THREE.Object3D, Side>([
    [leftLiquid, 'solution'],
    [rightLiquid, 'water'],
  ]);
  const pickables: THREE.Object3D[] = [solutes, waters, membrane, menisci, ...columns.keys()];
  function pick(ray: THREE.Raycaster): TransportSelection | null {
    // Parts placed since the last frame are where they are now.
    scene.updateMatrixWorld();
    const hits = visibleHits(ray, pickables, 0.01);
    const mol = hits.find((h) => h.object === solutes || h.object === waters);
    if (mol) {
      const id = mol.instanceId ?? -1;
      if (mol.object === solutes)
        return id >= 0 && id < SOLUTE_DRAWN ? { kind: 'solute', index: id } : null;
      return id >= 0 && id < WATER_DRAWN ? { kind: 'water', index: id } : null;
    }
    if (hits.some((h) => h.object === membrane)) return { kind: 'membrane' };
    for (const h of hits) {
      if (h.object === menisci)
        return { kind: 'column', side: h.instanceId === 0 ? 'solution' : 'water' };
      const side = columns.get(h.object);
      if (side) return { kind: 'column', side };
    }
    return null;
  }

  function labelAnchors(): LabelAnchor[] {
    const f = frame;
    if (!f) return [];
    const yl = levelY(m, f.hL);
    const yr = levelY(m, f.hR);
    const out: LabelAnchor[] = [
      { id: 'solution', point: [-A - R, Math.max(yl * 0.75, 0), R] },
      { id: 'water', point: [A + R, Math.max(yr * 0.6, 0), R] },
      // On the disc's upper front (not its lowest point, which sits over the stand).
      { id: 'semipermeable', point: [0, -R + 0.45 * MEMBRANE_R, 0.75 * MEMBRANE_R] },
      { id: 'ruler', point: [TUBE.rulerX, plateTop, PLATE.hd] },
      { id: 'startLevel', point: [-A + R, startY, R] },
    ];
    read(soluteAtNow, 0, haloAt);
    out.push({ id: 'solute', point: [haloAt.x, haloAt.y - TUBE.soluteR, haloAt.z] });
    read(waterAtNow, Math.floor(WATER_DRAWN / 3), haloAt);
    out.push({ id: 'waterMolecule', point: [haloAt.x, haloAt.y - TUBE.waterR, haloAt.z] });
    return out;
  }

  function tags(layer: TagLayer, text: TagText): void {
    const f = frame;
    if (!f) return;
    const yl = levelY(m, f.hL);
    const yr = levelY(m, f.hR);
    if (Math.abs(yl - yr) > 0.02) {
      const words = text.dh(f.dh * 100);
      layer.add(words, TUBE.bracketX + 0.2, (yl + yr) / 2, 0, 'word', words.length);
    }
    const numbersX = TUBE.rulerX + PLATE.hw + 0.3;
    for (const cm of ticks) {
      const words = text.tick(cm);
      layer.add(words, numbersX, levelY(m, cm / 100), PLATE.hd, 'tick', words.length);
    }
  }

  return {
    mode: 'osmosis',
    kit,
    scene,
    setFrame,
    setPhase(next) {
      if (next === phase) return;
      phase = next;
      placeMolecules();
      placeSelection();
    },
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
      for (const x of [baseX0, TUBE.rulerX + PLATE.hw + 1])
        for (const y of [baseBottom, top + lipT]) for (const z of [-R, R]) pts.push([x, y, z]);
      return pts;
    },
    labelAnchors,
    tags,
    levels: () => ({ left: surfaces.solution, right: surfaces.water }),
    drawn: () => ({
      solute: solutes.visible ? solutes.count : 0,
      water: waters.visible ? waters.count : 0,
    }),
    drawStats: () => drawStats(scene),
    dispose: () => {
      kit.dispose();
    },
  };
}
