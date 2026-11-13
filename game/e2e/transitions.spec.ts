import { expect, test } from '@playwright/test';
import { Aim, doorsClosed, expectDebug, newGame, type Vec3, walkThrough } from './support';

// Walk-through doors in the real app: the player opens the Preparation Room's door to the Teacher
// Room, walks through into the Teacher Room and back, three times — no teleport (the campus
// position goes steadily on, the view untouched), nothing loaded, and each time the door closes
// behind and the room left goes. Door to the Teacher Room: east wall (2.95, 0, 1); the Teacher
// Room's door back: its west wall (−2.45, 0, 0). Positions come from the dev debug panel.

const TEACHER_DOOR: Vec3 = [2.95, 1.05, 1];
const BACK_DOOR: Vec3 = [-2.45, 1.05, 0];

test('walks through the Teacher Room door and back, three times, without a teleport', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = await newGame(page);
  const aim = new Aim(page);
  const prompt = page.locator('.hud-prompt');

  // From the spawn (0, 0, 1) towards the Teacher Room door, until it is in focus.
  await aim.at(TEACHER_DOOR);
  await page.keyboard.down('w');
  await expectDebug(page, 'Focus', 'preparation-room/door-teacher');
  await page.keyboard.up('w');

  for (let round = 1; round <= 3; round++) {
    await walkThrough(page, {
      label: 'Go to Teacher Room',
      to: 'teacher-room',
      done: (p) => p[0] > -0.3, // 2.3 m past its door: away from it
    });
    await expectDebug(page, 'Room', 'teacher-room  grounded');
    await doorsClosed(page, 'teacher-room');
    if (round === 1) await page.screenshot({ path: 'test-results/transition-teacher-room.png' });

    // Turn round and walk back to its door, through it into the Preparation Room.
    await aim.sync();
    await aim.at(BACK_DOOR);
    await page.keyboard.down('w');
    await expectDebug(page, 'Focus', 'teacher-room/door-preparation');
    await page.keyboard.up('w');
    await expect(prompt).toContainText('Back to Preparation Room');
    await walkThrough(page, {
      label: 'Back to Preparation Room',
      to: 'preparation-room',
      done: (p) => p[0] < 0.9,
    });
    await expectDebug(page, 'Room', 'preparation-room  grounded');
    await doorsClosed(page, 'preparation-room');
    if (round === 1) await page.screenshot({ path: 'test-results/transition-prep-room.png' });

    await aim.sync();
    await aim.at(TEACHER_DOOR);
    await page.keyboard.down('w');
    await expectDebug(page, 'Focus', 'preparation-room/door-teacher');
    await page.keyboard.up('w');
  }
  expect(errors).toEqual([]);
});
