/**
 * The three.js scene of "Động học enzyme" in 3D: a glass tank (walls with a visible thickness)
 * filled with a faintly tinted liquid on a muted base, holding the representative enzymes —
 * lumpy protein blobs in three seeded shapes, each with an active-site pocket (a lock-and-key
 * cartoon) and, for non- and uncompetitive inhibition, a second binding site on its side — the
 * substrate held in the pocket of ES and ESI complexes, the inhibitor in the pocket (competitive
 * EI) or at the second site (EI, ESI), a thin ring in the role's colour around each occupied
 * site, and the free substrate, product and inhibitor particles.
 *
 * Which enzyme is in which form and how many particles show come from the model (`binding.ts`,
 * `setFrame`); shapes, places, the liquid, the particles' drift and a new product's way out of
 * a pocket are illustration (`layout.ts`). Roles keep the palette's colour and shape cue
 * (substrate sphere, product diamond, inhibitor cube). `setFrame` and `setPhase` allocate
 * nothing; one SceneKit owns every geometry and material.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { QualityTier } from '@/perf/tiers';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { roundedBox, solid } from '@/ui/three/materials';
import { withEdgeShade, withRelief } from '@/ui/three/relief';
import { pickFirst } from '@/ui/three/pick';
import type { TagLayer } from '@/ui/three/tagLayer';
import { NEUTRAL, SceneKit } from '../../view3d/kit';
import { fbm3 } from '../../view3d/noise';
import { ROLES, structureColor } from '../../view3d/palette';
import { shapeGeometry } from '../../view3d/primitives/classShape';
import {
  glassMeshes,
  glassware,
  highlightIntensity,
  liquidBody,
  liquidBodyGeometry,
  liquidSurface,
  particleMaterial,
  roundedPlane,
  shellLook,
} from '../../view3d/recipes';
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
  /** The picked enzyme's outline glows and blooms (High tier on a discrete GPU). */
  hdr?: boolean;
  /** The base gets shadow maps (High tier on a discrete GPU). */
  shadows?: boolean;
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
  /**
   * Shows a moment of the model (enzyme forms, particles); no allocation. `ease`: products new
   * since the last frame come out of the pocket of an ES complex (never ESI) over the next
   * moments of `setPhase` (illustration, only while the lesson plays).
   */
  setFrame(frame: EnzymeFrame, ease?: boolean): void;
  /** Illustrative drift of the free particles (phase in seconds of animation); no allocation. */
  setPhase(phase: number): void;
  setSelection(sel: EnzymeSelection | null): void;
  pick(ray: THREE.Raycaster): EnzymeSelection | null;
  /** Where a picked thing is now (camera focus, tests), or null when it is not shown. */
  focusPoint(sel: EnzymeSelection): Vec3 | null;
  /** The form of each drawn enzyme now. */
  forms(): readonly EnzymeForm[];
  labelAnchors(): EnzymeLabelAnchor[];
  /** The picked enzyme's form over it ("ES", "EI"…; `name` gives the short names). */
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
export const ENZYME_RELIEF = { amplitude: 0.07, frequency: 2.6, seed: 23, valley: 0.55 } as const;

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

/** Seeds of the three enzyme shapes (enzyme k takes shape k mod 3; illustration). */
export const ENZYME_SEEDS = [ENZYME_RELIEF.seed, 61, 97] as const;

/**
 * The enzyme blob (unit size; seams merged so it shades smoothly; hollows shaded darker); `seed`
 * picks the fine lumps (never in the pocket or at the second site).
 */
export function enzymeGeometry(
  segments: number,
  otherSite: boolean,
  seed: number = ENZYME_RELIEF.seed,
): THREE.BufferGeometry {
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
      fbm3(v.x * f + 3.1, v.y * f - 1.7, v.z * f + 5.3, seed) *
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

/** How long (s of animation) a new product takes to leave its pocket (illustration). */
export const PRODUCT_EASE_S = 0.8;
/** The tank: glass outside / inside the liquid, liquid level above the volume (scene units). */
const TANK = { outer: 0.44, inner: 0.32, liquid: 0.28, headroom: 0.16 } as const;

/** Ease-out (cubic) on 0 … 1. */
const easeOut = (u: number) => {
  const x = Math.max(0, Math.min(1, u));
  return 1 - (1 - x) ** 3;
};

export function buildEnzymeScene(o: EnzymeSceneOptions): EnzymeScene {
  const kit = new SceneKit({
    tier: o.tier,
    segments: o.segments,
    maxParticles: PARTICLE_CAP,
    token: o.token,
    // No refraction on any tier: the enzymes and particles behind the glass are data and keep
    // their exact colours.
    hdr: o.hdr ?? false,
    shadows: o.shadows ?? false,
  });
  const { scene } = kit;
  const kind = o.kind;
  /** Non-competitive: every enzyme has the second site; uncompetitive: only with substrate. */
  const siteOnAll = kind === 'noncompetitive';
  const siteWithS = kind === 'uncompetitive';
  const hasOtherSite = siteOnAll || siteWithS;
  const tok = (name: string) => kit.color(name);

  // ── Scratch (no allocation in setFrame / setPhase) ───────────────────────────────────
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const from = new THREE.Vector3();
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
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.boundingSphere = null;
    mesh.visible = mesh.count > 0;
  };
  // ── Materials (theme tokens; the palette's roles) ────────────────────────────────────
  // Its own material, the kit's protein look: the blob's vertex shade darkens the pocket and the
  // valleys, the silhouette darkens softly (--m3d-edge-shade) so each blob reads as a volume,
  // fine grain catches the light (illustration). The role colour stays the albedo.
  const enzymeColor = tok(ROLES.enzyme.token);
  const edgeShade = parseFloat(tok('--m3d-edge-shade'));
  const enzymeMat = kit.own(
    withEdgeShade(
      withRelief(solid(enzymeColor, o.tier, { roughness: 0.62, sheen: 0.35, clearcoat: 0.1 }), {
        frequency: 8,
        height: 0.03,
      }),
      { strength: Number.isFinite(edgeShade) ? edgeShade : 0, power: 1.8 },
    ),
  );
  enzymeMat.vertexColors = true;
  const subMat = particleMaterial(kit, 'substrate');
  const prodMat = particleMaterial(kit, 'product');
  const inhMat = particleMaterial(kit, 'inhibitor');
  // Site rings carry their colour per instance: muted for an empty second site, the role's
  // token for an occupied site (substrate or inhibitor).
  const ringMat = kit.solid(NEUTRAL, { roughness: 0.42, clearcoat: 0.3 });
  const mutedRing = new THREE.Color(tok('--text-muted'));
  const substrateRing = new THREE.Color(tok(ROLES.substrate.token));
  const inhibitorRing = new THREE.Color(tok(ROLES.inhibitor.token));
  const haloMat = kit.glass(tok('--accent'), {
    opacity: 0.08,
    rim: { color: tok('--accent'), alpha: 0.95, strength: 1, power: 1.6 },
  });
  // The picked enzyme: a glowing outline behind it (HDR on High: brighter than white, so the
  // bloom picks it up — and only it).
  const hullMat = kit.own(
    new THREE.MeshBasicMaterial({
      color: tok('--m3d-highlight'),
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  hullMat.color.multiplyScalar(highlightIntensity(kit));
  hullMat.userData.bloom = kit.hdr;
  const baseMat = kit.solid(tok('--border-strong'), { roughness: 0.6, clearcoat: 0.2 });
  const liquidMat = liquidBody(kit);
  const surfaceMat = liquidSurface(kit);

  // ── The tank: muted base, glass walls with a thickness, the liquid and its surface ─────
  const tankSegments = Math.round(kit.seg * 1.5);
  const wall = kit.shared('enzyme-tank-wall', () => roundedBox(tankSegments, 14));
  // The far walls' faint back faces (one more see-through layer over the whole tank) on High
  // only; the liquid and the near walls' rim still show the box.
  const outer = glassMeshes(kit, glassware(kit), wall, 4, kit.tier === 'high');
  for (const m of outer) m.scale.set(L.hx + TANK.outer, L.hy + TANK.outer, L.hz + TANK.outer);
  // The wall's inner face: a second faint rim inside the first, so the glass reads thick (High
  // only: one more see-through layer over the whole tank costs software and integrated GPUs).
  const glassColor = structureColor(tok, 'glass');
  const innerLook =
    kit.tier === 'high'
      ? shellLook(kit, glassColor, { radius: 1, opacity: 0.025, rim: 0.5 })
      : null;
  const inner = innerLook?.front ? kit.mesh(wall, innerLook.front) : null;
  if (inner) {
    inner.scale.set(L.hx + TANK.inner, L.hy + TANK.inner, L.hz + TANK.inner);
    inner.renderOrder = 6;
    inner.raycast = () => undefined;
  }
  const liquidTop = L.hy + TANK.headroom;
  const liquidBottom = -L.hy - TANK.liquid;
  const liquid = kit.mesh(kit.geometry(liquidBodyGeometry(tankSegments)), liquidMat);
  liquid.scale.set(L.hx + TANK.liquid, (liquidTop - liquidBottom) / 2, L.hz + TANK.liquid);
  liquid.position.y = (liquidTop + liquidBottom) / 2;
  liquid.renderOrder = 4;
  liquid.raycast = () => undefined;
  const surface = kit.mesh(
    kit.geometry(roundedPlane(L.hx + TANK.liquid - 0.04, L.hz + TANK.liquid - 0.04, 0.5, 4)),
    surfaceMat,
  );
  surface.position.y = liquidTop - 0.02;
  surface.renderOrder = 5;
  surface.raycast = () => undefined;
  const baseTop = -L.hy - TANK.outer;
  const base = kit.mesh(kit.roundedBox(6), baseMat);
  base.scale.set(L.hx + TANK.outer + 0.5, 0.2, L.hz + TANK.outer + 0.5);
  base.position.y = baseTop - 0.2;
  kit.shadow(baseTop - 0.42, L.hx + 1.6, L.hz + 1.6, 0.24);

  // ── Enzymes: three seeded shapes, one instanced set each ──────────────────────────────
  const enzymeGeos = ENZYME_SEEDS.map((seed) =>
    kit.geometry(enzymeGeometry(kit.seg, siteOnAll, seed)),
  );
  /** Shape of enzyme k, and its instance in that shape's set. */
  const variantOf = (k: number) => k % ENZYME_SEEDS.length;
  const slotOf = (k: number) => Math.floor(k / ENZYME_SEEDS.length);
  const enzymes = enzymeGeos.map((g, v) => {
    let n = 0;
    for (let k = 0; k < ENZYMES_DRAWN; k++) if (variantOf(k) === v) n++;
    return kit.instanced(g, enzymeMat, n);
  });
  const quats = ENZYME_PLACES.map((p) => {
    const q = new THREE.Quaternion().setFromUnitVectors(Y, dirV.set(...p.site).normalize());
    return q.multiply(tmpQ.setFromAxisAngle(Y, p.spin));
  });
  /** Ellipsoid squash of the blob (illustration). */
  const squash = new THREE.Vector3(1.08, 1, 0.94).multiplyScalar(L.enzymeR);
  ENZYME_PLACES.forEach((p, k) => {
    pos.set(...p.center);
    m4.compose(pos, quats[k] ?? rot, squash);
    enzymes[variantOf(k)]?.setMatrixAt(slotOf(k), m4);
  });
  for (const m of enzymes) done(m);

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
  const rings = kit.instanced(ringGeo, ringMat, ENZYMES_DRAWN);
  const ringR = 0.22 * L.enzymeR;
  // The thin ring around an occupied active-site pocket (its lip), in the ligand's role colour.
  const lipGeo = kit.geometry(
    new THREE.TorusGeometry(1, 0.07, Math.max(5, Math.round(kit.seg / 4)), Math.max(16, kit.seg)),
  );
  const lips = kit.instanced(lipGeo, ringMat, ENZYMES_DRAWN);
  const lipR = Math.sin(L.notchHalf) * L.enzymeR * 1.03;
  const lipAt = Math.cos(L.notchHalf) * 1.01;
  /** Turns a torus (normal z) so that its normal is the enzyme's own y (the site's axis). */
  const lipTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

  // ── Free particles: the substrate/product pool and the inhibitor pool ────────────────
  const freeS = kit.instanced(sphereGeo, subMat, PARTICLE_CAP);
  const freeP = kit.instanced(diamondGeo, prodMat, PARTICLE_CAP);
  const freeI = kit.instanced(cubeGeo, inhMat, PARTICLE_CAP);

  // ── Selection: an outline glow on an enzyme, a halo on a particle ──────────────────────
  const halo = kit.mesh(kit.sphere(), haloMat);
  halo.visible = false;
  halo.renderOrder = 8;
  halo.raycast = () => undefined;
  const hull = kit.mesh(enzymeGeos[0] ?? kit.sphere(), hullMat);
  hull.visible = false;
  hull.matrixAutoUpdate = false;
  hull.renderOrder = 1;
  hull.raycast = () => undefined;

  // ── Shadow maps (High on a discrete GPU): enzymes and particles onto the base ──────────
  const shadowed = kit.groundShadows(
    [0, baseTop, 0],
    Math.hypot(L.hx + TANK.outer, L.hy + TANK.outer, L.hz + TANK.outer) + 0.5,
  );
  if (shadowed) {
    base.receiveShadow = true;
    for (const m of [...enzymes, boundS, boundIInSite, boundIElsewhere, freeS, freeP, freeI])
      m.castShadow = true;
  }

  let forms: EnzymeForm[] = formsOf({ E: ENZYMES_DRAWN, ES: 0, EI: 0, ESI: 0 });
  const counts = { S: 0, P: 0, I: 0 };
  let phase = 0;
  let selected: EnzymeSelection | null = null;
  /** Enzyme index of each instance of the bound sets (picking maps them back). */
  const boundSOwner = new Int16Array(ENZYMES_DRAWN);
  const inSiteOwner = new Int16Array(ENZYMES_DRAWN);
  const elsewhereOwner = new Int16Array(ENZYMES_DRAWN);
  const ringOwner = new Int16Array(ENZYMES_DRAWN);
  const lipOwner = new Int16Array(ENZYMES_DRAWN);
  /** Per place of the substrate/product pool: when it became a product, and from which enzyme. */
  const bornAt = new Float32Array(PARTICLE_CAP).fill(-1e9);
  const bornFrom = new Int16Array(PARTICLE_CAP).fill(-1);
  let nextSource = 0;

  function placeBound(): void {
    const sS = L.particleR;
    let nS = 0;
    let nIn = 0;
    let nEl = 0;
    let nRing = 0;
    let nLip = 0;
    for (let k = 0; k < ENZYMES_DRAWN; k++) {
      const f = forms[k] ?? 'E';
      const q = quats[k] ?? rot;
      const competitiveI = f === 'EI' && kind === 'competitive';
      if (holdsSubstrate(f)) {
        pocketPoint(k, pos);
        scl.setScalar(sS);
        m4.compose(pos, q, scl);
        boundS.setMatrixAt(nS, m4);
        boundSOwner[nS++] = k;
      }
      if (competitiveI) {
        pocketPoint(k, pos);
        scl.setScalar(sS);
        m4.compose(pos, q, scl);
        boundIInSite.setMatrixAt(nIn, m4);
        inSiteOwner[nIn++] = k;
      }
      if (holdsSubstrate(f) || competitiveI) {
        onEnzyme(k, [0, 1, 0], lipAt, pos);
        tmpQ.copy(q).multiply(lipTurn);
        scl.setScalar(lipR);
        m4.compose(pos, tmpQ, scl);
        lips.setMatrixAt(nLip, m4);
        lips.setColorAt(nLip, competitiveI ? inhibitorRing : substrateRing);
        lipOwner[nLip++] = k;
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
        rings.setColorAt(nRing, holdsInhibitor(f) ? inhibitorRing : mutedRing);
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
    lips.count = nLip;
    done(boundS);
    done(boundIInSite);
    done(boundIElsewhere);
    done(rings);
    done(lips);
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
      // A new product leaves the pocket it was made in (illustration).
      const u = (phase - (bornAt[k] ?? -1e9)) / PRODUCT_EASE_S;
      const src = bornFrom[k] ?? -1;
      if (u >= 0 && u < 1 && src >= 0) {
        pocketPoint(src, from);
        pos.lerpVectors(from, pos, easeOut(u));
      }
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
  function placeSelection(): void {
    const enzyme = selected?.kind === 'enzyme' ? selected.index : -1;
    const place = ENZYME_PLACES[enzyme];
    hull.visible = !!place;
    if (place) {
      hull.geometry = enzymeGeos[variantOf(enzyme)] ?? hull.geometry;
      pos.set(...place.center);
      scl.copy(squash).multiplyScalar(1.12);
      hull.matrix.compose(pos, quats[enzyme] ?? rot, scl);
      hull.matrixWorldNeedsUpdate = true;
    }
    const r = selected && !place ? pointOf(selected, haloAt) : null;
    halo.visible = r !== null;
    if (r === null) return;
    halo.position.copy(haloAt);
    halo.scale.setScalar(r);
  }

  function setFrame(frame: EnzymeFrame, ease = false): void {
    forms = formsOf(frame.counts, forms);
    const s = Math.min(PARTICLE_CAP, frame.particles.S);
    const p = Math.min(PARTICLE_CAP - s, frame.particles.P);
    if (!ease) bornAt.fill(-1e9);
    else if (p > counts.P && s + p === counts.S + counts.P) {
      // The places that just turned from substrate to product: each comes out of the pocket of
      // an ES complex (round robin; none → it simply appears in place). Only ES makes product
      // (v = kcat·[ES]): an ESI complex holds substrate but never releases a product.
      for (let k = s; k < counts.S; k++) {
        let src = -1;
        for (let n = 0; n < ENZYMES_DRAWN; n++) {
          const e = (nextSource + n) % ENZYMES_DRAWN;
          if (forms[e] === 'ES') {
            src = e;
            nextSource = e + 1;
            break;
          }
        }
        bornAt[k] = phase;
        bornFrom[k] = src;
      }
    }
    counts.S = s;
    counts.P = p;
    counts.I = kind === 'none' ? 0 : Math.min(PARTICLE_CAP, frame.particles.I);
    placeBound();
    placeParticles();
    placeSelection();
  }

  // ── Picking ──────────────────────────────────────────────────────────────────────────
  const pickables: THREE.Object3D[] = [
    ...enzymes,
    boundS,
    boundIInSite,
    boundIElsewhere,
    rings,
    lips,
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
    const v = enzymes.indexOf(obj as THREE.InstancedMesh);
    if (v >= 0) {
      const k = id * ENZYME_SEEDS.length + v;
      return enzyme(k < ENZYMES_DRAWN ? k : undefined);
    }
    if (obj === boundS) return enzyme(id < boundS.count ? boundSOwner[id] : undefined);
    if (obj === boundIInSite) return enzyme(id < boundIInSite.count ? inSiteOwner[id] : undefined);
    if (obj === boundIElsewhere)
      return enzyme(id < boundIElsewhere.count ? elsewhereOwner[id] : undefined);
    if (obj === rings) return enzyme(id < rings.count ? ringOwner[id] : undefined);
    if (obj === lips) return enzyme(id < lips.count ? lipOwner[id] : undefined);
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
    out.push({ id: 'volume', point: [-L.hx - TANK.outer, L.hy, L.hz + TANK.outer] });
    return out;
  }

  function tags(layer: TagLayer, name: (f: EnzymeForm) => string): void {
    // Only the picked enzyme says its form: the counts chip and the legend give the rest.
    if (selected?.kind !== 'enzyme') return;
    const k = selected.index;
    const p = ENZYME_PLACES[k];
    if (!p) return;
    const text = name(forms[k] ?? 'E');
    layer.add(text, p.center[0], p.center[1] + L.enzymeR * 1.35, p.center[2], 'word', text.length);
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
