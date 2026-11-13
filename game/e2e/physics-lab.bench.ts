import { writeFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import {
  Aim,
  AT_DESK,
  AT_PENDULUM_DESK,
  BAY,
  fullscreenWindow,
  labSave,
  lookAngles,
  PENDULUM_TARGETS as P,
  pendulumPeriod30,
  PROJECTILE_TARGETS as T,
  projectileTheory,
  RANGE,
  type Vec3,
  menuContinue,
} from './support';

// Phase 6C.1 benchmark (playwright.bench.config.ts, `npm run bench`): frame times of the Physics
// Lab's projectile range in the production build, played as a player plays it. The game is
// reached through Continue with a save of a player in the range (ball loaded, v₀ 5 m/s, θ 45°,
// Moon gravity): the game's own load path, no debug tools. A recorder injected before the game
// starts times every animation frame: the interval, the main-thread time of the frame
// (simulation, game logic and issuing the draws), the GPU time of its draws
// (EXT_disjoint_timer_query_webgl2, where the browser offers it) and the draw calls. It can also
// hand the game only every n-th display frame: the game then sees what a slower machine gives
// it, fewer frames with longer time steps. Phase 6C.2 adds the pendulum bay as its own scenario.

const DESK: Vec3 = [AT_DESK.x, 0, AT_DESK.z];
const LANE: Vec3 = [7, 2.4, 11.75]; // down the lane: launcher, flight, trail, tape and monitor
// Between the desk and the results monitor: RUN, RESET and the monitor are all within reach.
const BETWEEN: Vec3 = [0.6, 0, 14.5];
const MOON = projectileTheory(5, 45, 1.62);
/** The projectile station set up: ball loaded, v₀ 5 m/s, θ 45°, Moon gravity. */
const RANGE_SETUP = {
  [`${RANGE}/launcher`]: {
    'param.velocity': 5,
    'param.angle': 45,
    'param.gravity': 1.62,
    loaded: `${RANGE}/ball-2`,
  },
};
// The pendulum bay: its desk, the rig, and the station set to L 1.5 m, θ₀ 30°, Earth gravity.
const BAY_DESK: Vec3 = [AT_PENDULUM_DESK.x, 0, AT_PENDULUM_DESK.z];
const BAY_SETUP = {
  [`${BAY}/pendulum`]: { 'param.length': 1.5, 'param.angle': 30, 'param.gravity': 9.81 },
};
const SWING = pendulumPeriod30(1.5, 9.81);
// Run history (Phase 6C.3): stand east of the desk; θ₀ 30°, Earth, L 1 m then 1.5 m.
const HISTORY_STAND: Vec3 = [3.6, 0, -8.7];
const HISTORY_SETUP = { [`${BAY}/pendulum`]: { 'param.angle': 30 } };

/** A save of a player standing at `stand` looking at `look`, with a station set up. */
function save(stand: Vec3, look: Vec3, entityStates: object) {
  return labSave(stand, look, entityStates);
}

interface FrameLog {
  intervals: number[];
  cpu: number[];
  calls: number[];
  gpu: number[];
}
interface RendererInfo {
  vendor: string;
  renderer: string;
  width: number;
  height: number;
  pixelRatio: number;
  gpuTimer: boolean;
}
declare global {
  interface Window {
    frameRecorder?: {
      info(): RendererInfo;
      start(): void;
      stop(): Promise<FrameLog>;
      /** Hands the game one display frame in `every` (1: all of them). */
      limit(every: number): void;
    };
  }
}

/** Runs in the page before the game: wraps rAF, the WebGL2 context and its draw calls. */
function installRecorder(): void {
  let gl: WebGL2RenderingContext | null = null;
  let timer: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null = null;
  let log: FrameLog | null = null;
  let calls = 0;
  let last = 0;
  let every = 1;
  const pending: { query: WebGLQuery; into: FrameLog }[] = [];

  // eslint-disable-next-line @typescript-eslint/unbound-method -- called with .call(this) below
  const getContext = HTMLCanvasElement.prototype.getContext as (
    this: HTMLCanvasElement,
    id: string,
    options?: unknown,
  ) => RenderingContext | null;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    id: string,
    options?: unknown,
  ) {
    const context = getContext.call(this, id, options);
    // The page's canvas only: the boot's WebGL 2 check uses a canvas outside the page (Phase C2).
    if (id === 'webgl2' && context && !gl && this.isConnected) {
      gl = context as WebGL2RenderingContext;
      timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') as typeof timer;
    }
    return context;
  } as typeof HTMLCanvasElement.prototype.getContext;

  const proto = WebGL2RenderingContext.prototype as unknown as Record<
    string,
    (this: WebGL2RenderingContext, ...args: unknown[]) => unknown
  >;
  for (const name of [
    'drawArrays',
    'drawElements',
    'drawArraysInstanced',
    'drawElementsInstanced',
  ]) {
    const draw = proto[name];
    if (!draw) continue;
    proto[name] = function (this: WebGL2RenderingContext, ...args: unknown[]) {
      if (this === gl) calls++;
      return draw.apply(this, args);
    };
  }

  const collect = () => {
    if (!gl || !timer) return;
    while (pending.length > 0) {
      const { query, into } = pending[0]!;
      if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) !== true) break;
      const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT) === true;
      const ns = Number(gl.getQueryParameter(query, gl.QUERY_RESULT));
      gl.deleteQuery(query);
      pending.shift();
      if (!disjoint) into.gpu.push(ns / 1e6);
    }
  };

  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => {
    // Counted against the current `every` at each display frame, so limit(1) frees a callback
    // already waiting (fixed at request time, it held the game ~200 ms after a 1-in-59 run).
    let shown = 0;
    const frame = (time: number) => {
      if (++shown < every) {
        raf(frame); // a display frame the game does not get
        return;
      }
      const into = log;
      const query = into && gl && timer ? gl.createQuery() : null;
      if (query && gl && timer) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
      calls = 0;
      const start = performance.now();
      callback(time);
      const cpu = performance.now() - start;
      if (query && into && gl && timer) {
        gl.endQuery(timer.TIME_ELAPSED_EXT);
        if (calls > 0) pending.push({ query, into });
        else gl.deleteQuery(query);
      }
      // No draw call: the game skipped this display frame (its frame-rate cap, P3.3), so it is not
      // a frame; intervals run from one frame drawn to the next. Every frame's work is kept, the
      // window's first too: intervals[i] (frame i to i + 1) is the gap frame i's work delays.
      if (calls > 0) {
        if (into && last > 0) into.intervals.push(time - last);
        if (into) {
          into.cpu.push(cpu);
          into.calls.push(calls);
        }
        last = time;
      }
      collect();
    };
    return raf(frame);
  };

  window.frameRecorder = {
    info: () => {
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: gl && debug ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)) : '?',
        renderer: gl && debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '?',
        width: gl?.drawingBufferWidth ?? 0,
        height: gl?.drawingBufferHeight ?? 0,
        pixelRatio: window.devicePixelRatio,
        gpuTimer: timer !== null,
      };
    },
    start: () => {
      log = { intervals: [], cpu: [], calls: [], gpu: [] };
      last = 0;
    },
    stop: async () => {
      const done = log ?? { intervals: [], cpu: [], calls: [], gpu: [] };
      log = null;
      await new Promise((resolve) => setTimeout(resolve, 300)); // GPU results arrive frames later
      return done;
    },
    limit: (n) => {
      every = n;
    },
  };
}

interface Stats {
  mean: number;
  p95: number;
  max: number;
}
interface Summary {
  scenario: string;
  frames: number;
  fps: number;
  /** The frame rate of the slowest 1 % of frames (the mean of their intervals). */
  low1: number;
  frameMs: Stats;
  cpuMs: Stats;
  gpuMs: Stats | null;
  drawCalls: number;
}

function stats(values: readonly number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / Math.max(1, sorted.length);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return { mean, p95: at(0.95), max: sorted.at(-1) ?? 0 };
}

/** The mean of the slowest `share` of intervals (at least one). */
function slowest(values: readonly number[], share: number): number {
  const sorted = [...values].sort((a, b) => b - a);
  const n = Math.max(1, Math.floor(sorted.length * share));
  return sorted.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
}

/** The display (device px), the CSS viewport, fullscreen or not, and the vsync mode, for the header. */
async function display(page: Page): Promise<string> {
  const d = await page.evaluate(() => ({
    screen: `${Math.round(screen.width * devicePixelRatio)}×${Math.round(screen.height * devicePixelRatio)}`,
    viewport: `${innerWidth}×${innerHeight}`,
    fullscreen: innerWidth === screen.width && innerHeight === screen.height,
  }));
  const vsync = process.env.BENCH_UNCAPPED ? 'off (uncapped)' : 'on (display refresh)';
  return `display ${d.screen}, viewport ${d.viewport} CSS px, ${d.fullscreen ? 'fullscreen' : 'windowed'}, vsync ${vsync}`;
}

async function measure(page: Page, scenario: string, during: number | (() => Promise<void>)) {
  await page.evaluate(() => window.frameRecorder?.start());
  if (typeof during === 'number') await page.waitForTimeout(during);
  else await during();
  const log = await page.evaluate(() => window.frameRecorder!.stop());
  expect(log.intervals.length, scenario).toBeGreaterThan(10);
  const frame = stats(log.intervals);
  return {
    scenario,
    frames: log.intervals.length,
    fps: 1000 / frame.mean,
    low1: 1000 / slowest(log.intervals, 0.01),
    frameMs: frame,
    cpuMs: stats(log.cpu),
    gpuMs: log.gpu.length > 0 ? stats(log.gpu) : null,
    drawCalls: stats(log.calls).mean,
  } satisfies Summary;
}

/** Every page load gets the recorder, and the save it continues from (the game autosaves). */
async function prepare(page: Page, stand: Vec3, look: Vec3, entityStates: object = RANGE_SETUP) {
  await fullscreenWindow(page, test.info().project.name);
  await page.addInitScript(installRecorder);
  // BENCH_FRAME_CAP=30|60|90|120 measures under the game's frame-rate cap (Settings); unset: none.
  // BENCH_GRAPHICS=low|medium|high measures under that graphics quality (Settings); unset: default.
  const quality = process.env.BENCH_GRAPHICS;
  if (quality) {
    await page.addInitScript(
      (value) => localStorage.setItem('simlab.settings.graphicsQuality', value),
      quality,
    );
  }
  const cap = process.env.BENCH_FRAME_CAP;
  if (cap) {
    await page.addInitScript(
      (value) => localStorage.setItem('simlab.settings.frameCap', value),
      cap,
    );
  }
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: 'simlab.save.slot-1',
    value: JSON.stringify(save(stand, look, entityStates)),
  });
}

/** Continue from the save: standing at `stand`, looking at `look`, at the experiment named. */
async function continueAt(page: Page, stand: Vec3, look: Vec3, experiment = 'Projectile motion') {
  await page.goto('/');
  await menuContinue(page);
  await expect(page.locator('.hud-objective')).toContainText(experiment, { timeout: 30_000 }); // Ultra: its surfaces too
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = lookAngles(stand, look);
  const info = await page.evaluate(() => window.frameRecorder!.info());
  // A number that cannot name its renderer is not reported.
  expect(info.renderer, 'WebGL renderer unknown (no WEBGL_debug_renderer_info)').not.toBe('?');
  const software = /SwiftShader|llvmpipe|Software|Basic Render/i.test(info.renderer);
  // A GPU project that renders in software would measure the wrong thing: refuse, with the reason.
  expect(software, `WebGL renderer: ${info.renderer}`).toBe(
    test.info().project.name === 'software',
  );
  return { aim, info };
}

/** Aims at a control from `stand`, checks the prompt names it, presses E. */
async function press(page: Page, aim: Aim, stand: Vec3, target: Vec3, label: string) {
  await aim.at(target, stand);
  await expect(page.locator('.hud-prompt')).toContainText(label);
  await page.keyboard.press('e');
}

/** The run's "Running" notice: shown at once after RUN, replaced by the results on landing. */
const started = (page: Page) =>
  expect(page.locator('.hud-toast', { hasText: 'Running' })).toBeVisible();

/** Waits for the run's results notice. */
async function landed(page: Page, timeout = 30_000, notice = 'Flight time'): Promise<string> {
  const done = page.locator('.hud-toast', { hasText: notice });
  await expect(done).toBeVisible({ timeout });
  return done.innerText();
}

const table = (rows: readonly Summary[]) =>
  rows
    .map(
      (r) =>
        `  ${r.scenario.padEnd(34)} ${r.fps.toFixed(1).padStart(6)} fps (1% low ${r.low1.toFixed(0)})  frame ${r.frameMs.mean.toFixed(2)} ms` +
        ` (p95 ${r.frameMs.p95.toFixed(2)}, max ${r.frameMs.max.toFixed(1)})` +
        `  cpu ${r.cpuMs.mean.toFixed(2)} ms (p95 ${r.cpuMs.p95.toFixed(2)})` +
        `  gpu ${r.gpuMs ? `${r.gpuMs.mean.toFixed(2)} ms (p95 ${r.gpuMs.p95.toFixed(2)})` : 'n/a'}` +
        `  ${r.drawCalls.toFixed(0)} draws`,
    )
    .join('\n');

test('physics lab frame times: idle, interacting, running, after landing', async ({ page }) => {
  await prepare(page, DESK, LANE);
  const { aim, info } = await continueAt(page, DESK, LANE);
  await page.waitForTimeout(2000); // shaders compiled, screens painted
  const rows: Summary[] = [];
  rows.push(await measure(page, 'idle (looking down the lane)', 5000));
  await page.screenshot({ path: test.info().outputPath('idle.png') });

  await aim.at(T.dialAngle, DESK);
  await expect(page.locator('.hud-prompt')).toContainText('Raise θ');
  rows.push(
    await measure(page, 'interacting (θ dial, 8 presses)', async () => {
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press(i % 2 === 0 ? 'e' : 'f'); // 45° → 50° → 45° …
        await page.waitForTimeout(500);
      }
    }),
  );

  await press(page, aim, DESK, T.run, 'RUN');
  await started(page);
  await aim.at(LANE, DESK);
  rows.push(await measure(page, 'running (ball in flight)', 2500));
  await page.screenshot({ path: test.info().outputPath('running.png') });
  const result = await landed(page);
  expect(result).toContain(`Flight time: ${Number(MOON.time.toPrecision(4))} s`);
  rows.push(await measure(page, 'after landing (trail, results)', 5000));
  await page.screenshot({ path: test.info().outputPath('landed.png') });

  const cap = process.env.BENCH_FRAME_CAP || 'none';
  const graphics = process.env.BENCH_GRAPHICS || 'default';
  const report = {
    project: test.info().project.name,
    ...info,
    frameCap: cap,
    graphics,
    result,
    rows,
  };
  writeFileSync(test.info().outputPath('bench.json'), JSON.stringify(report, null, 2));
  process.stdout.write(
    `\n[${report.project}] ${info.renderer} — ${info.width}×${info.height} px, ` +
      `pixel ratio ${info.pixelRatio.toFixed(2)}, ${await display(page)}, ` +
      `GPU timer ${info.gpuTimer ? 'yes' : 'no'}, game FPS cap ${cap}, graphics ${graphics}\n${table(rows)}\n`,
  );
});

test('pendulum bay frame times: idle, swinging, after the run', async ({ page }) => {
  await prepare(page, BAY_DESK, P.rig, BAY_SETUP);
  const { aim, info } = await continueAt(page, BAY_DESK, P.rig, 'Simple pendulum');
  await page.waitForTimeout(2000); // shaders compiled, screens painted
  const rows: Summary[] = [];
  rows.push(await measure(page, 'pendulum idle (rig and desk)', 5000));
  await page.screenshot({ path: test.info().outputPath('pendulum-idle.png') });

  await press(page, aim, BAY_DESK, P.run, 'RUN');
  await started(page);
  await aim.at(P.rig, BAY_DESK);
  rows.push(await measure(page, 'pendulum swinging', 5000)); // of three 2.5 s periods
  await page.screenshot({ path: test.info().outputPath('pendulum-swinging.png') });
  const result = await landed(page, 30_000, 'Simple pendulum — T:');
  expect(result).toContain(`T: ${Number(SWING.toPrecision(4))} s`);
  rows.push(await measure(page, 'pendulum after the run', 5000));

  const report = { project: test.info().project.name, ...info, result, rows };
  writeFileSync(test.info().outputPath('pendulum-bench.json'), JSON.stringify(report, null, 2));
  process.stdout.write(
    `\n[${report.project}] pendulum bay: ${info.renderer} — ${info.width}×${info.height} px, ` +
      `pixel ratio ${info.pixelRatio.toFixed(2)}, GPU timer ${info.gpuTimer ? 'yes' : 'no'}\n${table(rows)}\n`,
  );
});

test('run history closed and open: two and four pendulum runs compared', async ({ page }) => {
  // East of the pendulum desk, looking at the results monitor: RUN, RESET, the L dial and the
  // monitor all in reach, so the view is the same with the history closed and open. Four runs:
  // L 1, 1.5, 1.75 and 2 m.
  await prepare(page, HISTORY_STAND, P.monitor, HISTORY_SETUP);
  const { aim, info } = await continueAt(page, HISTORY_STAND, P.monitor, 'Simple pendulum');
  for (const [settings, period] of [
    [[], pendulumPeriod30(1, 9.81)],
    [[P.dialLength, P.dialLength, P.reset], pendulumPeriod30(1.5, 9.81)],
    [[P.dialLength, P.reset], pendulumPeriod30(1.75, 9.81)],
    [[P.dialLength, P.reset], pendulumPeriod30(2, 9.81)],
  ] as const) {
    for (const target of settings) {
      await press(page, aim, HISTORY_STAND, target, target === P.reset ? 'RESET' : 'Raise L');
    }
    await press(page, aim, HISTORY_STAND, P.run, 'RUN');
    await started(page);
    await landed(page, 30_000, `T: ${Number(period.toPrecision(4))} s`);
  }
  await aim.at(P.monitor, HISTORY_STAND);
  await page.waitForTimeout(1000); // the notices fade, the monitor repainted
  const rows: Summary[] = [await measure(page, 'history closed (monitor in view)', 5000)];

  await page.keyboard.press('e');
  const panel = page.locator('.results-panel');
  await expect(panel).toBeVisible();
  await page.evaluate(() => document.exitPointerLock()); // as Esc does, to tick the runs
  await panel.getByRole('checkbox', { name: 'Select run 1' }).check();
  await panel.getByRole('checkbox', { name: 'Select run 2' }).check();
  await expect(panel.locator('svg[data-compare] polyline[data-run]')).toHaveCount(8);
  rows.push(await measure(page, 'history open: 2 runs compared', 5000));
  await page.screenshot({ path: test.info().outputPath('history-open.png') });
  await panel.getByRole('checkbox', { name: 'Select run 3' }).check();
  await panel.getByRole('checkbox', { name: 'Select run 4' }).check();
  await expect(panel.locator('svg[data-compare] polyline[data-run]')).toHaveCount(16);
  rows.push(await measure(page, 'history open: 4 runs compared', 5000));
  await page.screenshot({ path: test.info().outputPath('history-open-4.png') });

  const report = { project: test.info().project.name, ...info, rows };
  writeFileSync(test.info().outputPath('history-bench.json'), JSON.stringify(report, null, 2));
  process.stdout.write(
    `\n[${report.project}] run history: ${info.renderer} — ${info.width}×${info.height} px, ` +
      `pixel ratio ${info.pixelRatio.toFixed(2)}, GPU timer ${info.gpuTimer ? 'yes' : 'no'}\n${table(rows)}\n`,
  );
});

test('the same flight at every frame rate the game is given', async ({ page }) => {
  test.skip(
    test.info().project.name !== 'gpu-headless',
    'one GPU project is enough, and a windowless one cannot be disturbed by the mouse',
  );
  // Every run starts from the same save, looking at RUN: one known state, no turns before RUN.
  await prepare(page, BETWEEN, T.run);
  const panel = page.locator('.results-panel');
  const flights = [];
  await continueAt(page, BETWEEN, T.run);
  const base = (await measure(page, 'browser frame rate', 1000)).fps;
  // The browser's own rate, then 1 frame in n for 60, 30, 20, 15, 10 and 5 fps.
  const divisors = [
    1,
    ...[60, 30, 20, 15, 10, 5].map((fps) => Math.max(1, Math.round(base / fps))),
  ];
  for (const every of divisors) {
    const { aim } = await continueAt(page, BETWEEN, T.run);
    await expect(page.locator('.hud-prompt')).toContainText('RUN');
    await page.evaluate((n) => window.frameRecorder?.limit(n), every);
    await page.evaluate(() => window.frameRecorder?.start());
    const pressed = Date.now();
    await page.keyboard.press('e');
    await started(page);
    await landed(page, 60_000);
    const seconds = (Date.now() - pressed) / 1000;
    const log = await page.evaluate(() => window.frameRecorder!.stop());
    await page.evaluate(() => window.frameRecorder?.limit(1));
    await press(page, aim, BETWEEN, T.monitor, 'Read the results');
    await expect(panel).toBeVisible();
    await expect(panel.locator('h2')).toContainText('(completed)');
    const measured = async (id: string) =>
      panel.locator(`tr[data-result="${id}"] .measured`).innerText();
    flights.push({
      every,
      fps: 1000 / stats(log.intervals).mean,
      seconds,
      results: {
        flightTime: await measured('flight-time'),
        range: await measured('range'),
        maxHeight: await measured('max-height'),
        impactSpeed: await measured('impact-speed'),
        samples: await panel.locator('svg[data-graph]').first().getAttribute('data-samples'),
      },
    });
  }
  writeFileSync(test.info().outputPath('flights.json'), JSON.stringify(flights, null, 2));
  process.stdout.write(
    `\n[frame rates] theory: T ${MOON.time.toFixed(3)} s, R ${MOON.range.toFixed(3)} m\n` +
      flights
        .map(
          (f) =>
            `  1 in ${String(f.every).padEnd(3)} ${f.fps.toFixed(1).padStart(6)} fps  ` +
            `${f.seconds.toFixed(2).padStart(5)} s to watch  T ${f.results.flightTime}  ` +
            `R ${f.results.range}  H ${f.results.maxHeight}  v ${f.results.impactSpeed}  ` +
            `${String(f.results.samples)} samples`,
        )
        .join('\n') +
      '\n',
  );
  // The physics is the same at every frame rate; only how long it takes to watch may change.
  const first = flights[0]!.results;
  for (const f of flights) expect(f.results, `1 in ${f.every} frames`).toEqual(first);
  expect(first.range).toBe(`${MOON.range.toFixed(3)} m`);
  expect(first.flightTime).toBe(`${MOON.time.toFixed(3)} s`);
});
