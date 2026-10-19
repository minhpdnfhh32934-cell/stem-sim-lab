import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { componentsFor, type Selection } from './components';
import { buildMitosisScene, type ScenePalette } from './scene';
import { buildTimeline, type CellType, type Timeline } from './timeline';

const PALETTE: ScenePalette = {
  maternal: 'rgb(213, 94, 0)',
  paternal: 'rgb(0, 114, 178)',
  centromere: 'rgb(23, 32, 51)',
  membrane: 'rgb(22, 128, 74)',
  envelope: 'rgb(47, 98, 216)',
  nucleolus: 'rgb(86, 180, 233)',
  wall: 'rgb(154, 107, 0)',
  spindle: 'rgb(138, 147, 165)',
  centrosome: 'rgb(204, 121, 167)',
  plate: 'rgb(0, 158, 115)',
  ring: 'rgb(230, 159, 0)',
  highlight: 'rgb(47, 98, 216)',
};

afterEach(() => {
  vi.restoreAllMocks();
});

function collect(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      geometries.add(o.geometry as THREE.BufferGeometry);
      materials.add(o.material as THREE.Material);
    }
  });
  return { geometries, materials };
}

/** Materials on objects that are drawn (the object and all its parents visible). */
function visibleMaterials(scene: THREE.Scene): Set<THREE.Material> {
  const out = new Set<THREE.Material>();
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return;
    out.add(o.material as THREE.Material);
  });
  return out;
}

/** three.js numbers every material (`Material.id`, documented, missing from @types/three). */
const materialId = (m: unknown) => (m as THREE.Material & { readonly id: number }).id;

/**
 * Ids the next BufferGeometry / Material will get: three.js numbers both in creation order, so
 * everything created between two probes has an id strictly between theirs.
 */
function nextIds() {
  return { geometry: new THREE.BufferGeometry().id, material: materialId(new THREE.Material()) };
}
const idsBetween = (a: number, b: number) => Array.from({ length: b - a - 1 }, (_, k) => a + 1 + k);

/** Ids of the geometries / materials whose dispose() has been called since this was set up. */
function trackDisposal() {
  const geo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
  const mat = vi.spyOn(THREE.Material.prototype, 'dispose');
  return {
    geometries: () => new Set(geo.mock.contexts.map((g) => (g as THREE.BufferGeometry).id)),
    materials: () => new Set(mat.mock.contexts.map(materialId)),
  };
}

/** Three moments of every stage plus its key moment (furrow and cell plate mid-way included). */
function visitTimes(tl: Timeline): number[] {
  return tl.stages.flatMap((w) => [
    ...[0.1, 0.5, 0.9].map((u) => w.start + u * (w.end - w.start)),
    tl.keyTime(w.id),
  ]);
}

describe('3D mitosis scene', () => {
  for (const type of ['animal', 'plant'] as CellType[]) {
    it(`${type}: every listed part can be highlighted; dispose() frees all it created`, () => {
      const tl = buildTimeline(2, type);
      const track = trackDisposal();
      const start = nextIds();
      const ms = buildMitosisScene(tl, PALETTE, { segments: 12 });
      const times = visitTimes(tl);
      const used = {
        geometries: new Set<THREE.BufferGeometry>(),
        materials: new Set<THREE.Material>(),
      };
      const visit = () => {
        const c = collect(ms.scene);
        c.geometries.forEach((g) => used.geometries.add(g));
        c.materials.forEach((m) => used.materials.add(m));
      };
      // The materials drawn when nothing is selected…
      const plain = new Set<THREE.Material>();
      for (const t of times) {
        ms.update(tl.stateAt(t));
        visibleMaterials(ms.scene).forEach((m) => plain.add(m));
        visit();
      }
      // …and every part of the list (as picked from the list, and as clicked on a chromosome)
      // swaps some drawn object to a highlight material at some moment.
      for (const component of componentsFor(type)) {
        let lit = false;
        const picks: Selection[] = [{ component }, { component, chromosome: 1, sister: 1 }];
        for (const sel of picks) {
          ms.setSelection(sel);
          for (const t of times) {
            ms.update(tl.stateAt(t));
            // A drawn object wears a highlight material (dimmed ones do not count).
            for (const m of visibleMaterials(ms.scene)) if (m.userData.look === 'hi') lit = true;
            visit();
          }
        }
        expect(lit, component).toBe(true);
      }
      ms.setSelection(null);
      const end = nextIds();
      // Playing and selecting freed nothing.
      expect(track.geometries().size).toBe(0);
      expect(track.materials().size).toBe(0);
      ms.dispose();
      const freedGeo = track.geometries();
      const freedMat = track.materials();
      const madeGeo = idsBetween(start.geometry, end.geometry);
      const madeMat = idsBetween(start.material, end.material);
      expect(madeGeo.length).toBeGreaterThan(5);
      expect(madeMat.length).toBeGreaterThan(5);
      // Every geometry and material the scene created is freed (used or not)…
      expect(madeGeo.filter((id) => !freedGeo.has(id))).toEqual([]);
      expect(madeMat.filter((id) => !freedMat.has(id))).toEqual([]);
      // …including everything it drew (normal and highlighted).
      for (const g of used.geometries) expect(freedGeo.has(g.id)).toBe(true);
      for (const m of used.materials) expect(freedMat.has(materialId(m))).toBe(true);
      expect(ms.scene.children).toHaveLength(0);
    });

    it(`${type}: replays create and free nothing; a rebuild frees the old scene entirely`, () => {
      const tl = buildTimeline(4, type);
      const other = buildTimeline(2, type === 'animal' ? 'plant' : 'animal');
      const track = trackDisposal();
      const s0 = nextIds();
      let ms = buildMitosisScene(tl, PALETTE, { segments: 12 });
      const s1 = nextIds();
      const made = {
        geometries: idsBetween(s0.geometry, s1.geometry),
        materials: idsBetween(s0.material, s1.material),
      };
      ms.update(tl.stateAt(0));
      const first = ms.stats();
      // 20 replays with selections: no geometry or material is created or freed.
      for (let replay = 0; replay < 20; replay++) {
        ms.setSelection(replay % 2 ? { component: 'spindle' } : { component: 'centromere' });
        for (let t = 0; t <= tl.total; t += 0.7) ms.update(tl.stateAt(t));
        ms.update(tl.stateAt(tl.total));
        expect(ms.stats()).toEqual(first);
      }
      const s2 = nextIds();
      expect(idsBetween(s1.geometry, s2.geometry)).toEqual([]);
      expect(idsBetween(s1.material, s2.material)).toEqual([]);
      expect(track.geometries().size).toBe(0);
      expect(track.materials().size).toBe(0);
      // Rebuilds (another cell type or 2n, a theme or quality change): after each one only the
      // new scene's geometries and materials are alive.
      for (let k = 0; k < 6; k++) {
        ms.dispose();
        const a = nextIds();
        const next = k % 2 ? tl : other;
        ms = buildMitosisScene(next, PALETTE, { segments: k % 3 ? 24 : 12 });
        const b = nextIds();
        for (const t of visitTimes(next)) ms.update(next.stateAt(t));
        const geometries = idsBetween(a.geometry, b.geometry);
        const materials = idsBetween(a.material, b.material);
        made.geometries.push(...geometries);
        made.materials.push(...materials);
        const freedGeo = track.geometries();
        const freedMat = track.materials();
        expect(made.geometries.filter((id) => !freedGeo.has(id))).toEqual(geometries);
        expect(made.materials.filter((id) => !freedMat.has(id))).toEqual(materials);
      }
      ms.dispose();
      const freedGeo = track.geometries();
      const freedMat = track.materials();
      expect(made.geometries.filter((id) => !freedGeo.has(id))).toEqual([]);
      expect(made.materials.filter((id) => !freedMat.has(id))).toEqual([]);
    });
  }

  it('animal and plant scenes never show the other cell type’s parts', () => {
    const show = (type: CellType, t: number) => {
      const tl = buildTimeline(2, type);
      const ms = buildMitosisScene(tl, PALETTE, { segments: 12 });
      ms.update(tl.stateAt(t));
      const parts = new Set<string>();
      ms.scene.traverse((o) => {
        let visible = o.visible;
        for (let p = o.parent; p; p = p.parent) visible &&= p.visible;
        const part = (o.userData as { part?: string }).part;
        if (visible && part) parts.add(part);
      });
      ms.dispose();
      return parts;
    };
    for (const frac of [0.1, 0.4, 0.6, 0.97]) {
      const animal = show('animal', buildTimeline(2, 'animal').total * frac);
      expect(animal.has('wall')).toBe(false);
      expect(animal.has('plate')).toBe(false);
      expect(animal.has('centrosome')).toBe(true);
      const plant = show('plant', buildTimeline(2, 'plant').total * frac);
      expect(plant.has('centrosome')).toBe(false);
      expect(plant.has('ring')).toBe(false);
      expect(plant.has('wall')).toBe(true);
    }
    const tlA = buildTimeline(2, 'animal');
    // Half-way through cytokinesis the furrow is still closing: the ring is there.
    const cyto = tlA.stages.find((w) => w.id === 'cytokinesis');
    if (!cyto) throw new Error('no cytokinesis stage');
    const mid = cyto.start + 0.5 * (cyto.end - cyto.start);
    expect(tlA.stateAt(mid).shape).toMatchObject({ type: 'animal', separated: false });
    const ring = show('animal', mid);
    expect(ring.has('ring')).toBe(true);
    const tlP = buildTimeline(2, 'plant');
    expect(show('plant', tlP.total).has('plate')).toBe(true);
  });

  it('a picked single chromosome (after the split) highlights only that sister', () => {
    const tl = buildTimeline(2, 'animal');
    const ms = buildMitosisScene(tl, PALETTE, { segments: 12 });
    const lit = () => {
      const out = new Set<string>();
      ms.scene.traverse((o) => {
        const data = o.userData as { part?: string; chromatid?: number };
        if (data.chromatid === undefined || !(o instanceof THREE.Mesh)) return;
        const mat = o.material as THREE.MeshStandardMaterial;
        const info = tl.chromatids[data.chromatid];
        if (info && mat.emissive.getHex() !== 0)
          out.add(`${data.part ?? ''}:${String(info.chromosome)}/${String(info.sister)}`);
      });
      return out;
    };
    for (const stage of ['anaphase', 'telophase', 'cytokinesis'] as const) {
      ms.update(tl.stateAt(tl.keyTime(stage)));
      ms.setSelection({ component: 'singleChromosome', chromosome: 1, sister: 1 });
      const arms = [...lit()].filter((k) => k.startsWith('arm:') || k.startsWith('thread:'));
      expect(arms.length).toBeGreaterThan(0);
      for (const k of arms) expect(k.endsWith(':1/1')).toBe(true);
      // The split centromere of that sister only.
      ms.setSelection({ component: 'centromere', chromosome: 1, sister: 1 });
      expect([...lit()]).toEqual(['bead:1/1']);
    }
    // Before the split the centromere is shared: both sisters' beads light up.
    ms.update(tl.stateAt(tl.keyTime('metaphase')));
    ms.setSelection({ component: 'centromere', chromosome: 1, sister: 1 });
    expect([...lit()].sort()).toEqual(['bead:1/0', 'bead:1/1']);
    // From the parts list (no chromosome picked) every single chromosome is shown.
    ms.update(tl.stateAt(tl.keyTime('anaphase')));
    ms.setSelection({ component: 'singleChromosome' });
    expect([...lit()].filter((k) => k.startsWith('arm:'))).toHaveLength(tl.chromatids.length);
    ms.dispose();
  });

  it('picking a split centromere names its sister', () => {
    const tl = buildTimeline(2, 'animal');
    const ms = buildMitosisScene(tl, PALETTE, { segments: 16 });
    const st = tl.stateAt(tl.keyTime('anaphase'));
    ms.update(st);
    ms.scene.updateMatrixWorld(true);
    // Straight down the spindle axis onto the bead of the chromatid nearest the +x pole.
    const c = st.chromatids
      .filter((x) => x.present)
      .sort((a, b) => b.centromere[0] - a.centromere[0])[0]!;
    const ray = new THREE.Raycaster(
      new THREE.Vector3(30, c.centromere[1], c.centromere[2]),
      new THREE.Vector3(-1, 0, 0),
    );
    ray.params.Line = { threshold: 0.01 };
    const hit = ms.pick(ray);
    expect(hit).toEqual({ component: 'centromere', chromosome: c.chromosome, sister: c.sister });
    ms.dispose();
  });

  it('picks the chromosome in front of the membrane', () => {
    const tl = buildTimeline(2, 'animal');
    const ms = buildMitosisScene(tl, PALETTE, { segments: 16 });
    const st = tl.stateAt(tl.keyTime('metaphase'));
    ms.update(st);
    ms.scene.updateMatrixWorld(true);
    const c = st.centromeres[0]!.position;
    const ray = new THREE.Raycaster(
      new THREE.Vector3(c[0] + 0.19, c[1], 30),
      new THREE.Vector3(0, 0, -1),
    );
    ray.params.Line = { threshold: 0.01 };
    const hit = ms.pick(ray);
    expect(hit?.component === 'centromere' || hit?.component === 'doubleChromosome').toBe(true);
    // A ray that misses everything inside hits only the membrane.
    const edge = new THREE.Raycaster(new THREE.Vector3(0, 4.6, 30), new THREE.Vector3(0, 0, -1));
    edge.params.Line = { threshold: 0.01 };
    expect(ms.pick(edge)?.component).toBe('membrane');
    ms.dispose();
  });

  it('a picked part glows; every other drawn part is dimmed; nothing is dimmed without a pick', () => {
    const tl = buildTimeline(2, 'animal');
    const ms = buildMitosisScene(tl, PALETTE, { segments: 12 });
    ms.update(tl.stateAt(tl.keyTime('metaphase')));
    const looks = () =>
      [...visibleMaterials(ms.scene)].map((m) => m.userData.look as string | undefined);
    expect(looks().filter((l) => l === 'hi' || l === 'dim')).toEqual([]);
    ms.setSelection({ component: 'centromere', chromosome: 0 });
    const picked = looks();
    expect(picked).toContain('hi');
    // Apart from the soft shadow (not a cell part), everything else is dimmed.
    const parts = [...visibleMaterials(ms.scene)].filter(
      (m) => !(m instanceof THREE.MeshBasicMaterial),
    );
    for (const m of parts) expect(['hi', 'dim']).toContain(m.userData.look);
    ms.setSelection(null);
    expect(looks().filter((l) => l === 'hi' || l === 'dim')).toEqual([]);
    ms.dispose();
  });
});
