import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { meiosisOptions } from '../meiosisOptions';
import { MEIOSIS_PART_ORDER, type MeiosisSelection } from './components';
import { buildMeiosisScene, type MeiosisPalette } from './scene';
import { buildMeiosisTimeline, type MeiosisTimeline } from './timeline';

const PALETTE: MeiosisPalette = {
  maternal: 'rgb(213, 94, 0)',
  paternal: 'rgb(0, 114, 178)',
  centromere: 'rgb(23, 32, 51)',
  chiasma: 'rgb(0, 158, 115)',
  membrane: 'rgb(22, 128, 74)',
  envelope: 'rgb(86, 180, 233)',
  nucleolus: 'rgb(91, 74, 134)',
  spindle: 'rgb(138, 147, 165)',
  centrosome: 'rgb(204, 121, 167)',
  ring: 'rgb(240, 228, 66)',
  highlight: 'rgb(255, 210, 63)',
};

const timeline = (pairs: number, crossover = true, seed = 1) =>
  buildMeiosisTimeline(pairs, meiosisOptions(pairs, crossover, seed));

afterEach(() => {
  vi.restoreAllMocks();
});

function collect(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      geometries.add(o.geometry as THREE.BufferGeometry);
      materials.add(o.material as THREE.Material);
    }
  });
  return { geometries, materials };
}

function visibleMaterials(scene: THREE.Scene): Set<THREE.Material> {
  const out = new Set<THREE.Material>();
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return;
    out.add(o.material as THREE.Material);
  });
  return out;
}

const materialId = (m: unknown) => (m as THREE.Material & { readonly id: number }).id;
function nextIds() {
  return { geometry: new THREE.BufferGeometry().id, material: materialId(new THREE.Material()) };
}
const idsBetween = (a: number, b: number) => Array.from({ length: b - a - 1 }, (_, k) => a + 1 + k);

/** Ids of the geometries / materials whose dispose() has been called (the dispose spies). */
function trackDisposal() {
  const geo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
  const mat = vi.spyOn(THREE.Material.prototype, 'dispose');
  return {
    geometries: () => new Set(geo.mock.contexts.map((g) => (g as THREE.BufferGeometry).id)),
    materials: () => new Set(mat.mock.contexts.map(materialId)),
  };
}

function visitTimes(tl: MeiosisTimeline): number[] {
  return tl.stages.flatMap((w) => [
    ...[0.1, 0.5, 0.9].map((u) => w.start + u * (w.end - w.start)),
    tl.keyTime(w.id),
  ]);
}

/** A ray straight down −z through a point (the picture's front view). */
function rayThrough(p: readonly number[]): THREE.Raycaster {
  const ray = new THREE.Raycaster(new THREE.Vector3(p[0], p[1], 40), new THREE.Vector3(0, 0, -1));
  ray.params.Line = { threshold: 0.01 };
  return ray;
}

describe('3D meiosis scene', () => {
  for (const segments of [12, 24]) {
    it(`every listed part can be highlighted; dispose() frees all it created (segments ${String(segments)})`, () => {
      const tl = timeline(2);
      const track = trackDisposal();
      const start = nextIds();
      const ms = buildMeiosisScene(tl, PALETTE, { segments });
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
      for (const t of times) {
        ms.update(tl.stateAt(t));
        visit();
      }
      for (const component of MEIOSIS_PART_ORDER) {
        let lit = false;
        const picks: MeiosisSelection[] = [
          { component },
          { component, chromosome: 1, sister: 1, pair: 0 },
        ];
        for (const sel of picks) {
          ms.setSelection(sel);
          for (const t of times) {
            ms.update(tl.stateAt(t));
            for (const m of visibleMaterials(ms.scene)) if (m.userData.look === 'hi') lit = true;
            visit();
          }
        }
        expect(lit, component).toBe(true);
      }
      ms.setSelection(null);
      const end = nextIds();
      expect(track.geometries().size).toBe(0);
      expect(track.materials().size).toBe(0);
      ms.dispose();
      const freedGeo = track.geometries();
      const freedMat = track.materials();
      const madeGeo = idsBetween(start.geometry, end.geometry);
      const madeMat = idsBetween(start.material, end.material);
      expect(madeGeo.length).toBeGreaterThan(5);
      expect(madeMat.length).toBeGreaterThan(5);
      expect(madeGeo.filter((id) => !freedGeo.has(id))).toEqual([]);
      expect(madeMat.filter((id) => !freedMat.has(id))).toEqual([]);
      for (const g of used.geometries) expect(freedGeo.has(g.id)).toBe(true);
      for (const m of used.materials) expect(freedMat.has(materialId(m))).toBe(true);
      expect(ms.scene.children).toHaveLength(0);
    });
  }

  it('replays create and free nothing', () => {
    const tl = timeline(3);
    const ms = buildMeiosisScene(tl, PALETTE, { segments: 16 });
    for (const t of visitTimes(tl)) ms.update(tl.stateAt(t));
    const track = trackDisposal();
    const before = nextIds();
    for (let r = 0; r < 3; r++) for (const t of visitTimes(tl)) ms.update(tl.stateAt(t));
    const after = nextIds();
    expect(idsBetween(before.geometry, after.geometry)).toEqual([]);
    expect(idsBetween(before.material, after.material)).toEqual([]);
    expect(track.geometries().size).toBe(0);
    ms.dispose();
  });

  it('paints every tube from the model; the recombinant ones change at the crossing over', () => {
    const tl = timeline(2, true, 4);
    const ms = buildMeiosisScene(tl, PALETTE, { segments: 12 });
    const colours = (st: ReturnType<MeiosisTimeline['stateAt']>) => {
      ms.update(st);
      const out: string[][] = [];
      ms.scene.traverse((o) => {
        const d = o.userData as { part?: string; chromatid?: number };
        if (!(o instanceof THREE.Mesh) || d.chromatid === undefined) return;
        if (d.part !== 'arm' && d.part !== 'thread') return;
        const col = (o.geometry as THREE.BufferGeometry).getAttribute('color');
        const seen = new Set<string>();
        for (let i = 0; i < col.count; i++)
          seen.add([col.getX(i), col.getY(i), col.getZ(i)].map((v) => v.toFixed(2)).join(','));
        out[d.chromatid] = [...seen];
      });
      return out;
    };
    const early = colours(tl.stateAt(tl.keyTime('g2')));
    const late = colours(tl.stateAt(tl.keyTime('metaphase1')));
    tl.chromatids.forEach((info, id) => {
      // One colour before the exchange; two (maternal and paternal) after it, on recombinants.
      expect(early[id]?.length, `chromatid ${id}`).toBe(1);
      expect(late[id]?.length, `chromatid ${id}`).toBe(info.recombinant ? 2 : 1);
    });
    ms.dispose();
  });

  it('picks a bivalent in metaphase I, a chromatid of it, a chiasma, and the membrane', () => {
    const tl = timeline(1, true, 1);
    const ms = buildMeiosisScene(tl, PALETTE, { segments: 16 });
    const st = tl.stateAt(tl.keyTime('metaphase1'));
    ms.update(st);
    ms.scene.updateMatrixWorld(true);
    // Through the middle of an outer chromatid's long arm (away from the centromere).
    const outer = st.chromatids.find((c) => !tl.chromatids[c.id]!.inner)!;
    const info = tl.chromatids[outer.id]!;
    const along = 0.6 * info.armB;
    const p = outer.centromere.map((v, k) => v + outer.dirB[k]! * along);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(p[0]! + 30 * Math.sign(outer.centromere[0]), p[1], p[2]),
      new THREE.Vector3(-Math.sign(outer.centromere[0]), 0, 0),
    );
    expect(ms.pick(ray)).toEqual({
      component: 'bivalent',
      pair: 0,
      chromosome: outer.chromosome,
      sister: outer.sister,
    });
    // The chiasma's X between the inner chromatids.
    const bars: THREE.Mesh[] = [];
    ms.scene.traverse((o) => {
      if ((o.userData as { part?: string }).part === 'chiasma' && o.visible)
        bars.push(o as THREE.Mesh);
    });
    expect(bars).toHaveLength(2);
    const c = bars[0]!.position;
    const down = new THREE.Raycaster(
      new THREE.Vector3(c.x, c.y, c.z + 30),
      new THREE.Vector3(0, 0, -1),
    );
    const hit = ms.pick(down);
    expect(hit?.component === 'chiasma' || hit?.component === 'bivalent').toBe(true);
    // Nothing inside: the membrane.
    expect(ms.pick(rayThrough([0, 4.6]))?.component).toBe('membrane');
    ms.dispose();
  });

  it('picks a single chromosome after anaphase II, a double one in metaphase II', () => {
    const tl = timeline(2);
    const ms = buildMeiosisScene(tl, PALETTE, { segments: 16 });
    for (const [stage, component] of [
      ['metaphase2', 'homologousChromosome'],
      ['anaphase2', 'singleChromosome'],
    ] as const) {
      const st = tl.stateAt(tl.keyTime(stage));
      ms.update(st);
      ms.scene.updateMatrixWorld(true);
      const c = st.chromatids.find((x) => x.present)!;
      const info = tl.chromatids[c.id]!;
      const p = c.centromere.map((v, k) => v + c.dirB[k]! * 0.6 * info.armB);
      const hit = ms.pick(rayThrough(p));
      expect(hit?.component, stage).toBe(component);
    }
    ms.dispose();
  });

  it('a picked part glows; every other drawn part is dimmed; nothing is dimmed without a pick', () => {
    const tl = timeline(2);
    const ms = buildMeiosisScene(tl, PALETTE, { segments: 12 });
    ms.update(tl.stateAt(tl.keyTime('metaphase1')));
    const looks = () =>
      [...visibleMaterials(ms.scene)].map((m) => m.userData.look as string | undefined);
    expect(looks().filter((l) => l === 'hi' || l === 'dim')).toEqual([]);
    ms.setSelection({ component: 'bivalent', pair: 0 });
    expect(looks()).toContain('hi');
    const parts = [...visibleMaterials(ms.scene)].filter(
      (m) => !(m instanceof THREE.MeshBasicMaterial),
    );
    for (const m of parts) expect(['hi', 'dim']).toContain(m.userData.look);
    ms.setSelection(null);
    expect(looks().filter((l) => l === 'hi' || l === 'dim')).toEqual([]);
    ms.dispose();
  });

  it('name labels only for parts that can be seen', () => {
    const tl = timeline(2);
    const ms = buildMeiosisScene(tl, PALETTE, { segments: 12 });
    ms.update(tl.stateAt(tl.keyTime('metaphase1')));
    const ids = ms.labelAnchors().map((a) => a.id);
    expect(ids).toContain('bivalent');
    expect(ids).toContain('chiasma');
    expect(ids).toContain('spindle');
    expect(ids).not.toContain('nucleus');
    ms.update(tl.stateAt(tl.keyTime('g1')));
    const g1 = ms.labelAnchors().map((a) => a.id);
    expect(g1).toContain('chromatin');
    expect(g1).not.toContain('spindle');
    ms.dispose();
  });
});
