/**
 * The three.js scene of "Di truyền Mendel" in 3D: the two parents (glass cells holding one pair
 * of homologous chromosomes per gene, an allele band on each chromosome), their gametes, the
 * Punnett board with one offspring token per cell, the phenotype pedestals and a random draw's
 * offspring field.
 *
 * Every allele, gamete, cell, genotype, class, bar height and count is the model's
 * (`binding.ts`); shapes, sizes, places and the motion of the four steps are illustration
 * (`layout.ts`). Dominant alleles are cubes, recessive alleles spheres (palette roles alleleA /
 * allelea); each phenotype class has its own colour and shape (`look.ts`). `setTime` moves the
 * steps without allocating; one SceneKit owns every geometry and material.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { pickFirst } from '@/ui/three/pick';
import type { TagLayer } from '@/ui/three/tagLayer';
import { NEUTRAL, SceneKit } from '../../view3d/kit';
import { ROLES } from '../../view3d/palette';
import { shapeGeometry, shapeHalfHeight } from '../../view3d/primitives/classShape';
import {
  MENDEL_TOTAL,
  PARENTS,
  fieldCapFor,
  fractionText,
  type Field3D,
  type MendelModel3D,
  type ParentId,
} from './binding';
import type { MendelPart, MendelSelection } from './components';
import {
  LAYOUT,
  barHeight,
  cellPoint,
  fieldCols,
  fieldRows,
  fieldSlot,
  gameteRodOffset,
  gameteSlot,
  half,
  homologueOffset,
  lerp3,
  markerLift,
  motionAt,
  parentCenter,
  pedestalX,
  rodLength,
  type BoardDims,
  type Motion,
  type Vec3,
} from './layout';
import { classLook } from './look';

export interface MendelSceneOptions {
  tier: QualityTier;
  /** Sphere segments of the tier. */
  segments: number;
  /** The tier's instance budget (the offspring field draws at most `fieldCapFor` of it). */
  maxInstances: number;
  /** Reads a CSS colour token. */
  token: (name: string) => string;
}

export interface MendelLabelAnchor {
  id: MendelPart;
  point: Vec3;
}

export interface MendelScene {
  readonly kit: SceneKit;
  readonly scene: THREE.Scene;
  readonly dims: BoardDims;
  /** Most figures the offspring field can draw. */
  readonly fieldCap: number;
  /** Moves the four steps to time t (0 … MENDEL_TOTAL); no allocation. */
  setTime(t: number): void;
  /** Shows a draw's offspring (null: none). Its figures must fit `fieldCap`. */
  setField(field: Field3D | null): void;
  setSelection(sel: MendelSelection | null): void;
  pick(ray: THREE.Raycaster): MendelSelection | null;
  /** Where a picked thing is now (camera focus, tests), or null when it is not shown. */
  focusPoint(sel: MendelSelection): Vec3 | null;
  labelAnchors(): MendelLabelAnchor[];
  /** Genotypes, gametes, probabilities, allele letters and counts for this frame. */
  tags(layer: TagLayer, fmt: (n: number) => string): void;
  /** Figures of the offspring field drawn now (0 when hidden). */
  fieldShown(): number;
  /** What is drawn (tests). */
  drawn(): {
    gametes: { parent: ParentId; gamete: string; p: number }[];
    cells: { row: number; col: number; genotype: string; cls: number }[];
    bars: { key: string; p: number; height: number }[];
    field: number[];
    alleles: { parent: ParentId; locus: number; side: 0 | 1; allele: string }[];
  };
  drawStats(): DrawStats;
  dispose(): void;
}

type Owner =
  { kind: 'parent'; parent: ParentId } | { kind: 'gamete'; parent: ParentId; index: number };

const L = LAYOUT;
/** Size of a class's token on top of its bar. */
const TOP_SCALE = 0.24;

export function buildMendelScene(model: MendelModel3D, o: MendelSceneOptions): MendelScene {
  const dims: BoardDims = {
    rows: model.punnett.rows.length,
    cols: model.punnett.cols.length,
    loci: model.loci.length,
    classes: model.classes.length,
  };
  const fieldCap = fieldCapFor(o.maxInstances);
  const kit = new SceneKit({
    tier: o.tier,
    segments: o.segments,
    maxParticles: fieldCap,
    token: o.token,
  });
  const { scene } = kit;
  const h = half(dims);
  const k = dims.loci;
  const nClasses = dims.classes;

  // ── Scratch (no allocation in setTime) ────────────────────────────────────────────────
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const col = new THREE.Color();
  const a: Vec3 = [0, 0, 0];
  const b: Vec3 = [0, 0, 0];
  const c: Vec3 = [0, 0, 0];
  const motion: Motion = { apart: 1, emerge: 1, travel: 1, grow: 1, rise: 1 };
  const put = (
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy = sx,
    sz = sx,
  ) => {
    pos.set(x, y, z);
    scl.set(sx, sy, sz);
    m4.compose(pos, rot, scl);
    mesh.setMatrixAt(i, m4);
  };
  const done = (mesh: THREE.InstancedMesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingSphere = null;
  };

  // ── Materials (theme tokens) ─────────────────────────────────────────────────────────
  const floorMat = kit.solid(kit.color('--bg-sunken'), { roughness: 0.85 });
  // The board's frame stands out from the stage in both themes; its tiles are the panel colour.
  const boardMat = kit.solid(kit.color('--border-strong'), { roughness: 0.8 });
  const tileMat = kit.solid(kit.color('--bg-panel'), { roughness: 0.6, clearcoat: 0.2 });
  const shellMat = kit.glass(kit.color('--text-muted'), {
    opacity: 0.14,
    rim: { color: kit.color('--text'), alpha: 0.4, strength: 0.5, power: 2.2 },
  });
  const copyMat = kit.glass(kit.color('--text-muted'), {
    opacity: 0.3,
    rim: { color: kit.color('--text'), alpha: 0.5, strength: 0.5 },
  });
  const rodMat = kit.solid(kit.color('--text-muted'), { roughness: 0.5, sheen: 0.3 });
  const domMat = kit.solid(kit.color(ROLES.alleleA.token), { roughness: 0.35, clearcoat: 0.4 });
  const recMat = kit.solid(kit.color(ROLES.allelea.token), { roughness: 0.35, clearcoat: 0.4 });
  const barMat = kit.solid(NEUTRAL, { roughness: 0.4, clearcoat: 0.4 });
  const gridMat = kit.solid(kit.color('--border'), { roughness: 0.9 });
  const plateMat = kit.glass(kit.color('--bg-panel'), {
    opacity: 0.32,
    rim: { color: kit.color('--text-muted'), alpha: 0.25, strength: 0.3 },
  });
  const ringMat = kit.solid(kit.color('--accent'), {
    emissive: kit.color('--accent'),
    emissiveIntensity: 0.35,
  });
  const looks = model.classes.map((_, i) => classLook(i));
  const classMats = looks.map((l) =>
    kit.solid(kit.color(l.token), { roughness: 0.38, clearcoat: 0.5 }),
  );
  const classGeos = looks.map((l) => shapeGeometry(kit, l.shape));
  const classLift = looks.map((l) => shapeHalfHeight(l.shape));

  const rodGeo = kit.capsule(L.rodR, 1);
  const domGeo = shapeGeometry(kit, ROLES.alleleA.shape);
  const recGeo = shapeGeometry(kit, ROLES.allelea.shape);
  const isDominant = (allele: string) => allele !== '' && allele === allele.toUpperCase();

  // ── Board ─────────────────────────────────────────────────────────────────────────────
  const base = kit.mesh(kit.roundedBox(10), boardMat);
  base.scale.set(h.x + 0.35, 0.08, h.z + 0.35);
  base.position.set(0, -0.02, 0);
  kit.shadow(-0.1, h.x + 1.2, h.z + 1.2, 0.22);
  const nCells = dims.rows * dims.cols;
  const tiles = kit.instanced(kit.roundedBox(8), tileMat, nCells);
  for (let i = 0; i < dims.rows; i++)
    for (let j = 0; j < dims.cols; j++) {
      cellPoint(dims, i, j, a);
      put(tiles, i * dims.cols + j, a[0], a[1] - 0.05, a[2], L.tileHalf, 0.05, L.tileHalf);
    }
  done(tiles);

  // Offspring tokens, one instanced set per phenotype class (its shape and colour); the set's
  // last instance stands on top of the class's bar once the bars rise (`count` hides it before).
  const tokens = model.classes.map((cls, i) => {
    const m = kit.instanced(
      classGeos[i] ?? kit.sphere(),
      classMats[i] ?? floorMat,
      cls.cells.length + 1,
    );
    m.count = cls.cells.length;
    return m;
  });

  // Gamete copies meeting in the cells at fertilisation (two per cell; not pickable).
  const copies = kit.instanced(kit.sphere(), copyMat, 2 * nCells);

  // ── Parents and gametes ──────────────────────────────────────────────────────────────
  const parentShells = kit.instanced(kit.sphere(), shellMat, 2);
  for (const p of PARENTS) {
    parentCenter(dims, p, a);
    put(parentShells, p, a[0], a[1], a[2], L.parentR);
    kit.shadow(0.01, L.parentR * 0.95, L.parentR * 0.95, 0.24).position.set(a[0], 0.01, a[2]);
  }
  done(parentShells);

  /** One chromosome with its allele band: who owns it and which allele it carries. */
  interface Rod {
    owner: Owner;
    locus: number;
    side: 0 | 1;
    allele: string;
  }
  const parentRodList: Rod[] = [];
  for (const p of PARENTS)
    for (let locus = 0; locus < k; locus++)
      for (const side of [0, 1] as const)
        parentRodList.push({
          owner: { kind: 'parent', parent: p },
          locus,
          side,
          allele: model.parents[p].pairs[locus]?.[side] ?? '',
        });
  const gameteList: { parent: ParentId; index: number }[] = [];
  const gameteRodList: Rod[] = [];
  for (const p of PARENTS)
    model.parents[p].gametes.forEach((g, index) => {
      gameteList.push({ parent: p, index });
      for (let locus = 0; locus < k; locus++)
        gameteRodList.push({
          owner: { kind: 'gamete', parent: p, index },
          locus,
          side: 0,
          allele: g.gamete[locus] ?? '',
        });
    });

  const parentRods = kit.instanced(rodGeo, rodMat, parentRodList.length);
  const gameteRods = kit.instanced(rodGeo, rodMat, gameteRodList.length);
  const split = (list: Rod[]) => ({
    dom: list.filter((r) => isDominant(r.allele)),
    rec: list.filter((r) => !isDominant(r.allele)),
  });
  const parentBands = split(parentRodList);
  const gameteBands = split(gameteRodList);
  const parentDom = kit.instanced(domGeo, domMat, parentBands.dom.length);
  const parentRec = kit.instanced(recGeo, recMat, parentBands.rec.length);
  const gameteDom = kit.instanced(domGeo, domMat, gameteBands.dom.length);
  const gameteRec = kit.instanced(recGeo, recMat, gameteBands.rec.length);
  const gameteShells = kit.instanced(kit.sphere(), shellMat, gameteList.length);

  // ── Pedestals ─────────────────────────────────────────────────────────────────────────
  const plinths = kit.instanced(kit.roundedBox(8), floorMat, nClasses);
  const bars = kit.instanced(kit.roundedBox(8), barMat, nClasses);
  for (let i = 0; i < nClasses; i++) {
    put(plinths, i, pedestalX(dims, i), L.plinthH / 2, 0, L.barHalf + 0.22, L.plinthH / 2, 0.55);
    col.set(kit.color(looks[i]?.token ?? '--chart-1'));
    bars.setColorAt(i, col);
  }
  done(plinths);
  if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
  // A see-through back plate with lines at 1/4, 1/2, 3/4 and 1 of the probability scale.
  const plateX0 = pedestalX(dims, 0) - L.barHalf - 0.45;
  const plateX1 = pedestalX(dims, Math.max(0, nClasses - 1)) + L.barHalf + 0.45;
  const plate = kit.mesh(kit.roundedBox(8), plateMat);
  plate.scale.set((plateX1 - plateX0) / 2, (L.barH + 0.2) / 2, 0.025);
  plate.position.set((plateX0 + plateX1) / 2, L.plinthH + (L.barH + 0.2) / 2, -0.62);
  const QUARTERS = [0.25, 0.5, 0.75, 1];
  const grid = kit.instanced(kit.roundedBox(6), gridMat, QUARTERS.length);
  QUARTERS.forEach((q, i) => {
    put(
      grid,
      i,
      (plateX0 + plateX1) / 2,
      L.plinthH + barHeight(q),
      -0.58,
      (plateX1 - plateX0) / 2,
      0.012,
      0.012,
    );
  });
  done(grid);
  kit.shadow(0.005, (plateX1 - plateX0) / 2 + 0.4, 0.9, 0.18).position.x = (plateX0 + plateX1) / 2;

  // ── Offspring field (a draw) ─────────────────────────────────────────────────────────
  const fieldMeshes = model.classes.map((_, i) => {
    const m = kit.instanced(classGeos[i] ?? kit.sphere(), classMats[i] ?? floorMat, fieldCap);
    m.count = 0;
    return m;
  });
  const fieldBase = kit.mesh(kit.roundedBox(8), floorMat);
  fieldBase.visible = false;
  let field: Field3D | null = null;
  /** First figure (running index) of each class in the field. */
  const fieldStart = new Array<number>(nClasses).fill(0);
  let fieldTotal = 0;

  // ── Selection ring ───────────────────────────────────────────────────────────────────
  const ring = kit.mesh(kit.geometry(new THREE.TorusGeometry(1, 0.045, 8, 56)), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  let selected: MendelSelection | null = null;
  let time = MENDEL_TOTAL;

  // ── Placing things at time t ─────────────────────────────────────────────────────────
  function placeParents(): void {
    let d = 0;
    let r = 0;
    parentRodList.forEach((rod, i) => {
      const p = rod.owner.parent;
      parentCenter(dims, p, a);
      homologueOffset(dims, rod.locus, rod.side, motion.apart, b);
      const len = rodLength(rod.locus);
      const x = a[0] + b[0];
      const y = a[1] + b[1];
      const z = a[2] + b[2];
      put(parentRods, i, x, y, z, 1, len, 1);
      const band = isDominant(rod.allele) ? parentDom : parentRec;
      const j = isDominant(rod.allele) ? d++ : r++;
      put(band, j, x, y + markerLift(rod.locus), z, L.markerR);
    });
    done(parentRods);
    done(parentDom);
    done(parentRec);
  }

  /** Where gamete `index` of parent `p` is now, and its size factor. */
  function gameteAt(p: ParentId, index: number, out: Vec3): number {
    parentCenter(dims, p, a);
    gameteSlot(dims, p, index, b);
    lerp3(a, b, motion.emerge, out);
    return 0.35 + 0.65 * motion.emerge;
  }

  function placeGametes(): void {
    const shown = motion.emerge > 0;
    for (const m of [gameteShells, gameteRods, gameteDom, gameteRec]) m.visible = shown;
    if (!shown) return;
    gameteList.forEach((g, i) => {
      const s = gameteAt(g.parent, g.index, c);
      put(gameteShells, i, c[0], c[1], c[2], L.gameteR * s);
    });
    let d = 0;
    let r = 0;
    gameteRodList.forEach((rod, i) => {
      if (rod.owner.kind !== 'gamete') return;
      const f = gameteAt(rod.owner.parent, rod.owner.index, c);
      const s = f * L.gameteScale;
      gameteRodOffset(dims, rod.locus, b);
      const x = c[0] + b[0] * f;
      const len = rodLength(rod.locus);
      put(gameteRods, i, x, c[1], c[2], s, len * s, s);
      const band = isDominant(rod.allele) ? gameteDom : gameteRec;
      const j = isDominant(rod.allele) ? d++ : r++;
      put(band, j, x, c[1] + markerLift(rod.locus) * s, c[2], L.markerR * s * 1.3);
    });
    for (const m of [gameteShells, gameteRods, gameteDom, gameteRec]) done(m);
  }

  function placeCopies(): void {
    copies.visible = motion.travel > 0 && motion.grow < 1;
    if (!copies.visible) return;
    const s = L.copyR * (1 - motion.grow);
    for (let i = 0; i < dims.rows; i++)
      for (let j = 0; j < dims.cols; j++) {
        cellPoint(dims, i, j, c);
        c[1] += L.tokenR;
        const n = 2 * (i * dims.cols + j);
        gameteSlot(dims, 0, i, a);
        lerp3(a, c, motion.travel, b);
        put(copies, n, b[0], b[1], b[2], s);
        gameteSlot(dims, 1, j, a);
        lerp3(a, c, motion.travel, b);
        put(copies, n + 1, b[0], b[1], b[2], s);
      }
    done(copies);
  }

  function placeTokens(): void {
    const g = motion.grow;
    model.classes.forEach((cls, i) => {
      const mesh = tokens[i];
      if (!mesh) return;
      mesh.visible = g > 0;
      if (!mesh.visible) return;
      const s = L.tokenR * g;
      cls.cells.forEach((cell, n) => {
        cellPoint(dims, cell.row, cell.col, a);
        put(mesh, n, a[0], a[1] + (classLift[i] ?? 1) * s, a[2], s);
      });
      done(mesh);
    });
  }

  function placePedestals(): void {
    const r = motion.rise;
    bars.visible = r > 0;
    model.classes.forEach((cls, i) => {
      const x = pedestalX(dims, i);
      const height = Math.max(1e-3, barHeight(cls.p) * r);
      put(bars, i, x, L.plinthH + height / 2, 0, L.barHalf, height / 2, L.barHalf);
      const mesh = tokens[i];
      if (!mesh) return;
      const n = cls.cells.length;
      mesh.count = r > 0 ? n + 1 : n;
      const lift = L.plinthH + height + (classLift[i] ?? 1) * TOP_SCALE + 0.04;
      put(mesh, n, x, lift, 0, TOP_SCALE);
      done(mesh);
    });
    done(bars);
  }

  function placeField(): void {
    const shown = !!field && motion.rise > 0;
    fieldBase.visible = shown;
    fieldMeshes.forEach((m) => {
      m.visible = shown;
    });
    if (!shown || !field) return;
    const s = L.fieldR * motion.rise;
    fieldMeshes.forEach((mesh, i) => {
      const count = mesh.count;
      for (let n = 0; n < count; n++) {
        fieldSlot(dims, fieldTotal, (fieldStart[i] ?? 0) + n, a);
        put(mesh, n, a[0], (classLift[i] ?? 1) * s, a[2], s);
      }
      done(mesh);
    });
  }

  // ── Selection ────────────────────────────────────────────────────────────────────────
  /** Centre of a picked thing now and the ring's radius, or null when it is not shown. */
  function pointOf(sel: MendelSelection, out: Vec3): number | null {
    switch (sel.kind) {
      case 'parent':
        parentCenter(dims, sel.parent, out);
        return L.parentR + 0.12;
      case 'gamete': {
        if (!model.parents[sel.parent].gametes[sel.index] || motion.emerge <= 0) return null;
        const s = gameteAt(sel.parent, sel.index, out);
        return L.gameteR * s + 0.1;
      }
      case 'cell': {
        if (model.punnett.cells[sel.row]?.[sel.col] === undefined) return null;
        cellPoint(dims, sel.row, sel.col, out);
        const cls = model.cellClass[sel.row]?.[sel.col] ?? 0;
        out[1] += (classLift[cls] ?? 1) * L.tokenR * Math.max(0, motion.grow);
        return L.tileHalf * 1.15;
      }
      case 'class': {
        const cls = model.classes[sel.index];
        if (!cls) return null;
        out[0] = pedestalX(dims, sel.index);
        out[1] = L.plinthH + (barHeight(cls.p) * motion.rise) / 2;
        out[2] = 0;
        return L.barHalf + 0.35;
      }
    }
  }

  function placeRing(): void {
    if (!selected) {
      ring.visible = false;
      return;
    }
    const r = pointOf(selected, c);
    ring.visible = r !== null;
    if (r === null) return;
    // Flat around the part: at its equator (parent, gamete), on the floor otherwise.
    const y =
      selected.kind === 'cell'
        ? L.tileTop + 0.02
        : selected.kind === 'class'
          ? L.plinthH + 0.02
          : c[1];
    ring.position.set(c[0], y, c[2]);
    ring.scale.setScalar(r);
  }

  function setTime(t: number): void {
    time = Math.max(0, Math.min(MENDEL_TOTAL, t));
    motionAt(time, motion);
    placeParents();
    placeGametes();
    placeCopies();
    placeTokens();
    placePedestals();
    placeField();
    placeRing();
  }

  function setField(next: Field3D | null): void {
    field = next;
    fieldTotal = 0;
    model.classes.forEach((_, i) => {
      fieldStart[i] = fieldTotal;
      const want = Math.max(0, Math.floor(next?.figures[i] ?? 0));
      const n = Math.min(want, fieldCap - fieldTotal);
      const mesh = fieldMeshes[i];
      if (mesh) mesh.count = n;
      fieldTotal += n;
    });
    if (next && fieldTotal > 0) {
      const g = fieldCols(fieldTotal);
      const rows = fieldRows(fieldTotal);
      fieldSlot(dims, fieldTotal, 0, a);
      fieldBase.scale.set((g * L.fieldStep) / 2 + 0.25, 0.04, (rows * L.fieldStep) / 2 + 0.25);
      fieldBase.position.set(0, -0.04, a[2] + ((rows - 1) * L.fieldStep) / 2);
    }
    placeField();
  }

  // ── Picking ──────────────────────────────────────────────────────────────────────────
  const pickables: THREE.Object3D[] = [
    parentShells,
    parentRods,
    parentDom,
    parentRec,
    gameteShells,
    gameteRods,
    gameteDom,
    gameteRec,
    tiles,
    ...tokens,
    bars,
    ...fieldMeshes,
  ];
  const ownerSel = (owner: Owner | undefined): MendelSelection | null =>
    owner
      ? owner.kind === 'parent'
        ? { kind: 'parent', parent: owner.parent }
        : { kind: 'gamete', parent: owner.parent, index: owner.index }
      : null;

  function pick(ray: THREE.Raycaster): MendelSelection | null {
    const hit = pickFirst(ray, pickables, {
      isContainer: (obj) => obj === parentShells || obj === gameteShells,
    });
    if (!hit) return null;
    const obj = hit.object;
    const id = hit.instanceId ?? -1;
    if (obj === parentShells) return id === 0 || id === 1 ? { kind: 'parent', parent: id } : null;
    if (obj === parentRods) return ownerSel(parentRodList[id]?.owner);
    if (obj === parentDom) return ownerSel(parentBands.dom[id]?.owner);
    if (obj === parentRec) return ownerSel(parentBands.rec[id]?.owner);
    if (obj === gameteShells) {
      const g = gameteList[id];
      return g ? { kind: 'gamete', parent: g.parent, index: g.index } : null;
    }
    if (obj === gameteRods) return ownerSel(gameteRodList[id]?.owner);
    if (obj === gameteDom) return ownerSel(gameteBands.dom[id]?.owner);
    if (obj === gameteRec) return ownerSel(gameteBands.rec[id]?.owner);
    if (obj === tiles) {
      if (id < 0 || id >= nCells) return null;
      return { kind: 'cell', row: Math.floor(id / dims.cols), col: id % dims.cols };
    }
    const t = tokens.indexOf(obj as THREE.InstancedMesh);
    if (t >= 0) {
      const cls = model.classes[t];
      // The last instance is the class's token on top of its bar.
      if (cls && id === cls.cells.length) return { kind: 'class', index: t };
      const cell = cls?.cells[id];
      return cell ? { kind: 'cell', row: cell.row, col: cell.col } : null;
    }
    if (obj === bars) return id >= 0 && id < nClasses ? { kind: 'class', index: id } : null;
    const f = fieldMeshes.indexOf(obj as THREE.InstancedMesh);
    if (f >= 0) return { kind: 'class', index: f };
    return null;
  }

  // ── Names and tags ───────────────────────────────────────────────────────────────────
  function labelAnchors(): MendelLabelAnchor[] {
    const out: MendelLabelAnchor[] = [];
    parentCenter(dims, 0, a);
    out.push({ id: 'mother', point: [a[0], a[1] - L.parentR * 0.7, a[2] + L.parentR * 0.7] });
    parentCenter(dims, 1, a);
    out.push({ id: 'father', point: [a[0] - L.parentR * 0.7, a[1] - L.parentR * 0.7, a[2]] });
    out.push({ id: 'board', point: [h.x, L.tileTop, h.z] });
    out.push({ id: 'pedestals', point: [pedestalX(dims, nClasses - 1), L.plinthH, 0.5] });
    if (motion.emerge > 0) {
      gameteSlot(dims, 0, dims.rows - 1, a);
      out.push({ id: 'femaleGametes', point: [a[0], a[1] - L.gameteR, a[2]] });
      gameteSlot(dims, 1, dims.cols - 1, a);
      out.push({ id: 'maleGametes', point: [a[0] + L.gameteR, a[1], a[2]] });
    }
    if (field && fieldTotal > 0 && motion.rise > 0) {
      fieldSlot(dims, fieldTotal, fieldTotal - 1, a);
      out.push({ id: 'field', point: [a[0], a[1], a[2]] });
    }
    return out;
  }

  function tags(layer: TagLayer, fmt: (n: number) => string): void {
    // Genotypes on the board first: the board is the lesson's table.
    if (motion.grow >= 0.5)
      for (let i = 0; i < dims.rows; i++)
        for (let j = 0; j < dims.cols; j++) {
          const g = model.punnett.cells[i]?.[j] ?? '';
          const cls = model.cellClass[i]?.[j] ?? 0;
          cellPoint(dims, i, j, a);
          layer.add(
            g,
            a[0],
            a[1] + 2 * (classLift[cls] ?? 1) * L.tokenR + 0.2,
            a[2],
            'word',
            g.length,
          );
        }
    // Parents' genotypes.
    for (const p of PARENTS) {
      parentCenter(dims, p, a);
      const text = `${p === 0 ? '♀' : '♂'} ${model.parents[p].genotype}`;
      layer.add(text, a[0], a[1] + L.parentR + 0.3, a[2], 'word', text.length);
    }
    // Gametes with their exact probabilities.
    if (motion.emerge >= 0.5)
      for (const g of gameteList) {
        const info = model.parents[g.parent].gametes[g.index];
        if (!info) continue;
        const s = gameteAt(g.parent, g.index, a);
        const text = `${info.gamete} · ${fractionText(info.p, fmt)}`;
        layer.add(text, a[0], a[1] + L.gameteR * s + 0.28, a[2], 'word', text.length);
      }
    // Pedestals: the exact probability over each bar, the phenotype under it.
    model.classes.forEach((cls, i) => {
      const x = pedestalX(dims, i);
      if (motion.rise >= 0.5) {
        const text = fractionText(cls.p, fmt);
        layer.add(
          text,
          x,
          L.plinthH + barHeight(cls.p) * motion.rise + 0.75,
          0,
          'word',
          text.length,
        );
      }
      // Keys of neighbouring pedestals on two rows, so long keys never hide each other.
      layer.add(cls.key, x, 0.02, i % 2 === 0 ? 0.7 : 1.3, 'word', cls.key.length);
    });
    // Allele letters on the parents' chromosomes.
    for (const rod of parentRodList) {
      parentCenter(dims, rod.owner.parent, a);
      homologueOffset(dims, rod.locus, rod.side, motion.apart, b);
      layer.add(
        rod.allele,
        a[0] + b[0] + L.markerR + 0.12,
        a[1] + b[1] + markerLift(rod.locus),
        a[2] + b[2],
        'letter',
      );
    }
    // A draw's counts, over each class's first figure.
    if (field && motion.rise >= 0.5)
      fieldMeshes.forEach((mesh, i) => {
        const count = field?.counts[i];
        if (mesh.count === 0 || count === undefined) return;
        fieldSlot(dims, fieldTotal, fieldStart[i] ?? 0, a);
        const text = fmt(count);
        layer.add(text, a[0], a[1] + 0.35, a[2], 'word', text.length + 1);
      });
    // The probability scale of the pedestals.
    QUARTERS.forEach((q) => {
      const text = fractionText(q, fmt);
      layer.add(text, plateX0 - 0.15, L.plinthH + barHeight(q), -0.6, 'tick', text.length);
    });
    layer.add('♀ \\ ♂', -h.x - L.headerGap, L.tileTop, -h.z - L.headerGap, 'tick', 4);
  }

  setTime(time);

  return {
    kit,
    scene,
    dims,
    fieldCap,
    setTime,
    setField,
    setSelection(sel) {
      selected = sel;
      placeRing();
    },
    pick,
    focusPoint(sel) {
      const out: Vec3 = [0, 0, 0];
      return pointOf(sel, out) === null ? null : out;
    },
    labelAnchors,
    tags,
    fieldShown: () => (field && motion.rise > 0 ? fieldTotal : 0),
    drawn() {
      const v = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const mat = new THREE.Matrix4();
      return {
        gametes: gameteList.map((g) => {
          const info = model.parents[g.parent].gametes[g.index];
          return { parent: g.parent, gamete: info?.gamete ?? '', p: info?.p ?? 0 };
        }),
        cells: model.classes.flatMap((cls, i) =>
          cls.cells.map((cell) => ({
            row: cell.row,
            col: cell.col,
            genotype: model.punnett.cells[cell.row]?.[cell.col] ?? '',
            cls: i,
          })),
        ),
        bars: model.classes.map((cls, i) => {
          bars.getMatrixAt(i, mat);
          mat.decompose(v, q, s);
          return { key: cls.key, p: cls.p, height: bars.visible ? s.y * 2 : 0 };
        }),
        field: fieldMeshes.map((m) => (m.visible ? m.count : 0)),
        alleles: parentRodList.map((r) => ({
          parent: r.owner.parent,
          locus: r.locus,
          side: r.side,
          allele: r.allele,
        })),
      };
    },
    drawStats: () => drawStats(scene),
    dispose: () => {
      kit.dispose();
    },
  };
}
