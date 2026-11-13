import { describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import { bootTestGame, placePlayer } from '../../game/testing';
import { MARK_S, WRITE_S } from './PaperSystem';

const ALL_LEVELS = ['recognise', 'understand', 'apply', 'analyse'] as const;
const BOTH = ['choice', 'true-false'] as const;

async function inHub() {
  const { game, logs, storage } = await bootTestGame();
  await game.newGame('researcher-male');
  await game.scenes.load('simlab-hub');
  return { game, logs, storage };
}

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.update(1 / 60);
};

/** The player before the counter, the teacher there, a conversation opened and on to his choices. */
function talkTo(game: Game) {
  const view = game.npcs.view('teacher')!;
  placePlayer(game, [view.x, 0, view.z + 2.4], 0, -0.25);
  frames(game, 0.05);
  expect(game.npcs.open('teacher')).toBe(true);
}

/** The paper he holds out, as a target for E or a click. */
const heldOut = (game: Game) => `${game.npcs.targetOf('teacher')}/paper`;

/** Takes the paper he holds out: the hand acted out, then his line (the conversation he opens). */
function takeIt(game: Game) {
  expect(game.interaction.primaryAction(heldOut(game))?.id).toBe('take-paper');
  expect(game.interaction.perform(heldOut(game), 'take-paper')).toBe(true);
  expect(game.actions.current?.sequence.id).toBe('take-paper');
  for (let i = 0; i < 60 * 4 && !game.npcs.say; i++) game.update(1 / 60);
}

describe('the hub teacher’s tests (PaperSystem, Phase Y-5)', () => {
  it('writes one on a paper at his desk, holds it out, marks it in red, gives it back', async () => {
    const { game, logs } = await inHub();
    const ready: string[] = [];
    game.events.subscribe('PaperReady', ({ text }) => ready.push(text));
    talkTo(game);
    game.npcs.advance();
    expect(game.npcs.pick('give-test')).toBeNull();
    expect(game.npcs.script?.form).toBe('test-setup');
    expect(game.npcs.say?.text).toMatch(/Which simulations/);
    await game.loadQuestions();
    expect(game.papers.banksReady).toBe(true);
    // The form knows how many questions there are for a choice.
    const request = {
      experiments: ['free-fall', 'ohms-law'],
      count: 6,
      types: [...BOTH],
      levels: [...ALL_LEVELS],
    };
    expect(game.papers.available(request)).toBe(6);
    expect(game.papers.available({ ...request, levels: ['analyse'], count: 40 })).toBe(10);

    // Asked: he goes to write it — the conversation ends, the game goes on.
    expect(game.papers.request('teacher', request)).toBeNull();
    expect(game.npcs.say?.text).toMatch(/write it at my desk/);
    game.npcs.advance();
    expect(game.state.session.conversation ?? null).toBeNull();
    expect(game.npcs.mode('teacher')).toBe('errand');
    // Talked to meanwhile, he is busy.
    frames(game, 2);
    expect(game.npcs.open('teacher')).toBe(true);
    expect(game.npcs.say?.text).toMatch(/Still writing/);
    game.npcs.advance();
    // He writes on a paper on his desk with a blue pen, his progress shown, then calls.
    const view = game.npcs.view('teacher')!;
    let seen = 0;
    let onDesk = false;
    for (let i = 0; i < 60 * (WRITE_S + 8) && ready.length === 0; i++) {
      game.update(1 / 60);
      seen = Math.max(seen, view.progress ?? 0);
      onDesk ||= view.paper === 'desk' && view.pen === 'blue';
    }
    expect(ready).toEqual(['Your test is ready — come and get it!']);
    expect(onDesk).toBe(true);
    expect(seen).toBeGreaterThan(0.95); // the frame it reaches 1, the job is done and the bar goes
    // He holds it out, in his hand: a target for E, or a click.
    expect(view.progress ?? null).toBeNull();
    expect(view.paper).toBe('hand');
    expect(view.pen).toBe('none');
    expect(game.state.progression.papers).toEqual([]); // not the player's yet
    expect(game.interaction.primaryAction(heldOut(game))?.click).toBe(true);
    // Talked to meanwhile: take it from his hand.
    talkTo(game);
    expect(game.npcs.say?.text).toMatch(/take it from my hand/);
    game.npcs.advance();

    // Taken: the hand reaches it, and as it grips, the paper is in the bag (chosen in the hotbar).
    takeIt(game);
    expect(game.npcs.say?.text).toMatch(/^Here you are/);
    game.npcs.advance();
    expect(view.paper).toBe('none');
    expect(game.npcs.mode('teacher')).toBe('day');
    const paper = game.state.progression.papers[0]!;
    expect(paper.id).toBe('paper-1');
    expect(paper.number).toBe(1);
    expect(paper.items).toHaveLength(6);
    expect(new Set(paper.items.map((i) => i.experiment))).toEqual(
      new Set(['free-fall', 'ohms-law']),
    );
    // Choice questions first (part I), then true/false (part II).
    const kinds = paper.items.map((i) => (i.order.length > 0 ? 'choice' : 'true-false'));
    expect(kinds).toEqual([...kinds].sort());
    expect(game.inventory.at(game.inventory.selected)?.placements).toEqual(['paper-1']);
    expect(game.papers.chosen?.id).toBe('paper-1');
    // It stays in the bag: never taken out into the world.
    expect(game.inventory.takeOut(game.inventory.selected)).toBe(false);

    // Held up and done: each question answered right, one choice changed first (crossed out).
    await game.papers.read('paper-1');
    expect(game.state.session.paper).toBe('paper-1');
    paper.items.forEach((item, i) => {
      const q = game.papers.question(item)!;
      if (q.type === 'choice') {
        const right = item.order.findIndex((k) => q.options[k]!.correct);
        if (i === 0) game.papers.answer('paper-1', i, (right + 1) % 4);
        expect(game.papers.answer('paper-1', i, right)).toBe(true);
      } else {
        q.statements.forEach((s, k) => game.papers.answer('paper-1', i, s.true, k));
      }
    });
    expect(paper.crossed[0]).toHaveLength(1);
    expect(game.papers.closePaper()).toBe(true);

    // Handed in: E (or a click) on him with the paper chosen. The hand gives it; as it lets go,
    // it is his — out of the bag.
    talkTo(game);
    game.npcs.close();
    const teacher = game.npcs.targetOf('teacher')!;
    expect(game.interaction.primaryAction(teacher)?.id).toBe('hand-in');
    expect(game.interaction.primaryAction(teacher)?.click).toBe(true);
    const handedIn: string[] = [];
    game.events.subscribe('PaperHandedIn', ({ text }) => handedIn.push(text));
    expect(game.interaction.perform(teacher, 'hand-in')).toBe(true);
    expect(game.actions.current?.sequence.id).toBe('give-paper');
    for (let i = 0; i < 60 * 4 && handedIn.length === 0; i++) game.update(1 / 60);
    expect(handedIn).toEqual(['Thank you! Let me mark it…']);
    expect(game.inventory.holds('paper-1')).toBe(false);
    expect(view.paper).toBe('hand');
    // He marks it at his desk in red, then holds it out again.
    let red = false;
    for (let i = 0; i < 60 * (MARK_S + 10) && ready.length < 2; i++) {
      game.update(1 / 60);
      red ||= view.paper === 'desk' && view.pen === 'red';
    }
    expect(red).toBe(true);
    expect(ready[1]).toBe("I've marked your test — come and get it!");
    expect(paper.marked?.score).toBe(10);
    expect(game.state.progression.scores).toEqual([
      expect.objectContaining({ paper: 1, score: 10, experiments: ['free-fall', 'ohms-law'] }),
    ]);
    expect(view.paper).toBe('hand');
    // Taken back: he says the mark.
    takeIt(game);
    expect(game.npcs.say?.text).toBe(
      "You scored 10 out of 10. I've written on the sheet what went well and what to work on.",
    );
    game.npcs.advance();
    expect(game.inventory.holds('paper-1')).toBe(true);
    // Marked, no answer changes any more; the sheet's grade is the same.
    expect(game.papers.answer('paper-1', 0, 0)).toBe(false);
    expect(game.papers.grade('paper-1')?.score).toBe(10);

    // Thrown away: out of the bag; the mark stays.
    expect(game.papers.discard('paper-1')).toBe(true);
    expect(game.state.progression.papers).toEqual([]);
    expect(game.inventory.at(game.inventory.selected)).toBeNull();
    expect(game.state.progression.scores).toHaveLength(1);
    expect(logs.filter((l) => l.level === 'error' || l.level === 'warn')).toEqual([]);
  }, 60_000);

  it('a paper with nothing answered is handed back; no questions for a mix: choose again', async () => {
    const { game } = await inHub();
    talkTo(game);
    game.npcs.advance();
    game.npcs.pick('give-test');
    await game.loadQuestions();
    const none = game.papers.request('teacher', {
      experiments: ['nowhere'],
      count: 5,
      types: [...BOTH],
      levels: [...ALL_LEVELS],
    });
    expect(none).toMatch(/No question/);
    expect(game.npcs.say?.text).toMatch(/no questions for that mix/);
    game.npcs.advance();
    expect(game.npcs.script?.form).toBe('test-setup'); // back to the form
    game.papers.request('teacher', {
      experiments: ['pendulum'],
      count: 3,
      types: ['choice'],
      levels: [...ALL_LEVELS],
    });
    game.npcs.advance();
    frames(game, WRITE_S + 8);
    talkTo(game);
    game.npcs.advance();
    takeIt(game);
    game.npcs.advance();
    const teacher = game.npcs.targetOf('teacher')!;
    game.interaction.perform(teacher, 'hand-in');
    expect(game.npcs.say?.text).toMatch(/haven't answered anything/);
    expect(game.state.progression.papers[0]?.marked).toBeNull();
    expect(game.inventory.holds('paper-1')).toBe(true); // still the player's
  }, 60_000);

  it('a paper he still had when the game was saved is held out again after a load', async () => {
    const { game, storage } = await inHub();
    talkTo(game);
    game.npcs.advance();
    game.npcs.pick('give-test');
    await game.loadQuestions();
    game.papers.request('teacher', {
      experiments: ['pendulum'],
      count: 3,
      types: ['choice'],
      levels: [...ALL_LEVELS],
    });
    game.npcs.advance();
    frames(game, WRITE_S + 8);
    takeIt(game);
    game.npcs.advance();
    game.papers.answer('paper-1', 0, 0);
    const teacher = game.npcs.targetOf('teacher')!;
    game.interaction.perform(teacher, 'hand-in');
    frames(game, 2); // in his hand, on his way to mark it
    expect(game.inventory.holds('paper-1')).toBe(false);
    expect(game.save()?.ok).toBe(true);

    const { game: again } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    await again.loadQuestions();
    frames(again, 10);
    const view = again.npcs.view('teacher')!;
    expect(view.paper).toBe('hand');
    expect(again.state.progression.papers[0]?.marked).not.toBeNull();
    expect(again.interaction.primaryAction(heldOut(again))?.id).toBe('take-paper');
  }, 60_000);
});
