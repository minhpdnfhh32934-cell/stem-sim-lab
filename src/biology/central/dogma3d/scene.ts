/**
 * The three.js scene of "ADN → mARN → Protein" in 3D: the learner's own DNA as a B-DNA double
 * helix (the helix primitive of `helix.ts`, shared with "Đột biến điểm": one instanced rung half
 * per base, coloured and shaped by base: purines are slabs, pyrimidines bars), the RNA polymerase opening a bubble and building the mRNA on the template
 * strand, then the mRNA (U for T) running through a ribosome while tRNAs bring the amino acids
 * and the polypeptide grows as a chain of beads.
 *
 * Every base, codon, anticodon and amino acid is the model's (`binding.ts`); shapes, sizes and
 * motion are illustration (`layout.ts`). Long sequences draw a window of at most
 * `maxBasePairs` base pairs around the active position (absolute indices kept). One SceneKit
 * owns every geometry and material; `update` writes instance matrices in place (only the base
 * pairs that move), and nothing is allocated per frame.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { pickFirst } from '@/ui/three/pick';
import { withRelief } from '@/ui/three/relief';
import type { TagLayer } from '@/ui/three/tagLayer';
import { NEUTRAL, SceneKit } from '../../view3d/kit';
import { glass, setRimAlpha } from '../../view3d/materials';
import { proteinGeometry } from '../../view3d/recipes';
import { B_DNA, RISE } from './bdna';
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
  BACKBONE_R,
  BEAD_R,
  NODE_R,
  PURINE,
  SLAB,
  THICK,
  Writer,
  helixShapes,
  helixSolid,
  makeStrand,
  readDogmaPalette,
  type Strand,
} from './helix';
import {
  LAYOUT,
  beadPose,
  bubbleSpan,
  mrnaPose,
  ribosomePose,
  dnaPose,
  helixAngle,
  trnaPoses,
  xOf,
  type RibosomePose,
  type TrnaPose,
  type Vec3,
} from './layout';

export interface DogmaSceneOptions {
  tier: QualityTier;
  /** Sphere segments of the tier. */
  segments: number;
  /** Most base pairs drawn at once (the tier's instance budget). */
  maxBasePairs: number;
  /** Reads a CSS colour token. */
  token: (name: string) => string;
}

export interface DogmaLabelAnchor {
  id: DogmaPart;
  point: Vec3;
}

/** Fewest beads drawn, whatever the window. */
const MIN_BEADS = 12;

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

  // ── Shared shapes (the helix primitive, `helix.ts`) ──────────────────────────────────────
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

  // ── DNA ────────────────────────────────────────────────────────────────────────────────
  const dnaHalves = kit.instanced(halfGeo, solidOwn(NEUTRAL), 2 * W);
  const strandOf = (color: string): Strand => makeStrand(kit, shapes, color, o.tier, W);
  const coding = strandOf(pal.coding);
  const template = strandOf(pal.template);

  // ── mRNA ───────────────────────────────────────────────────────────────────────────────
  const mrnaHalves = kit.instanced(halfGeo, solidOwn(NEUTRAL), W);
  const mrna = strandOf(pal.mrna);

  // ── RNA polymerase and ribosome (see-through protein blobs, illustrative shapes) ────────
  /**
   * The kit's lumpy protein blob (seeded, so always the same shape) as a see-through shell: the
   * mRNA and tRNAs inside stay visible; hollows are shaded darker (the blob's vertex colours)
   * and fine grain catches the light. Not a real structure (the caption says so).
   */
  const shell = (color: string, opacity: number) => {
    const m = own(
      withRelief(glass(color, { opacity, rim: { color, strength: 0.55, alpha: 0.45 } }), {
        frequency: 3.2,
        height: 0.025,
      }),
    );
    m.vertexColors = true;
    return m;
  };
  const BLOB_SEED = { polymerase: 11, small: 29, large: 37 } as const;
  const polyMat = shell(pal.polymerase, 0.2);
  const polymerase = kit.mesh(proteinGeometry(kit, BLOB_SEED.polymerase), polyMat);
  polymerase.renderOrder = 2;
  const smallMat = shell(pal.ribosome, 0.2);
  const largeMat = shell(pal.ribosome, 0.16);
  const small = kit.mesh(proteinGeometry(kit, BLOB_SEED.small), smallMat);
  const large = kit.mesh(proteinGeometry(kit, BLOB_SEED.large), largeMat);
  small.renderOrder = 2;
  large.renderOrder = 2;

  // ── tRNA slots (at most two at once) ───────────────────────────────────────────────────
  const capsuleArm = kit.capsule(0.11, 1.05);
  const capsuleBody = kit.capsule(0.3, 1.95);
  const makeSlot = (): TrnaSlot => {
    const group = new THREE.Group();
    scene.add(group);
    const body = fading(solidOwn(pal.trna, { roughness: 0.5, sheen: 0.4 }));
    const bead = fading(solidOwn(pal.peptide));
    const arm = kit.mesh(capsuleArm, body, group);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0, LAYOUT.trnaArmY, 0);
    const trunk = kit.mesh(capsuleBody, body, group);
    trunk.position.set(0, (LAYOUT.trnaArmY + LAYOUT.trnaBodyBottom) / 2, 0);
    trunk.scale.set(1, 1, 0.6);
    const lobes = [-1, 1].map((side) => {
      const lobe = kit.mesh(kit.sphere(0.6), body, group);
      lobe.scale.set(0.26, 0.3, 0.2);
      lobe.position.set(side * 0.42, LAYOUT.trnaArmY - 0.75, 0);
      return lobe;
    });
    const stem = kit.mesh(rodGeo, body, group);
    stem.scale.set(0.07, LAYOUT.trnaBodyBottom - LAYOUT.trnaAcceptorY, 0.07);
    stem.position.set(0, (LAYOUT.trnaBodyBottom + LAYOUT.trnaAcceptorY) / 2 + 0.15, 0);
    const beadMesh = kit.mesh(beadGeo, bead, group);
    beadMesh.scale.setScalar(BEAD_R + 0.02);
    beadMesh.position.set(0, LAYOUT.trnaAcceptorY, 0);
    const antiMats: THREE.MeshStandardMaterial[] = [];
    const anti = [-1, 0, 1].map((k) => {
      const mat = fading(solidOwn(pal.bases.A));
      antiMats.push(mat);
      const h = kit.mesh(halfGeo, mat, group);
      // From the arm up to the codon's base tips (illustrative pairing contact).
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
      meshes: [arm, trunk, ...lobes, stem, beadMesh, ...anti],
    };
  };
  const slots: [TrnaSlot, TrnaSlot] = [makeSlot(), makeSlot()];
  const poses: [TrnaPose, TrnaPose] = [
    { codon: -1, at: [0, 0, 0], opacity: 0, carries: false },
    { codon: -1, at: [0, 0, 0], opacity: 0, carries: false },
  ];

  // ── Polypeptide ─────────────────────────────────────────────────────────────────────────
  const beadMat = solidOwn(pal.peptide, { roughness: 0.35, clearcoat: 0.6 });
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
  // Scratch of `pointOf` (it may write into the callers' scratch vectors).
  const pa: Vec3 = [0, 0, 0];
  const pb: Vec3 = [0, 0, 0];
  const pc: Vec3 = [0, 0, 0];
  const pd: Vec3 = [0, 0, 0];
  let newest = -1;
  let shownBeads = 0;

  const local = (i: number) => i - win.from;

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

  /** Lays out base pairs [lo, hi) of the DNA (both strands) for a moment. */
  function layDna(lo: number, hi: number, mo: DogmaMoment): void {
    const a = Math.max(win.from, lo);
    const b = Math.min(win.to, hi);
    if (a >= b) return;
    for (const [strand, s, id] of [
      ['coding', coding, 0],
      ['template', template, 1],
    ] as const) {
      for (let i = a; i < b; i++) {
        dnaPose(i, strand, mo, back, tip);
        const k = local(i);
        const base = (strand === 'coding' ? m.coding : m.template)[i] ?? '';
        w.slab(dnaHalves, 2 * k + id, back, tip, PURINE.has(base) ? SLAB : BAR);
        w.ball(s.node, k, back, NODE_R);
        if (i > win.from) {
          dnaPose(i - 1, strand, mo, prevBack, tmp);
          w.rod(s.seg, k - 1, prevBack, back, BACKBONE_R);
        }
        // The segment to the next base pair moves with this one too.
        if (i === b - 1 && i + 1 < win.to) {
          dnaPose(i + 1, strand, mo, tmp, tmp2);
          w.rod(s.seg, k, back, tmp, BACKBONE_R);
        }
      }
      s.seg.instanceMatrix.needsUpdate = true;
      s.node.instanceMatrix.needsUpdate = true;
      s.seg.boundingSphere = null;
      s.node.boundingSphere = null;
    }
    dnaHalves.instanceMatrix.needsUpdate = true;
    dnaHalves.boundingSphere = null;
  }

  /** Lays out mRNA bases [lo, hi) for a moment (bases not made yet are hidden). */
  function layMrna(lo: number, hi: number, mo: DogmaMoment): void {
    const a = Math.max(win.from, lo);
    const b = Math.min(win.to, hi);
    if (a >= b) return;
    for (let i = a; i < b; i++) {
      const k = local(i);
      if (!mrnaPose(i, mo, back, tip)) {
        w.hide(mrnaHalves, k);
        w.hide(mrna.node, k);
        if (k > 0) w.hide(mrna.seg, k - 1);
        continue;
      }
      const base = m.mrna[i] ?? '';
      w.slab(mrnaHalves, k, back, tip, PURINE.has(base) ? SLAB : BAR);
      w.ball(mrna.node, k, back, NODE_R * 0.9);
      if (i > win.from) {
        mrnaPose(i - 1, mo, prevBack, tmp);
        w.rod(mrna.seg, k - 1, prevBack, back, BACKBONE_R * 0.9);
      }
      if (i === b - 1 && i + 1 < win.to) {
        if (mrnaPose(i + 1, mo, tmp, tmp2)) w.rod(mrna.seg, k, back, tmp, BACKBONE_R * 0.9);
        else w.hide(mrna.seg, k);
      }
    }
    for (const mesh of [mrnaHalves, mrna.node, mrna.seg]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.boundingSphere = null;
    }
  }

  /** Base pairs that move with the bubble / the leaving mRNA at a moment (null: none). */
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
  const span = (
    a: [number, number] | null,
    b: [number, number] | null,
  ): [number, number] | null => {
    if (!a) return b;
    if (!b) return a;
    return [Math.min(a[0], b[0]), Math.max(a[1], b[1])];
  };

  function placeMachines(mo: DogmaMoment): void {
    // RNA polymerase around the bubble.
    const on = mo.polymeraseOn;
    polymerase.visible = on > 0.01;
    if (polymerase.visible) {
      const { lo, hi } = bubbleSpan(mo);
      const cx = xOf((lo + hi) / 2);
      polymerase.position.set(cx, -0.35 + (1 - on) * 1.2, 0);
      polymerase.scale.set(((hi - lo + 2) * RISE) / 2 + 1, 3, 2.3);
      polyMat.opacity = 0.2 * on;
      setRimAlpha(polyMat, 0.45 * on);
    }
    // Ribosome on the codon being read.
    ribosomePose(m, mo, rib);
    const ribOn = rib.opacity > 0.01;
    small.visible = ribOn;
    large.visible = ribOn;
    if (ribOn) {
      small.position.set(rib.x, LAYOUT.mrnaLineY + 0.95 + rib.smallLift, 0);
      small.scale.set(2, 0.78, 1.45);
      large.position.set(rib.x, LAYOUT.mrnaLineY - 2.3 - rib.largeDrop, 0);
      large.scale.set(2.35, 1.85, 1.7);
      smallMat.opacity = 0.2 * rib.opacity;
      largeMat.opacity = 0.16 * rib.opacity;
      setRimAlpha(smallMat, 0.45 * rib.opacity);
      setRimAlpha(largeMat, 0.45 * rib.opacity);
    }
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
        const c = m.t.codons[pose.codon];
        const anti = c ? (anticodonOf(c) ?? '') : '';
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
        dnaPose(sel.index, 'coding', mo, pa, pb);
        dnaPose(sel.index, 'template', mo, pc, pd);
        out[0] = pa[0];
        out[1] = (pa[1] + pc[1]) / 2;
        out[2] = (pa[2] + pc[2]) / 2;
        return Math.max(1.25, Math.hypot(pa[1] - pc[1], pa[2] - pc[2]) / 2 + 0.25);
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
    glow(coding.mat, part === 'coding');
    glow(template.mat, part === 'template');
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
      layDna(win.from, win.to, mo);
      layMrna(win.from, win.to, mo);
      dnaDirty = dnaRange(mo);
      mrnaDirty = mrnaRange(mo);
    } else {
      // Only what moves: the bubble and the new mRNA (and where they were last time).
      const nowDna = dnaRange(mo);
      const d = span(dnaDirty, nowDna);
      if (d) layDna(d[0], d[1], mo);
      dnaDirty = nowDna;
      const nowMrna = mrnaRange(mo);
      const r = span(mrnaDirty, nowMrna);
      if (r) layMrna(r[0], r[1], mo);
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
    placeMachines(mo);
    placeRing();
  }

  function pick(ray: THREE.Raycaster): DogmaSelection | null {
    const pickables: THREE.Object3D[] = [
      dnaHalves,
      mrnaHalves,
      beads,
      bonds,
      coding.seg,
      coding.node,
      template.seg,
      template.node,
      mrna.seg,
      mrna.node,
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
    if (obj === coding.seg || obj === coding.node) return { kind: 'part', part: 'coding' };
    if (obj === template.seg || obj === template.node) return { kind: 'part', part: 'template' };
    if (obj === mrna.seg || obj === mrna.node) return { kind: 'part', part: 'mrna' };
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
        dnaPose(i, part, mo, out, tip);
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

  function tags(
    layer: TagLayer,
    eye: THREE.Vector3,
    target: THREE.Vector3,
    width: number,
    fmt: (n: number) => string,
  ): void {
    const mo = cur;
    if (!mo || n === 0) return;
    const cx = Math.min(xOf(win.to - 1), Math.max(xOf(win.from), target.x));
    tmp[0] = cx;
    tmp[1] = 0;
    tmp[2] = 0;
    tmp2[0] = cx + RISE;
    tmp2[1] = 0;
    tmp2[2] = 0;
    const px = layer.spacing(tmp, tmp2);
    if (px <= 0) return;
    const centre = Math.round(cx / RISE);
    const half = Math.ceil(width / px / 2) + 4;
    const lo = Math.max(win.from, centre - half);
    const hi = Math.min(win.to, centre + half + 1);
    // Letters once neighbouring bases are a tag cell apart on screen.
    const letters = px >= 10;
    if (letters) {
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
      // mRNA, then both DNA strands.
      for (let i = lo; i < hi; i++) {
        if (!mrnaPose(i, mo, back, tip)) continue;
        layer.add(
          m.mrna[i] ?? '',
          (back[0] + tip[0]) / 2,
          (back[1] + tip[1]) / 2,
          (back[2] + tip[2]) / 2 + 0.12,
          'letter',
        );
      }
      for (const strand of ['coding', 'template'] as const) {
        const seq = strand === 'coding' ? m.coding : m.template;
        for (let i = lo; i < hi; i++) {
          const e = dnaPose(i, strand, mo, back, tip);
          const mx = (back[0] + tip[0]) / 2;
          const my = (back[1] + tip[1]) / 2;
          const mz = (back[2] + tip[2]) / 2;
          // In the helix, only the bases on the camera's side (the far ones are behind it).
          if (e < 0.5 && my * (eye.y - my) + mz * (eye.z - mz) < 0) continue;
          layer.add(seq[i] ?? '', mx, my, mz, 'letter');
        }
      }
    }
    // Positions (1-based, the model's own) along a ruler above the helix.
    const steps = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    const every = steps.find((s) => s * px >= 34) ?? 10000;
    const first = Math.max(every, Math.ceil((lo + 1) / every) * every);
    if (lo === 0) layer.add(fmt(1), xOf(0), LAYOUT.rulerY, 0, 'tick', 2);
    for (let p = first; p <= hi; p += every)
      layer.add(fmt(p), xOf(p - 1), LAYOUT.rulerY, 0, 'tick', 3);
    // Strand ends.
    if (win.from === 0) {
      layer.add('5′', xOf(0) - 0.75, 1.15, 0, 'tick');
      layer.add('3′', xOf(0) - 0.75, -1.15, 0, 'tick');
      if (mo.made > 0 && mrnaPose(0, mo, back, tip))
        layer.add('5′', back[0] - 0.6, back[1], back[2], 'tick');
    }
    if (win.to === n) {
      layer.add('3′', xOf(n - 1) + 0.75, 1.15, 0, 'tick');
      layer.add('5′', xOf(n - 1) + 0.75, -1.15, 0, 'tick');
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
    tags,
    basePoint(strand, i) {
      const mo = cur;
      if (!mo || i < win.from || i >= win.to) return null;
      if (strand === 'mrna') {
        if (!mrnaPose(i, mo, back, tip)) return null;
      } else dnaPose(i, strand, mo, back, tip);
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
      kit.dispose();
    },
  };
}
