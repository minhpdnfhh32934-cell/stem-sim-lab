import { expect, type Page, test } from '@playwright/test';
import { Aim, expectDebug, lookAngles, menuContinue, shot, type Vec3 } from './support';

// An emergency call answered in the real app (Phú 2026-11-13): 113 on the phone in the hub brings
// the police by helicopter. It blows a hole in the ceiling over the hall, four come down the ropes,
// look round, ask the teacher (nothing is wrong), warn the caller, climb back, and the ceiling
// mends. The player is put in the hub by Continue from a save (the game's own load path).

const STAND: Vec3 = [0, 0, 4.9];
/** Near the ropes on the hall's +x side (3 m from the nearest): the slide down seen close. */
const NEAR: Vec3 = [1.6, 0, 0.8];
/** Between the two ropes on the +x side, half way up. */
const ROPES_EAST: Vec3 = [1.45, 5.5, -3];
const HOLE: Vec3 = [0, 8.6, -3];
const FLOOR_UNDER: Vec3 = [0, 0, -3];

/** In the hub from a save, the phone out, `number` called; the console's errors listed. */
async function callFromHub(page: Page, number: string, squad: string, stand = STAND) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  const [yaw, pitch] = lookAngles(stand, HOLE);
  const save = {
    version: 2,
    savedAt: '2026-11-13T00:00:00.000Z',
    player: {
      characterId: 'researcher-male',
      sceneId: 'simlab-hub',
      position: stand,
      yaw,
      pitch,
      equipment: [],
    },
    world: { entityStates: {} },
    progression: { completedExperiments: [], procedures: {} },
  };
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: 'simlab.save.slot-1', value: JSON.stringify(save) },
  );
  await page.goto('/');
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'simlab-hub');
  const aim = new Aim(page);
  await aim.sync();
  await page.keyboard.press('p');
  await expectDebug(page, 'Phone', 'out — idle');
  let dialled = '';
  for (const digit of number) {
    await page.keyboard.press('Digit' + digit);
    dialled += digit;
    await expectDebug(page, 'Phone', 'out ' + dialled + ' idle');
  }
  await page.keyboard.press('e');
  await expectDebug(page, 'Phone', `out ${number} talking dispatched`);
  await expectDebug(page, 'Fire', `.*${squad} inbound`);
  await page.keyboard.press('q');
  await expectDebug(page, 'Phone', 'away');
  return { aim, errors };
}

test('113: the police come through the hub ceiling, ask the teacher, warn the caller, and go', async ({
  page,
}) => {
  test.setTimeout(330_000);
  const { aim, errors } = await callFromHub(page, '113', 'police-squad');

  // The blast: the ceiling open over the hall.
  await aim.at(HOLE);
  const fire = page.locator('.debug-text');
  await expect(fire).toContainText(/police-squad breach (2|3)\./, { timeout: 30_000 });
  await shot(page, 'emergency-1-blast');
  await expect(fire).toContainText(/police-squad rappel (1|2)\./, { timeout: 15_000 });
  await shot(page, 'emergency-2-ropes');
  await aim.at(ROPES_EAST);
  await shot(page, 'emergency-2b-sliding');
  await expect(fire).toContainText(/police-squad mission/, { timeout: 15_000 });
  await aim.at(FLOOR_UNDER);
  await shot(page, 'emergency-3-landed');

  // Their lines, and the teacher's answer, under the screen.
  const who = page.locator('.emergency-caption-who');
  await expect(who).toHaveText(/Police|Cảnh sát/i, { timeout: 30_000 });
  await expect(who).toHaveText(/^(Mr\.|Thầy)/, { timeout: 90_000 });
  await shot(page, 'emergency-4-asked');
  await expect(page.locator('.emergency-caption-text')).toHaveText(/warning|cảnh cáo/i, {
    timeout: 90_000,
  });
  await shot(page, 'emergency-5-warned');

  // Back up the ropes, away, and the ceiling mended.
  await aim.at(HOLE);
  await expect(fire).toContainText(/police-squad ascend/, { timeout: 60_000 });
  await shot(page, 'emergency-6-climbing');
  await expect(fire).toContainText(/police-squad repair 1[0-9]\./, { timeout: 60_000 });
  await shot(page, 'emergency-7-mending');
  await expect(fire).not.toContainText(/police-squad/, { timeout: 40_000 });
  await shot(page, 'emergency-8-whole');
  expect(errors).toEqual([]);
});

// 114 with nothing burning: the firefighters come down, find the caller, tell them off and slap
// them (the screen flashes red and shakes).
test('114 for nothing: the firefighters find the caller, tell them off and slap them', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const { aim, errors } = await callFromHub(page, '114', 'fire-squad', NEAR);
  const fire = page.locator('.debug-text');
  await aim.at(HOLE);
  await expect(fire).toContainText(/fire-squad rappel (1|2)./, { timeout: 30_000 });
  await shot(page, 'emergency-fire-1-ropes');
  await aim.at(ROPES_EAST);
  await shot(page, 'emergency-fire-1b-sliding');
  await shot(page, 'emergency-fire-1c-sliding');
  await expect(fire).toContainText(/fire-squad mission/, { timeout: 15_000 });
  await aim.at(FLOOR_UNDER);
  await shot(page, 'emergency-fire-2-landed');
  // They come to the caller: the telling off, then the slap.
  await expect(page.locator('.emergency-caption-who')).toHaveText(/Firefighter|Lính cứu/i, {
    timeout: 30_000,
  });
  await expect(page.locator('.hud-hurt.flash')).toHaveCount(1, { timeout: 90_000 });
  await shot(page, 'emergency-fire-3-slapped');
  await expect(fire).toContainText(/fire-squad (regroup|ascend)/, { timeout: 30_000 });
  await shot(page, 'emergency-fire-4-leaving');
  expect(errors).toEqual([]);
});
