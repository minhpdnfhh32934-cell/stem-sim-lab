import { describe, expect, it } from 'vitest';
import type { Game } from '../game/Game';
import { bootTestGame } from '../game/testing';

// The other players of a LAN room (Phase M) as the game keeps them, and a station another player
// works: refused to this player, its copy following that player's commands and settings.

const H = 1 / 60;
const BOARD = 'physics-lab/circuit'; // Ohm's law
const room = { id: 'ABC234', name: 'Lớp 11A', host: 'An', players: 2, max: 8 };

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};

async function inRoom() {
  const booted = await bootTestGame();
  const { game } = booted;
  await game.newGame('researcher-male');
  await game.scenes.load('physics-lab');
  frames(game, 1);
  const character = game.content.characters.all()[1]!;
  const seen: string[] = [];
  game.events.subscribe('PeerJoined', ({ name }) => seen.push(`+${name}`));
  game.events.subscribe('PeerLeft', ({ name }) => seen.push(`-${name}`));
  const blocked: string[] = [];
  game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  game.peers.joined(room, 'p1', [{ id: 'p2', name: 'An', character }]);
  return { game, character, seen, blocked };
}

const params = (game: Game) => game.stations.view(BOARD)?.session.parameters ?? {};

describe('Peers (LAN rooms, Phase M)', () => {
  it('keeps who is in the room, placed at once on a new scene, then eased towards each pose', async () => {
    const { game, character, seen } = await inRoom();
    const peers = game.peers;
    expect(peers.players.map((p) => p.name)).toEqual(['An']);
    peers.peer({ id: 'p3', name: 'Bình', character });
    peers.peer({ id: 'p1', name: 'me', character }); // this game itself: not another player
    expect(peers.players.map((p) => p.name)).toEqual(['An', 'Bình']);

    peers.pose('p2', { scene: 'physics-lab', x: 1, y: 0, z: 2, yaw: 0.5, speed: 0 });
    const an = peers.players[0]!;
    expect([an.sceneId, an.x, an.z, an.heading]).toEqual(['physics-lab', 1, 2, 0.5]);
    peers.pose('p2', { scene: 'physics-lab', x: 2, y: 0, z: 2, yaw: 0.5, speed: 1.4 });
    expect(an.x).toBe(1); // not yet: eased
    peers.update(0.1);
    expect(an.x).toBeGreaterThan(1.5);
    expect(an.x).toBeLessThan(2);
    peers.update(1);
    expect(an.x).toBeCloseTo(2, 3);
    // Through a door into another scene: there at once.
    peers.pose('p2', { scene: 'simlab-hub', x: -5, y: 0, z: 3, yaw: 0, speed: 1.4 });
    expect([an.sceneId, an.x, an.z]).toEqual(['simlab-hub', -5, 3]);
    peers.pose('p2', null); // back on the menu
    expect(an.sceneId).toBeNull();

    // A character this game does not accept (the server only relays it): drawn as the first one.
    peers.peer({ id: 'p4', name: 'Cường', character: { id: 'x' } });
    expect(peers.players[2]?.character).toBe(game.content.characters.all()[0]);
    peers.look('p4', character);
    expect(peers.players[2]?.character.id).toBe(character.id);
    peers.gone('p4');
    seen.pop();
    seen.pop();
    peers.gone('p3');
    peers.gone('p3'); // told twice: once
    expect(seen).toEqual(['+Bình', '-Bình']);
    peers.left();
    expect(peers.room).toBeNull();
    expect(peers.players).toEqual([]);
  });

  it('refuses the player a station another player works, with whose it is', async () => {
    const { game, blocked } = await inRoom();
    game.peers.setLocks({ [BOARD]: 'p2' });
    expect(game.peers.holder(BOARD)).toBe('An');
    const before = { ...params(game) };
    expect(game.interaction.perform('physics-lab/ohm-dial-voltage', 'raise')).toBe(false);
    expect(game.interaction.perform('physics-lab/ohm-run', 'run')).toBe(false);
    game.events.publish('ExperimentCommand', { stationId: BOARD, command: 'run' });
    expect(params(game)).toEqual(before);
    expect(game.stations.view(BOARD)?.session.state).toBe('configured');
    expect(blocked.at(-1)).toBe('An is working this apparatus.');
    expect(game.stations.refusal(BOARD, 'run')).toBe('An is working this apparatus.');
    // Their own stations, and the results page, stay the player's.
    expect(game.stations.refusal(BOARD, 'view')).not.toBe('An is working this apparatus.');
    // Theirs no more: the player's again.
    game.peers.setLocks({ [BOARD]: 'p1' });
    expect(game.peers.holder(BOARD)).toBeNull();
    expect(game.interaction.perform('physics-lab/ohm-dial-voltage', 'raise')).toBe(true);
  });

  it("follows another player's commands: their settings first, then what they did", async () => {
    const { game, blocked } = await inRoom();
    game.peers.setLocks({ [BOARD]: 'p2' });
    // Their dial went from another value: this copy takes their value, not a step from its own.
    game.events.publish('ExperimentCommand', {
      stationId: BOARD,
      command: 'adjust',
      parameter: 'voltage',
      direction: 1,
      from: 'An',
      params: { voltage: 12, resistance1: 100, resistance2: 220, configuration: 2 },
    });
    expect(params(game)).toEqual({
      voltage: 12,
      resistance1: 100,
      resistance2: 220,
      configuration: 2,
    });
    expect(game.entityStates.get(BOARD, 'param.voltage')).toBe(12);
    game.events.publish('ExperimentCommand', { stationId: BOARD, command: 'run', from: 'An' });
    expect(game.stations.view(BOARD)?.session.state).toBe('running');
    // One this copy cannot follow is only logged: no notice for the player.
    game.events.publish('ExperimentCommand', { stationId: BOARD, command: 'reset', from: 'An' });
    game.events.publish('ExperimentCommand', { stationId: BOARD, command: 'clear', from: 'An' });
    expect(blocked).toEqual([]);
  });
});
