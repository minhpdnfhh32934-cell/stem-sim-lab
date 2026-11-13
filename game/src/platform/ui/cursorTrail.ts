import type { Disposables } from '../../core/EventBus';
import { listen } from '../BrowserInput';
import { el } from './dom';

/** Points the trail bends through behind the cursor, front to back; one line segment each. */
export const TRAIL_POINTS = 11;
/** How fast each point closes on the one ahead of it (1/s): a short, soft tail when slow. */
const FOLLOW_RATE = 26;
/** The trail's greatest length (px): a fast stroke pulls it along like a rope, never a string. */
const MAX_LENGTH = 110;
/** How fast the trail fades once the mouse stops (1/s). */
const FADE_RATE = 6;
/** Pointer travel (px) that brings the trail to full strength. */
const FULL_AFTER_PX = 60;
/** Below this strength the trail is out and nothing is written. */
const OUT = 0.002;
/** Below this movement (px) a frame leaves the segments where they are. */
const STILL = 0.05;

/**
 * Moves each point of a chain towards the one ahead of it — point 0 towards (x, y) — by the
 * fraction 1 − e^(−rate·dt) (exponential smoothing, nearly the same path at any frame rate), then
 * keeps it within `maxGap` of that one (a rope: pulled along when the head runs ahead). Returns
 * the largest distance a point moved. Nothing is allocated.
 */
export function followChain(
  xs: Float64Array,
  ys: Float64Array,
  x: number,
  y: number,
  dt: number,
  rate: number,
  maxGap = Infinity,
): number {
  const k = 1 - Math.exp(-rate * dt);
  let tx = x;
  let ty = y;
  let moved = 0;
  for (let i = 0; i < xs.length; i++) {
    const ox = xs[i] ?? 0;
    const oy = ys[i] ?? 0;
    let px = ox + (tx - ox) * k;
    let py = oy + (ty - oy) * k;
    const gap = Math.hypot(px - tx, py - ty);
    if (gap > maxGap) {
      px = tx + ((px - tx) * maxGap) / gap;
      py = ty + ((py - ty) * maxGap) / gap;
    }
    moved = Math.max(moved, Math.abs(px - ox) + Math.abs(py - oy));
    xs[i] = px;
    ys[i] = py;
    tx = px;
    ty = py;
  }
  return moved;
}

/**
 * A faint light trail behind the mouse on the main menu: one tapering line from the cursor back
 * through a fixed pool of segments — thicker and brighter at the front, fading faster than it
 * thins — with a soft glow at its head. The real cursor is untouched; the trail only draws behind
 * the menu panel, takes no pointer events and is aria-hidden. `pointermove` only keeps the latest
 * position and the distance moved; `update`, called from the game's one frame loop, moves the
 * segments (transform only, and only when they moved) and sets the whole trail's opacity, which
 * rises with movement and fades once the mouse stops — when out, it writes nothing. Off for
 * touch, for a coarse or missing pointer and under reduced motion (also hidden in CSS).
 */
export class CursorTrail {
  readonly root = el('div', 'menu-trail');
  private readonly head = el('span', 'menu-trail-head');
  private readonly segments: HTMLElement[] = [];
  private readonly xs = new Float64Array(TRAIL_POINTS);
  private readonly ys = new Float64Array(TRAIL_POINTS);
  private readonly fine = matchMedia('(pointer: fine)');
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private x = 0;
  private y = 0;
  /** Pointer travel (px) since the last frame. */
  private moved = 0;
  /** 0 (out) to 1: rises with movement, fades when the mouse stops. */
  private strength = 0;
  /** Whether the chain has a position yet: it starts where the pointer first moves. */
  private placed = false;

  constructor(listeners: Disposables, surface: HTMLElement) {
    this.root.setAttribute('aria-hidden', 'true');
    this.root.append(this.head);
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const u = i / (TRAIL_POINTS - 1); // 0 at the cursor, 1 at the tail
      const segment = el('span', 'menu-trail-segment');
      const height = 6 - 3.8 * u; // a soft line about 2.4 px wide at the front, 0.9 at the tail
      segment.style.height = `${height}px`;
      segment.style.marginTop = `${-height / 2}px`;
      segment.style.opacity = String(0.55 * (1 - 0.92 * u) ** 1.6);
      this.segments.push(segment);
      this.root.append(segment);
    }
    listen(listeners, surface, 'pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      if (this.placed) {
        this.moved += Math.abs(event.clientX - this.x) + Math.abs(event.clientY - this.y);
      } else {
        this.xs.fill(event.clientX);
        this.ys.fill(event.clientY);
        this.placed = true;
      }
      this.x = event.clientX;
      this.y = event.clientY;
    });
  }

  update(dt: number): void {
    if (!this.placed) return;
    // Turned off (reduced motion, no fine pointer): out at once, written out once.
    const off = !this.fine.matches || this.reduced.matches;
    const travel = this.moved;
    const strength = off
      ? 0
      : Math.min(1, this.strength + travel / FULL_AFTER_PX) * Math.exp(-FADE_RATE * dt);
    this.moved = 0;
    if (strength < OUT && this.strength === 0) return; // out, and already written out
    this.strength = strength < OUT ? 0 : strength;
    this.root.style.opacity = String(this.strength);
    if (off || this.strength === 0) return;
    const shift = followChain(
      this.xs,
      this.ys,
      this.x,
      this.y,
      dt,
      FOLLOW_RATE,
      MAX_LENGTH / TRAIL_POINTS,
    );
    if (shift < STILL && travel === 0) return; // nothing moved: the segments stay as written
    this.head.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    let ax = this.x;
    let ay = this.y;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const bx = this.xs[i] ?? ax;
      const by = this.ys[i] ?? ay;
      const angle = Math.atan2(by - ay, bx - ax);
      const length = Math.hypot(bx - ax, by - ay);
      const segment = this.segments[i];
      if (segment) {
        segment.style.transform = `translate3d(${ax}px, ${ay}px, 0) rotate(${angle}rad) scaleX(${length})`;
      }
      ax = bx;
      ay = by;
    }
  }
}
