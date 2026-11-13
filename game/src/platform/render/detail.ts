import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MergedPiece } from './props/parts';

// Phase G-3: Ultra's model detail, laid over every model as it is drawn — boxes with bevelled
// edges (no razor edges: the room's reflections run round them), round parts with twice their
// segments. A part is rebuilt only when its geometry is exactly what its parameters make, moved
// and turned a quarter at most (checked vertex by vertex); anything shaped otherwise, skinned, or
// a box with its own texture layout or several materials is left as it is. The new part has the
// same size and place, so nothing a reading shows moves. Low, Medium and High never see it.
// A model may also name small parts only Ultra draws (`withSmallParts`: knurls, screws, vents):
// built when Ultra lays its detail, merged into the part, never made under another preset.

/** Edge radius: a fifth of the box's thinnest side, 8 mm at most (instruments, benches). */
export const BEVEL_MAX_M = 0.008;
const BEVEL_SHARE = 0.2;
const BEVEL_MIN_M = 0.0005;
/** Round parts with at least this many segments round them are round (a hex nut stays six). */
const ROUND_FROM = 12;
const SEGMENTS_MAX = 128;
const EPSILON = 1e-5;

/** The quarter turns (and half turns) a model may have given a part before placing it. */
const TURNS: THREE.Matrix4[] = [
  new THREE.Matrix4(),
  ...[Math.PI / 2, -Math.PI / 2, Math.PI].flatMap((angle) => [
    new THREE.Matrix4().makeRotationX(angle),
    new THREE.Matrix4().makeRotationY(angle),
    new THREE.Matrix4().makeRotationZ(angle),
  ]),
];

type Params = Record<string, number | boolean | THREE.Vector2[]>;

const more = (n: number) => (n >= ROUND_FROM ? Math.min(n * 2, SEGMENTS_MAX) : n);

/**
 * Parts already built, by kind, parameters and tier: many parts share a size (a rounded box's
 * texture coordinates were the costliest step of entering a lab under Ultra), so each is built once
 * and copied. Freed when Ultra is left (`ModelDetail.drop`).
 */
const built = new Map<string, THREE.BufferGeometry>();

/** The same kind of part from its parameters: as made (`upgrade` false) or Ultra's (a copy). */
function build(type: string, p: Params, upgrade: boolean): THREE.BufferGeometry | null {
  const key = `${type}|${upgrade ? 1 : 0}|${JSON.stringify(p)}`;
  let shape = built.get(key);
  if (shape === undefined) {
    const made = make(type, p, upgrade);
    if (!made) return null;
    shape = made;
    built.set(key, shape);
  }
  return shape.clone();
}

function make(type: string, p: Params, upgrade: boolean): THREE.BufferGeometry | null {
  const n = (key: string) => p[key] as number;
  switch (type) {
    case 'BoxGeometry': {
      if (!upgrade) {
        return new THREE.BoxGeometry(
          n('width'),
          n('height'),
          n('depth'),
          n('widthSegments'),
          n('heightSegments'),
          n('depthSegments'),
        );
      }
      const thinnest = Math.min(n('width'), n('height'), n('depth'));
      const radius = Math.min(thinnest * BEVEL_SHARE, BEVEL_MAX_M);
      return roundedBox(n('width'), n('height'), n('depth'), radius);
    }
    case 'CylinderGeometry':
      return new THREE.CylinderGeometry(
        n('radiusTop'),
        n('radiusBottom'),
        n('height'),
        upgrade ? more(n('radialSegments')) : n('radialSegments'),
        n('heightSegments'),
        p.openEnded as boolean,
        n('thetaStart'),
        n('thetaLength'),
      );
    case 'SphereGeometry':
      return new THREE.SphereGeometry(
        n('radius'),
        upgrade ? more(n('widthSegments')) : n('widthSegments'),
        upgrade && n('widthSegments') >= ROUND_FROM
          ? Math.min(n('heightSegments') * 2, SEGMENTS_MAX)
          : n('heightSegments'),
        n('phiStart'),
        n('phiLength'),
        n('thetaStart'),
        n('thetaLength'),
      );
    case 'TorusGeometry':
      return new THREE.TorusGeometry(
        n('radius'),
        n('tube'),
        upgrade ? more(n('radialSegments')) : n('radialSegments'),
        upgrade ? more(n('tubularSegments')) : n('tubularSegments'),
        n('arc'),
      );
    case 'LatheGeometry':
      return new THREE.LatheGeometry(
        p.points as THREE.Vector2[],
        upgrade ? more(n('segments')) : n('segments'),
        n('phiStart'),
        n('phiLength'),
      );
    default:
      return null;
  }
}

/** Whether Ultra makes anything new of this part (a box always; a round one if it is round). */
function upgrades(type: string, p: Params): boolean {
  switch (type) {
    case 'BoxGeometry': // a bevel under half a millimetre is not seen: not worth its triangles
      return (
        Math.min(p.width as number, p.height as number, p.depth as number) * BEVEL_SHARE >=
        BEVEL_MIN_M
      );
    case 'CylinderGeometry':
      return (p.radialSegments as number) >= ROUND_FROM;
    case 'SphereGeometry':
      return (p.widthSegments as number) >= ROUND_FROM;
    case 'TorusGeometry':
      return (
        (p.radialSegments as number) >= ROUND_FROM || (p.tubularSegments as number) >= ROUND_FROM
      );
    case 'LatheGeometry':
      return (p.segments as number) >= ROUND_FROM;
    default:
      return false;
  }
}

/**
 * The turn and move that make `fresh` into `made`'s vertices from `start` (all of them, or
 * `count`), vertex for vertex — or null when they were shaped some other way (scaled, bent,
 * made non-indexed).
 */
function placing(
  fresh: THREE.BufferGeometry,
  made: THREE.BufferGeometry,
  start = 0,
  count = made.getAttribute('position').count,
): THREE.Matrix4 | null {
  const a = fresh.getAttribute('position') as THREE.BufferAttribute | undefined;
  const b = made.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!a || !b || a.count !== count || a.count === 0) return null;
  const v = new THREE.Vector3();
  for (const turn of TURNS) {
    v.fromBufferAttribute(a, 0).applyMatrix4(turn);
    const dx = b.getX(start) - v.x;
    const dy = b.getY(start) - v.y;
    const dz = b.getZ(start) - v.z;
    let same = true;
    for (let i = 1; i < a.count && same; i++) {
      v.fromBufferAttribute(a, i).applyMatrix4(turn);
      same =
        Math.abs(b.getX(start + i) - v.x - dx) < EPSILON &&
        Math.abs(b.getY(start + i) - v.y - dy) < EPSILON &&
        Math.abs(b.getZ(start + i) - v.z - dz) < EPSILON;
    }
    if (same) return turn.clone().setPosition(dx, dy, dz);
  }
  return null;
}

/** Ultra's version of one piece of a merge (in place), or null if it stays as merged. */
function detailedPiece(
  made: THREE.BufferGeometry,
  piece: MergedPiece,
): THREE.BufferGeometry | null {
  const p = piece.parameters as Params | undefined;
  if (!p || !upgrades(piece.type, p)) return null;
  const fresh = build(piece.type, p, false);
  if (!fresh) return null;
  const same = fresh.index?.count === piece.indices;
  const place = same ? placing(fresh, made, piece.vertex, piece.count) : null;
  fresh.dispose();
  if (!place) return null;
  const out = build(piece.type, p, true);
  if (!out) return null;
  out.applyMatrix4(place);
  for (const name of Object.keys(out.attributes)) {
    if (!(name in made.attributes)) out.deleteAttribute(name); // the merge's uv is gone
  }
  // A rounded box comes unindexed: indexed, as the merge is.
  if (!out.index) out.setIndex([...Array(out.getAttribute('position').count).keys()]);
  return out;
}

/** A piece of a merge as it was: its vertices and its triangles, from 0. */
function slice(made: THREE.BufferGeometry, piece: MergedPiece): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(made.attributes)) {
    const { itemSize } = attribute;
    const from = (attribute as THREE.BufferAttribute).array;
    const array = from.slice(piece.vertex * itemSize, (piece.vertex + piece.count) * itemSize);
    out.setAttribute(name, new THREE.BufferAttribute(array, itemSize, attribute.normalized));
  }
  const index = made.index;
  if (index) {
    const indices = Array.from(index.array.slice(piece.index, piece.index + piece.indices));
    out.setIndex(indices.map((i) => i - piece.vertex));
  }
  return out;
}

/** Ultra's version of a merge of pieces (props/parts.ts `part`), or null if none changes. */
function detailedMerge(made: THREE.BufferGeometry, pieces: readonly MergedPiece[]) {
  if (!made.index) return null;
  for (const attribute of Object.values(made.attributes)) {
    if (!(attribute instanceof THREE.BufferAttribute)) return null; // interleaved: not ours
  }
  const parts = pieces.map((piece) => detailedPiece(made, piece));
  if (parts.every((part) => part === null)) return null;
  const all = pieces.map((piece, i) => parts[i] ?? slice(made, piece));
  const out = mergeGeometries(all);
  for (const part of all) part.dispose();
  return out as THREE.BufferGeometry | null; // null when the pieces do not merge (not expected)
}

/**
 * Gives a part small parts only Ultra draws: `make` builds them in the part's own frame, and only
 * when Ultra lays its detail. Returns the part, unchanged under every other preset.
 */
export function withSmallParts<G extends THREE.BufferGeometry>(
  geometry: G,
  make: () => THREE.BufferGeometry[],
): G {
  geometry.userData.smallParts = make;
  return geometry;
}

/** `target` with `parts` merged in (their attributes made to match), or null if they cannot be. */
function withParts(
  target: THREE.BufferGeometry,
  parts: THREE.BufferGeometry[],
): THREE.BufferGeometry | null {
  const names = Object.keys(target.attributes);
  const ready = parts.map((part) => {
    const out = target.index || !part.index ? part : part.toNonIndexed();
    if (out !== part) part.dispose();
    if (target.index && !out.index) {
      out.setIndex([...Array(out.getAttribute('position').count).keys()]);
    }
    for (const name of Object.keys(out.attributes)) {
      if (!names.includes(name)) out.deleteAttribute(name);
    }
    return out;
  });
  // A part missing one of the target's attributes (a second UV set, colours) cannot join it.
  const fits = ready.every((part) => names.every((name) => name in part.attributes));
  const merged = fits ? (mergeGeometries([target, ...ready]) as THREE.BufferGeometry | null) : null;
  for (const part of ready) part.dispose();
  return merged;
}

/** Ultra's version of `made`, or null if it is left as it is. */
export function detailed(made: THREE.BufferGeometry): THREE.BufferGeometry | null {
  if (Object.keys(made.morphAttributes).length > 0) return null;
  const shaped = shapedDetail(made);
  const make = made.userData.smallParts as (() => THREE.BufferGeometry[]) | undefined;
  const parts = make?.() ?? [];
  if (parts.length === 0) return shaped;
  const out = withParts(shaped ?? made, parts);
  if (!out) return shaped;
  shaped?.dispose();
  out.name = made.name;
  out.userData = { detailOf: made.uuid };
  return out;
}

/** Ultra's rounder, bevelled version of `made`, or null if its shape stays. */
function shapedDetail(made: THREE.BufferGeometry): THREE.BufferGeometry | null {
  const pieces = made.userData.pieces as readonly MergedPiece[] | undefined;
  if (pieces) {
    const merge = detailedMerge(made, pieces);
    if (merge) {
      merge.name = made.name;
      merge.userData = { detailOf: made.uuid };
    }
    return merge;
  }
  const { type } = made;
  const p = (made as THREE.BufferGeometry & { parameters?: Params }).parameters;
  if (!p || !upgrades(type, p)) return null;
  const fresh = build(type, p, false);
  if (!fresh) return null;
  const place = placing(fresh, made);
  fresh.dispose();
  if (!place) return null;
  const out = build(type, p, true);
  if (!out) return null;
  out.applyMatrix4(place);
  // Its own extra attributes (a second UV set, colours) would be lost: then not this one.
  for (const name of Object.keys(made.attributes)) {
    if (!(name in out.attributes)) {
      out.dispose();
      return null;
    }
  }
  out.name = made.name;
  out.userData = { ...made.userData, detailOf: made.uuid };
  return out;
}

/** Whether a box's material lets it be rounded: one material, no image laid by its UVs. */
function boxMaterialAllows(material: THREE.Material | THREE.Material[]): boolean {
  if (Array.isArray(material)) return false;
  return !(material as Partial<THREE.MeshStandardMaterial>).map;
}

/**
 * Ultra's detail on what is drawn: `adopt` swaps each part for its detailed one (made once per
 * shared geometry), `restore` puts the originals back under a root, `drop` everywhere it was
 * laid and frees the new ones.
 *
 * Owners free geometry either way, and both are followed: one freeing its original (a scene's
 * shared parts) frees the detailed one with it; one freeing what its meshes hold (the detailed
 * one) frees the original too. Nothing here keeps a mesh alive.
 */
export class ModelDetail {
  /** Each original geometry's detailed one, while both live. */
  private readonly made = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  /** Originals left as they are (not held: a freed scene's go with it). */
  private readonly plain = new WeakSet<THREE.BufferGeometry>();
  /** Each swapped mesh's original geometry. */
  private readonly originals = new WeakMap<THREE.Mesh, THREE.BufferGeometry>();
  /** Meshes whose detailed part is still to be built (`adoptLater`), in order. */
  private readonly queue: THREE.Mesh[] = [];
  private readonly queued = new WeakSet<THREE.Mesh>();

  adopt(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.SkinnedMesh) return;
      const mesh = object as THREE.Mesh;
      const original = mesh.geometry;
      if (original.userData.detailOf) return; // laid already
      if (original.type === 'BoxGeometry' && !boxMaterialAllows(mesh.material)) return;
      const detail = this.detailOf(original);
      if (!detail) return;
      this.originals.set(mesh, original);
      mesh.geometry = detail;
    });
  }

  /**
   * As `adopt`, but what has to be built is built over the next frames (`update`), a few
   * milliseconds at a time: a scene coming in under Ultra no longer stalls a frame for it. Until
   * then a mesh shows its own part (the same size: only its edges and segments change).
   */
  adoptLater(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.SkinnedMesh) return;
      const mesh = object as THREE.Mesh;
      const original = mesh.geometry;
      if (original.userData.detailOf || this.plain.has(original)) return;
      if (original.type === 'BoxGeometry' && !boxMaterialAllows(mesh.material)) return;
      const known = this.made.get(original);
      if (known) {
        this.originals.set(mesh, original);
        mesh.geometry = known;
      } else if (!this.queued.has(mesh)) {
        this.queued.add(mesh);
        this.queue.push(mesh);
      }
    });
  }

  /** Builds queued parts for up to `budgetMs` (at least one), swapping each in as it is made. */
  update(budgetMs: number): void {
    if (this.queue.length === 0) return;
    const start = performance.now();
    let done = 0;
    while (done < this.queue.length && (done === 0 || performance.now() - start < budgetMs)) {
      const mesh = this.queue[done++];
      if (!mesh) continue;
      this.queued.delete(mesh);
      const original = mesh.geometry;
      if (original.userData.detailOf) continue; // laid meanwhile
      const detail = this.detailOf(original);
      if (!detail) continue;
      this.originals.set(mesh, original);
      mesh.geometry = detail;
    }
    this.queue.splice(0, done);
  }

  /** The originals back on every mesh under `root` (Ultra left, or a mesh kept aside comes back). */
  restore(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const mesh = object as THREE.Mesh;
      const original = this.originals.get(mesh);
      if (!original) return;
      mesh.geometry = original;
      this.originals.delete(mesh);
    });
  }

  /** Ultra left: the originals back under `root`, every detailed part freed. */
  drop(root: THREE.Object3D): void {
    this.restore(root);
    for (const detail of [...this.made.values()]) detail.dispose();
    this.made.clear();
    for (const mesh of this.queue) this.queued.delete(mesh);
    this.queue.length = 0;
    for (const shape of built.values()) shape.dispose();
    built.clear();
  }

  private detailOf(original: THREE.BufferGeometry): THREE.BufferGeometry | null {
    if (this.plain.has(original)) return null;
    const known = this.made.get(original);
    if (known) return known;
    const detail = detailed(original);
    if (!detail) {
      this.plain.add(original);
      return null;
    }
    this.made.set(original, detail);
    let freed = false;
    const free = (event: { target: unknown }) => {
      if (freed) return;
      freed = true;
      this.made.delete(original);
      original.removeEventListener('dispose', free);
      detail.removeEventListener('dispose', free);
      (event.target === original ? detail : original).dispose(); // the other one
    };
    original.addEventListener('dispose', free);
    detail.addEventListener('dispose', free);
    return detail;
  }
}

/**
 * A unit box of 5 segments a side (three's RoundedBoxGeometry with 2 segments a corner), each vertex's
 * octant and rounded normal: a rounded box of any size is `half size × octant + normal × radius`,
 * one loop — not three's per-vertex texture coordinates (the costliest step of entering a lab under
 * Ultra) and not unindexed (four times the vertices). Made once.
 */
const UNIT = (() => {
  const box = new THREE.BoxGeometry(1, 1, 1, 5, 5, 5);
  const p = box.getAttribute('position');
  const octant = new Float32Array(p.count * 3);
  const normal = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  const half = 0.5 / 5;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    octant.set([Math.sign(v.x), Math.sign(v.y), Math.sign(v.z)], i * 3);
    v.set(v.x - Math.sign(v.x) * half, v.y - Math.sign(v.y) * half, v.z - Math.sign(v.z) * half);
    v.normalize();
    normal.set([v.x, v.y, v.z], i * 3);
  }
  const index = Array.from(box.index?.array ?? []);
  box.dispose();
  return { octant, normal, index, count: p.count };
})();

/** A rounded box's part: its size and radius kept, and kept by its copies (three copies its kind). */
class RoundedBox extends THREE.BufferGeometry {
  override readonly type = 'RoundedBoxGeometry';
  parameters = { width: 0, height: 0, depth: 0, segments: 2, radius: 0 };

  override copy(source: RoundedBox): this {
    super.copy(source);
    this.parameters = { ...source.parameters };
    return this;
  }
}

/** A box w × h × d with edges rounded to `radius` (as three's RoundedBoxGeometry draws it). */
function roundedBox(w: number, h: number, d: number, radius: number): THREE.BufferGeometry {
  const r = Math.min(w / 2, h / 2, d / 2, radius);
  const [bx, by, bz] = [w / 2 - r, h / 2 - r, d / 2 - r];
  const { octant, normal, index, count } = UNIT;
  const position = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i += 3) {
    position[i] = bx * (octant[i] ?? 0) + r * (normal[i] ?? 0);
    position[i + 1] = by * (octant[i + 1] ?? 0) + r * (normal[i + 1] ?? 0);
    position[i + 2] = bz * (octant[i + 2] ?? 0) + r * (normal[i + 2] ?? 0);
  }
  const geometry = new RoundedBox();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal.slice(), 3));
  // Unused (no detailed box carries a picture), but a part keeps the attributes it had.
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  geometry.setIndex(index);
  geometry.parameters = { width: w, height: h, depth: d, segments: 2, radius: r };
  return geometry;
}
