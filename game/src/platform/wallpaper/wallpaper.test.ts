import { describe, expect, it } from 'vitest';
import {
  CYCLE,
  type Hour,
  hourAt,
  LOOP,
  raidAllowed,
  SCAN_DUSK,
  TOGETHER,
  togetherAt,
} from './cycle';
import { Director } from './director';
import {
  FRAMING,
  orbitPoint,
  PIVOT,
  restingOrbit,
  restingSway,
  scrollOrbit,
  stepOrbit,
  stepSway,
  SWAY,
} from './framing';
import { FLAT_RADIUS, landHeight, woodsAt } from './land';
import { KHOA_CLIPS, LINH_CLIPS, weightOf } from './poses';
import { at, footAt } from './keys';
import { spring, stepSpring } from './spring';
import { blownAt, heliAt, type HeliPose, RAID, ropesAt, slideAt } from './raidPlan';
import { bearingTo, CITY_ORIGIN, CITY_REACH, LAB_AT, ROOF_HEIGHT, TOWER } from './site';
import { streetTrees, woodTrees } from './trees';

describe('wallpaper (Phase W)', () => {
  it('stands its tower outside the game city, under the lab, the lab ahead on the left', () => {
    // The tower's footprint in the city's frame is past the city's last street.
    expect(TOWER.z0 - CITY_ORIGIN.z).toBeGreaterThan(CITY_REACH);
    // Lower than the lab's floor (Phú: the whole lab seen, its flat underside too).
    expect(LAB_AT.y).toBeGreaterThan(0);
    expect(LAB_AT.y).toBeLessThan(40);
    expect(ROOF_HEIGHT).toBeGreaterThan(60); // well over the city's roofs
    const bearing = bearingTo(LAB_AT.x, LAB_AT.z);
    expect(bearing).toBeGreaterThan(0.1); // to the left
    expect(bearing).toBeLessThan(0.6);
  });

  it('sways the eye after the mouse, settling without overshoot, within its reach', () => {
    const s = restingSway();
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      stepSway(s, 1, -1, 1 / 60);
      peak = Math.max(peak, s.x);
    }
    expect(s.x).toBeCloseTo(SWAY.x, 3);
    expect(s.y).toBeCloseTo(-SWAY.y, 3);
    expect(peak).toBeLessThanOrEqual(SWAY.x + 1e-6);
    // A long paused frame stays stable.
    stepSway(s, -1, 1, 5);
    expect(Math.abs(s.x)).toBeLessThanOrEqual(SWAY.x + 1e-6);
  });

  it('turns the view round the two by the wheel: left, past her front to her right side, and back', () => {
    const o = restingOrbit(FRAMING);
    const eye = { x: 0, y: 0, z: 0 };
    const target = { x: 0, y: 0, z: 0 };
    // Scrolled up at the start: nothing.
    scrollOrbit(o, -500);
    expect(o.yawTo).toBe(0);
    // Scrolled far down: stops side-on, the line of sight square to her facing (−z).
    for (let i = 0; i < 100; i++) scrollOrbit(o, 120);
    expect(o.yawTo).toBe(o.stop);
    for (let i = 0; i < 120; i++) stepOrbit(o, 1 / 60);
    orbitPoint(o, FRAMING.eye, eye);
    orbitPoint(o, FRAMING.target, target);
    expect(target.z - eye.z).toBeCloseTo(0, 4);
    // Past 180° round: on her right (+x) side, looking back across her.
    expect(o.stop).toBeLessThan(-Math.PI);
    expect(target.x - eye.x).toBeLessThan(0);
    expect(eye.x).toBeGreaterThan(PIVOT[0]);
    // A turn about the pivot: the eye as far from it as before, as high.
    const from = (p: { x: number; z: number }) => Math.hypot(p.x - PIVOT[0], p.z - PIVOT[2]);
    expect(from(eye)).toBeCloseTo(
      Math.hypot(FRAMING.eye[0] - PIVOT[0], FRAMING.eye[2] - PIVOT[2]),
      6,
    );
    expect(eye.y).toBe(FRAMING.eye[1]);
    // Scrolled back up: the framing again.
    for (let i = 0; i < 100; i++) scrollOrbit(o, -120);
    for (let i = 0; i < 120; i++) stepOrbit(o, 1 / 60);
    orbitPoint(o, FRAMING.eye, eye);
    expect(eye.x).toBeCloseTo(FRAMING.eye[0], 3);
    expect(eye.z).toBeCloseTo(FRAMING.eye[2], 3);
  });

  it('runs a seven-minute day: afternoon, sunset, night, dawn, the clothes changed at dusk', () => {
    expect(LOOP).toBe(420);
    const h: Hour = { night: 0, elevation: 0, azimuth: 0, golden: 0, outfit: 0, clockS: 0 };
    hourAt(30, h);
    expect([h.night, h.outfit]).toEqual([0, 0]);
    expect(h.elevation).toBeGreaterThan(0.4);
    hourAt(CYCLE.day + 5, h); // the sun going down: still light, golden
    expect(h.night).toBe(0);
    expect(h.golden).toBeGreaterThan(0.5);
    hourAt(300, h);
    expect([h.night, h.outfit]).toEqual([1, 1]);
    expect(h.elevation).toBeLessThan(0);
    hourAt(SCAN_DUSK, h);
    expect(h.outfit).toBeCloseTo(0.5, 5);
    // The loop joins: the end of dawn is the start of the afternoon.
    const a = hourAt(LOOP - 0.001, { ...h });
    const b = hourAt(LOOP, { ...h });
    expect(a.night).toBeCloseTo(b.night, 2);
    expect(a.elevation).toBeCloseTo(b.elevation, 2);
    expect(a.outfit).toBe(b.outfit);
  });

  it('sits Khoa by Linh at sunset and keeps raids away from them then', () => {
    expect(togetherAt(TOGETHER.from - 1)).toBe(-1);
    expect(togetherAt(TOGETHER.from + 10)).toBeCloseTo(10, 6);
    expect(togetherAt(LOOP + TOGETHER.from + 1)).toBeCloseTo(1, 6);
    for (let s = 0; s < LOOP; s += 1) {
      if (!raidAllowed(s)) continue;
      // A raid starting now ends (mended) before they sit, or starts after he is up.
      const overlaps = [0, RAID.mended].some((d) => togetherAt(s + d) >= 0);
      expect(overlaps).toBe(false);
    }
  });

  it('weighs clips in and out, eases keys and springs', () => {
    for (const clip of [...Object.values(LINH_CLIPS), ...Object.values(KHOA_CLIPS)]) {
      expect(weightOf(clip, 0)).toBe(0);
      expect(weightOf(clip, 0.5)).toBe(1);
      expect(weightOf(clip, 1)).toBeCloseTo(0, 6);
    }
    // Keys ease between values and hold at the ends; a foot lifts mid-step and lands where told.
    const track = [
      [0, 0],
      [1, 10],
    ] as const;
    expect(at(track, -1)).toBe(0);
    expect(at(track, 0.5)).toBeCloseTo(5, 6);
    expect(at(track, 2)).toBe(10);
    const out = { x: 0, y: 0, z: 0 };
    const steps = {
      start: [0, 0.07, 0] as const,
      lift: 0.1,
      steps: [{ from: 1, to: 2, at: [0.5, 0.07, -0.3] as const }],
    };
    expect(footAt(steps, 1.5, out)).toBeCloseTo(1, 6);
    expect(out.y).toBeCloseTo(0.17, 6);
    footAt(steps, 3, out);
    expect([out.x, out.y, out.z]).toEqual([0.5, 0.07, -0.3]);
    // A spring settles on its target without running away, whatever the frame time.
    const s = spring(0);
    for (let i = 0; i < 300; i++) stepSpring(s, 1, 2, 0.8, 1 / 60);
    expect(s.x).toBeCloseTo(1, 3);
    stepSpring(s, -1, 2, 1, 5);
    expect(Number.isFinite(s.x)).toBe(true);
  });

  it('directs actions from the menu, never the same twice running, an event cutting in', () => {
    const d = new Director(LINH_CLIPS, 3, [2, 4], 1);
    const seen: string[] = [];
    let last: string | null = null;
    for (let t = 0; t < 400; t += 0.1) {
      const p = d.update(t, ['lean', 'forward', 'karambit']);
      const name = p?.clip.name ?? null;
      if (name && name !== last) seen.push(name);
      if (name !== null) last = name;
      else last = last ?? null;
    }
    expect(seen.length).toBeGreaterThan(10);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    d.play('startle', 500);
    expect(d.update(500.1, ['lean'])?.clip.name).toBe('startle');
  });

  it('flies the raid in, holds over the oculus, blows it, drops four, leaves; the glass mends', () => {
    const p: HeliPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, bank: 0, rotor: 0, visible: false };
    heliAt(0, p);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(300);
    heliAt(RAID.blast, p);
    expect(Math.hypot(p.x, p.y, p.z)).toBeLessThan(2);
    heliAt(RAID.gone + 1, p);
    expect(p.visible).toBe(false);
    expect(ropesAt(RAID.blast)).toBe(0);
    expect(ropesAt(RAID.ropesDown + 3)).toBe(1);
    expect(ropesAt(RAID.reelTo)).toBe(0);
    for (let i = 0; i < 4; i++) {
      expect(slideAt(RAID.slides[i]! - 0.1, i)).toBe(-1);
      expect(slideAt(RAID.slides[i]! + RAID.slide, i)).toBeCloseTo(1, 6);
      // Each is down before the ropes come up.
      expect(RAID.slides[i]! + RAID.slide).toBeLessThan(RAID.reelFrom);
    }
    expect([blownAt(RAID.blast - 0.1), blownAt(RAID.blast), blownAt(RAID.mended)]).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('keeps the land flat under the city and the tower, hills and woods beyond', () => {
    expect(landHeight(0, 0)).toBe(-0.5);
    expect(landHeight(-CITY_ORIGIN.x, -CITY_ORIGIN.z)).toBe(-0.5); // under our tower
    expect(landHeight(FLAT_RADIUS + 3000, 0)).toBeGreaterThan(20);
    expect(woodsAt(1234, -987)).toBeGreaterThanOrEqual(0);
    const woods = woodTrees();
    expect(woods.length).toBeGreaterThan(1000);
    for (const t of woods.slice(0, 500)) expect(Math.hypot(t.x, t.z)).toBeGreaterThan(FLAT_RADIUS);
    const street = streetTrees();
    expect(street.every((t) => Math.max(Math.abs(t.x), Math.abs(t.z)) <= CITY_REACH)).toBe(true);
  });
});
