import { describe, expect, it } from 'vitest';
import type { Game } from '../game/Game';
import type { GameEvents } from '../game/GameEvents';
import { bootTestGame, placePlayer } from '../game/testing';
import { CIRCUIT_KEY } from '../gameplay/circuit/CircuitSystem';
import { BURNING_AT_KEY, BURNING_KEY } from '../gameplay/fire/FireSystem';

// Phase F-3: one world for the room's players — another player stands in physics, is hit by what
// this player throws, drives the teacher everyone sees, and lights or wires what everyone has.

const H = 1 / 60;
const room = { id: 'ABC234', name: 'Lớp 11A', host: 'An', players: 2, max: 8 };
const run = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};

async function inRoom(sceneId: string) {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  await game.scenes.load(sceneId); // developer jump (setup only)
  run(game, 1);
  const character = game.content.characters.all()[1]!;
  game.peers.joined(room, 'p1', [{ id: 'p2', name: 'An', character }]);
  const blocked: string[] = [];
  game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  return { game, blocked };
}

/** Places player p2 at a world position (their pose is in their scene's own frame). */
function standPeer(game: Game, sceneId: string, x: number, z: number): void {
  const o = game.scenes.offsetOf(sceneId)!;
  game.peers.pose('p2', { scene: sceneId, x: x - o[0], y: 0, z: z - o[2], yaw: 0, speed: 0 });
}

describe('one world for the room (Phase F-3)', () => {
  it('another player stands in physics: this player walks into them and stops', async () => {
    const { game } = await inRoom('physics-lab');
    placePlayer(game, [-1, 0, 0], 0, 0); // facing −z, the floor clear ahead
    standPeer(game, 'physics-lab', -1, -1.2);
    run(game, 0.2);
    game.input.press('moveForward');
    run(game, 2);
    game.input.release('moveForward');
    // Stopped by their capsule: never past them (a capsule each, ~0.3 m round).
    expect(game.state.player.position[2]).toBeGreaterThan(-1.2 + 0.4);
    // Gone from the room: the way is free.
    game.peers.gone('p2');
    game.input.press('moveForward');
    run(game, 1.5);
    game.input.release('moveForward');
    expect(game.state.player.position[2]).toBeLessThan(-1.4);
  });

  it('what this player throws hits another player (PeerHit); their hit flashes this one', async () => {
    const { game } = await inRoom('physics-lab');
    const peerHits: GameEvents['PeerHit'][] = [];
    const hits: GameEvents['PlayerHit'][] = [];
    game.events.subscribe('PeerHit', (e) => peerHits.push(e));
    game.events.subscribe('PlayerHit', (e) => hits.push(e));
    const ball = game.world.entity('physics-lab/steel-ball')!;
    placePlayer(game, [-1, 0, 0], 0, 1.45); // looking up: it comes down ~2.5 m ahead
    expect(game.interaction.grab(ball)).toBe(true);
    run(game, 0.4); // in the hand (they would stand in its way from the table)
    standPeer(game, 'physics-lab', -1.26, -2.45); // where it comes down
    game.input.press('throw');
    game.update(H);
    game.input.release('throw');
    run(game, 2.6);
    expect(peerHits.map((e) => e.id)).toEqual(['p2']);
    expect(hits).toHaveLength(0);
    game.peers.event('p2', { k: 'hit', target: 'p1', speed: 4 });
    game.peers.event('p2', { k: 'hit', target: 'p3', speed: 4 }); // someone else's
    expect(hits).toEqual([{ entityId: 'peer:p2', speed: 4 }]);
  });

  it('a ball thrown straight at another player hits them at 8 frames a second too', async () => {
    const { game } = await inRoom('physics-lab');
    const peerHits: GameEvents['PeerHit'][] = [];
    game.events.subscribe('PeerHit', (e) => peerHits.push(e));
    const ball = game.world.entity('physics-lab/steel-ball')!;
    placePlayer(game, [-1, 0, 0], 0, -0.12); // level at their chest, 3 m ahead
    expect(game.interaction.grab(ball)).toBe(true);
    run(game, 0.4);
    standPeer(game, 'physics-lab', -1, -3);
    game.update(H);
    game.input.press('throw');
    game.update(H);
    game.input.release('throw');
    // A software renderer's frame rate: the ball crosses most of a metre between two frames.
    for (let i = 0; i < 16; i++) game.update(1 / 8);
    expect(peerHits.map((e) => e.id)).toEqual(['p2']);
  });

  it('a throw by another player flies here, falls and rests on the floor', async () => {
    const { game } = await inRoom('physics-lab');
    const o = game.scenes.offsetOf('physics-lab')!;
    game.peers.event('p2', {
      k: 'throw',
      item: 'steel-ball',
      scene: 'physics-lab',
      from: [0, 1.5, 0],
      v: [2, 1, 0],
    });
    const ghost = game.peers.ghosts[0]!;
    expect(ghost.at).toEqual([o[0], 1.5 + o[1], o[2]]);
    run(game, 1);
    expect(ghost.at[0]).toBeGreaterThan(o[0] + 1);
    expect(ghost.at[1]).toBeCloseTo(0.05, 3);
    run(game, 2);
    expect(game.peers.ghosts).toHaveLength(0);
  });

  it('the teacher another player has is drawn as their game says; talking waits for them', async () => {
    const { game, blocked } = await inRoom('simlab-hub');
    const npcs = game.npcs;
    game.peers.setLocks({ 'npc:teacher': 'p2' });
    npcs.mirror('teacher', { sceneId: 'simlab-hub', x: 1.5, z: -2, gesture: 'write', pen: 'blue' });
    run(game, 0.2);
    const view = npcs.view('teacher')!;
    expect([view.x, view.z, view.gesture, view.pen]).toEqual([1.5, -2, 'write', 'blue']);
    expect(npcs.engaged('teacher')).toBe(false);
    expect(game.interaction.perform('simlab-hub/teacher', 'talk')).toBe(false);
    expect(blocked.at(-1)).toMatch(/helping An now/);
    // Done there: back to his own day, walking from where he is.
    game.peers.setLocks({});
    run(game, 0.1);
    expect(npcs.mode('teacher')).toBe('return');
    expect(view.pen).toBe('none');
  });

  it('the teacher this player talks with is this game’s to send: engaged, with his snapshot', async () => {
    const { game } = await inRoom('simlab-hub');
    const npcs = game.npcs;
    expect(npcs.engaged('teacher')).toBe(false);
    expect(npcs.open('teacher')).toBe(true);
    expect(npcs.engaged('teacher')).toBe(true);
    game.update(H);
    const view = npcs.view('teacher')!;
    expect(npcs.snapshot('teacher')).toMatchObject({ sceneId: view.sceneId, talking: true });
  });

  it('a fire another player lit burns here too, and goes out when they put it out', async () => {
    const { game } = await inRoom('physics-lab');
    const board = [...game.circuits.all()][0]!.entity.id;
    game.entityStates.set(board, BURNING_AT_KEY, '0.000,0.000');
    game.entityStates.set(board, BURNING_KEY, 0.05);
    game.fires.adopt(board);
    expect(game.fires.burning(board)).toBe(true);
    game.entityStates.set(board, BURNING_KEY, 0);
    game.fires.adopt(board);
    expect(game.fires.burning(board)).toBe(false);
  });

  it('a part another player plugged into a board leaves this world; taken off, it is back', async () => {
    const { game } = await inRoom('physics-lab');
    const board = [...game.circuits.all()][0]!;
    const part = [...game.world.allEntities()].find((e) => e.item.circuit)!;
    const mounted = { id: part.id, item: part.item.id, edge: 0, flip: false, setting: 0 };
    const circuit = { parts: [mounted], wires: [], volts: 0 };
    game.entityStates.set(board.entity.id, CIRCUIT_KEY, JSON.stringify(circuit));
    game.circuits.adopt(board.entity.id);
    expect(game.world.entity(part.id)).toBeUndefined();
    expect(board.state.parts.map((p) => p.id)).toEqual([part.id]);
    game.entityStates.set(board.entity.id, CIRCUIT_KEY, JSON.stringify({ ...circuit, parts: [] }));
    game.circuits.adopt(board.entity.id);
    expect(game.world.entity(part.id)).toBeDefined();
    expect(board.state.parts).toEqual([]);
  });
});
