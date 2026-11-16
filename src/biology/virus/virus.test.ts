import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawStats } from '@/ui/three/drawStats';
import { expectAllFreed, testKit } from '../view3d/testing';
import { VIRUS_CARD } from './card';
import {
  ICOSAHEDRON_FACES,
  VIRUS_SIZE,
  capsomereCentres,
  coreCoil,
  icosahedronVertices,
  sphereDirections,
} from './geometry';
import { PART_TEXT, STAGES, STAGE_TEXT, VIRUS_PARTS, partsShown } from './parts';
import { buildVirusScene } from './scene';
import { restoreVirus, setEnveloped, setStage, useVirus } from './store';

afterEach(() => {
  vi.restoreAllMocks();
});

const len = (v: readonly number[]) => Math.hypot(...v);
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));

describe('icosahedral capsid (illustration)', () => {
  it('12 vertices on the sphere, 20 faces with equal edges, each edge shared by two faces', () => {
    const v = icosahedronVertices(2);
    expect(v).toHaveLength(12);
    for (const p of v) expect(len(p)).toBeCloseTo(2, 12);
    const edges = new Map<string, number>();
    const lengths: number[] = [];
    for (const f of ICOSAHEDRON_FACES)
      for (let k = 0; k < 3; k++) {
        const a = f[k] ?? 0;
        const b = f[(k + 1) % 3] ?? 0;
        const key = `${String(Math.min(a, b))}-${String(Math.max(a, b))}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
        lengths.push(dist(v[a] ?? [], v[b] ?? []));
      }
    expect(ICOSAHEDRON_FACES).toHaveLength(20);
    expect(edges.size).toBe(30);
    expect([...edges.values()].every((n) => n === 2)).toBe(true);
    for (const l of lengths) expect(l).toBeCloseTo(lengths[0] ?? 0, 12);
    // Faces face outwards (counter-clockwise seen from outside).
    for (const [a, b, c] of ICOSAHEDRON_FACES) {
      const A = new THREE.Vector3(...(v[a] ?? []));
      const n = new THREE.Vector3(...(v[b] ?? []))
        .sub(A)
        .cross(new THREE.Vector3(...(v[c] ?? [])).sub(A));
      expect(n.dot(A)).toBeGreaterThan(0);
    }
  });

  it('capsomeres: 10f² + 2 distinct points between the flat faces and the sphere', () => {
    for (const f of [1, 2, 3, 4]) {
      const pts = capsomereCentres(2, f);
      expect(pts).toHaveLength(10 * f * f + 2);
      for (const p of pts) {
        expect(len(p)).toBeLessThanOrEqual(2 + 1e-9);
        expect(len(p)).toBeGreaterThan(2 * 0.79);
      }
    }
    const pts = capsomereCentres(2, VIRUS_SIZE.facets);
    // Neighbours never overlap at the drawn size.
    let closest = Infinity;
    pts.forEach((a, i) => {
      for (const b of pts.slice(i + 1)) closest = Math.min(closest, dist(a, b));
    });
    expect(closest).toBeGreaterThan(2 * VIRUS_SIZE.capsomere);
  });

  it('spikes point everywhere (unit vectors, mean ≈ 0); the core stays inside the capsid', () => {
    const d = sphereDirections(VIRUS_SIZE.spikes);
    for (const p of d) expect(len(p)).toBeCloseTo(1, 12);
    const mean = [0, 1, 2].map((k) => d.reduce((s, p) => s + (p[k] ?? 0), 0) / d.length);
    expect(len(mean)).toBeLessThan(0.05);
    for (const p of coreCoil(VIRUS_SIZE.core)) expect(len(p)).toBeLessThan(VIRUS_SIZE.capsid);
    expect(VIRUS_SIZE.envelope).toBeGreaterThan(VIRUS_SIZE.capsid + VIRUS_SIZE.capsomere);
  });
});

describe('parts and stages (SGK Sinh học 10 KNTT, Bài 24)', () => {
  it('every virus has a core and a capsid; envelope and spikes only when enveloped', () => {
    expect(partsShown(false)).toEqual(['core', 'capsid']);
    expect(partsShown(true)).toEqual(VIRUS_PARTS);
    // The book names no subunit of the coat: no "capsomere" part (decision 16/11/2026).
    expect(VIRUS_PARTS).not.toContain('capsomere');
    for (const p of VIRUS_PARTS) expect(PART_TEXT[p].source.id).toBe('sgk-sh10-kntt-bai24');
    expect(PART_TEXT.core.source.id).toBe('sgk-sh10-kntt-bai24');
  });

  it('five stages in the book’s order and names, no numbers in the texts', () => {
    expect(STAGES.map((s) => STAGE_TEXT[s].name.vi)).toEqual([
      'Hấp phụ',
      'Xâm nhập',
      'Tổng hợp',
      'Lắp ráp',
      'Giải phóng',
    ]);
    for (const t of [...Object.values(STAGE_TEXT), ...Object.values(PART_TEXT)])
      expect(t.name.vi + ('text' in t ? t.text.vi : '')).not.toMatch(/\d/);
  });

  it('the card is qualitative with the textbook as its only source', () => {
    expect(VIRUS_CARD.confidence).toBe('qualitative');
    expect(VIRUS_CARD.equations).toEqual([]);
    expect(VIRUS_CARD.sources.map((s) => s.id)).toEqual(['sgk-sh10-kntt-bai24']);
  });
});

describe('store', () => {
  it('removing the envelope drops a picked spike; stages are clamped; files are checked', () => {
    useVirus.setState({ enveloped: true, selected: 'spikes', stage: 0 });
    setEnveloped(false);
    expect(useVirus.getState()).toMatchObject({ enveloped: false, selected: null });
    useVirus.setState({ selected: 'core' });
    setEnveloped(true);
    expect(useVirus.getState().selected).toBe('core');
    setStage(9);
    expect(useVirus.getState().stage).toBe(4);
    setStage(-2);
    expect(useVirus.getState().stage).toBe(0);
    restoreVirus({ enveloped: 'yes', stage: 2.5 });
    expect(useVirus.getState()).toMatchObject({ enveloped: true, stage: 0 });
    restoreVirus({ enveloped: false, stage: 3 });
    expect(useVirus.getState()).toMatchObject({ enveloped: false, stage: 3 });
  });
});

describe('3D virus', () => {
  it.each([true, false])('enveloped %s: builds, names its parts, frees everything', (enveloped) => {
    for (const tier of ['low', 'medium', 'high'] as const) {
      const { kit, track, start } = testKit(tier);
      const names = Object.fromEntries(partsShown(enveloped).map((p) => [p, p]));
      const sc = buildVirusScene(kit, { enveloped, names });
      expect(sc.state?.()).toMatchObject({
        enveloped,
        capsomeres: 92,
        spikes: enveloped ? VIRUS_SIZE.spikes : 0,
        named: partsShown(enveloped),
      });
      expectAllFreed(kit, track, start);
    }
  });

  it('draw calls: core, capsid (+ envelope shell, stalks, heads)', () => {
    for (const enveloped of [false, true]) {
      const { kit } = testKit('medium');
      buildVirusScene(kit, { enveloped, names: null });
      const calls = drawStats(kit.scene).calls;
      kit.dispose();
      expect(calls).toBe(enveloped ? 2 + 2 + 2 : 2);
    }
  });

  it('a tap goes through the envelope to the capsid; select marks a part', () => {
    const { kit } = testKit('medium');
    const sc = buildVirusScene(kit, { enveloped: true, names: null });
    kit.scene.updateMatrixWorld(true);
    const ray = (x: number, y: number) =>
      new THREE.Raycaster(new THREE.Vector3(x, y, 40), new THREE.Vector3(0, 0, -1));
    const front = capsomereCentres(VIRUS_SIZE.capsid, VIRUS_SIZE.facets).reduce((a, b) =>
      b[2] > a[2] ? b : a,
    );
    expect(sc.pick?.(ray(front[0], front[1]))).toBe('capsid');
    // Through a gap between capsomeres: the core inside, never the envelope in front.
    expect(['core', 'capsid']).toContain(sc.pick?.(ray(0, 0)));
    expect(sc.pick?.(ray(30, 30))).toBeNull();
    sc.select?.('capsid');
    expect(sc.state?.()).toMatchObject({ selected: 'capsid' });
    sc.select?.('capsomere');
    expect(sc.state?.()).toMatchObject({ selected: null });
    kit.dispose();
    const naked = testKit('medium');
    const sc2 = buildVirusScene(naked.kit, { enveloped: false, names: null });
    sc2.select?.('spikes');
    expect(sc2.state?.()).toMatchObject({ selected: null });
    naked.kit.dispose();
  });
});
