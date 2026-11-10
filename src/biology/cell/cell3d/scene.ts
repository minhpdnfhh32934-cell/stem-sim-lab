/**
 * The 3D picture of "Tế bào nhân sơ và nhân thực" (#37 §15): the layout of `layout.ts` drawn with
 * the biology kit. Membranes and walls are see-through shells, so the organelles inside stay
 * visible; each kind of organelle is one instanced draw. A tap picks the part under the pointer:
 * an organelle wins over the shells and the cytoplasm around it. Static: nothing moves, nothing
 * is allocated per frame; every geometry and material belongs to the kit (freed with it).
 */
import * as THREE from 'three';
import { pickFirst } from '@/ui/three/pick';
import type { Bio3DScene, SceneKit } from '../../view3d/kit';
import { muted, structureColor } from '../../view3d/palette';
import { highlight, membrane, shell } from '../../view3d/recipes';
import type { CellKind, PartId } from '../parts';
import { cellLayout, drawnParts, grown, type Body, type Piece } from './layout';

export interface CellSceneOptions {
  kind: CellKind;
  /** Part names to write ("Hiện tên"), or null: none. */
  names: Readonly<Partial<Record<PartId, string>>> | null;
}

/** Shells and the cytoplasm: a tap goes through them to an organelle behind. */
export const CONTAINERS: ReadonlySet<PartId> = new Set([
  'membrane',
  'cytoplasm',
  'prokCytoplasm',
  'plantWall',
  'bacterialWall',
  'outerMembrane',
]);

/** One colour role per part (no two parts of one cell alike); structures are muted. */
const TOKEN: Record<PartId, string> = {
  outerMembrane: '--chart-5',
  bacterialWall: '--chart-2',
  plantWall: '--chart-2',
  membrane: '',
  prokCytoplasm: '--chart-6',
  cytoplasm: '--chart-6',
  nucleoid: '--chart-4',
  plasmid: '--chart-5',
  ribosome: '--chart-1',
  nucleus: '',
  er: '--chart-6',
  golgi: '--chart-7',
  lysosome: '--chart-5',
  peroxysome: '--chart-2',
  vacuole: '--chart-6',
  mitochondrion: '--chart-4',
  chloroplast: '--chart-3',
  cytoskeleton: '--chart-1',
  centrosome: '--chart-7',
  flagellum: '--chart-2',
  pili: '--chart-2',
};

function colorOf(kit: SceneKit, part: PartId): string {
  const tok = (n: string) => kit.color(n);
  if (part === 'membrane') return structureColor(tok, 'membrane');
  if (part === 'nucleus') return structureColor(tok, 'nucleus');
  return muted(tok, TOKEN[part]);
}

/** The body's outline grown by g, as a geometry with its placement. */
function outline(
  kit: SceneKit,
  body: Body,
  g: number,
): { geo: THREE.BufferGeometry; rotZ: number } {
  const b = grown(body, g);
  const [hx, hy, hz] = b.half;
  if (body.shape === 'sphere') {
    const geo = kit.geometry(new THREE.SphereGeometry(hx, kit.seg * 2, kit.seg * 1.5));
    return { geo, rotZ: 0 };
  }
  if (body.shape === 'capsule') {
    // Along +y, then laid along x.
    const geo = kit.geometry(new THREE.CapsuleGeometry(hy, 2 * (hx - hy), 6, kit.seg * 2));
    return { geo, rotZ: Math.PI / 2 };
  }
  const geo = kit.geometry(kit.roundedBox().clone().scale(hx, hy, hz));
  return { geo, rotZ: 0 };
}

/** A helix from x = 0 to x = length around the x axis (the flagellum), as a tube. */
function helixGeometry(kit: SceneKit, length: number, radius: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const turns = 3;
  for (let i = 0; i <= 96; i++) {
    const u = i / 96;
    const a = u * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(u * length, radius * Math.cos(a), radius * Math.sin(a)));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return kit.geometry(new THREE.TubeGeometry(curve, 160, 0.06, 8, false));
}

function unitGeometry(kit: SceneKit, piece: Piece): THREE.BufferGeometry {
  switch (piece.shape) {
    case 'sphere':
      return kit.sphere(1);
    case 'capsule':
      return kit.capsule(1, 4);
    case 'torus':
      return kit.geometry(new THREE.TorusGeometry(1, piece.tube ?? 0.15, 10, 56));
    default:
      // disc, rod: the unit cylinder (radius 1, height 1 along y)
      return kit.cylinder();
  }
}

export function buildCellScene(kit: SceneKit, o: CellSceneOptions): Bio3DScene {
  const l = cellLayout(o.kind);
  const partOf = new Map<THREE.Object3D, PartId>();
  const materials = new Map<PartId, THREE.MeshStandardMaterial[]>();
  const pickables: THREE.Object3D[] = [];
  const own = (part: PartId, obj: THREE.Object3D, mats: THREE.MeshStandardMaterial[]) => {
    partOf.set(obj, part);
    pickables.push(obj);
    materials.set(part, [...(materials.get(part) ?? []), ...mats]);
  };
  const radius = Math.max(...l.body.half);

  // Walls and membranes (outermost first), then the cytoplasm as a faint inner volume.
  l.layers.forEach((layer, i) => {
    const { geo, rotZ } = outline(kit, l.body, layer.grow);
    const g =
      layer.part === 'membrane'
        ? membrane(kit, geo, { radius, outermost: i === 0 })
        : shell(kit, geo, colorOf(kit, layer.part), { radius, outermost: i === 0 });
    g.rotation.z = rotZ;
    g.children.forEach((m) => {
      if (m instanceof THREE.Mesh && m.material instanceof THREE.MeshStandardMaterial)
        own(layer.part, m, [m.material]);
    });
  });
  {
    const { geo, rotZ } = outline(kit, l.body, -0.06);
    const g = shell(kit, geo, colorOf(kit, l.fill), { radius, opacity: 0.08, rim: 0 });
    g.rotation.z = rotZ;
    g.children.forEach((m) => {
      if (m instanceof THREE.Mesh && m.material instanceof THREE.MeshStandardMaterial)
        own(l.fill, m, [m.material]);
    });
  }

  // Organelles and the parts outside: one instanced draw per piece (the flagellum: one tube).
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (const piece of l.pieces) {
    const mat = kit.solid(colorOf(kit, piece.part), {
      sheen: 0.3,
      ...(piece.part === 'vacuole' ? { fades: true } : {}),
    });
    if (piece.part === 'vacuole') mat.opacity = 0.45;
    if (piece.shape === 'helix') {
      const it = piece.items[0];
      if (!it) continue;
      const mesh = kit.mesh(helixGeometry(kit, it.scale[0], it.scale[1]), mat);
      mesh.position.set(...it.at);
      own(piece.part, mesh, [mat]);
      continue;
    }
    const mesh = kit.instanced(unitGeometry(kit, piece), mat, piece.items.length);
    piece.items.forEach((it, k) => {
      q.setFromEuler(e.set(...it.rot));
      mesh.setMatrixAt(k, m4.compose(p.set(...it.at), q, s.set(...it.scale)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    own(piece.part, mesh, [mat]);
  }

  // Names ("Hiện tên"): only parts this cell really has.
  const named: PartId[] = [];
  if (o.names)
    for (const part of drawnParts(l)) {
      const at = l.anchors[part];
      const text = o.names[part];
      if (at && text) {
        kit.label(text, at);
        named.push(part);
      }
    }

  let selected: PartId | null = null;
  const select = (id: string | null) => {
    selected = null;
    for (const [part, mats] of materials) {
      const on = part === id;
      if (on) selected = part;
      for (const mat of mats) {
        if (on) highlight(kit, mat, 0.6);
        else {
          mat.emissive.set(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    }
  };

  const ext =
    o.kind === 'bacterium'
      ? { center: [2.5, 0, 0] as [number, number, number], radius: 7.4 }
      : { center: [0, 0, 0] as [number, number, number], radius: radius * 1.12 };
  return {
    kit,
    bounds: ext,
    pick: (ray) => {
      const hit = pickFirst(ray, pickables, {
        isContainer: (obj) => CONTAINERS.has(partOf.get(obj) ?? 'membrane'),
      });
      return hit ? (partOf.get(hit.object) ?? null) : null;
    },
    select,
    state: () => ({ kind: o.kind, parts: drawnParts(l), named, selected }),
  };
}
