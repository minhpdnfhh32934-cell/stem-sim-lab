import { expect, test } from '@playwright/test';
import {
  Aim,
  continueFrom,
  doorsClosed,
  expectDebug,
  labSave,
  lookAngles,
  PROJECTILE_TARGETS as T,
  shot,
  type Vec3,
  walkThrough,
  walkToDoor,
} from './support';

// The city under the hub's glass after a walk in (Phú, 2026-11-11: not drawn in his desktop app):
// from the Physics Lab through its door into the hub under High (in a 640 × 360 window: at full size SwiftShader runs it at ~2 FPS and the doors outlast the waits), looking down — the city's files
// asked for, and seen (test-results/hub-city-walked.png). Ultra on a real GPU was looked at in
// the dev and production builds (docs/phase-e-report.md).
const STAND: Vec3 = [-3.95, 0, 0];
test.use({ viewport: { width: 640, height: 360 } });

test('the city under the glass after walking into the hub', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => localStorage.setItem('simlab.settings.graphicsQuality', 'high'));
  const cityRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('hub-city')) cityRequests.push(r.url());
  });
  const errors = await continueFrom(page, labSave(STAND, T.labDoor));
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = lookAngles(STAND, T.labDoor);
  await walkToDoor(page, aim, T.labDoor, 'physics-lab/door-hub');
  await walkThrough(page, {
    label: 'Back to SIMLAB Hub',
    to: 'simlab-hub',
    done: (p: Vec3) => p[0] < 10.5,
  });
  await doorsClosed(page, 'simlab-hub');
  await expectDebug(page, 'Scene', 'simlab-hub');
  await aim.to(Math.PI / 2, -0.7);
  await page.waitForTimeout(8000); // its files, then its shaders compiled off the frame
  await shot(page, 'hub-city-walked');
  expect(cityRequests.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
