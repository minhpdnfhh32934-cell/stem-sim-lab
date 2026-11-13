import { expect, test } from '@playwright/test';
import { continueInto, sceneSave } from './saves';
import { expectDebug, pixel, shot, walkUntil } from './support';

// Phase H-1 (docs/phase-h-body-hands-contract.md H3): the preparation room's full-length mirror
// reflects the player's body under High. Standing square in front of it, the middle of the view
// (above the crosshair, in the mirror) shows the player's own top; standing aside, the same
// point of the mirror shows the room. SwiftShader images, not GPU results.

const MIRROR_MIDDLE: [number, number, number] = [-2.97, 1.25, 0.1];
const CHEST = { x: 640, y: 300 }; // above the crosshair: the reflected chest

const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - (b[i] ?? 0)));

test('the mirror shows the player: their shirt in front of it, the room from aside', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('simlab.settings.graphicsQuality', 'high'));
  const errors = await continueInto(
    page,
    sceneSave('preparation-room', [-1.2, 0, 0.1], MIRROR_MIDDLE),
  );
  await expectDebug(page, 'FPS', String.raw`.*graphics high`);
  await page.waitForTimeout(1500);
  const front = await pixel(page, CHEST.x, CHEST.y);
  await shot(page, 'mirror-front');
  // Khoa's white T-shirt in the opening of his black jacket (C-10), through the glass's tint:
  // light and grey.
  const [r = 0, g = 0, b = 0] = front;
  const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 30;
  expect(Math.min(r, g, b) > 140 && neutral, `front ${front.join(',')}`).toBe(true);

  // A step aside (strafing, the view unturned): the mirror's point there shows the room.
  await walkUntil(page, 'd', (p) => Math.abs(p[2] - 0.1) > 0.6); // off the 0.52 m glass
  await page.waitForTimeout(1500);
  await shot(page, 'mirror-aside');
  const aside = await pixel(page, CHEST.x, CHEST.y);
  expect(distance(aside, front), `aside ${aside.join(',')}`).toBeGreaterThan(40);
  expect(errors).toEqual([]);
});
