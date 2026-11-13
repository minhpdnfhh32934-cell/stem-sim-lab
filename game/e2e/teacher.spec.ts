import { expect, test } from '@playwright/test';
import { continueInto, sceneSave } from './saves';
import { Aim, approach, expectDebug, handsFree, shot, walkThrough } from './support';

// The hub's teacher (Phase Y) in the real app: Continue from a save of a player standing before
// the reception counter, looking at him; E talks to him — his name and greeting written out in the
// box along the bottom, his choices beside him (solving a problem, a later phase, shown disabled,
// "Coming soon"; the test is Y-5's, test-paper.spec), Goodbye last; the player stands still meanwhile; Goodbye says a farewell and
// ends the talk, and he can be talked to again. Then (Y-2) he is asked to explain a simulation:
// he follows the player through the Physics Lab's door and lectures at the Atwood machine,
// then (Y-3) works an example on the lab's board; going back he taps his card on the shut door.

test('the hub teacher: E to talk, his greeting, his choices, goodbye', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await continueInto(page, sceneSave('simlab-hub', [0, 0, -6.5], [0, 1.6, -8.4]));
  await expectDebug(page, 'Focus', 'simlab-hub/teacher');
  await expect(page.locator('.hud-prompt')).toContainText('Talk');
  await expect(page.locator('.hud-prompt')).toContainText('Mr. Quang');

  await page.keyboard.press('e');
  const box = page.locator('.dialogue-box');
  await expect(box).toBeVisible();
  await expect(box.locator('.dialogue-name')).toHaveText('Mr. Quang');
  await expect(box.locator('.dialogue-text')).toHaveText(
    "Hello! I'm Mr. Quang, the teacher here at SimLab. What can I do for you?",
  );
  await expectDebug(page, 'Talk', 'teacher greeting #0');
  await expect(page.locator('.hud-prompt')).toBeEmpty(); // "Talk" is not on offer while talking

  // The player stands still while talking: walking keys do nothing.
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  await expectDebug(page, 'Position', String.raw`-?0\.00, -?0\.00, -6\.50 m`);
  await shot(page, 'teacher-1-greeting');

  // On: his choices beside him, the one not built yet disabled.
  await page.keyboard.press('e');
  const choices = page.locator('.dialogue-choice-button');
  await expect(choices).toHaveCount(4);
  await expect(choices.locator('.dialogue-choice-label')).toHaveText([
    'Explain a simulation',
    'Help me solve a problem',
    'Give me a test',
    'Goodbye',
  ]);
  await expect(choices.nth(0)).toBeEnabled();
  await expect(choices.nth(1)).toBeDisabled();
  await expect(choices.nth(1).locator('.dialogue-choice-soon')).toHaveText('Coming soon');
  await expect(choices.nth(2)).toBeEnabled();
  await expect(choices.nth(3)).toBeEnabled();
  await page.keyboard.press('2'); // disabled: nothing happens, no hotbar slot either
  await expectDebug(page, 'Talk', 'teacher menu #0');
  await expectDebug(page, 'Inventory', String.raw`— · selected #1`);
  await shot(page, 'teacher-2-choices');

  // Goodbye: a farewell, then the talk ends.
  await page.keyboard.press('4');
  await expectDebug(page, 'Talk', 'teacher farewell #0');
  await expect(box.locator('.dialogue-text')).toHaveText(
    'Good luck in the labs — and keep asking why!',
  );
  await page.keyboard.press('e');
  await expect(page.locator('.dialogue')).toBeHidden();
  await expectDebug(page, 'Talk', '—');

  // Again: the second greeting, then Esc ends it at once.
  await expectDebug(page, 'Focus', 'simlab-hub/teacher');
  await page.keyboard.press('e');
  await expect(box.locator('.dialogue-text')).toHaveText(
    'Good to see you again! What shall we work on today?',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.dialogue')).toBeHidden();
  await expectDebug(page, 'Phase', 'playing'); // Esc ended the talk; it did not pause the game
  await expect(page.locator('.debug-text')).not.toContainText('paused');
  expect(errors).toEqual([]);
});

test('the hub teacher explains a simulation: follows through a door, lectures at it', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = await continueInto(page, sceneSave('simlab-hub', [0, 0, -6.5], [0, 1.6, -8.4]));
  await expectDebug(page, 'Focus', 'simlab-hub/teacher');
  const box = page.locator('.dialogue-box');
  const text = box.locator('.dialogue-text');
  // On to the next line once this one is written out whole (a press before only completes it).
  const next = async () => {
    await expect(box.locator('.dialogue-next')).toHaveClass(/ready/);
    await page.keyboard.press('e');
  };
  await page.keyboard.press('e');
  await expect(text).toHaveText(/^Hello!.*for you\?$/);
  await page.keyboard.press('e');
  await page.keyboard.press('1');
  await expect(text).toHaveText(/^Of course! Which simulation\? Lead the way.*press E on it\.$/);
  await next();
  await expect(page.locator('.dialogue')).toBeHidden();
  await expectDebug(page, 'Talk', '— · teacher follow simlab-hub');

  // Across the hall to the Physics Lab's door and through it; he comes after the player.
  const aim = new Aim(page);
  await aim.sync();
  await approach(page, aim, 0, -3, 0.4);
  await approach(page, aim, 11.45, -3, 0.3);
  await aim.at([12.95, 1.05, -3]);
  await expectDebug(page, 'Focus', 'simlab-hub/door-physics');
  await walkThrough(page, {
    label: 'Enter Physics Lab',
    to: 'physics-lab',
    done: (p) => p[0] > -2.55,
  });
  await expectDebug(page, 'Talk', '— · teacher follow physics-lab');

  // To the Atwood machine: E on it asks him to explain it.
  await approach(page, aim, 0.85, -0.5, 0.3);
  await handsFree(page);
  await aim.at([0.85, 1.5, -2.632]);
  await expectDebug(page, 'Focus', 'physics-lab/atwood');
  await expect(page.locator('.hud-prompt')).toContainText('Ask Mr. Quang to explain this');
  // With him following it is its only action, and H waits (Phú 2026-11-10): one key offered.
  await expect(page.locator('.hud-prompt kbd')).toHaveCount(1);
  await expect(page.locator('.hud-prompt')).not.toContainText('Inspect');
  await expect(page.locator('.explain-hint')).toBeHidden();
  await page.screenshot({ path: 'test-results/teacher-ask-only.png' });
  // The lab came in beside the hub: its desk lamp is still on its desk, not under the floor.
  const lamp = /physics-lab\/lamp\s+(-?[\d.]+), (-?[\d.]+), (-?[\d.]+)/.exec(
    await page.locator('.debug-text').innerText(),
  );
  expect(Number(lamp?.[2])).toBeGreaterThan(1);
  await page.keyboard.press('e');
  await expect(text).toHaveText(/^Ah — Atwood machine: bodies joined over a pulley!/);
  await expectDebug(page, 'Talk', 'teacher lecture #0');
  await expect(page.locator('.explain')).toHaveClass(/lecturing/);
  await expect(page.locator('.explain-panel')).toBeHidden();

  // The summary, then the first part: he points at it and its label is lit.
  await next();
  await expectDebug(page, 'Talk', 'teacher lecture #1');
  await next();
  await expectDebug(
    page,
    'Talk',
    String.raw`teacher lecture #2 · teacher lecture physics-lab \S+, \S+ talk → pulley`,
  );
  await expect(text).toHaveText(/^Pulley — /);
  await expect(page.locator('.explain-tag.lit')).toHaveCount(1);
  await expect(page.locator('.explain-tag.lit strong')).toHaveText('Pulley');
  await page.waitForTimeout(1500); // he turns and raises his arm
  await shot(page, 'teacher-3-lecture');

  // Skip through the rest of the lecture to the question after it: the board (Y-3).
  const choices = page.locator('.dialogue-choice-button');
  const skip = box.getByRole('button', { name: 'Skip' });
  for (let i = 0; i < 30 && (await choices.count()) === 0; i++) await skip.click();
  await expect(choices.locator('.dialogue-choice-label')).toHaveText([
    'Yes, on the board',
    'No, thank you',
  ]);
  await expect(choices.nth(0)).toBeEnabled();
  await page.keyboard.press('1');
  await expectDebug(page, 'Talk', 'teacher lesson #0');
  await expect(page.locator('.explain')).toBeHidden();
  // He goes to the board and writes the example's title; on, what is given and asked: four board
  // lines (the Atwood machine's long title broken in two, so it stays readable).
  await expectDebug(page, 'Talk', String.raw`.* · board physics-lab/whiteboard 1/\d+`);
  await next();
  await expectDebug(page, 'Talk', 'teacher lesson #1');
  await expectDebug(page, 'Talk', String.raw`.* · board physics-lab/whiteboard 4/\d+`);
  await page.waitForTimeout(1500); // he steps aside to talk
  await shot(page, 'teacher-5-board');

  // Esc ends the lesson; he walks back to his day, and the board keeps what is written.
  await page.keyboard.press('Escape');
  await expect(page.locator('.dialogue')).toBeHidden();
  await expectDebug(
    page,
    'Talk',
    String.raw`— · teacher return .* board physics-lab/whiteboard 4/`,
  );
  await expectDebug(page, 'Phase', 'playing');

  // The lab's door to the hall is shut: he taps his card on its reader, then goes through.
  await aim.at([-4.95, 1.1, -0.6]);
  await expectDebug(page, 'Talk', String.raw`— · teacher return physics-lab \S+, \S+ \S+ card`);
  await page.screenshot({ path: 'test-results/teacher-4-card.png' }); // at once: the tap is 1.5 s
  await expectDebug(page, 'Talk', String.raw`— · teacher (return|day) simlab-hub`);
  expect(errors).toEqual([]);
});
