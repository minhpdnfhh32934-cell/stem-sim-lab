import { expect, type Page, test } from '@playwright/test';
import {
  continueFrom,
  expectDebug,
  labSave,
  pixel,
  menuContinue,
  openSettings,
  settingsSection,
} from './support';

// Settings in the main menu: the interface language is a preference of the browser (its own
// localStorage key, outside the save), English by default and restored on the next visit.

const KEY = 'simlab.settings.language';

test('menu language: English by default, Vietnamese from Settings, restored on reload; an unknown stored value gives English', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  const settings = page.locator('.menu-settings-open');

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByText('Scientific laboratory simulation')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByLabel('English')).toBeHidden(); // Settings starts closed
  await settings.click();
  await expect(page.getByLabel('English')).toBeChecked();

  await page.getByLabel('Tiếng Việt').check();
  await expect(page.locator('.settings-page .stage-title')).toHaveText('Cài đặt');
  await expect(page.getByRole('group', { name: 'Ngôn ngữ' })).toBeVisible();
  await page.screenshot({ path: 'test-results/settings-page-vi.png' });
  // Back to the menu's panel (the Settings page is in its place), in Vietnamese.
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await expect(page.getByText('Mô phỏng phòng thí nghiệm khoa học')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chơi', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Chọn nhân vật/ })).toContainText('Khoa');
  await expect(settings).toHaveText('Cài đặt');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('vi');
  await page.screenshot({ path: 'test-results/settings-menu-vi.png' });

  // The longer Vietnamese texts still fit a narrow window.
  await page.setViewportSize({ width: 430, height: 860 });
  const box = await page.locator('.menu-panel').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(430);
  await page.screenshot({ path: 'test-results/settings-menu-vi-430x860.png' });
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Chơi', exact: true })).toBeVisible();
  await settings.click();
  await expect(page.getByLabel('Tiếng Việt')).toBeChecked();

  // A value this version does not know (edited, or from a later version) falls back to English.
  await page.evaluate((key) => localStorage.setItem(key, 'fr'), KEY);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await settings.click();
  await expect(page.getByLabel('English')).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(errors).toEqual([]);
});

const CAP_KEY = 'simlab.settings.frameCap';

/** The developer panel's FPS line: the measured rate and the cap it names. */
async function fpsLine(page: Page) {
  const text = await page.locator('.debug-text').innerText();
  const m = /FPS:\s+(\d+) \(cap (\w+), graphics (\w+)\)/.exec(text);
  if (!m) throw new Error(`no FPS line:\n${text}`);
  return { fps: Number(m[1]), cap: m[2], graphics: m[3] };
}

test('FPS limit: no limit by default, kept on reload apart from the language, the same field in the pause menu', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = await continueFrom(page, labSave([12.417, 0, -5.35], [12.667, 0.875, -5.9]));
  // Back to the Home to start there (the save is in place for Continue).
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Back to the main menu' }).click();
  await expectDebug(page, 'Phase', 'menu');

  // The limit is a row of choices (2026-11-12), one per step, the current one chosen.
  const limit = page.getByRole('group', { name: 'FPS limit' });
  const cap = (name: string) => limit.getByRole('radio', { name });
  await openSettings(page, 'graphics');
  await expect(cap('No limit')).toBeChecked(); // no limit at first
  await expect(limit.locator('label')).toHaveText([
    '30 FPS',
    '60 FPS',
    '90 FPS',
    '120 FPS',
    'No limit',
  ]);
  await expect(limit).toHaveAccessibleDescription(
    'Limits the frame rate to balance smoothness, power use and system load.',
  );
  const free = await fpsLine(page);
  expect(free.cap).toBe('none');

  // 30 FPS: applies at once, measured on the frames that run (the panel counts them).
  await cap('30 FPS').check();
  expect(await page.evaluate((key) => localStorage.getItem(key), CAP_KEY)).toBe('30');
  await expect.poll(async () => (await fpsLine(page)).cap).toBe('30');
  await expect
    .poll(async () => (await fpsLine(page)).fps, { timeout: 10_000 })
    .toBeLessThanOrEqual(31);
  test.info().annotations.push({
    type: 'measured',
    description: `menu FPS with no limit ${free.fps}, at 30 FPS ${(await fpsLine(page)).fps}`,
  });

  // Kept on reload; the language is its own setting, untouched.
  await page.reload();
  await openSettings(page, 'graphics');
  await expect(cap('30 FPS')).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('simlab.settings.language'))).toBeNull();
  await settingsSection(page, 'general');
  await page.getByLabel('Tiếng Việt').check();
  await settingsSection(page, 'graphics');
  const vi = page.getByRole('group', { name: 'Giới hạn FPS' });
  await expect(vi.getByRole('radio', { name: '30 FPS' })).toBeChecked();
  await expect(vi.locator('label').last()).toHaveText('Không giới hạn');
  await settingsSection(page, 'general');
  await page.getByLabel('English').check();
  expect(await page.evaluate((key) => localStorage.getItem(key), CAP_KEY)).toBe('30');

  // In the pause menu: the same field (one element), still paused while it changes.
  await menuContinue(page);
  await expectDebug(page, 'Phase', 'playing');
  await page.keyboard.press('Escape');
  await expectDebug(page, 'Phase', 'playing · paused');
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingsSection(page, 'graphics');
  await expect(limit).toHaveCount(1);
  await expect(cap('30 FPS')).toBeChecked();
  await cap('No limit').check();
  await expect.poll(async () => (await fpsLine(page)).cap).toBe('none');
  await expectDebug(page, 'Phase', 'playing · paused');
  await page.setViewportSize({ width: 360, height: 640 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(360);
  await expect(limit).toBeInViewport();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Back' }).click();
  await expectDebug(page, 'Phase', 'playing · paused');

  // A value this version does not offer falls back to no limit.
  await page.evaluate((key) => localStorage.setItem(key, '45'), CAP_KEY);
  await page.reload();
  await openSettings(page, 'graphics');
  await expect(cap('No limit')).toBeChecked();
  expect(errors).toEqual([]);
});

/** Luminance (0–255) of a screen pixel: its sRGB channels weighted as the eye weighs them. */
async function luminance(page: Page, x: number, y: number) {
  const [r = 0, g = 0, b = 0] = await pixel(page, x, y);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('Physics Lab ceiling: lit level with its walls and darker than its lamps, under Low, Medium and High', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // From the lab's west half, looking up at its south wall: a fill light's panel at the top right
  // (2.5 m right, 3 m ahead), the ceiling under it, the wall in the middle (clear of the HUD and the
  // debug panel). Phase T-1a: the lab 4 m high, its lights at x −1, 4 and 9 — the stand and the
  // pixels chosen anew from a screenshot. Unlit, the ceiling read 113 against the wall's 167 (P3.11).
  // Medium chosen on an earlier visit: on this software renderer the game would start at Low.
  await page.addInitScript(() => localStorage.setItem('simlab.settings.graphicsQuality', 'medium'));
  const errors = await continueFrom(page, labSave([3.967, 0, -3.632], [3.667, 4.2, 7.5]));
  for (const quality of ['Medium', 'Low', 'High']) {
    if (quality !== 'Medium') {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Settings' }).click();
      await settingsSection(page, 'graphics');
      await page.getByRole('group', { name: 'Graphics quality' }).getByLabel(quality).check();
      await page.getByRole('button', { name: 'Back' }).click();
      await page.getByRole('button', { name: 'Resume' }).click();
      await expect(page.locator('.pause')).toBeHidden();
    }
    await expect.poll(async () => (await fpsLine(page)).graphics).toBe(quality.toLowerCase());
    await page.waitForTimeout(500); // drawn with the new lights
    const ceiling = [await luminance(page, 640, 230), await luminance(page, 900, 230)];
    const wall = await luminance(page, 580, 345);
    const lamp = await luminance(page, 1010, 95);
    for (const value of ceiling) {
      expect(value, `${quality}: ceiling against wall ${wall}`).toBeGreaterThanOrEqual(wall - 10);
      expect(value, `${quality}: ceiling against lamp ${lamp}`).toBeLessThanOrEqual(lamp - 20);
    }
  }
  expect(errors).toEqual([]);
});

test('Physics Lab pendulum bay: as bright under High as under Medium, no veil from the room light', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Looking −z across the pendulum bay: its back wall and navy sign face +z, where the room
  // light's brightest panel lit them from the front until it was turned overhead
  // (ROOM_LIGHT_TILT in WorldRenderer). Under High they read 13 above Medium on the GPU then, 0
  // and 2 now. The points are clear of the HUD, the debug panel and the rig.
  // Medium chosen on an earlier visit: on this software renderer the game would start at Low.
  await page.addInitScript(() => localStorage.setItem('simlab.settings.graphicsQuality', 'medium'));
  const errors = await continueFrom(page, labSave([0, 0, -8.7], [0, 2.2, -13.5]));
  const points = [
    ['wall above the sign', 440, 250],
    ['wall beside the rig', 900, 420],
    ['sign', 760, 335],
  ] as const;
  const read = async () => {
    await page.waitForTimeout(500); // drawn with the current lights
    const levels: number[] = [];
    for (const [, x, y] of points) levels.push(await luminance(page, x, y));
    return levels;
  };
  await expect.poll(async () => (await fpsLine(page)).graphics).toBe('medium');
  const medium = await read();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingsSection(page, 'graphics');
  await page.getByRole('group', { name: 'Graphics quality' }).getByLabel('High').check();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('.pause')).toBeHidden();
  await expect.poll(async () => (await fpsLine(page)).graphics).toBe('high');
  const high = await read();
  points.forEach(([name], i) =>
    expect(
      Math.abs(high[i]! - medium[i]!),
      `${name}: High ${high[i]} against Medium ${medium[i]}`,
    ).toBeLessThanOrEqual(6),
  );
  expect(errors).toEqual([]);
});

test('graphics quality: Low by default on a software renderer (Medium on a GPU), switched from the pause menu at once, a free-fall run under High at 30 FPS gives the theory', async ({
  page,
}) => {
  test.setTimeout(180_000);
  // At the free-fall desk, looking at RUN (h 1.5 m, Earth); 30 FPS chosen on an earlier visit.
  await page.addInitScript(() => localStorage.setItem('simlab.settings.frameCap', '30'));
  const errors = await continueFrom(page, labSave([2.017, 0, -5.35], [1.867, 0.875, -5.9]));
  // SwiftShader here: the renderer suggests Low, and nothing is stored until the player picks.
  await expect.poll(async () => (await fpsLine(page)).graphics).toBe('low');
  expect(await page.evaluate(() => localStorage.getItem('simlab.settings.graphicsQuality'))).toBe(
    null,
  );

  // The pause menu's settings: four presets (Ultra asks first: its own test), keyboard reachable,
  // Vietnamese; High applies at once.
  await page.keyboard.press('Escape');
  await expectDebug(page, 'Phase', 'playing · paused');
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingsSection(page, 'graphics');
  const group = page.getByRole('group', { name: 'Graphics quality' });
  await expect(group.getByRole('radio')).toHaveCount(4);
  await expect(group.getByLabel('Low')).toBeChecked();
  await group.getByLabel('High').focus();
  await page.keyboard.press('Space');
  await expect(group.getByLabel('High')).toBeChecked();
  await expect.poll(async () => (await fpsLine(page)).graphics).toBe('high');
  expect(await page.evaluate(() => localStorage.getItem('simlab.settings.graphicsQuality'))).toBe(
    'high',
  );
  await expectDebug(page, 'Phase', 'playing · paused'); // still paused
  await page.setViewportSize({ width: 360, height: 640 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(360);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('.pause')).toBeHidden();
  await expect(page.locator('canvas')).toHaveCount(1);

  // RUN under High and a 30 FPS cap: the deterministic model's own values, as with no cap.
  await expectDebug(page, 'Focus', 'physics-lab/button-run');
  await page.keyboard.press('e');
  const t = Math.sqrt((2 * 1.5) / 9.81).toFixed(3);
  const v = (-Math.sqrt(2 * 9.81 * 1.5)).toFixed(3);
  await expectDebug(
    page,
    'Station',
    `physics-lab/tower completed .* fall-time=${t} impact-velocity=${v} `,
  );

  // Kept on reload, with the cap; an unknown stored value gives medium.
  await page.reload();
  await openSettings(page, 'graphics');
  await expect(
    page.getByRole('group', { name: 'Graphics quality' }).getByLabel('High'),
  ).toBeChecked();
  await settingsSection(page, 'general');
  await page.getByLabel('Tiếng Việt').check();
  await settingsSection(page, 'graphics');
  await expect(
    page.getByRole('group', { name: 'Chất lượng đồ hoạ' }).getByLabel('Cao'),
  ).toBeChecked();
  await settingsSection(page, 'general');
  await page.getByLabel('English').check();
  await page.evaluate(() => localStorage.setItem('simlab.settings.graphicsQuality', 'extreme'));
  await page.reload();
  await openSettings(page, 'graphics');
  await expect(
    page.getByRole('group', { name: 'Graphics quality' }).getByLabel('Medium'),
  ).toBeChecked();
  expect(errors).toEqual([]);
});

test('Ultra asks first: Esc and Cancel keep the preset, Turn on Ultra switches and is kept; a run gives the same theory', async ({
  page,
}) => {
  test.setTimeout(180_000);
  // At the free-fall desk, looking at RUN (h 1.5 m, Earth); High chosen on an earlier visit (only
  // if none is stored: the script runs again on the reload below).
  await page.addInitScript(() => {
    if (localStorage.getItem('simlab.settings.graphicsQuality') === null) {
      localStorage.setItem('simlab.settings.graphicsQuality', 'high');
    }
  });
  const errors = await continueFrom(page, labSave([2.017, 0, -5.35], [1.867, 0.875, -5.9]));
  await expect.poll(async () => (await fpsLine(page)).graphics).toBe('high');

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingsSection(page, 'graphics');
  const group = page.getByRole('group', { name: 'Graphics quality' });
  const dialog = page.getByRole('dialog', { name: 'Turn on Ultra graphics?' });
  // Chosen: the dialog, the preset unchanged, its notes (SwiftShader here: the software warning).
  await group.getByLabel('Ultra').click();
  await expect(dialog).toBeVisible();
  await expect(group.getByLabel('High')).toBeChecked();
  await expect(dialog.locator('li')).toHaveCount(5);
  await expect(dialog).toContainText('RTX 4060');
  await expect(dialog).toContainText('without a graphics card');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  // Esc closes the dialog only: still paused, still High.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expectDebug(page, 'Phase', 'playing · paused');
  expect((await fpsLine(page)).graphics).toBe('high');
  // Cancel keeps High too.
  await group.getByLabel('Ultra').click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(group.getByLabel('High')).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('simlab.settings.graphicsQuality'))).toBe(
    'high',
  );
  // In Vietnamese, then turned on.
  await settingsSection(page, 'general');
  await page.getByLabel('Tiếng Việt').check();
  await settingsSection(page, 'graphics');
  await page.getByRole('group', { name: 'Chất lượng đồ hoạ' }).getByLabel('Ultra').click();
  const vi = page.getByRole('dialog', { name: 'Bật đồ họa Ultra?' });
  await expect(vi).toBeVisible();
  await vi.getByRole('button', { name: 'Bật Ultra' }).click();
  await expect(vi).toBeHidden();
  await settingsSection(page, 'general');
  await page.getByLabel('English').check();
  await settingsSection(page, 'graphics');
  await expect(group.getByLabel('Ultra')).toBeChecked();
  await expect.poll(async () => (await fpsLine(page)).graphics).toBe('ultra');
  expect(await page.evaluate(() => localStorage.getItem('simlab.settings.graphicsQuality'))).toBe(
    'ultra',
  );

  // Resumed under Ultra: a free-fall run gives the deterministic model's own values.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('.pause')).toBeHidden();
  await page.waitForTimeout(1500); // the post-processing chunk loaded and compiled
  await page.screenshot({ path: 'test-results/ultra-free-fall.png' });
  await expectDebug(page, 'Focus', 'physics-lab/button-run');
  await page.keyboard.press('e');
  const t = Math.sqrt((2 * 1.5) / 9.81).toFixed(3);
  const v = (-Math.sqrt(2 * 9.81 * 1.5)).toFixed(3);
  await expectDebug(
    page,
    'Station',
    `physics-lab/tower completed .* fall-time=${t} impact-velocity=${v} `,
  );
  // Kept on reload without asking again (the dialog is for choosing it, not for each visit).
  await page.reload();
  await openSettings(page, 'graphics');
  await expect(group.getByLabel('Ultra')).toBeChecked();
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test('the hub over the city: nothing of it fetched under Medium, fetched when High is chosen', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Phase V-2: Low and Medium keep the hub's floor as it was; the city is High's and Ultra's.
  await page.addInitScript(() => localStorage.setItem('simlab.settings.graphicsQuality', 'medium'));
  const fetched: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/hub-city/')) fetched.push(r.url());
  });
  const save = labSave([0, 0, 3], [0, 1.6, -6]);
  save.player.sceneId = 'simlab-hub';
  await page.addInitScript(
    (value) => localStorage.setItem('simlab.save.slot-1', value),
    JSON.stringify(save),
  );
  await page.goto('/');
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'simlab-hub');
  await expectDebug(page, 'Phase', 'playing');
  await page.waitForTimeout(2000);
  expect(fetched).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingsSection(page, 'graphics');
  await page.getByRole('group', { name: 'Graphics quality' }).getByLabel('High').check();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect.poll(() => fetched.some((url) => url.endsWith('Building_Large_2.gltf'))).toBe(true);
});
