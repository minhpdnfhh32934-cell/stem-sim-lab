import { expect, type Page, test } from '@playwright/test';
import {
  afterFrame,
  continueFrom,
  expectDebug,
  labSave,
  shot,
  type Vec3,
  menuContinue,
  openSolo,
  closePlay,
  openSettings,
  closeSettings,
} from './support';
import { countWebGL } from './webgl';

// P1 in the real app: Esc pauses play — the simulation really stands still (a Hooke's law run's
// clock does not move) — Settings opens from the pause menu and goes back to it, Esc resumes, and
// Back to the main menu saves, says which runs it ends, and leaves; Continue then restores the
// save. The settings are one element, shown by the pause menu and by the main menu.

const LAB = 'physics-lab';
const RUN: Vec3 = [12.667, 0.875, -5.9]; // the spring desk's RUN button
/** At the spring desk, looking at RUN. */
const SAVE = labSave([12.417, 0, -5.35], RUN);

/** The Hooke's law run's clock (s), from the debug panel's station line. */
async function runTime(page: Page): Promise<number> {
  const text = await page.locator('.debug-text').innerText();
  const t = /Station:\s+physics-lab\/spring \S+ .*?#\d+ t=([\d.]+)/.exec(text);
  if (!t) throw new Error(`no run on the station line:\n${text}`);
  return Number(t[1]);
}

/** Lets `n` frames of the game pass (state, not time: works at any frame rate). */
async function frames(page: Page, n: number) {
  for (let i = 0; i < n; i++) await afterFrame(page);
}

const resumed = (page: Page) => expect(page.locator('.debug-text')).not.toContainText('· paused');

test('pause: Esc stops the simulation, Settings and back, resume, back to the main menu', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = await continueFrom(page, SAVE);
  await expectDebug(page, 'Focus', `${LAB}/spring-run`);
  await page.keyboard.press('e'); // RUN: the mass is let go
  await expect(page.locator('.debug-text')).toContainText(/Station:\s+physics-lab\/spring running/);
  await frames(page, 30);

  // Esc: paused — the pause menu, the focus on Resume, the mouse let go.
  await page.keyboard.press('Escape');
  await expectDebug(page, 'Phase', 'playing · paused');
  const pause = page.locator('.pause-panel');
  await expect(pause).toBeVisible();
  await expect(pause.locator('h2')).toHaveText('Paused');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(1);

  // The run stands still: its clock is the same after many frames (the debug text refreshes on
  // game time, so a frozen clock also means a frozen panel — read it fresh after the frames).
  const frozen = await runTime(page);
  await frames(page, 60);
  expect(await runTime(page)).toBe(frozen);
  await expect(page.locator('.debug-text')).toContainText(/physics-lab\/spring running/);

  // Settings from the pause menu: the shared settings, the focus in them; a change applies now.
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(pause.locator('h2')).toHaveText('Settings');
  await expect(page.getByLabel('English')).toBeFocused();
  await expect(page.getByLabel('English')).toHaveCount(1); // one settings element, not a copy
  await page.getByLabel('Tiếng Việt').check();
  await expect(pause.locator('h2')).toHaveText('Cài đặt');
  // Esc goes back to the pause menu, not to the game; the focus on Settings.
  await page.keyboard.press('Escape');
  await expect(pause.locator('h2')).toHaveText('Tạm dừng');
  await expect(page.getByRole('button', { name: 'Cài đặt' })).toBeFocused();
  await expectDebug(page, 'Phase', 'playing · paused');
  // Back again, by the button: Settings, then Back, to English.
  await page.getByRole('button', { name: 'Cài đặt' }).click();
  await page.getByLabel('English').check();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(pause.locator('h2')).toHaveText('Paused');
  expect(await runTime(page)).toBe(frozen); // still paused all along

  // Esc on the pause menu resumes: the run goes on from where it stood, not from later.
  await page.keyboard.press('Escape');
  await resumed(page);
  await expect(page.locator('.pause')).toBeHidden();
  await expect.poll(() => runTime(page)).toBeGreaterThan(frozen);
  expect(await runTime(page)).toBeLessThan(frozen + 5); // no catching up on the pause

  // Back to the main menu: a run would be lost, so it asks; Cancel goes back to the pause menu.
  await page.keyboard.press('Escape');
  await expectDebug(page, 'Phase', 'playing · paused');
  await page.getByRole('button', { name: 'Back to the main menu' }).click();
  await expect(pause.locator('h2')).toHaveText('Back to the main menu?');
  await expect(pause).toContainText('The 1 run(s) still running are not');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Back to the main menu' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to the main menu' }).click();
  await page.getByRole('button', { name: 'Save and go to the main menu' }).click();

  // The main menu, with the settings back in it and the saved game ready to continue.
  await expect(page.getByRole('heading', { name: 'SIMLAB', exact: true })).toBeVisible();
  await expectDebug(page, 'Phase', 'menu');
  await expect(page.locator('.pause')).toBeHidden();
  await openSolo(page);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  await closePlay(page);
  await openSettings(page);
  await expect(page.locator('.menu-settings').getByLabel('English')).toBeChecked();
  await closeSettings(page);
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(page.locator('.menu-catalog')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the main menu' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);

  // Continue restores the save: the same place, the station configured, no run left.
  await menuContinue(page);
  await expectDebug(page, 'Scene', LAB);
  await expectDebug(page, 'Position', '12\\.42, -?0\\.00, -5\\.35 m');
  await expectDebug(page, 'Station', `${LAB}/spring configured `);
  await resumed(page);
  expect(errors).toEqual([]);
});

/** The dialog's box, the window and the page's widest content, for the layout checks. */
const layout = (page: Page) =>
  page.locator('.pause-panel').evaluate((panel) => {
    const r = panel.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: window.innerWidth,
      height: window.innerHeight,
      pageWidth: document.documentElement.scrollWidth,
      panelOverflowX: panel.scrollWidth - panel.clientWidth,
    };
  });

/** The dialog sits in the middle of the window, inside it, and nothing scrolls sideways. */
async function expectCentred(page: Page) {
  const b = await layout(page);
  expect(Math.abs((b.left + b.right) / 2 - b.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs((b.top + b.bottom) / 2 - b.height / 2)).toBeLessThanOrEqual(1);
  expect(b.left).toBeGreaterThanOrEqual(16);
  expect(b.right).toBeLessThanOrEqual(b.width - 16);
  expect(b.top).toBeGreaterThanOrEqual(16);
  expect(b.bottom).toBeLessThanOrEqual(b.height - 16);
  expect(b.pageWidth).toBeLessThanOrEqual(b.width);
  expect(b.panelOverflowX).toBe(0);
}

test('pause dialog: centred at 1280, 430 and 360 px, keyboard focus shown, leave confirmation', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors = await continueFrom(page, SAVE);
  await expectDebug(page, 'Focus', `${LAB}/spring-run`);
  await page.keyboard.press('e'); // a run, so leaving asks first
  await expect(page.locator('.debug-text')).toContainText(/Station:\s+physics-lab\/spring running/);
  await page.keyboard.press('Escape');
  await expectDebug(page, 'Phase', 'playing · paused');
  const pause = page.locator('.pause-panel');
  await expect(pause).toHaveAttribute('data-view', 'menu');

  // Resume first and loudest, Settings, then Back to the main menu set apart (caution).
  await expect(pause.locator('.pause-view:not(.hidden) button')).toHaveText([
    'Resume',
    'Settings',
    'Back to the main menu',
  ]);
  await expect(pause.getByRole('button', { name: 'Resume' })).toHaveClass(/primary/);
  await expect(pause.getByRole('button', { name: 'Back to the main menu' })).toHaveClass(/caution/);

  // The keyboard focus is drawn: an outline on Resume, then on Settings after Tab.
  const outline = (name: string) =>
    pause
      .getByRole('button', { name })
      .evaluate((b) => [b.matches(':focus-visible'), getComputedStyle(b).outlineStyle]);
  await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused();
  expect(await outline('Resume')).toEqual([true, 'solid']);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
  expect(await outline('Settings')).toEqual([true, 'solid']);

  // Settings in the same dialog, still centred; Back returns to the menu.
  await page.keyboard.press('Enter');
  await expect(pause).toHaveAttribute('data-view', 'settings');
  await expectCentred(page);
  await page.screenshot({ path: 'test-results/pause-settings-1280.png' }); // F3 is the field's here
  await pause.getByRole('button', { name: 'Back' }).click();
  await expect(pause).toHaveAttribute('data-view', 'menu');
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();

  for (const [width, height] of [
    [1280, 720],
    [430, 932],
    [360, 640],
  ] as const) {
    await page.setViewportSize({ width, height });
    await afterFrame(page);
    await expectCentred(page);
    await shot(page, `pause-menu-${width}`);
  }

  // A short window: the dialog keeps inside it and scrolls, its last button reachable.
  await page.setViewportSize({ width: 360, height: 300 });
  await afterFrame(page);
  const short = await layout(page);
  expect(short.top).toBeGreaterThanOrEqual(16);
  expect(short.bottom).toBeLessThanOrEqual(short.height - 16);
  await pause.getByRole('button', { name: 'Back to the main menu' }).scrollIntoViewIfNeeded();
  await expect(pause.getByRole('button', { name: 'Back to the main menu' })).toBeInViewport();

  // The leave confirmation, in the same dialog, centred: leaving in the caution style, Cancel back.
  await page.setViewportSize({ width: 430, height: 932 });
  await pause.getByRole('button', { name: 'Back to the main menu' }).click();
  await expect(pause).toHaveAttribute('data-view', 'confirm');
  await expect(pause.locator('h2')).toHaveText('Back to the main menu?');
  await expect(pause.getByRole('button', { name: 'Save and go to the main menu' })).toHaveClass(
    /caution/,
  );
  await expectCentred(page);
  await shot(page, 'pause-confirm-430');
  await pause.getByRole('button', { name: 'Cancel' }).click();
  await expect(pause).toHaveAttribute('data-view', 'menu');

  // Reduced motion: the buttons change at once, no transition.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() =>
      pause
        .getByRole('button', { name: 'Resume' })
        .evaluate((b) => getComputedStyle(b).transitionDuration),
    )
    .toBe('0s');

  // Resume still resumes.
  await pause.getByRole('button', { name: 'Resume' }).click();
  await resumed(page);
  await expect(page.locator('.pause')).toBeHidden();
  expect(errors).toEqual([]);
});

test('paused, the picture stands still: drawn 20 times a second, not every display frame', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(countWebGL);
  const errors = await continueFrom(page, SAVE);
  await expectDebug(page, 'Focus', `${LAB}/spring-run`);
  await page.keyboard.press('Escape');
  await expectDebug(page, 'Phase', 'playing · paused');
  // Over 2 s: the display frames the page is given, and those the game drew in (draw calls made).
  const { offered, drawn } = await page.evaluate(async () => {
    const contexts = (
      window as unknown as { webglProbe: Map<WebGL2RenderingContext, { draws: number }> }
    ).webglProbe;
    const canvas = document.querySelector('.viewport > canvas');
    const counted = [...contexts].find(([gl]) => gl.canvas === canvas)?.[1];
    if (!counted) throw new Error('no counted context on the page canvas');
    let offered = 0;
    let drawn = 0;
    let last = counted.draws;
    const end = performance.now() + 2000;
    await new Promise<void>((done) => {
      const tick = (now: number) => {
        offered++;
        if (counted.draws !== last) drawn++;
        last = counted.draws;
        if (now < end) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    return { offered, drawn };
  });
  test.info().annotations.push({
    type: 'paused',
    description: `${drawn} of ${offered} frames drawn in 2 s`,
  });
  expect(drawn).toBeGreaterThan(10); // still drawn (a settings change shows)
  expect(drawn).toBeLessThanOrEqual(2 * 20 + 2);
  expect(offered).toBeGreaterThan(drawn);
  await page.keyboard.press('Escape');
  await resumed(page);
  expect(errors).toEqual([]);
});
