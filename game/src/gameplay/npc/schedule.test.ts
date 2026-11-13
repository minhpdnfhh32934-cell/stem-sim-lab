import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { buildNavGrid, type NavGrid } from '../../world/navGrid';
import { ItemDefinitionSchema } from '../item';
import { NpcDefinitionSchema } from './npc';
import { type NpcPose, planDay, poseAt, SETTLE_S } from './schedule';
import { RoomDefinitionSchema } from '../../world/definitions';

const teacher = NpcDefinitionSchema.parse((bundledContent.npcs as unknown[])[0]);
const items = new Map(
  (bundledContent.items as unknown[]).map((raw) => {
    const item = ItemDefinitionSchema.parse(raw);
    return [item.id, item] as const;
  }),
);
const hub = (bundledContent.rooms as unknown[])
  .map((raw) => RoomDefinitionSchema.parse(raw))
  .filter((room) => room.id === 'simlab-hub');
const grid: NavGrid = buildNavGrid(hub, (id) => items.get(id));
const pose = (): NpcPose => ({
  x: 0,
  z: 0,
  heading: 0,
  speed: 0,
  sit: 0,
  gesture: 'idle',
  stop: 0,
  walking: false,
});

describe("the teacher's day", () => {
  const plan = planDay(grid, teacher.schedule, teacher.walkSpeed);

  it('finds free floor at every stop and a walk between each two, round and round', () => {
    expect(plan.stops).toHaveLength(teacher.schedule.length);
    for (const stop of plan.stops) expect(stop.path.length).toBeGreaterThanOrEqual(2);
    // The day ends where it began: the last walk leads back to the counter.
    const first = plan.stops[0];
    expect(first?.path.slice(-2)).toEqual([first?.stand[0], first?.stand[1]]);
  });

  it('walks at his walking speed and never into furniture (his capsule clear of it)', () => {
    // The plan keeps 0.35 m off obstacles, its straight legs checked on its own grid; his body
    // is 0.28 m round: on a grid grown by that alone, no point of a walk is ever blocked.
    const body = buildNavGrid(hub, (id) => items.get(id), { clearance: 0.28 });
    const out = pose();
    let last: [number, number] | null = null;
    for (let t = 0; t < plan.periodS; t += 0.05) {
      poseAt(plan, t, teacher.walkSpeed, out);
      if (out.walking) {
        const c = Math.floor((out.x - body.minX) / body.cell);
        const r = Math.floor((out.z - body.minZ) / body.cell);
        expect(body.blocked[r * body.cols + c], `t ${t.toFixed(2)}`).toBe(0);
        if (last)
          expect(Math.hypot(out.x - last[0], out.z - last[1])).toBeLessThanOrEqual(
            teacher.walkSpeed * 0.05 + 1e-9,
          );
        last = [out.x, out.z];
      } else last = null;
    }
  });

  it('stands where his stop says, and sits down onto a seat and up again', () => {
    const out = pose();
    const counter = plan.stops[0];
    poseAt(plan, (counter?.stayS ?? 0) + 1, teacher.walkSpeed, out);
    expect([out.walking, out.sit, out.gesture]).toEqual([false, 0, 'idle']);
    expect(Math.hypot(out.x - 0, out.z + 8.4)).toBeLessThan(0.2);
    const bench = plan.stops.find((s) => s.activity.kind === 'sit');
    if (!bench) throw new Error('no seat in the day');
    poseAt(plan, bench.stayS + SETTLE_S + 1, teacher.walkSpeed, out);
    expect(out.sit).toBe(1);
    expect([out.x, out.z]).toEqual(bench.activity.at);
    poseAt(plan, bench.endS - 0.001, teacher.walkSpeed, out);
    expect(out.sit).toBeLessThan(0.01);
  });

  it('repeats: the same pose a whole day later', () => {
    const a = poseAt(plan, 123.4, teacher.walkSpeed, pose());
    const b = poseAt(plan, 123.4 + plan.periodS, teacher.walkSpeed, pose());
    expect(b).toEqual(a);
  });
});
