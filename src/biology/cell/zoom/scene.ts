/**
 * The 3D pictures of "Từ tế bào đến DNA", one scene per level (only the level on screen exists:
 * a new level is a new scene, and the old one is freed). Each level is laid out in its own unit,
 * `levelInfo().unitNm` (the picture is about 10 units wide), from the sizes of `levels.ts`, so
 * the key size of each level and its scale bar are to scale; everything else is illustration
 * (captions in `card.ts`). Reuses the biology kit's shells, proteins, chromosome tube and the DNA
 * helix recipe of "ADN → mARN → Protein". Static: nothing moves, nothing is allocated per frame.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DEFAULT_VIEW } from '@/ui/three/frame';
import { RADIUS, RISE, TWIST } from '../../central/dogma3d/bdna';
import {
  Writer,
  baseWidth,
  helixShapes,
  readDogmaPalette,
  rungs,
  strandMesh,
} from '../../central/dogma3d/helix';
import type { Bio3DScene, SceneFrame, SceneKit, Vec3 } from '../../view3d/kit';
import { muted, structureColor } from '../../view3d/palette';
import { ChromosomeTube, rodRadius } from '../../view3d/primitives/chromosomeTube';
import {
  annotation,
  chromosome,
  highlight,
  membrane,
  proteinGeometry,
  proteinMaterial,
} from '../../view3d/recipes';
import {
  COMPLEMENT,
  CORE_RADIUS_NM,
  DRAWN,
  HELIX_LENGTH_NM,
  LEVEL_PARTS,
  SIZE,
  WRAP_PITCH_NM,
  WRAP_RADIUS_NM,
  baseAt,
  levelInfo,
  zoomSpot,
  type LevelInfo,
  type ZoomLevel,
  type ZoomPart,
} from './levels';

export interface ZoomSceneOptions {
  level: number;
  /** The scale bar's text ("5 µm", localized). */
  barText: string;
  /** Part names to write ("Hiện tên"), or null: none. */
  names: Readonly<Partial<Record<ZoomPart, string>>> | null;
}

/** The framing that zooms into level `index`'s spot (unique per level, see `ZoomView`). */
export const zoomFrame = (index: number): string => `zoom-${String(index)}`;

/** A small seeded generator (positions of illustrative parts never change between builds). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const token = (kit: SceneKit) => (name: string) => kit.color(name);

/** What a level's builder hands back: the subject's bounds and the anchors of its names. */
interface Built {
  center: Vec3;
  radius: number;
  /** Lowest y of the subject (the scale bar goes under it). */
  bottom: number;
  anchors: Partial<Record<ZoomPart, Vec3>>;
}

/** A ruler exactly `barNm` long (to scale), with end ticks; its text is a page label. */
function scaleBar(kit: SceneKit, info: LevelInfo, y: number, text: string): number {
  const len = info.barNm / info.unitNm;
  const r = 0.035;
  const x0 = -len / 2;
  const mat = annotation(kit);
  const rod = kit.cylinder(8);
  const bar = kit.mesh(rod, mat);
  bar.rotation.z = Math.PI / 2;
  bar.scale.set(r, len, r);
  bar.position.set(0, y, 0);
  for (const x of [x0, x0 + len]) {
    const tick = kit.mesh(rod, mat);
    tick.scale.set(r, 0.3, r);
    tick.position.set(x, y, 0);
  }
  kit.label(text, [0, y - 0.35, 0], 'strong');
  return len;
}

/** The ring around the spot the next level enlarges (the one highlight of the picture). */
function spotRing(kit: SceneKit, center: Vec3, radius: number): void {
  const geo = kit.geometry(new THREE.TorusGeometry(1, 0.035, 8, 64));
  const mat = highlight(kit, kit.own(new THREE.MeshStandardMaterial({ roughness: 0.5 })));
  mat.color.set(kit.color('--m3d-highlight'));
  const ring = kit.mesh(geo, mat);
  ring.position.set(...center);
  ring.scale.setScalar(radius);
  ring.lookAt(
    center[0] + DEFAULT_VIEW[0],
    center[1] + DEFAULT_VIEW[1],
    center[2] + DEFAULT_VIEW[2],
  );
}

/** One merged tube geometry through several smooth paths (one draw call). */
function tubes(
  kit: SceneKit,
  paths: readonly (readonly Vec3[])[],
  radius: number,
  closed = false,
): THREE.BufferGeometry {
  const radial = kit.tier === 'high' ? 10 : kit.tier === 'medium' ? 8 : 6;
  const parts = paths.map((pts) => {
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(...p)),
      closed,
      'centripetal',
    );
    return new THREE.TubeGeometry(curve, Math.max(8, pts.length * 4), radius, radial, closed);
  });
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  return kit.geometry(merged);
}

// ── Level 1: the cell ─────────────────────────────────────────────────────────────────────────

function buildCell(kit: SceneKit, u: number): Built {
  const tok = token(kit);
  const R = DRAWN.cellNm / 2 / u;
  const rn = SIZE.nucleusNm / 2 / u;
  const cell = membrane(kit, kit.sphere(2), { radius: R, outermost: true });
  cell.scale.setScalar(R);
  const nucleus = kit.mesh(
    kit.sphere(2),
    kit.solid(structureColor(tok, 'nucleus'), { sheen: 0.4 }),
  );
  nucleus.scale.setScalar(rn);
  // Mitochondria: a few capsules around the nucleus (illustration: number, size, place).
  const rand = seeded(7);
  const n = 9;
  const mito = kit.instanced(kit.capsule(0.22, 0.9), kit.solid(muted(tok, '--chart-3')), n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let first: Vec3 = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.4;
    const dist = rn + 1.1 + rand() * (R - rn - 2.2);
    p.set(Math.cos(a) * dist, (rand() - 0.5) * 3, Math.sin(a) * dist);
    if (i === 0) first = [p.x, p.y + 0.4, p.z];
    q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3));
    mito.setMatrixAt(i, m.compose(p, q, one));
  }
  mito.instanceMatrix.needsUpdate = true;
  return {
    center: [0, 0, 0],
    radius: R,
    bottom: -R,
    anchors: { membrane: [0, R, 0], nucleus: [0, rn, 0], mitochondrion: first },
  };
}

// ── Level 2: the nucleus ──────────────────────────────────────────────────────────────────────

function buildNucleus(kit: SceneKit, u: number): Built {
  const tok = token(kit);
  const R = SIZE.nucleusNm / 2 / u;
  const env = membrane(kit, kit.sphere(2), {
    radius: R,
    outermost: true,
    color: structureColor(tok, 'nucleus'),
  });
  env.scale.setScalar(R);
  // Pores: rings on the envelope (illustration: number and size).
  const pores = 36;
  const ring = kit.geometry(new THREE.TorusGeometry(0.22, 0.06, 6, 16));
  const poreMesh = kit.instanced(
    ring,
    kit.solid(muted(tok, '--chart-6'), { roughness: 0.6 }),
    pores,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const z = new THREE.Vector3(0, 0, 1);
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const golden = Math.PI * (3 - Math.sqrt(5));
  let porePoint: Vec3 = [0, R, 0];
  for (let i = 0; i < pores; i++) {
    const y = 1 - (2 * (i + 0.5)) / pores;
    const r = Math.sqrt(1 - y * y);
    p.set(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r);
    q.setFromUnitVectors(z, p);
    p.multiplyScalar(R);
    if (i === 3) porePoint = [p.x, p.y, p.z];
    poreMesh.setMatrixAt(i, m.compose(p, q, one));
  }
  poreMesh.instanceMatrix.needsUpdate = true;
  // Nucleolus and chromatin threads (illustration: size, path, thickness).
  const nucleolusAt: Vec3 = [-1.6, 1.1, -0.6];
  const nucleolus = kit.mesh(kit.sphere(2), kit.solid(muted(tok, '--chart-4'), { sheen: 0.5 }));
  nucleolus.scale.setScalar(1.15);
  nucleolus.position.set(...nucleolusAt);
  const rand = seeded(11);
  const paths: Vec3[][] = [];
  for (let k = 0; k < 7; k++) {
    const path: Vec3[] = [];
    const c = new THREE.Vector3((rand() - 0.5) * 4, (rand() - 0.5) * 4, (rand() - 0.5) * 4);
    for (let i = 0; i < 14; i++) {
      c.add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.6));
      if (c.length() > R * 0.82) c.multiplyScalar((R * 0.78) / c.length());
      path.push([c.x, c.y, c.z]);
    }
    paths.push(path);
  }
  kit.mesh(tubes(kit, paths, 0.07), chromosome(kit, structureColor(tok, 'nucleus')));
  const spot = zoomSpot('nucleus');
  const chromatinAt: Vec3 = spot
    ? [spot.center[0] / u, spot.center[1] / u, spot.center[2] / u]
    : [0, 0, 0];
  return {
    center: [0, 0, 0],
    radius: R,
    bottom: -R,
    anchors: {
      envelope: [R * 0.7, R * 0.7, 0],
      pore: porePoint,
      nucleolus: [nucleolusAt[0], nucleolusAt[1] + 1.15, nucleolusAt[2]],
      chromatin: chromatinAt,
    },
  };
}

// ── Level 3: the metaphase chromosome ─────────────────────────────────────────────────────────

function buildChromosome(kit: SceneKit, u: number): Built {
  const tok = token(kit);
  const armA = DRAWN.armNm[0] / u;
  const armB = DRAWN.armNm[1] / u;
  const radius = SIZE.chromatidNm / 2 / u;
  const mat = chromosome(kit, structureColor(tok, 'nucleus'));
  for (const side of [-1, 1]) {
    const tube = kit.keep(
      new ChromosomeTube({ armA, armB, radius, sides: Math.max(12, kit.seg), ringsPerUnit: 4 }),
    );
    const rings = tube.rings;
    const centre = new Float32Array(rings * 3);
    const radii = new Float32Array(rings);
    for (let i = 0; i < rings; i++) {
      const s = tube.stations[i] ?? 0;
      // Sisters touch at the centromere and part slightly towards the tips (H 7.2's X).
      centre[i * 3] = side * (radius * 0.92 + Math.abs(s) * 0.05);
      centre[i * 3 + 1] = s;
      centre[i * 3 + 2] = 0;
      radii[i] = rodRadius(s, armA, armB, radius);
    }
    tube.write(centre, radii);
    kit.mesh(tube.geometry, mat).frustumCulled = false;
  }
  return {
    center: [0, (armB - armA) / 2, 0],
    radius: (armA + armB) / 2 + radius,
    bottom: -armA,
    anchors: { chromatid: [-radius * 1.9, armB * 0.7, 0], centromere: [radius * 0.6, 0, 0] },
  };
}

// ── Level 4: loops of the 10 nm fibre on the scaffold ─────────────────────────────────────────

function buildFibre(kit: SceneKit, u: number): Built {
  const tok = token(kit);
  const R = SIZE.chromatidNm / 2 / u;
  const r = SIZE.fibreNm / 2 / u;
  const core = 0.3;
  const ringGap = 2.2;
  const paths: Vec3[][] = [];
  const n = DRAWN.loopsPerRing;
  for (let k = 0; k < DRAWN.loopRings; k++) {
    const y0 = (k - (DRAWN.loopRings - 1) / 2) * ringGap;
    for (let j = 0; j < n; j++) {
      const phi = ((j + (k % 2) * 0.5) / n) * Math.PI * 2;
      const path: Vec3[] = [];
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // Out along one side of the petal and back along the other (a loop from the scaffold).
        const reach = core + (R - core - r) * Math.sin(Math.PI * t);
        const a = phi + 0.11 * Math.sin(2 * Math.PI * t);
        path.push([
          Math.cos(a) * reach,
          y0 + 0.35 * Math.sin(2 * Math.PI * t + j),
          Math.sin(a) * reach,
        ]);
      }
      paths.push(path);
    }
  }
  kit.mesh(tubes(kit, paths, r), chromosome(kit, structureColor(tok, 'nucleus')));
  const height = (DRAWN.loopRings - 1) * ringGap + 1.6;
  const scaffold = kit.mesh(
    kit.cylinder(),
    kit.solid(structureColor(tok, 'protein'), { roughness: 0.6 }),
  );
  scaffold.scale.set(core, height, core);
  // The chromatid's width (700 nm): a faint see-through cylinder around the loops.
  const outline = membrane(kit, kit.cylinder(Math.max(16, kit.seg), true), {
    radius: R,
    opacity: 0.12,
  });
  outline.scale.set(R, height, R);
  return {
    center: [0, 0, 0],
    radius: Math.hypot(R, height / 2),
    bottom: -height / 2,
    anchors: { fibre: [-R * 0.75, ringGap * 0.2, R * 0.3], scaffold: [0, height / 2, 0] },
  };
}

// ── Level 5: nucleosomes ──────────────────────────────────────────────────────────────────────

function buildNucleosomes(kit: SceneKit, u: number): Built {
  const tok = token(kit);
  const step = SIZE.fibreNm + DRAWN.linkerNm;
  const nn = DRAWN.nucleosomes;
  const turns = DRAWN.wrapTurns;
  const height = turns * WRAP_PITCH_NM;
  const centres = Array.from({ length: nn }, (_, k) => (k - (nn - 1) / 2) * step);
  // Histone core: eight lumps in two layers (illustration: where each sits).
  const blob = proteinGeometry(kit, 5);
  const hist = kit.instanced(blob, proteinMaterial(kit), nn * SIZE.histones);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const lump = (CORE_RADIUS_NM * 0.62) / u;
  let id = 0;
  for (const cx of centres)
    for (let h = 0; h < SIZE.histones; h++) {
      const layer = h < SIZE.histones / 2 ? -1 : 1;
      const a =
        ((h % (SIZE.histones / 2)) / (SIZE.histones / 2)) * Math.PI * 2 + (layer > 0 ? 0.6 : 0);
      p.set(
        (cx + Math.cos(a) * CORE_RADIUS_NM * 0.45) / u,
        (Math.sin(a) * CORE_RADIUS_NM * 0.45) / u,
        (layer * height) / 4 / u,
      );
      q.setFromEuler(e.set(h, 2 * h, 0));
      s.setScalar(lump);
      hist.setMatrixAt(id++, m.compose(p, q, s));
    }
  hist.instanceMatrix.needsUpdate = true;
  // DNA: one tube from the left edge, around each core (left-handed), linker to the next.
  const path: Vec3[] = [];
  const per = 16;
  const sweep = turns * Math.PI * 2;
  const half = (nn * SIZE.fibreNm + (nn - 1) * DRAWN.linkerNm) / 2;
  path.push([-half / u, (-WRAP_RADIUS_NM * 0.9) / u, -height / 2 / u]);
  for (const cx of centres) {
    const steps = Math.ceil(turns * per);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = sweep * (1 - t);
      const zz = -height / 2 + t * height;
      path.push([
        (cx + Math.cos(a) * WRAP_RADIUS_NM) / u,
        (Math.sin(a) * WRAP_RADIUS_NM) / u,
        zz / u,
      ]);
    }
  }
  path.push([half / u, 0, height / 2 / u]);
  kit.mesh(tubes(kit, [path], SIZE.dnaNm / 2 / u), chromosome(kit, structureColor(tok, 'nucleus')));
  const c1 = centres[1] ?? 0;
  return {
    center: [0, 0, 0],
    radius: half / u + 0.4,
    bottom: -(SIZE.fibreNm / 2) / u,
    anchors: {
      histones: [c1 / u, 0, height / 2 / u],
      wrappedDna: [(c1 - WRAP_RADIUS_NM) / u, WRAP_RADIUS_NM / u, 0],
      linker: [(c1 + step / 2) / u, (-WRAP_RADIUS_NM * 0.4) / u, 0],
    },
  };
}

// ── Level 6: the B-DNA double helix ───────────────────────────────────────────────────────────

function buildHelix(kit: SceneKit, u: number): Built {
  const pal = readDogmaPalette(token(kit));
  // The helix recipe works in nm: one group scaled to the level's unit.
  const g = new THREE.Group();
  g.scale.setScalar(1 / u);
  kit.scene.add(g);
  const n = DRAWN.helixBp;
  const shapes = helixShapes(kit, kit.tier);
  const halves = rungs(kit, shapes, 2 * n, g);
  const axis = { y: 0, z: 0 };
  const coding = strandMesh(kit, 'coding', n, axis, g);
  const template = strandMesh(kit, 'template', n, axis, g);
  const w = new Writer();
  const back: Vec3 = [0, 0, 0];
  const tip: Vec3 = [0, 0, 0];
  const color = new THREE.Color();
  const x0 = -HELIX_LENGTH_NM / 2;
  const pose = (i: number, strand: 0 | 1, out: Vec3) => {
    const a = i * TWIST + strand * Math.PI;
    out[0] = x0 + i * RISE;
    out[1] = RADIUS * Math.cos(a);
    out[2] = RADIUS * Math.sin(a);
  };
  for (let i = 0; i < n; i++) {
    const b = baseAt(i);
    const pairs = [b, COMPLEMENT[b]] as const;
    for (const strand of [0, 1] as const) {
      pose(i, strand, back);
      tip[0] = back[0];
      tip[1] = 0;
      tip[2] = 0;
      const base = pairs[strand];
      w.half(halves, 2 * i + strand, back, tip, baseWidth(base));
      halves.setColorAt(2 * i + strand, color.set(pal.bases[base]));
      (strand === 0 ? coding : template).tube.set(i, back);
    }
  }
  halves.count = 2 * n;
  halves.instanceMatrix.needsUpdate = true;
  if (halves.instanceColor) halves.instanceColor.needsUpdate = true;
  for (const [strand, s] of [
    [0, coding],
    [1, template],
  ] as const) {
    s.tube.count = n;
    pose(-1, strand, back);
    s.tube.set(-1, back);
    pose(n, strand, back);
    s.tube.set(n, back);
    s.tube.build();
    s.tube.show(0, n - 1);
  }
  const hx = HELIX_LENGTH_NM / 2 / u;
  return {
    center: [0, 0, 0],
    radius: hx + 0.6,
    bottom: -RADIUS / u,
    anchors: { backbone: [-hx * 0.6, RADIUS / u, 0], basePair: [hx * 0.35, 0, RADIUS / u] },
  };
}

const BUILDERS: Record<ZoomLevel, (kit: SceneKit, unitNm: number) => Built> = {
  cell: buildCell,
  nucleus: buildNucleus,
  chromosome: buildChromosome,
  fibre: buildFibre,
  nucleosome: buildNucleosomes,
  dna: buildHelix,
};

/** Builds the scene of one level: subject, scale bar, the next level's spot, part names. */
export function buildZoomScene(kit: SceneKit, o: ZoomSceneOptions): Bio3DScene {
  const info = levelInfo(o.level);
  const u = info.unitNm;
  const b = BUILDERS[info.id](kit, u);
  const barY = b.bottom - 0.8;
  scaleBar(kit, info, barY, o.barText);
  const spot = zoomSpot(info.id);
  const frames: Record<string, SceneFrame> = {};
  if (spot) {
    const c: Vec3 = [spot.center[0] / u, spot.center[1] / u, spot.center[2] / u];
    const r = spot.radiusNm / u;
    spotRing(kit, c, r * 1.15);
    frames[zoomFrame(info.index)] = { bounds: { center: c, radius: r * 1.2 } };
  }
  const named: string[] = [];
  if (o.names)
    for (const part of LEVEL_PARTS[info.id]) {
      const at = b.anchors[part];
      const text = o.names[part];
      if (at && text) {
        kit.label(text, at);
        named.push(part);
      }
    }
  // The scale bar and its label belong to the framed subject.
  const bottom = barY - 0.6;
  const top = b.center[1] + b.radius;
  const cy = (top + bottom) / 2;
  return {
    kit,
    bounds: {
      center: [b.center[0], cy, b.center[2]],
      radius: Math.max(b.radius, (top - bottom) / 2),
    },
    frames,
    state: () => ({ level: info.id, barNm: info.barNm, unitNm: u, named, spot: spot !== null }),
  };
}
