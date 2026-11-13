import { expect, test } from '@playwright/test';
import { continueInto, sceneSave } from './saves';
import { Aim, expectDebug, shot, type Vec3 } from './support';

/** The paper in his hand, held out over the reception counter (NpcSystem's HAND_*). */
const HELD_OUT: Vec3 = [-0.12, 1.12, -7.88];

// The hub teacher's test (Phase Y-5) in the real app: asked for one, he shows a form over his line
// — the simulations with questions by subject, how many, which kinds, which levels — then writes
// it on a paper at his desk (a bar over his head; the game goes on), holds it out and calls the
// player; a click on it and the hand takes it into the bag. Chosen, E on nothing holds it up:
// answers are circled in ink, a changed one crossed out; Esc puts it down. Handed in by a click on
// him, the hand gives it to his; he marks it at his desk, holds it out again, and taken back he
// says the mark; read again, it has his marks and his notes. Which answers are right is never read
// here: the paper is done blind (always A, always true), as a player could.

test('the hub teacher’s test: set up, written, done, handed in, marked', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await continueInto(page, sceneSave('simlab-hub', [0, 0, -6.5], [0, 1.6, -8.4]));
  await expectDebug(page, 'Focus', 'simlab-hub/teacher');
  const box = page.locator('.dialogue-box');
  const text = box.locator('.dialogue-text');
  const next = async () => {
    await expect(box.locator('.dialogue-next')).toHaveClass(/ready/);
    await page.keyboard.press('e');
  };
  await page.keyboard.press('e');
  await expect(text).toHaveText(/^Hello!.*for you\?$/); // written out whole: E goes on
  await page.keyboard.press('e');
  await expect(page.locator('.dialogue-choice-button')).toHaveCount(4);
  await page.keyboard.press('3');

  // The form over his line: the banks come in, nothing is chosen yet.
  const form = page.locator('.test-setup');
  await expect(form).toBeVisible();
  await expect(text).toHaveText(/Which simulations/);
  const boxes = form.locator('input[data-experiment]');
  await expect(boxes.first()).toBeVisible({ timeout: 30_000 });
  expect(await boxes.count()).toBeGreaterThan(70);
  const available = form.locator('.test-setup-available');
  await expect(available).toHaveText('Choose at least one simulation.');
  await expect(form.locator('.test-setup-write')).toBeDisabled();
  // Several subjects at once: physics, chemistry, biology.
  for (const id of ['free-fall', 'ohms-law', 'acid-base-titration', 'osmosis']) {
    await form.locator(`input[data-experiment="${id}"]`).check();
  }
  await form.locator('.test-setup-count').selectOption('10');
  await expect(available).toHaveText('The test will have 10 questions.');
  await shot(page, 'paper-1-setup');

  // Asked: he goes to write it; the conversation ends, the game goes on.
  await form.locator('.test-setup-write').click();
  await expect(form).toBeHidden();
  await expect(text).toHaveText(/write it at my desk/);
  await next();
  await expect(page.locator('.dialogue')).toBeHidden();
  await expectDebug(page, 'Phase', 'playing');
  await expectDebug(page, 'Talk', String.raw`— · teacher errand simlab-hub \S+, \S+ write`);
  await page.waitForTimeout(3000);
  await shot(page, 'paper-2-writing');
  // He calls when it is ready (10 s of writing).
  await expect(page.locator('.hud-toast', { hasText: 'Your test is ready' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.hud-toast', { hasText: 'Your test is ready' })).toContainText(
    'Mr. Quang',
  );

  // He holds it out over the counter: a click on it, and the hand takes it, into the bag.
  const aim = new Aim(page);
  await aim.sync();
  const facing = { yaw: aim.yaw, pitch: aim.pitch };
  await aim.at(HELD_OUT);
  await expectDebug(page, 'Focus', 'simlab-hub/teacher/paper');
  await expect(page.locator('.hud-prompt')).toContainText('Take the test');
  await expect(page.locator('.hud-prompt')).toContainText('LMB');
  await shot(page, 'paper-2b-held-out');
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(450);
  await page.screenshot({ path: 'test-results/paper-2c-taking.png' }); // the hand at it
  await expect(text).toHaveText(/^Here you are\. No time limit/);
  await next();
  await expect(page.locator('.dialogue')).toBeHidden();
  await aim.sync(); // talking, the view turned to him
  await expectDebug(page, 'Inventory', String.raw`#\d+ test-paper×1`);
  await expectDebug(page, 'Papers', String.raw`paper-1 0/10 · scores 0`);
  // On him, E (or a click) would hand it in (nothing done yet: he would say so).
  await aim.to(facing.yaw, facing.pitch);
  await expect(page.locator('.hud-prompt')).toContainText('Hand in the test');

  // Looking at the floor (nothing focused): E does the test.
  await aim.to(facing.yaw + Math.PI, -0.9);
  await expectDebug(page, 'Focus', '—');
  await expect(page.locator('.hud-prompt')).toContainText('Do the test');
  await expect(page.locator('.hud-prompt')).toContainText('TEST No. 1');
  await page.keyboard.press('e');
  const paper = page.locator('.paper-overlay');
  await expect(paper).toBeVisible();
  await expect(paper.locator('.paper-title')).toHaveText('TEST No. 1');
  const questions = paper.locator('.paper-question');
  await expect(questions).toHaveCount(10);
  await expectDebug(page, 'Papers', String.raw`paper-1 0/10 · up paper-1`);
  await shot(page, 'paper-3-open');

  // Done blind: A for each choice, true for each statement; the first answer changed to B.
  for (let i = 0; i < 10; i++) {
    const question = questions.nth(i);
    const options = question.locator('.paper-option-button');
    if ((await options.count()) > 0) {
      await options.first().click();
      if (i === 0) {
        await page.waitForTimeout(250);
        await shot(page, 'paper-4-circling'); // the pen going round A
        await questions.nth(0).locator('.paper-option-button').nth(1).click();
      }
    } else {
      const statements = question.locator('.paper-statement');
      for (let k = 0; k < (await statements.count()); k++) {
        await statements.nth(k).locator('.paper-cell').first().click();
      }
    }
  }
  await expect(paper.locator('.paper-ink-cross')).toHaveCount(1);
  await expectDebug(page, 'Papers', String.raw`paper-1 10/10 · up paper-1`);
  await page.waitForTimeout(700);
  await shot(page, 'paper-5-answered');

  // Esc puts it down; the game was never paused.
  await page.keyboard.press('Escape');
  await expect(paper).toBeHidden();
  await expectDebug(page, 'Phase', 'playing');
  await expect(page.locator('.debug-text')).not.toContainText('paused');

  // Handed in by a click: the hand gives it to his; he marks it at his desk in red.
  await aim.to(facing.yaw, facing.pitch);
  await expectDebug(page, 'Focus', 'simlab-hub/teacher');
  await expect(page.locator('.hud-prompt')).toContainText('Hand in the test');
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/paper-5b-giving.png' }); // the hand out to his
  await expect(page.locator('.hud-toast', { hasText: 'Let me mark it' })).toBeVisible();
  await expectDebug(page, 'Inventory', '— · selected');
  await expectDebug(page, 'Talk', String.raw`— · teacher errand simlab-hub \S+, \S+ write`);
  await page.waitForTimeout(2000);
  await shot(page, 'paper-5c-marking');
  // Marked, he holds it out again; taken back, he says the mark.
  await expect(page.locator('.hud-toast', { hasText: 'marked your test' })).toBeVisible({
    timeout: 20_000,
  });
  await aim.at(HELD_OUT);
  await expectDebug(page, 'Focus', 'simlab-hub/teacher/paper');
  await expect(page.locator('.hud-prompt')).toContainText('Take the marked test');
  await page.keyboard.press('e');
  await expect(text).toHaveText(/^You scored \d+(\.\d+)? out of 10\./, { timeout: 15_000 });
  await expectDebug(page, 'Papers', String.raw`paper-1 10/10 mark [\d.]+ · scores 1`);
  await next();
  await expect(page.locator('.dialogue')).toBeHidden();
  await aim.sync();

  await expectDebug(page, 'Inventory', String.raw`#\d+ test-paper×1`);

  // Read again: his marks, the mark circled at the top, and his notes.
  await aim.to(facing.yaw + Math.PI, -0.9);
  await expect(page.locator('.hud-prompt')).toContainText('Read the marked test');
  await page.keyboard.press('e');
  await expect(paper).toBeVisible();
  await expect(paper.locator('.paper-mark')).toBeVisible();
  await expect(paper.locator('.paper-verdict')).toHaveCount(10);
  await expect(paper.locator('.paper-option-button').first()).toBeDisabled();
  await expect(paper.locator('.paper-feedback h3')).toHaveText("THE TEACHER'S NOTES");
  await shot(page, 'paper-6-marked');
  await paper.locator('.paper-feedback').scrollIntoViewIfNeeded();
  await shot(page, 'paper-7-notes');
  await page.keyboard.press('e');
  await expect(paper).toBeHidden();
  expect(errors).toEqual([]);
});
