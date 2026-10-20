/**
 * The three.js scene of "Động học enzyme" in 3D: a glass reaction volume with the representative
 * enzymes (lumpy blobs, each with an active-site pocket — a lock-and-key cartoon — and, for non-
 * and uncompetitive inhibition, a second binding site on its side), the substrate held in the
 * pocket of ES and ESI complexes, the inhibitor in the pocket (competitive EI) or at the second
 * site (EI, ESI), and the free substrate, product and inhibitor particles.
 *
 * Which enzyme is in which form and how many particles show come from the model (`binding.ts`,
 * `setFrame`); shapes, places and the particles' drift are illustration (`layout.ts`). Roles keep
 * the palette's colour and shape cue (substrate sphere, product diamond, inhibitor cube, the
 * enzyme's ring = the second site). `setFrame` and `setPhase` allocate nothing; one SceneKit owns
 * every geometry and material.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { QualityTier } from '@/perf/tiers';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { solid } from '@/ui/three/materials';
import { withEdgeShade, withRelief } from '@/ui/three/relief';
import { pickFirst } from '@/ui/three/pick';
import type { TagLayer } from '@/ui/three/tagLayer';
import { SceneKit } from '../../view3d/kit';
import { fbm3 } from '../../view3d/noise';
import { ROLES } from '../../view3d/palette';
import { shapeGeometry } from '../../view3d/primitives/classShape';
import type { Inhibition } from '../enzyme';
import {
  ENZYMES_DRAWN,
  PARTICLE_CAP,
  formsOf,
  holdsInhibitor,
  holdsSubstrate,
  type EnzymeForm,
  type EnzymeFrame,
} from './binding';
import type { EnzymePart, EnzymeSelection } from './components';
import { ALLO_DIR, ENZYME_PLACES, LAYOUT, particleAt, type Vec3 } from './layout';

export interface EnzymeSceneOptions {
  tier: QualityTier;
  /** Sphere segments of the tier. */
  segments: number;
  /** The lesson's inhibition type (where an inhibitor binds, which enzymes show a second site). */
  kind: Inhibition;
  /** Reads a CSS colour token. */
  token: (name: string) => string;
}

export interface EnzymeLabelAnchor {
  id: EnzymePart;
  point: Vec3;
}

export interface EnzymeDrawn {
  forms: EnzymeForm[];
  /** Substrate held in an active site (ES + ESI). */
  boundSubstrate: number;
  /** Inhibitor in an active site (competitive EI). */
  inhibitorInSite: number;
  /** Inhibitor at the second site (non-/uncompetitive EI + ESI). */
  inhibitorElsewhere: number;
  /** Second sites shown. */
  otherSites: number;
  particles: { S: number; P: number; I: number };
}

export interface EnzymeScene {
  readonly kit: SceneKit;
  readonly scene: THREE.Scene;
  /** Shows a moment of the model (enzyme forms, particles); no allocation. */
  setFrame(frame: EnzymeFrame): void;
  /** Illustrative drift of the free particles (phase in seconds of animation); no allocation. */
  setPhase(phase: number): void;
  setSelection(sel: EnzymeSelection | null): void;
  pick(ray: THREE.Raycaster): EnzymeSelection | null;
  /** Where a picked thing is now (camera focus, tests), or null when it is not shown. */
  focusPoint(sel: EnzymeSelection): Vec3 | null;
  /** The form of each drawn enzyme now. */
  forms(): readonly EnzymeForm[];
  labelAnchors(): EnzymeLabelAnchor[];
  /** The form of each enzyme over it ("ES", "EI"…; `name` gives the short names). */
  tags(layer: TagLayer, name: (f: EnzymeForm) => string): void;
  drawn(): EnzymeDrawn;
  drawStats(): DrawStats;
  dispose(): void;
}

const L = LAYOUT;
const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/**
 * Radius of the enzyme blob (relative) in the unit direction (x, y, z) of its own frame, where
 * the active site points along +y: a pocket there (lock-and-key cartoon) with a slight lip, soft
 * lumps elsewhere and, when asked, a shallow second site at ALLO_DIR.
 */
export function enzymeRadiusAt(x: number, y: number, z: number, otherSite: boolean): number {
  const theta = Math.acos(clamp1(y));
  const half = L.notchHalf;
  let r = 1;
  if (theta < half) r -= L.notchDepth * Math.cos(((theta / half) * Math.PI) / 2) ** 2;
  else if (theta < half + 0.35) r += 0.05 * Math.sin(((theta - half) / 0.35) * Math.PI);
  const phi = Math.atan2(z, x);
  const lumps =
    0.06 * Math.sin(3 * phi + 0.7) * Math.sin(2 * theta) + 0.035 * Math.cos(5 * theta + phi);
  r += smooth(half + 0.2, half + 0.7, theta) * lumps;
  if (otherSite) {
    const a = Math.acos(clamp1(x * ALLO_DIR[0] + y * ALLO_DIR[1] + z * ALLO_DIR[2]));
    if (a < 0.32) r -= 0.12 * Math.cos(((a / 0.32) * Math.PI) / 2) ** 2;
  }
  return r;
}

/**
 * Shade (0…1, multiplies the enzyme's colour) in the unit direction (x, y, z) of its own frame:
 * darker inside the active-site pocket and the second site, so the hollows read at any angle
 * (cartoon shading, like ambient occlusion).
 */
export function enzymeShadeAt(x: number, y: number, z: number, otherSite: boolean): number {
  const theta = Math.acos(clamp1(y));
  let c = 1;
  if (theta < L.notchHalf * 1.1) c -= 0.45 * (1 - theta / (L.notchHalf * 1.1)) ** 0.7;
  if (otherSite) {
    const a = Math.acos(clamp1(x * ALLO_DIR[0] + y * ALLO_DIR[1] + z * ALLO_DIR[2]));
    if (a < 0.34) c -= 0.3 * (1 - a / 0.34);
  }
  return Math.max(0.45, c);
}

/**
 * Fine lumps of the enzyme's surface (illustration, like the kit's protein blobs): height as a
 * share of the radius, noise frequency on the unit sphere, seed, and how much darker the
 * valleys get (cavity shading).
 */
export const ENZYME_RELIEF = { amplitude: 0.045, frequency: 2.6, seed: 23, valley: 0.35 } as const;

/**
 * Where the fine lumps show (0…1): none in the active-site pocket and its lip, nor at the second
 * site, so a bound particle keeps its seat exactly where the binding layout puts it.
 */
export function enzymeReliefMask(x: number, y: number, z: number, otherSite: boolean): number {
  let m = smooth(L.notchHalf + 0.35, L.notchHalf + 0.75, Math.acos(clamp1(y)));
  if (otherSite) {
    const a = Math.acos(clamp1(x * ALLO_DIR[0] + y * ALLO_DIR[1] + z * ALLO_DIR[2]));
    m *= smooth(0.34, 0.6, a);
  }
  return m;
}

/** The enzyme blob (unit size; seams merged so it shades smoothly; hollows shaded darker). */
export function enzymeGeometry(segments: number, otherSite: boolean): THREE.BufferGeometry {
  const w = Math.max(24, Math.round(segments * 2));
  const h = Math.max(18, Math.round(segments * 1.5));
  const sphere = new THREE.SphereGeometry(1, w, h);
  sphere.deleteAttribute('uv');
  sphere.deleteAttribute('normal');
  const g = mergeVertices(sphere);
  sphere.dispose();
  const pos = g.getAttribute('position');
  const shade = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const f = ENZYME_RELIEF.frequency;
    const lump =
      fbm3(v.x * f + 3.1, v.y * f - 1.7, v.z * f + 5.3, ENZYME_RELIEF.seed) *
      enzymeReliefMask(v.x, v.y, v.z, otherSite);
    const valley = 1 - ENZYME_RELIEF.valley * Math.max(0, -lump);
    shade.fill(enzymeShadeAt(v.x, v.y, v.z, otherSite) * valley, i * 3, i * 3 + 3);
    v.multiplyScalar(
      enzymeRadiusAt(v.x, v.y, v.z, otherSite) * (1 + ENZYME_RELIEF.amplitude * lump),
    );
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Centre of the substrate (or competitive inhibitor) held in the pocket, relative. */
const POCKET_AT = 1 - L.notchDepth + (L.particleR / L.enzymeR) * 0.95;
/** Centre of the second-site ring and of an inhibitor held there, relative. */
const OTHER_AT = 0.93;
const OTHER_INHIBITOR_AT = 1.2;

export function buildEnzymeScene(o: EnzymeSceneOptions): EnzymeScene {
  const kit = new SceneKit({
    tier: o.tier,
    segments: o.segments,
    maxParticles: PARTICLE_CAP,
    token: o.token,
  });
  const { scene } = kit;
  const kind = o.kind;
  /** Non-competitive: every enzyme has the second site; uncompetitive: only with substrate. */
  const siteOnAll = kind === 'noncompetitive';
  const siteWithS = kind === 'uncompetitive';
  const hasOtherSite = siteOnAll || siteWithS;

  // ── Scratch (no allocation in setFrame / setPhase) ───────────────────────────────────
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const tmpQ = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const dirV = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const a: Vec3 = [0, 0, 0];
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const done = (mesh: THREE.InstancedMesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingSphere = null;
    mesh.visible = mesh.count > 0;
  };

  // ── Materials (theme tokens; the palette's roles) ────────────────────────────────────
  // Its own material, the kit's protein look: the blob's vertex shade darkens the pocket and the
  // valleys, the silhouette darkens softly (--m3d-edge-shade) so each blob reads as a volume,
  // fine grain catches the light (illustration). The role colour stays the albedo.
  const enzymeColor = kit.color(ROLES.enzyme.token);
  const edgeShade = parseFloat(kit.color('--m3d-edge-shade'));
  const enzymeMat = kit.own(
    withEdgeShade(
      withRelief(solid(enzymeColor, o.tier, { roughness: 0.62, sheen: 0.35, clearcoat: 0.1 }), {
        frequency: 9,
        height: 0.012,
      }),
      { strength: Number.isFinite(edgeShade) ? edgeShade : 0 },
    ),
  );
  enzymeMat.vertexColors = true;
  const subMat = kit.solid(kit.color(ROLES.substrate.token), { roughness: 0.3, clearcoat: 0.5 });
  const prodMat = kit.solid(kit.color(ROLES.product.token), { roughness: 0.3, clearcoat: 0.5 });
  const inhMat = kit.solid(kit.color(ROLES.inhibitor.token), { roughness: 0.3, clearcoat: 0.5 });
  const siteMat = kit.solid(kit.color('--text-muted'), { roughness: 0.5 });
  const boxMat = kit.glass(kit.color('--text-muted'), {
    opacity: 0.05,
    rim: { color: kit.color('--text'), alpha: 0.28, strength: 0.4, power: 2.4 },
  });
  const haloMat = kit.glass(kit.color('--accent'), {
    opacity: 0.08,
    rim: { color: kit.color('--accent'), alpha: 0.95, strength: 1, power: 1.6 },
  });
  const edgeMat = kit.own(
    new THREE.LineBasicMaterial({
      color: kit.color('--text-muted'),
      transparent: true,
      opacity: 0.55,
    }),
  );

  // ── Reaction volume ──────────────────────────────────────────────────────────────────
  const box = kit.mesh(kit.roundedBox(14), boxMat);
  box.scale.set(L.hx + 0.2, L.hy + 0.2, L.hz + 0.2);
  box.renderOrder = 2;
  const boxGeo = new THREE.BoxGeometry(2 * (L.hx + 0.2), 2 * (L.hy + 0.2), 2 * (L.hz + 0.2));
  const edges = new THREE.LineSegments(kit.geometry(new THREE.EdgesGeometry(boxGeo)), edgeMat);
  boxGeo.dispose();
  scene.add(edges);
  kit.shadow(-L.hy - 0.3, L.hx + 1.2, L.hz + 1.2, 0.2);

  // ── Enzymes ──────────────────────────────────────────────────────────────────────────
  const enzymeGeo = kit.geometry(enzymeGeometry(kit.seg, siteOnAll));
  const enzymes = kit.instanced(enzymeGeo, enzymeMat, ENZYMES_DRAWN);
  const quats = ENZYME_PLACES.map((p) => {
    const q = new THREE.Quaternion().setFromUnitVectors(Y, dirV.set(...p.site).normalize());
    return q.multiply(tmpQ.setFromAxisAngle(Y, p.spin));
  });
  /** Ellipsoid squash of the blob (illustration). */
  const squash = new THREE.Vector3(1.08, 1, 0.94).multiplyScalar(L.enzymeR);
  ENZYME_PLACES.forEach((p, k) => {
    pos.set(...p.center);
    m4.compose(pos, quats[k] ?? rot, squash);
    enzymes.setMatrixAt(k, m4);
  });
  done(enzymes);

  /** A point of enzyme k at `along` (relative) in its own direction d (scene units). */
  const onEnzyme = (k: number, d: readonly number[], along: number, out: THREE.Vector3) => {
    const p = ENZYME_PLACES[k];
    out
      .set(d[0] ?? 0, d[1] ?? 0, d[2] ?? 0)
      .multiply(squash)
      .multiplyScalar(along);
    out.applyQuaternion(quats[k] ?? rot);
    if (p) out.add(centre.set(...p.center));
    return out;
  };
  const pocketPoint = (k: number, out: THREE.Vector3) => onEnzyme(k, [0, 1, 0], POCKET_AT, out);
  const otherPoint = (k: number, along: number, out: THREE.Vector3) =>
    onEnzyme(k, ALLO_DIR, along, out);

  const sphereGeo = shapeGeometry(kit, ROLES.substrate.shape);
  const diamondGeo = shapeGeometry(kit, ROLES.product.shape);
  const cubeGeo = shapeGeometry(kit, ROLES.inhibitor.shape);
  const boundS = kit.instanced(sphereGeo, subMat, ENZYMES_DRAWN);
  const boundIInSite = kit.instanced(cubeGeo, inhMat, ENZYMES_DRAWN);
  const boundIElsewhere = kit.instanced(cubeGeo, inhMat, ENZYMES_DRAWN);
  const ringGeo = kit.geometry(
    new THREE.TorusGeometry(1, 0.22, Math.max(6, Math.round(kit.seg / 3)), Math.max(12, kit.seg)),
  );
  const rings = kit.instanced(ringGeo, siteMat, ENZYMES_DRAWN);
  const ringR = 0.22 * L.enzymeR;

  // ── Free particles: the substrate/product pool and the inhibitor pool ────────────────
  const freeS = kit.instanced(sphereGeo, subMat, PARTICLE_CAP);
  const freeP = kit.instanced(diamondGeo, prodMat, PARTICLE_CAP);
  const freeI = kit.instanced(cubeGeo, inhMat, PARTICLE_CAP);

  // ── Selection halo ───────────────────────────────────────────────────────────────────
  const halo = kit.mesh(kit.sphere(), haloMat);
  halo.visible = false;
  halo.renderOrder = 3;

  let forms: EnzymeForm[] = formsOf({ E: ENZYMES_DRAWN, ES: 0, EI: 0, ESI: 0 });
  const counts = { S: 0, P: 0, I: 0 };
  let phase = 0;
  let selected: EnzymeSelection | null = null;
  /** Enzyme index of each instance of the bound sets (picking maps them back). */
  const boundSOwner = new Int16Array(ENZYMES_DRAWN);
  const inSiteOwner = new Int16Array(ENZYMES_DRAWN);
  const elsewhereOwner = new Int16Array(ENZYMES_DRAWN);
  const ringOwner = new Int16Array(ENZYMES_DRAWN);

  function placeBound(): void {
    const sS = L.particleR;
    let nS = 0;
    let nIn = 0;
    let nEl = 0;
    let nRing = 0;
    for (let k = 0; k < ENZYMES_DRAWN; k++) {
      const f = forms[k] ?? 'E';
      const q = quats[k] ?? rot;
      if (holdsSubstrate(f)) {
        pocketPoint(k, pos);
        scl.setScalar(sS);
        m4.compose(pos, q, scl);
        boundS.setMatrixAt(nS, m4);
        boundSOwner[nS++] = k;
      }
      if (f === 'EI' && kind === 'competitive') {
        pocketPoint(k, pos);
        scl.setScalar(sS);
        m4.compose(pos, q, scl);
        boundIInSite.setMatrixAt(nIn, m4);
        inSiteOwner[nIn++] = k;
      }
      const showSite = siteOnAll || (siteWithS && holdsSubstrate(f));
      if (showSite) {
        otherPoint(k, OTHER_AT, pos);
        // The ring faces out along the site's direction.
        dirV
          .set(...ALLO_DIR)
          .multiply(squash)
          .applyQuaternion(q)
          .normalize();
        tmpQ.setFromUnitVectors(Z, dirV);
        scl.setScalar(ringR);
        m4.compose(pos, tmpQ, scl);
        rings.setMatrixAt(nRing, m4);
        ringOwner[nRing++] = k;
        if (holdsInhibitor(f)) {
          otherPoint(k, OTHER_INHIBITOR_AT, pos);
          scl.setScalar(sS);
          m4.compose(pos, tmpQ, scl);
          boundIElsewhere.setMatrixAt(nEl, m4);
          elsewhereOwner[nEl++] = k;
        }
      }
    }
    boundS.count = nS;
    boundIInSite.count = nIn;
    boundIElsewhere.count = nEl;
    rings.count = hasOtherSite ? nRing : 0;
    done(boundS);
    done(boundIInSite);
    done(boundIElsewhere);
    done(rings);
  }

  /** A fixed tilt per particle (illustration): diamonds and cubes do not all line up. */
  const tiltOf = (k: number, spin: number) =>
    rot.setFromEuler(euler.set(k * 1.37 + spin * 0.3, k * 0.71 + spin * 0.45, k * 0.29));

  function placeParticles(): void {
    const r = L.particleR;
    scl.setScalar(r);
    for (let j = 0; j < counts.S; j++) {
      particleAt('sp', j, phase, a);
      pos.set(a[0], a[1], a[2]);
      m4.compose(pos, tiltOf(j, phase), scl);
      freeS.setMatrixAt(j, m4);
    }
    for (let j = 0; j < counts.P; j++) {
      const k = counts.S + j;
      particleAt('sp', k, phase, a);
      pos.set(a[0], a[1], a[2]);
      m4.compose(pos, tiltOf(k, phase), scl);
      freeP.setMatrixAt(j, m4);
    }
    for (let j = 0; j < counts.I; j++) {
      particleAt('i', j, phase, a);
      pos.set(a[0], a[1], a[2]);
      m4.compose(pos, tiltOf(j + 500, phase), scl);
      freeI.setMatrixAt(j, m4);
    }
    freeS.count = counts.S;
    freeP.count = counts.P;
    freeI.count = counts.I;
    done(freeS);
    done(freeP);
    done(freeI);
  }

  function pointOf(sel: EnzymeSelection, out: THREE.Vector3): number | null {
    if (sel.kind === 'enzyme') {
      const p = ENZYME_PLACES[sel.index];
      if (!p) return null;
      out.set(...p.center);
      return L.enzymeR * 1.45;
    }
    if (sel.pool === 'sp') {
      if (sel.index < 0 || sel.index >= counts.S + counts.P) return null;
      particleAt('sp', sel.index, phase, a);
    } else {
      if (sel.index < 0 || sel.index >= counts.I) return null;
      particleAt('i', sel.index, phase, a);
    }
    out.set(a[0], a[1], a[2]);
    return L.particleR * 2.1;
  }

  const haloAt = new THREE.Vector3();
  function placeHalo(): void {
    const r = selected ? pointOf(selected, haloAt) : null;
    halo.visible = r !== null;
    if (r === null) return;
    halo.position.copy(haloAt);
    halo.scale.setScalar(r);
  }

  function setFrame(frame: EnzymeFrame): void {
    forms = formsOf(frame.counts, forms);
    counts.S = Math.min(PARTICLE_CAP, frame.particles.S);
    counts.P = Math.min(PARTICLE_CAP - counts.S, frame.particles.P);
    counts.I = kind === 'none' ? 0 : Math.min(PARTICLE_CAP, frame.particles.I);
    placeBound();
    placeParticles();
    placeHalo();
  }

  // ── Picking ──────────────────────────────────────────────────────────────────────────
  const pickables: THREE.Object3D[] = [
    enzymes,
    boundS,
    boundIInSite,
    boundIElsewhere,
    rings,
    freeS,
    freeP,
    freeI,
  ];
  function pick(ray: THREE.Raycaster): EnzymeSelection | null {
    const hit = pickFirst(ray, pickables);
    if (!hit) return null;
    const obj = hit.object;
    const id = hit.instanceId ?? -1;
    if (id < 0) return null;
    const enzyme = (index: number | undefined): EnzymeSelection | null =>
      index === undefined || index < 0 ? null : { kind: 'enzyme', index };
    if (obj === enzymes) return enzyme(id < ENZYMES_DRAWN ? id : undefined);
    if (obj === boundS) return enzyme(id < boundS.count ? boundSOwner[id] : undefined);
    if (obj === boundIInSite) return enzyme(id < boundIInSite.count ? inSiteOwner[id] : undefined);
    if (obj === boundIElsewhere)
      return enzyme(id < boundIElsewhere.count ? elsewhereOwner[id] : undefined);
    if (obj === rings) return enzyme(id < rings.count ? ringOwner[id] : undefined);
    if (obj === freeS) return id < counts.S ? { kind: 'particle', pool: 'sp', index: id } : null;
    if (obj === freeP)
      return id < counts.P ? { kind: 'particle', pool: 'sp', index: counts.S + id } : null;
    if (obj === freeI) return id < counts.I ? { kind: 'particle', pool: 'i', index: id } : null;
    return null;
  }

  // ── Names and tags ───────────────────────────────────────────────────────────────────
  const v3 = new THREE.Vector3();
  const vec = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];
  function labelAnchors(): EnzymeLabelAnchor[] {
    const out: EnzymeLabelAnchor[] = [];
    const firstOf = (want: (f: EnzymeForm) => boolean) => forms.findIndex(want);
    const es = firstOf((f) => f === 'ES');
    if (es >= 0) out.push({ id: 'complex', point: vec(onEnzyme(es, [0, -1, 0], 0.9, v3)) });
    if (counts.S > 0) {
      particleAt('sp', 0, phase, a);
      out.push({ id: 'substrate', point: [a[0], a[1] - L.particleR, a[2]] });
    }
    if (counts.P > 0) {
      particleAt('sp', counts.S, phase, a);
      out.push({ id: 'product', point: [a[0], a[1] - L.particleR, a[2]] });
    }
    if (counts.I > 0) {
      particleAt('i', 0, phase, a);
      out.push({ id: 'inhibitor', point: [a[0], a[1] - L.particleR, a[2]] });
    }
    const free = firstOf((f) => f === 'E');
    if (free >= 0) {
      out.push({ id: 'activeSite', point: vec(onEnzyme(free, [0, 1, 0], 0.75, v3)) });
      out.push({ id: 'enzyme', point: vec(onEnzyme(free, [1, 0, 0], 0.95, v3)) });
    }
    if (hasOtherSite) {
      const withSite = siteOnAll ? 0 : firstOf(holdsSubstrate);
      if (withSite >= 0)
        out.push({ id: 'otherSite', point: vec(otherPoint(withSite, OTHER_AT, v3)) });
    }
    out.push({ id: 'volume', point: [-L.hx, L.hy, L.hz] });
    return out;
  }

  function tags(layer: TagLayer, name: (f: EnzymeForm) => string): void {
    for (let k = 0; k < ENZYMES_DRAWN; k++) {
      const p = ENZYME_PLACES[k];
      if (!p) continue;
      const text = name(forms[k] ?? 'E');
      layer.add(
        text,
        p.center[0],
        p.center[1] + L.enzymeR * 1.25,
        p.center[2],
        'word',
        text.length,
      );
    }
  }

  setFrame({
    x: 0,
    t: null,
    S: 0,
    P: 0,
    v: 0,
    species: { E: 1, ES: 0, EI: 0, ESI: 0 },
    counts: { E: ENZYMES_DRAWN, ES: 0, EI: 0, ESI: 0 },
    particles: { S: 0, P: 0, I: 0 },
  });

  return {
    kit,
    scene,
    setFrame,
    setPhase(next) {
      if (next === phase) return;
      phase = next;
      placeParticles();
      placeHalo();
    },
    setSelection(sel) {
      selected = sel;
      placeHalo();
    },
    pick,
    focusPoint(sel) {
      const out = new THREE.Vector3();
      return pointOf(sel, out) === null ? null : [out.x, out.y, out.z];
    },
    forms: () => forms,
    labelAnchors,
    tags,
    drawn: () => ({
      forms: [...forms],
      boundSubstrate: boundS.visible ? boundS.count : 0,
      inhibitorInSite: boundIInSite.visible ? boundIInSite.count : 0,
      inhibitorElsewhere: boundIElsewhere.visible ? boundIElsewhere.count : 0,
      otherSites: rings.visible ? rings.count : 0,
      particles: {
        S: freeS.visible ? freeS.count : 0,
        P: freeP.visible ? freeP.count : 0,
        I: freeI.visible ? freeI.count : 0,
      },
    }),
    drawStats: () => drawStats(scene),
    dispose: () => {
      kit.dispose();
    },
  };
}
