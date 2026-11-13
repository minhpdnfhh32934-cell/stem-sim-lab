import * as THREE from 'three';

/**
 * Building blocks for apparatus drawn as assemblies (launcherModel, pendulumModel): one owner for
 * what a model creates, so `dispose()` frees all of it — geometries, materials, and the transform
 * buffers of instanced parts, which only InstancedMesh.dispose frees (P3.6 found them leaking) —
 * and solids three's primitives lack, without the Shape/Curve family ExtrudeGeometry would bring
 * into the bundle.
 */
export class Assembly {
  readonly group = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly instanced: THREE.InstancedMesh[] = [];

  /** Takes ownership of a geometry: freed with the assembly. */
  readonly keep = <T extends THREE.BufferGeometry>(geometry: T): T => {
    this.geometries.push(geometry);
    return geometry;
  };

  /** Takes ownership of a material: freed with the assembly. */
  readonly own = <T extends THREE.Material>(material: T): T => {
    this.materials.push(material);
    return material;
  };

  /** A part casting and receiving shadows, added to `parent` (the assembly's group by default). */
  readonly mesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Object3D = this.group,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  /** One draw call for repeated parts (feet, bolts, gussets): a transform per copy. */
  readonly copies = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    transforms: THREE.Matrix4[],
    parent: THREE.Object3D = this.group,
  ): THREE.InstancedMesh => {
    const m = new THREE.InstancedMesh(geometry, material, transforms.length);
    this.instanced.push(m);
    transforms.forEach((t, i) => m.setMatrixAt(i, t));
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  /** Frees everything it owns (never a material it was only given, such as the entity's own). */
  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const m of this.instanced) m.dispose();
  }
}

/** A part with materials it switches to later (`swaps`). */
type Swapping = THREE.Object3D & { swaps?: readonly THREE.Material[] };

/**
 * Names the materials `part` switches to later (a lamp lit, another surface), so the renderer
 * compiles them with the scene (WorldRenderer) and not at their first use, a long frame (a 70 ms
 * link on ANGLE/D3D11, labs bench). A property, not `userData`: three copies that as JSON.
 */
export function swaps(part: THREE.Mesh, ...materials: THREE.Material[]): void {
  (part as Swapping).swaps = materials;
}

/** The materials `object` switches to later (`swaps`), or none. */
export const swapsOf = (object: THREE.Object3D): readonly THREE.Material[] =>
  (object as Swapping).swaps ?? [];

/** A part's transform: at (x, y, z), turned by (rx, ry, rz). */
export const at = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  );

/** A convex outline, counter-clockwise from +z, shrunk by `inset` for a chamfer. */
export type Outline = (inset: number) => THREE.Vector2[];

/** Points along an arc about (cx, cy), from angle a0 to a1, `n` segments. */
export function arc(cx: number, cy: number, radius: number, a0: number, a1: number, n: number) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = a0 + ((a1 - a0) * i) / n;
    return new THREE.Vector2(cx + radius * Math.cos(t), cy + radius * Math.sin(t));
  });
}

/**
 * A solid between convex outlines stacked along z — the same outline, shrunk by `inset` (a
 * chamfer) or not, at each level — closed by flat ends. Each band between two levels shares its
 * vertices only around the outline, so it is smooth along arcs and creased between levels; a
 * corner sharper than 30° keeps its edge. Outlines are counter-clockwise seen from +z.
 * (Instead of three's ExtrudeGeometry, which brings the whole Shape/Curve family into the bundle.)
 */
export function loft(outline: Outline, levels: [inset: number, z: number][]) {
  const rings = levels.map(([inset, z]) => ({ points: outline(inset), z }));
  const first = rings[0]?.points ?? [];
  const sharp = first.map((p, i) => {
    const prev = first[(i + first.length - 1) % first.length] ?? p;
    const next = first[(i + 1) % first.length] ?? p;
    const turn = p.clone().sub(prev).angle() - next.clone().sub(p).angle();
    return Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) > Math.PI / 6;
  });
  const positions: number[] = [];
  const indices: number[] = [];
  const vertex = (p: THREE.Vector2, z: number) => positions.push(p.x, p.y, z) / 3 - 1;
  // Around the outline: a sharp corner is two vertices, one for each side.
  const around = (points: THREE.Vector2[], z: number) =>
    points.flatMap((p, i) => (sharp[i] ? [vertex(p, z), vertex(p, z)] : [vertex(p, z)]));
  for (let k = 0; k + 1 < rings.length; k++) {
    const lower = rings[k];
    const upper = rings[k + 1];
    if (!lower || !upper) continue;
    const a = around(lower.points, lower.z);
    const b = around(upper.points, upper.z);
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      // The second copy of a sharp corner starts the next side; skip the zero-width face.
      if (
        positions[3 * (a[i] ?? 0)] === positions[3 * (a[j] ?? 0)] &&
        positions[3 * (a[i] ?? 0) + 1] === positions[3 * (a[j] ?? 0) + 1]
      )
        continue;
      indices.push(a[i] ?? 0, a[j] ?? 0, b[j] ?? 0, a[i] ?? 0, b[j] ?? 0, b[i] ?? 0);
    }
  }
  const cap = (ring: (typeof rings)[number] | undefined, up: boolean) => {
    if (!ring) return;
    const ids = ring.points.map((p) => vertex(p, ring.z));
    for (let i = 1; i + 1 < ids.length; i++) {
      const [x, y, z] = [ids[0] ?? 0, ids[i] ?? 0, ids[i + 1] ?? 0];
      indices.push(...(up ? [x, y, z] : [x, z, y]));
    }
  };
  cap(rings[0], false);
  cap(rings.at(-1), true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A rectangle with rounded corners, `width` by `depth`, centred, shrunk by the inset. */
export const roundRect =
  (width: number, depth: number, corner: number): Outline =>
  (inset) => {
    const x = width / 2 - inset;
    const z = depth / 2 - inset;
    const c = Math.max(0.001, Math.min(corner, x, z) - inset);
    return [
      ...arc(x - c, -z + c, c, -Math.PI / 2, 0, 4),
      ...arc(x - c, z - c, c, 0, Math.PI / 2, 4),
      ...arc(-x + c, z - c, c, Math.PI / 2, Math.PI, 4),
      ...arc(-x + c, -z + c, c, Math.PI, Math.PI * 1.5, 4),
    ];
  };

/** A flat slab with rounded corners and chamfered edges, `height` up from y = 0, centred in x, z. */
export function slab(width: number, depth: number, height: number, corner: number, bevel: number) {
  const geometry = loft(roundRect(width, depth, corner), [
    [bevel, 0],
    [0, bevel],
    [0, height - bevel],
    [bevel, height],
  ]);
  geometry.rotateX(-Math.PI / 2); // stacked up (+y); the outline's y becomes −z
  return geometry;
}
