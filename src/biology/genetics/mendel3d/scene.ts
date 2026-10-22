/**
 * The three.js scene of "Di truyền Mendel" in 3D, composed as a lab bench: the two parents
 * (cells on pedestals holding one pair of homologous chromosomes per gene, an allele bead on
 * each chromosome), their gametes resting in the Punnett tray's header channels, the tray with
 * one offspring token per recessed slot, the phenotype cylinders (liquid level = exact
 * probability, engraved marks at 1/4 … 1) and a random draw's offspring field.
 *
 * Every allele, gamete, cell, genotype, class, liquid height and count is the model's
 * (`binding.ts`); shapes, sizes, places and the motion of the four steps are illustration
 * (`layout.ts`, `bench.ts`). Dominant alleles are cubes, recessive alleles spheres (palette roles
 * alleleA / allelea); each phenotype class has its own colour and shape (`look.ts`); the bench,
 * tray, pedestals and glass are muted structure colours. Text discipline: genotypes show in the
 * slots only at close zoom or on the picked cell; each header bead carries one tag. `setTime`
 * moves the steps without allocating; one SceneKit owns every geometry and material.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { roundedBox } from '@/ui/three/materials';
import { pickFirst } from '@/ui/three/pick';
import type { TagLayer, TagPlacement } from '@/ui/three/tagLayer';
import { NEUTRAL, SceneKit } from '../../view3d/kit';
import { ROLES, structureColor } from '../../view3d/palette';
import { shapeGeometry, shapeHalfHeight } from '../../view3d/primitives/classShape';
import {
  annotation,
  chromosome,
  glassware,
  meniscusGeometry,
  shellLook,
  type ShellLook,
} from '../../view3d/recipes';
import {
  MENDEL_TOTAL,
  PARENTS,
  fieldCapFor,
  fractionText,
  type Field3D,
  type MendelModel3D,
  type ParentId,
} from './binding';
import {
  cylinderGlassGeometry,
  markGeometry,
  pedestalGeometry,
  seatGeometry,
  trayGeometry,
} from './bench';
import type { MendelPart, MendelSelection } from './components';
import {
  CLASS_KEY_Z as KEY_Z,
  CLASS_TOKEN_Z as TOKEN_Z,
  KEYS_FRONT,
  LAYOUT,
  QUARTERS,
  barHeight,
  cellPoint,
  fieldCols,
  fieldRows,
  fieldSlot,
  gameteRodOffset,
  gameteSlot,
  gutterX,
  half,
  homologueOffset,
  lerp3,
  markerLift,
  motionAt,
  parentCenter,
  pedestalX,
  rodLength,
  trayEdges,
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
  /** The bench, tray and cylinders get shadow maps (High tier on a discrete GPU). */
  shadows?: boolean;
  /** Fill and rim lights, lit back faces of see-through shells (off with software WebGL). */
  accents?: boolean;
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
/** Size of a class's token in front of its cylinder. */
const TOP_SCALE = 0.24;
/** Screen pixels between the two rows of class keys (a tag is about 18 px high). */
const KEY_ROW_PX = 22;
/**
 * Room (px) kept between two neighbouring genotype tags: the slots show their genotypes once the
 * cells are at least the widest tag plus this apart on screen (rows: a tag's height apart).
 */
export const GENOTYPE_GAP_PX = 12;
/** Screen pixels between neighbouring cells from which the slots show their genotypes. */
export const genotypeSpacingPx = (model: MendelModel3D): number =>
  tagPx(model.punnett.cells.reduce((w, row) => Math.max(w, ...row.map((g) => g.length)), 1)) +
  GENOTYPE_GAP_PX;
/** Screen pixels between a draw's count tags and the field's plate. */
const COUNT_GAP_PX = 8;
/** A draw's count tags: right-aligned on the column, kept clear by every later tag. */
const COUNT_TAG: TagPlacement = { end: true, solid: true };
/** Approximate width (px) of a tag of `n` characters (the 3D tag pills, 12 px font). */
const tagPx = (n: number) => 7 * n + 14;

/** An instanced see-through set: one refracting draw, or faint back faces + a rimmed front. */
interface ShellSet {
  /** The pickable draw (refracting or front). */
  pick: THREE.InstancedMesh;
  all: THREE.InstancedMesh[];
}

/** Ease-out (cubic) on 0 … 1. */
const easeOut = (u: number) => {
  const x = Math.max(0, Math.min(1, u));
  return 1 - (1 - x) ** 3;
};

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
    // No refraction on any tier: the alleles inside the parents and the liquid levels behind the
    // glass are data and keep their exact colours.
    shadows: o.shadows ?? false,
    accents: o.accents ?? true,
  });
  const { scene } = kit;
  const h = half(dims);
  const tray = trayEdges(dims);
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
  const shellSet = (
    look: ShellLook,
    geometry: THREE.BufferGeometry,
    count: number,
    backFaces = true,
  ): ShellSet => {
    const all: THREE.InstancedMesh[] = [];
    const add = (m: THREE.Material | null, order: number) => {
      if (!m) return null;
      const mesh = kit.instanced(geometry, m, count);
      mesh.renderOrder = order;
      all.push(mesh);
      return mesh;
    };
    const refract = add(look.refract, 0);
    const back = backFaces ? add(look.back, 1) : null;
    // Faint back faces are never picked (a click goes to what is in front).
    if (back) back.raycast = () => undefined;
    const front = add(look.front, 2);
    const pick = front ?? refract ?? back;
    if (!pick) throw new Error('a see-through look has at least one material');
    return { pick, all };
  };
  const putAll = (set: ShellSet, i: number, x: number, y: number, z: number, r: number) => {
    for (const m of set.all) put(m, i, x, y, z, r);
  };
  const doneAll = (set: ShellSet) => {
    for (const m of set.all) done(m);
  };
  const showAll = (set: ShellSet, on: boolean) => {
    for (const m of set.all) m.visible = on;
  };

  // ── Materials (theme tokens; structures muted, data in its own colours) ────────────────
  const tok = (name: string) => kit.color(name);
  // The bench is flat: lit, it shades as one colour anyway, so below the shadow-map path it is
  // drawn unlit in its token (cheaper for a large surface on software and integrated GPUs).
  const benchMat = kit.shadows
    ? kit.solid(tok('--bg-sunken'), { roughness: 0.92 })
    : kit.own(new THREE.MeshBasicMaterial({ color: tok('--bg-sunken') }));
  // The tray and the pedestals stand out from the bench in both themes; slot pads are lighter.
  const trayMat = kit.solid(tok('--border-strong'), { roughness: 0.55, clearcoat: 0.25 });
  const padMat = kit.solid(tok('--bg-panel'), { roughness: 0.62, clearcoat: 0.15 });
  const membraneColor = structureColor(tok, 'membrane');
  const copyMat = kit.glass(tok('--text-muted'), {
    opacity: 0.3,
    rim: { color: tok('--text'), alpha: 0.5, strength: 0.5 },
  });
  const rodMat = chromosome(kit, tok('--text-muted'));
  const domMat = kit.solid(tok(ROLES.alleleA.token), { roughness: 0.35, clearcoat: 0.4 });
  const recMat = kit.solid(tok(ROLES.allelea.token), { roughness: 0.35, clearcoat: 0.4 });
  // The liquid columns: each class's token as albedo (per instance), glossy like a liquid.
  const liquidMat = kit.solid(NEUTRAL, { roughness: 0.18, clearcoat: 0.8 });
  const markMat = annotation(kit);
  const ringMat = kit.solid(tok('--accent'), {
    emissive: tok('--accent'),
    emissiveIntensity: 0.35,
  });
  const looks = model.classes.map((_, i) => classLook(i));
  const classMats = looks.map((l) => kit.solid(tok(l.token), { roughness: 0.38, clearcoat: 0.5 }));
  const classGeos = looks.map((l) => shapeGeometry(kit, l.shape));
  const classLift = looks.map((l) => shapeHalfHeight(l.shape));

  const rodGeo = kit.capsule(L.rodR, 1);
  const domGeo = shapeGeometry(kit, ROLES.alleleA.shape);
  const recGeo = shapeGeometry(kit, ROLES.allelea.shape);
  const isDominant = (allele: string) => allele !== '' && allele === allele.toUpperCase();
  const sides = kit.seg * 2;

  // ── Bench: one broad slab under everything (its top is y = 0) ─────────────────────────
  const benchX0 = Math.min(-h.x - L.motherGap - L.parentR, tray.x0) - 1.1;
  const benchX1 = pedestalX(dims, Math.max(0, nClasses - 1)) + L.tubeOut + 1.3;
  const benchZ0 = -h.z - L.parentGap - L.parentR - 1.0;
  const benchZ1 = h.z + L.fieldGap + fieldRows(fieldCap) * L.fieldStep + 1.0;
  const bench = kit.mesh(kit.roundedBox(10), benchMat);
  bench.scale.set((benchX1 - benchX0) / 2, 0.14, (benchZ1 - benchZ0) / 2);
  bench.position.set((benchX0 + benchX1) / 2, -0.14, (benchZ0 + benchZ1) / 2);

  // ── The Punnett tray: floor, walls with one slot per cell, two header channels ──────────
  const trayFloor = kit.mesh(kit.roundedBox(10), trayMat);
  trayFloor.scale.set((tray.x1 - tray.x0) / 2 + 0.02, L.floorY / 2, (tray.z1 - tray.z0) / 2 + 0.02);
  trayFloor.position.set((tray.x0 + tray.x1) / 2, L.floorY / 2, (tray.z0 + tray.z1) / 2);
  const trayWalls = kit.mesh(kit.geometry(trayGeometry(dims, kit.seg / 4)), trayMat);
  kit
    .shadow(0.004, (tray.x1 - tray.x0) / 2 + 0.6, (tray.z1 - tray.z0) / 2 + 0.6, 0.22)
    .position.set((tray.x0 + tray.x1) / 2, 0.004, (tray.z0 + tray.z1) / 2);
  const nCells = dims.rows * dims.cols;
  // Thin pads: a coarse superellipsoid is enough (a slot pad is a flat rounded square).
  const padGeo = kit.shared('mendel-pad', () => roundedBox(16, 6));
  const tiles = kit.instanced(padGeo, padMat, nCells);
  const padHalfY = (L.tileTop - L.floorY) / 2;
  for (let i = 0; i < dims.rows; i++)
    for (let j = 0; j < dims.cols; j++) {
      cellPoint(dims, i, j, a);
      put(
        tiles,
        i * dims.cols + j,
        a[0],
        L.floorY + padHalfY,
        a[2],
        L.tileHalf,
        padHalfY,
        L.tileHalf,
      );
    }
  done(tiles);
  // A shallow seat in the channel under each gamete.
  const seats = kit.instanced(kit.geometry(seatGeometry(kit.seg)), markMat, dims.rows + dims.cols);
  seats.raycast = () => undefined;
  for (let i = 0; i < dims.rows; i++) {
    gameteSlot(dims, 0, i, a);
    put(seats, i, a[0], 0, a[2], 1);
  }
  for (let j = 0; j < dims.cols; j++) {
    gameteSlot(dims, 1, j, a);
    put(seats, dims.rows + j, a[0], 0, a[2], 1);
  }
  done(seats);

  // Offspring tokens, one instanced set per phenotype class (its shape and colour); the set's
  // last instance stands in front of the class's cylinder once the liquid rises (`count` hides
  // it before).
  const tokens = model.classes.map((cls, i) => {
    const m = kit.instanced(
      classGeos[i] ?? kit.sphere(),
      classMats[i] ?? padMat,
      cls.cells.length + 1,
    );
    m.count = cls.cells.length;
    return m;
  });

  // Gamete copies meeting in the cells at fertilisation (two per cell; not pickable).
  const copies = kit.instanced(kit.sphere(), copyMat, 2 * nCells);
  copies.raycast = () => undefined;

  // ── Parents (cells on pedestals) and gametes (small cells resting in the channels) ──────
  const pedestals = kit.instanced(kit.geometry(pedestalGeometry(sides)), trayMat, 2);
  const parentShells = shellSet(
    shellLook(kit, membraneColor, { radius: L.parentR, outermost: true }),
    kit.sphere(1.5),
    2,
  );
  for (const p of PARENTS) {
    parentCenter(dims, p, a);
    putAll(parentShells, p, a[0], a[1], a[2], L.parentR);
    put(pedestals, p, a[0], 0, a[2], 1);
    kit.shadow(0.006, L.pedestalR * 1.35, L.pedestalR * 1.35, 0.3).position.set(a[0], 0.006, a[2]);
  }
  doneAll(parentShells);
  done(pedestals);

  /** One chromosome with its allele bead: who owns it and which allele it carries. */
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
  const gameteShells = shellSet(
    shellLook(kit, membraneColor, { radius: L.gameteR }),
    kit.sphere(),
    gameteList.length,
  );

  // ── Phenotype cylinders: glass, the liquid (= exact probability), engraved marks ────────
  // The glass wall already shows its outer and inner faces; its faint back faces (two more
  // see-through layers over tall cylinders) are drawn on High only.
  const glass = shellSet(
    glassware(kit),
    kit.geometry(cylinderGlassGeometry(sides)),
    nClasses,
    kit.tier === 'high',
  );
  const bars = kit.instanced(kit.cylinder(Math.max(12, kit.seg), true), liquidMat, nClasses);
  const menisci = kit.instanced(meniscusGeometry(kit, L.barHalf, 0.045), liquidMat, nClasses);
  const marks = kit.instanced(
    kit.geometry(markGeometry(sides)),
    markMat,
    QUARTERS.length * nClasses,
  );
  marks.raycast = () => undefined;
  for (let i = 0; i < nClasses; i++) {
    const x = pedestalX(dims, i);
    putAll(glass, i, x, 0, 0, 1);
    col.set(tok(looks[i]?.token ?? '--chart-1'));
    bars.setColorAt(i, col);
    menisci.setColorAt(i, col);
    QUARTERS.forEach((q, n) => {
      put(marks, i * QUARTERS.length + n, x, L.plinthH + barHeight(q), 0, 1);
    });
  }
  // One soft shadow under the row of cylinders.
  const rowX0 = pedestalX(dims, 0);
  const rowX1 = pedestalX(dims, Math.max(0, nClasses - 1));
  kit
    .shadow(0.006, (rowX1 - rowX0) / 2 + L.tubeOut + 0.5, L.tubeOut + 0.5, 0.3)
    .position.set((rowX0 + rowX1) / 2, 0.006, 0);
  doneAll(glass);
  done(marks);
  if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
  if (menisci.instanceColor) menisci.instanceColor.needsUpdate = true;

  // ── Offspring field (a draw) ─────────────────────────────────────────────────────────
  const fieldMeshes = model.classes.map((_, i) => {
    const m = kit.instanced(classGeos[i] ?? kit.sphere(), classMats[i] ?? padMat, fieldCap);
    m.count = 0;
    return m;
  });
  const fieldBase = kit.mesh(kit.roundedBox(8), trayMat);
  fieldBase.visible = false;
  let field: Field3D | null = null;
  /** First figure (running index) of each class in the field. */
  const fieldStart = new Array<number>(nClasses).fill(0);
  let fieldTotal = 0;
  /** A draw's count tags laid out on screen (reused): wanted and placed y, class, plate edge. */
  const countWant = new Float64Array(nClasses);
  const countY = new Float64Array(nClasses);
  const countClass = new Int16Array(nClasses);
  const sp = [0, 0];

  // ── Shadow maps (High on a discrete GPU): the bench and the tray receive ────────────────
  const shadowed = kit.groundShadows(
    [(benchX0 + benchX1) / 2, 0, (benchZ0 + benchZ1) / 2],
    Math.hypot(benchX1 - benchX0, benchZ1 - benchZ0) / 2,
  );
  if (shadowed) {
    for (const m of [bench, trayFloor, trayWalls, tiles, fieldBase]) m.receiveShadow = true;
    for (const m of [
      trayWalls,
      pedestals,
      parentRods,
      parentDom,
      parentRec,
      bars,
      ...tokens,
      ...fieldMeshes,
    ])
      m.castShadow = true;
  }

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
    showAll(gameteShells, shown);
    for (const m of [gameteRods, gameteDom, gameteRec]) m.visible = shown;
    if (!shown) return;
    gameteList.forEach((g, i) => {
      const s = gameteAt(g.parent, g.index, c);
      putAll(gameteShells, i, c[0], c[1], c[2], L.gameteR * s);
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
    doneAll(gameteShells);
    for (const m of [gameteRods, gameteDom, gameteRec]) done(m);
  }

  function placeCopies(): void {
    copies.visible = motion.travel > 0 && motion.grow < 1;
    if (!copies.visible) return;
    const s = L.copyR * (1 - motion.grow);
    for (let i = 0; i < dims.rows; i++)
      for (let j = 0; j < dims.cols; j++) {
        cellPoint(dims, i, j, c);
        c[1] += L.tokenR + L.dropH;
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

  /** The offspring appear where the copies met (above the slot) and drop in with a short ease. */
  function placeTokens(): void {
    const g = motion.grow;
    model.classes.forEach((cls, i) => {
      const mesh = tokens[i];
      if (!mesh) return;
      mesh.visible = g > 0;
      if (!mesh.visible) return;
      const s = L.tokenR * Math.min(1, g * 1.8);
      const drop = L.dropH * (1 - easeOut(g));
      cls.cells.forEach((cell, n) => {
        cellPoint(dims, cell.row, cell.col, a);
        put(mesh, n, a[0], a[1] + (classLift[i] ?? 1) * s + drop, a[2], s);
      });
      done(mesh);
    });
  }

  function placeCylinders(): void {
    const r = motion.rise;
    bars.visible = r > 0;
    menisci.visible = r > 0;
    model.classes.forEach((cls, i) => {
      const x = pedestalX(dims, i);
      const height = Math.max(1e-3, barHeight(cls.p) * r);
      put(bars, i, x, L.plinthH + height / 2, 0, L.barHalf, height, L.barHalf);
      put(menisci, i, x, L.plinthH + height, 0, 1);
      const mesh = tokens[i];
      if (!mesh) return;
      const n = cls.cells.length;
      mesh.count = r > 0 ? n + 1 : n;
      const s = TOP_SCALE * Math.min(1, r * 1.5);
      put(mesh, n, x, (classLift[i] ?? 1) * s + 0.01, TOKEN_Z, s);
      done(mesh);
    });
    done(bars);
    done(menisci);
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
        put(mesh, n, a[0], 0.06 + (classLift[i] ?? 1) * s, a[2], s);
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
        return L.tileHalf * 1.12;
      }
      case 'class': {
        const cls = model.classes[sel.index];
        if (!cls) return null;
        out[0] = pedestalX(dims, sel.index);
        out[1] = L.plinthH + Math.max(0.2, barHeight(cls.p) * motion.rise) / 2;
        out[2] = 0;
        return L.tubeOut + 0.32;
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
    const y = selected.kind === 'cell' ? L.tileTop + 0.02 : selected.kind === 'class' ? 0.03 : c[1];
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
    placeCylinders();
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
      fieldBase.scale.set((g * L.fieldStep) / 2 + 0.25, 0.03, (rows * L.fieldStep) / 2 + 0.25);
      fieldBase.position.set(0, 0.03, a[2] + ((rows - 1) * L.fieldStep) / 2);
    }
    placeField();
  }

  // ── Picking ──────────────────────────────────────────────────────────────────────────
  const pickables: THREE.Object3D[] = [
    parentShells.pick,
    pedestals,
    parentRods,
    parentDom,
    parentRec,
    gameteShells.pick,
    gameteRods,
    gameteDom,
    gameteRec,
    tiles,
    ...tokens,
    glass.pick,
    bars,
    menisci,
    ...fieldMeshes,
  ];
  const containers = new Set<THREE.Object3D>([parentShells.pick, gameteShells.pick, glass.pick]);
  const ownerSel = (owner: Owner | undefined): MendelSelection | null =>
    owner
      ? owner.kind === 'parent'
        ? { kind: 'parent', parent: owner.parent }
        : { kind: 'gamete', parent: owner.parent, index: owner.index }
      : null;
  const parentOf = (id: number): MendelSelection | null =>
    id === 0 || id === 1 ? { kind: 'parent', parent: id } : null;
  const classOf = (id: number): MendelSelection | null =>
    id >= 0 && id < nClasses ? { kind: 'class', index: id } : null;

  function pick(ray: THREE.Raycaster): MendelSelection | null {
    const hit = pickFirst(ray, pickables, { isContainer: (obj) => containers.has(obj) });
    if (!hit) return null;
    const obj = hit.object;
    const id = hit.instanceId ?? -1;
    if (obj === parentShells.pick || obj === pedestals) return parentOf(id);
    if (obj === parentRods) return ownerSel(parentRodList[id]?.owner);
    if (obj === parentDom) return ownerSel(parentBands.dom[id]?.owner);
    if (obj === parentRec) return ownerSel(parentBands.rec[id]?.owner);
    if (obj === gameteShells.pick) {
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
      // The last instance is the class's token in front of its cylinder.
      if (cls && id === cls.cells.length) return { kind: 'class', index: t };
      const cell = cls?.cells[id];
      return cell ? { kind: 'cell', row: cell.row, col: cell.col } : null;
    }
    if (obj === glass.pick || obj === bars || obj === menisci) return classOf(id);
    const f = fieldMeshes.indexOf(obj as THREE.InstancedMesh);
    if (f >= 0) return { kind: 'class', index: f };
    return null;
  }

  // ── Names and tags ───────────────────────────────────────────────────────────────────
  function labelAnchors(): MendelLabelAnchor[] {
    const out: MendelLabelAnchor[] = [];
    parentCenter(dims, 0, a);
    out.push({ id: 'mother', point: [a[0], L.pedestalH, a[2] + L.pedestalR] });
    parentCenter(dims, 1, a);
    out.push({ id: 'father', point: [a[0] - L.parentR * 0.75, a[1] - L.parentR * 0.6, a[2]] });
    // The tray's front-left corner and the cylinders' upper right: short leaders, clear of the
    // tags under the cylinders.
    out.push({ id: 'board', point: [tray.x0 + 0.5, L.floorY + L.wallH, tray.z1] });
    out.push({
      id: 'pedestals',
      point: [pedestalX(dims, nClasses - 1) + L.tubeOut, L.plinthH + L.barH * 0.8, 0],
    });
    if (motion.emerge > 0) {
      gameteSlot(dims, 0, dims.rows - 1, a);
      out.push({ id: 'femaleGametes', point: [a[0], a[1] - L.gameteR * 0.6, a[2] + L.gameteR] });
      gameteSlot(dims, 1, dims.cols - 1, a);
      out.push({ id: 'maleGametes', point: [a[0] + L.gameteR, a[1], a[2]] });
    }
    if (field && fieldTotal > 0 && motion.rise > 0) {
      fieldSlot(dims, fieldTotal, fieldTotal - 1, a);
      out.push({ id: 'field', point: [a[0], a[1], a[2]] });
    }
    return out;
  }

  /** Pixels on screen per scene unit along x around point `p` (0 when behind the camera). */
  const pxPerUnit = (layer: TagLayer, p: Vec3) => {
    c[0] = p[0] + 1;
    c[1] = p[1];
    c[2] = p[2];
    return layer.spacing(p, c);
  };

  const genotypePx = genotypeSpacingPx(model);

  /**
   * A draw's counts, first (they must never give way to another tag): a column just left of the
   * field's plate, each tag naming its class ("A_ B_ · 564") and level with that class's rows,
   * moved apart on screen only as far as needed for no two to touch.
   */
  function countTags(layer: TagLayer, fmt: (n: number) => string): void {
    if (!field || motion.rise < 0.5 || fieldTotal === 0) return;
    const edge = -((fieldCols(fieldTotal) * L.fieldStep) / 2 + 0.25);
    // The plate's left edge on screen, front and back (the front looks wider).
    let right = Infinity;
    for (let e = 0; e < 2; e++) {
      fieldSlot(dims, fieldTotal, e === 0 ? 0 : fieldTotal - 1, a);
      const z = a[2] + (e === 0 ? -1 : 1) * (L.fieldStep / 2 + 0.25);
      if (layer.toScreen(edge, 0, z, sp)) right = Math.min(right, sp[0] ?? Infinity);
    }
    if (!Number.isFinite(right)) return;
    let n = 0;
    for (let i = 0; i < nClasses; i++) {
      const shown = fieldMeshes[i]?.count ?? 0;
      if (shown === 0 || field.counts[i] === undefined) continue;
      const first = fieldStart[i] ?? 0;
      fieldSlot(dims, fieldTotal, first, a);
      fieldSlot(dims, fieldTotal, first + shown - 1, b);
      if (!layer.toScreen(edge, 0, (a[2] + b[2]) / 2, sp)) continue;
      countWant[n] = sp[1] ?? 0;
      countClass[n] = i;
      n++;
    }
    // Down the column in class order (the field fills from the back row), a tag's height apart;
    // then up by half the largest push, so the column stays centred on the rows it names.
    let push = 0;
    for (let k = 0; k < n; k++) {
      const want = countWant[k] ?? 0;
      countY[k] = k === 0 ? want : Math.max(want, (countY[k - 1] ?? 0) + KEY_ROW_PX);
      push = Math.max(push, (countY[k] ?? 0) - want);
    }
    for (let k = 0; k < n; k++) {
      const i = countClass[k] ?? 0;
      const cls = model.classes[i];
      const count = field.counts[i];
      if (!cls || count === undefined) continue;
      const text = `${cls.key} · ${fmt(count)}`;
      layer.addAt(
        text,
        right - COUNT_GAP_PX,
        (countY[k] ?? 0) - push / 2,
        'word',
        text.length,
        COUNT_TAG,
      );
    }
  }

  function tags(layer: TagLayer, fmt: (n: number) => string): void {
    countTags(layer, fmt);
    // Each gamete in its channel carries its gamete and exact probability, never two tags over
    // each other: the mother's as one tag left of her row (the gamete alone when the full tag has
    // no room); the father's as a column header: the gamete over its bead and the probability
    // over that (two narrow tags fit where one wide tag would touch its neighbour).
    if (motion.emerge >= 0.5)
      for (const g of gameteList) {
        const info = model.parents[g.parent].gametes[g.index];
        if (!info) continue;
        const s = gameteAt(g.parent, g.index, b);
        const p = fractionText(info.p, fmt);
        if (g.parent === 1) {
          const top = b[1] + L.gameteR * s;
          if (layer.add(info.gamete, b[0], top + 0.3, b[2], 'word', info.gamete.length + 1))
            layer.add(p, b[0], top + 0.82, b[2], 'tick', p.length + 1);
          continue;
        }
        const u = pxPerUnit(layer, b);
        for (const text of [`${info.gamete} · ${p}`, info.gamete]) {
          const off = u > 0 ? L.gameteR * s + (tagPx(text.length) / 2 + 4) / u : L.gameteR;
          if (layer.add(text, b[0] - off, b[1], b[2], 'word', text.length + 2)) break;
        }
      }
    layer.add('♀ \\ ♂', -h.x - L.headerGap, L.floorY + L.wallH, -h.z - L.headerGap, 'tick', 4);
    // Genotypes in the slots: when the cells are far enough apart on screen for every tag to fit
    // beside the next (as in "Bảng Punnett"), or the picked cell's.
    if (motion.grow >= 0.5) {
      cellPoint(dims, 0, 0, a);
      cellPoint(dims, 0, Math.min(1, dims.cols - 1), b);
      cellPoint(dims, Math.min(1, dims.rows - 1), 0, c);
      const close =
        dims.cols > 1 &&
        layer.spacing(a, b) >= genotypePx &&
        (dims.rows < 2 || layer.spacing(a, c) >= KEY_ROW_PX);
      for (let i = 0; i < dims.rows; i++)
        for (let j = 0; j < dims.cols; j++) {
          const here = selected?.kind === 'cell' && selected.row === i && selected.col === j;
          if (!close && !here) continue;
          const g = model.punnett.cells[i]?.[j] ?? '';
          cellPoint(dims, i, j, a);
          layer.add(g, a[0], L.tileTop, a[2] + L.slotHalf * 0.72, 'word', g.length);
        }
    }
    // Parents' genotypes.
    for (const p of PARENTS) {
      parentCenter(dims, p, a);
      const text = `${p === 0 ? '♀' : '♂'} ${model.parents[p].genotype}`;
      layer.add(text, a[0], a[1] + L.parentR + 0.3, a[2], 'word', text.length);
    }
    // Cylinders: the marks' numbers in the gutter, the exact probability over each liquid, the
    // phenotype in front (on two rows only when neighbours would touch).
    const x0 = gutterX(dims);
    for (const q of QUARTERS) {
      const text = fractionText(q, fmt);
      layer.add(text, x0, L.plinthH + barHeight(q), 0, 'tick', text.length);
    }
    a[0] = pedestalX(dims, 0);
    a[1] = 0;
    a[2] = KEY_Z;
    const step = pxPerUnit(layer, a) * L.pedestalStep;
    let widest = 0;
    for (const cls of model.classes) widest = Math.max(widest, tagPx(cls.key.length));
    const twoRows = step > 0 && step < widest + 6;
    // The second row lies far enough in front to sit a whole tag lower on screen.
    b[0] = a[0];
    b[1] = 0;
    b[2] = KEY_Z + 1;
    const pz = layer.spacing(a, b);
    const secondRow = Math.min(KEYS_FRONT, KEY_Z + Math.max(0.5, pz > 0 ? KEY_ROW_PX / pz : 0.5));
    model.classes.forEach((cls, i) => {
      const x = pedestalX(dims, i);
      if (motion.rise >= 0.5) {
        const text = fractionText(cls.p, fmt);
        layer.add(
          text,
          x,
          L.plinthH + barHeight(cls.p) * motion.rise + 0.38,
          0,
          'word',
          text.length,
        );
      }
      const z = twoRows && i % 2 === 1 ? secondRow : KEY_Z;
      layer.add(cls.key, x, 0.02, z, 'word', cls.key.length);
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
          // The liquid column is a unit-high cylinder scaled to its height.
          return { key: cls.key, p: cls.p, height: bars.visible ? s.y : 0 };
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
