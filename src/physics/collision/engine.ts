import type { EngineInput, SimulationEngine } from '@/core/sim/engine';
import { dragAccel } from '../common/drag';
import type { Params } from '../types';
import { collide, contactTime } from './model';

/** State: ball k at offset 4k: [x, y, vx, vy]; then [collisions count, stuck]. */
export const CS = {
  x1: 0,
  y1: 1,
  vx1: 2,
  vy1: 3,
  x2: 4,
  y2: 5,
  vx2: 6,
  vy2: 7,
  count: 8,
  stuck: 9,
} as const;

export interface CollisionInput {
  m1: number;
  m2: number;
  r1: number;
  r2: number;
  v1: number;
  v2: number;
  e: number;
  /** Impact parameter as a fraction of r1 + r2 (0 = head-on). */
  b: number;
  twoD: boolean;
  gap: number;
}

export function collisionInput(p: Params): CollisionInput {
  const twoD = (p.mode ?? 0) > 0.5;
  return {
    m1: p.m1 ?? 1,
    m2: p.m2 ?? 1,
    r1: p.r1 ?? 0.1,
    r2: p.r2 ?? 0.1,
    v1: p.v1 ?? 2,
    v2: p.v2 ?? 0,
    e: Math.min(1, Math.max(0, p.e ?? 1)),
    b: twoD ? Math.min(0.99, Math.max(-0.99, p.b ?? 0)) : 0,
    twoD,
    gap: p.gap ?? 1,
  };
}

/** Initial positions: ball 1 on the left, ball 2 on the right, offset vertically by b·(r1+r2). */
export function initialPositions(q: CollisionInput) {
  const R = q.r1 + q.r2;
  return { p1: { x: -q.gap / 2 - q.r1, y: 0 }, p2: { x: q.gap / 2 + q.r2, y: q.b * R } };
}

/**
 * Two disks on a frictionless table. Free flight is straight-line, so the collision
 * instant is solved exactly (quadratic) inside the step and the impulse applied there.
 */
export class CollisionEngine implements SimulationEngine<Params> {
  readonly id = 'phys.collision';
  readonly stateSize = 10;
  dt = 1 / 240;
  private t = 0;
  private s = new Float64Array(10);
  private q: CollisionInput = collisionInput({});
  private drag: { body: number; x: number; y: number } | null = null;
  private tEnd = 8;

  reset(p: Params): void {
    this.q = collisionInput(p);
    const { p1, p2 } = initialPositions(this.q);
    this.s.set([p1.x, p1.y, this.q.v1, 0, p2.x, p2.y, this.q.v2, 0, 0, 0]);
    this.t = 0;
    this.drag = null;
    this.tEnd = p.tEnd ?? 8;
  }

  private collideNow(): void {
    const s = this.s;
    const dx = (s[CS.x2] ?? 0) - (s[CS.x1] ?? 0);
    const dy = (s[CS.y2] ?? 0) - (s[CS.y1] ?? 0);
    const d = Math.hypot(dx, dy) || 1;
    const n = { x: dx / d, y: dy / d };
    const r = collide(
      this.q.m1,
      this.q.m2,
      { x: s[CS.vx1] ?? 0, y: s[CS.vy1] ?? 0 },
      { x: s[CS.vx2] ?? 0, y: s[CS.vy2] ?? 0 },
      n,
      this.q.e,
    );
    s[CS.vx1] = r.v1.x;
    s[CS.vy1] = r.v1.y;
    s[CS.vx2] = r.v2.x;
    s[CS.vy2] = r.v2.y;
    s[CS.count] = (s[CS.count] ?? 0) + 1;
    if (this.q.e <= 0) s[CS.stuck] = 1;
  }

  private move(tau: number): void {
    const s = this.s;
    s[CS.x1] = (s[CS.x1] ?? 0) + (s[CS.vx1] ?? 0) * tau;
    s[CS.y1] = (s[CS.y1] ?? 0) + (s[CS.vy1] ?? 0) * tau;
    s[CS.x2] = (s[CS.x2] ?? 0) + (s[CS.vx2] ?? 0) * tau;
    s[CS.y2] = (s[CS.y2] ?? 0) + (s[CS.vy2] ?? 0) * tau;
  }

  step(): void {
    const s = this.s;
    let h = this.dt;
    this.t += h;
    if (this.drag) {
      const k = this.drag.body === 0 ? 0 : 4;
      const ax = dragAccel(this.drag.x, s[k] ?? 0, s[k + 2] ?? 0);
      const ay = dragAccel(this.drag.y, s[k + 1] ?? 0, s[k + 3] ?? 0);
      s[k + 2] = (s[k + 2] ?? 0) + ax * h;
      s[k + 3] = (s[k + 3] ?? 0) + ay * h;
      if ((s[CS.stuck] ?? 0) > 0.5) {
        // Stuck bodies move together.
        const o = 4 - k;
        s[o + 2] = s[k + 2] ?? 0;
        s[o + 3] = s[k + 3] ?? 0;
      }
    }
    for (let guard = 0; guard < 4 && h > 0; guard++) {
      if ((s[CS.stuck] ?? 0) > 0.5) {
        this.move(h);
        return;
      }
      const tau = contactTime(
        { x: (s[CS.x2] ?? 0) - (s[CS.x1] ?? 0), y: (s[CS.y2] ?? 0) - (s[CS.y1] ?? 0) },
        { x: (s[CS.vx2] ?? 0) - (s[CS.vx1] ?? 0), y: (s[CS.vy2] ?? 0) - (s[CS.vy1] ?? 0) },
        this.q.r1 + this.q.r2,
        h,
      );
      if (tau === null) {
        this.move(h);
        return;
      }
      this.move(tau);
      this.collideNow();
      h -= tau;
    }
    this.move(h);
  }

  time(): number {
    return this.t;
  }

  readState(out: Float64Array): void {
    out.set(this.s);
  }

  writeState(st: Float64Array, t: number): void {
    this.s.set(st.subarray(0, 10));
    this.t = t;
  }

  input(msg: EngineInput): boolean {
    switch (msg.kind) {
      case 'dragStart':
        this.drag = { body: msg.body, x: msg.x, y: msg.y };
        return true;
      case 'dragMove':
        if (this.drag) this.drag = { ...this.drag, x: msg.x, y: msg.y };
        return this.drag !== null;
      case 'dragEnd':
        this.drag = null;
        return true;
      case 'setParam':
        return false;
    }
  }

  finished(): boolean {
    return this.drag === null && this.t >= this.tEnd;
  }
}
