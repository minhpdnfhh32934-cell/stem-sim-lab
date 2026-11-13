import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';

// Shared helpers for walking and aiming in the real app. State is read from the dev debug panel;
// aiming uses the exact mouse deltas sent (0.0025 rad per pixel, config default) from the actual
// position. Not a spec file: Playwright only collects *.spec.ts.

export const SENSITIVITY = 0.0025;
export const EYE_HEIGHT = 1.75 * 0.93; // default character (male researcher)
export type Vec3 = [number, number, number];

/** RGB of one screen pixel: a 1×1 screenshot, decoded by the browser. */
export async function pixel(page: Page, x: number, y: number): Promise<number[]> {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  return page.evaluate(
    async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2D canvas');
      context.drawImage(image, 0, 0);
      return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    },
    `data:image/png;base64,${png.toString('base64')}`,
  );
}

export async function expectDebug(page: Page, label: string, value: string) {
  await expect(page.locator('.debug-text')).toContainText(new RegExp(`${label}:\\s+${value}`), {
    timeout: 15_000,
  });
}

/**
 * Waits until the game has run a frame since the last input. It reads at most one press of a key
 * per frame (`InputState`), so a second click of the same key must come after the frame that read
 * the first. A fixed pause is not enough: under the software renderer, with the page idle and the
 * GPU process busy, a frame can take longer than 80 ms, and two clicks then counted as one.
 */
/**
 * Captures the mouse at `at` (inside the viewport) as a click on the scene there does. Freeing
 * the mouse pauses the game (P1), and the pause dialog covers the middle (P3.1): then Resume —
 * which has the focus — is pressed with Enter (a key press is the gesture pointer lock needs), the
 * mouse left at `at`, and Tab starts from the scene again, as it does after a click on it.
 */
export async function captureAt(page: Page, at: { x: number; y: number }) {
  await afterFrame(page); // a freed mouse pauses the game in this frame
  if (await page.locator('.pause').isVisible()) {
    await page.mouse.move(at.x, at.y);
    const resume = page.locator('.pause-panel .menu-button.primary');
    await expect(resume).toBeFocused();
    await page.keyboard.press('Enter');
    await page.locator('.viewport').evaluate((view: HTMLElement) => {
      view.tabIndex = -1; // Tab's starting point where a click on the scene puts it
      view.focus({ preventScroll: true });
      view.blur();
      view.removeAttribute('tabindex');
    });
  } else {
    await page.locator('.viewport').click({ position: at });
  }
  await expect.poll(() => page.evaluate(() => document.pointerLockElement !== null)).toBe(true);
}

/**
 * Waits until the game has run a frame. Every display frame is one unless a frame-rate cap
 * (Settings, P3.3) is set: then frames come every 1000/cap ms, so two of those intervals pass.
 */
export async function gameFrame(page: Page) {
  await afterFrame(page);
  const cap = Number(await page.evaluate(() => localStorage.getItem('simlab.settings.frameCap')));
  if (cap > 0) await page.waitForTimeout((2 * 1000) / cap);
}

export async function afterFrame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
}

// The projectile station in the Physics Lab's projectile range (rooms.json / items.json):
// interaction targets (centres) and where the player stands to use them.
export const RANGE = 'projectile-range';
export const PROJECTILE_TARGETS = {
  instructions: [0.3, 2.425, 8.24], // overhead since Phase T-1a
  ball: [-3.6, 0.83, 9.5], // ball-2, the middle one on the cart
  launcher: [-1, 0.2, 11.75],
  muzzle: [-0.9, 0.62, 11.75],
  dialVelocity: [-1.85, 0.875, 14],
  dialAngle: [-1.6, 0.875, 14],
  dialGravity: [-1.35, 0.875, 14],
  dialResolution: [-1.15, 0.875, 14],
  run: [-0.95, 0.875, 14],
  stop: [-0.75, 0.875, 14],
  reset: [-0.55, 0.875, 14],
  monitor: [2.2, 1.475, 15.7],
  labDoor: [-4.95, 1.05, 0],
  hubDoorPhysics: [12.95, 1.05, -3],
} satisfies Record<string, Vec3>;
export const AT_DESK = { x: -1.2, z: 13.1 };
export const AT_MONITOR = { x: 2.2, z: 14.1 };
const LAUNCH_HEIGHT = 0.59; // ball's lowest point above the floor at launch (0.62 − 0.03)

/** Closed-form flight from the launch height (what the results panel calls theory). */
export function projectileTheory(v: number, angleDeg: number, g: number) {
  const a = (angleDeg * Math.PI) / 180;
  const vy = v * Math.sin(a);
  const time = (vy + Math.sqrt(vy * vy + 2 * g * LAUNCH_HEIGHT)) / g;
  return { time, range: v * Math.cos(a) * time };
}

// The pendulum station in the Physics Lab's pendulum bay: targets (centres of the faces the
// player looks at) and where the player stands at the desk.
export const BAY = 'pendulum-bay';
export const PENDULUM_TARGETS = {
  instructions: [-4.52, 2.425, -9.5], // overhead since Phase T-1a
  rig: [0, 2.4, -12.1],
  dialLength: [1.75, 0.875, -9.2],
  dialAngle: [2, 0.875, -9.2],
  dialGravity: [2.25, 0.875, -9.2],
  dialResolution: [2.45, 0.875, -9.2],
  run: [2.65, 0.875, -9.2],
  stop: [2.85, 0.875, -9.2],
  reset: [3.05, 0.875, -9.2],
  monitor: [4.97, 1.475, -10],
} satisfies Record<string, Vec3>;
export const AT_PENDULUM_DESK = { x: 2.4, z: -8.4 };
/** T/T₀ for a release from rest at 30°: 2K(sin 15°)/π, from tables of K. */
export const PERIOD_RATIO_30 = 1.0174087976;

/** Period (s) of the ideal pendulum released from rest at 30° (written out independently). */
export const pendulumPeriod30 = (length: number, g: number) =>
  2 * Math.PI * Math.sqrt(length / g) * PERIOD_RATIO_30;

/** Yaw and pitch (radians, the game's convention: yaw 0 faces −Z) from a standing point. */
export function lookAngles(from: Vec3, point: Vec3): [number, number] {
  const dx = point[0] - from[0];
  const dy = point[1] - (from[1] + EYE_HEIGHT);
  const dz = point[2] - from[2];
  return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))];
}

/**
 * A save (version 8, the current one: no migration moves it) of a player in the Physics Lab at
 * `stand` looking at `look`. (The v6 and v7 migrations put a player of an older save inside a lab at
 * its door.)
 */
export function labSave(stand: Vec3, look: Vec3, entityStates: object = {}) {
  const [yaw, pitch] = lookAngles(stand, look);
  return {
    version: 8,
    savedAt: '2026-11-03T00:00:00.000Z',
    player: {
      characterId: 'researcher-male',
      sceneId: 'physics-lab',
      position: stand,
      yaw,
      pitch,
      equipment: [] as string[],
      inventory: { stacks: [] as unknown[], selected: 0 },
    },
    world: { entityStates, containers: {}, objects: {} },
    progression: {
      completedExperiments: [] as string[],
      procedures: {},
      tasks: { active: null, done: [] as string[] },
    },
  };
}

/**
 * Continue from the main menu into `save` — the game's own load path, no developer jump. The
 * first page load finds the save; later loads keep what the game itself saved since. Returns
 * the list console errors land in.
 */
export async function continueFrom(page: Page, save: object): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: 'simlab.save.slot-1', value: JSON.stringify(save) },
  );
  await page.goto('/');
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'physics-lab');
  await expectDebug(page, 'Phase', 'playing');
  return errors;
}

export async function position(page: Page): Promise<Vec3> {
  const text = await page.locator('.debug-text').innerText();
  const p = /Position:\s+(-?[\d.]+), (-?[\d.]+), (-?[\d.]+) m/.exec(text);
  if (!p) throw new Error(`debug panel not readable:\n${text}`);
  return [Number(p[1]), Number(p[2]), Number(p[3])];
}

/** Tracks the view direction: known after spawn or `sync()`, then plus the mouse deltas sent. */
export class Aim {
  yaw = 0; // a new game's spawn faces north (−Z)
  pitch = 0;
  constructor(private readonly page: Page) {}

  /** Takes the direction from the debug panel (whole degrees), e.g. after a door set it. */
  async sync(): Promise<void> {
    await this.page.waitForTimeout(300); // 4 Hz debug text
    const text = await this.page.locator('.debug-text').innerText();
    const look = /Look:\s+yaw (-?\d+)°\s+pitch (-?\d+)°/.exec(text);
    if (!look) throw new Error(`debug panel not readable:\n${text}`);
    this.yaw = (Number(look[1]) * Math.PI) / 180;
    this.pitch = (Number(look[2]) * Math.PI) / 180;
  }

  async to(yaw: number, pitch: number): Promise<void> {
    // The short way round: yaw ± 2π is the same view, and a long turn swings a held object round.
    yaw = this.yaw + Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    // Pointer-lock deltas come from mouse moves inside the viewport, so a big turn (e.g. 180°,
    // 1257 px) goes in steps, re-capturing the mouse at the centre before each. In a visible
    // window the first delta is measured from the window's centre, so that is where moves start.
    // The deltas the page is handed are counted, not assumed: the first after a re-capture can
    // carry more than was sent (−853 px for −759, the GPU bench at Ultra, G-2), so the turn
    // goes on until what arrived adds up to it.
    const center = await this.page.evaluate(() => {
      const w = window as unknown as { aimMoved?: [number, number] };
      if (!w.aimMoved) {
        const moved: [number, number] = [0, 0];
        w.aimMoved = moved;
        document.addEventListener('mousemove', (event) => {
          if (!document.pointerLockElement) return;
          moved[0] += event.movementX;
          moved[1] += event.movementY;
        });
      }
      return { x: Math.floor(window.innerWidth / 2), y: Math.floor(window.innerHeight / 2) };
    });
    // Where the mouse is from the centre since this turn captured it; a correction moves on from
    // there (capturing again so soon after would be refused by the browser).
    let at: { x: number; y: number } | null = null;
    for (let step = 0; step < 8; step++) {
      const dx = Math.round((this.yaw - yaw) / SENSITIVITY);
      const dy = Math.round((this.pitch - pitch) / SENSITIVITY);
      // A turn of nothing still takes its step (a capture, a game frame): two presses aimed at the
      // same control must not land in one frame.
      if (step > 0 && dx === 0 && dy === 0) return;
      const sx = Math.max(-600, Math.min(600, dx));
      const sy = Math.max(-300, Math.min(300, dy));
      if (!at || Math.abs(at.x + sx) > 600 || Math.abs(at.y + sy) > 300) {
        await this.page.evaluate(() => document.exitPointerLock());
        await expect.poll(() => this.page.evaluate(() => document.pointerLockElement)).toBeNull();
        await captureAt(this.page, center);
        at = { x: 0, y: 0 };
      }
      await this.page.evaluate(() => {
        const moved = (window as unknown as { aimMoved: [number, number] }).aimMoved;
        moved[0] = 0;
        moved[1] = 0;
      });
      at = { x: at.x + sx, y: at.y + sy };
      await this.page.mouse.move(center.x + at.x, center.y + at.y, { steps: 12 });
      // Freeing the mouse (the next step, or the next turn) pauses the game, and a pause drops look
      // movement no game frame has read yet: let one read it first.
      await gameFrame(this.page);
      const [mx, my] = await this.page.evaluate(
        () => (window as unknown as { aimMoved: [number, number] }).aimMoved,
      );
      this.yaw -= mx * SENSITIVITY;
      this.pitch -= my * SENSITIVITY;
    }
  }

  /** Looks at a world point from where the player stands: `from`, or read from the panel. */
  async at(point: Vec3, from?: Vec3): Promise<void> {
    if (!from) await this.page.waitForTimeout(300); // let the 4 Hz debug text catch up
    await this.to(...lookAngles(from ?? (await position(this.page)), point));
  }
}

/** Holds `key` until the position satisfies `done` (closed loop: works at any frame rate). */
export async function walkUntil(page: Page, key: string, done: (p: Vec3) => boolean) {
  await page.keyboard.down(key);
  await expect
    .poll(async () => done(await position(page)), { timeout: 30_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up(key);
}

/**
 * Walks towards a floor point (x, z) in short taps of W until within `within` metres: holding the
 * key can overshoot by ~0.6 m (4 Hz debug text), a 120 ms tap by ~0.25 m at most.
 */
export async function approach(page: Page, aim: Aim, x: number, z: number, within = 0.3) {
  for (let i = 0; i < 80; i++) {
    const p = await position(page);
    if (Math.hypot(p[0] - x, p[2] - z) < within) return;
    // Aimed again each tap: one aim at the start missed the point when a collider pushed the
    // player aside, and walked on past it (preparation.spec, the glove dispenser to the door).
    await aim.at([x, EYE_HEIGHT, z], p);
    await page.keyboard.down('w');
    await page.waitForTimeout(120);
    await page.keyboard.up('w');
    await page.waitForTimeout(300); // debug text refresh
  }
  throw new Error(`did not reach (${x}, ${z})`);
}

/**
 * Waits until no action acted out is playing (Phase H-3: the player's presses wait for one). The
 * debug panel refreshes at 4 Hz: a press just made shows its action only after a refresh.
 */
export async function handsFree(page: Page) {
  await page.waitForTimeout(300);
  await expectDebug(page, 'Action', '—');
}

/**
 * Aims at a target, checks it is the one in focus and what the prompt offers, presses E — and
 * waits for the game to read it: the next aim frees the mouse, which pauses the game, and a pause
 * drops a press no frame has read yet (at a few frames per second, RUN was lost that way).
 */
export async function use(page: Page, aim: Aim, target: Vec3, entityId: string, label: string) {
  await handsFree(page);
  await aim.at(target);
  await expectDebug(page, 'Focus', entityId);
  await expect(page.locator('.hud-prompt')).toContainText(label);
  await page.keyboard.press('e');
  await afterFrame(page);
}

/** Starts a new game with the default character; returns the list console errors land in. */
export async function newGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await menuNewGame(page);
  await expectDebug(page, 'Scene', 'preparation-room');
  await expectDebug(page, 'Phase', 'playing');
  return errors;
}

// ---- results panel (run history, comparison, CSV) ---------------------------------------------

export async function expectStation(page: Page, station: string, pattern: string) {
  await expectDebug(page, 'Station', `${station} ${pattern}`);
}

/** A screenshot without the developer overlay (its own F3 toggle hides and shows it). */
export async function shot(page: Page, name: string) {
  await page.keyboard.press('F3');
  await expect(page.locator('.debug')).toBeHidden();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `test-results/${name}.png` });
  await page.keyboard.press('F3');
  await expect(page.locator('.debug')).toBeVisible();
}

/** Turns a dial `times` clicks: E raises, F lowers; each click read in its own frame. */
export async function dial(
  page: Page,
  aim: Aim,
  target: Vec3,
  id: string,
  key: 'e' | 'f',
  times: number,
) {
  await aim.at(target);
  await expectDebug(page, 'Focus', id);
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await afterFrame(page);
  }
}

/** Looks at the results monitor and opens the results (E). */
export async function openResults(
  page: Page,
  aim: Aim,
  monitor: Vec3,
  id: string,
): Promise<Locator> {
  await aim.at(monitor);
  await expectDebug(page, 'Focus', id);
  await page.keyboard.press('e');
  const panel = page.locator('.results-panel');
  await expect(panel).toBeVisible();
  return panel;
}

/**
 * Frees the mouse to tick runs and press buttons, as Esc does for a player. Playwright's Escape
 * reaches the page but does not make headless Edge release the pointer (the browser's own Esc
 * handling is not on the automation input path), so tests release it this way.
 */
export async function freeMouse(page: Page) {
  await page.evaluate(() => document.exitPointerLock());
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
}

/** Exports a run with its CSV button; returns the downloaded file's name and content. */
export async function exportRun(page: Page, panel: Locator, run: number) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: `Export run ${run} as CSV` }).click(),
  ]);
  return { name: download.suggestedFilename(), text: readFileSync(await download.path(), 'utf8') };
}

export function readCsv(text: string) {
  expect(text.endsWith('\r\n')).toBe(true);
  const lines = text.slice(0, -2).split('\r\n');
  const meta = lines.filter((l) => l.startsWith('#'));
  const header = (lines[meta.length] ?? '').split(',');
  const rows = lines.slice(meta.length + 1).map((l) => l.split(',').map(Number));
  return { meta, header, rows };
}

// ---- walk-through doors -----------------------------------------------------------------------

/** The player's position in the campus frame (debug `Campus:` line, 2 decimals). */
export async function campus(page: Page): Promise<Vec3> {
  const text = await page.locator('.debug-text').innerText();
  const p = /Campus:\s+(-?[\d.]+), (-?[\d.]+), (-?[\d.]+) m/.exec(text);
  if (!p) throw new Error(`debug panel not readable:\n${text}`);
  return [Number(p[1]), Number(p[2]), Number(p[3])];
}

/**
 * Opens the walk-through door in focus with E (its prompt `label`), waits until it stands open,
 * then holds W until the player is in scene `to` and `done` holds (scene-local position). While
 * walking it samples the campus position each time the panel shows a new one (about 4 Hz): it must
 * go steadily on — never back, and between two samples never farther than walking covers in the
 * real time between them (+ 0.2 s: the panel refreshes on a frame, and the poll sees it late)
 * plus 0.2 m, and never more than 1 m: never a teleport (one moves a door's 2.3 m or more at
 * once) — with the view untouched, and the scene must switch on the way. Returns the samples.
 */
export async function walkThrough(
  page: Page,
  { label, to, done }: { label: string; to: string; done: (p: Vec3) => boolean },
): Promise<Vec3[]> {
  const WALK = 2.2; // m/s, the configured walking speed
  const STEP_CAP = 1; // m
  await expect(page.locator('.hud-prompt')).toContainText(label);
  await handsFree(page);
  const from = /Scene:\s+(\S+)/.exec(await page.locator('.debug-text').innerText())?.[1];
  await page.keyboard.press('e');
  await expectDebug(page, 'Doors', String.raw`\S+ open 1\.00 1\.00`); // both leaves, one by one
  await page.waitForTimeout(300); // the 4 Hz panel shows the view as it is now
  const look = /Look:\s+(.*)/.exec(await page.locator('.debug-text').innerText())?.[1];
  const samples: Vec3[] = [await campus(page)];
  const seen: number[] = [Date.now()];
  const scenes = new Set<string>();
  await page.keyboard.down('w');
  await expect
    .poll(
      async () => {
        const now = await page.locator('.debug-text').innerText();
        const c = await campus(page);
        const last = samples.at(-1)!;
        if (c.some((v, i) => v !== last[i])) {
          samples.push(c);
          seen.push(Date.now());
        }
        scenes.add(/Scene:\s+(\S+)/.exec(now)?.[1] ?? '?');
        expect(/Look:\s+(.*)/.exec(now)?.[1]).toBe(look);
        return /Scene:\s+(\S+)/.exec(now)?.[1] === to && done(await position(page));
      },
      { timeout: 30_000, intervals: [50] },
    )
    .toBe(true);
  await page.keyboard.up('w');
  expect([...scenes]).toEqual([from, to]);
  const first = samples[0]!;
  const along = (p: Vec3) => Math.hypot(p[0] - first[0], p[2] - first[2]);
  for (let i = 1; i < samples.length; i++) {
    const [a, b] = [samples[i - 1]!, samples[i]!];
    // The time between two samples is seen through a 50 ms poll that itself takes time.
    // Capped at 1 m (SwiftShader steps measured up to 0.70 m) so that a long gap between samples
    // never lets a door-sized jump (2.3 m or more) through.
    const limit = Math.min(WALK * ((seen[i]! - seen[i - 1]!) / 1000 + 0.2) + 0.2, STEP_CAP);
    expect(Math.hypot(b[0] - a[0], b[2] - a[2]), `sample ${i}`).toBeLessThanOrEqual(limit);
    expect(along(b), `sample ${i}`).toBeGreaterThanOrEqual(along(a) - 0.02);
  }
  return samples;
}

/** Waits until every door is closed and only the current scene is left resident. */
export async function doorsClosed(page: Page, scene: string) {
  await expectDebug(page, 'Doors', '—');
  await expectDebug(page, 'Resident', `${scene}\n`);
}

/** Turns to a door and walks towards it until it is in focus (it may not be in reach yet). */
export async function walkToDoor(page: Page, aim: Aim, door: Vec3, entityId: string) {
  await aim.sync();
  await aim.at(door);
  await page.keyboard.down('w');
  await expectDebug(page, 'Focus', entityId);
  await page.keyboard.up('w');
}

/**
 * The bench's `gpu-fullscreen` project: the browser window made fullscreen through CDP (Edge ignores
 * --start-fullscreen and --kiosk under Playwright), so the page covers the whole display. Does
 * nothing in other projects.
 */
export async function fullscreenWindow(page: Page, project: string): Promise<void> {
  if (project !== 'gpu-fullscreen') return;
  const cdp = await page.context().newCDPSession(page);
  const { windowId } = (await cdp.send('Browser.getWindowForTarget')) as { windowId: number };
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
  await expect
    .poll(() => page.evaluate(() => innerWidth === screen.width && innerHeight === screen.height))
    .toBe(true);
}

// ---- the menu's Play (Phú 2026-11-12): Play → Single player → New game / Continue -------------

/** Opens the menu's Settings page (Phú 2026-11-12: a page of its own, in place of the panel), on
 * one of its sections (the settings show one at a time, as a game's do). */
export async function openSettings(
  page: Page,
  section: 'general' | 'graphics' | 'controls' | 'sound' = 'general',
): Promise<void> {
  await page.locator('.menu-settings-open').click();
  await expect(page.locator('.settings-page')).toBeVisible();
  await settingsSection(page, section);
}

/** Shows one section of the settings (in the menu's page or the pause menu). */
export async function settingsSection(
  page: Page,
  section: 'general' | 'graphics' | 'controls' | 'sound',
): Promise<void> {
  await page.locator('.settings-tab[data-section="' + section + '"]').click();
}

/** Back from the menu's Settings page to its panel, if it is open. */
export async function closeSettings(page: Page): Promise<void> {
  const open = page.locator('.settings-page:not(.hidden)');
  if ((await open.count()) > 0) await open.locator('.stage-back').click();
}

/** Opens Play's Single player page from the menu's panel (in English or Vietnamese). */
export async function openSolo(page: Page): Promise<void> {
  await closeSettings(page);
  await page.getByRole('button', { name: /^(Play|Chơi)$/ }).click();
  await page.getByRole('button', { name: /^(Single player|Chơi đơn)/ }).click();
}

/** The menu's way into a new single-player game. */
export async function menuNewGame(page: Page): Promise<void> {
  await openSolo(page);
  await page.getByRole('button', { name: /^(New game|Chơi mới)$/ }).click();
}

/** The menu's way into the last single-player game. */
export async function menuContinue(page: Page): Promise<void> {
  await openSolo(page);
  await page.getByRole('button', { name: /^(Continue|Chơi tiếp)$/ }).click();
}

/** Back from Play's pages to the menu's panel. */
export async function closePlay(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
}

/** Opens Play's Multiplayer page from the menu's panel. */
export async function openMultiplayer(page: Page): Promise<void> {
  await closeSettings(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: /^Multiplayer/ }).click();
  await expect(page.locator('.multiplayer')).toBeVisible();
}

/**
 * Keeps `save` as this browser's own game of the room named `room` (its list and its save, set
 * before the page's first load): making or joining a room of that name plays on in it.
 */
export async function seedRoomSave(page: Page, room: string, save: object): Promise<void> {
  await page.addInitScript(
    ({ room, value }) => {
      if (localStorage.getItem('simlab.saves') !== null) return;
      const at = '2026-11-12T08:00:00.000Z';
      const slot = { id: 'room-1', kind: 'room', n: 1, room: { name: room, id: 'OLD234' } };
      localStorage.setItem(
        'simlab.saves',
        JSON.stringify({ version: 1, slots: [{ ...slot, createdAt: at, playedAt: at }] }),
      );
      localStorage.setItem('simlab.save.room-1', value);
    },
    { room, value: JSON.stringify(save) },
  );
}

/** The ID of the LAN room the page is in (from the debug panel's Players line). */
export async function roomIdOf(page: Page): Promise<string> {
  await expectDebug(page, 'Players', '[A-Z0-9]{6} ');
  const text = await page.locator('.debug-text').innerText();
  return /Players:\s+([A-Z0-9]{6}) /.exec(text)?.[1] ?? '';
}
