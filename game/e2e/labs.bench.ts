import { writeFileSync } from 'node:fs';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { holdPitch, holdReach } from '../src/gameplay/interaction/hold';
import { workspace } from './chem-workspace';
import { Aim, EYE_HEIGHT, fullscreenWindow, lookAngles, type Vec3, menuContinue } from './support';
import { countWebGL, webglCounts } from './webgl';

// Frame times of the Chemistry Lab, the Biology Lab and the hub in the production build
// (playwright.bench.config.ts, `npm run bench`), each reached through Continue from a save of a
// player standing there (no developer jump), as e2e/physics-lab.bench.ts does for the Physics Lab.
// Per scenario: fps, frame interval, main-thread time of the game's frame, GPU time of its draws
// (EXT_disjoint_timer_query_webgl2), draw calls and triangles (counted at the draw calls of the
// page canvas's context), texture uploads (texImage2D/texSubImage2D: a repainted canvas is one),
// shader programs linked (a first-use compile), the longest frame broken down, the browser's long
// animation frames (over 50 ms, with the script that ran longest in each),
// the live WebGL objects by kind (webgl.ts) and the JS heap (performance.memory, Chromium only).
// The production build has no debug panel: setups come from the save (container contents, moved
// glassware, station setup steps and parameters, a cabinet's door) and are checked through what the
// player sees (prompts, notices, the workspace's state).

const CHEM = 'chemistry-lab';
const BIO = 'biology-lab';
const HUB = 'simlab-hub';

// Chemistry Lab (src/content/lab-placements.json): the main bench with the dilution colorimeter
// (−0.3, 0.9, −4.66) and its tile (−0.6, 0.9, −4.68), the reagent cabinet behind it on the north
// wall (x 2.3), doors facing south.
const OVERVIEW: Vec3 = [1.586, 0, -2.553];
const OVERVIEW_LOOK: Vec3 = [0.9, 1, -7.579]; // the dilution bench left of centre, the cabinet right
const CABINET_OPEN = { [`${CHEM}/reagent-cabinet`]: { open: true } };
// The pour: the 50 mL flask on the tile holding the 5 mL of 20 µmol/L stock the pipette delivered,
// the wash bottle on the bench beside it, the player in front of the tile (as e2e/physical-lab.spec.ts).
const TILE: Vec3 = [-0.6, 0.906, -7.459];
const FLASK_H = 0.11256; // dil-flask-50
const WASH_H = 0.19; // dil-wash-bottle
const FLASK_MOUTH: Vec3 = [TILE[0], TILE[1] + FLASK_H, TILE[2]];
// On the bench left of the tile, clear of the colorimeter (it stood at the old bench front,
// z −4.6, until the lab grew in U-2: the bench found nothing to grab).
const WASH_AT: Vec3 = [-0.95, 0.9 + WASH_H / 2, -7.379];
const HOLD = 0.45; // config player.holdDistance, m: the held item is holdReach along the view
// The nozzle's tip is this far ahead of the held bottle's centre and above it (items.json
// pour.spout, held ahead); it is held 0.25 m over the flask's mouth.
const NOZZLE_AHEAD = 0.034;
const NOZZLE_UP = 0.075;
const POUR_PITCH = holdPitch(FLASK_MOUTH[1] + 0.25 - NOZZLE_UP - EYE_HEIGHT, HOLD) ?? 0;
// Where the hold puts the nozzle over the mouth: just off the bench front.
const AT_TILE: Vec3 = [
  TILE[0],
  0,
  TILE[2] + holdReach(POUR_PITCH, HOLD) * Math.cos(POUR_PITCH) + NOZZLE_AHEAD,
];
const POUR_SETUP = {
  entityStates: {
    [`${CHEM}/dilution`]: {
      'param.stockConcentration': 0.00002,
      'param.stockVolume': 5,
      'param.finalVolume': 50,
      'setup.flask': true,
      'setup.aspirate': true,
      'setup.dispense': true,
    },
    [`${CHEM}/flask-50`]: { seat: `${CHEM}/dilution-tile/tile` },
  },
  containers: {
    [`${CHEM}/flask-50`]: {
      contents: { 'stock-20': 5000 },
      temperatureC: 20,
      closed: false,
      mixed: false,
    },
  },
  objects: {
    [`${CHEM}/flask-50`]: {
      position: [TILE[0], TILE[1] + FLASK_H / 2, TILE[2]],
      rotation: [0, 0, 0, 1],
    },
    [`${CHEM}/wash-bottle`]: { position: WASH_AT, rotation: [0, 0, 0, 1] },
  },
};
// Titration by hand (Phase B, e2e/titration-physical.spec.ts): the retort stand on the west
// island, the burette clamped and full of 0.1 mol/L NaOH, 25 mL of HCl and phenolphthalein in the
// flask on the tile under the tip — every before-run step done; E at the stand opens the tap.
const TITRATION_STAND: Vec3 = [-5.714, 1.2, -1.903];
const AT_TITRATION: Vec3 = [-5.714, 0, -1.003];
const TITRATION_SETUP = {
  entityStates: {
    [`${CHEM}/titration`]: {
      'param.acidVolume': 25,
      'param.baseConcentration': 0.1,
      'param.endpointPH': 8.2,
      'setup.clamp': true,
      'setup.fill-01': true,
      'setup.aspirate': true,
      'setup.dispense': true,
      'setup.indicator-pp': true,
      'setup.tile': true,
    },
    [`${CHEM}/burette`]: { clamp: `${CHEM}/titration/stand` },
    [`${CHEM}/conical-flask`]: { seat: `${CHEM}/titration/tile` },
  },
  containers: {
    [`${CHEM}/burette`]: {
      contents: { 'naoh-01': 50000 },
      temperatureC: 20,
      closed: false,
      mixed: false,
    },
    [`${CHEM}/conical-flask`]: {
      contents: { hcl: 25000, phenolphthalein: 150 },
      temperatureC: 20,
      closed: false,
      mixed: false,
    },
  },
  objects: {
    [`${CHEM}/burette`]: { position: [-5.714, 1.38, -1.903], rotation: [0, 0, 0, 1] },
    [`${CHEM}/conical-flask`]: { position: [-5.714, 0.988, -1.903], rotation: [0, 0, 0, 1] },
  },
};
// Biology Lab (e2e/microscope.spec.ts): the digital microscope on the south bench, the onion slide
// made and on the stage, 10×, the stage at the focal plane.
const MICROSCOPE: Vec3 = [0.45, 1.075, 7.15];
const AT_MICROSCOPE: Vec3 = [0.5, 0, 6.1];
const MICROSCOPE_SETUP = {
  entityStates: {
    [`${BIO}/digital-microscope`]: {
      'param.specimen': 0,
      'param.stain': 1,
      'param.objective': 10,
      'param.focus': 0,
      'setup.new-slide': true,
      'setup.specimen': true,
      'setup.stain': true,
      'setup.coverslip': true,
      'setup.stage': true,
    },
  },
};

interface World {
  entityStates?: object;
  containers?: object;
  objects?: object;
}

/** A save (current version, 4) of a player in `sceneId` at `stand` looking at `look`. */
function save(sceneId: string, stand: Vec3, look: Vec3, world: World = {}, tasks?: object) {
  const [yaw, pitch] = lookAngles(stand, look);
  return {
    version: 8, // v9's migration only adds the time of day (08:00): nothing moves
    savedAt: '2026-11-01T00:00:00.000Z',
    player: {
      characterId: 'researcher-male',
      sceneId,
      position: stand,
      yaw,
      pitch,
      equipment: [],
      inventory: { stacks: [], selected: 0 },
    },
    world: {
      entityStates: world.entityStates ?? {},
      containers: world.containers ?? {},
      objects: world.objects ?? {},
    },
    progression: {
      completedExperiments: [],
      procedures: {},
      tasks: tasks ?? { active: null, done: [] },
    },
  };
}

interface FrameLog {
  intervals: number[];
  cpu: number[];
  calls: number[];
  triangles: number[];
  uploads: number[];
  uploadMs: number[];
  links: number[];
  /** Each frame that linked a shader program: the programs (three.js SHADER_TYPE/NAME), its cpu. */
  linked: string[];
  gpu: number[];
  /** Long animation frames (PerformanceObserver 'long-animation-frame', Chromium). */
  long: LongFrame[];
}
interface LongFrame {
  /** ms after the scenario's start. */
  at: number;
  duration: number;
  /** Script time in the frame (scripts over 5 ms only, as the browser attributes them). */
  scriptMs: number;
  /** Whether an input event (a click, a key) was handled in the frame. */
  input: boolean;
  /** From the start of rendering (rAF callbacks, style, layout, paint) to the frame's end. */
  render: number;
  /** From the start of style and layout to the frame's end. */
  styleLayout: number;
  /** The script that ran longest: its invoker and duration. */
  script: string;
}
interface RendererInfo {
  vendor: string;
  renderer: string;
  width: number;
  height: number;
  pixelRatio: number;
  gpuTimer: boolean;
  /** The display in device px (screen × DPR), the page's CSS viewport, and fullscreen or windowed. */
  screen: string;
  viewport: string;
  fullscreen: boolean;
}
declare global {
  interface Window {
    labRecorder?: {
      info(): RendererInfo;
      start(): void;
      stop(): Promise<FrameLog>;
    };
  }
}

/**
 * Runs in the page before the game: physics-lab.bench.ts's recorder (rAF, the page canvas's
 * WebGL 2 context, its draw calls, a GPU timer query around each game frame), plus triangles
 * (TRIANGLES: count/3, strips and fans: count − 2, times the instances) and texture uploads.
 */
function installRecorder(): void {
  let gl: WebGL2RenderingContext | null = null;
  let timer: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null = null;
  let log: FrameLog | null = null;
  let calls = 0;
  let triangles = 0;
  let uploads = 0;
  let uploadMs = 0;
  let links = 0;
  let linkedNames: string[] = [];
  let logStart = 0;
  let last = 0;
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
  const tris = (mode: unknown, count: unknown, instances: unknown = 1) => {
    const n = Number(count) * Number(instances);
    if (mode === 4) return Math.floor(n / 3); // TRIANGLES
    if (mode === 5 || mode === 6) return Math.max(0, Number(count) - 2) * Number(instances);
    return 0;
  };
  // Where each draw call keeps its mode, vertex count and instances.
  const shapes: Record<string, (args: unknown[]) => number> = {
    drawArrays: (a) => tris(a[0], a[2]),
    drawElements: (a) => tris(a[0], a[1]),
    drawArraysInstanced: (a) => tris(a[0], a[2], a[3]),
    drawElementsInstanced: (a) => tris(a[0], a[1], a[4]),
  };
  for (const [name, shape] of Object.entries(shapes)) {
    const draw = proto[name];
    if (!draw) continue;
    proto[name] = function (this: WebGL2RenderingContext, ...args: unknown[]) {
      if (this === gl) {
        calls++;
        triangles += shape(args);
      }
      return draw.apply(this, args);
    };
  }
  for (const name of ['texImage2D', 'texSubImage2D']) {
    const upload = proto[name];
    if (!upload) continue;
    proto[name] = function (this: WebGL2RenderingContext, ...args: unknown[]) {
      if (this !== gl) return upload.apply(this, args);
      const start = performance.now();
      const result = upload.apply(this, args);
      uploadMs += performance.now() - start;
      uploads++;
      return result;
    };
  }

  const link = proto.linkProgram!;
  proto.linkProgram = function (this: WebGL2RenderingContext, ...args: unknown[]) {
    if (this === gl && log) {
      links++;
      // three.js writes the material type (and name, if any) as defines at the top of its shaders.
      const sources = (this.getAttachedShaders(args[0] as WebGLProgram) ?? []).map(
        (shader) => this.getShaderSource(shader) ?? '',
      );
      const of = (key: string) =>
        sources.map((src) => new RegExp(`#define ${key} (.*)`).exec(src)?.[1]).find(Boolean);
      linkedNames.push(
        `${of('SHADER_TYPE') ?? '?'}${of('SHADER_NAME') ? ` "${of('SHADER_NAME')}"` : ''}`,
      );
    }
    return link.apply(this, args);
  };
  interface Loaf {
    startTime: number;
    duration: number;
    renderStart: number;
    styleAndLayoutStart: number;
    firstUIEventTimestamp: number;
    scripts: { invoker: string; duration: number }[];
  }
  try {
    new PerformanceObserver((list) => {
      if (!log) return;
      for (const e of list.getEntries() as unknown as Loaf[]) {
        const end = e.startTime + e.duration;
        const top = [...e.scripts].sort((a, b) => b.duration - a.duration)[0];
        log.long.push({
          at: e.startTime - logStart,
          duration: e.duration,
          scriptMs: e.scripts.reduce((sum, script) => sum + script.duration, 0),
          input: e.firstUIEventTimestamp > 0,
          render: e.renderStart > 0 ? end - e.renderStart : 0,
          styleLayout: e.styleAndLayoutStart > 0 ? end - e.styleAndLayoutStart : 0,
          script: top ? `${top.invoker} ${top.duration.toFixed(0)} ms` : '-',
        });
      }
    }).observe({ type: 'long-animation-frame' });
  } catch {
    // no long-animation-frame entries in this browser: the column stays empty
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
  window.requestAnimationFrame = (callback) =>
    raf((time: number) => {
      const into = log;
      const query = into && gl && timer ? gl.createQuery() : null;
      if (query && gl && timer) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
      calls = 0;
      triangles = 0;
      uploads = 0;
      uploadMs = 0;
      links = 0;
      linkedNames = [];
      const start = performance.now();
      callback(time);
      const cpu = performance.now() - start;
      if (query && into && gl && timer) {
        gl.endQuery(timer.TIME_ELAPSED_EXT);
        if (calls > 0) pending.push({ query, into });
        else gl.deleteQuery(query);
      }
      // No draw call: the game skipped this display frame (its frame-rate cap), so not a frame.
      // Every frame's work is kept, the window's first too: intervals[i] (frame i to i + 1) is the
      // gap that frame i's work delays, so cpu[i], calls[i], … describe the frame before the gap.
      if (calls > 0) {
        if (into && last > 0) into.intervals.push(time - last);
        if (into) {
          into.cpu.push(cpu);
          into.calls.push(calls);
          into.triangles.push(triangles);
          into.uploads.push(uploads);
          into.uploadMs.push(uploadMs);
          into.links.push(links);
        }
        if (into && linkedNames.length > 0) {
          into.linked.push(`${linkedNames.join(' + ')} in a ${cpu.toFixed(1)} ms frame`);
        }
        last = time;
      }
      collect();
    });

  const empty = (): FrameLog => ({
    intervals: [],
    cpu: [],
    calls: [],
    triangles: [],
    uploads: [],
    uploadMs: [],
    links: [],
    linked: [],
    gpu: [],
    long: [],
  });
  window.labRecorder = {
    info: () => {
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: gl && debug ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)) : '?',
        renderer: gl && debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '?',
        width: gl?.drawingBufferWidth ?? 0,
        height: gl?.drawingBufferHeight ?? 0,
        pixelRatio: window.devicePixelRatio,
        gpuTimer: timer !== null,
        screen: `${Math.round(screen.width * devicePixelRatio)}×${Math.round(screen.height * devicePixelRatio)}`,
        viewport: `${innerWidth}×${innerHeight}`,
        // A fullscreen window covers the whole screen (Edge's --start-fullscreen sets no element).
        fullscreen: innerWidth === screen.width && innerHeight === screen.height,
      };
    },
    start: () => {
      log = empty();
      logStart = performance.now();
      last = 0;
    },
    stop: async () => {
      const done = log ?? empty();
      log = null;
      await new Promise((resolve) => setTimeout(resolve, 300)); // GPU results arrive frames later
      return done;
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
  /** Frames longer than twice the mean interval: hitches. */
  slow: number;
  cpuMs: Stats;
  gpuMs: Stats | null;
  drawCalls: number;
  triangles: number;
  /** Texture uploads per frame (mean) and the frames that had one. */
  uploads: number;
  uploadFrames: number;
  uploadMs: Stats;
  /** Shader programs linked during the scenario. */
  links: number;
  /** The longest interval, and the main-thread time, draws, uploads and links of the frame before it. */
  worst: { ms: number; cpu: number; draws: number; uploads: number; links: number };
  linked: string[];
  long: LongFrame[];
  webgl: Record<string, number>;
  heapMB: number | null;
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

async function measure(page: Page, scenario: string, during: number | (() => Promise<void>)) {
  await page.evaluate(() => window.labRecorder?.start());
  if (typeof during === 'number') await page.waitForTimeout(during);
  else await during();
  const log = await page.evaluate(() => window.labRecorder!.stop());
  expect(log.intervals.length, scenario).toBeGreaterThan(10);
  const frame = stats(log.intervals);
  const w = log.intervals.indexOf(frame.max);
  const counts = await webglCounts(page);
  const heap = await page.evaluate(
    () =>
      (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
        ?.usedJSHeapSize ?? null,
  );
  return {
    scenario,
    frames: log.intervals.length,
    fps: 1000 / frame.mean,
    low1: 1000 / slowest(log.intervals, 0.01),
    frameMs: frame,
    slow: log.intervals.filter((v) => v > 2 * frame.mean).length,
    cpuMs: stats(log.cpu),
    gpuMs: log.gpu.length > 0 ? stats(log.gpu) : null,
    drawCalls: stats(log.calls).mean,
    triangles: stats(log.triangles).mean,
    uploads: stats(log.uploads).mean,
    uploadFrames: log.uploads.filter((n) => n > 0).length,
    uploadMs: stats(log.uploadMs),
    links: log.links.reduce((sum, n) => sum + n, 0),
    worst: {
      ms: frame.max,
      cpu: log.cpu[w] ?? 0,
      draws: log.calls[w] ?? 0,
      uploads: log.uploads[w] ?? 0,
      links: log.links[w] ?? 0,
    },
    linked: log.linked,
    long: log.long,
    webgl: counts.live,
    heapMB: heap === null ? null : heap / 2 ** 20,
  } satisfies Summary;
}

/** The recorder, the WebGL object counter and the bench settings for every page load. */
async function prepare(page: Page) {
  await fullscreenWindow(page, test.info().project.name);
  await page.addInitScript(installRecorder);
  await page.addInitScript(countWebGL);
  // BENCH_GRAPHICS=low|medium|high|ultra measures under that graphics quality (Settings); unset: default.
  const quality = process.env.BENCH_GRAPHICS;
  if (quality) {
    await page.addInitScript(
      (value) => localStorage.setItem('simlab.settings.graphicsQuality', value),
      quality,
    );
  }
}

/**
 * Continue from `data`: the game's own load path. Every load writes this save over the slot (a later
 * init script runs after an earlier one, so the newest save wins). Refuses a GPU project that renders
 * in software, as physics-lab.bench.ts does.
 */
async function continueFrom(page: Page, data: ReturnType<typeof save>) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: 'simlab.save.slot-1',
    value: JSON.stringify(data),
  });
  await page.goto('/');
  await menuContinue(page);
  await expect
    .poll(() => page.evaluate(() => window.labRecorder?.info().width ?? 0), { timeout: 30_000 })
    .toBeGreaterThan(0);
  const info = await page.evaluate(() => window.labRecorder!.info());
  // A number that cannot name its renderer is not reported.
  expect(info.renderer, 'WebGL renderer unknown (no WEBGL_debug_renderer_info)').not.toBe('?');
  const software = /SwiftShader|llvmpipe|Software|Basic Render/i.test(info.renderer);
  // A GPU project that renders in software would measure the wrong thing: refuse, with the reason.
  expect(software, `WebGL renderer: ${info.renderer}`).toBe(
    test.info().project.name === 'software',
  );
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = lookAngles(data.player.position, lookPoint(data));
  await page.waitForTimeout(3000); // the scene and the lab pack in, shaders compiled, screens painted
  return { aim, info };
}

/** A point straight along the save's view, for Aim's starting direction. */
function lookPoint(data: ReturnType<typeof save>): Vec3 {
  const { position: p, yaw, pitch } = data.player;
  return [
    p[0] - Math.sin(yaw) * Math.cos(pitch),
    p[1] + EYE_HEIGHT + Math.sin(pitch),
    p[2] - Math.cos(yaw) * Math.cos(pitch),
  ];
}

const notice = (page: Page, text: string) => page.locator('.hud-toast', { hasText: text }).first();

const table = (rows: readonly Summary[]) =>
  rows
    .map(
      (r) =>
        `  ${r.scenario.padEnd(40)} ${r.fps.toFixed(1).padStart(6)} fps (1% low ${r.low1.toFixed(0)})  frame ${r.frameMs.mean.toFixed(2)} ms` +
        ` (p95 ${r.frameMs.p95.toFixed(2)}, max ${r.frameMs.max.toFixed(1)}, >2× ${r.slow}/${r.frames})` +
        `  cpu ${r.cpuMs.mean.toFixed(2)} ms (p95 ${r.cpuMs.p95.toFixed(2)}, max ${r.cpuMs.max.toFixed(1)})` +
        `  gpu ${r.gpuMs ? `${r.gpuMs.mean.toFixed(2)} ms (p95 ${r.gpuMs.p95.toFixed(2)}, max ${r.gpuMs.max.toFixed(1)})` : 'n/a'}` +
        `  ${r.drawCalls.toFixed(0)} draws  ${(r.triangles / 1000).toFixed(1)}k tris` +
        `  uploads ${r.uploadFrames}/${r.frames} frames (max ${r.uploadMs.max.toFixed(1)} ms)` +
        `  GL ${Object.entries(r.webgl)
          .map(([kind, n]) => `${kind} ${n}`)
          .join(', ')}` +
        `  heap ${r.heapMB === null ? 'n/a' : `${r.heapMB.toFixed(0)} MB`}` +
        `
    links ${r.links}; longest frame ${r.worst.ms.toFixed(1)} ms: cpu ${r.worst.cpu.toFixed(1)} ms,` +
        ` ${r.worst.draws} draws, ${r.worst.uploads} uploads, ${r.worst.links} links` +
        r.linked
          .map(
            (l) => `
    linked ${l}`,
          )
          .join('') +
        r.long
          .map(
            (l) =>
              `
    long frame at +${l.at.toFixed(0)} ms, ${l.duration.toFixed(0)} ms${l.input ? ' (input)' : ''}:` +
              ` scripts ${l.scriptMs.toFixed(0)} ms, render ${l.render.toFixed(0)} ms,` +
              ` style+layout ${l.styleLayout.toFixed(0)} ms, top script ${l.script}`,
          )
          .join(''),
    )
    .join('\n');

function report(name: string, info: RendererInfo, rows: readonly Summary[]) {
  const graphics = process.env.BENCH_GRAPHICS || 'default';
  const project = test.info().project.name;
  const vsync = process.env.BENCH_UNCAPPED ? 'off (uncapped)' : 'on (display refresh)';
  writeFileSync(
    test.info().outputPath(`${name}.json`),
    JSON.stringify({ project, ...info, vsync, graphics, rows }, null, 2),
  );
  process.stdout.write(
    `\n[${project}] ${name}: ${info.renderer} — render ${info.width}×${info.height} px, ` +
      `pixel ratio ${info.pixelRatio.toFixed(2)}, display ${info.screen}, viewport ${info.viewport} CSS px, ` +
      `${info.fullscreen ? 'fullscreen' : 'windowed'}, vsync ${vsync}, game FPS cap none, ` +
      `GPU timer ${info.gpuTimer ? 'yes' : 'no'}, ` +
      `graphics ${graphics}\n${table(rows)}\n`,
  );
}

/**
 * Opens the workspace of the apparatus in focus (E) and waits until it is ready and settled: the
 * opening is its own scenario, so its first layout is not counted against the next one.
 */
async function openWorkspace(page: Page, scenario: string) {
  await expect(page.locator('.hud-prompt')).toContainText('Work at the bench');
  const ws = workspace(page);
  // A fixed wait, checked after: no locator polling runs in the page while frames are timed.
  const row = await measure(page, scenario, async () => {
    await page.keyboard.press('e');
    await page.waitForTimeout(2500);
  });
  await expect(ws).toBeVisible();
  await expect(ws.locator('.ws-state')).toHaveText('Ready');
  return { ws, row };
}

/**
 * The centre of a control, found before a measurement: a click there is the mouse alone (as a
 * player's), without Playwright's actionability checks running in the page while frames are timed.
 */
async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('control not on screen');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: test.info().outputPath(`${name}.png`) });

test('chemistry lab: overview, cabinet open, wash-bottle pour, titration running', async ({
  page,
}) => {
  await prepare(page);
  const rows: Summary[] = [];

  // a. The main bench and the reagent cabinet in view, doors shut, then open (the save's door).
  const { info } = await continueFrom(page, save(CHEM, OVERVIEW, OVERVIEW_LOOK));
  rows.push(await measure(page, 'chem: bench + cabinet in view, idle', 5000));
  await shot(page, 'chem-overview');
  await continueFrom(page, save(CHEM, OVERVIEW, OVERVIEW_LOOK, { entityStates: CABINET_OPEN }));
  rows.push(await measure(page, 'chem: same view, cabinet open', 5000));
  await shot(page, 'chem-cabinet-open');
  // Phase A: a guided task followed from here — the floor path to the cabinet, which is outlined.
  const TASK = { active: { id: 'dilution-by-hand', step: 0 }, done: [] };
  await continueFrom(page, save(CHEM, OVERVIEW, OVERVIEW_LOOK, {}, TASK));
  await expect(page.locator('.task-current')).toContainText('Step 1 of 13');
  rows.push(await measure(page, 'chem: guided task (path + outline)', 5000));
  await shot(page, 'chem-task');

  // b. The pour: take the wash bottle, its nozzle over the flask's neck by the view alone (the hold
  // point is holdReach along it), squeeze (R held) from 5 mL to the 50 mL mark: the run is the pour.
  // The save looks at what is used first: no turn (each one re-captures the mouse) before it.
  const { aim } = await continueFrom(page, save(CHEM, AT_TILE, WASH_AT, POUR_SETUP));
  rows.push(await measure(page, 'chem: at the tile, idle', 3000));
  await expect(page.locator('.hud-prompt')).toContainText('Grab');
  await page.keyboard.press('e');
  await aim.to(lookAngles(AT_TILE, FLASK_MOUTH)[0], POUR_PITCH);
  await page.waitForTimeout(1500); // the held bottle follows to its hold point
  rows.push(await measure(page, 'chem: wash bottle held over flask', 3000));
  await shot(page, 'chem-nozzle');
  rows.push(
    await measure(page, 'chem: squeezing to the mark (driven run)', async () => {
      await page.keyboard.down('r');
      await expect(notice(page, 'It is full to the mark.')).toBeVisible({ timeout: 30_000 });
      await page.keyboard.up('r');
    }),
  );
  await shot(page, 'chem-mark');

  // c. Titration by hand: the bench set up from the save; E at the stand opens the tap.
  await continueFrom(page, save(CHEM, AT_TITRATION, TITRATION_STAND, TITRATION_SETUP));
  await expect(page.locator('.hud-prompt')).toContainText('Open the tap');
  rows.push(await measure(page, 'chem: titration bench ready (stand)', 3000));
  await page.keyboard.press('e');
  rows.push(await measure(page, 'chem: titration tap open (flowing)', 5000));
  await shot(page, 'chem-titration-flowing');

  report('chemistry lab', info, rows);
});

test('biology lab: room idle, digital microscope observing', async ({ page }) => {
  await prepare(page);
  const rows: Summary[] = [];
  const { info } = await continueFrom(page, save(BIO, [4, 0, 0], [0, 1.4, 0]));
  rows.push(await measure(page, 'bio: room idle (from the door)', 5000));
  await shot(page, 'bio-idle');

  await continueFrom(page, save(BIO, AT_MICROSCOPE, MICROSCOPE, MICROSCOPE_SETUP));
  rows.push(await measure(page, 'bio: at the microscope, idle', 3000));
  const { ws, row } = await openWorkspace(page, 'bio: opening the microscope workspace (E)');
  rows.push(row);
  const observe = await centre(ws.locator('.ws-command.ws-run'));
  // Observe: the fine focus lowers the stage for 5 s; the field (workspace) and the monitor (3D)
  // repaint while it sharpens.
  rows.push(
    await measure(page, 'bio: observing (workspace open)', async () => {
      await page.mouse.click(observe.x, observe.y);
      await page.waitForTimeout(6000); // the 5 s run and its completion
    }),
  );
  await expect(ws.locator('.ws-state')).toHaveText('Completed');
  await shot(page, 'bio-observed');
  // Again with the workspace closed at once: the 3D monitor in view while it repaints.
  await ws.locator('.ws-command.ws-reset').click();
  await expect(ws.locator('.ws-state')).toHaveText('Ready');
  await ws.locator('.ws-command.ws-run').click();
  await expect(ws.locator('.ws-state')).toHaveText('Running');
  await ws.locator('.ws-exit').click();
  await expect(ws).toBeHidden();
  rows.push(await measure(page, 'bio: observing (3D monitor in view)', 3500));
  await shot(page, 'bio-monitor');

  report('biology lab', info, rows);
});

// The city under the hub's glass floor (Phase V): standing on the glass, looking down through it
// (the city's own pass drawn), then turned to the lab doors (the glass out of view).
test('hub: the city under the glass', async ({ page }) => {
  await prepare(page);
  const { info, aim } = await continueFrom(page, save(HUB, [0, 0, 1.5], [0, -2, -4]));
  const rows = [await measure(page, 'hub: city in view (looking down)', 6000)];
  await shot(page, 'hub-city');
  await aim.to(...lookAngles([0, 0, 1.5], [0, 1.4, 12]));
  rows.push(await measure(page, 'hub: city out of view (glass behind)', 4000));
  report('hub city', info, rows);
});

test('hub: idle', async ({ page }) => {
  await prepare(page);
  const { info } = await continueFrom(page, save(HUB, [0, 0, 4.5], [0, 1.4, 0]));
  const rows = [await measure(page, 'hub: idle (from the spawn)', 5000)];
  await shot(page, 'hub-idle');
  report('hub', info, rows);
});
