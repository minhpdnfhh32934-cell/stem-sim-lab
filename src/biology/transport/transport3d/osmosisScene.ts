/**
 * The three.js scene of the osmosis half of "Khuếch tán & thẩm thấu" in 3D: a glass U-tube with
 * a semipermeable membrane in the bottom channel, the solution (left) and pure water (right)
 * columns at the model's heights on one vertical scale with a cm ruler, the Δh bracket, the
 * starting level, the solute sample (the palette's solute cube) spread over the solution column
 * and illustrative water molecules crossing the membrane (`osmosis.ts`). `setFrame`/`setPhase`
 * allocate nothing; one SceneKit owns every geometry and material.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { roundedBox } from '@/ui/three/materials';
import { visibleHits } from '@/ui/three/pick';
import type { TagLayer } from '@/ui/three/tagLayer';
import { SceneKit } from '../../view3d/kit';
import { ROLES } from '../../view3d/palette';
import type { TransportSelection } from './components';
import type { LabelAnchor, SceneOptions, TagText } from './diffusionScene';
import {
  SOLUTE_DRAWN,
  TUBE,
  WATER_DRAWN,
  levelY,
  rulerTicks,
  soluteAt,
  tubeTop,
  waterAt,
  type OsmosisFrame,
  type OsmosisModel3D,
  type Vec3,
} from './osmosis';

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
const LR = R * 0.94;

export function buildOsmosisScene(m: OsmosisModel3D, o: SceneOptions): OsmosisScene {
  const kit = new SceneKit({
    tier: o.tier,
    segments: o.segments,
    maxParticles: SOLUTE_DRAWN + WATER_DRAWN,
    token: o.token,
  });
  const { scene } = kit;
  const top = tubeTop();
  const sides = Math.max(16, kit.seg * 2);

  // ── Materials (theme tokens; the palette's roles) ────────────────────────────────────
  const muted = kit.color('--text-muted');
  const glassMat = kit.glass(muted, {
    opacity: 0.1,
    side: THREE.DoubleSide,
    rim: { color: kit.color('--text'), strength: 0.6, alpha: 0.45 },
  });
  // Liquids are tints, not roles: the solution takes the solute's hue, pure water the 2D's.
  const solutionMat = kit.glass(kit.color(ROLES.solute.token), { opacity: 0.24, roughness: 0.15 });
  const waterLiquidMat = kit.glass(kit.color('--chart-1'), { opacity: 0.22, roughness: 0.15 });
  const membraneColor = kit.color(ROLES.membrane.token);
  const membraneMat = kit.solid(membraneColor, { roughness: 0.6 });
  const soluteMat = kit.solid(kit.color(ROLES.solute.token), { roughness: 0.3, clearcoat: 0.5 });
  const waterMat = kit.solid(kit.color(ROLES.water.token), { roughness: 0.25, clearcoat: 0.6 });
  const inkMat = kit.solid(kit.color('--text'), { roughness: 0.5 });
  const faintMat = kit.solid(muted, { roughness: 0.5 });
  const accent = kit.color('--accent');
  const haloMat = kit.glass(accent, {
    opacity: 0.1,
    rim: { color: accent, alpha: 0.95, strength: 1, power: 1.6 },
  });
  const markMat = kit.solid(accent, { roughness: 0.4 });

  // ── Glass U-tube: two arms, round corners, the bottom channel (one merged mesh) ─────
  const armH = top + R;
  const parts = (r: number, closed: boolean, arms: boolean): THREE.BufferGeometry[] => {
    const out: THREE.BufferGeometry[] = [];
    for (const x of [-A, A]) {
      if (arms)
        out.push(
          new THREE.CylinderGeometry(r, r, armH, sides, 1, true).translate(x, (top - R) / 2, 0),
        );
      out.push(new THREE.SphereGeometry(r, sides, Math.round(sides * 0.75)).translate(x, -R, 0));
    }
    out.push(
      new THREE.CylinderGeometry(r, r, 2 * A, sides, 1, !closed)
        .rotateZ(Math.PI / 2)
        .translate(0, -R, 0),
    );
    return out;
  };
  const merged = (geos: THREE.BufferGeometry[]) => {
    const g = mergeGeometries(geos);
    for (const x of geos) x.dispose();
    return kit.geometry(g);
  };
  kit.mesh(merged(parts(R, false, true)), glassMat);
  kit.shadow(-2 * R - 0.2, A + R + 1, R * 2.4, 0.22);

  // ── Liquids: the columns (the model's heights) and each side's bottom (channel half and
  //    corner, merged) ──────────────────────────────────────────────────────────────────
  const cyl = kit.cylinder(sides);
  const leftCol = kit.mesh(cyl, solutionMat);
  const rightCol = kit.mesh(cyl, waterLiquidMat);
  const bottomOf = (sign: -1 | 1) => {
    const half = new THREE.CylinderGeometry(LR, LR, A, sides)
      .rotateZ(Math.PI / 2)
      .translate((sign * A) / 2, -R, 0);
    const corner = new THREE.SphereGeometry(LR, sides, Math.round(sides * 0.75)).translate(
      sign * A,
      -R,
      0,
    );
    return merged([half, corner]);
  };
  const leftLow = kit.mesh(bottomOf(-1), solutionMat);
  const rightLow = kit.mesh(bottomOf(1), waterLiquidMat);
  const setColumn = (mesh: THREE.Mesh, x: number, y: number) => {
    // From the channel's axis up to the surface (the surface never goes below the channel top).
    const h = Math.max(0.001, y + R);
    mesh.scale.set(LR, h, LR);
    mesh.position.set(x, -R + h / 2, 0);
  };

  // ── Membrane in the bottom channel ───────────────────────────────────────────────────
  const membrane = kit.mesh(cyl, membraneMat);
  membrane.rotation.z = Math.PI / 2;
  membrane.scale.set(R * 0.99, 0.1, R * 0.99);
  membrane.position.set(0, -R, 0);

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

  // ── Ink: the ruler (cm, the model's scale) and the Δh bracket; faint guides ──────────
  const ticks = rulerTicks(m);
  const rulerTop = levelY(m, m.rulerCm / 100);
  const unit = kit.geometry(new THREE.BoxGeometry(1, 1, 1));
  // Instances: 0 ruler bar, 1 bracket, 2–3 its caps, then one per tick.
  const ink = kit.instanced(unit, inkMat, 4 + ticks.length);
  const box = (
    mesh: THREE.InstancedMesh,
    k: number,
    x: number,
    y: number,
    sx: number,
    sy: number,
  ) => {
    m4.compose(pos.set(x, y, 0), upright, scl.set(sx, sy, Math.min(sx, sy, 0.05)));
    mesh.setMatrixAt(k, m4);
  };
  box(ink, 0, TUBE.rulerX, rulerTop / 2, 0.05, rulerTop);
  ticks.forEach((cm, k) => {
    box(ink, 4 + k, TUBE.rulerX - 0.12, levelY(m, cm / 100), 0.3, 0.035);
  });
  const guides = kit.instanced(unit, faintMat, 2);

  // ── Molecules ────────────────────────────────────────────────────────────────────────
  const soluteGeo = kit.geometry(
    roundedBox(Math.max(8, Math.round(kit.seg / 2)), 6).scale(0.74, 0.74, 0.74),
  );
  const solutes = kit.instanced(soluteGeo, soluteMat, SOLUTE_DRAWN);
  const waters = kit.instanced(kit.sphere(0.6), waterMat, WATER_DRAWN);
  const soluteAtNow = new Float32Array(SOLUTE_DRAWN * 3);
  const waterAtNow = new Float32Array(WATER_DRAWN * 3);

  // ── Selection: a halo (molecule) or an accent ring (column surface, membrane) ────────
  const halo = kit.mesh(kit.sphere(), haloMat);
  halo.visible = false;
  halo.renderOrder = 4;
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
      const left = sel.side === 'solution';
      const y = levelY(m, left ? f.hL : f.hR);
      out.set(left ? -A : A, (y - R) / 2, 0);
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
      const left = selected.side === 'solution';
      mark.rotation.set(Math.PI / 2, 0, 0);
      mark.scale.setScalar(R * 1.12);
      mark.position.set(left ? -A : A, levelY(m, left ? f.hL : f.hR), 0);
      mark.visible = true;
    } else if (selected.kind === 'membrane') {
      mark.rotation.set(0, Math.PI / 2, 0);
      mark.scale.setScalar(R * 1.12);
      mark.position.set(0, -R, 0);
      mark.visible = true;
    }
  }

  function setFrame(f: OsmosisFrame): void {
    frame = f;
    const yl = levelY(m, f.hL);
    const yr = levelY(m, f.hR);
    setColumn(leftCol, -A, yl);
    setColumn(rightCol, A, yr);
    const lo = Math.min(yl, yr);
    const hi = Math.max(yl, yr);
    const bx = TUBE.bracketX;
    // Hidden (zero size) while the levels are equal.
    const k = hi - lo > 0.02 ? 1 : 0;
    box(ink, 1, bx, (lo + hi) / 2, 0.04 * k, Math.max(0.001, hi - lo) * k);
    box(ink, 2, bx, yl, 0.3 * k, 0.035 * k);
    box(ink, 3, bx, yr, 0.3 * k, 0.035 * k);
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
  const columns = new Map<THREE.Object3D, 'solution' | 'water'>([
    [leftCol, 'solution'],
    [leftLow, 'solution'],
    [rightCol, 'water'],
    [rightLow, 'water'],
  ]);
  const pickables: THREE.Object3D[] = [solutes, waters, membrane, ...columns.keys()];
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
      { id: 'semipermeable', point: [0, -2 * R, R] },
      { id: 'ruler', point: [TUBE.rulerX, levelY(m, m.rulerCm / 100), 0] },
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
    for (const cm of ticks) {
      const words = text.tick(cm);
      layer.add(words, TUBE.rulerX + 0.55, levelY(m, cm / 100), 0, 'tick', words.length);
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
      for (const x of [-A - R, TUBE.rulerX + 1.1])
        for (const y of [-2 * R, top]) for (const z of [-R, R]) pts.push([x, y, z]);
      return pts;
    },
    labelAnchors,
    tags,
    levels: () => ({
      left: leftCol.position.y + leftCol.scale.y / 2,
      right: rightCol.position.y + rightCol.scale.y / 2,
    }),
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
