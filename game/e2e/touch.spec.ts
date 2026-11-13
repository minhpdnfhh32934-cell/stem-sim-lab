import { expect, test, type Page } from '@playwright/test';
import { sceneSave } from './saves';
import {
  captureAt,
  expectDebug,
  position,
  shot,
  menuContinue,
  openSettings,
  settingsSection,
} from './support';

// Touch controls (2026-11-12): a phone or tablet gets a stick, a drag to look and buttons; a
// computer keeps keyboard and mouse. The phone here is asked for in the address (`?device=phone`:
// Edge under Playwright is a computer), at a phone's landscape size; the classification itself is
// unit tested (platform/device.test.ts). Fingers are the mouse's pointer events: the controls
// listen to pointer events, a finger's and a mouse's alike.

const SAVE = sceneSave('preparation-room', [0, 0, 1], [0, 1.6, -3]);

async function open(page: Page, address: string, onMenu?: () => Promise<void>) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: 'simlab.save.slot-1', value: JSON.stringify(SAVE) },
  );
  await page.goto(address);
  await onMenu?.();
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'preparation-room');
  await expectDebug(page, 'Phase', 'playing');
  return errors;
}

const yaw = async (page: Page) =>
  Number(/Look:\s+yaw (-?\d+)°/.exec(await page.locator('.debug-text').innerText())?.[1]);

test.describe('on a phone', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('touch controls: the stick walks, a drag looks, the phone dials 114', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = await open(page, '/?device=phone&debug=1');
    await expectDebug(page, 'Device', 'phone');
    const controls = page.locator('.touch-controls');
    await expect(controls).toBeVisible();
    await expect(page.locator('.hud-hint')).toBeHidden(); // no "click to capture"
    await shot(page, 'touch-1-controls');

    // The stick: the thumb down in the lower left, pushed up: forward (−z), then let go.
    const start = await position(page);
    await page.mouse.move(110, 300);
    await page.mouse.down();
    await page.mouse.move(110, 250, { steps: 5 });
    await page.waitForTimeout(1500);
    await page.mouse.up();
    await page.waitForTimeout(600);
    const end = await position(page);
    expect(start[2] - end[2]).toBeGreaterThan(0.5);
    expect(Math.abs(end[0] - start[0])).toBeLessThan(0.2);

    // A drag on the free screen to the right turns the view right (yaw down).
    const before = await yaw(page);
    await page.mouse.move(420, 180);
    await page.mouse.down();
    await page.mouse.move(560, 180, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(await yaw(page)).toBeLessThan(before - 10);

    // The phone button: the phone out, a keypad; 1 1 4, Call.
    await controls.getByRole('button', { name: 'P Phone' }).click();
    const keypad = page.locator('.touch-keypad');
    await expect(keypad).toBeVisible();
    for (const digit of ['1', '1', '4']) {
      await keypad.getByRole('button', { name: digit, exact: true }).click();
      await page.waitForTimeout(150);
    }
    await expectDebug(page, 'Phone', 'out 114 idle');
    await shot(page, 'touch-2-keypad');
    await keypad.getByRole('button', { name: 'E Call' }).click();
    await expectDebug(page, 'Phone', 'out 114 (ringing|talking)');
    // Looking by tilting (the gyroscope): turned on in the settings, readings of a turn about the
    // device's top edge (portrait here: the desktop browser's screen) turn the view left (yaw up).
    await controls.getByRole('button', { name: 'Pause' }).click();
    await page.locator('.pause').getByRole('button', { name: 'Settings' }).click();
    await settingsSection(page, 'controls');
    const tilt = page.getByLabel('Look by tilting the device');
    await expect(tilt).toBeEnabled(); // localhost is a secure page
    await tilt.check();
    await expectDebug(page, 'Device', 'phone · look 1× · tilt on');
    await page.locator('.pause').getByRole('button', { name: 'Back' }).click();
    await page.locator('.pause').getByRole('button', { name: 'Resume' }).click();
    await expectDebug(page, 'Phase', 'playing');
    const unturned = await yaw(page);
    await page.evaluate(async () => {
      for (let i = 0; i < 12; i++) {
        window.dispatchEvent(
          new DeviceMotionEvent('devicemotion', {
            rotationRate: { alpha: 0, beta: 0, gamma: 30 },
            interval: 50,
          }),
        );
        await new Promise((done) => setTimeout(done, 50));
      }
    });
    await page.waitForTimeout(400);
    const turned = (await yaw(page)) - unturned;
    expect(turned).toBeGreaterThan(8); // ~16° (30°/s for 11 gaps of ~50 ms), the timers' slack
    expect(turned).toBeLessThan(30);

    // Pause: the controls step aside for the pause menu.
    await controls.getByRole('button', { name: 'Pause' }).click();
    await expectDebug(page, 'Phase', 'playing');
    await expect(page.locator('.pause')).toBeVisible();
    await expect(controls).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test('on a computer: no touch controls; the look sensitivity doubles the mouse’s turn', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = await open(page, '/', async () => {
    await openSettings(page, 'controls');
    await expect(page.getByLabel('Look by tilting the device')).toHaveCount(0); // phones only
    await page.getByLabel('Look sensitivity').fill('6'); // the 7th step: 2×
  });
  await expectDebug(page, 'Device', 'computer · look 2× · tilt off');
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  // The mouse moved right: the view turns 2 × 0.0025 rad a pixel (what arrived is counted).
  await captureAt(page, { x: 640, y: 360 });
  await page.evaluate(() => {
    const w = window as unknown as { movedX: number };
    w.movedX = 0;
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) w.movedX += e.movementX;
    });
  });
  await page.waitForTimeout(500); // the capture's own move read, the 4 Hz panel caught up
  const before = await yaw(page);
  await page.evaluate(() => ((window as unknown as { movedX: number }).movedX = 0));
  await page.mouse.move(740, 360, { steps: 10 });
  await page.waitForTimeout(500);
  const moved = await page.evaluate(() => (window as unknown as { movedX: number }).movedX);
  const turned = ((before - (await yaw(page)) + 540) % 360) - 180;
  expect(moved).toBeGreaterThan(50);
  expect(turned).toBeCloseTo((moved * 2 * 0.0025 * 180) / Math.PI, -0.5); // within ±1.6° (whole degrees)
  expect(errors).toEqual([]);
});
