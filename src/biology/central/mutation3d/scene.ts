/**
 * The three.js scene of "Đột biến điểm" in 3D: the normal and the mutated DNA as two B-DNA double
 * helices in two lanes on faint plates, one above the other — drawn with the helix recipe of
 * "ADN → mARN → Protein" (continuous backbone tubes, base pairs as two rounded halves split at the
 * midline, coloured and shaped by base), so the two lessons look the same — each with its mRNA
 * and thin rounded codon brackets, and the two protein chains side by side under the lanes.
 *
 * Every base, codon and amino acid is the model's (`binding.ts`); the shapes, the alignment, the
 * lanes, the bulge of an insertion and the gap of a deletion are illustration (`layout.ts`). The
 * changed base pairs carry a glowing outline (HDR, blooming on High) that can pulse (`setPulse`;
 * the view never pulses under reduced motion); deleted pairs leave gap-marker rings on the mutated
 * helix; a premature stop ends the mutated chain with a flat end cap. Long sequences draw a window
 * of at most `maxBasePairs` slots around the site (absolute indices kept). The scene does not
 * move: it is laid out once; one SceneKit owns every geometry and material.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { mixLinear } from '@/ui/three/color';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { pickFirst } from '@/ui/three/pick';
import type { Hull, LabelObstacles } from '@/ui/three/labelLayer';
import type { TagLayer } from '@/ui/three/tagLayer';
import { NEUTRAL, SceneKit } from '../../view3d/kit';
import { ROLES } from '../../view3d/palette';
import { highlightIntensity } from '../../view3d/recipes';
import { RADIUS, RISE } from '../dogma3d/bdna';
import {
  BEAD_R,
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
  type StrandMesh,
} from '../dogma3d/helix';
import {
  beadNames,
  beadSlot,
  changedBeads,
  changedCodons,
  prematureStop,
  slotShown,
  strandOf,
  windowFor,
  type HelixId,
  type MutationModel3D,
} from './binding';
import type { MutationPart, MutationSelection } from './components';
import {
  LAYOUT,
  beadPoint,
  bracketEnds,
  laneSpan,
  mrnaPose,
  pairPose,
  slotPose,
  xOf,
  type Vec3,
} from './layout';

export interface MutationSceneOptions {
  tier: QualityTier;
  /** Sphere segments of the tier. */
  segments: number;
  /** Most base pairs (slots) drawn at once (the tier's instance budget). */
  maxBasePairs: number;
  /** Reads a CSS colour token. */
  token: (name: string) => string;
  /** Highlights glow in HDR and bloom (High tier with post-processing). */
  hdr?: boolean;
}

export interface MutationLabelAnchor {
  id: MutationPart;
  point: Vec3;
}

/** Bracket look of a codon (instance colour): the changed codons of the mutated mRNA, start, stop. */
export type BracketLook = 'changed' | 'start' | 'stop' | 'plain';

export interface MutationScene {
  readonly kit: SceneKit;
  readonly scene: THREE.Scene;
  /** Slots drawn: [from, to) (absolute). */
  window(): { from: number; to: number };
  setSelection(sel: MutationSelection | null): void;
  pick(ray: THREE.Raycaster): MutationSelection | null;
  /** Where a picked thing is now (camera focus), or null when it is not drawn. */
  focusPoint(sel: MutationSelection): Vec3 | null;
  /** A point of a base pair's coding half (clear of the backbone), or null when not drawn. */
  pairPoint(helix: HelixId, i: number): Vec3 | null;
  /** The middle of the site marker (between the two helices). */
  sitePoint(): Vec3;
  labelAnchors(): MutationLabelAnchor[];
  /** What the name labels never cover (world hulls): both DNAs, both mRNAs and both chains. */
  labelObstacles(): LabelObstacles;
  /**
   * Letters, amino acid names, position numbers and the lanes' names (`lanes`, already in the
   * learner's language) for this frame (`fmt`: whole numbers).
   */
  tags(
    layer: TagLayer,
    eye: THREE.Vector3,
    target: THREE.Vector3,
    width: number,
    fmt: (n: number) => string,
    lanes?: Record<HelixId, string>,
  ): void;
  /** Pulse of the outlines: seconds since the pulse started, or null for the resting outline. */
  setPulse(t: number | null): void;
  /** What is drawn (tests): sequences by helix, outlines, gap markers, bracket looks, beads. */
  drawn(): {
    halves: Record<HelixId, { index: number; coding: string; template: string }[]>;
    outlined: { helix: HelixId; index: number }[];
    gapSlots: number[];
    brackets: Record<HelixId, { codon: number; look: BracketLook; from: number; to: number }[]>;
    beads: Record<HelixId, { index: number; changed: boolean; outlined: boolean }[]>;
    /** The mutated chain ends early (premature stop): its end cap is drawn. */
    endCap: boolean;
  };
  drawStats(): DrawStats;
  dispose(): void;
}

/** Period of one pulse (s). */
export const PULSE_PERIOD = 1.2;
/** How far a plate reaches past the first and last slots drawn. */
const LANE_EDGE = 1.25;
/** A lane name's half width and its gap to the plate (px): the longest name is about 64 px. */
const LANE_TAG_HALF = 34;
const LANE_TAG_GAP = 8;
const HELICES: readonly HelixId[] = ['normal', 'mutated'];
/** Radius of a deletion's gap-marker ring around the helix (just outside the backbones). */
const GAP_RING_R = RADIUS + 0.3;

interface HelixParts {
  halves: THREE.InstancedMesh;
  coding: StrandMesh;
  template: StrandMesh;
  mrnaHalves: THREE.InstancedMesh;
  mrna: StrandMesh;
  bars: THREE.InstancedMesh;
  ticks: THREE.InstancedMesh;
  /** Rounded corners of the brackets (where a bar meets its ticks). */
  corners: THREE.InstancedMesh;
  beads: THREE.InstancedMesh;
  bonds: THREE.InstancedMesh;
  /** Base index of each drawn pair (instance pair k ↔ halves 2k, 2k + 1). */
  pairs: number[];
  /** Codon index of each bracket bar. */
  codons: number[];
  looks: BracketLook[];
  /** Amino acid number of each bead drawn. */
  beadIds: number[];
}

export function buildMutationScene(model: MutationModel3D, o: MutationSceneOptions): MutationScene {
  const n = model.normal.coding.length;
  const W = Math.max(1, Math.min(n, Math.floor(o.maxBasePairs)));
  const win = windowFor(n, model.site, W);
  const kit = new SceneKit({
    tier: o.tier,
    segments: o.segments,
    maxParticles: W,
    token: o.token,
    hdr: o.hdr ?? false,
  });
  const pal = readDogmaPalette(o.token);
  const accent = o.token(ROLES.highlight.token);
  const lookColor: Record<BracketLook, THREE.Color> = {
    changed: new THREE.Color(accent),
    start: new THREE.Color(o.token('--conf-exact')),
    stop: new THREE.Color(o.token('--conf-approx')),
    plain: new THREE.Color(o.token('--text-muted')),
  };
  const baseColor = new Map<string, THREE.Color>(
    Object.entries(pal.bases).map(([b, c]) => [b, new THREE.Color(c)]),
  );
  const grey = new THREE.Color(pal.coding);
  const colorOf = (b: string | undefined) => baseColor.get(b ?? '') ?? grey;
  const peptide = new THREE.Color(pal.peptide);
  const accentColor = new THREE.Color(accent);
  const w = new Writer();
  const scene = kit.scene;
  const shapes = helixShapes(kit, o.tier);
  const solidOwn = (color: string, extra: Parameters<typeof helixSolid>[3] = {}) =>
    helixSolid(kit, color, o.tier, extra);

  // Capacities: an insertion adds at most its bases to the mutated helix, a deletion its gap.
  const extra = model.bulge ? model.bulge.to - model.bulge.from : 0;
  const gapN = model.gap ? model.gap.to - model.gap.from : 0;
  const capPairs = W + extra + 1;
  const capCodons = Math.ceil(capPairs / 3) + 2;
  const barMat = solidOwn(NEUTRAL, { roughness: 0.5, clearcoat: 0.3 });
  const beadMat = solidOwn(NEUTRAL, { roughness: 0.32, clearcoat: 0.7 });
  const bondMat = solidOwn(pal.peptide, { roughness: 0.35, clearcoat: 0.6 });
  const rungMat = rungMaterial(kit, 'dna');

  // ── Lanes: one faint plate behind each DNA with its mRNA (two worlds, side by side) ─────
  const plateColor = mixLinear(o.token('--bg-sunken'), o.token('--text-muted'), 0.12);
  const plateMat = solidOwn(plateColor, { roughness: 0.9 });
  const plates = kit.instanced(kit.roundedBox(6), plateMat, 2);
  {
    const x0 = xOf(win.from) - LANE_EDGE;
    const x1 = xOf(win.to - 1) + LANE_EDGE;
    const m4 = new THREE.Matrix4();
    HELICES.forEach((h, k) => {
      const s = laneSpan(h);
      m4.makeScale((x1 - x0) / 2, (s.hi - s.lo) / 2, 0.05).setPosition(
        (x0 + x1) / 2,
        (s.lo + s.hi) / 2,
        LAYOUT.plateZ,
      );
      plates.setMatrixAt(k, m4);
    });
    plates.instanceMatrix.needsUpdate = true;
  }

  const AXIS: Record<HelixId, { y: number; z: number }> = {
    normal: { y: LAYOUT.helixY.normal, z: 0 },
    mutated: { y: LAYOUT.helixY.mutated, z: 0 },
  };
  const makeParts = (h: HelixId): HelixParts => ({
    halves: rungs(kit, shapes, 2 * capPairs),
    coding: strandMesh(kit, 'coding', capPairs + gapN, AXIS[h]),
    template: strandMesh(kit, 'template', capPairs + gapN, AXIS[h]),
    mrnaHalves: rungs(kit, shapes, capPairs, kit.scene, 'mrna'),
    mrna: strandMesh(kit, 'mrna', capPairs, null),
    bars: kit.instanced(shapes.rod, barMat, capCodons),
    ticks: kit.instanced(shapes.rod, barMat, 2 * capCodons),
    corners: kit.instanced(kit.sphere(0.4), barMat, 2 * capCodons),
    beads: kit.instanced(shapes.bead, beadMat, capCodons),
    bonds: kit.instanced(shapes.rod, bondMat, capCodons),
    pairs: [],
    codons: [],
    looks: [],
    beadIds: [],
  });
  const parts: Record<HelixId, HelixParts> = {
    normal: makeParts('normal'),
    mutated: makeParts('mutated'),
  };

  // ── Outlines: a glowing rim around the changed pairs and beads (drawn behind them) ──────
  const hullMat = kit.own(
    new THREE.MeshBasicMaterial({
      color: accent,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  // HDR on High: brighter than white, so the bloom picks it up (and only it).
  hullMat.color.multiplyScalar(highlightIntensity(kit));
  hullMat.userData.bloom = kit.hdr;
  const pairHull = kit.instanced(shapes.half, hullMat, Math.max(1, model.marks.length));
  const beadHull = kit.instanced(shapes.bead, hullMat, 2 * capCodons);
  // ── Gap markers: a thin ring around the mutated helix at each deleted pair's place ─────
  const ghostMat = kit.own(
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      roughness: 0.4,
    }),
  );
  const ghosts = kit.instanced(
    kit.geometry(new THREE.TorusGeometry(GAP_RING_R, 0.045, 8, Math.max(24, kit.seg * 2))),
    ghostMat,
    Math.max(1, gapN),
  );
  // ── Site marker: a thin accent rod between the helices, at the site ────────────────────
  const siteMat = solidOwn(accent, { roughness: 0.4 });
  const siteRod = kit.mesh(shapes.rod, siteMat);
  // ── End cap of a chain cut short by a premature stop: a flat disc ───────────────────────
  const capMat = solidOwn(o.token('--conf-approx'), { roughness: 0.4, clearcoat: 0.4 });
  const endCap = kit.mesh(kit.cylinder(), capMat);
  endCap.visible = false;
  // ── Selection ring ─────────────────────────────────────────────────────────────────────
  const ringMat = kit.own(
    new THREE.MeshStandardMaterial({
      color: pal.highlight,
      emissive: pal.highlight,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    }),
  );
  const ring = kit.mesh(kit.geometry(new THREE.TorusGeometry(1, 0.06, 8, 40)), ringMat);
  ring.visible = false;

  const back: Vec3 = [0, 0, 0];
  const tip: Vec3 = [0, 0, 0];
  const back2: Vec3 = [0, 0, 0];
  const tip2: Vec3 = [0, 0, 0];
  const prev: Vec3 = [0, 0, 0];
  const a: Vec3 = [0, 0, 0];
  const b: Vec3 = [0, 0, 0];
  const done = (mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.boundingSphere = null;
    mesh.boundingBox = null;
  };

  // ── Helices ────────────────────────────────────────────────────────────────────────────
  function layHelix(helix: HelixId): void {
    const p = parts[helix];
    const s = strandOf(model, helix);
    const y0 = LAYOUT.helixY[helix];
    for (let i = 0; i < s.coding.length; i++) if (slotShown(s.slot[i] ?? 0, win)) p.pairs.push(i);
    p.pairs.forEach((i, k) => {
      pairPose(model, helix, i, 'coding', back, tip);
      w.half(p.halves, 2 * k, back, tip, baseWidth(s.coding[i]));
      p.halves.setColorAt(2 * k, colorOf(s.coding[i]));
      pairPose(model, helix, i, 'template', back, tip);
      w.half(p.halves, 2 * k + 1, back, tip, baseWidth(s.template[i]));
      p.halves.setColorAt(2 * k + 1, colorOf(s.template[i]));
    });
    done(p.halves, 2 * p.pairs.length);
    // Backbones: one tube per strand through every base, and through a deletion's empty slots.
    for (const strand of ['coding', 'template'] as const) {
      const t = (strand === 'coding' ? p.coding : p.template).tube;
      let k = 0;
      const put = (v: Vec3) => {
        t.set(k++, v);
      };
      p.pairs.forEach((i, j) => {
        if (j > 0) {
          const s0 = s.slot[p.pairs[j - 1] ?? i] ?? 0;
          const s1 = s.slot[i] ?? 0;
          for (let g = Math.floor(s0) + 1; s1 - s0 > 1 && g < s1; g++) {
            slotPose(g, model.site, y0, strand, back2, tip2);
            put(back2);
          }
        }
        pairPose(model, helix, i, strand, back, tip);
        put(back);
      });
      t.count = k;
      // The ghosts: where the helix would go on past the window's ends.
      const first = s.slot[p.pairs[0] ?? 0] ?? 0;
      const last = s.slot[p.pairs.at(-1) ?? 0] ?? 0;
      slotPose(Math.floor(first) - 1, model.site, y0, strand, back2, tip2);
      t.set(-1, back2);
      slotPose(Math.ceil(last) + 1, model.site, y0, strand, back2, tip2);
      t.set(k, back2);
      t.build();
      t.show(0, k - 1);
    }
    // mRNA: one half rung per base (U for T), its backbone a tube along its row.
    const mt = p.mrna.tube;
    p.pairs.forEach((i, k) => {
      mrnaPose(model, helix, i, back, tip);
      w.half(p.mrnaHalves, k, back, tip, baseWidth(s.mrna[i]));
      p.mrnaHalves.setColorAt(k, colorOf(s.mrna[i]));
      mt.set(k, back);
    });
    mt.count = p.pairs.length;
    mt.extrapolateStart();
    mt.extrapolateEnd();
    mt.build();
    mt.show(0, mt.count - 1);
    done(p.mrnaHalves, p.pairs.length);
  }

  // ── Codon brackets (thin rounded frames beside each mRNA) ─────────────────────────────
  const changed = new Set(changedCodons(model));
  function lookOf(helix: HelixId, c: number): BracketLook {
    const codon = strandOf(model, helix).t.codons[c];
    if (helix === 'mutated' && changed.has(c)) return 'changed';
    if (codon?.entry?.stop) return 'stop';
    if (c === 0 && codon?.entry?.start) return 'start';
    return 'plain';
  }
  function layBrackets(helix: HelixId): void {
    const p = parts[helix];
    const s = strandOf(model, helix);
    const dir = helix === 'normal' ? -1 : 1;
    for (const c of s.t.codons) {
      const first = s.slot[c.pos];
      const last = s.slot[c.pos + 2];
      if (first === undefined || last === undefined) continue;
      if (!slotShown(first, win) || !slotShown(last, win)) continue;
      if (p.codons.length >= capCodons) break;
      const k = p.codons.length;
      bracketEnds(model, helix, c.index, a, b);
      w.rod(p.bars, k, a, b, 0.035);
      const look = lookOf(helix, c.index);
      const col = lookColor[look];
      p.bars.setColorAt(k, col);
      for (const [j, end] of [a, b].entries()) {
        const q: Vec3 = [end[0], end[1] + dir * LAYOUT.tick, end[2]];
        w.rod(p.ticks, 2 * k + j, end, q, 0.03);
        p.ticks.setColorAt(2 * k + j, col);
        w.ball(p.corners, 2 * k + j, end, 0.035);
        p.corners.setColorAt(2 * k + j, col);
      }
      p.codons.push(c.index);
      p.looks.push(look);
    }
    done(p.bars, p.codons.length);
    done(p.ticks, 2 * p.codons.length);
    done(p.corners, 2 * p.codons.length);
  }

  // ── Protein chains (beads lined up by amino acid number) ───────────────────────────────
  const outlinedBeads: { helix: HelixId; index: number }[] = [];
  function layChain(helix: HelixId): void {
    const p = parts[helix];
    const names = beadNames(strandOf(model, helix).t);
    const hot = new Set(changedBeads(model, helix));
    for (let k = 0; k < names.length && p.beadIds.length < capCodons; k++) {
      const slot = beadSlot(model, k);
      if (slot < win.from - 1 || slot > win.to) continue;
      const id = p.beadIds.length;
      beadPoint(model, helix, k, back);
      w.ball(p.beads, id, back, BEAD_R);
      // Changed amino acids of the mutated chain are accent beads; both chains outline theirs.
      p.beads.setColorAt(id, helix === 'mutated' && hot.has(k) ? accentColor : peptide);
      if (id > 0) w.rod(p.bonds, id - 1, prev, back, 0.07);
      prev[0] = back[0];
      prev[1] = back[1];
      prev[2] = back[2];
      if (hot.has(k)) {
        w.ball(beadHull, outlinedBeads.length, back, BEAD_R + 0.055);
        outlinedBeads.push({ helix, index: k });
      }
      p.beadIds.push(k);
    }
    done(p.beads, p.beadIds.length);
    done(p.bonds, Math.max(0, p.beadIds.length - 1));
  }

  for (const h of HELICES) {
    layHelix(h);
    layBrackets(h);
    layChain(h);
  }
  done(beadHull, outlinedBeads.length);

  // A premature stop codon (`prematureStop`: where the stop sits, not how long the chain is):
  // the mutated chain ends with a flat cap just after its last amino acid.
  const short = prematureStop(model) && parts.mutated.beadIds.length > 0;
  if (short) {
    const last = parts.mutated.beadIds.at(-1) ?? 0;
    beadPoint(model, 'mutated', last, back);
    endCap.visible = true;
    endCap.position.set(back[0] + BEAD_R + 0.2, back[1], back[2]);
    endCap.rotation.z = Math.PI / 2;
    endCap.scale.set(BEAD_R * 1.15, 0.07, BEAD_R * 1.15);
  }

  // ── Outlines of the changed pairs, gap markers, site marker ────────────────────────────
  const outlined: { helix: HelixId; index: number }[] = [];
  for (const mk of model.marks) {
    const s = strandOf(model, mk.helix);
    if (!slotShown(s.slot[mk.index] ?? -1e9, win)) continue;
    pairPose(model, mk.helix, mk.index, 'coding', back, tip);
    pairPose(model, mk.helix, mk.index, 'template', back2, tip2);
    const width = Math.max(baseWidth(s.coding[mk.index]), baseWidth(s.template[mk.index]));
    w.slab(pairHull, outlined.length, back, back2, width, THICK, 0.2);
    outlined.push(mk);
  }
  done(pairHull, outlined.length);
  const gapSlots: number[] = [];
  if (model.gap) {
    const m4 = new THREE.Matrix4();
    const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    const one = new THREE.Vector3(1, 1, 1);
    const at = new THREE.Vector3();
    for (let g = model.gap.from; g < model.gap.to; g++) {
      if (!slotShown(g, win)) continue;
      at.set(xOf(g), LAYOUT.helixY.mutated, 0);
      ghosts.setMatrixAt(gapSlots.length, m4.compose(at, turn, one));
      gapSlots.push(g);
    }
  }
  done(ghosts, gapSlots.length);
  ghosts.visible = gapSlots.length > 0;
  const siteX = xOf(model.site);
  const siteLo = LAYOUT.helixY.mutated + RADIUS + 0.2;
  const siteHi = LAYOUT.helixY.normal - RADIUS - 0.2;
  siteRod.position.set(siteX, (siteLo + siteHi) / 2, 0);
  siteRod.scale.set(0.035, siteHi - siteLo, 0.035);
  pairHull.visible = outlined.length > 0;
  beadHull.visible = outlinedBeads.length > 0;
  scene.updateMatrixWorld();

  // Thin rungs shimmer far away: they fade as the camera backs off (the backbones stay).
  const midY = (LAYOUT.helixY.normal + LAYOUT.helixY.mutated) / 2;
  scene.onBeforeRender = (renderer, _scene, camera) => {
    const d = Math.hypot(camera.position.y - midY, camera.position.z);
    setFade(rungMat, rungOpacity(pairPixels(renderer, camera, d)));
  };

  // ── Selection ──────────────────────────────────────────────────────────────────────────
  let selected: MutationSelection | null = null;

  function pointOf(sel: MutationSelection, out: Vec3): number | null {
    const p = parts[sel.helix];
    switch (sel.kind) {
      case 'pair': {
        if (!p.pairs.includes(sel.index)) return null;
        pairPose(model, sel.helix, sel.index, 'coding', back, tip);
        pairPose(model, sel.helix, sel.index, 'template', back2, tip2);
        out[0] = (back[0] + back2[0]) / 2;
        out[1] = (back[1] + back2[1]) / 2;
        out[2] = (back[2] + back2[2]) / 2;
        return Math.max(1.25, Math.hypot(back[1] - back2[1], back[2] - back2[2]) / 2 + 0.25);
      }
      case 'codon': {
        if (!p.codons.includes(sel.codon)) return null;
        const c = strandOf(model, sel.helix).t.codons[sel.codon];
        if (!c) return null;
        mrnaPose(model, sel.helix, c.pos + 1, back, tip);
        out[0] = back[0];
        out[1] = (back[1] + tip[1]) / 2;
        out[2] = back[2];
        return 0.8;
      }
      case 'bead': {
        if (!p.beadIds.includes(sel.index)) return null;
        beadPoint(model, sel.helix, sel.index, out);
        return 0.45;
      }
    }
  }

  function placeRing(): void {
    if (!selected) {
      ring.visible = false;
      return;
    }
    const r = pointOf(selected, a);
    ring.visible = r !== null;
    if (r === null) return;
    ring.position.set(a[0], a[1], a[2]);
    ring.scale.setScalar(r);
    // Around the DNA or the mRNA (facing along it); facing the viewer around a bead.
    ring.rotation.set(0, selected.kind === 'bead' ? 0 : Math.PI / 2, 0);
    ring.updateMatrixWorld();
  }

  function pick(ray: THREE.Raycaster): MutationSelection | null {
    const pickables: THREE.Object3D[] = [];
    for (const h of HELICES) {
      const p = parts[h];
      pickables.push(
        p.halves,
        p.coding.mesh,
        p.template.mesh,
        p.mrnaHalves,
        p.bars,
        p.ticks,
        p.corners,
        p.beads,
      );
    }
    const hit = pickFirst(ray, pickables);
    if (!hit) return null;
    const id = hit.instanceId ?? -1;
    for (const helix of HELICES) {
      const p = parts[helix];
      const s = strandOf(model, helix);
      const obj = hit.object;
      if (obj === p.halves) {
        const i = p.pairs[id >> 1];
        return i === undefined ? null : { kind: 'pair', helix, index: i };
      }
      if (obj === p.coding.mesh || obj === p.template.mesh) {
        // A backbone: the drawn pair nearest the hit along the helix.
        let best = -1;
        let dist = Infinity;
        for (const i of p.pairs) {
          const dx = Math.abs(xOf(s.slot[i] ?? 0) - hit.point.x);
          if (dx < dist) {
            dist = dx;
            best = i;
          }
        }
        return best < 0 ? null : { kind: 'pair', helix, index: best };
      }
      if (obj === p.mrnaHalves) {
        const i = p.pairs[id];
        const c = i === undefined ? -1 : (s.codonOf[i] ?? -1);
        return c >= 0 ? { kind: 'codon', helix, codon: c } : null;
      }
      if (obj === p.bars || obj === p.ticks || obj === p.corners) {
        const c = p.codons[obj === p.bars ? id : id >> 1];
        return c === undefined ? null : { kind: 'codon', helix, codon: c };
      }
      if (obj === p.beads) {
        const k = p.beadIds[id];
        return k === undefined ? null : { kind: 'bead', helix, index: k };
      }
    }
    return null;
  }

  function pairPoint(helix: HelixId, i: number): Vec3 | null {
    if (!parts[helix].pairs.includes(i)) return null;
    pairPose(model, helix, i, 'coding', back, tip);
    const u = 2 / 3;
    return [
      back[0] + (tip[0] - back[0]) * u,
      back[1] + (tip[1] - back[1]) * u,
      back[2] + (tip[2] - back[2]) * u,
    ];
  }

  /**
   * Name anchors at the ends of the parts, so that the labels stand beside the picture: the
   * normal parts at the left end, the mutated parts at the right end.
   */
  function labelAnchors(): MutationLabelAnchor[] {
    const out: MutationLabelAnchor[] = [];
    const end = (list: number[], helix: HelixId) =>
      helix === 'normal' ? list[Math.min(list.length - 1, 1)] : list[Math.max(0, list.length - 2)];
    for (const helix of HELICES) {
      const p = parts[helix];
      const i = end(p.pairs, helix);
      if (i !== undefined) {
        mrnaPose(model, helix, i, back, tip);
        out.push({
          id: helix === 'normal' ? 'normalMrna' : 'mutatedMrna',
          point: [back[0], back[1], back[2]],
        });
        pairPose(model, helix, i, helix === 'normal' ? 'coding' : 'template', back, tip);
        out.push({
          id: helix === 'normal' ? 'normalDna' : 'mutatedDna',
          point: [back[0], back[1], back[2]],
        });
      }
      const k = helix === 'normal' ? p.beadIds[0] : p.beadIds.at(-1);
      if (k !== undefined)
        out.push({
          id: helix === 'normal' ? 'normalProtein' : 'mutatedProtein',
          point: beadPoint(model, helix, k, [0, 0, 0]),
        });
    }
    return out;
  }

  /** Base pairs (or beads) per label obstacle: short pieces follow the helices' turns. */
  const HULL_RUN = Math.max(4, Math.ceil(W / 40));

  /** The picture does not move: its obstacles are worked out once. */
  let obstacles: LabelObstacles | null = null;

  function labelObstacles(): LabelObstacles {
    if (obstacles) return obstacles;
    const avoid: Hull[] = [];
    for (const helix of HELICES) {
      const p = parts[helix];
      let dna: Vec3[] = [];
      let rna: Vec3[] = [];
      p.pairs.forEach((i, k) => {
        for (const strand of ['coding', 'template'] as const) {
          pairPose(model, helix, i, strand, back, tip);
          dna.push([back[0], back[1], back[2]], [tip[0], tip[1], tip[2]]);
        }
        mrnaPose(model, helix, i, back, tip);
        rna.push([back[0], back[1], back[2]], [tip[0], tip[1], tip[2]]);
        if (k % HULL_RUN === HULL_RUN - 1 || k === p.pairs.length - 1) {
          avoid.push(dna, rna);
          dna = [];
          rna = [];
        }
      });
      let chain: Vec3[] = [];
      p.beadIds.forEach((b, k) => {
        chain.push(beadPoint(model, helix, b, [0, 0, 0]));
        if (k % HULL_RUN === HULL_RUN - 1 || k === p.beadIds.length - 1) {
          avoid.push(chain);
          chain = [];
        }
      });
    }
    obstacles = { avoid };
    return obstacles;
  }

  function tags(
    layer: TagLayer,
    eye: THREE.Vector3,
    target: THREE.Vector3,
    width: number,
    fmt: (k: number) => string,
    lanes?: Record<HelixId, string>,
  ): void {
    if (n === 0) return;
    const cx = Math.min(xOf(win.to - 1), Math.max(xOf(win.from), target.x));
    const px = layer.spacing([cx, LAYOUT.helixY.normal, 0], [cx + RISE, LAYOUT.helixY.normal, 0]);
    if (px <= 0) return;
    const centre = Math.round(cx / RISE);
    const half = Math.ceil(width / px / 2) + 4;
    const lo = Math.max(win.from, centre - half);
    const hi = Math.min(win.to, centre + half + 1);
    const inView = (slot: number) => slot >= lo - 1 && slot < hi;
    // The lanes' names, outside each plate at its helix, on the side its name labels do not use
    // (normal labels stand left, mutated ones right): in front (z = 0, like the strand ends),
    // clear of the 5′/3′ ends, the ruler between the lanes and the chains under them.
    if (lanes)
      for (const helix of HELICES) {
        const y = LAYOUT.helixY[helix];
        const side = helix === 'normal' ? 1 : -1;
        const edge = side > 0 ? xOf(win.to - 1) + LANE_EDGE : xOf(win.from) - LANE_EDGE;
        const pxu = layer.spacing([edge, y, 0], [edge + 1, y, 0]);
        if (pxu <= 0) continue;
        const x = edge + (side * (LANE_TAG_GAP + LANE_TAG_HALF)) / pxu;
        layer.add(lanes[helix], x, y, 0, 'word', 5);
      }
    if (px >= 10) {
      // Amino acids first (whole words), then the mRNAs, then the DNA letters.
      for (const helix of HELICES) {
        const names = beadNames(strandOf(model, helix).t);
        for (const k of parts[helix].beadIds) {
          if (!inView(beadSlot(model, k))) continue;
          beadPoint(model, helix, k, back);
          // Normal names above their chain, mutated names below theirs: never between the two.
          const dy = helix === 'normal' ? BEAD_R + 0.28 : -BEAD_R - 0.28;
          layer.add(names[k] ?? '', back[0], back[1] + dy, back[2], 'word', 4);
        }
      }
      for (const helix of HELICES) {
        const s = strandOf(model, helix);
        for (const i of parts[helix].pairs) {
          if (!inView(s.slot[i] ?? 0)) continue;
          mrnaPose(model, helix, i, back, tip);
          layer.add(
            s.mrna[i] ?? '',
            (back[0] + tip[0]) / 2,
            (back[1] + tip[1]) / 2,
            (back[2] + tip[2]) / 2 + 0.12,
            'letter',
          );
        }
      }
      for (const helix of HELICES) {
        const s = strandOf(model, helix);
        const y0 = LAYOUT.helixY[helix];
        for (const strand of ['coding', 'template'] as const) {
          const seq = strand === 'coding' ? s.coding : s.template;
          for (const i of parts[helix].pairs) {
            if (!inView(s.slot[i] ?? 0)) continue;
            pairPose(model, helix, i, strand, back, tip);
            const mx = (back[0] + tip[0]) / 2;
            const my = (back[1] + tip[1]) / 2;
            const mz = (back[2] + tip[2]) / 2;
            // Only the bases on the camera's side of the helix (the far ones are behind it).
            if ((my - y0) * (eye.y - my) + mz * (eye.z - mz) < 0) continue;
            layer.add(seq[i] ?? '', mx, my, mz, 'letter');
          }
        }
      }
    }
    // Positions (1-based, the normal DNA's) on the ruler between the lanes.
    const steps = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    const every = steps.find((s) => s * px >= 34) ?? 10000;
    const first = Math.max(every, Math.ceil((lo + 1) / every) * every);
    if (lo === 0) layer.add(fmt(1), xOf(0), LAYOUT.rulerY, 0, 'tick', 2);
    for (let q = first; q <= hi; q += every)
      layer.add(fmt(q), xOf(q - 1), LAYOUT.rulerY, 0, 'tick', 3);
    // Strand ends of both DNAs and both mRNAs.
    for (const helix of HELICES) {
      const y0 = LAYOUT.helixY[helix];
      const ym = LAYOUT.mrnaY[helix];
      if (win.from === 0) {
        layer.add('5′', xOf(0) - 0.75, y0 + 1.15, 0, 'tick');
        layer.add('3′', xOf(0) - 0.75, y0 - 1.15, 0, 'tick');
        layer.add('5′', xOf(0) - 0.6, ym, 0, 'tick');
      }
      if (win.to === n) {
        layer.add('3′', xOf(n - 1) + 0.75, y0 + 1.15, 0, 'tick');
        layer.add('5′', xOf(n - 1) + 0.75, y0 - 1.15, 0, 'tick');
        layer.add('3′', xOf(n - 1) + 0.6, ym, 0, 'tick');
      }
    }
  }

  function setPulse(t: number | null): void {
    const wave = t === null ? 1 : 0.5 + 0.5 * Math.cos((2 * Math.PI * t) / PULSE_PERIOD);
    hullMat.opacity = 0.35 + 0.55 * wave;
    ghostMat.opacity = 0.35 + 0.5 * wave;
  }

  return {
    kit,
    scene,
    window: () => ({ ...win }),
    setSelection(sel) {
      selected = sel;
      placeRing();
    },
    pick,
    focusPoint(sel) {
      const out: Vec3 = [0, 0, 0];
      return pointOf(sel, out) === null ? null : out;
    },
    pairPoint,
    sitePoint: () => [siteX, LAYOUT.rulerY, 0],
    labelAnchors,
    labelObstacles,
    tags,
    setPulse,
    drawn() {
      const col = new THREE.Color();
      const halves = {} as ReturnType<MutationScene['drawn']>['halves'];
      const brackets = {} as ReturnType<MutationScene['drawn']>['brackets'];
      const beads = {} as ReturnType<MutationScene['drawn']>['beads'];
      for (const helix of HELICES) {
        const p = parts[helix];
        const s = strandOf(model, helix);
        const hex = (id: number) => {
          p.halves.getColorAt(id, col);
          return `#${col.getHexString()}`;
        };
        halves[helix] = p.pairs.map((i, k) => ({
          index: i,
          coding: hex(2 * k),
          template: hex(2 * k + 1),
        }));
        brackets[helix] = p.codons.map((c, k) => {
          const codon = s.t.codons[c];
          const from = codon ? (s.slot[codon.pos] ?? 0) : 0;
          const to = codon ? (s.slot[codon.pos + 2] ?? 0) : 0;
          return { codon: c, look: p.looks[k] ?? 'plain', from, to };
        });
        const hot = new Set(changedBeads(model, helix));
        beads[helix] = p.beadIds.map((k) => ({
          index: k,
          changed: helix === 'mutated' && hot.has(k),
          outlined: outlinedBeads.some((x) => x.helix === helix && x.index === k),
        }));
      }
      return {
        halves,
        outlined: [...outlined],
        gapSlots: [...gapSlots],
        brackets,
        beads,
        endCap: endCap.visible,
      };
    },
    drawStats: () => drawStats(scene),
    dispose: () => {
      scene.onBeforeRender = () => undefined;
      kit.dispose();
    },
  };
}
