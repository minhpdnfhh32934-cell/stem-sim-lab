/**
 * The meadow of the logistic-growth habitat (illustration): a low wooden fence round the room the
 * picture gives K individuals, and clover patches inside it — lush (leaves and small flowers) or
 * grazed (bare soil with stubble). How many patches are grazed is round(patches · min(1, N/K))
 * (`binding.ts`): a picture of the share of the carrying capacity already used, the (1 − N/K) of
 * the model. The logistic model has no food in it; the patches only illustrate that term.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneKit, Vec3 } from '../../view3d/kit';
import { highlight } from '../../view3d/recipes';
import { fencePosts, type FoodPatch, type LogiLayout } from './layout';

type Part = [THREE.BufferGeometry, THREE.Color, Vec3, Vec3, Vec3?];

/** Merges parts into one vertex-coloured geometry (unit patch: radius about 1). */
function merged(parts: Part[]): THREE.BufferGeometry {
  const flat = parts.map(([g, color, at, scale, rot]) => {
    // Icosahedra are already non-indexed (no copy, no three.js warning).
    const f = g.index ? g.toNonIndexed() : g;
    if (f !== g) g.dispose();
    f.deleteAttribute('uv');
    f.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...at),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot ?? [0, 0, 0]))),
        new THREE.Vector3(...scale),
      ),
    );
    f.computeVertexNormals();
    const n = (f.attributes.position as THREE.BufferAttribute).count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    f.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return f;
  });
  const out = mergeGeometries(flat);
  for (const f of flat) f.dispose();
  out.computeBoundingSphere();
  return out;
}

/** A clover clump: rounded leaves in a ring round a centre, a few small flowers on top. */
export function cloverGeometry(leaf: THREE.Color, leaf2: THREE.Color, flower: THREE.Color) {
  const parts: Part[] = [];
  const ico = (d: number) => new THREE.IcosahedronGeometry(1, d);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + (k % 2) * 0.2;
    const rr = k % 3 === 0 ? 0.25 : 0.62;
    parts.push([
      ico(0),
      k % 2 ? leaf : leaf2,
      [Math.cos(a) * rr, 0.13 + (k % 3) * 0.03, Math.sin(a) * rr],
      [0.36, 0.11, 0.3],
      [0, -a, 0.15],
    ]);
  }
  for (const [x, z] of [
    [0.1, 0.05],
    [-0.42, 0.3],
    [0.38, -0.36],
  ] as const) {
    parts.push([ico(0), flower, [x, 0.3, z], [0.1, 0.09, 0.1]]);
  }
  return merged(parts);
}

/**
 * A grazed patch: a bare, slightly irregular disc of soil fading into the grass at its rim, with a
 * few short stubs of grass left standing.
 */
function grazedGeometry(soil: THREE.Color, rim: THREE.Color, stub: THREE.Color) {
  const circle = new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2);
  const disc = circle.toNonIndexed();
  circle.dispose();
  disc.deleteAttribute('uv');
  const pos = disc.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    // A lobed outline (no two patches look like stepping stones: each is turned its own way).
    const a = Math.atan2(z, x);
    const k = 1 + 0.13 * Math.sin(3 * a + 0.7) + 0.07 * Math.sin(5 * a + 2.1);
    pos.setXYZ(i, x * k * 0.8, 0.025 + 0.02 * (1 - r), z * k * 0.72);
    c.copy(soil).lerp(rim, Math.min(1, r * r * 0.85));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  disc.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  disc.computeVertexNormals();
  const parts: Part[] = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.4;
    const rr = k % 2 ? 0.5 : 0.28;
    parts.push([
      new THREE.ConeGeometry(0.045, 0.1 + 0.03 * (k % 3), 4),
      stub,
      [Math.cos(a) * rr, 0.07, Math.sin(a) * rr * 0.9],
      [1, 1, 1],
    ]);
  }
  const stubs = merged(parts);
  const out = mergeGeometries([disc, stubs]);
  disc.dispose();
  stubs.dispose();
  out.computeBoundingSphere();
  return out;
}

export interface Meadow {
  /** Food patches a tap can hit (both looks). */
  pickables: THREE.Object3D[];
  /** Shows `grazed` of the patches grazed (the first ones, from the centre out). */
  setGrazed(grazed: number): void;
  /** Patches drawn now. */
  drawn(): { lush: number; grazed: number };
  /** A lush patch near the fence's front (world) for its name callout, or null when none. */
  foodPoint(): Vec3 | null;
  /** The fence's front post top (world) for its name callout. */
  fencePoint(): Vec3;
  select(on: boolean): void;
}

export function meadow(
  kit: SceneKit,
  L: LogiLayout,
  heightAt: (x: number, z: number) => number,
): Meadow {
  const col = (name: string) => new THREE.Color(kit.color(name));
  const material = kit.shared(
    'logi-meadow-mat',
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        flatShading: true,
        roughness: 0.88,
        envMapIntensity: 0.4,
      }),
  );
  // Clover a deeper, greener shade than the meadow (the islands' natural grass greens).
  const leaf = col('--bio3d-island-grass');
  const leaf2 = col('--bio3d-island-grass-2');
  const flower = col('--bio3d-sand');
  const soil = col('--bio3d-soil');
  const stub = col('--bio3d-grass').lerp(soil, 0.45);

  const food: readonly FoodPatch[] = L.food;
  const n = Math.max(1, food.length);
  const lush = kit.instanced(kit.geometry(cloverGeometry(leaf, leaf2, flower)), material, n);
  lush.name = 'logi-food-lush';
  const bare = kit.instanced(
    kit.geometry(grazedGeometry(soil, col('--bio3d-grass').lerp(soil, 0.35), stub)),
    material,
    n,
  );
  bare.name = 'logi-food-grazed';
  lush.receiveShadow = kit.shadows;
  bare.receiveShadow = kit.shadows;
  const mat = food.map((p) => {
    const y = heightAt(p.x, p.z) - 0.02;
    return new THREE.Matrix4().compose(
      new THREE.Vector3(p.x, y, p.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw),
      new THREE.Vector3(p.size, p.size, p.size),
    );
  });
  let grazedNow = 0;
  const setGrazed = (g: number) => {
    const k = Math.max(0, Math.min(food.length, Math.floor(g)));
    grazedNow = k;
    for (let i = 0; i < k; i++) bare.setMatrixAt(i, mat[i] ?? new THREE.Matrix4());
    for (let i = k; i < food.length; i++) lush.setMatrixAt(i - k, mat[i] ?? new THREE.Matrix4());
    bare.count = k;
    lush.count = food.length - k;
    bare.instanceMatrix.needsUpdate = true;
    lush.instanceMatrix.needsUpdate = true;
    lush.boundingSphere = null;
    bare.boundingSphere = null;
  };
  setGrazed(0);

  // The fence: posts (one draw) and two rails between neighbouring posts (one draw), in bark.
  const posts = fencePosts(L);
  const wood = kit.solid(kit.color('--bio3d-bark'), { roughness: 0.9 });
  const POST_H = 0.72;
  const postMesh = kit.instanced(kit.cylinder(6), wood, posts.length);
  postMesh.name = 'logi-fence-posts';
  postMesh.castShadow = kit.shadows;
  postMesh.raycast = () => undefined;
  // A plain box per rail (12 triangles: rounded edges would cost a hundred times more).
  const rail = kit.shared('logi-rail', () => new THREE.BoxGeometry(2, 2, 2));
  const railMesh = kit.instanced(rail, wood, posts.length * 2);
  railMesh.name = 'logi-fence-rails';
  railMesh.castShadow = kit.shadows;
  railMesh.raycast = () => undefined;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const tops = posts.map(([x, z]) => heightAt(x, z));
  posts.forEach(([x, z], i) => {
    const y = tops[i] ?? 0;
    m.compose(
      new THREE.Vector3(x, y + POST_H / 2 - 0.08, z),
      q.identity(),
      new THREE.Vector3(0.075, POST_H + 0.16, 0.075),
    );
    postMesh.setMatrixAt(i, m);
  });
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const xAxis = new THREE.Vector3(1, 0, 0);
  let r = 0;
  for (let i = 0; i < posts.length; i++) {
    const p0 = posts[i];
    const p1 = posts[(i + 1) % posts.length];
    if (!p0 || !p1) continue;
    for (const h of [0.3, 0.58]) {
      a.set(p0[0], (tops[i] ?? 0) + h, p0[1]);
      b.set(p1[0], (tops[(i + 1) % posts.length] ?? 0) + h, p1[1]);
      dir.subVectors(b, a);
      const len = dir.length();
      q.setFromUnitVectors(xAxis, dir.normalize());
      m.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(len / 2, 0.035, 0.03));
      railMesh.setMatrixAt(r++, m);
    }
  }
  railMesh.count = r;
  postMesh.instanceMatrix.needsUpdate = true;
  railMesh.instanceMatrix.needsUpdate = true;

  // The picked food: a glowing ring on the ground round every patch is too busy; the patches
  // glow a little instead (one shared material per look).
  const glow = kit.own(
    highlight(
      kit,
      new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, flatShading: true }),
      0.35,
    ),
  );

  // The front of the fence (towards the camera, +z).
  let front = 0;
  posts.forEach(([, z], i) => {
    if (z > (posts[front]?.[1] ?? -Infinity)) front = i;
  });
  const frontPost = posts[front] ?? [L.meadow.x, L.fenceR];

  return {
    pickables: [lush, bare],
    setGrazed,
    drawn: () => ({ lush: lush.count, grazed: bare.count }),
    foodPoint() {
      // The lush patch nearest the fence's front-left (in view beside the crowd).
      let best: Vec3 | null = null;
      let bestD = Infinity;
      const fx = L.meadow.x - L.fenceR * 0.5;
      const fz = L.fenceR * 0.75;
      for (let i = grazedNow; i < food.length; i++) {
        const p = food[i];
        if (!p) continue;
        const d = Math.hypot(p.x - fx, p.z - fz);
        if (d < bestD) {
          bestD = d;
          best = [p.x, heightAt(p.x, p.z) + 0.25, p.z];
        }
      }
      return best;
    },
    fencePoint: () => [frontPost[0], heightAt(frontPost[0], frontPost[1]) + POST_H, frontPost[1]],
    select(on) {
      lush.material = on ? glow : material;
      bare.material = on ? glow : material;
    },
  };
}
