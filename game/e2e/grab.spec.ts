import { expect, type Page, test } from '@playwright/test';
import { captureAt, walkUntil, menuNewGame } from './support';

// Phase 3 player workflow in the real app: aim with the mouse, grab with E, carry, drop onto the
// bench, grab again, throw at the wall with the left mouse button. State is read from the dev
// debug panel; aiming uses the exact mouse deltas sent (0.0025 rad per pixel, config default).

const SENSITIVITY = 0.0025;
const EYE_HEIGHT = 1.75 * 0.93; // default character (male researcher)
const BENCH_TOP = 0.9;
const R = 0.04;
const WEST_WALL = -5;
const CENTER = { x: 640, y: 360 };

interface Snapshot {
  player: [number, number, number];
  ball: { position: [number, number, number]; speed: number; asleep: boolean };
  holding: string;
}

async function snapshot(page: Page): Promise<Snapshot> {
  const text = await page.locator('.debug-text').innerText();
  const p = /Position:\s+(-?[\d.]+), (-?[\d.]+), (-?[\d.]+) m/.exec(text);
  const b =
    /physics-lab\/steel-ball\s+(-?[\d.]+), (-?[\d.]+), (-?[\d.]+) m\s+([\d.]+) m\/s(\s+asleep)?/.exec(
      text,
    );
  const h = /Holding:\s+(\S+)/.exec(text);
  if (!p || !b || !h) throw new Error(`debug panel not readable:\n${text}`);
  return {
    player: [Number(p[1]), Number(p[2]), Number(p[3])],
    ball: {
      position: [Number(b[1]), Number(b[2]), Number(b[3])],
      speed: Number(b[4]),
      asleep: b[5] !== undefined,
    },
    holding: h[1] ?? '',
  };
}

/** Tracks the view direction from the known spawn orientation plus the mouse deltas sent. */
class Aim {
  constructor(
    private readonly page: Page,
    public yaw: number,
    public pitch: number,
  ) {}

  /** Captures the mouse with the cursor centred (moves while not captured do not look). */
  async capture(): Promise<void> {
    await this.page.evaluate(() => document.exitPointerLock());
    await expect.poll(() => this.page.evaluate(() => document.pointerLockElement)).toBeNull();
    await captureAt(this.page, CENTER);
  }

  async to(yaw: number, pitch: number): Promise<void> {
    await this.capture();
    const dx = Math.round((this.yaw - yaw) / SENSITIVITY);
    const dy = Math.round((this.pitch - pitch) / SENSITIVITY);
    await this.page.mouse.move(CENTER.x + dx, CENTER.y + dy, { steps: 12 });
    this.yaw -= dx * SENSITIVITY;
    this.pitch -= dy * SENSITIVITY;
  }

  /** Looks at a world point from the player's current eye position. */
  async at(player: readonly number[], point: readonly number[]): Promise<void> {
    const dx = (point[0] ?? 0) - (player[0] ?? 0);
    const dy = (point[1] ?? 0) - ((player[1] ?? 0) + EYE_HEIGHT);
    const dz = (point[2] ?? 0) - (player[2] ?? 0);
    await this.to(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
  }

  /** The point `distance` metres along the current aim from the eye. */
  point(player: readonly number[], distance: number): [number, number, number] {
    const cp = Math.cos(this.pitch);
    return [
      (player[0] ?? 0) - Math.sin(this.yaw) * cp * distance,
      (player[1] ?? 0) + EYE_HEIGHT + Math.sin(this.pitch) * distance,
      (player[2] ?? 0) - Math.cos(this.yaw) * cp * distance,
    ];
  }
}

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));

async function expectDebug(page: Page, label: string, value: string) {
  await expect(page.locator('.debug-text')).toContainText(new RegExp(`${label}:\\s+${value}`), {
    timeout: 10_000,
  });
}

test('grab the steel ball, carry it, drop it on the bench, then throw it at the wall', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await menuNewGame(page);
  await expectDebug(page, 'Phase', 'playing');
  await page.evaluate(() => document.exitPointerLock());
  await page.getByLabel('Scene to load').selectOption('physics-lab');
  await page.getByRole('button', { name: 'Load scene' }).click();
  await expectDebug(page, 'Scene', 'physics-lab');
  await expect.poll(async () => (await snapshot(page)).ball.asleep, { timeout: 10_000 }).toBe(true);
  const aim = new Aim(page, -Math.PI / 2, 0); // spawn orientation: facing +X

  // Walk to the teacher's bench (Phase U-2; spawn x = −4, z = 0 facing +X; the bench stands at
  // x −2.667 … −0.667, z −4.874 … −4.074): east past x −2.6 (closed loop: a timed hold fell short
  // of the bench's end at the lab's software frame rate), then strafe left into its front.
  await walkUntil(page, 'w', ([x]) => x >= -2.6);
  await page.keyboard.down('a');
  await page.waitForTimeout(2500);
  await page.keyboard.up('a');
  await expectDebug(page, 'Position', String.raw`-[123]\.\d\d, -?0\.00, -3\.(75|76|77) m`);
  let s = await snapshot(page);
  const spawn = s.ball.position;

  // Look at the ball: the prompt offers E Grab and F Inspect. F inspects it without picking it
  // up; E picks it up.
  await aim.at(s.player, spawn);
  await expectDebug(page, 'Focus', 'physics-lab/steel-ball');
  await expect(page.locator('.hud-prompt')).toContainText(/E\s*Grab\s*F\s*Inspect/);
  await page.keyboard.press('f');
  await expect(page.locator('.hud-toast').last()).toHaveText(
    'Steel ball: A polished steel ball used for kinematics experiments.',
  );
  await expectDebug(page, 'Holding', '—');
  await page.keyboard.press('e');
  await expectDebug(page, 'Holding', 'physics-lab/steel-ball');
  await expect(page.locator('.hud-prompt')).toContainText('Drop');
  await expect(page.locator('.hud-prompt')).toContainText('LMB');
  await expect(page.locator('.hud-prompt')).toContainText('Throw');

  // Turn while holding: the ball follows to the new hold point, 0.45 m along the aim (config
  // player.holdDistance: an arm's reach; the hold reaches no further this little below level).
  await aim.to(-0.1, -0.35);
  const holdPoint = aim.point(s.player, 0.45);
  await expect
    .poll(async () => distance((await snapshot(page)).ball.position, holdPoint), { timeout: 5000 })
    .toBeLessThan(0.03);
  s = await snapshot(page);
  const held = s.ball.position;
  expect(distance(held, spawn)).toBeGreaterThan(0.3);
  expect(held[1]).toBeGreaterThan(BENCH_TOP + R + 0.25);
  await page.screenshot({ path: 'test-results/grab-holding.png' });

  // E drops it: it falls onto the bench below the hold point and stays there.
  await page.keyboard.press('e');
  await expectDebug(page, 'Holding', '—');
  await expect.poll(async () => (await snapshot(page)).ball.asleep, { timeout: 10_000 }).toBe(true);
  s = await snapshot(page);
  const landed = s.ball.position;
  expect(Math.abs(landed[1] - (BENCH_TOP + R))).toBeLessThanOrEqual(0.0025);
  expect(Math.abs(landed[0] - held[0])).toBeLessThan(0.05);
  expect(Math.abs(landed[2] - held[2])).toBeLessThan(0.05);
  // No snapping back to the placement (that would be ~0 m): held at an arm's reach (0.45 m), it
  // lands about 0.3 m from where it lay.
  expect(distance(landed, spawn)).toBeGreaterThan(0.1);
  await page.screenshot({ path: 'test-results/grab-dropped.png' });

  // Grab it again and throw it at the west wall, 2.4 m away (the east is benches since Phase T-1a).
  await aim.at(s.player, landed);
  await expectDebug(page, 'Focus', 'physics-lab/steel-ball');
  await page.keyboard.press('e');
  await expectDebug(page, 'Holding', 'physics-lab/steel-ball');
  await aim.to(Math.PI / 2, 0.1);
  const throwFrom = aim.point(s.player, 0.45); // the hold distance: this little above level, as ahead
  await expect
    .poll(async () => distance((await snapshot(page)).ball.position, throwFrom), { timeout: 5000 })
    .toBeLessThan(0.03);
  // Every refresh of the debug panel (4 Hz) is kept from the throw on, in the page: polling it
  // from here missed the flight's short stay by the wall at the lab's software frame rate.
  await page.evaluate(() => {
    const seen: number[] = [];
    (window as unknown as { ballX: number[] }).ballX = seen;
    const panel = document.querySelector('.debug-text');
    if (!panel) return;
    new MutationObserver(() => {
      const m = /physics-lab\/steel-ball\s+(-?[\d.]+),/.exec(panel.textContent);
      if (m) seen.push(Number(m[1]));
    }).observe(panel, { childList: true, characterData: true, subtree: true });
  });
  await page.mouse.down();
  await page.mouse.up();
  await expectDebug(page, 'Holding', '—');

  // The flight: it heads west, never passes the wall, and comes back (a bounce).
  const flight = () => page.evaluate(() => (window as unknown as { ballX: number[] }).ballX);
  const bounce = (xs: number[]) => {
    const min = Math.min(...xs);
    return min < -4.5 && xs.slice(xs.indexOf(min)).some((x) => x > min + 0.2);
  };
  await expect.poll(async () => bounce(await flight()), { timeout: 10_000 }).toBe(true);
  const xs = await flight();
  const minX = Math.min(...xs);
  const bounced = bounce(xs);
  expect(minX).toBeLessThan(-4.5);
  expect(minX).toBeGreaterThan(WEST_WALL + R - 0.01);
  expect(bounced).toBe(true);
  await page.screenshot({ path: 'test-results/grab-thrown.png' });

  await expectDebug(page, 'Physics', 'ready · bodies 126 · colliders 160'); // the wing of Phase T-1a
  await expect(page.locator('.debug-text')).not.toContainText('[failed]');
  expect(errors).toEqual([]);
});
