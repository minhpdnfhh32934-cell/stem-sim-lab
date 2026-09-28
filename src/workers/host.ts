import { createEngine, type EngineInput } from '@/core/sim/engine';
import { EngineRunner, type Frame, type RunnerError } from '@/core/sim/runner';
import './engines';
import type { FromWorker, ToWorker } from './protocol';

export type HostError = RunnerError | { code: 'load'; message: string };

export interface LoadedInfo {
  stateSize: number;
  dt: number;
}

/**
 * UI-side handle on a running simulation. The default implementation runs the engine in
 * a Web Worker so heavy physics never blocks rendering; `InProcessHost` runs it on the
 * calling thread (tests, environments without workers).
 */
export interface SimulationHost {
  load(engineId: string, params: unknown): Promise<LoadedInfo>;
  /** Requests the next frame. Calls made while one is in flight are merged. */
  requestFrame(frameSeconds: number, speed: number, paused: boolean): void;
  onFrame(cb: (frame: Frame) => void): () => void;
  onError(cb: (error: HostError) => void): () => void;
  reset(params: unknown): void;
  input(msg: EngineInput): void;
  seek(state: Float64Array, t: number): void;
  dispose(): void;
}

class Listeners<T> {
  private set = new Set<(v: T) => void>();
  add(cb: (v: T) => void) {
    this.set.add(cb);
    return () => {
      this.set.delete(cb);
    };
  }
  emit(v: T) {
    for (const cb of this.set) cb(v);
  }
}

export class InProcessHost implements SimulationHost {
  private runner: EngineRunner | undefined;
  private readonly frames = new Listeners<Frame>();
  private readonly errors = new Listeners<HostError>();

  async load(engineId: string, params: unknown): Promise<LoadedInfo> {
    const engine = await createEngine(engineId);
    engine.reset(params);
    this.runner = new EngineRunner(engine);
    return { stateSize: engine.stateSize, dt: engine.dt };
  }

  requestFrame(frameSeconds: number, speed: number, paused: boolean): void {
    if (!this.runner) return;
    const out = this.runner.frame(frameSeconds, speed, paused);
    if ('code' in out) this.errors.emit(out);
    else this.frames.emit(out);
  }

  onFrame(cb: (frame: Frame) => void) {
    return this.frames.add(cb);
  }
  onError(cb: (error: HostError) => void) {
    return this.errors.add(cb);
  }
  reset(params: unknown): void {
    this.runner?.reset(params);
  }
  input(msg: EngineInput): void {
    this.runner?.input(msg);
  }
  seek(state: Float64Array, t: number): void {
    this.runner?.seek(state, t);
  }
  dispose(): void {
    this.runner = undefined;
  }
}

export class WorkerHost implements SimulationHost {
  private readonly worker: Worker;
  private readonly frames = new Listeners<Frame>();
  private readonly errors = new Listeners<HostError>();
  private pending = new Map<number, (info: LoadedInfo) => void>();
  private nextRequest = 1;
  private seq = 0;
  private inFlight = false;
  private loaded = false;
  private queued: { frameSeconds: number; speed: number; paused: boolean } | undefined;

  constructor() {
    this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => {
      this.handle(ev.data);
    };
    this.worker.onerror = (ev) => {
      this.errors.emit({ code: 'engine', message: ev.message });
    };
  }

  private send(msg: ToWorker) {
    this.worker.postMessage(msg);
  }

  private handle(msg: FromWorker) {
    switch (msg.type) {
      case 'loaded': {
        this.loaded = true;
        this.pending.get(msg.requestId)?.({ stateSize: msg.stateSize, dt: msg.dt });
        this.pending.delete(msg.requestId);
        return;
      }
      case 'frame': {
        this.inFlight = false;
        this.frames.emit(msg.frame);
        const q = this.queued;
        if (q) {
          this.queued = undefined;
          this.requestFrame(q.frameSeconds, q.speed, q.paused);
        }
        return;
      }
      case 'error':
        this.inFlight = false;
        this.errors.emit(msg.error);
        return;
    }
  }

  load(engineId: string, params: unknown): Promise<LoadedInfo> {
    const requestId = this.nextRequest++;
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve);
      this.send({ type: 'load', requestId, engineId, params });
    });
  }

  requestFrame(frameSeconds: number, speed: number, paused: boolean): void {
    // Frames requested before the engine has loaded would be dropped by the worker.
    if (!this.loaded) return;
    if (this.inFlight) {
      // Backpressure: merge elapsed time instead of queueing many frames.
      const prev = this.queued?.frameSeconds ?? 0;
      this.queued = { frameSeconds: prev + frameSeconds, speed, paused };
      return;
    }
    this.inFlight = true;
    this.send({ type: 'frame', seq: ++this.seq, frameSeconds, speed, paused });
  }

  onFrame(cb: (frame: Frame) => void) {
    return this.frames.add(cb);
  }
  onError(cb: (error: HostError) => void) {
    return this.errors.add(cb);
  }
  reset(params: unknown): void {
    this.queued = undefined;
    this.send({ type: 'reset', params });
  }
  input(msg: EngineInput): void {
    this.send({ type: 'input', msg });
  }
  seek(state: Float64Array, t: number): void {
    this.queued = undefined;
    this.send({ type: 'seek', t, state });
  }
  dispose(): void {
    this.worker.terminate();
  }
}

/** Worker-backed host when available, in-process otherwise. */
export function createSimulationHost(): SimulationHost {
  if (typeof Worker !== 'undefined' && import.meta.env.MODE !== 'test') return new WorkerHost();
  return new InProcessHost();
}
