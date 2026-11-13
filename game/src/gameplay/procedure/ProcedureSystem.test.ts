import { describe, expect, it } from 'vitest';
import type { GameEvents } from '../../game/GameEvents';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import { bootTestGame, flush, lookAt, placePlayer, untilIdle } from '../../game/testing';
import { MemorySaveStorage } from '../../persistence/SaveSystem';
import { arrivalPose } from '../../world/arrival';
import { entityFromPlacement } from '../../world/World';

const H = 1 / 60;
const ID = 'cleanroom-entry';
const PREP = 'preparation-room';
const HALL = 'cleanroom-corridor';
const BASIN: Vec3 = [-1.25, 0.9, -7.6]; // top of the hand-wash basin
const AT_BASIN: Vec3 = [-0.69, 0, -7.6]; // where the player stands to use the basin wall

async function start() {
  const booted = await bootTestGame();
  const { game } = booted;
  await game.newGame('researcher-female');
  const blocked: string[] = [];
  const events: string[] = [];
  game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  game.events.subscribe('ProcedureStepCancelled', (e) => events.push(`cancelled:${e.stepId}`));
  game.events.subscribe('ProcedureReady', () => events.push('ready'));
  game.events.subscribe('ProcedureEntered', () => events.push('entered'));
  return { ...booted, game, blocked, events };
}

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};

/** Stands at `from` looking at `target` until the interaction focus settles on `id`. */
function face(game: Game, from: Vec3, target: Vec3, id: string) {
  placePlayer(game, from);
  lookAt(game, target);
  game.update(H);
  expect(game.interaction.focused?.id).toBe(id);
}

const view = (game: Game) => game.procedures.view(ID);
const stepId = (game: Game) => view(game).step?.id ?? null;
/** Performs an action as a player does: acted out to its end (it takes effect once the hand is there). */
const act = (game: Game, entity: string, action: string) => {
  const done = game.interaction.perform(entity, action);
  untilIdle(game);
  return done;
};

/**
 * Walks through a door as a player does: 1.5 m in front of it, facing it (setup), opens it, waits
 * until it stands open, walks through and on, and waits until it has closed behind and the scene
 * left is gone. `beforeWalk` runs once it is open, before the first step.
 */
async function walkThrough(game: Game, door: string, beforeWalk?: () => void) {
  const [roomId, id] = door.split('/') as [string, string];
  const room = game.content.rooms.get(roomId);
  const placement = room.placements.find((p) => p.id === id)!;
  const pose = arrivalPose(room, placement);
  if (typeof pose === 'string') throw new Error(pose);
  const [x, , z] = placement.position;
  const [nx, nz] = [pose.position[0] - x, pose.position[2] - z];
  const [ox, , oz] = game.scenes.origin;
  placePlayer(game, [x + 1.5 * nx + ox, 0, z + 1.5 * nz + oz], Math.atan2(nx, nz));
  frames(game, 0.1);
  expect(act(game, door, 'travel')).toBe(true);
  untilIdle(game); // the key card on the reader: the door asked to open
  await flush();
  for (let i = 0; i < 120 && game.doors.state(door) !== 'open'; i++) game.update(H);
  expect(game.doors.state(door)).toBe('open');
  beforeWalk?.();
  untilIdle(game); // an action acted out (the coat taken off) ends before the first step
  game.input.press('moveForward');
  frames(game, 2); // 4.4 m: through the doorway and some 2.9 m on
  game.input.release('moveForward');
  for (let i = 0; i < 300 && game.scenes.residentIds.length > 1; i++) game.update(H);
  expect(game.scenes.residentIds).toEqual([game.state.session.sceneId]);
  expect(game.doors.state(door)).toBe('closed');
}

/** A timed step at the basin: look at it, press, keep looking for `seconds`. */
function rub(game: Game, seconds = 2) {
  face(game, AT_BASIN, BASIN, `${HALL}/wash-basin`);
  expect(act(game, `${HALL}/wash-basin`, 'wash')).toBe(true);
  frames(game, seconds + H);
}

/** Every step from `from` up to (not including) `until`, done the right way. */
function doSteps(game: Game, until: string | null = null, from = 'read-rules') {
  const steps: [string, () => void][] = [
    ['read-rules', () => act(game, `${PREP}/notice-board`, 'inspect')],
    [
      'lab-coat',
      () => {
        act(game, `${PREP}/wardrobe`, 'open');
        act(game, `${PREP}/lab-coat`, 'wear');
      },
    ],
    ['goggles', () => act(game, `${PREP}/safety-goggles`, 'wear')],
    ['water-on', () => act(game, `${HALL}/faucet`, 'water-on')],
    ['wet-hands', () => act(game, `${HALL}/wash-basin`, 'wash')],
    ['take-soap', () => act(game, `${HALL}/soap-dispenser`, 'take-soap')],
    ['rub-palms', () => rub(game)],
    ['rub-backs', () => rub(game)],
    ['rub-fingers', () => rub(game)],
    ['rub-thumbs', () => rub(game)],
    ['rinse', () => act(game, `${HALL}/wash-basin`, 'wash')],
    ['water-off', () => act(game, `${HALL}/faucet`, 'water-off')],
    ['dry-hands', () => act(game, `${HALL}/paper-towels`, 'dry-hands')],
    [
      'sanitize',
      () => {
        face(game, [-0.69, 0, -8.6], [-1.45, 1.2, -8.6], `${HALL}/hand-sanitizer`);
        act(game, `${HALL}/hand-sanitizer`, 'sanitize');
        frames(game, 3 + H);
      },
    ],
    ['gloves', () => act(game, `${HALL}/glove-dispenser`, 'wear')],
  ];
  let started = false;
  for (const [id, run] of steps) {
    if (id === until) return;
    started ||= id === from;
    if (!started) continue;
    expect(stepId(game)).toBe(id);
    run();
  }
}

describe('cleanroom entry procedure', () => {
  it('starts not started, with the briefing as the first instruction', async () => {
    const { game } = await start();
    expect(game.procedures.activeProcedure()?.id).toBe(ID);
    expect(view(game)).toMatchObject({
      status: 'not-started',
      completed: 0,
      total: 15,
      stageLabel: 'Briefing',
      missingEquipment: ['lab-coat', 'safety-goggles', 'nitrile-gloves'],
      timer: null,
    });
    expect(view(game).step?.instruction).toMatch(/notice board/);
    expect(game.state.progression.procedures).toEqual({}); // reading never creates a record
  });

  it("outlines the next step's objects, no path: the notice board, the coat, the faucet…", async () => {
    const { game } = await start();
    const outlined = () => {
      frames(game, 0.3); // the guide looks again four times a second
      return [game.taskGuide.objects, game.taskGuide.path];
    };
    expect(outlined()).toEqual([[`${PREP}/notice-board`], []]);
    doSteps(game, 'lab-coat');
    expect(outlined()).toEqual([[`${PREP}/lab-coat`], []]);
    doSteps(game, 'water-on', 'lab-coat');
    expect(outlined()).toEqual([[`${HALL}/faucet`], []]);
    doSteps(game, 'rub-palms', 'water-on');
    expect(outlined()).toEqual([[`${HALL}/wash-basin`], []]);
    doSteps(game, 'sanitize', 'rub-palms');
    expect(outlined()).toEqual([[`${HALL}/hand-sanitizer`], []]);
    doSteps(game, null, 'sanitize');
    expect(outlined()).toEqual([[], []]); // done: nothing more to show
  });

  it('keeps the cleanroom door shut with the next instruction until the procedure is done', async () => {
    const { game, blocked } = await start();
    expect(act(game, `${HALL}/door-hub`, 'travel')).toBe(false);
    await flush();
    expect(game.state.session.sceneId).toBe(PREP);
    expect(blocked).toEqual([
      'Entry blocked. Next: Read the cleanroom entry rules on the notice board.',
    ]);
    // The HUD asks the same question before the player presses anything.
    const door = game.interaction.primaryAction(`${HALL}/door-hub`);
    expect(door && game.interaction.blockedReason(`${HALL}/door-hub`, door)).toMatch(
      /^Entry blocked/,
    );

    doSteps(game, 'gloves'); // everything except the gloves
    expect(act(game, `${HALL}/door-hub`, 'travel')).toBe(false);
    expect(blocked.at(-1)).toBe('Entry blocked. Next: Put on gloves from the glove dispenser.');
  });

  it('completes every step in order and then lets the player through, once', async () => {
    const { game, events } = await start();
    const completed: string[] = [];
    game.events.subscribe('ProcedureStepCompleted', ({ stepId }) => completed.push(stepId));
    doSteps(game);
    expect(completed).toEqual(view(game).definition.steps.map((s) => s.id));
    expect(view(game)).toMatchObject({ status: 'ready', step: null, missingEquipment: [] });
    expect(game.equipment.worn).toEqual(['lab-coat', 'safety-goggles', 'nitrile-gloves']);
    expect(events.filter((e) => e === 'ready')).toHaveLength(1);

    await walkThrough(game, `${HALL}/door-hub`, () => {
      // Open, not yet walked through: not entered.
      expect(game.state.progression.procedures[ID]?.entered).toBe(false);
      expect(events.at(-1)).toBe('ready');
    });
    expect(game.state.session.sceneId).toBe('simlab-hub');
    expect(game.state.progression.procedures[ID]?.entered).toBe(true);
    expect(view(game).status).toBe('entered');
    expect(events.at(-1)).toBe('entered');
  });

  it('refuses actions that come too early, with the step to do instead', async () => {
    const { game, blocked } = await start();
    // Gowning before the briefing, gloves before hand hygiene, washing before the water runs.
    act(game, `${PREP}/wardrobe`, 'open');
    expect(act(game, `${PREP}/lab-coat`, 'wear')).toBe(false);
    expect(act(game, `${HALL}/glove-dispenser`, 'wear')).toBe(false);
    expect(blocked).toEqual([
      'Not yet. Next: Read the cleanroom entry rules on the notice board.',
      'Not yet. Next: Read the cleanroom entry rules on the notice board.',
    ]);
    expect(game.equipment.worn).toEqual([]);

    doSteps(game, 'water-on');
    expect(act(game, `${HALL}/glove-dispenser`, 'wear')).toBe(false);
    expect(act(game, `${HALL}/wash-basin`, 'wash')).toBe(false);
    expect(act(game, `${HALL}/hand-sanitizer`, 'sanitize')).toBe(false);
    expect(blocked.slice(2)).toEqual(
      Array(3).fill('Not yet. Next: At the hand-wash basin in the corridor, turn on the water.'),
    );
    expect(stepId(game)).toBe('water-on'); // refused actions changed nothing

    // Soap before wet hands; rubbing (another wash) before soap.
    act(game, `${HALL}/faucet`, 'water-on');
    expect(act(game, `${HALL}/soap-dispenser`, 'take-soap')).toBe(false);
    expect(blocked.at(-1)).toBe('Not yet. Next: Wet your hands under the running water.');
    act(game, `${HALL}/wash-basin`, 'wash');
    expect(act(game, `${HALL}/wash-basin`, 'wash')).toBe(false);
    expect(blocked.at(-1)).toBe('Not yet. Next: Take soap from the dispenser.');
  });

  it('lets a done step be repeated without counting it twice', async () => {
    const { game } = await start();
    act(game, `${PREP}/notice-board`, 'inspect');
    expect(act(game, `${PREP}/notice-board`, 'inspect')).toBe(true); // reading again is fine
    expect(game.state.progression.procedures[ID]?.completed).toEqual(['read-rules']);
  });

  it('needs the wardrobe open before its equipment can be taken or put back', async () => {
    const { game, blocked } = await start();
    act(game, `${PREP}/notice-board`, 'inspect');
    expect(act(game, `${PREP}/lab-coat`, 'wear')).toBe(false);
    expect(blocked).toEqual(['Open the wardrobe first.']);

    act(game, `${PREP}/wardrobe`, 'open');
    expect(act(game, `${PREP}/lab-coat`, 'wear')).toBe(true);
    expect(game.entityStates.get(`${PREP}/lab-coat`, 'taken')).toBe(true);
    expect(game.interaction.primaryAction(`${PREP}/lab-coat`)?.label).toBe('Put back lab coat');
    // Stepped up to the coat on its hook: back out of the doors' swing to close them.
    placePlayer(game, [-1.4, 0, -1.5]);
    act(game, `${PREP}/wardrobe`, 'close');
    expect(act(game, `${PREP}/lab-coat`, 'take-off')).toBe(false);
    act(game, `${PREP}/wardrobe`, 'open');
    expect(act(game, `${PREP}/lab-coat`, 'take-off')).toBe(true);
    expect(game.equipment.isWearing('lab-coat')).toBe(false);
    expect(game.entityStates.get(`${PREP}/lab-coat`, 'taken')).toBe(false);
  });

  it('counts only its own scene: the same object elsewhere in the world never does', async () => {
    const { game } = await start();
    doSteps(game, 'water-on');
    // A faucet of another scene, running (as a resident neighbour's could be).
    const faucet = game.content.rooms.get(HALL).placements.find((p) => p.id === 'faucet')!;
    const item = game.content.items.get(faucet.item);
    game.world.spawn(entityFromPlacement('simlab-hub', { ...faucet, id: 'faucet' }, item));
    game.entityStates.set('simlab-hub/faucet', 'running', true);
    expect(stepId(game)).toBe('water-on');
    act(game, `${HALL}/faucet`, 'water-on');
    expect(stepId(game)).toBe('wet-hands');
  });

  it('checks the water for wetting and rinsing', async () => {
    const { game, blocked } = await start();
    doSteps(game, 'rinse');
    act(game, `${HALL}/faucet`, 'water-off'); // too early: rinsing needs it
    expect(stepId(game)).toBe('rinse');
    expect(act(game, `${HALL}/wash-basin`, 'wash')).toBe(false);
    expect(blocked.at(-1)).toBe('Turn on the water to rinse.');
    act(game, `${HALL}/faucet`, 'water-on');
    expect(act(game, `${HALL}/wash-basin`, 'wash')).toBe(true);
    expect(stepId(game)).toBe('water-off'); // the water is still running
    act(game, `${HALL}/faucet`, 'water-off');
    expect(stepId(game)).toBe('dry-hands');
  });

  it('needs attention for a timed step: looking away or leaving cancels it', async () => {
    const { game, blocked, events } = await start();
    doSteps(game, 'rub-palms');
    face(game, AT_BASIN, BASIN, `${HALL}/wash-basin`);
    act(game, `${HALL}/wash-basin`, 'wash');
    frames(game, 0.5);
    expect(view(game).timer).toMatchObject({ stepId: 'rub-palms', duration: 1 });
    expect(view(game).timer?.elapsed).toBeCloseTo(0.5, 5);
    expect(game.procedures.timerFraction()).toBeCloseTo(0.5, 5);
    // Pressing again does not restart the clock.
    expect(act(game, `${HALL}/wash-basin`, 'wash')).toBe(false);
    expect(blocked.at(-1)).toBe('Already in progress: keep looking at it.');

    lookAt(game, [0, 1.6, -11.2]); // down the corridor
    game.update(H);
    expect(view(game).timer).toBeNull();
    expect(stepId(game)).toBe('rub-palms');
    expect(game.procedures.timerFraction()).toBeNull();
    expect(events).toContain('cancelled:rub-palms');

    face(game, AT_BASIN, BASIN, `${HALL}/wash-basin`);
    act(game, `${HALL}/wash-basin`, 'wash');
    frames(game, 0.9);
    expect(stepId(game)).toBe('rub-palms'); // not before its duration
    frames(game, 0.2);
    expect(stepId(game)).toBe('rub-backs');

    act(game, `${HALL}/wash-basin`, 'wash');
    await game.scenes.load('simlab-hub');
    expect(events.at(-1)).toBe('cancelled:rub-backs');
    expect(view(game).timer).toBeNull();
  });

  it('closes the entrance again while required equipment is off', async () => {
    const { game, blocked, events } = await start();
    doSteps(game);
    act(game, `${HALL}/waste-bin`, 'discard');
    expect(view(game).missingEquipment).toEqual(['nitrile-gloves']);
    expect(view(game).status).toBe('in-progress');
    expect(act(game, `${HALL}/door-hub`, 'travel')).toBe(false);
    expect(blocked.at(-1)).toBe('Entry blocked. Put on: nitrile gloves.');

    act(game, `${HALL}/glove-dispenser`, 'wear');
    expect(view(game).status).toBe('ready');
    expect(events.filter((e) => e === 'ready')).toHaveLength(2);
  });

  it('saves progress and worn equipment, and restores them on continue', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await bootTestGame({ storage });
    await game.newGame('researcher-male');
    doSteps(game, 'water-on');
    expect(game.save()?.ok).toBe(true);
    game.dispose();

    const { game: again } = await bootTestGame({ storage });
    const loaded = await again.continueGame();
    expect(loaded.ok).toBe(true);
    expect(again.equipment.worn).toEqual(['lab-coat', 'safety-goggles']);
    expect(view(again)).toMatchObject({ status: 'in-progress', completed: 3 });
    expect(stepId(again)).toBe('water-on');
    expect(again.entityStates.get(`${PREP}/lab-coat`, 'taken')).toBe(true);
    expect(again.entityStates.get(`${PREP}/wardrobe`, 'open')).toBe(true);
  });

  it('starts over with a new game', async () => {
    const { game } = await start();
    doSteps(game, 'water-on');
    await game.newGame('researcher-female');
    expect(game.equipment.worn).toEqual([]);
    expect(view(game).status).toBe('not-started');
  });

  it('counts a timed step only after one full, uninterrupted run (no resume)', async () => {
    const { game } = await start();
    doSteps(game, 'rub-palms');
    face(game, AT_BASIN, BASIN, `${HALL}/wash-basin`);
    act(game, `${HALL}/wash-basin`, 'wash');
    frames(game, 0.75);
    lookAt(game, [0, 1.6, -11.2]); // away, 0.25 s short of done
    game.update(H);
    face(game, AT_BASIN, BASIN, `${HALL}/wash-basin`); // back, without pressing again
    frames(game, 3);
    expect(stepId(game)).toBe('rub-palms');
    expect(game.procedures.timerFraction()).toBeNull();
    act(game, `${HALL}/wash-basin`, 'wash'); // starts again from zero
    frames(game, 0.75);
    expect(stepId(game)).toBe('rub-palms');
    frames(game, 0.3);
    expect(stepId(game)).toBe('rub-backs');
  });
});

describe('leaving the clean area and the preparation area', () => {
  const HUB_DOOR = `${HALL}/door-hub`;
  const EXIT = `${PREP}/door-teacher`;

  const travel = walkThrough;

  /** Prepared, through the cleanroom door into the hub, and straight back to the corridor. */
  async function inAndBack(game: Game) {
    doSteps(game);
    await travel(game, HUB_DOOR);
    expect(game.state.session.sceneId).toBe('simlab-hub');
    await travel(game, 'simlab-hub/door-preparation');
  }

  it('comes back from the hub to the corridor end, still prepared, the door open both ways', async () => {
    const { game } = await start();
    await inAndBack(game);
    expect(game.state.session.sceneId).toBe(PREP);
    game.update(H);
    expect(game.state.player.roomId).toBe(HALL);
    // Walked in from the hub: well inside the corridor (its door at z −11.2, in its own coordinates).
    expect(game.state.player.position[2] - game.scenes.origin[2]).toBeGreaterThan(-10.2);
    expect(view(game)).toMatchObject({ status: 'entered', step: null, missingEquipment: [] });
    await travel(game, HUB_DOOR); // not trapped on either side
    expect(game.state.session.sceneId).toBe('simlab-hub');
  });

  it('reports a live status: "entered" only while the entrance would open now', async () => {
    const { game } = await start();
    await inAndBack(game);
    act(game, `${HALL}/waste-bin`, 'discard');
    expect(view(game)).toMatchObject({
      status: 'in-progress',
      step: null,
      missingEquipment: ['nitrile-gloves'],
    });
    expect(game.procedures.entryBlock(view(game).definition)).toBe(
      'Entry blocked. Put on: nitrile gloves.',
    );
    act(game, `${HALL}/glove-dispenser`, 'wear');
    expect(view(game).status).toBe('entered');
  });

  it('never takes used gloves back: they are discarded into the waste bin', async () => {
    const { game } = await start();
    const changes: GameEvents['EquipmentChanged'][] = [];
    game.events.subscribe('EquipmentChanged', (e) => changes.push(e));
    await inAndBack(game);
    const dispenser = `${HALL}/glove-dispenser`;
    const bin = `${HALL}/waste-bin`;
    // Worn, they are used: the dispenser offers nothing for them, the bin to discard them.
    expect(game.interaction.primaryAction(dispenser)?.id).toBe('inspect'); // no take-off
    expect(act(game, dispenser, 'take-off')).toBe(false);
    expect(game.interaction.primaryAction(bin)?.label).toBe('Discard used nitrile gloves');
    expect(act(game, bin, 'discard')).toBe(true);
    expect(changes.at(-1)).toEqual({ itemId: 'nitrile-gloves', worn: false, discarded: true });
    expect(game.equipment.worn).toEqual(['lab-coat', 'safety-goggles']);
    // Nothing more to discard; a fresh pair comes from the dispenser.
    expect(game.interaction.primaryAction(bin)?.id).not.toBe('discard');
    expect(act(game, bin, 'discard')).toBe(false);
    expect(game.interaction.primaryAction(dispenser)?.id).toBe('wear');
  });

  it('keeps PPE in the lab area: the exit is refused until all of it is back', async () => {
    const { game, blocked } = await start();
    const resets: string[] = [];
    game.events.subscribe('ProcedureReset', ({ reason }) => resets.push(reason));
    await inAndBack(game);
    expect(act(game, EXIT, 'travel')).toBe(false);
    expect(blocked.at(-1)).toBe(
      'Take off your PPE before leaving: lab coat, safety goggles, nitrile gloves.',
    );
    // Used gloves into the waste bin (never back into the dispenser); the rest in the wardrobe.
    expect(act(game, `${HALL}/glove-dispenser`, 'take-off')).toBe(false);
    expect(act(game, `${HALL}/waste-bin`, 'discard')).toBe(true);
    expect(act(game, `${PREP}/safety-goggles`, 'take-off')).toBe(true);
    expect(act(game, EXIT, 'travel')).toBe(false);
    expect(blocked.at(-1)).toBe('Take off your PPE before leaving: lab coat.');
    expect(act(game, `${PREP}/lab-coat`, 'take-off')).toBe(true);
    expect(game.entityStates.get(`${PREP}/lab-coat`, 'taken')).toBe(false); // back on its hook
    expect(game.equipment.worn).toEqual([]);

    await travel(game, EXIT);
    expect(game.state.session.sceneId).toBe('teacher-room');
    expect(resets).toEqual([
      'You left the preparation area. Prepare again from the start before entering.',
    ]);
    expect(game.state.progression.procedures[ID]).toEqual({ completed: [], entered: false });

    await travel(game, 'teacher-room/door-preparation');
    expect(view(game)).toMatchObject({ status: 'not-started', completed: 0 });
    expect(act(game, HUB_DOOR, 'travel')).toBe(false);
    expect(blocked.at(-1)).toBe(
      'Entry blocked. Next: Read the cleanroom entry rules on the notice board.',
    );
  });

  it('does not announce a reset when nothing was prepared yet', async () => {
    const { game } = await start();
    const resets: string[] = [];
    game.events.subscribe('ProcedureReset', ({ reason }) => resets.push(reason));
    await travel(game, EXIT);
    await travel(game, 'teacher-room/door-preparation');
    expect(resets).toEqual([]);
    expect(game.state.progression.procedures).toEqual({});
  });

  it('never lets saved step ids skip a step or open the door', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await bootTestGame({ storage });
    await game.newGame('researcher-male');
    expect(game.save()?.ok).toBe(true);
    game.dispose();
    // A save edited by hand or written by another version: a late step, an unknown id, entered.
    const key = 'simlab.save.slot-1';
    const data = JSON.parse(storage.read(key) ?? '{}') as {
      progression: { procedures: Record<string, unknown> };
    };
    data.progression.procedures[ID] = {
      completed: ['read-rules', 'gloves', 'teleport'],
      entered: true,
    };
    storage.write(key, JSON.stringify(data));

    const { game: again } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    expect(view(again)).toMatchObject({ status: 'in-progress', completed: 1 });
    expect(again.interaction.perform(HUB_DOOR, 'travel')).toBe(false);
    doSteps(again, 'goggles', 'lab-coat');
    expect(again.state.progression.procedures[ID]?.completed).toEqual(['read-rules', 'lab-coat']);
    doSteps(again, null, 'goggles'); // the gloves step still comes in its turn
    expect(view(again).status).toBe('entered'); // every step really done now, PPE on
  });

  it('saves and restores a prepared player who came back and discarded the gloves', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await bootTestGame({ storage });
    await game.newGame('researcher-male');
    await inAndBack(game);
    act(game, `${HALL}/waste-bin`, 'discard');
    expect(game.save()?.ok).toBe(true);
    game.dispose();

    const { game: again } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    expect(again.equipment.worn).toEqual(['lab-coat', 'safety-goggles']);
    expect(view(again)).toMatchObject({
      status: 'in-progress',
      missingEquipment: ['nitrile-gloves'],
    });
    expect(again.interaction.perform(HUB_DOOR, 'travel')).toBe(false);
    expect(again.interaction.perform(`${HALL}/glove-dispenser`, 'wear')).toBe(true);
    expect(view(again).status).toBe('entered');
    expect(again.interaction.perform(HUB_DOOR, 'travel')).toBe(true);
    untilIdle(again); // the key card on the reader: the door asked to open
  });
});
