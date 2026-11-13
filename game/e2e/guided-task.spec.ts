import { expect, type Page, test } from '@playwright/test';
import { continueInto, sceneSave } from './saves';
import {
  afterFrame,
  Aim,
  approach,
  expectDebug,
  lookAngles,
  shot,
  use,
  type Vec3,
} from './support';

// Phase A (docs/phase-a-guided-tasks-contract.md), played by hand in the real app: Continue from a
// save of a player by the Chemistry Lab's door (no developer jump); the task panel on the right;
// T opens the list and frees the mouse; a task chosen draws a path on the floor to its step's
// object (the debug panel's Guide line) and outlines it; the world's own actions move it on (the
// cabinet opened); a wrong object leaves it waiting, while what the held object can act on is
// outlined (Outlined line); Stop following; the light switch task done to its end.

const LAB = 'chemistry-lab';
const at = (id: string) => `${LAB}/${id}`;
const DOOR: Vec3 = [0, 0, 3.2];
const CABINET: Vec3 = [3.286, 1, -10.5]; // the doors' face
const STAND: Vec3 = [3.286, 0, -9.5]; // in front of the cabinet, clear of its doors
const FLASK: Vec3 = [3.146, 1.039, -10.71];
const FLASK_HALF = 0.0563; // half the 50 mL flask's height: its base is on the shelf
const SWITCH: Vec3 = [-1.1, 1.143, 3.99];

/** The debug panel's line for `label`, its value only. */
async function line(page: Page, label: string): Promise<string> {
  const text = await page.locator('.debug-text').innerText();
  return new RegExp(`^${label}:\\s+(.*)$`, 'm').exec(text)?.[1] ?? '';
}

async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await afterFrame(page);
}

test('guided tasks: choose, follow the path, the world moves it on, outlines, stop, finish', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = await continueInto(page, sceneSave(LAB, DOOR, CABINET));
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = lookAngles(DOOR, CABINET);
  const panel = page.locator('.task-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.task-line')).toContainText('Tasks (6)');
  await expectDebug(page, 'Task', '—');

  // T: the list, the mouse free; choose the dilution.
  await press(page, 't');
  await expect(panel.locator('.task-list')).toBeVisible();
  await panel.getByRole('button', { name: /Dilution by hand/ }).click();
  await expect(panel.locator('.task-list')).toBeHidden();
  await expect(panel.locator('.task-current')).toContainText('Step 1 of 13');
  await expect(panel.locator('.task-current')).toContainText('Open the reagent cabinet');
  await expectDebug(page, 'Task', 'dilution-by-hand step 1/13 open-cabinet');
  // The way: from the door round the benches to the cabinet, which is outlined.
  await expect
    .poll(() => line(page, 'Guide'))
    .toMatch(/^[2-9]\d* points, .* chemistry-lab\/reagent-cabinet$/);
  const length = Number(/points, ([\d.]+) m/.exec(await line(page, 'Guide'))?.[1]);
  expect(length).toBeGreaterThan(3); // the cabinet is about 10 m away, past the island
  await shot(page, 'guided-task-1-path');

  // Walk it and open the cabinet: the world's own action moves the task on.
  await approach(page, aim, 2.486, -3.953); // between the east island and the dilution bench
  await approach(page, aim, STAND[0], STAND[2]);
  await use(page, aim, CABINET, at('reagent-cabinet'), 'Open');
  await expectDebug(page, 'Task', 'dilution-by-hand step 2/13 take-stock');
  await expect.poll(() => line(page, 'Guide')).toContain('chemistry-lab/stock-20');

  // The flask is not the step's object: the task waits. Held, the flask outlines its seat.
  await use(page, aim, FLASK, at('flask-50'), 'Grab');
  await expectDebug(page, 'Holding', at('flask-50'));
  await expectDebug(page, 'Task', 'dilution-by-hand step 2/13 take-stock');
  await expect.poll(() => line(page, 'Outlined')).toContain(at('dilution-tile'));
  await shot(page, 'guided-task-2-outline');

  // Stop following it: the step and the path go, the flask stays in hand.
  await press(page, 't');
  await panel.getByRole('button', { name: 'Stop following this task' }).click();
  await expectDebug(page, 'Task', '—');
  await expect(panel.locator('.task-current')).toBeHidden();
  await expect.poll(() => line(page, 'Guide')).toBe('0 points, 0.00 m · —');
  await expectDebug(page, 'Holding', at('flask-50'));
  // Set back on its shelf: while it is held, only what takes it can be focused (not the switch).
  await aim.at([FLASK[0], FLASK[1] - FLASK_HALF, FLASK[2]]);
  await press(page, 'e');
  await expectDebug(page, 'Holding', '—');

  // The light switch task, to its end.
  await press(page, 't');
  await panel.getByRole('button', { name: /The light switch/ }).click();
  await expectDebug(page, 'Task', 'chemistry-lights step 1/2 off');
  await approach(page, aim, 2.486, -3.953); // between the east island and the dilution bench
  await approach(page, aim, -1.1, 3.25);
  await use(page, aim, SWITCH, at('light-switch'), 'Switch the lights off');
  await expectDebug(page, 'Task', 'chemistry-lights step 2/2 on');
  await use(page, aim, SWITCH, at('light-switch'), 'Switch the lights on');
  await expectDebug(page, 'Task', '—');
  await press(page, 't');
  await expect(panel.getByRole('button', { name: /The light switch/ })).toContainText('Done');
  await press(page, 'Escape');
  expect(errors).toEqual([]);
});
