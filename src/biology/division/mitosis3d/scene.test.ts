import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMitosisScene, type ScenePalette } from './scene';
import { buildTimeline, type CellType } from './timeline';

const PALETTE: ScenePalette = {
  maternal: 'rgb(213, 94, 0)',
  paternal: 'rgb(0, 114, 178)',
  centromere: 'rgb(23, 32, 51)',
  membrane: 'rgb(22, 128, 74)',
  envelope: 'rgb(47, 98, 216)',
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

describe('3D mitosis scene', () => {
  for (const type of ['animal', 'plant'] as CellType[]) {
    it(`${type}: dispose() frees every geometry and material`, () => {
      const tl = buildTimeline(2, type);
      const ms = buildMitosisScene(tl, PALETTE, { segments: 12 });
      // Visit every stage so all materials (normal + highlighted) have been used.
      const used = {
        geometries: new Set<THREE.BufferGeometry>(),
        materials: new Set<THREE.Material>(),
      };
      for (const sel of [
        null,
        { component: 'membrane' as const },
        { component: 'spindle' as const },
      ]) {
        ms.setSelection(sel);
        for (let t = 0; t <= tl.total; t += 0.5) {
          ms.update(tl.stateAt(t));
          const c = collect(ms.scene);
          c.geometries.forEach((g) => used.geometries.add(g));
          c.materials.forEach((m) => used.materials.add(m));
        }
      }
      const geoDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
      const matDispose = vi.spyOn(THREE.Material.prototype, 'dispose');
      ms.dispose();
      const disposedGeo = new Set(geoDispose.mock.contexts);
      const disposedMat = new Set(matDispose.mock.contexts);
      for (const g of used.geometries) expect(disposedGeo.has(g)).toBe(true);
      for (const m of used.materials) expect(disposedMat.has(m)).toBe(true);
      expect(ms.scene.children).toHaveLength(0);
    });

    it(`${type}: object count stays constant across 20 replays`, () => {
      const tl = buildTimeline(4, type);
      const ms = buildMitosisScene(tl, PALETTE, { segments: 12 });
      ms.update(tl.stateAt(0));
      const first = ms.stats();
      for (let replay = 0; replay < 20; replay++) {
        for (let t = 0; t <= tl.total; t += 0.7) ms.update(tl.stateAt(t));
        ms.update(tl.stateAt(tl.total));
        expect(ms.stats()).toEqual(first);
      }
      ms.dispose();
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
    const ring = show('animal', tlA.keyTime('cytokinesis') - 1.5);
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
});
