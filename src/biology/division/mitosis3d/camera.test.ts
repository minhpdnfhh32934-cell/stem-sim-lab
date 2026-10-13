import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  VIEW_DIR,
  applyViewport,
  cameraFrame,
  cellBound,
  fitDistance,
  placeCamera,
  viewTangents,
  type CameraFrame,
} from './camera';
import type { CameraMode } from './components';
import { STAGES_3D, buildTimeline, insideCell, type CellType, type Vec3 } from './timeline';

const CELL_TYPES: CellType[] = ['animal', 'plant'];
const MODES: CameraMode[] = ['overview', 'closeup'];
/** The stage canvas at 1366 × 768 and on a phone. */
const CANVASES: [number, number][] = [
  [760, 430],
  [375, 520],
];

/** A camera set up exactly as the view sets it up. */
function cameraFor(frame: CameraFrame, type: CellType, w: number, h: number, dir = VIEW_DIR) {
  const placed = placeCamera(frame, type, w, h, dir);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  applyViewport(cam, w, h);
  cam.position.set(...placed.position);
  cam.lookAt(...placed.target);
  cam.updateMatrixWorld(true);
  return { cam, placed };
}

/** Points of the frame that fall outside the canvas (normalised device coordinates). */
function outside(frame: CameraFrame, cam: THREE.PerspectiveCamera): string[] {
  const out: string[] = [];
  const v = new THREE.Vector3();
  for (const p of frame.points) {
    v.set(frame.center[0] + p[0], frame.center[1] + p[1], frame.center[2] + p[2]);
    v.project(cam);
    if (!(Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && Math.abs(v.z) <= 1))
      out.push(`(${p.map((x) => x.toFixed(2)).join(', ')}) → ${v.x.toFixed(3)}, ${v.y.toFixed(3)}`);
  }
  return out;
}

/** Moments to frame: the start, the key moment and the end of every stage. */
function moments(type: CellType, pairs: number) {
  const tl = buildTimeline(pairs, type);
  return {
    tl,
    times: tl.stages.flatMap((w) => [w.start, tl.keyTime(w.id), w.end - 1e-6]),
  };
}

describe('3D mitosis camera framing', () => {
  it('every frame point is inside the view: both cells, 2n = 2–8, overview and close-up, two canvases', () => {
    const errors: string[] = [];
    let checked = 0;
    for (const type of CELL_TYPES) {
      for (const pairs of [1, 2, 3, 4]) {
        const { tl, times } = moments(type, pairs);
        for (const t of times) {
          const state = tl.stateAt(t);
          for (const mode of MODES) {
            const frame = cameraFrame(mode, state, type);
            for (const [w, h] of CANVASES) {
              const { cam, placed } = cameraFor(frame, type, w, h);
              const at = `${type} 2n=${String(2 * pairs)} ${state.stage} ${mode} ${String(w)}×${String(h)}`;
              for (const e of outside(frame, cam)) errors.push(`${at}: ${e}`);
              if (placed.distance < placed.min || placed.distance > placed.max)
                errors.push(`${at}: distance ${String(placed.distance)} outside its limits`);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBe(2 * 4 * STAGES_3D.length * 3 * 2 * 2);
    expect(errors.slice(0, 10), `${String(errors.length)} problems`).toEqual([]);
  });

  it('the near limit keeps the camera outside the cell, whatever the target', () => {
    for (const type of CELL_TYPES) {
      const { tl, times } = moments(type, 4);
      for (const t of times) {
        const state = tl.stateAt(t);
        for (const mode of MODES) {
          const placed = placeCamera(cameraFrame(mode, state, type), type, 760, 430);
          // Zoomed all the way in from any direction: still outside the sphere that holds the
          // cell at every moment.
          const target = new THREE.Vector3(...placed.target);
          for (const dir of [VIEW_DIR, [1, 0, 0], [0, -1, 0], [0, 0, -1]] as Vec3[]) {
            const eye = target
              .clone()
              .add(new THREE.Vector3(...dir).normalize().multiplyScalar(placed.min));
            expect(eye.length(), `${type} ${state.stage} ${mode}`).toBeGreaterThan(cellBound(type));
            expect(insideCell(state.shape, [eye.x, eye.y, eye.z])).toBe(false);
          }
        }
      }
    }
  });

  it('the cell bound holds every point of the cell at every moment', () => {
    for (const type of CELL_TYPES) {
      const tl = buildTimeline(2, type);
      const r = cellBound(type);
      for (let t = 0; t <= tl.total; t += 0.1) {
        const s = tl.stateAt(t);
        // Points just beyond the bound, in many directions: never inside the cell.
        for (let i = 0; i < 64; i++) {
          const a = (i * Math.PI * 2) / 16;
          const b = Math.acos(1 - (2 * ((i % 8) + 0.5)) / 8);
          const p: Vec3 = [
            r * 1.0001 * Math.sin(b) * Math.cos(a),
            r * 1.0001 * Math.sin(b) * Math.sin(a),
            r * 1.0001 * Math.cos(b),
          ];
          expect(insideCell(s.shape, p)).toBe(false);
        }
      }
    }
  });

  it('the far limit is never below the overview distance, even on a narrow canvas', () => {
    for (const type of CELL_TYPES) {
      for (const [w, h] of [
        ...CANVASES,
        [250, 700] as [number, number],
        [1600, 900] as [number, number],
      ]) {
        const overview = cameraFrame('overview', null, type);
        const placed = placeCamera(overview, type, w, h);
        expect(placed.max).toBeGreaterThanOrEqual(fitDistance(overview, viewTangents(w, h)));
        expect(placed.distance).toBeLessThanOrEqual(placed.max);
        expect(placed.min).toBeLessThan(placed.distance);
      }
    }
  });

  it('a close-up framed once loses the chromosomes as they spread (so the view re-frames it)', () => {
    // Animal cell (the plant close-up stays outside the wall, far enough to hold them all).
    const tl = buildTimeline(4, 'animal');
    const early = cameraFrame('closeup', tl.stateAt(tl.keyTime('g2')), 'animal');
    const late = cameraFrame('closeup', tl.stateAt(tl.total), 'animal');
    const { cam } = cameraFor(early, 'animal', 760, 430);
    expect(outside(late, cam).length).toBeGreaterThan(0);
  });

  it('framing also holds for a camera the learner has orbited', () => {
    const tl = buildTimeline(4, 'animal');
    const state = tl.stateAt(tl.keyTime('anaphase'));
    const frame = cameraFrame('closeup', state, 'animal');
    for (const dir of [
      [1, 0, 0],
      [0, 0.999, 0.05],
      [-0.3, -0.5, 0.8],
    ] as Vec3[]) {
      const d = new THREE.Vector3(...dir).normalize();
      const { cam } = cameraFor(frame, 'animal', 760, 430, [d.x, d.y, d.z]);
      expect(outside(frame, cam)).toEqual([]);
    }
  });
});
