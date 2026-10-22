import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SERIES_VARS } from '@/ui/charts/uplot';
import { FIGURE_CLEARANCE, FIGURE_SPACING } from '../../genetics/hw3d/layout';
import { drawScale } from '../../view3d/sampling';
import { lotkaVolterra, lvDrift, lvEquilibrium, lvInvariantLog } from '../ecology';
import {
  PREDATOR_TOKEN,
  PREY_TOKEN,
  curvePoints,
  figureCap,
  lvModel3d,
  momentAt,
  momentOf,
  orbitPoints,
  parseSelection,
  playSeconds,
  sampleAt,
  selectionId,
  type LvSelection,
} from './binding';
import {
  CALLOUT_ROOM,
  boardPoint,
  cloverCount,
  lvLayout,
  lvPlants,
  nearBoard,
  speciesSlots,
  subjectPoints,
} from './layout';
import { PREDATOR_SIZE, prowlerGeometry } from './organisms';
import { plantCounts } from '../../genetics/hw3d/layout';

/** The lesson's defaults (store.ts) and the 2D data's 800 steps (data.ts). */
const P = { alpha: 1, beta: 0.1, delta: 0.075, gamma: 1.5 };
const run = (p = P, x0 = 10, y0 = 5, tEnd = 30) => {
  const traj = lotkaVolterra(p, x0, y0, tEnd, 800);
  return lvModel3d({ p, traj, tEnd, drift: lvDrift(p, traj) }, 200);
};

describe('predator–prey 3D binding (model → scene numbers)', () => {
  it('colours are the 2D time chart’s series: prey x = series 1, predators y = series 4', () => {
    expect(PREY_TOKEN).toBe(SERIES_VARS[0]);
    expect(PREDATOR_TOKEN).toBe(SERIES_VARS[3]);
    expect(PREY_TOKEN).not.toBe(PREDATOR_TOKEN);
  });

  it('one drawing scale for both species from the run’s peaks; 1 figure = 1 individual at the defaults', () => {
    const m = run();
    const peakX = Math.max(...m.traj.x);
    const peakY = Math.max(...m.traj.y);
    expect(m.peak).toEqual({ prey: peakX, predators: peakY });
    expect(m.per).toBe(drawScale(peakX + peakY, 200));
    expect(m.per).toBe(1);
    expect(m.slots).toEqual({ prey: Math.round(peakX), predators: Math.round(peakY) });
    // A large run: a nice step (1, 2, 5 × 10ᵐ), the same for both species, at most the cap.
    const big = run({ alpha: 3, beta: 0.01, delta: 0.005, gamma: 3 }, 100, 1, 100);
    const sum = big.peak.prey + big.peak.predators;
    expect(big.per).toBe(drawScale(sum, 200));
    expect(big.per).toBeGreaterThan(1);
    expect(String(big.per)).toMatch(/^(1|2|5)0*$/);
    expect(big.slots.prey + big.slots.predators).toBeLessThanOrEqual(201);
    expect(figureCap(4000)).toBe(200);
    expect(figureCap(100)).toBe(60);
  });

  it('a moment is the computed sample nearest t (never interpolated): counts, rates, V', () => {
    const m = run();
    const dt = 30 / 800;
    for (const t of [0, 0.01, 7.3, 12, 29.99, 30, 40, -3, Number.NaN]) {
      const k = sampleAt(m.traj, t);
      const s = momentAt(m, t);
      expect(s.k).toBe(k);
      expect(s.t).toBe(m.traj.t[k]);
      expect(s.x).toBe(m.traj.x[k]);
      expect(s.y).toBe(m.traj.y[k]);
      const want = Number.isFinite(t) ? Math.min(30, Math.max(0, t)) : 0;
      expect(Math.abs(s.t - want)).toBeLessThanOrEqual(dt / 2 + 1e-12);
      expect(s.shown).toEqual({
        prey: Math.round(s.x / m.per),
        predators: Math.round(s.y / m.per),
      });
      expect(s.dxdt).toBeCloseTo(P.alpha * s.x - P.beta * s.x * s.y, 12);
      expect(s.dydt).toBeCloseTo(P.delta * s.x * s.y - P.gamma * s.y, 12);
      expect(s.preyRate).toBeCloseTo(P.alpha - P.beta * s.y, 12);
      expect(s.predatorRate).toBeCloseTo(P.delta * s.x - P.gamma, 12);
      expect(s.V).toBe(lvInvariantLog(P, m.traj.u[k] ?? 0, m.traj.v[k] ?? 0));
      expect(s.fill.prey).toBeCloseTo(s.x / m.top, 12);
      expect(s.fill.predators).toBeCloseTo(s.y / m.top, 12);
      expect(s.plot[0]).toBeCloseTo(s.x / m.xMax, 12);
      expect(s.plot[1]).toBeCloseTo(s.y / m.yMax, 12);
    }
    // t = 12 is sample 320 exactly (the E2E spec scrubs there).
    expect(sampleAt(m.traj, 12)).toBe(320);
    expect(momentAt(m, 12).t).toBe(12);
    expect(momentOf(m, 9999).k).toBe(800);
  });

  it('scales: columns share 1.08 × max(peaks, x*, y*); the board uses the 2D phase plot’s axes', () => {
    const m = run();
    const eq = lvEquilibrium(P);
    expect(m.eq).toEqual(eq);
    expect(m.top).toBeCloseTo(1.08 * Math.max(m.peak.prey, m.peak.predators, eq.x, eq.y), 12);
    expect(m.xMax).toBeCloseTo(1.1 * Math.max(m.peak.prey, eq.x), 12);
    expect(m.yMax).toBeCloseTo(1.1 * Math.max(m.peak.predators, eq.y), 12);
    // The arrows' reference is the largest computed |rate|: every arrow is within [−1, 1] and
    // some sample reaches ±1.
    let reach = 0;
    for (let k = 0; k < m.traj.t.length; k++) {
      const s = momentOf(m, k);
      expect(Math.abs(s.arrow.prey)).toBeLessThanOrEqual(1 + 1e-12);
      expect(Math.abs(s.arrow.predators)).toBeLessThanOrEqual(1 + 1e-12);
      reach = Math.max(reach, Math.abs(s.arrow.prey), Math.abs(s.arrow.predators));
      expect(s.shown.prey).toBeLessThanOrEqual(m.slots.prey);
      expect(s.shown.predators).toBeLessThanOrEqual(m.slots.predators);
    }
    expect(reach).toBeCloseTo(1, 12);
    expect(m.V0).toBe(lvInvariantLog(P, m.traj.u[0] ?? 0, m.traj.v[0] ?? 0));
  });

  it('at the equilibrium nothing changes: no rate, no arrow, the bead on the equilibrium', () => {
    const eq = lvEquilibrium(P);
    const m = run(P, eq.x, eq.y, 10);
    const s = momentAt(m, 5);
    expect(Math.abs(s.dxdt)).toBeLessThan(1e-6);
    expect(Math.abs(s.dydt)).toBeLessThan(1e-6);
    expect(s.shown).toEqual({ prey: Math.round(eq.x), predators: Math.round(eq.y) });
  });

  it('the slider’s curves and the board’s orbit are computed samples on their scales', () => {
    const m = run();
    const c = curvePoints(m, 240);
    expect(c.prey.length).toBe(c.predators.length);
    expect(c.prey.length).toBeLessThanOrEqual(242);
    expect(c.prey[0]).toEqual([0, (m.traj.x[0] ?? 0) / m.top]);
    expect(c.prey.at(-1)).toEqual([1, (m.traj.x[800] ?? 0) / m.top]);
    for (const [u, v] of c.predators) {
      const k = Math.round(u * 800);
      expect(v).toBeCloseTo((m.traj.y[k] ?? 0) / m.top, 12);
    }
    const o = orbitPoints(m);
    expect(o.length).toBe(801);
    expect(o[320]).toEqual([(m.traj.x[320] ?? 0) / m.xMax, (m.traj.y[320] ?? 0) / m.yMax]);
  });

  it('playback speed is illustration only: 0.8 s per time unit, between 12 and 45 s', () => {
    expect(playSeconds(30)).toBeCloseTo(24, 12);
    expect(playSeconds(5)).toBe(12);
    expect(playSeconds(100)).toBe(45);
  });

  it('selection ids round-trip', () => {
    const all: LvSelection[] = [
      { kind: 'prey', slot: 0 },
      { kind: 'predator', slot: 17 },
      { kind: 'columns' },
      { kind: 'board' },
    ];
    for (const s of all) expect(parseSelection(selectionId(s))).toEqual(s);
    expect(parseSelection('figure:3')).toBeNull();
    expect(parseSelection(null)).toBeNull();
    expect(selectionId(null)).toBeNull();
  });
});

describe('predator–prey 3D layout (illustration)', () => {
  it('both species share one spiral: predators spread evenly, slots stable, never overlapping', () => {
    const a = speciesSlots(41, 23);
    expect(a.prey.length).toBe(41);
    expect(a.predators.length).toBe(23);
    // Each species' first slots are the same whatever the other counts (stable picture): only
    // the split of one spiral is fixed by the run's totals.
    const b = speciesSlots(41, 23, 0, 0);
    expect(b).toEqual(a);
    // Predators are spread through the spiral: within any 8 consecutive spiral slots there are
    // between 2 and 4 of them (23 of 64 ≈ 2.9 per 8).
    const all = [...a.prey, ...a.predators].sort(
      (p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z),
    );
    const isPred = new Set(a.predators);
    for (let i = 0; i + 8 <= all.length; i += 8) {
      const n = all.slice(i, i + 8).filter((s) => isPred.has(s)).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(5);
    }
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const p = all[i];
        const q = all[j];
        if (p && q)
          expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(FIGURE_CLEARANCE);
      }
    expect(speciesSlots(0, 5).predators.length).toBe(5);
    expect(speciesSlots(5, 0).prey.length).toBe(5);
  });

  it('a predator (at its drawn size) fits the shared figure footprint', () => {
    const g = prowlerGeometry();
    const pos = g.attributes.position as THREE.BufferAttribute;
    let far = 0;
    for (let i = 0; i < pos.count; i++) far = Math.max(far, Math.hypot(pos.getX(i), pos.getZ(i)));
    g.dispose();
    expect(far * PREDATOR_SIZE).toBeLessThanOrEqual(FIGURE_CLEARANCE / 2 + 0.02);
    expect(FIGURE_SPACING).toBeGreaterThan(FIGURE_CLEARANCE);
  });

  it('meadow, columns and board read left to right and stay apart; plants keep clear', () => {
    const L = lvLayout(41, 23, cloverCount('medium'));
    const c = L.columns;
    const b = L.board;
    expect(L.meadow.x + L.meadow.r).toBeLessThan(c.x - c.plinthRx);
    expect(c.preyX).toBeLessThan(c.predatorX);
    expect(c.preyX - c.tubeR).toBeGreaterThan(c.x - c.plinthRx);
    expect(c.predatorX + c.tubeR).toBeLessThan(c.x + c.plinthRx);
    const left = boardPoint(b, -b.width / 2, 0);
    expect(left[0]).toBeGreaterThan(c.x + c.plinthRx + 1.5);
    // The board leans back and turns towards the meadow.
    const top = boardPoint(b, 0, b.height);
    const bottom = boardPoint(b, 0, 0);
    expect(bottom[1]).toBeCloseTo(b.lift, 9);
    expect(top[2]).toBeLessThan(bottom[2]);
    expect(boardPoint(b, b.width / 2, 0)[2]).toBeGreaterThan(left[2]);
    // The subject is centred and leaves room for the names left of the meadow.
    const pts = subjectPoints(L);
    const xs = pts.map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(L.meadow.x - L.meadow.r - CALLOUT_ROOM, 9);
    expect(
      Math.abs(L.meadow.x - L.meadow.r + (b.x + (b.width / 2) * Math.cos(b.yaw))),
    ).toBeLessThan(1e-9);
    // Clover inside the meadow; no tree, bush or rock on the meadow, the plinth or the board.
    for (const p of L.clover) expect(Math.hypot(p.x - L.meadow.x, p.z)).toBeLessThan(L.meadow.r);
    for (const p of lvPlants(L, plantCounts('high'))) {
      if (p.kind === 'tuft') continue;
      expect(Math.hypot(p.x - L.meadow.x, p.z - L.meadow.z)).toBeGreaterThan(L.meadow.r);
      expect(nearBoard(L, p.x, p.z, 0.5)).toBe(false);
    }
  });
});
