import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  Aim,
  approach,
  continueFrom,
  expectDebug,
  labSave,
  lookAngles,
  shot,
  use,
  type Vec3,
  walkUntil,
} from './support';

// Phase E-2 in the real app: a 0.25 W resistor of 10 Ω led straight across the supply at 12 V
// (14 W) smokes, then catches fire on the board; the CO₂ extinguisher is taken (E) and sprayed at
// it (the left button held) until the fire is out. Then the phone (P): 114 with nothing burning is
// a false alarm.

const BOARD = 'physics-lab/circuit-trainer';
const EXTINGUISHER = 'physics-lab/co2-extinguisher';
// West of the cabinet: from here it does not hide the extinguisher beside it.
const STAND: Vec3 = [-0.6, 0, 6.3];
const BOARD_AT: Vec3 = [0.98, 0.94, 6.98];

/** The resistor between the front row's holes 21 and 22, the supply's posts led to them. */
const circuit = JSON.stringify({
  parts: [
    {
      id: 'physics-lab/part-resistor-10-1',
      item: 'part-resistor-10',
      edge: 18,
      flip: false,
      setting: 0,
      broken: false,
    },
  ],
  wires: [
    [28, 21],
    [22, 29],
  ],
  volts: 12,
  burnt: false,
});

function extinguisherAt(): Vec3 {
  const rooms = JSON.parse(readFileSync('src/content/lab-placements.json', 'utf8')) as {
    room: string;
    placements: { id: string; position: Vec3 }[];
  }[];
  const p = rooms
    .find((r) => r.room === 'physics-lab')
    ?.placements.find((q) => `physics-lab/${q.id}` === EXTINGUISHER);
  if (!p) throw new Error('no extinguisher placement');
  return [p.position[0], 0.3, p.position[2]];
}

test('circuit fire: an overloaded resistor burns, the CO₂ extinguisher puts it out; 114 with no fire is a false alarm', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const look = extinguisherAt();
  const errors = await continueFrom(page, labSave(STAND, look, { [BOARD]: { circuit } }));
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = lookAngles(STAND, look);
  // 14 W in a 0.25 W resistor: smoke within a second, fire within two.
  await expectDebug(page, 'Fire', `${BOARD} 0\\.\\d\\d`);
  await use(page, aim, look, EXTINGUISHER, 'Grab');
  await expectDebug(page, 'Holding', EXTINGUISHER);
  // From a step back, as a CO₂ jet is meant to be used (3 m reach): looking down from close by, the
  // tall extinguisher held out would meet the bench and be let go.
  await walkUntil(page, 's', (p) => p[2] < 5.9);
  await expectDebug(page, 'Holding', EXTINGUISHER);
  await approach(page, aim, 1.1, 5.5, 0.2);
  await expectDebug(page, 'Holding', EXTINGUISHER);
  await aim.at([BOARD_AT[0] + 0.16, BOARD_AT[1], BOARD_AT[2] - 0.2]);
  await expectDebug(page, 'Holding', EXTINGUISHER);
  await shot(page, 'circuit-fire-burning');
  await page.mouse.down();
  await expectDebug(page, 'Fire', '.*spraying');
  await shot(page, 'circuit-fire-spraying');
  await expectDebug(page, 'Fire', '—');
  await page.mouse.up();
  await shot(page, 'circuit-fire-out');

  // The phone, from the bag into the hand: P (the hands free first: the extinguisher set down).
  await aim.at([1.1, 0, 5.0]); // the floor before the feet
  await expect(page.locator('.hud-prompt')).toContainText('Set down');
  await page.keyboard.press('e');
  await expectDebug(page, 'Holding', '—');
  await expectDebug(page, 'Phone', 'away');
  await aim.to(Math.PI, 0); // looking ahead, at the bench
  await page.keyboard.press('p');
  await expectDebug(page, 'Phone', 'out — idle');
  // Each digit seen on the phone before the next (two presses of a key in one frame are one).
  let dialled = '';
  for (const digit of ['1', '1', '4']) {
    await page.keyboard.press('Digit' + digit);
    dialled += digit;
    await expectDebug(page, 'Phone', 'out ' + dialled + ' idle');
  }
  await expectDebug(page, 'Phone', 'out 114 idle');
  await page.keyboard.press('e');
  await expectDebug(page, 'Phone', 'out 114 ringing');
  // Nothing burns now: 114 answers that this is a false call.
  await expectDebug(page, 'Phone', 'out 114 talking false-alarm');
  await shot(page, 'circuit-fire-phone');
  await page.keyboard.press('q');
  await expectDebug(page, 'Phone', 'away');
  await expectDebug(page, 'Inventory', '.*');
  expect(errors).toEqual([]);
});
