import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, flush, placePlayer } from '../../game/testing';
import { figures } from '../../simulation/workedExample';
import { handPoint } from '../action/handPoint';

const TEACHER = 'simlab-hub/teacher';

async function inHub() {
  const { game, logs } = await bootTestGame();
  await game.newGame('researcher-male');
  await game.scenes.load('simlab-hub');
  return { game, logs };
}

/** The conversation's stage now (read afresh: not narrowed by an earlier check). */
const stage = (game: Game): string | undefined => game.state.session.conversation?.stage;

const frames = (game: Game, n: number, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) game.update(dt);
};

/** Stands the player 1.5 m in front of the teacher, looking at his chest, and lets a frame pass. */
function faceTeacher(game: Game) {
  const view = game.npcs.view('teacher');
  if (!view) throw new Error('no teacher');
  // He stands at the counter facing +z: the player 1.5 m in front of it, on the other side.
  placePlayer(game, [view.x, 0, view.z + 2.4], 0, -0.25);
  frames(game, 2);
}

describe('the hub teacher (NpcSystem)', () => {
  it('stands at the counter at first, has a body and can be talked to with E', async () => {
    const { game, logs } = await inHub();
    frames(game, 2);
    const view = game.npcs.view('teacher');
    expect(view).not.toBeNull();
    expect(Math.hypot((view?.x ?? 0) - 0, (view?.z ?? 0) + 8.4)).toBeLessThan(0.2);
    expect(game.physics.stats().bodies).toBeGreaterThan(0);
    faceTeacher(game);
    expect(game.interaction.focused?.id).toBe(TEACHER);
    expect(game.interaction.focused?.displayName).toBe('Mr. Quang');
    expect(logs.filter((l) => l.level === 'error')).toEqual([]);
  });

  it('greets, offers his choices (planned ones disabled), says goodbye and lets the player go', async () => {
    const { game } = await inHub();
    faceTeacher(game);
    const seen: (keyof GameEvents)[] = [];
    for (const type of [
      'ConversationOpened',
      'ConversationChanged',
      'ConversationClosed',
    ] as const) {
      game.events.subscribe(type, () => seen.push(type));
    }
    expect(game.npcs.open('teacher')).toBe(true);
    expect(game.state.session.conversation).toEqual({
      npcId: 'teacher',
      stage: 'greeting',
      line: 0,
    });
    expect(game.npcs.line?.text).toMatch(/Mr\. Quang/);
    expect(game.npcs.open('teacher')).toBe(false); // one at a time

    // The player stands still; the teacher stops and talks.
    const before = [...game.state.player.position];
    game.input.press('moveForward');
    frames(game, 30);
    game.input.release('moveForward');
    expect(game.state.player.position).toEqual(before);
    expect(game.npcs.view('teacher')?.gesture).toBe('talk');

    game.npcs.advance();
    expect(game.state.session.conversation?.stage).toBe('menu');
    const options = game.npcs.talkingWith?.options ?? [];
    expect(options.map((o) => o.id)).toEqual(['explain-simulation', 'solve-problem', 'give-test']);
    // Explaining a simulation (Y-2) and tests (Y-5) are built; helping with a problem is not yet.
    expect(options.map((o) => game.npcs.available(o))).toEqual([true, false, true]);
    expect(game.npcs.choices.map((c) => [c.id, c.enabled])).toEqual([
      ['explain-simulation', true],
      ['solve-problem', false],
      ['give-test', true],
      ['goodbye', true],
    ]);
    for (const option of options.slice(1, 2)) {
      expect(game.npcs.choose(option.id)).toMatch(/Coming soon/);
    }
    expect(game.state.session.conversation?.stage).toBe('menu');

    game.npcs.goodbye();
    expect(game.state.session.conversation?.stage).toBe('farewell');
    game.npcs.advance();
    expect(game.state.session.conversation ?? null).toBeNull();
    expect(seen).toEqual([
      'ConversationOpened',
      'ConversationChanged',
      'ConversationChanged',
      'ConversationClosed',
    ]);

    // A second visit: another greeting.
    expect(game.npcs.open('teacher')).toBe(true);
    expect(game.state.session.conversation?.line).toBe(1);
  });

  it('turns the talking player towards him, and holds his day until the talk ends', async () => {
    const { game } = await inHub();
    faceTeacher(game);
    game.state.player.yaw = 2; // looking away
    game.npcs.open('teacher');
    frames(game, 120);
    const view = game.npcs.view('teacher');
    const [px, , pz] = game.state.player.position;
    const towards = Math.atan2(-((view?.x ?? 0) - px), -((view?.z ?? 0) - pz));
    const off = Math.atan2(
      Math.sin(game.state.player.yaw - towards),
      Math.cos(game.state.player.yaw - towards),
    );
    expect(Math.abs(off + 0.15)).toBeLessThan(0.02); // he stands just left of the choices, still in aim
    // Five minutes of talk: he is still there.
    frames(game, 60 * 300, 1 / 60);
    expect(Math.hypot((view?.x ?? 0) - 0, (view?.z ?? 0) + 8.4)).toBeLessThan(0.2);
    game.npcs.close();
    // His day goes on: within a few minutes he has left the counter.
    let left = false;
    for (let i = 0; i < 60 * 200 && !left; i++) {
      game.update(1 / 60);
      left = Math.hypot((view?.x ?? 0) - 0, (view?.z ?? 0) + 8.4) > 1;
    }
    expect(left).toBe(true);
  });

  it('waits when the player stands in his way', async () => {
    const { game } = await inHub();
    const view = game.npcs.view('teacher');
    // Run the day until he walks, then stand right in front of him.
    for (let i = 0; i < 60 * 120 && !(view && view.speed > 0); i++) game.update(1 / 60);
    expect(view?.speed).toBeGreaterThan(0);
    const heading = view?.heading ?? 0;
    placePlayer(game, [
      (view?.x ?? 0) - Math.sin(heading) * 0.5,
      0,
      (view?.z ?? 0) - Math.cos(heading) * 0.5,
    ]);
    const at = [view?.x, view?.z];
    frames(game, 60);
    expect([view?.x, view?.z]).toEqual(at);
    expect(view?.speed).toBe(0);
  });

  it('says everything in Vietnamese too', async () => {
    const { game } = await inHub();
    for (const npc of game.content.npcs.all()) {
      const lesson = npc.lesson;
      const texts = [
        npc,
        ...npc.greetings,
        ...npc.farewells,
        ...npc.options,
        ...(lesson
          ? [
              lesson.ask,
              lesson.waiting,
              lesson.cancel,
              lesson.intro,
              lesson.part,
              lesson.outro,
              lesson.thanks,
              ...Object.values(lesson.choices),
            ]
          : []),
      ];
      for (const t of texts) {
        const own = t.vi as Record<string, string> | undefined;
        const english = Object.entries(t).filter(
          ([k, v]) => ['title', 'text', 'label'].includes(k) && typeof v === 'string',
        );
        for (const [field] of english) expect(own?.[field], `${npc.id}: ${field}`).toBeTruthy();
      }
    }
  });

  it('stands where his scene is in the session frame (the hub entered from a neighbour)', async () => {
    const { game } = await inHub();
    frames(game, 2);
    const view = game.npcs.view('teacher');
    const offset = vi.spyOn(game.scenes, 'offsetOf').mockReturnValue([5, 0, -2]);
    frames(game, 1);
    // His target for E (the interaction's box) is at his place plus the offset.
    placePlayer(game, [(view?.x ?? 0) + 5, 0, (view?.z ?? 0) - 2 + 2.4], 0, -0.25);
    frames(game, 2);
    expect(game.interaction.focused?.id).toBe(TEACHER);
    offset.mockRestore();
  });

  it('explains a simulation: follows the player into a lab, lectures at it, walks back', async () => {
    const { game, logs } = await inHub();
    faceTeacher(game);
    game.npcs.open('teacher');
    game.npcs.advance();
    expect(game.npcs.pick('explain-simulation')).toBeNull();
    expect(game.state.session.conversation?.stage).toBe('ask');
    expect(game.npcs.say?.text).toMatch(/Which simulation/);
    expect(game.npcs.choices).toEqual([]);
    game.npcs.advance(); // "Lead the way": the talk ends and he follows
    expect(game.state.session.conversation ?? null).toBeNull();
    expect(game.npcs.mode('teacher')).toBe('follow');

    // Across the hall: he comes round the counter after the player and stops near them.
    const view = game.npcs.view('teacher');
    placePlayer(game, [0, 0, -3]);
    frames(game, 60 * 12);
    const near = () => {
      const [px, , pz] = game.state.player.position;
      const o = game.scenes.offsetOf(view?.sceneId ?? '') ?? [0, 0, 0];
      return Math.hypot((view?.x ?? 0) + o[0] - px, (view?.z ?? 0) + o[2] - pz);
    };
    expect(near()).toBeGreaterThan(1.2);
    expect(near()).toBeLessThan(2.2);

    // Into the Physics Lab (the hall out of residence): he comes in through its door.
    await game.scenes.load('physics-lab');
    frames(game, 60 * 10);
    expect(view?.sceneId).toBe('physics-lab');
    expect(near()).toBeLessThan(2.2);
    expect(game.npcs.mode('teacher')).toBe('follow');

    // E on the drop tower (or a part of it) asks him to explain it.
    const offered = game.interaction.primaryAction('physics-lab/dial-height');
    expect(offered?.id).toBe('ask-npc');
    expect(offered?.label).toBe('Ask Mr. Quang to explain this');
    // Following, it is the experiment's only action (Phú 2026-11-10): its own wait, and H too.
    expect(game.interaction.secondaryAction('physics-lab/dial-height')).toBeNull();
    const height = game.stations.view('physics-lab/tower')?.session.parameters;
    const before = { ...height };
    expect(game.interaction.perform('physics-lab/dial-height', 'raise')).toBe(false);
    expect(game.stations.view('physics-lab/tower')?.session.parameters).toEqual(before);
    expect(game.explain.aimed()).toBeNull();
    const blocked: string[] = [];
    game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
    game.input.press('explain');
    game.update(1 / 60);
    game.input.release('explain');
    expect(game.state.session.explain ?? null).toBeNull();
    expect(blocked.at(-1)).toMatch(/press E to ask/);
    expect(game.interaction.perform('physics-lab/tower', 'ask-npc')).toBe(true);
    expect(game.state.session.explain).toEqual({ stationId: 'physics-lab/tower', step: 0 });
    expect(game.state.session.conversation).toEqual({
      npcId: 'teacher',
      stage: 'lecture',
      line: 0,
      stationId: 'physics-lab/tower',
    });
    expect(game.npcs.say?.text).toMatch(/Free fall/i);

    // He walks to stand beside it; the lecture: the experiment, each part (he points at it), each
    // step of the principle (the Explain view shows it).
    frames(game, 60 * 6);
    expect(game.npcs.mode('teacher')).toBe('lecture');
    expect(view?.speed).toBe(0);
    const explain = game.explain.explain;
    const parts = explain?.parts ?? [];
    const steps = explain?.steps ?? [];
    game.npcs.advance(); // the summary
    expect(game.npcs.say?.text).toBe(explain?.summary);
    for (const part of parts) {
      game.npcs.advance();
      expect(game.npcs.say?.parts).toEqual([part.id]);
      expect(game.npcs.say?.text).toBe(`${part.name} — ${part.role}`);
      frames(game, 1);
      expect(view?.point).toBe(part.id);
    }
    for (let i = 0; i < steps.length; i++) {
      game.npcs.advance();
      expect(game.npcs.say?.text).toBe(steps[i]?.text);
      expect(game.state.session.explain?.step).toBe(i);
    }
    game.npcs.advance();
    expect(game.state.session.conversation?.stage).toBe('board');
    // The board is offered (Y-3): free fall has worked examples and the lab a board.
    expect(game.npcs.choices.map((c) => [c.id, c.enabled])).toEqual([
      ['board', true],
      ['no-board', true],
    ]);
    expect(game.npcs.pick('no-board')).toBeNull();
    expect(game.state.session.explain ?? null).toBeNull();
    expect(game.state.session.conversation?.stage).toBe('thanks');
    game.npcs.advance();
    expect(game.state.session.conversation ?? null).toBeNull();
    expect(game.npcs.mode('teacher')).toBe('return');

    // Back to his day in the hall.
    for (let i = 0; i < 60 * 60 && game.npcs.mode('teacher') !== 'day'; i++) game.update(1 / 60);
    expect(game.npcs.mode('teacher')).toBe('day');
    expect(view?.sceneId).toBe('simlab-hub');
    expect(logs.filter((l) => l.level === 'error' || l.level === 'warn')).toEqual([]);
  });

  it('talked to while following: goes on following, or gives up and walks back', async () => {
    const { game } = await inHub();
    faceTeacher(game);
    game.npcs.open('teacher');
    game.npcs.advance();
    game.npcs.pick('explain-simulation');
    game.npcs.advance();
    // Nothing to explain here: no offer on things that are not a station's.
    expect(game.interaction.primaryAction(TEACHER)?.id).toBe('talk');
    expect(game.npcs.open('teacher')).toBe(true);
    expect(game.state.session.conversation?.stage).toBe('waiting');
    expect(game.npcs.choices.map((c) => c.id)).toEqual(['keep-going', 'never']);
    game.npcs.pick('keep-going');
    expect(game.state.session.conversation ?? null).toBeNull();
    expect(game.npcs.mode('teacher')).toBe('follow');
    game.npcs.open('teacher');
    game.npcs.pick('never');
    expect(game.state.session.conversation?.stage).toBe('cancel');
    game.npcs.advance();
    expect(game.npcs.mode('teacher')).toBe('return');
  });

  it('at a shut door he taps his card on its reader, then walks through once it is open', async () => {
    const { game, logs } = await inHub();
    await game.scenes.load('physics-lab');
    frames(game, 2);
    const view = game.npcs.view('teacher');
    const door = 'physics-lab/door-hub';
    expect(game.doors.state(door)).toBe('closed');
    // Walking back from a lecture in the lab (the player stays there).
    game.npcs.lectureAt('teacher', 'physics-lab/tower');
    frames(game, 60 * 5);
    game.explain.close();
    expect(game.npcs.mode('teacher')).toBe('return');
    const asked: string[] = [];
    const steps: string[] = [];
    game.events.subscribe('DoorRequested', ({ entityId }) => asked.push(entityId));
    game.events.subscribe('NpcFootstep', ({ npcId, foot }) => steps.push(`${npcId} ${foot}`));
    let carded = false;
    let reached = false;
    for (let i = 0; i < 60 * 30 && asked.length === 0; i++) {
      game.update(1 / 60);
      carded ||= view?.card ?? false;
      reached ||= view?.reaching ?? false;
    }
    // At the reader, the card in his hand held to it: the door asked to open, once.
    expect(asked).toEqual([door]);
    expect(carded).toBe(true);
    expect(reached).toBe(true);
    const reader = handPoint(game.world.entity(door)!, game.world, [0, 0, 0]);
    expect(Math.hypot((view?.x ?? 0) - reader[0], (view?.z ?? 0) - reader[2])).toBeLessThan(0.7);
    // He walked there, his feet heard.
    expect(steps.length).toBeGreaterThan(4);
    expect(steps.every((s) => s.startsWith('teacher '))).toBe(true);
    // The door opens (the hall attached), he goes through and home to his day.
    for (let i = 0; i < 60 * 30 && game.npcs.mode('teacher') !== 'day'; i++) {
      game.update(1 / 60);
      if (i % 15 === 0) await flush();
    }
    expect(asked).toEqual([door]); // one tap was enough
    expect(game.npcs.mode('teacher')).toBe('day');
    expect(view?.sceneId).toBe('simlab-hub');
    expect(logs.filter((l) => l.level === 'error' || l.level === 'warn')).toEqual([]);
  }, 20_000);

  it('walks straight through a door that is already open', async () => {
    const { game } = await inHub();
    await game.scenes.load('physics-lab');
    frames(game, 2);
    const door = 'physics-lab/door-hub';
    // The player opens it and stays by it.
    const [x, , z] = game.world.entity(door)!.pose.position;
    placePlayer(game, [x + 1.2, 0, z], Math.PI / 2);
    frames(game, 2);
    expect(game.interaction.perform(door, 'travel')).toBe(true);
    for (let i = 0; i < 60 * 5 && game.doors.state(door) !== 'open'; i++) {
      game.update(1 / 60);
      if (i % 15 === 0) await flush();
    }
    expect(game.doors.state(door)).toBe('open');
    const asked: string[] = [];
    game.events.subscribe('DoorRequested', ({ entityId }) => asked.push(entityId));
    game.npcs.lectureAt('teacher', 'physics-lab/tower');
    frames(game, 60 * 5);
    game.explain.close();
    const view = game.npcs.view('teacher');
    let carded = false;
    for (let i = 0; i < 60 * 20 && view?.sceneId !== 'simlab-hub'; i++) {
      game.update(1 / 60);
      carded ||= view?.card ?? false;
      if (i % 15 === 0) await flush();
    }
    expect(view?.sceneId).toBe('simlab-hub');
    expect(asked).toEqual([]); // no card: it was open
    expect(carded).toBe(false);
  }, 20_000);

  it('never takes the clean area entrance: following the player out, he waits inside', async () => {
    const { game } = await inHub();
    frames(game, 2);
    faceTeacher(game);
    game.npcs.open('teacher');
    game.npcs.advance();
    game.npcs.pick('explain-simulation');
    game.npcs.advance();
    await game.scenes.load('preparation-room');
    frames(game, 60 * 5);
    const view = game.npcs.view('teacher');
    expect(view?.sceneId).toBe('simlab-hub');
    expect(game.npcs.mode('teacher')).toBe('follow');
  });

  it('works an example on the lab’s board: writes it line by line, the answer the model’s', async () => {
    const { game, logs } = await inHub();
    await game.scenes.load('physics-lab');
    frames(game, 2);
    const view = game.npcs.view('teacher')!;
    const board = game.npcs.board;
    game.npcs.lectureAt('teacher', 'physics-lab/tower');
    for (let i = 0; i < 40 && game.state.session.conversation?.stage === 'lecture'; i++) {
      game.npcs.advance();
    }
    expect(game.state.session.conversation?.stage).toBe('board');
    expect(game.npcs.choices.map((c) => [c.id, c.enabled])).toEqual([
      ['board', true],
      ['no-board', true],
    ]);
    expect(game.npcs.pick('board')).toBeNull();
    expect(game.state.session.conversation).toEqual({ npcId: 'teacher', stage: 'lesson', line: 0 });
    expect(game.state.session.explain ?? null).toBeNull(); // the board instead
    expect(game.npcs.boardFramed).toBe('physics-lab/whiteboard');
    // The board wiped and the example laid out: title, given, asked, each formula, the answer.
    const freeFall = game.stations.view('physics-lab/tower')!.definition;
    const t = Math.sqrt((2 * 2) / 1.62);
    expect(board.boardId).toBe('physics-lab/whiteboard');
    expect(board.lines[0]).toBe('Example 1 · Free fall');
    expect(board.lines[1]).toBe('Given: h = 2 m; g = 1.62 m/s²');
    expect(board.lines.at(-1)).toBe(
      `Answer: t = ${figures(t, 3)} s; v = ${figures(-1.62 * t, 3)} m/s`,
    );
    expect(board.lines).toHaveLength(3 + freeFall.examples[0]!.steps.length + 1);
    expect(board.shown.every((n) => n === 0)).toBe(true);
    expect(game.npcs.say?.text).toMatch(/^On the Moon/);

    // He walks to the board and writes the title, his hand at the pen on the board's face.
    const whiteboard = game.world.entity('physics-lab/whiteboard')!;
    let reached = 0;
    for (let i = 0; i < 60 * 12 && (board.shown[0] ?? 0) < board.lines[0]!.length; i++) {
      game.update(1 / 60);
      if (view.reaching) {
        reached++;
        // On its writing face: the board hangs on the wall at x −4.97 facing +x; the white board is
        // 13 mm behind its box's middle (the frame stands in front of it).
        expect(Math.abs(view.reachX - (whiteboard.pose.position[0] - 0.013))).toBeLessThan(0.002);
        expect(view.reachY).toBeGreaterThan(whiteboard.pose.position[1] - 0.45);
        expect(view.reachY).toBeLessThan(whiteboard.pose.position[1] + 0.45);
      }
    }
    expect(board.shown[0]).toBe(board.lines[0]!.length);
    expect(reached).toBeGreaterThan(30);
    expect(board.shown.slice(1).every((n) => n === 0)).toBe(true); // only what was said so far
    frames(game, 60 * 3);
    expect(view.gesture).toBe('talk'); // stepped aside to talk

    // On: each line said writes its own; pressing on writes the rest at once.
    while (stage(game) === 'lesson') game.npcs.advance();
    expect(game.state.session.conversation?.stage).toBe('lesson-end');
    expect(board.shown).toEqual(board.lines.map((l) => l.length));
    expect(game.npcs.say?.text).toBe('Shall we do another one?');
    expect(game.npcs.choices.map((c) => c.id)).toEqual(['another', 'enough']);
    // Another: the board wiped for the second example.
    expect(game.npcs.pick('another')).toBeNull();
    expect(board.lines[0]).toBe('Example 2 · Free fall');
    expect(board.shown.every((n) => n === 0)).toBe(true);
    while (stage(game) === 'lesson') game.npcs.advance();
    expect(game.npcs.say?.text).toMatch(/last example/); // free fall has two
    expect(game.npcs.choices.map((c) => c.id)).toEqual(['enough']);
    game.npcs.pick('enough');
    expect(game.state.session.conversation?.stage).toBe('thanks');
    game.npcs.advance();
    expect(game.npcs.mode('teacher')).toBe('return');
    expect(game.npcs.boardFramed).toBeNull();
    expect(board.lines[0]).toBe('Example 2 · Free fall'); // the board keeps what is written
    expect(logs.filter((l) => l.level === 'error' || l.level === 'warn')).toEqual([]);
  }, 20_000);

  it('ends a lecture when the Explain view is closed (Esc, H): he walks back', async () => {
    const { game } = await inHub();
    await game.scenes.load('physics-lab');
    frames(game, 2);
    expect(game.npcs.lectureAt('teacher', 'physics-lab/tower')).toBe(true);
    expect(game.npcs.mode('teacher')).toBe('lecture');
    game.explain.close();
    expect(game.state.session.conversation ?? null).toBeNull();
    expect(game.npcs.mode('teacher')).toBe('return');
  });

  it('is not there out of his scene: no target, no body', async () => {
    const { game } = await inHub();
    frames(game, 2);
    await game.scenes.load('physics-lab');
    frames(game, 2);
    expect(game.interaction.focused?.id ?? null).not.toBe(TEACHER);
    expect(game.npcs.open('teacher')).toBe(false);
  });
});
