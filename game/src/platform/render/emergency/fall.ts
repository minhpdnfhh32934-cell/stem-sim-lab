import * as THREE from 'three';
import { HOLD_S } from '../../../gameplay/emergency/hung';

/** What hung from the blown ceiling: its drawn object, how far its bottom is below its origin. */
export interface Hung {
  readonly object: THREE.Object3D;
  /** Its box's half height (m): the object's origin is its box's centre. */
  readonly bottom: number;
  /** Its box's largest side (m): the shards are as large as it is. */
  readonly size: number;
}

/** Glass shards each hung object also bursts into, besides its own broken pieces. */
const SHARDS = 90;
const G = 9.81;
/** Arcs a ring breaks into (round the object's middle), and chunks of what lies inside them. */
const RING_SECTORS = 14;
const INNER_SECTORS = 5;
/** Floor bounce (vertical speed kept) and the grip of the floor on a sliding piece. */
const BOUNCE = 0.28;
const GRIP = 0.55;
/** Seconds a piece takes to tip over flat once it has nearly stopped. */
const TIP_S = 0.3;
/** Points of a piece tried against the floor (its extremes, and some more of its corners). */
const SAMPLES = 16;

/** A glass shard: which batch and copy draws it, where it is, how fast, how it turns, how large. */
interface Shard {
  readonly mesh: THREE.InstancedMesh;
  readonly index: number;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly scale: THREE.Vector3;
  readonly v: THREE.Vector3;
  readonly spin: THREE.Vector3;
  still: boolean;
}
/**
 * A broken piece of the object itself (an arc of a ring, a run of ticks, the ball): its own mesh
 * round its centre, moving as one body until it lies on the floor.
 */
interface Piece {
  readonly mesh: THREE.Mesh;
  readonly v: THREE.Vector3;
  readonly spin: THREE.Vector3;
  /** Points of it (round its centre) tried against the floor. */
  readonly samples: readonly THREE.Vector3[];
  /** The normal of the plane it was drawn in (its own frame): lying, it lies on that face. */
  readonly face: THREE.Vector3;
  /** Tipping over flat: from, to, how far (0 … 1); still once there. */
  readonly from: THREE.Quaternion;
  readonly to: THREE.Quaternion;
  tip: number;
  still: boolean;
}
interface Falling {
  readonly hung: Hung;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly tilt: THREE.Vector3;
  t: number;
  v: number;
  broken: boolean;
}

/** A shard's face: an uneven triangle in x–y (scaled per shard), seen from both sides. */
const SHARD = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-0.5, -0.35, 0),
  new THREE.Vector3(0.55, -0.2, 0),
  new THREE.Vector3(-0.1, 0.6, 0),
]);
SHARD.computeVertexNormals();
/** Lying on the floor: the face turned down flat. */
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const _matrix = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const _yaw = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _down = new THREE.Vector3(0, -1, 0);
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const IDENTITY = new THREE.Matrix4();

/**
 * What hung from the ceiling the emergency blows open (an item `visual.hanging`, Phú 2026-11-15:
 * the hall's emblem) falls when the cables give way and breaks on the floor (Phú 2026-11-16, made
 * truer 2026-11-17): the object itself comes apart — its rings into arcs, its ticks and dashes into
 * runs, its ball whole — each piece with the fall's speed, so what strikes first breaks first; they
 * bounce, tumble, slide and tip over flat; a burst of thin glass shards in its colours skitters out
 * with them. Whole again where it hung once the ceiling is mended. Only drawn: nothing collides.
 * The pieces are made once, at the break; nothing is allocated per frame.
 */
export class HungFall {
  readonly group = new THREE.Group();
  private readonly falling: Falling[] = [];
  private readonly shards: Shard[] = [];
  private readonly pieces: Piece[] = [];
  private readonly batches: THREE.InstancedMesh[] = [];
  private readonly materials: THREE.Material[] = [];
  private floor = 0;
  /** The shards' and pieces' size now (1 … shrinking to nothing while the ceiling is mended). */
  private shown = 1;
  private readonly turn = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();

  constructor() {
    this.group.name = 'hung-fall';
  }

  /** Whether anything has fallen and is not back yet. */
  get down(): boolean {
    return this.falling.length > 0;
  }

  /** Each shard's height over the floor now, then each piece's lowest point's (m): tests. */
  heights(): number[] {
    return [
      ...this.shards.map((s) => s.position.y - this.floor),
      ...this.pieces.map((p) => this.lowest(p) - this.floor),
    ];
  }

  /** How many pieces the objects broke into (tests). */
  get pieceCount(): number {
    return this.pieces.length;
  }

  /**
   * The blast: `hung` fall to `floor` (world y). `late` (the blast long past, the hall walked into
   * since): already broken and lying still.
   */
  start(hung: readonly Hung[], floor: number, late: boolean): void {
    if (this.down) return;
    this.floor = floor;
    for (const h of hung) {
      this.falling.push({
        hung: h,
        position: h.object.position.clone(),
        quaternion: h.object.quaternion.clone(),
        tilt: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
        t: 0,
        v: 0,
        broken: false,
      });
    }
    if (late) {
      for (const f of this.falling) {
        // as it would have struck: a fall of its own height's worth
        f.v = Math.sqrt(2 * G * Math.max(0.5, f.position.y - f.hung.bottom - floor));
        this.shatter(f);
      }
      for (let i = 0; i < 600; i++) this.settle(1 / 60); // as they would lie a few seconds on
    }
  }

  /** One frame: the fall, the pieces and shards flying and settling; `mend` 1 open … 0 mended. */
  update(dt: number, mend: number): void {
    for (const f of this.falling) {
      if (f.broken) continue;
      f.t += dt;
      if (f.t < HOLD_S) continue;
      const o = f.hung.object;
      f.v += G * dt;
      o.position.y -= f.v * dt;
      // Tipping as it drops, one side's cables gone first.
      this.turn.setFromAxisAngle(f.tilt, 0.5 * (f.t - HOLD_S));
      o.quaternion.copy(f.quaternion).premultiply(this.turn);
      if (this.lowestOf(o) <= this.floor) this.shatter(f);
    }
    const k = Math.max(0.001, Math.min(1, mend * 1.4));
    const resized = k !== this.shown;
    this.shown = k;
    this.settle(dt, resized);
  }

  /** All back where it hung, whole; the pieces and shards gone. */
  restore(): void {
    for (const f of this.falling) {
      const o = f.hung.object;
      o.position.copy(f.position);
      o.quaternion.copy(f.quaternion);
      o.visible = true;
    }
    this.falling.length = 0;
    this.shards.length = 0;
    for (const p of this.pieces) {
      p.mesh.removeFromParent();
      p.mesh.geometry.dispose(); // its own; the material is the object's, shared
    }
    this.pieces.length = 0;
    for (const b of this.batches) {
      b.removeFromParent();
      b.dispose();
    }
    this.batches.length = 0;
    for (const m of this.materials) m.dispose();
    this.materials.length = 0;
    this.shown = 1;
  }

  dispose(): void {
    this.restore();
    this.group.removeFromParent();
  }

  /** The lowest point of the falling object now (its meshes' boxes, in the group's frame). */
  private lowestOf(o: THREE.Object3D): number {
    o.updateMatrix();
    let low = Infinity;
    o.traverse((c) => {
      const mesh = c as Partial<THREE.Mesh>;
      const g = mesh.geometry;
      if (!g || !c.visible) return;
      if (!g.boundingBox) g.computeBoundingBox();
      const box = g.boundingBox;
      if (!box) return;
      c.updateMatrix();
      _matrix.multiplyMatrices(o.matrix, c === o ? IDENTITY : c.matrix);
      for (let i = 0; i < 8; i++) {
        _p.set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z,
        );
        low = Math.min(low, _p.applyMatrix4(_matrix).y);
      }
    });
    return low;
  }

  /** Strikes the floor: the object hidden, its pieces and a burst of glass from where it struck. */
  private shatter(f: Falling): void {
    f.broken = true;
    const o = f.hung.object;
    o.visible = false;
    const struck = this.breakUp(f);
    const colours = coloursOf(o);
    const s = f.hung.size / 5; // the hall's emblem is 5.2 m
    const per = Math.ceil(SHARDS / colours.length);
    for (const colour of colours) {
      // Clear, smooth, a little lit by its own colour: glass catching the hall's light.
      const material = new THREE.MeshStandardMaterial({
        color: colour,
        emissive: colour,
        emissiveIntensity: 0.25,
        roughness: 0.05,
        metalness: 0.15,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.materials.push(material);
      const batch = new THREE.InstancedMesh(SHARD, material, per);
      batch.frustumCulled = false;
      batch.castShadow = false;
      batch.renderOrder = 3;
      this.group.add(batch);
      this.batches.push(batch);
      for (let i = 0; i < per; i++) {
        // From where it struck first, flung out low and far: small bits more than large.
        const a = Math.random() * Math.PI * 2;
        const r = (0.1 + 0.5 * Math.random()) * s;
        const size = (0.02 + 0.08 * Math.random() ** 2) * s;
        const out = 1.5 + 5 * Math.random() ** 1.5;
        const shard: Shard = {
          mesh: batch,
          index: i,
          position: new THREE.Vector3(
            struck.x + Math.cos(a) * r,
            this.floor + (0.03 + 0.2 * Math.random()) * s,
            struck.z + Math.sin(a) * r,
          ),
          quaternion: new THREE.Quaternion().random(),
          scale: new THREE.Vector3(size, size * (0.6 + 0.8 * Math.random()), 1),
          v: new THREE.Vector3(Math.cos(a) * out, 0.8 + 3 * Math.random(), Math.sin(a) * out),
          spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
            .normalize()
            .multiplyScalar(6 + 14 * Math.random()),
          still: false,
        };
        this.shards.push(shard);
        this.place(shard);
      }
      batch.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * The object's own triangles cut into pieces: by its mesh, by the plane they lie in (the emblem
   * is two faces crossed), by ring or inside, and by sector round its middle — each a mesh of its
   * own round its centre, falling at the fall's speed, given a kick and a spin. What stands above
   * the object's square (the cables) and what is see-through (the glow) do not survive the break.
   * Returns where it struck first (its lowest point), for the glass.
   */
  private breakUp(f: Falling): THREE.Vector3 {
    const o = f.hung.object;
    o.updateMatrix();
    const half = f.hung.size / 2;
    // the middle of its square, in its own frame: the square stands on its box's bottom
    const midY = -f.hung.bottom + half;
    const top = -f.hung.bottom + f.hung.size * 1.02;
    const struck = new THREE.Vector3(0, Infinity, 0);
    const local = new THREE.Vector3();
    const world = new THREE.Matrix4();
    const normalMatrix = new THREE.Matrix3();
    let meshIndex = 0;
    o.traverse((c) => {
      const mesh = c as Partial<THREE.Mesh>;
      if (!mesh.isMesh || !mesh.geometry || !mesh.material) return;
      const material = mesh.material as THREE.Material;
      if (Array.isArray(mesh.material) || material.transparent) return;
      const g = mesh.geometry;
      if (!g.hasAttribute('position')) return;
      const pos = g.getAttribute('position');
      const nor = g.hasAttribute('normal') ? g.getAttribute('normal') : undefined;
      const col = g.hasAttribute('color') ? g.getAttribute('color') : undefined;
      c.updateMatrix();
      world.multiplyMatrices(o.matrix, c === o ? IDENTITY : c.matrix);
      normalMatrix.getNormalMatrix(world);
      const index = g.index;
      const triangles = (index ? index.count : pos.count) / 3;
      const vertexOf = (k: number) => (index ? index.getX(k) : k);
      const offsetRing = Math.random();
      const offsetInner = Math.random();
      const groups = new Map<number, number[]>(); // piece key → its triangles' first corners
      for (let t = 0; t < triangles; t++) {
        local.set(0, 0, 0);
        for (let k = 0; k < 3; k++) {
          local.x += pos.getX(vertexOf(3 * t + k)) / 3;
          local.y += pos.getY(vertexOf(3 * t + k)) / 3;
          local.z += pos.getZ(vertexOf(3 * t + k)) / 3;
        }
        _p.copy(local).applyMatrix4(c === o ? IDENTITY : c.matrix); // in the object's frame
        if (_p.y > top) continue; // the cables, above the square
        const dy = _p.y - midY;
        const plane = Math.abs(_p.z) <= Math.abs(_p.x) ? 0 : 1; // x–y, or z–y
        const across = plane === 0 ? _p.x : _p.z;
        const angle = Math.atan2(dy, across) / (2 * Math.PI) + 0.5; // 0 … 1 round the middle
        const ring = Math.hypot(dy, across) >= 0.68 * half;
        const sectors = ring ? RING_SECTORS : INNER_SECTORS;
        const sector = Math.floor((angle + (ring ? offsetRing : offsetInner)) * sectors) % sectors;
        const key = ((meshIndex * 2 + plane) * 2 + (ring ? 1 : 0)) * 64 + sector;
        let list = groups.get(key);
        if (!list) groups.set(key, (list = []));
        list.push(3 * t);
      }
      for (const [key, corners] of groups) {
        // the face it lies on: the plane its triangles lay in (x–y: the object's z; z–y: its x)
        const face = (
          Math.floor(key / 128) % 2 === 0 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
        ).applyQuaternion(o.quaternion);
        const piece = this.piece(
          corners,
          vertexOf,
          pos,
          nor,
          col,
          world,
          normalMatrix,
          material,
          face,
          f,
        );
        if (piece.position.y - 0 < struck.y) struck.copy(piece.position);
      }
      meshIndex++;
    });
    if (!Number.isFinite(struck.y)) struck.copy(o.position);
    return struck;
  }

  /** One broken piece: its triangles in the group's frame, centred, as a mesh that moves alone. */
  private piece(
    corners: readonly number[],
    vertexOf: (k: number) => number,
    pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    nor: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined,
    col: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined,
    world: THREE.Matrix4,
    normalMatrix: THREE.Matrix3,
    material: THREE.Material,
    face: THREE.Vector3,
    f: Falling,
  ): THREE.Mesh {
    const count = corners.length * 3;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colours = col ? new Float32Array(count * col.itemSize) : null;
    const centre = new THREE.Vector3();
    let w = 0;
    for (const first of corners) {
      for (let k = 0; k < 3; k++) {
        const v = vertexOf(first + k);
        _p.fromBufferAttribute(pos, v).applyMatrix4(world);
        positions.set([_p.x, _p.y, _p.z], w * 3);
        centre.add(_p);
        if (nor) {
          _n.fromBufferAttribute(nor, v).applyMatrix3(normalMatrix).normalize();
          normals.set([_n.x, _n.y, _n.z], w * 3);
        }
        if (col && colours)
          for (let c = 0; c < col.itemSize; c++)
            colours[w * col.itemSize + c] = col.getComponent(v, c);
        w++;
      }
    }
    centre.divideScalar(count);
    for (let i = 0; i < count * 3; i++)
      positions[i] = (positions[i] ?? 0) - centre.getComponent(i % 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (nor) geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    else geometry.computeVertexNormals();
    if (col && colours)
      geometry.setAttribute('color', new THREE.BufferAttribute(colours, col.itemSize));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(centre);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    // the points tried against the floor: its extremes along each axis, and some more corners
    const samples: THREE.Vector3[] = [];
    const extremes = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < count; i++) {
      for (let a = 0; a < 3; a++) {
        const value = positions[i * 3 + a] ?? 0;
        if (value < (positions[(extremes[a * 2] ?? 0) * 3 + a] ?? 0)) extremes[a * 2] = i;
        if (value > (positions[(extremes[a * 2 + 1] ?? 0) * 3 + a] ?? 0)) extremes[a * 2 + 1] = i;
      }
    }
    for (const i of extremes) samples.push(new THREE.Vector3().fromArray(positions, i * 3));
    for (let k = samples.length; k < SAMPLES; k++) {
      samples.push(new THREE.Vector3().fromArray(positions, Math.floor(Math.random() * count) * 3));
    }
    // the fall's speed, a kick out from the middle (harder low down, where it strikes), a spin
    const out = new THREE.Vector3(
      centre.x - f.hung.object.position.x,
      0,
      centre.z - f.hung.object.position.z,
    );
    const low = Math.max(0, 1 - (centre.y - this.floor) / Math.max(0.5, f.hung.size));
    if (out.lengthSq() < 1e-6) out.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    out.normalize().multiplyScalar(0.4 + 1.6 * low * Math.random());
    const v = new THREE.Vector3(out.x, -f.v * (0.85 + 0.15 * Math.random()), out.z);
    const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .normalize()
      .multiplyScalar(0.5 + 3 * Math.random());
    this.pieces.push({
      mesh,
      v,
      spin,
      samples,
      face,
      from: new THREE.Quaternion(),
      to: new THREE.Quaternion(),
      tip: -1,
      still: false,
    });
    return mesh;
  }

  /** The lowest of a piece's points now (world y in the group's frame). */
  private lowest(p: Piece): number {
    let low = Infinity;
    for (const s of p.samples) low = Math.min(low, _p.copy(s).applyQuaternion(p.mesh.quaternion).y);
    return p.mesh.position.y + low * this.shown;
  }

  /** The pieces and shards fly, strike, bounce and slide on the floor, and lie flat. */
  private settle(dt: number, resized = false): void {
    for (const p of this.pieces) {
      p.mesh.scale.setScalar(this.shown);
      if (p.still) continue;
      if (p.tip >= 0) {
        // tipping over onto its face, its lowest point kept on the floor
        p.tip = Math.min(1, p.tip + dt / TIP_S);
        p.mesh.quaternion.slerpQuaternions(p.from, p.to, p.tip * p.tip * (3 - 2 * p.tip));
        p.mesh.position.y += this.floor - this.lowest(p);
        if (p.tip >= 1) p.still = true;
        continue;
      }
      p.v.y -= G * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      const angle = p.spin.length() * dt;
      if (angle > 0) {
        this.axis.copy(p.spin).normalize();
        p.mesh.quaternion.premultiply(this.turn.setFromAxisAngle(this.axis, angle));
      }
      const under = this.floor - this.lowest(p);
      if (under > 0) {
        p.mesh.position.y += under;
        if (p.v.y < 0) p.v.y = -p.v.y * BOUNCE;
        p.v.x *= 1 - GRIP;
        p.v.z *= 1 - GRIP;
        p.spin.multiplyScalar(0.5);
        if (p.v.y < 0.6 && p.v.x * p.v.x + p.v.z * p.v.z < 0.05) {
          // nearly stopped: it tips over onto the face it was drawn in (the nearer side down)
          _n.copy(p.face).applyQuaternion(p.mesh.quaternion);
          const side = _n.y >= 0 ? _up : _down;
          _q.setFromUnitVectors(_n, side);
          p.from.copy(p.mesh.quaternion);
          p.to.copy(p.mesh.quaternion).premultiply(_q);
          p.tip = 0;
          p.v.set(0, 0, 0);
          p.spin.set(0, 0, 0);
        }
      }
    }
    let moved = resized;
    for (const p of this.shards) {
      if (p.still) {
        if (resized) this.place(p);
        continue;
      }
      moved = true;
      p.v.y -= G * dt;
      p.position.addScaledVector(p.v, dt);
      const angle = p.spin.length() * dt;
      if (angle > 0) {
        this.axis.copy(p.spin).normalize();
        p.quaternion.premultiply(this.turn.setFromAxisAngle(this.axis, angle));
      }
      const low = this.floor + 0.004;
      if (p.position.y <= low) {
        p.position.y = low;
        p.v.y = -p.v.y * 0.25;
        p.v.x *= 0.5;
        p.v.z *= 0.5;
        p.spin.multiplyScalar(0.4);
        if (Math.abs(p.v.y) < 0.3 && p.v.x * p.v.x + p.v.z * p.v.z < 0.04) {
          p.still = true;
          // Flat on the floor, turned about the vertical as it came to rest.
          p.quaternion.copy(_yaw.setFromAxisAngle(_up, Math.random() * Math.PI * 2)).multiply(FLAT);
        }
      }
      this.place(p);
    }
    if (moved) for (const b of this.batches) b.instanceMatrix.needsUpdate = true;
  }

  private place(p: Shard): void {
    _scale.copy(p.scale).multiplyScalar(this.shown);
    p.mesh.setMatrixAt(p.index, _matrix.compose(p.position, p.quaternion, _scale));
  }
}

/** The colours an object is drawn in (its meshes' materials'), at most three; grey with none. */
function coloursOf(object: THREE.Object3D): THREE.Color[] {
  const out: THREE.Color[] = [];
  object.traverse((o) => {
    const material = (o as Partial<THREE.Mesh>).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      const c = (m as Partial<THREE.MeshStandardMaterial>).color;
      if (c && out.length < 3 && !out.some((x) => x.equals(c))) out.push(c.clone());
    }
  });
  return out.length > 0 ? out : [new THREE.Color('#8a8f96')];
}
