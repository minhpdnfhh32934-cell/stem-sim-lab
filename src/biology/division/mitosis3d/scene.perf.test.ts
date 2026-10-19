import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildMitosisScene, drawStats, type ScenePalette } from './scene';
import { buildTimeline, type CellType } from './timeline';

const PALETTE: ScenePalette = {
  maternal: 'gray',
  paternal: 'gray',
  centromere: 'gray',
  membrane: 'gray',
  envelope: 'gray',
  nucleolus: 'gray',
  wall: 'gray',
  spindle: 'gray',
  centrosome: 'gray',
  plate: 'gray',
  ring: 'gray',
  highlight: 'gray',
};

/**
 * Draw-call budget: one call per drawn object, at most (formula of the scene's objects; the
 * soft contact shadow is one call, the spindle one instanced call).
 */
const CALLS: Record<CellType, (n2: number) => number> = {
  animal: (n2) => 11 + 8 * n2,
  plant: (n2) => 6 + 8 * n2,
};

/**
 * Most triangles drawn at any moment of the division, per quality tier (sphere segments: Low 8,
 * Medium 16, High 24), measured on the CPU with `drawStats` (2026-10-20: spindle fibres as tubes,
 * rounded plant cell, contact shadow, lighter chromatin threads). The budget allows 5 % more; a
 * bigger change must update this table on purpose.
 */
const TRIANGLES: Record<number, Record<CellType, Record<number, number>>> = {
  8: {
    animal: { 2: 3234, 4: 5226, 6: 7218, 8: 9210 },
    plant: { 2: 2978, 4: 4970, 6: 6962, 8: 8954 },
  },
  16: {
    animal: { 2: 8258, 4: 12530, 6: 16802, 8: 21074 },
    plant: { 2: 8066, 4: 12338, 6: 16610, 8: 20882 },
  },
  24: {
    animal: { 2: 16162, 4: 23714, 6: 31266, 8: 38818 },
    plant: { 2: 16098, 4: 23650, 6: 31202, 8: 38754 },
  },
};

describe('3D mitosis drawing budget (CPU count, no GPU)', () => {
  it('drawStats counts like three.js: hidden and empty objects skipped, see-through double faces twice', () => {
    const root = new THREE.Scene();
    const geo = new THREE.BoxGeometry(1, 1, 1); // 12 triangles
    const mesh = (m: THREE.Material) => root.add(new THREE.Mesh(geo, m));
    mesh(new THREE.MeshBasicMaterial());
    mesh(new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }));
    mesh(
      new THREE.MeshBasicMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        forceSinglePass: true,
      }),
    );
    const hidden = new THREE.Group();
    hidden.visible = false;
    hidden.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial()));
    root.add(hidden);
    const lines = new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(4 * 3), 3),
    );
    root.add(new THREE.LineSegments(lines, new THREE.LineBasicMaterial()));
    const empty = new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(4 * 3), 3),
    );
    empty.setDrawRange(0, 0);
    root.add(new THREE.LineSegments(empty, new THREE.LineBasicMaterial()));
    // Instanced: one call for 3 drawn copies (of 5); none when no copy is drawn.
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 5);
    inst.count = 3;
    root.add(inst);
    const none = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 5);
    none.count = 0;
    root.add(none);
    expect(drawStats(root)).toEqual({
      calls: 1 + 2 + 1 + 1 + 1,
      triangles: 12 * 4 + 12 * 3,
      lines: 2,
    });
  });

  for (const segments of [8, 16, 24]) {
    it(`draw calls and triangles stay within budget (sphere segments ${String(segments)})`, () => {
      for (const type of ['animal', 'plant'] as CellType[]) {
        for (const pairs of [1, 2, 3, 4]) {
          const n2 = 2 * pairs;
          const tl = buildTimeline(pairs, type);
          const ms = buildMitosisScene(tl, PALETTE, { segments });
          let calls = 0;
          let triangles = 0;
          for (let t = 0; t <= tl.total + 1e-9; t += 0.25) {
            ms.update(tl.stateAt(t));
            const s = ms.drawStats();
            calls = Math.max(calls, s.calls);
            triangles = Math.max(triangles, s.triangles);
          }
          ms.dispose();
          const at = `${type} 2n=${String(n2)} segments ${String(segments)}`;
          expect(calls, at).toBeLessThanOrEqual(CALLS[type](n2));
          const budget = TRIANGLES[segments]?.[type][n2] ?? 0;
          expect(triangles, at).toBeLessThanOrEqual(budget * 1.05);
          // The table is a real measurement, not a loose ceiling.
          expect(triangles, at).toBeGreaterThan(budget * 0.95);
        }
      }
    });
  }

  it('one playback frame (stateAt + scene update) takes under 2 ms on the CPU (p95)', () => {
    for (const pairs of [4, 23]) {
      const tl = buildTimeline(pairs, 'animal');
      const ms = buildMitosisScene(tl, PALETTE, { segments: 24 });
      const frames = Math.round(tl.total * 60);
      const at = (k: number) => (k / frames) * tl.total;
      for (let k = 0; k < frames; k++) ms.update(tl.stateAt(at(k))); // warm-up
      const times: number[] = [];
      for (let k = 0; k < frames; k++) {
        const a = performance.now();
        ms.update(tl.stateAt(at(k)));
        times.push(performance.now() - a);
      }
      ms.dispose();
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(0.95 * times.length)] ?? Infinity;
      expect(p95, `2n=${String(2 * pairs)}`).toBeLessThan(2);
    }
  });
});
