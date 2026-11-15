/**
 * The 3D illustration of "Khái quát về virus" with the biology kit: an icosahedral capsid of
 * capsomeres (one instanced draw) around a coiled nucleic acid core, and, for an enveloped virus,
 * a see-through envelope with glycoprotein spikes (stalks and heads, two instanced draws). A tap
 * picks a part (the envelope lets taps through to what is inside). Static; the kit frees it all.
 */
import * as THREE from 'three';
import { pickFirst } from '@/ui/three/pick';
import { NEUTRAL, type Bio3DScene, type SceneKit } from '../view3d/kit';
import { muted, structureColor } from '../view3d/palette';
import { highlight, membrane } from '../view3d/recipes';
import {
  VIRUS_SIZE,
  anchors,
  capsomereCentres,
  coreCoil,
  nearestCapsomere,
  sphereDirections,
} from './geometry';
import { partsShown, type VirusPart } from './parts';

export interface VirusSceneOptions {
  enveloped: boolean;
  /** Part names to write ("Hiện tên"), or null: none. */
  names: Readonly<Partial<Record<VirusPart, string>>> | null;
}

export function buildVirusScene(kit: SceneKit, o: VirusSceneOptions): Bio3DScene {
  const S = VIRUS_SIZE;
  const tok = (n: string) => kit.color(n);
  const partOf = new Map<THREE.Object3D, VirusPart>();
  const mats = new Map<VirusPart, THREE.MeshStandardMaterial[]>();
  const pickables: THREE.Object3D[] = [];
  const own = (part: VirusPart, obj: THREE.Object3D, list: THREE.MeshStandardMaterial[]) => {
    partOf.set(obj, part);
    pickables.push(obj);
    mats.set(part, [...(mats.get(part) ?? []), ...list]);
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // Core: a coiled thread (the nucleic acid), inside the capsid.
  const coil = new THREE.CatmullRomCurve3(coreCoil(S.core).map((v) => new THREE.Vector3(...v)));
  const coreMat = kit.solid(muted(tok, '--chart-5'), { sheen: 0.2 });
  const core = kit.mesh(kit.geometry(new THREE.TubeGeometry(coil, 400, 0.07, 8, false)), coreMat);
  own('core', core, [coreMat]);

  // Capsid: capsomeres on an icosahedron; instance colours mark the "capsomere" pick.
  const centres = capsomereCentres(S.capsid, S.facets);
  const capColor = new THREE.Color(structureColor(tok, 'protein'));
  const capMat = kit.solid(NEUTRAL, { sheen: 0.3 });
  const caps = kit.instanced(kit.sphere(1), capMat, centres.length);
  centres.forEach((c, k) => {
    caps.setMatrixAt(k, m4.compose(p.set(...c), q.identity(), s.setScalar(S.capsomere)));
    caps.setColorAt(k, capColor);
  });
  caps.instanceMatrix.needsUpdate = true;
  own('capsid', caps, [capMat]);
  const front = nearestCapsomere(centres, anchors(o.enveloped).capsomere);

  // Envelope and spikes.
  let spikeCount = 0;
  if (o.enveloped) {
    const env = membrane(
      kit,
      kit.geometry(new THREE.SphereGeometry(S.envelope, kit.seg * 2, kit.seg * 1.5)),
      { radius: S.envelope, outermost: true },
    );
    env.children.forEach((m) => {
      if (m instanceof THREE.Mesh && m.material instanceof THREE.MeshStandardMaterial)
        own('envelope', m, [m.material]);
    });
    const dirs = sphereDirections(S.spikes);
    spikeCount = dirs.length;
    const spikeMat = kit.solid(muted(tok, '--chart-2'), { sheen: 0.3 });
    const stalks = kit.instanced(kit.cylinder(), spikeMat, dirs.length);
    const heads = kit.instanced(kit.sphere(0.6), spikeMat, dirs.length);
    dirs.forEach((d, k) => {
      const dir = new THREE.Vector3(...d);
      q.setFromUnitVectors(up, dir);
      p.copy(dir).multiplyScalar(S.envelope + S.spikeLength / 2);
      stalks.setMatrixAt(k, m4.compose(p, q, s.set(0.05, S.spikeLength, 0.05)));
      p.copy(dir).multiplyScalar(S.envelope + S.spikeLength);
      heads.setMatrixAt(k, m4.compose(p, q, s.set(0.13, 0.1, 0.13)));
    });
    stalks.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    own('spikes', stalks, [spikeMat]);
    own('spikes', heads, []);
  }

  const at = anchors(o.enveloped);
  const named: VirusPart[] = [];
  if (o.names)
    for (const part of partsShown(o.enveloped)) {
      const text = o.names[part];
      if (!text) continue;
      kit.label(text, at[part]);
      named.push(part);
    }

  const hiColor = new THREE.Color(tok('--m3d-highlight'));
  let selected: VirusPart | null = null;
  const select = (id: string | null) => {
    selected = partsShown(o.enveloped).find((x) => x === id) ?? null;
    for (const [part, list] of mats)
      for (const mat of list) {
        if (part === selected) highlight(kit, mat, 0.6);
        else {
          mat.emissive.set(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    caps.setColorAt(front, selected === 'capsomere' ? hiColor : capColor);
    if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
  };

  return {
    kit,
    bounds: {
      center: [0, 0, 0],
      radius: (o.enveloped ? S.envelope + S.spikeLength : S.capsid + S.capsomere) * 1.15,
    },
    pick: (ray) => {
      const hit = pickFirst(ray, pickables, {
        isContainer: (obj) => partOf.get(obj) === 'envelope',
      });
      return hit ? (partOf.get(hit.object) ?? null) : null;
    },
    select,
    state: () => ({
      enveloped: o.enveloped,
      capsomeres: centres.length,
      spikes: spikeCount,
      parts: partsShown(o.enveloped),
      named,
      selected,
    }),
  };
}
