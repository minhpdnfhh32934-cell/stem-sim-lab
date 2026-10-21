/**
 * The three.js scene of "ADN → mARN → Protein" in 3D: the learner's own DNA as a B-DNA double
 * helix (the helix recipe of `helix.ts`, shared with "Đột biến điểm": continuous backbone tubes,
 * base pairs as two rounded halves split at the midline, coloured and shaped by base: purines are
 * slabs, pyrimidines bars), the RNA polymerase — a see-through protein cut open towards the
 * viewer — opening a bubble and building the mRNA on the template strand while the next
 * nucleotides the template asks for come in, then the mRNA (U for T) running through the cleft
 * of a two-subunit ribosome while L-shaped tRNAs bring the amino acids and the polypeptide grows
 * as a chain of beads; the DNA then steps back as context above.
 *
 * Every base, codon, anticodon and amino acid is the model's (`binding.ts`); shapes, sizes and
 * motion are illustration (`layout.ts`, `machines.ts`). Long sequences draw a window of at most
 * `maxBasePairs` base pairs around the active position (absolute indices kept). One SceneKit
 * owns every geometry and material; `update` writes in place only what moves (the backbones of
 * the two still stretches of the helix are drawn once and turned), and nothing is allocated per
 * frame.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { mixLinear, muted } from '@/ui/three/color';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { LAYER } from '@/ui/three/layers';
import { pickFirst } from '@/ui/three/pick';
import type { LabelObstacles } from '@/ui/three/labelLayer';
import type { TagLayer } from '@/ui/three/tagLayer';
import { NEUTRAL, SceneKit } from '../../view3d/kit';
import { setRimAlpha } from '../../view3d/materials';
import { highlightIntensity, proteinShell } from '../../view3d/recipes';
import { B_DNA, RISE, TWIST } from './bdna';
import {
  activeIndex,
  anticodonOf,
  aminoAcidOf,
  chainNewest,
  windowFor,
  type DogmaModel3D,
  type DogmaMoment,
} from './binding';
import type { DogmaPart, DogmaSelection } from './components';
import {
  BAR,
  BEAD_R,
  PURINE,
  SLAB,
  THICK,
  Writer,
  baseWidth,
  helixShapes,
  helixSolid,
  pairPixels,
  readDogmaPalette,
  rungOpacity,
  rungMaterial,
  rungs,
  setFade,
  strandMesh,
  strandTwin,
  type StrandMesh,
} from './helix';
import {
  LAYOUT,
  beadPose,
  bubbleSpan,
  codonX,
  dnaPlace,
  dnaPose,
  helixAngle,
  mrnaPose,
  nucleotidePose,
  placeDna,
  ribosomePose,
  rigidSpan,
  strandPose,
  trnaPoses,
  xOf,
  type DnaPlace,
  type RibosomePose,
  type RigidSpan,
  type TrnaPose,
  type Vec3,
} from './layout';
import {
  BLOB_SEED,
  CUT_Z,
  RIBOSOME,
  codonFrameGeometry,
  cutPlane,
  trnaBodyGeometry,
} from './machines';

export interface DogmaSceneOptions {
  tier: QualityTier;
  /** Sphere segments of the tier. */
  segments: number;
  /** Most base pairs drawn at once (the tier's instance budget). */
  maxBasePairs: number;
  /** Reads a CSS colour token. */
  token: (name: string) => string;
  /** Highlights glow in HDR and bloom (High tier with post-processing). */
  hdr?: boolean;
}

export interface DogmaLabelAnchor {
  id: DogmaPart;
  point: Vec3;
}

/** Fewest beads drawn, whatever the window. */
const MIN_BEADS = 12;
/** Free nucleotides drawn on their way in (the next ones the template asks for). */
const INCOMING = 3;

interface TrnaSlot {
  group: THREE.Group;
  /** Codon it reads now (−1: hidden). */
  codon: number;
  anti: THREE.Mesh[];
  antiMats: THREE.MeshStandardMaterial[];
  body: THREE.MeshStandardMaterial;
  beadMesh: THREE.Mesh;
  bead: THREE.MeshStandardMaterial;
  meshes: THREE.Mesh[];
}

/** One DNA strand's backbone: the still stretches left and right of the bubble, and the bubble. */
interface DnaStrand {
  /** Resting helix tube; its mesh draws the stretch left of the bubble. */
  rest: StrandMesh;
  /** The same tube's stretch right of the bubble (its own turn). */
  right: THREE.Mesh;
  /** The bubble and its edges, rebuilt as they move. */
  open: StrandMesh;
}

export interface DogmaScene {
  readonly kit: SceneKit;
  readonly scene: THREE.Scene;
  /** Base pairs drawn now: [from, to) (absolute indices). */
  window(): { from: number; to: number };
  update(mo: DogmaMoment): void;
  setSelection(sel: DogmaSelection | null): void;
  pick(ray: THREE.Raycaster): DogmaSelection | null;
  /** Where the picked thing is (camera focus), or null. */
  focusPoint(sel: DogmaSelection): Vec3 | null;
  labelAnchors(): DogmaLabelAnchor[];
  /**
   * What the name labels never cover (world hulls, a few base pairs each): both DNA strands, the
   * mRNA, the tRNAs and the polypeptide.
   */
  labelObstacles(): LabelObstacles;
  /** Letters, amino acid names and position numbers for this frame (`fmt`: whole numbers). */
  tags(
    layer: TagLayer,
    eye: THREE.Vector3,
    target: THREE.Vector3,
    width: number,
    fmt: (n: number) => string,
  ): void;
  /**
   * World point of a base now (on its half rung, two thirds of the way from the backbone to the
   * tip: clear of the backbone), or null when it is not drawn.
   */
  basePoint(strand: 'coding' | 'template' | 'mrna', i: number): Vec3 | null;
  /** Whether a part can be seen at this moment. */
  partVisible(part: DogmaPart): boolean;
  drawStats(): DrawStats;
  dispose(): void;
}

export function buildDogmaScene(m: DogmaModel3D, o: DogmaSceneOptions): DogmaScene {
  const kit = new SceneKit({
    tier: o.tier,
    segments: o.segments,
    maxParticles: o.maxBasePairs,
    token: o.token,
    hdr: o.hdr ?? false,
  });
  const pal = readDogmaPalette(o.token);
  const n = m.coding.length;
  const W = Math.max(1, Math.min(n, Math.floor(o.maxBasePairs)));
  const beadCap = Math.max(MIN_BEADS, Math.ceil(W / 3));
  const w = new Writer();
  const baseColor = new Map<string, THREE.Color>(
    Object.entries(pal.bases).map(([b, c]) => [b, new THREE.Color(c)]),
  );
  const grey = new THREE.Color(pal.coding);
  const baseHex = (b: string | undefined): string =>
    (pal.bases as Record<string, string | undefined>)[b ?? ''] ?? pal.trna;
  const scene = kit.scene;

  // ── Shared shapes (the helix recipe, `helix.ts`) ─────────────────────────────────────────
  const shapes = helixShapes(kit, o.tier);
  const halfGeo = shapes.half;
  const rodGeo = shapes.rod;
  const beadGeo = shapes.bead;
  const own = <M extends THREE.Material>(mat: M) => kit.own(mat);
  const solidOwn = (color: string, extra: Parameters<typeof helixSolid>[3] = {}) =>
    helixSolid(kit, color, o.tier, extra);
  /** A part that fades in and out (blended: smooth, unlike a dithered alpha hash). */
  const fading = <M extends THREE.Material>(mat: M): M => {
    mat.transparent = true;
    return mat;
  };

  // ── DNA (under one parent: it steps back as context while the ribosome works) ───────────
  const dnaRoot = new THREE.Object3D();
  dnaRoot.name = 'dna';
  scene.add(dnaRoot);
  const place: DnaPlace = { k: 1, x0: 0, dy: 0, dz: 0 };
  const dnaHalves = rungs(kit, shapes, 2 * W, dnaRoot);
  const AXIS = { y: 0, z: 0 };
  /** Most nucleotides in the moving stretch (bubble, its edges and the joints). */
  const openCap = Math.min(
    W + 2,
    Math.ceil(LAYOUT.hybrid + LAYOUT.behind + LAYOUT.ahead + 2 * LAYOUT.edge) + 8,
  );
  const dnaStrand = (role: 'coding' | 'template'): DnaStrand => {
    const rest = strandMesh(kit, role, W, AXIS, dnaRoot);
    return {
      rest,
      right: strandTwin(kit, rest, dnaRoot),
      open: strandMesh(kit, role, openCap, AXIS, dnaRoot),
    };
  };
  const coding = dnaStrand('coding');
  const template = dnaStrand('template');

  // ── mRNA ───────────────────────────────────────────────────────────────────────────────
  // The mRNA's bases have their own material (never faded with the DNA's rungs).
  const mrnaHalves = rungs(kit, shapes, W, scene, 'mrna');
  const mrna = strandMesh(kit, 'mrna', W, null);
  const rungMat = rungMaterial(kit, 'dna');

  // ── RNA polymerase and ribosome (see-through protein blobs, illustrative shapes) ────────
  const polymerase = proteinShell(kit, {
    seed: BLOB_SEED.polymerase,
    color: muted(pal.polymerase, o.token('--bg-stage'), 0.15, 0.8),
    cut: cutPlane(CUT_Z.polymerase),
  });
  const polyMat = polymerase.material as THREE.MeshStandardMaterial;
  const small = proteinShell(kit, { seed: BLOB_SEED.small, color: pal.ribosome });
  const large = proteinShell(kit, {
    seed: BLOB_SEED.large,
    color: mixLinear(pal.ribosome, o.token('--text'), 0.2),
    cut: cutPlane(CUT_Z.large),
  });
  const smallMat = small.material as THREE.MeshStandardMaterial;
  const largeMat = large.material as THREE.MeshStandardMaterial;
  const SHELL_OPACITY = 0.55;

  // ── Free nucleotides coming in (bases from the sequence; the path is illustration) ─────
  const incoming = kit.instanced(
    halfGeo,
    solidOwn(NEUTRAL, { roughness: 0.4, clearcoat: 0.3 }),
    INCOMING,
  );
  incoming.visible = false;

  // ── The codon being read: a thin glowing frame (HDR, blooming on High) ──────────────────
  const glowMat = own(new THREE.MeshBasicMaterial({ color: pal.highlight }));
  glowMat.color.multiplyScalar(highlightIntensity(kit));
  glowMat.userData.bloom = kit.hdr;
  const codonFrame = kit.mesh(codonFrameGeometry(kit, RISE), glowMat);
  codonFrame.visible = false;

  // ── tRNA slots (at most two at once): an L-shaped body, its amino acid, the anticodon ───
  const trnaBody = trnaBodyGeometry(kit);
  const makeSlot = (): TrnaSlot => {
    const group = new THREE.Group();
    scene.add(group);
    const body = fading(solidOwn(pal.trna, { roughness: 0.48, sheen: 0.4, clearcoat: 0.25 }));
    const bead = fading(solidOwn(pal.peptide, { roughness: 0.35, clearcoat: 0.6 }));
    const shape = kit.mesh(trnaBody, body, group);
    const beadMesh = kit.mesh(beadGeo, bead, group);
    beadMesh.scale.setScalar(BEAD_R + 0.02);
    beadMesh.position.set(0, LAYOUT.trnaAcceptorY, 0);
    const antiMats: THREE.MeshStandardMaterial[] = [];
    const anti = [-1, 0, 1].map((k) => {
      const mat = fading(solidOwn(pal.bases.A, { roughness: 0.4, clearcoat: 0.3 }));
      antiMats.push(mat);
      const h = kit.mesh(halfGeo, mat, group);
      // Bases of the colour code: drawn after occlusion and bloom, like the mRNA's (`rungs`).
      h.userData.layer = LAYER.FX;
      // From the anticodon loop up to the codon's base tips (illustrative pairing contact).
      const len = LAYOUT.stick;
      h.position.set(k * RISE, LAYOUT.trnaArmY + len / 2, 0);
      h.rotation.z = Math.PI / 2;
      h.scale.set(len / 2, THICK / 2, BAR / 2);
      return h;
    });
    group.visible = false;
    return {
      group,
      codon: -1,
      anti,
      antiMats,
      body,
      beadMesh,
      bead,
      meshes: [shape, beadMesh, ...anti],
    };
  };
  const slots: [TrnaSlot, TrnaSlot] = [makeSlot(), makeSlot()];
  const poses: [TrnaPose, TrnaPose] = [
    { codon: -1, at: [0, 0, 0], opacity: 0, carries: false },
    { codon: -1, at: [0, 0, 0], opacity: 0, carries: false },
  ];

  // ── Polypeptide (one colour, clear-coated beads, a gentle curve; no folding) ───────────
  const beadMat = solidOwn(pal.peptide, { roughness: 0.32, clearcoat: 0.7 });
  const beads = kit.instanced(beadGeo, beadMat, beadCap);
  const bonds = kit.instanced(rodGeo, beadMat, Math.max(1, beadCap - 1));

  // ── Selection ring ─────────────────────────────────────────────────────────────────────
  const ringMat = own(
    new THREE.MeshStandardMaterial({
      color: pal.highlight,
      emissive: pal.highlight,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    }),
  );
  const ring = kit.mesh(kit.geometry(new THREE.TorusGeometry(1, 0.06, 8, 40)), ringMat);
  ring.rotation.y = Math.PI / 2;
  ring.visible = false;

  // ── State ──────────────────────────────────────────────────────────────────────────────
  let win = { from: 0, to: 0 };
  let cur: DogmaMoment | null = null;
  let selected: DogmaSelection | null = null;
  /** Ranges of base pairs laid out for a moving bubble / mRNA (re-laid next time too). */
  let dnaDirty: [number, number] | null = null;
  let mrnaDirty: [number, number] | null = null;
  const back: Vec3 = [0, 0, 0];
  const tip: Vec3 = [0, 0, 0];
  const prevBack: Vec3 = [0, 0, 0];
  const tmp: Vec3 = [0, 0, 0];
  const tmp2: Vec3 = [0, 0, 0];
  const rib: RibosomePose = { x: 0, opacity: 0, smallLift: 0, largeDrop: 0 };
  const span: RigidSpan = { left: 0, right: 0, leftTurn: 0, rightTurn: 0 };
  // Scratch of `pointOf` (it may write into the callers' scratch vectors).
  const pa: Vec3 = [0, 0, 0];
  const pb: Vec3 = [0, 0, 0];
  const pc: Vec3 = [0, 0, 0];
  const pd: Vec3 = [0, 0, 0];
  let newest = -1;
  let shownBeads = 0;
  /** mRNA nucleotides of the window in its tube now. */
  let mrnaCount = 0;

  const local = (i: number) => i - win.from;

  /** A DNA base's backbone point and tip where they are drawn now; returns how open it is. */
  function dnaAt(i: number, strand: 'coding' | 'template', mo: DogmaMoment, b: Vec3, t: Vec3) {
    const e = dnaPose(i, strand, mo, b, t);
    placeDna(place, b);
    placeDna(place, t);
    return e;
  }

  function colorWindow(): void {
    for (let i = win.from; i < win.to; i++) {
      const k = local(i);
      dnaHalves.setColorAt(2 * k, baseColor.get(m.coding[i] ?? '') ?? grey);
      dnaHalves.setColorAt(2 * k + 1, baseColor.get(m.template[i] ?? '') ?? grey);
      mrnaHalves.setColorAt(k, baseColor.get(m.mrna[i] ?? '') ?? grey);
    }
    for (const mesh of [dnaHalves, mrnaHalves])
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** The resting helix of the window (both backbone tubes; drawn once per window, then turned). */
  function buildRest(): void {
    for (const [strand, s] of [
      ['coding', coding],
      ['template', template],
    ] as const) {
      const t = s.rest.tube;
      t.count = W;
      t.caps.start = true;
      t.caps.end = true;
      for (let i = win.from - 1; i <= win.to; i++) {
        strandPose(i, strand, 0, TWIST * i, back, tip);
        t.set(i - win.from, back);
      }
      t.build();
    }
  }

  /**
   * Backbones at a moment: the still stretches turn as one piece each (`rigidSpan`); the bubble
   * and its edges (with one joint pair on each side) are rebuilt. The joints have the same
   * neighbours in both tubes, so they meet without a seam.
   */
  function layBackbones(mo: DogmaMoment): void {
    rigidSpan(mo, span);
    const whole = !Number.isFinite(span.left);
    const a = whole ? win.to - 1 : Math.max(win.from, span.left - 1);
    const b = whole ? win.to - 1 : Math.min(win.to - 1, span.right + 1);
    for (const [strand, s] of [
      ['coding', coding],
      ['template', template],
    ] as const) {
      s.rest.mesh.rotation.x = span.leftTurn;
      s.right.rotation.x = span.rightTurn;
      s.rest.tube.show(0, local(a));
      s.rest.tube.show(local(b), W - 1, s.right.geometry);
      const t = s.open.tube;
      if (whole || b <= a) {
        t.count = 0;
        t.show(0, 0);
        continue;
      }
      t.count = b - a + 1;
      t.caps.start = a === win.from;
      t.caps.end = b === win.to - 1;
      for (let i = a - 1; i <= b + 1; i++) {
        dnaPose(i, strand, mo, back, tip);
        t.set(i - a, back);
      }
      t.build();
      t.show(0, t.count - 1);
    }
  }

  /** Lays out base pairs [lo, hi) of the DNA (both strands) for a moment. */
  function layDna(lo: number, hi: number, mo: DogmaMoment): void {
    const a = Math.max(win.from, lo);
    const b = Math.min(win.to, hi);
    if (a >= b) return;
    for (const [strand, id] of [
      ['coding', 0],
      ['template', 1],
    ] as const) {
      const seq = strand === 'coding' ? m.coding : m.template;
      for (let i = a; i < b; i++) {
        dnaPose(i, strand, mo, back, tip);
        w.half(dnaHalves, 2 * local(i) + id, back, tip, baseWidth(seq[i]));
      }
    }
    dnaHalves.instanceMatrix.needsUpdate = true;
    dnaHalves.boundingSphere = null;
  }

  /** Lays out mRNA bases [lo, hi) for a moment (bases not made yet are hidden). */
  function layMrna(lo: number, hi: number, mo: DogmaMoment): void {
    const t = mrna.tube;
    const count = Math.max(0, Math.min(W, mo.made - win.from));
    const grew = count !== mrnaCount;
    mrnaCount = count;
    t.count = count;
    const a = Math.max(win.from, lo);
    const b = Math.min(win.to, hi);
    for (let i = a; i < b; i++) {
      const k = local(i);
      if (!mrnaPose(i, mo, back, tip)) {
        w.hide(mrnaHalves, k);
        continue;
      }
      w.half(mrnaHalves, k, back, tip, baseWidth(m.mrna[i]));
      t.set(k, back);
    }
    mrnaHalves.instanceMatrix.needsUpdate = true;
    mrnaHalves.boundingSphere = null;
    if (count < 2) {
      t.show(0, 0);
      return;
    }
    // The ghosts: the base before the window, or a mirrored one; past the newest base, mirrored.
    if (win.from > 0 && mrnaPose(win.from - 1, mo, back, tip)) t.set(-1, back);
    else t.extrapolateStart();
    if (win.from + count < mo.made && mrnaPose(win.from + count, mo, back, tip)) t.set(count, back);
    else t.extrapolateEnd();
    t.caps.start = win.from === 0;
    t.caps.end = win.from + count === mo.made;
    // Segments that touch the moved bases (a segment depends on four points).
    t.build(local(a) - 2, local(b) + 1);
    if (grew) t.build(count - 4, count - 1);
    if (a <= win.from) t.build(0, 2);
    t.show(0, count - 1);
  }

  /**
   * Base pairs that move at a moment (null: none). While the polymerase works, the whole DNA
   * turns about its axis (`helixAngle`); while the bubble closes, the DNA from the bubble on.
   */
  function dnaRange(mo: DogmaMoment): [number, number] | null {
    if (mo.bubble <= 0) return null;
    if (mo.phase === 'transcription') return [win.from, win.to];
    const { lo } = bubbleSpan(mo);
    return [Math.floor(lo - LAYOUT.edge) - 1, win.to];
  }
  function mrnaRange(mo: DogmaMoment): [number, number] | null {
    if (mo.phase === 'translation') return null;
    // Bases further back are on their line already (they left the template).
    const lead = mo.polymerase - LAYOUT.hybrid;
    return [Math.floor(lead - LAYOUT.exit) - 1, Math.ceil(mo.polymerase) + 2];
  }
  const span2 = (
    a: [number, number] | null,
    b: [number, number] | null,
  ): [number, number] | null => {
    if (!a) return b;
    if (!b) return a;
    return [Math.min(a[0], b[0]), Math.max(a[1], b[1])];
  };

  function placeMachines(mo: DogmaMoment): void {
    // The DNA steps back while the ribosome works.
    dnaPlace(mo, xOf(win.from), place);
    dnaRoot.position.set(place.x0 * (1 - place.k), place.dy, place.dz);
    dnaRoot.scale.setScalar(place.k);
    // RNA polymerase around the bubble, cut open towards the viewer.
    const on = mo.polymeraseOn;
    polymerase.visible = on > 0.01;
    if (polymerase.visible) {
      const { lo, hi } = bubbleSpan(mo);
      const cx = xOf((lo + hi) / 2);
      polymerase.position.set(cx, -0.35 + (1 - on) * 1.2, -0.2);
      polymerase.scale.set(((hi - lo + 2) * RISE) / 2, 2.5, 1.55);
      polyMat.opacity = SHELL_OPACITY * on;
      setRimAlpha(polyMat, 0.4 * on);
    }
    // The next nucleotides the template asks for, coming in.
    let shown = 0;
    for (let k = 0; k < INCOMING; k++) {
      const j = mo.made + k;
      const d = j < n ? nucleotidePose(mo, k, back) : 0;
      if (d <= 0) continue;
      const s = Math.min(1, (3 - d) / 0.8) * Math.min(1, on);
      tip[0] = back[0];
      tip[1] = back[1] + LAYOUT.stick * 0.8 * s;
      tip[2] = back[2];
      const base = m.mrna[j] ?? '';
      if (s <= 0.01) continue;
      w.slab(incoming, shown, back, tip, baseWidth(base) * s, THICK * s);
      incoming.setColorAt(shown, baseColor.get(base) ?? grey);
      shown++;
    }
    incoming.count = shown;
    incoming.visible = shown > 0;
    if (shown > 0) {
      incoming.instanceMatrix.needsUpdate = true;
      if (incoming.instanceColor) incoming.instanceColor.needsUpdate = true;
      incoming.boundingSphere = null;
    }
    // Ribosome on the codon being read: the mRNA runs through the cleft of its two subunits.
    ribosomePose(m, mo, rib);
    const ribOn = rib.opacity > 0.01;
    small.visible = ribOn;
    large.visible = ribOn;
    if (ribOn) {
      small.position.set(rib.x, LAYOUT.mrnaLineY + RIBOSOME.small.y + rib.smallLift, -0.1);
      small.scale.set(...RIBOSOME.small.scale);
      large.position.set(rib.x, LAYOUT.mrnaLineY + RIBOSOME.large.y - rib.largeDrop, -0.25);
      large.scale.set(...RIBOSOME.large.scale);
      smallMat.opacity = SHELL_OPACITY * rib.opacity;
      largeMat.opacity = SHELL_OPACITY * rib.opacity;
      setRimAlpha(smallMat, 0.4 * rib.opacity);
      setRimAlpha(largeMat, 0.4 * rib.opacity);
    }
    // The codon being read glows in a thin frame.
    const c = mo.phase === 'translation' ? m.t.codons[mo.step] : undefined;
    codonFrame.visible =
      c !== undefined && rib.opacity > 0.3 && c.pos >= win.from && c.pos + 2 < win.to;
    if (c && codonFrame.visible)
      codonFrame.position.set(codonX(m, mo.step), LAYOUT.mrnaLineY - LAYOUT.stick / 2, 0.24);
    // tRNAs.
    trnaPoses(m, mo, poses);
    for (let k = 0; k < 2; k++) {
      const slot = slots[k as 0 | 1];
      const pose = poses[k as 0 | 1];
      const visible = pose.codon >= 0 && pose.opacity > 0.01;
      slot.group.visible = visible;
      if (!visible) continue;
      if (slot.codon !== pose.codon) {
        slot.codon = pose.codon;
        const cd = m.t.codons[pose.codon];
        const anti = cd ? (anticodonOf(cd) ?? '') : '';
        for (let j = 0; j < 3; j++) slot.antiMats[j]?.color.set(baseHex(anti[j]));
        // Purine slabs, pyrimidine bars: the same shape cue as the bases they pair with.
        for (let j = 0; j < 3; j++)
          slot.anti[j]?.scale.set(
            LAYOUT.stick / 2,
            THICK / 2,
            (PURINE.has(anti[j] ?? '') ? SLAB : BAR) / 2,
          );
      }
      slot.group.position.set(pose.at[0], pose.at[1], pose.at[2]);
      slot.beadMesh.visible = pose.carries;
      slot.body.opacity = pose.opacity;
      slot.bead.opacity = pose.opacity;
      for (const am of slot.antiMats) am.opacity = pose.opacity;
    }
    // The chain (newest bead first).
    newest = chainNewest(m, mo);
    shownBeads = Math.min(beadCap, newest + 1);
    beads.count = shownBeads;
    bonds.count = Math.max(0, shownBeads - 1);
    for (let k = 0; k < shownBeads; k++) {
      beadPose(m, mo, k, back);
      w.ball(beads, k, back, BEAD_R);
      if (k > 0) w.rod(bonds, k - 1, prevBack, back, 0.07);
      prevBack[0] = back[0];
      prevBack[1] = back[1];
      prevBack[2] = back[2];
    }
    for (const mesh of [beads, bonds]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.boundingSphere = null;
    }
  }

  /** Point of a part or a picked item now (ring centre, label, camera focus). */
  function pointOf(sel: DogmaSelection, out: Vec3): number | null {
    const mo = cur;
    if (!mo) return null;
    switch (sel.kind) {
      case 'base': {
        if (sel.index < win.from || sel.index >= win.to) return null;
        dnaAt(sel.index, 'coding', mo, pa, pb);
        dnaAt(sel.index, 'template', mo, pc, pd);
        out[0] = pa[0];
        out[1] = (pa[1] + pc[1]) / 2;
        out[2] = (pa[2] + pc[2]) / 2;
        return Math.max(1.25 * place.k, Math.hypot(pa[1] - pc[1], pa[2] - pc[2]) / 2 + 0.25);
      }
      case 'mrnaBase': {
        if (sel.index < win.from || sel.index >= win.to || !mrnaPose(sel.index, mo, pa, pb))
          return null;
        out[0] = pa[0];
        out[1] = (pa[1] + pb[1]) / 2;
        out[2] = (pa[2] + pb[2]) / 2;
        return 0.6;
      }
      case 'codon': {
        const c = m.t.codons[sel.codon];
        if (!c || c.pos + 1 < win.from || c.pos + 1 >= win.to || !mrnaPose(c.pos + 1, mo, pa, pb))
          return null;
        out[0] = pa[0];
        out[1] = (pa[1] + pb[1]) / 2;
        out[2] = (pa[2] + pb[2]) / 2;
        return 0.75;
      }
      case 'residue': {
        const k = newest - sel.codon;
        if (k < 0 || k >= shownBeads) return null;
        beadPose(m, mo, k, out);
        return 0.45;
      }
      case 'part':
        return null;
    }
  }

  const tintParts = (part: DogmaPart | null) => {
    const glow = (mat: THREE.MeshStandardMaterial, on: boolean) => {
      mat.emissive.set(on ? pal.highlight : '#000000');
      mat.emissiveIntensity = on ? 0.45 : 1;
    };
    glow(coding.rest.mat, part === 'coding');
    glow(template.rest.mat, part === 'template');
    glow(mrna.mat, part === 'mrna');
    glow(polyMat, part === 'polymerase');
    glow(smallMat, part === 'ribosome');
    glow(largeMat, part === 'ribosome');
    for (const s of slots) glow(s.body, part === 'trna');
    glow(beadMat, part === 'polypeptide');
  };

  function placeRing(): void {
    if (!selected || selected.kind === 'part') {
      ring.visible = false;
      return;
    }
    const r = pointOf(selected, tmp);
    ring.visible = r !== null;
    if (r === null) return;
    ring.position.set(tmp[0], tmp[1], tmp[2]);
    ring.scale.setScalar(r);
  }

  function update(mo: DogmaMoment): void {
    const prev = cur;
    cur = mo;
    const nextWin = windowFor(n, activeIndex(m, mo), W);
    const full = !prev || nextWin.from !== win.from || nextWin.to !== win.to;
    win = nextWin;
    if (full) {
      colorWindow();
      buildRest();
      mrnaCount = -1;
      layDna(win.from, win.to, mo);
      layMrna(win.from, win.to, mo);
      dnaDirty = dnaRange(mo);
      mrnaDirty = mrnaRange(mo);
    } else {
      // Only what moves: the bubble and the new mRNA (and where they were last time).
      const nowDna = dnaRange(mo);
      const d = span2(dnaDirty, nowDna);
      if (d) layDna(d[0], d[1], mo);
      dnaDirty = nowDna;
      const nowMrna = mrnaRange(mo);
      const r = span2(mrnaDirty, nowMrna);
      if (r) layMrna(r[0], r[1], mo);
      else if (mo.made - win.from !== mrnaCount) layMrna(win.to, win.to, mo);
      mrnaDirty = nowMrna;
      // A jump in time (the slider): everything between the two moments moved too.
      if (Math.abs(prev.polymerase - mo.polymerase) > 1 && mo.phase !== 'translation') {
        const lo = Math.floor(Math.min(prev.polymerase, mo.polymerase)) - LAYOUT.hybrid - 12;
        const hi = Math.ceil(Math.max(prev.polymerase, mo.polymerase)) + 6;
        layDna(lo, hi, mo);
        layMrna(lo, hi, mo);
      }
      if (prev.phase !== mo.phase) {
        layDna(win.from, win.to, mo);
        layMrna(win.from, win.to, mo);
      }
    }
    layBackbones(mo);
    placeMachines(mo);
    placeRing();
    // Picking may come before the next frame: world matrices follow the moment now.
    scene.updateMatrixWorld();
  }

  // Thin rungs shimmer far away: they fade as the camera backs off (the backbones stay).
  scene.onBeforeRender = (renderer, _scene, camera) => {
    const d = Math.hypot(camera.position.y - place.dy, camera.position.z - place.dz);
    setFade(rungMat, rungOpacity(pairPixels(renderer, camera, d, place.k)));
  };

  function pick(ray: THREE.Raycaster): DogmaSelection | null {
    const pickables: THREE.Object3D[] = [
      dnaHalves,
      mrnaHalves,
      beads,
      bonds,
      coding.rest.mesh,
      coding.right,
      coding.open.mesh,
      template.rest.mesh,
      template.right,
      template.open.mesh,
      mrna.mesh,
      polymerase,
      small,
      large,
    ];
    for (const s of slots) if (s.group.visible) pickables.push(...s.meshes);
    const hit = pickFirst(ray, pickables, {
      isContainer: (x) => x === polymerase || x === small || x === large,
    });
    if (!hit) return null;
    const obj = hit.object;
    const id = hit.instanceId ?? -1;
    if (obj === dnaHalves && id >= 0)
      return { kind: 'base', strand: id % 2 ? 'template' : 'coding', index: win.from + (id >> 1) };
    if (obj === mrnaHalves && id >= 0) {
      const i = win.from + id;
      const c = m.codonOf[i] ?? -1;
      return c >= 0 ? { kind: 'codon', codon: c } : { kind: 'mrnaBase', index: i };
    }
    if (obj === beads && id >= 0) return { kind: 'residue', codon: newest - id };
    if (obj === bonds) return { kind: 'part', part: 'polypeptide' };
    if (obj === coding.rest.mesh || obj === coding.right || obj === coding.open.mesh)
      return { kind: 'part', part: 'coding' };
    if (obj === template.rest.mesh || obj === template.right || obj === template.open.mesh)
      return { kind: 'part', part: 'template' };
    if (obj === mrna.mesh) return { kind: 'part', part: 'mrna' };
    if (obj === polymerase) return { kind: 'part', part: 'polymerase' };
    if (obj === small || obj === large) return { kind: 'part', part: 'ribosome' };
    for (const s of slots)
      if (s.meshes.includes(obj as THREE.Mesh) && s.codon >= 0)
        return { kind: 'codon', codon: s.codon };
    return null;
  }

  function anchorOf(part: DogmaPart, out: Vec3): boolean {
    const mo = cur;
    if (!mo) return false;
    const a = Math.min(win.to - 1, Math.max(win.from, activeIndex(m, mo)));
    const translating = mo.phase === 'translation';
    switch (part) {
      case 'coding':
      case 'template': {
        // Where the two strands are told apart at a glance: in the open bubble (coding strand
        // above, template below), or at a base pair of the helix whose coding strand is on top.
        let i: number;
        if (mo.bubble > 0.5) i = Math.round(bubbleSpan(mo).lo + 2);
        else {
          i = a;
          let best = -2;
          for (let j = a + 2; j < a + 2 + B_DNA.bpPerTurn; j++) {
            const up = Math.cos(helixAngle(j, mo));
            if (up > best) {
              best = up;
              i = j;
            }
          }
        }
        i = Math.min(win.to - 1, Math.max(win.from, i));
        dnaAt(i, part, mo, out, tip);
        return true;
      }
      case 'polymerase': {
        if (mo.polymeraseOn < 0.3) return false;
        out[0] = polymerase.position.x + polymerase.scale.x * 0.55;
        out[1] = polymerase.position.y + polymerase.scale.y * 0.75;
        out[2] = polymerase.scale.z * 0.35;
        return true;
      }
      case 'mrna': {
        if (mo.made === 0) return false;
        const j = translating
          ? Math.max(win.from, Math.min(win.to - 1, a - 9))
          : Math.max(win.from, Math.min(win.to - 1, mo.made - LAYOUT.hybrid - LAYOUT.exit - 2));
        return mrnaPose(j, mo, out, tip);
      }
      case 'ribosome': {
        if (rib.opacity < 0.3) return false;
        out[0] = large.position.x + 1.7;
        out[1] = large.position.y - 0.9;
        out[2] = 1;
        return true;
      }
      case 'trna': {
        const s = slots.find((x) => x.group.visible && x.codon >= 0);
        if (!s) return false;
        out[0] = s.group.position.x;
        out[1] = s.group.position.y + (LAYOUT.trnaArmY + LAYOUT.trnaBodyBottom) / 2;
        out[2] = s.group.position.z + 0.2;
        return true;
      }
      case 'polypeptide': {
        if (shownBeads === 0) return false;
        beadPose(m, mo, Math.min(shownBeads - 1, 3), out);
        return true;
      }
    }
  }

  const PARTS: readonly DogmaPart[] = [
    'polymerase',
    'ribosome',
    'trna',
    'polypeptide',
    'mrna',
    'coding',
    'template',
  ];

  /** Base pairs (or nucleotides, beads) per label obstacle: short pieces follow the curves. */
  const HULL_RUN = Math.max(4, Math.ceil(W / 40));

  /**
   * Label obstacles of the last moment asked for: points and hulls come from pools reused every
   * frame (nothing is allocated while the animation plays; the label layer reads them at once).
   */
  const hullPoints: Vec3[] = [];
  const hullPool: Vec3[][] = [];
  const obstacleList: Vec3[][] = [];
  let obstaclesOf: DogmaMoment | null = null;

  function labelObstacles(): LabelObstacles {
    const mo = cur;
    if (!mo || n === 0) return {};
    if (obstaclesOf === mo) return { avoid: obstacleList };
    obstaclesOf = mo;
    obstacleList.length = 0;
    let points = 0;
    let hull: Vec3[] | null = null;
    const add = (x: number, y: number, z: number) => {
      if (!hull) {
        hull = hullPool[obstacleList.length] ?? [];
        hullPool[obstacleList.length] = hull;
        hull.length = 0;
        obstacleList.push(hull);
      }
      let p = hullPoints[points];
      if (!p) {
        p = [0, 0, 0];
        hullPoints.push(p);
      }
      points++;
      p[0] = x;
      p[1] = y;
      p[2] = z;
      hull.push(p);
    };
    const flush = () => {
      hull = null;
    };
    // Both DNA strands (backbones and base tips: the bubble opens them apart).
    for (let i = win.from; i < win.to; i++) {
      for (const strand of ['coding', 'template'] as const) {
        dnaAt(i, strand, mo, back, tip);
        add(back[0], back[1], back[2]);
        add(tip[0], tip[1], tip[2]);
      }
      if ((i - win.from) % HULL_RUN === HULL_RUN - 1) flush();
    }
    flush();
    // The mRNA made so far.
    let run = 0;
    for (let i = win.from; i < win.to; i++) {
      if (!mrnaPose(i, mo, back, tip)) continue;
      add(back[0], back[1], back[2]);
      add(tip[0], tip[1], tip[2]);
      if (++run % HULL_RUN === 0) flush();
    }
    flush();
    // Each tRNA: from the codon it reads down to the amino acid it carries.
    for (const slot of slots) {
      if (!slot.group.visible) continue;
      const g = slot.group.position;
      const top = g.y + LAYOUT.trnaArmY + LAYOUT.stick;
      const bottom = g.y + LAYOUT.trnaAcceptorY - BEAD_R;
      for (const dx of [-0.6, 0.6])
        for (const y of [top, bottom]) for (const dz of [-0.4, 0.4]) add(g.x + dx, y, g.z + dz);
      flush();
    }
    // The polypeptide.
    for (let k = 0; k < shownBeads; k++) {
      beadPose(m, mo, k, back);
      add(back[0], back[1], back[2]);
      if (k % HULL_RUN === HULL_RUN - 1) flush();
    }
    return { avoid: obstacleList };
  }

  function tags(
    layer: TagLayer,
    eye: THREE.Vector3,
    target: THREE.Vector3,
    width: number,
    fmt: (n: number) => string,
  ): void {
    const mo = cur;
    if (!mo || n === 0) return;
    // Base indices around the camera's target: on the mRNA (unscaled) and on the DNA (stepped
    // back while the ribosome works).
    const around = (x: number) => Math.min(xOf(win.to - 1), Math.max(xOf(win.from), x));
    const cx = around(target.x);
    tmp[0] = cx;
    tmp[1] = LAYOUT.mrnaLineY;
    tmp[2] = 0;
    tmp2[0] = cx + RISE;
    tmp2[1] = LAYOUT.mrnaLineY;
    tmp2[2] = 0;
    const px = layer.spacing(tmp, tmp2);
    const dxDna = around(place.x0 + (target.x - place.x0) / place.k);
    tmp[0] = dxDna;
    tmp[1] = 0;
    tmp2[0] = dxDna + RISE;
    tmp2[1] = 0;
    placeDna(place, tmp);
    placeDna(place, tmp2);
    const pxDna = layer.spacing(tmp, tmp2);
    if (px <= 0 && pxDna <= 0) return;
    const rangeOf = (centreX: number, step: number) => {
      const centre = Math.round(centreX / RISE);
      const half = Math.ceil(width / Math.max(1e-6, step) / 2) + 4;
      return {
        lo: Math.max(win.from, centre - half),
        hi: Math.min(win.to, centre + half + 1),
      };
    };
    const rna = rangeOf(cx, px);
    const dna = rangeOf(dxDna, pxDna);
    // Letters once neighbouring bases are a tag cell apart on screen.
    if (px >= 10) {
      // tRNA anticodons and the amino acids they carry.
      for (const s of slots) {
        if (!s.group.visible || s.codon < 0) continue;
        const c = m.t.codons[s.codon];
        const anti = c ? (anticodonOf(c) ?? '') : '';
        for (let j = 0; j < 3; j++) {
          const p = s.anti[j]?.position;
          if (!p) continue;
          layer.add(
            anti[j] ?? '',
            s.group.position.x + p.x,
            s.group.position.y + p.y,
            s.group.position.z + p.z + 0.15,
            'letter',
          );
        }
        const aa = c ? aminoAcidOf(c) : null;
        if (aa && s.beadMesh.visible)
          layer.add(
            aa.three,
            s.group.position.x,
            s.group.position.y + LAYOUT.trnaAcceptorY,
            s.group.position.z + 0.35,
            'word',
            4,
          );
      }
      // Amino acids of the chain (newest first).
      for (let k = 0; k < shownBeads; k++) {
        const c = m.t.codons[newest - k];
        const aa = c ? aminoAcidOf(c) : null;
        if (!aa) continue;
        beadPose(m, mo, k, back);
        layer.add(aa.three, back[0], back[1], back[2] + 0.35, 'word', 4);
      }
      // The mRNA.
      for (let i = rna.lo; i < rna.hi; i++) {
        if (!mrnaPose(i, mo, back, tip)) continue;
        layer.add(
          m.mrna[i] ?? '',
          (back[0] + tip[0]) / 2,
          (back[1] + tip[1]) / 2,
          (back[2] + tip[2]) / 2 + 0.12,
          'letter',
        );
      }
    }
    if (pxDna >= 10) {
      // Both DNA strands.
      for (const strand of ['coding', 'template'] as const) {
        const seq = strand === 'coding' ? m.coding : m.template;
        for (let i = dna.lo; i < dna.hi; i++) {
          const e = dnaPose(i, strand, mo, back, tip);
          const mx = (back[0] + tip[0]) / 2;
          const my = (back[1] + tip[1]) / 2;
          const mz = (back[2] + tip[2]) / 2;
          // In the helix, only the bases on the camera's side (the far ones are behind it).
          const ey = (eye.y - place.dy) / place.k;
          const ez = (eye.z - place.dz) / place.k;
          if (e < 0.5 && my * (ey - my) + mz * (ez - mz) < 0) continue;
          tmp[0] = mx;
          tmp[1] = my;
          tmp[2] = mz;
          placeDna(place, tmp);
          layer.add(seq[i] ?? '', tmp[0], tmp[1], tmp[2], 'letter');
        }
      }
    }
    const at = (x: number, y: number, z = 0): Vec3 => {
      tmp[0] = x;
      tmp[1] = y;
      tmp[2] = z;
      return placeDna(place, tmp);
    };
    // Positions (1-based, the model's own) along a ruler above the helix.
    if (pxDna > 0) {
      const steps = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
      const every = steps.find((s) => s * pxDna >= 34) ?? 10000;
      const first = Math.max(every, Math.ceil((dna.lo + 1) / every) * every);
      if (dna.lo === 0) {
        const p = at(xOf(0), LAYOUT.rulerY);
        layer.add(fmt(1), p[0], p[1], p[2], 'tick', 2);
      }
      for (let q = first; q <= dna.hi; q += every) {
        const p = at(xOf(q - 1), LAYOUT.rulerY);
        layer.add(fmt(q), p[0], p[1], p[2], 'tick', 3);
      }
    }
    // Strand ends.
    if (win.from === 0) {
      let p = at(xOf(0) - 0.75, 1.15);
      layer.add('5′', p[0], p[1], p[2], 'tick');
      p = at(xOf(0) - 0.75, -1.15);
      layer.add('3′', p[0], p[1], p[2], 'tick');
      if (mo.made > 0 && mrnaPose(0, mo, back, tip))
        layer.add('5′', back[0] - 0.6, back[1], back[2], 'tick');
    }
    if (win.to === n) {
      let p = at(xOf(n - 1) + 0.75, 1.15);
      layer.add('3′', p[0], p[1], p[2], 'tick');
      p = at(xOf(n - 1) + 0.75, -1.15);
      layer.add('5′', p[0], p[1], p[2], 'tick');
    }
  }

  return {
    kit,
    scene,
    window: () => ({ ...win }),
    update,
    setSelection(sel) {
      selected = sel;
      tintParts(sel?.kind === 'part' ? sel.part : null);
      placeRing();
    },
    pick,
    focusPoint(sel) {
      const out: Vec3 = [0, 0, 0];
      if (sel.kind === 'part') return anchorOf(sel.part, out) ? out : null;
      return pointOf(sel, out) === null ? null : out;
    },
    labelAnchors() {
      const out: DogmaLabelAnchor[] = [];
      for (const id of PARTS) {
        const p: Vec3 = [0, 0, 0];
        if (anchorOf(id, p)) out.push({ id, point: p });
      }
      return out;
    },
    labelObstacles,
    tags,
    basePoint(strand, i) {
      const mo = cur;
      if (!mo || i < win.from || i >= win.to) return null;
      if (strand === 'mrna') {
        if (!mrnaPose(i, mo, back, tip)) return null;
      } else dnaAt(i, strand, mo, back, tip);
      const u = 2 / 3;
      return [
        back[0] + (tip[0] - back[0]) * u,
        back[1] + (tip[1] - back[1]) * u,
        back[2] + (tip[2] - back[2]) * u,
      ];
    },
    partVisible(part) {
      return anchorOf(part, tmp);
    },
    drawStats: () => drawStats(scene),
    dispose: () => {
      scene.onBeforeRender = () => undefined;
      kit.dispose();
    },
  };
}
