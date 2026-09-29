import { useSettingsStore } from '@/app/settings/settingsStore';
import { PLAYBACK_SPEEDS, useWorkspaceStore, type PlaybackSpeed } from '@/app/workspaceStore';
import type { EngineInput } from '@/core/sim/engine';
import type { Frame } from '@/core/sim/runner';
import { registerCacheRelease } from '@/perf/memory';
import { usePerfStore } from '@/perf/perfStore';
import { closeModule } from '@/modules/moduleStore';
import { applyAutoDefaults } from '@/physics/autoDefaults';
import { loadScene } from '@/physics/registry';
import type { ParamSource, Params, PhysicsScene } from '@/physics/types';
import { withIntervention, type ScienceCardData } from '@/science-card/types';
import { createSimulationHost, type SimulationHost } from '@/workers/host';
import { History } from './history';
import { useSimStore } from './simStore';

const UI_HZ = 10;

function closestSpeed(s: number): PlaybackSpeed {
  let best: PlaybackSpeed = 1;
  for (const o of PLAYBACK_SPEEDS)
    if (Math.abs(Math.log(o / s)) < Math.abs(Math.log(best / s))) best = o;
  return best;
}

function lerpState(prev: Float64Array, curr: Float64Array, alpha: number, out: Float64Array) {
  for (let i = 0; i < curr.length; i++) {
    const a = prev[i] ?? 0;
    out[i] = a + ((curr[i] ?? 0) - a) * alpha;
  }
}

export interface OpenOptions {
  params?: Params;
  sources?: Record<string, ParamSource>;
  problem?: { text: string; questions: string[] };
}

/**
 * Owns the running physics simulation: the worker host, the recorded history and the
 * interpolated render state. React components read coarse state from `useSimStore`
 * and the canvas reads `renderState` every frame.
 */
class SimRuntime {
  private host: SimulationHost | null = null;
  private unsubscribers: (() => void)[] = [];
  private openSeq = 0;
  readonly history = new History();
  latest: Frame | null = null;
  renderState: Float64Array | null = null;
  private lastUi = 0;
  private stepping = false;

  get scene(): PhysicsScene | null {
    return useSimStore.getState().scene;
  }

  /** Opens a topic with its defaults (optionally overridden by a problem / the user). */
  async open(topicId: string, opts: OpenOptions = {}): Promise<void> {
    const seq = ++this.openSeq;
    closeModule();
    this.close();
    useSimStore.setState({ loading: true, error: null });
    usePerfStore.setState({ degraded: false });
    try {
      const scene = await loadScene(topicId);
      if (seq !== this.openSeq) return;
      const params: Params = { ...scene.defaults };
      const sources: Record<string, ParamSource> = {};
      for (const k of Object.keys(params)) sources[k] = 'default';
      if (scene.usesGravity) params.g = useSettingsStore.getState().defaultGravity;
      // Only parameters the scene knows (a project file or problem cannot add others).
      const known = new Set([...Object.keys(params), ...scene.params.map((d) => d.key)]);
      for (const [k, v] of Object.entries(opts.params ?? {})) {
        if (known.has(k) && Number.isFinite(v)) params[k] = v;
      }
      for (const [k, v] of Object.entries(opts.sources ?? {})) {
        if (known.has(k)) sources[k] = v;
      }
      Object.assign(params, applyAutoDefaults(scene, params, sources));
      const speed = scene.suggestedSpeed?.(params);
      if (speed !== undefined) useWorkspaceStore.setState({ speed: closestSpeed(speed) });
      useSimStore.setState({
        scene,
        params,
        sources,
        loading: false,
        intervened: false,
        finished: false,
        duration: 0,
        scrubTime: null,
        selected: null,
        problem: opts.problem ?? null,
        validation: scene.validate?.(params) ?? [],
        fitRequest: useSimStore.getState().fitRequest + 1,
      });
      useWorkspaceStore.setState({ hasSimulation: true, playing: false, simTime: 0 });
      await this.startEngine();
      this.updateCard();
    } catch (e) {
      console.error(e);
      useSimStore.setState({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  private engineParams(): Params {
    const { scene, params } = useSimStore.getState();
    return scene?.engineParams?.(params) ?? params;
  }

  private async startEngine(): Promise<void> {
    const scene = this.scene;
    if (!scene) return;
    const host = createSimulationHost();
    this.host = host;
    this.unsubscribers.push(
      host.onFrame((f) => {
        this.onFrame(f);
      }),
      host.onError((err) => {
        useWorkspaceStore.setState({ playing: false });
        useSimStore.setState({
          error: err.code === 'nonFinite' ? 'nonFinite' : 'message' in err ? err.message : 'error',
        });
      }),
    );
    const info = await host.load(scene.engineId, this.engineParams());
    this.history.clear();
    this.renderState = new Float64Array(info.stateSize);
    // Prime the first frame so the scene is drawn before playing.
    host.requestFrame(0, 1, true);
  }

  /** Closes the simulation and cancels an `open` still in progress. */
  shutdown(): void {
    this.openSeq++;
    useSimStore.setState({ loading: false, error: null });
    this.close();
  }

  close(): void {
    for (const u of this.unsubscribers) u();
    this.unsubscribers = [];
    this.host?.dispose();
    this.host = null;
    this.latest = null;
    this.renderState = null;
    this.history.clear();
    useWorkspaceStore.setState({
      hasSimulation: false,
      playing: false,
      simTime: 0,
      scienceCard: null,
    });
    useSimStore.setState({ scene: null, params: {}, sources: {} });
  }

  private onFrame(f: Frame): void {
    this.latest = f;
    const out = this.renderState ?? new Float64Array(f.curr.length);
    lerpState(f.prev, f.curr, f.alpha, out);
    this.renderState = out;
    this.history.push(f.t, f.curr, f.stats.finished);

    const store = useSimStore.getState();
    const now = performance.now();
    const intervenedChanged = f.stats.intervened !== store.intervened;
    if (f.stats.finished && useWorkspaceStore.getState().playing) {
      useWorkspaceStore.setState({ playing: false });
    }
    if (
      now - this.lastUi > 1000 / UI_HZ ||
      intervenedChanged ||
      f.stats.finished !== store.finished
    ) {
      this.lastUi = now;
      useSimStore.setState({
        intervened: f.stats.intervened,
        finished: f.stats.finished,
        duration: this.history.duration,
        dataVersion: store.dataVersion + 1,
        tick: store.tick + 1,
      });
      useWorkspaceStore.setState({ simTime: f.t });
      const speed = useWorkspaceStore.getState().speed;
      const perf = usePerfStore.getState();
      if (useWorkspaceStore.getState().playing && f.stats.steps > 0) {
        perf.setTimeScale(Math.min(1, f.stats.effectiveSpeed / speed));
      } else if (!useWorkspaceStore.getState().playing && perf.timeScale !== 1) {
        // Slow motion only describes a running simulation.
        perf.setTimeScale(1);
      }
      if (intervenedChanged) this.updateCard();
    }
  }

  /** Called once per animation frame by the stage canvas. */
  tick(frameSeconds: number): void {
    const host = this.host;
    if (!host) return;
    const { playing, speed } = useWorkspaceStore.getState();
    const { scrubTime } = useSimStore.getState();
    if (scrubTime !== null && !playing) {
      const s = this.history.stateAt(scrubTime);
      if (s) this.renderState = s;
      return;
    }
    if (this.stepping) {
      this.stepping = false;
      host.requestFrame(1 / 240, 1, false);
      return;
    }
    host.requestFrame(frameSeconds, speed, !playing);
  }

  togglePlay(): void {
    const ws = useWorkspaceStore.getState();
    if (!ws.hasSimulation) return;
    if (ws.playing) {
      useWorkspaceStore.setState({ playing: false });
      return;
    }
    const sim = useSimStore.getState();
    if (sim.validation.length > 0) return;
    if (sim.scrubTime !== null) this.resumeFromScrub();
    else if (sim.finished) this.reset();
    useWorkspaceStore.setState({ playing: true });
  }

  private resumeFromScrub(): void {
    const t = useSimStore.getState().scrubTime;
    if (t === null || !this.host) return;
    const state = this.history.stateAt(t);
    if (state) {
      this.host.seek(state, t);
      this.history.truncateAfter(t);
    }
    useSimStore.setState({ scrubTime: null, finished: false });
  }

  step(): void {
    const ws = useWorkspaceStore.getState();
    if (!ws.hasSimulation || useSimStore.getState().validation.length > 0) return;
    if (useSimStore.getState().scrubTime !== null) this.resumeFromScrub();
    useWorkspaceStore.setState({ playing: false });
    this.stepping = true;
  }

  reset(): void {
    if (!this.host) return;
    this.host.reset(this.engineParams());
    this.history.clear();
    useSimStore.setState({
      intervened: false,
      finished: false,
      duration: 0,
      scrubTime: null,
      dataVersion: useSimStore.getState().dataVersion + 1,
    });
    usePerfStore.getState().setTimeScale(1);
    useWorkspaceStore.setState({ playing: false, simTime: 0 });
    this.host.requestFrame(0, 1, true);
    this.updateCard();
  }

  scrub(t: number): void {
    const d = this.history.duration;
    useWorkspaceStore.setState({ playing: false, simTime: Math.max(0, Math.min(d, t)) });
    useSimStore.setState({ scrubTime: Math.max(0, Math.min(d, t)) });
  }

  /** Changes a parameter. Live-editable params apply mid-run (as an intervention). */
  setParam(key: string, value: number, source: ParamSource = 'user'): void {
    const sim = useSimStore.getState();
    const scene = sim.scene;
    if (!scene) return;
    const sources = { ...sim.sources, [key]: source };
    const params = applyAutoDefaults(scene, { ...sim.params, [key]: value }, sources);
    const def = scene.params.find((d) => d.key === key);
    const running = (this.latest?.t ?? 0) > 0 && !sim.finished;
    useSimStore.setState({
      params,
      sources,
      validation: scene.validate?.(params) ?? [],
    });
    if (running && def?.live && (scene.validate?.(params) ?? []).length === 0) {
      const ep = scene.engineParams?.(params) ?? params;
      this.host?.input({ kind: 'setParam', name: key, value: ep[key] ?? value });
      this.updateCard();
    } else {
      this.reset();
      useSimStore.setState({ fitRequest: useSimStore.getState().fitRequest + 1 });
    }
  }

  /** Replaces all parameters at once (undo/redo) and restarts from t = 0. */
  applyParams(params: Params, sources: Record<string, ParamSource>): void {
    const scene = this.scene;
    if (!scene) return;
    useSimStore.setState({ params, sources, validation: scene.validate?.(params) ?? [] });
    this.reset();
    useSimStore.setState({ fitRequest: useSimStore.getState().fitRequest + 1 });
  }

  input(msg: EngineInput): void {
    if (useSimStore.getState().scrubTime !== null) this.resumeFromScrub();
    this.host?.input(msg);
    if (msg.kind === 'dragStart') useSimStore.setState({ finished: false });
  }

  /** Science Card for the current scene, params and intervention state. */
  currentCard(): ScienceCardData | null {
    const { scene, params, sources, intervened } = useSimStore.getState();
    if (!scene || (scene.validate?.(params) ?? []).length > 0) return null;
    const card = withIntervention(scene.scienceCard(params), intervened);
    const defaults = scene.params.filter((d) => sources[d.key] === 'default' && d.key === 'g');
    if (defaults.length > 0 && params.g !== undefined) {
      card.assumptions = [
        ...card.assumptions,
        {
          vi: `g = ${String(params.g).replace('.', ',')} m/s² là giá trị mặc định (đề bài không cho).`,
          en: `g = ${params.g} m/s² is a default value (not given in the problem).`,
        },
      ];
    }
    return card;
  }

  private updateCard(): void {
    useWorkspaceStore.setState({ scienceCard: this.currentCard() });
  }
}

export const sim = new SimRuntime();

// Under memory pressure the recorded run keeps every other sample (graph resolution only;
// the simulation itself is not affected).
registerCacheRelease(() => {
  sim.history.decimate();
});
