import { beforeEach, describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, lookAt, placePlayer, type CapturedLog, untilIdle } from '../../game/testing';
import type { Interactable } from './InteractionSystem';

const LAMP = 'preparation-room/desk-lamp';
const LAMP_CENTER = [2.5, 0.95, -2.55] as const;

describe('InteractionSystem', () => {
  let game: Game;
  let logs: CapturedLog[];
  let focusEvents: GameEvents['InteractionFocusChanged'][];

  beforeEach(async () => {
    ({ game, logs } = await bootTestGame());
    await game.newGame('researcher-female');
    focusEvents = [];
    game.events.subscribe('InteractionFocusChanged', (e) => focusEvents.push(e));
  });

  const panel = (id: string, perform: () => void): Interactable => ({
    id,
    displayName: id,
    center: [0, 1.5, -1],
    halfExtents: [0.5, 0.5, 0.05],
    rotation: [0, 0, 0, 1],
    actions: [{ id: 'press', label: 'Press', isAvailable: () => true, perform }],
  });

  it('registers an interactable for every spawned entity with behaviours', () => {
    const withBehaviours = [...game.world.allEntities()].filter((e) => e.item.interactions.length);
    expect(withBehaviours.length).toBeGreaterThan(0);
    expect(game.interaction.count).toBe(withBehaviours.length);
  });

  it('focuses the object under the crosshair within reach only', () => {
    placePlayer(game, [2.5, 0, -1.2]);
    lookAt(game, LAMP_CENTER);
    game.update(0.016);
    expect(game.interaction.focused?.id).toBe(LAMP);
    expect(focusEvents).toEqual([{ entityId: LAMP }]);

    placePlayer(game, [2.5, 0, 2.5]); // same direction, but ~5 m away
    lookAt(game, LAMP_CENTER);
    game.update(0.016);
    expect(game.interaction.focused).toBeNull();
    expect(focusEvents.at(-1)).toEqual({ entityId: null });
  });

  it('reaches the PPE through the open cabinet doors, the cabinet by its back', () => {
    const CABINET = 'preparation-room/wardrobe';
    const COAT = [-2.7, 1.25, -1.5] as const; // hanging inside it
    placePlayer(game, [-1.4, 0, -1.2]);
    lookAt(game, COAT);
    game.update(0.016);
    expect(game.interaction.focused?.id).toBe(CABINET); // closed: its doors are in the way

    game.entityStates.set(CABINET, 'open', true);
    for (let i = 0; i < 40; i++) game.update(0.016); // its doors swing open in 0.5 s (UX3.1)
    expect(game.interaction.focused?.id).toBe('preparation-room/lab-coat');
    lookAt(game, [-2.9, 0.6, -1.1]); // past the PPE, at the cabinet's back
    game.update(0.016);
    expect(game.interaction.focused?.id).toBe(CABINET);
    expect(game.interaction.primaryAction(CABINET)?.id).toBe('close');
  });

  it('never swings the cabinet doors into a player: open and close wait until they step back', () => {
    const CABINET = 'preparation-room/wardrobe';
    const blocked: string[] = [];
    game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
    // In front of its doors (the hinges at x −2.446, z −0.6 and −1.8; the leaves 0.6 m wide):
    // opening would swing them into the capsule.
    placePlayer(game, [-1.95, 0, -1.2]);
    expect(game.interaction.perform(CABINET, 'open')).toBe(false);
    expect(blocked).toEqual(['Step back to open it.']);
    expect(game.entityStates.get(CABINET, 'open')).not.toBe(true);
    placePlayer(game, [-1.4, 0, -1.2]); // clear of the swing (1.2 m from each hinge)
    expect(game.interaction.perform(CABINET, 'open')).toBe(true);
    for (let i = 0; i < 40; i++) game.update(0.016);
    expect(game.hinges.fraction(CABINET)).toBe(1);
    // Open, standing in its mouth: closing would sweep the leaves through the player.
    placePlayer(game, [-2.3, 0, -1.2]); // the capsule reaches x −2.6 (the closed fronts −2.428)
    expect(game.interaction.perform(CABINET, 'close')).toBe(false);
    expect(blocked.at(-1)).toBe('Step back to close it.');
    expect(game.entityStates.get(CABINET, 'open')).toBe(true);
    placePlayer(game, [-1.4, 0, -1.2]);
    expect(game.interaction.perform(CABINET, 'close')).toBe(true);
    expect(game.entityStates.get(CABINET, 'open')).toBe(false);
  });

  it('targets a small object resting on a larger one', () => {
    placePlayer(game, [2.5, 0, -1.2]);
    lookAt(game, LAMP_CENTER); // the ray passes over the desk the lamp stands on
    game.update(0.016);
    expect(game.interaction.focused?.id).toBe(LAMP);
  });

  it('performs the primary action and switches to the next available one', () => {
    const changes: GameEvents['EntityStateChanged'][] = [];
    game.events.subscribe('EntityStateChanged', (e) => changes.push(e));
    placePlayer(game, [2.5, 0, -1.2]);
    lookAt(game, LAMP_CENTER);
    game.update(0.016);

    expect(game.interaction.primaryAction(LAMP)?.label).toBe('Turn on');
    game.input.press('interact');
    game.update(0.016);
    expect(game.entityStates.get(LAMP, 'active')).toBe(true);
    expect(changes).toEqual([{ entityId: LAMP, key: 'active', value: true }]);
    expect(game.interaction.primaryAction(LAMP)?.id).toBe('deactivate');

    expect(game.interaction.interact()).toBe(true);
    expect(game.entityStates.get(LAMP, 'active')).toBe(false);
  });

  it('performs the secondary action on its own key: Toggle + Grab on the desk lamp', () => {
    placePlayer(game, [2.5, 0, -1.2]);
    lookAt(game, LAMP_CENTER);
    game.update(0.016);
    expect(game.interaction.primaryAction(LAMP)?.label).toBe('Turn on');
    expect(game.interaction.secondaryAction(LAMP)?.label).toBe('Grab');
    // One behaviour, one action available: no secondary.
    expect(game.interaction.secondaryAction('preparation-room/cabinet')).toBeNull();

    game.input.press('secondary');
    game.update(0.016);
    expect(game.interaction.heldId).toBe(LAMP);
    expect(game.entityStates.get(LAMP, 'active')).toBeUndefined(); // the primary did not run
  });

  it('performs only the primary action when both keys are pressed in one frame', () => {
    placePlayer(game, [2.5, 0, -1.2]);
    lookAt(game, LAMP_CENTER);
    game.update(0.016);
    game.input.press('interact');
    game.input.press('secondary');
    game.update(0.016);
    expect(game.entityStates.get(LAMP, 'active')).toBe(true);
    expect(game.interaction.heldId).toBeNull();
  });

  it('offers Inspect next to Grab: the secondary key inspects without picking up', async () => {
    await game.scenes.load('physics-lab');
    for (let i = 0; i < 120; i++) game.update(1 / 60); // the steel ball settles on the bench
    const inspected: GameEvents['ItemInspected'][] = [];
    game.events.subscribe('ItemInspected', (e) => inspected.push(e));
    placePlayer(game, [-2.067, 0, -3.674]);
    lookAt(game, [-2.067, 0.94, -4.474]); // the ball on the teacher's bench
    game.update(1 / 60);
    const ball = 'physics-lab/steel-ball';
    expect(game.interaction.focused?.id).toBe(ball);
    expect(game.interaction.primaryAction(ball)?.label).toBe('Grab');
    expect(game.interaction.secondaryAction(ball)?.label).toBe('Inspect');

    game.input.press('secondary');
    game.update(1 / 60);
    expect(inspected).toEqual([{ entityId: ball, itemId: 'steel-ball' }]);
    expect(game.interaction.heldId).toBeNull();
    game.input.release('secondary');

    game.input.press('interact'); // E still grabs
    game.update(1 / 60);
    expect(game.interaction.heldId).toBe(ball);
  });

  it('refuses unavailable or unknown actions without throwing', () => {
    expect(game.interaction.perform(LAMP, 'deactivate')).toBe(false);
    expect(game.interaction.perform('nope', 'open')).toBe(false);
    expect(logs.filter((l) => l.level === 'warn')).toHaveLength(2);
  });

  it('clears focus when the focused object is removed', () => {
    placePlayer(game, [2.5, 0, -1.2]);
    lookAt(game, LAMP_CENTER);
    game.update(0.016);
    game.world.despawn(LAMP);
    expect(game.interaction.focused).toBeNull();
    expect(focusEvents.at(-1)).toEqual({ entityId: null });
    expect(game.interaction.interact()).toBe(false);
  });

  it('supports interactables that are not world entities, with safe unregistration', () => {
    let pressed = 0;
    const unregister = game.interaction.register(panel('test-panel', () => pressed++));
    expect(() => game.interaction.register(panel('test-panel', () => undefined))).toThrow(
      /already registered/,
    );
    placePlayer(game, [0, 0, 0]);
    lookAt(game, [0, 1.5, -1]);
    game.update(0.016);
    expect(game.interaction.focused?.id).toBe('test-panel');
    expect(game.interaction.interact()).toBe(true);
    unregister();
    unregister();
    expect(game.interaction.focused).toBeNull();
    expect(pressed).toBe(1);
  });

  it('isolates an action that throws', () => {
    game.interaction.register(
      panel('broken-panel', () => {
        throw new Error('short circuit');
      }),
    );
    expect(game.interaction.perform('broken-panel', 'press')).toBe(false);
    expect(logs.some((l) => l.level === 'error' && l.message.includes('broken-panel'))).toBe(true);
    game.update(0.016); // the game keeps running
    expect(game.systems.statuses().every((s) => s.status === 'active')).toBe(true);
  });

  it('does not focus anything outside of play', async () => {
    await game.scenes.load('main-menu');
    game.update(0.016);
    expect(game.interaction.focused).toBeNull();
    expect(game.interaction.count).toBe(0);
  });
});

describe('aiming at a walk-through door (UX3.1)', () => {
  // The hub's physics door: its leaf at (12.95, 1.05, −3) on the east wall (face x 13), sliding
  // −z (its local +x) 1 m into its pocket; the jamb it closes against at z ≈ −2.45.
  const DOOR = 'simlab-hub/door-physics';
  const H = 1 / 60;

  async function inHub() {
    const { game } = await bootTestGame();
    await game.newGame('researcher-female');
    await game.scenes.load('simlab-hub');
    placePlayer(game, [11.2, 0, -3]);
    return game;
  }
  const aimed = (game: Game, at: readonly [number, number, number]) => {
    lookAt(game, at);
    game.update(H);
    return game.interaction.focused?.id ?? null;
  };

  it('answers on its leaf, its pull, its jamb, its pocket and its header, closed', async () => {
    const game = await inHub();
    expect(aimed(game, [12.95, 1.05, -3])).toBe(DOOR); // the leaf
    expect(aimed(game, [12.95, 1.0, -2.47])).toBe(DOOR); // the pull, by the closing edge
    expect(aimed(game, [12.95, 1.2, -2.42])).toBe(DOOR); // the jamb
    expect(aimed(game, [12.95, 1.2, -3.95])).toBe(DOOR); // the pocket it slides into
    expect(aimed(game, [12.95, 2.22, -3])).toBe(DOOR); // the header
    expect(aimed(game, [12.95, 1.2, -4.8])).toBeNull(); // the wall past its track
    expect(aimed(game, [12.95, 2.6, -3])).toBeNull(); // the wall above its header
  });

  it('still answers on the slid leaf and the open doorway once open', async () => {
    const game = await inHub();
    expect(game.interaction.perform(DOOR, 'travel')).toBe(true);
    untilIdle(game); // the key card on the reader: the door asked to open
    await new Promise((resolve) => setTimeout(resolve, 0)); // the lab is attached
    for (let i = 0; i < 400 && game.doors.state(DOOR) !== 'open'; i++) game.update(H);
    expect(game.doors.state(DOOR)).toBe('open');
    placePlayer(game, [11.2, 0, -3]); // held still for the aim
    expect(aimed(game, [12.95, 1.2, -3.95])).toBe(DOOR); // the leaf in its pocket
    expect(aimed(game, [12.95, 2.22, -3])).toBe(DOOR); // the header over the open doorway
    expect(game.interaction.primaryAction(DOOR)?.id).toBe('close-door');
  });
});
