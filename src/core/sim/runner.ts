import { allFinite } from '../ode/types';
import { FixedStepClock } from './clock';
import type { EngineInput, SimulationEngine } from './engine';

export interface FrameStats {
  steps: number;
  /** Simulated seconds per real second actually achieved this frame. */
  effectiveSpeed: number;
  /** True when the substep cap or time budget forced slow motion. */
  throttled: boolean;
  /** Largest relative drift of any conserved quantity since reset (0 if none). */
  maxRelDrift: number;
  /** The user has dragged/thrown something: analytic answers no longer apply (§2.5). */
  intervened: boolean;
  finished: boolean;
  /** Milliseconds spent stepping this frame. */
  stepMs: number;
}

export interface Frame {
  t: number;
  alpha: number;
  prev: Float64Array;
  curr: Float64Array;
  stats: FrameStats;
}

export type RunnerError = { code: 'nonFinite'; t: number } | { code: 'engine'; message: string };

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Drives an engine with a fixed-step clock, guards against NaN/Infinity, tracks
 * conserved quantities and enforces a per-frame time budget. Used identically inside
 * the Web Worker and in-process (tests, fallback).
 */
export class EngineRunner {
  readonly clock: FixedStepClock;
  private prev: Float64Array;
  private curr: Float64Array;
  private lastGood: Float64Array;
  private lastGoodT = 0;
  private reference: Record<string, number> | undefined;
  private maxRelDrift = 0;
  private intervened = false;

  constructor(
    readonly engine: SimulationEngine,
    /** Max milliseconds of stepping per frame before slowing down (degradation ladder). */
    public budgetMs = 8,
  ) {
    this.clock = new FixedStepClock(engine.dt);
    this.prev = new Float64Array(engine.stateSize);
    this.curr = new Float64Array(engine.stateSize);
    this.lastGood = new Float64Array(engine.stateSize);
    this.captureInitial();
  }

  private captureInitial() {
    this.engine.readState(this.curr);
    this.prev.set(this.curr);
    this.lastGood.set(this.curr);
    this.lastGoodT = this.engine.time();
    this.reference = this.engine.diagnostics?.().invariants;
    this.maxRelDrift = 0;
    this.intervened = false;
    this.clock.reset();
  }

  reset(params: unknown): void {
    this.engine.reset(params);
    this.clock.dt = this.engine.dt;
    this.captureInitial();
  }

  /** Jumps to a recorded state (scrubbing). Not an intervention: the state is on the path. */
  seek(state: Float64Array, t: number): void {
    this.engine.writeState(state, t);
    this.engine.readState(this.curr);
    this.prev.set(this.curr);
    this.lastGood.set(this.curr);
    this.lastGoodT = t;
    this.clock.reset();
  }

  input(msg: EngineInput): void {
    if (this.engine.input?.(msg)) {
      this.intervened = true;
      // Energy is no longer conserved once the user adds work; restart the reference.
      this.reference = undefined;
    }
  }

  /** Advances by one rendered frame. Throws a RunnerError-like object on NaN. */
  frame(frameSeconds: number, speed: number, paused = false): Frame | RunnerError {
    const start = now();
    let steps = 0;
    let throttled = false;
    let simulated = 0;
    let alpha = 1;
    const finishedBefore = this.engine.finished?.() ?? false;

    if (!paused && !finishedBefore) {
      const adv = this.clock.advance(frameSeconds, speed);
      throttled = adv.dropped > 0;
      alpha = adv.alpha;
      for (let i = 0; i < adv.steps; i++) {
        this.prev.set(this.curr);
        try {
          this.engine.step();
        } catch (e) {
          return { code: 'engine', message: e instanceof Error ? e.message : String(e) };
        }
        steps++;
        simulated += this.engine.dt;
        this.engine.readState(this.curr);
        if (!allFinite(this.curr)) {
          this.engine.writeState(this.lastGood, this.lastGoodT);
          this.engine.readState(this.curr);
          this.prev.set(this.curr);
          this.clock.reset();
          return { code: 'nonFinite', t: this.lastGoodT };
        }
        if (this.engine.finished?.()) break;
        if (now() - start > this.budgetMs && i < adv.steps - 1) {
          throttled = true;
          this.clock.reset();
          alpha = 1;
          break;
        }
      }
      if (steps > 0) {
        this.lastGood.set(this.curr);
        this.lastGoodT = this.engine.time();
      }
      this.trackDrift();
    }

    const finished = this.engine.finished?.() ?? false;
    return {
      t: this.engine.time(),
      alpha: finished || paused ? 1 : alpha,
      prev: Float64Array.from(this.prev),
      curr: Float64Array.from(this.curr),
      stats: {
        steps,
        effectiveSpeed: frameSeconds > 0 ? simulated / Math.min(frameSeconds, 0.25) : 0,
        throttled,
        maxRelDrift: this.maxRelDrift,
        intervened: this.intervened,
        finished,
        stepMs: now() - start,
      },
    };
  }

  private trackDrift() {
    const ref = this.reference;
    const current = this.engine.diagnostics?.().invariants;
    if (!ref || !current) return;
    for (const [k, v0] of Object.entries(ref)) {
      const v = current[k];
      if (v === undefined) continue;
      const scale = Math.max(Math.abs(v0), 1e-12);
      this.maxRelDrift = Math.max(this.maxRelDrift, Math.abs(v - v0) / scale);
    }
  }
}

export function isRunnerError(x: Frame | RunnerError): x is RunnerError {
  return 'code' in x;
}
