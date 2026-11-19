import { describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import { bootTestGame, flush } from '../../game/testing';

// Emergency calls answered in the world (Phú 2026-11-13): the squad's helicopter, the ceiling
// blown open over the hub, four down the ropes, their job, back up, and the ceiling mended.

const H = 1 / 60;
const run = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};

async function inHub() {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  await game.scenes.load('simlab-hub'); // developer jump (setup only)
  run(game, 0.5);
  return game;
}

/** Runs until `done` (or the seconds run out); the time it took. */
function until(game: Game, done: () => boolean, seconds: number): number {
  let t = 0;
  while (!done() && t < seconds) {
    game.update(H);
    t += H;
  }
  return t;
}

describe('EmergencySystem', () => {
  it('says something else each call (the 2nd call its 2nd lines; past the last, the last), counted in the save', async () => {
    const game = await inHub();
    const e = game.emergency;
    const said = () => {
      until(game, () => e.line !== null, 30);
      return e.line?.text ?? '';
    };
    game.state.progression.calls['police-squad'] = 1;
    expect(e.call('113')).toBe('dispatched');
    expect(game.state.progression.calls['police-squad']).toBe(2);
    expect(said()).toContain('Police again');
    const later = await inHub();
    later.state.progression.calls['police-squad'] = 8;
    expect(later.emergency.call('911')).toBe('dispatched');
    until(later, () => later.emergency.line !== null, 30);
    expect(later.emergency.line?.text).toContain('SimLab. Again.'); // the last of five
  });

  it('the blast stuns a player under the hole, fading in seconds; not one in a lab', async () => {
    const game = await inHub();
    const e = game.emergency;
    expect(e.call('113')).toBe('dispatched');
    const squad = e.squad!;
    const off = game.scenes.offsetOf('simlab-hub')!;
    until(game, () => e.phase === 'breach', 15);
    game.state.player.position = [
      squad.arrival.at[0] + off[0],
      off[1],
      squad.arrival.at[1] + off[2],
    ];
    until(game, () => e.blast >= 0, 5);
    run(game, 2 * H);
    expect(e.stun).toBeGreaterThan(0.9);
    run(game, 3);
    expect(e.stun).toBeGreaterThan(0.3);
    expect(e.stun).toBeLessThan(0.7);
    run(game, 5);
    expect(e.stun).toBe(0);

    const other = await inHub();
    await other.scenes.attach('chemistry-lab');
    const lab = other.world.roomsOf('chemistry-lab')[0]!;
    expect(other.emergency.call('113')).toBe('dispatched');
    other.state.player.position = [
      (lab.bounds.min[0] + lab.bounds.max[0]) / 2,
      0,
      (lab.bounds.min[2] + lab.bounds.max[2]) / 2,
    ];
    until(other, () => other.emergency.blast >= 0, 15);
    run(other, 2 * H);
    expect(other.state.player.roomId).toBe(lab.id);
    expect(other.emergency.stun).toBe(0);
  });

  it('114: the slap only up close — stepping back, they run in again first', async () => {
    const game = await inHub();
    const e = game.emergency;
    const hub = (x: number, z: number) => {
      const off = game.scenes.offsetOf('simlab-hub')!;
      game.state.player.position = [x + off[0], 0, z + off[2]];
    };
    let at: number | null = null;
    game.events.subscribe('PlayerHit', ({ entityId }) => {
      if (!entityId.startsWith('responder:')) return;
      const leader = e.views[0]!;
      const p = game.state.player.position;
      const off = game.scenes.offsetOf('simlab-hub')!;
      at = Math.hypot(p[0] - off[0] - leader.x, p[2] - off[2] - leader.z);
    });
    expect(e.call('114')).toBe('dispatched');
    until(game, () => e.phase === 'mission', 20);
    // Stand still until the lesson is over, then two steps back as the hand goes up.
    let spot: [number, number] | null = null;
    until(
      game,
      () => {
        const leader = e.views[0]!;
        if (e.line?.text.includes('not a toy') && !spot) spot = [leader.x + 2.6, leader.z];
        if (spot) hub(spot[0], spot[1]);
        return at !== null || e.phase === 'regroup';
      },
      120,
    );
    expect(at).not.toBeNull();
    expect(at!).toBeLessThan(1.3); // he came to them for it
  });

  it('114: the caller runs off before it is over — called after, no slap, they go', async () => {
    const game = await inHub();
    const e = game.emergency;
    const hits: string[] = [];
    game.events.subscribe('PlayerHit', ({ entityId }) => hits.push(entityId));
    const lines: string[] = [];
    expect(e.call('114')).toBe('dispatched');
    until(game, () => e.phase === 'mission', 20);
    let ran = false;
    until(
      game,
      () => {
        if (e.line && !lines.includes(e.line.text)) lines.push(e.line.text);
        // Told off: off across the hall, out of reach.
        if (e.line?.text.includes('Who called 114')) ran = true;
        if (ran) {
          const off = game.scenes.offsetOf('simlab-hub')!;
          const leader = e.views[0]!;
          game.state.player.position = [leader.x + 13 + off[0], 0, leader.z + off[2]];
        }
        return e.phase === 'regroup';
      },
      120,
    );
    expect(ran).toBe(true);
    expect(lines.some((l) => l.includes('Running off'))).toBe(true);
    expect(hits.filter((h) => h.startsWith('responder:'))).toEqual([]);
  });

  it('the blast startles the teacher: guarded, then calm once they are seen on the ropes', async () => {
    const game = await inHub();
    const e = game.emergency;
    const teacher = () => game.npcs.views.find((v) => v.npc.id === 'teacher');
    expect(teacher()?.sceneId).toBe('simlab-hub');
    expect(e.call('113')).toBe('dispatched');
    until(game, () => e.blast >= 0, 15);
    run(game, 2 * H);
    expect(teacher()?.gesture).toBe('guard');
    // Still guarded as the first of them comes down a rope; calm a moment after.
    until(game, () => e.views.some((v) => v.visible && v.action === 'rappel'), 5);
    expect(teacher()?.gesture).toBe('guard');
    run(game, 1);
    expect(teacher()?.gesture).toBe('idle');
    expect(teacher()?.looking).toBe(true);
    // While they are in the building he watches them: no book, standing, looking their way.
    let read = false;
    let standing = true;
    until(
      game,
      () => {
        const v = teacher();
        read ||= v?.gesture === 'read';
        if (v && e.views.some((r) => r.visible) && !game.npcs.engaged('teacher')) {
          standing &&= v.looking && v.sit < 0.5;
        }
        return e.phase === 'outbound';
      },
      150,
    );
    expect(read).toBe(false);
    expect(standing).toBe(true);
    // Gone back up: his day goes on.
    run(game, 3);
    expect(teacher()?.looking).toBe(false);
  });

  it('in a LAN room, the game that draws the call startles and keeps the teacher too', async () => {
    const caller = await inHub();
    const other = await inHub();
    expect(caller.emergency.call('113')).toBe('dispatched');
    const teacher = () => other.npcs.views.find((v) => v.npc.id === 'teacher');
    // The other game draws the call from the caller's snapshots, eight a second.
    let since = 0;
    until(
      caller,
      () => {
        since += H;
        if (since >= 0.125) {
          since = 0;
          const snap = caller.emergency.snapshot();
          if (snap) other.emergency.mirror(snap, 'caller');
        }
        other.update(H);
        return caller.emergency.blast >= 0.1;
      },
      20,
    );
    run(other, 2 * H);
    expect(teacher()?.gesture).toBe('guard');
  });

  it('114 with the caller in a lab: no one to see in the hall — they ask the teacher, ask him to keep an eye on the students, and he tells the caller off when they come', async () => {
    const game = await inHub();
    const e = game.emergency;
    const lines: string[] = [];
    let last = 0;
    const listen = () => {
      if (e.line && e.line.n !== last) {
        last = e.line.n;
        lines.push(e.line.text);
      }
    };
    // The caller in the Chemistry Lab (beside the hall) when they come down.
    await game.scenes.attach('chemistry-lab');
    expect(game.world.roomsOf('chemistry-lab').length).toBeGreaterThan(0);
    const lab = game.world.roomsOf('chemistry-lab')[0]!;
    const inLab = (): [number, number, number] => [
      (lab.bounds.min[0] + lab.bounds.max[0]) / 2,
      0,
      (lab.bounds.min[2] + lab.bounds.max[2]) / 2,
    ];
    expect(e.call('114')).toBe('dispatched');
    game.state.player.position = inLab();
    run(game, 0.5);
    expect(game.state.player.roomId).toBe(lab.id);
    until(
      game,
      () => {
        listen();
        game.state.player.position = inLab(); // staying in there
        return e.phase === 'regroup';
      },
      150,
    );
    listen();
    expect(lines.some((l) => l.includes('Is there a fire anywhere'))).toBe(true);
    expect(lines.some((l) => l.includes('keep an eye on your students'))).toBe(true);
    expect(lines.some((l) => l.includes('Who called 114'))).toBe(false); // no one told off
    expect(game.state.session.conversation ?? null).toBeNull();
    // The caller comes back into the hall: the teacher walks up and says it.
    await game.scenes.load('simlab-hub'); // (setup) back in the hall
    const teacher = game.npcs.views.find((v) => v.npc.id === 'teacher')!;
    game.state.player.position = [teacher.x + 6, 0, teacher.z + 2];
    until(game, () => game.state.session.conversation?.npcId === 'teacher', 30);
    expect(game.state.session.conversation?.npcId).toBe('teacher');
    expect(
      Math.hypot(
        teacher.x - game.state.player.position[0],
        teacher.z - game.state.player.position[2],
      ),
    ).toBeLessThan(2);
  });

  it('114 in a LAN room: the nearest player in the hall is told off and slapped, in their game', async () => {
    const game = await inHub();
    const e = game.emergency;
    const character = game.content.characters.all()[1]!;
    game.peers.joined({ id: 'ABC234', name: 'Lớp 11A', host: 'An', players: 2, max: 8 }, 'p1', [
      { id: 'p2', name: 'An', character },
    ]);
    // The caller far off at the hall's edge; An right where they come down.
    game.state.player.position = [10, 0, 4];
    const hits: string[] = [];
    game.events.subscribe('PeerHit', ({ id }) => hits.push(id));
    expect(e.call('114')).toBe('dispatched');
    const [ax, az] = e.squad!.arrival.at;
    until(
      game,
      () => {
        game.peers.pose('p2', {
          scene: 'simlab-hub',
          x: ax + 1.5,
          y: 0,
          z: az + 1,
          yaw: 0,
          speed: 0,
        });
        return e.phase === 'regroup';
      },
      150,
    );
    expect(hits).toEqual(['p2']);
  });

  it('113 for nothing: the police land puzzled, ask the teacher, warn the caller, and go', async () => {
    const game = await inHub();
    const e = game.emergency;
    const lines: string[] = [];
    let last = 0;
    const listen = () => {
      if (e.line && e.line.n !== last) {
        last = e.line.n;
        lines.push(`${e.line.who}: ${e.line.text}`);
      }
    };
    expect(e.call('113')).toBe('dispatched');
    expect(e.phase).toBe('inbound');
    expect(e.heli.visible).toBe(true);
    expect(e.eta).toBeGreaterThan(10);
    // The blast: the ceiling open, the camera shaken.
    until(game, () => e.blast >= 0, 15);
    expect(e.phase).toBe('breach');
    expect(e.breach).toBe(1);
    expect(e.shake).toBeGreaterThan(0.9);
    // Down the ropes, one after another.
    until(game, () => e.phase === 'mission', 10);
    expect(e.views.every((v) => v.visible && v.y === 0)).toBe(true);
    let asked = false;
    until(
      game,
      () => {
        listen();
        asked ||= game.npcs.engaged('teacher'); // answering them (aside)
        return e.phase === 'regroup';
      },
      120,
    );
    expect(asked).toBe(true);
    expect(lines.some((l) => l.startsWith('Police: Excuse me, sir.'))).toBe(true);
    expect(lines.some((l) => /^Mr\. .*: No, nothing at all/.test(l))).toBe(true);
    expect(lines.some((l) => l.includes('This is a warning'))).toBe(true);
    // Back up, the helicopter gone, the ceiling mending; then all whole again.
    until(game, () => e.phase === 'outbound', 60);
    expect(e.views.every((v) => !v.visible)).toBe(true);
    until(game, () => e.phase === 'repair', 10);
    expect(e.heli.visible).toBe(false);
    run(game, 10);
    expect(e.breach).toBeGreaterThan(0);
    expect(e.breach).toBeLessThan(1);
    until(game, () => e.phase === 'idle', 30);
    expect(e.breach).toBe(0);
  });

  it('114 with nothing burning: the firefighters find the caller, tell them off, and slap them', async () => {
    const game = await inHub();
    const e = game.emergency;
    const hits: string[] = [];
    game.events.subscribe('PlayerHit', ({ entityId }) => hits.push(entityId));
    expect(e.call('114')).toBe('dispatched');
    until(game, () => hits.length > 0, 90);
    expect(hits).toEqual(['responder:fire-squad']);
    const leader = e.views[0]!;
    const p = game.state.player.position;
    const o = game.scenes.offsetOf(leader.sceneId)!;
    expect(Math.hypot(leader.x + o[0] - p[0], leader.z + o[2] - p[2])).toBeLessThan(1.4);
    until(game, () => e.phase === 'idle', 90);
    expect(e.views).toHaveLength(0);
  });

  it('their legs step by the ground they cover (Phú 2026-11-19): none slides, standing they stand, after a walking caller they walk', async () => {
    const game = await inHub();
    const e = game.emergency;
    expect(e.call('114')).toBe('dispatched');
    until(game, () => e.phase === 'mission', 25);
    const last = e.views.map((v) => ({ x: v.x, z: v.z, stride: v.stride, still: 0 }));
    let walked = 0;
    let steps = 0;
    let slid = 0;
    let stoodWalking = 0;
    // Told off, the caller walks slowly away (1 m/s) along the hall: the leader steps after them.
    let from: [number, number] | null = null;
    let away = 0;
    const leaderPace: number[] = [];
    let heard = 0;
    game.events.subscribe('NpcFootstep', ({ npcId }) => {
      if (npcId.startsWith('responder-')) heard++;
    });
    until(
      game,
      () => {
        const off = game.scenes.offsetOf('simlab-hub')!;
        if (!from && e.line?.text.includes('Who called 114')) {
          const p = game.state.player.position;
          from = [p[0] - off[0], p[2] - off[2]];
        }
        if (from && away < 6) {
          away += H;
          game.state.player.position = [from[0] + away + off[0], 0, from[1] + off[2]];
        }
        e.views.forEach((v, i) => {
          const l = last[i]!;
          const moved = Math.hypot(v.x - l.x, v.z - l.z);
          const turned = (v.stride - l.stride + 2 * Math.PI) % (2 * Math.PI);
          if (v.visible && v.action !== 'rappel' && v.action !== 'climb' && moved < 1) {
            walked += moved;
            steps += turned / Math.PI;
            if (moved > 0.002 && turned === 0) slid++;
            l.still = moved === 0 ? l.still + H : 0;
            if (l.still > 0.6 && (v.speed > 0 || turned > 0)) stoodWalking++;
            if (i === 0 && from && away > 2 && away < 6 && moved > 0) leaderPace.push(v.speed);
          }
          l.x = v.x;
          l.z = v.z;
          l.stride = v.stride;
        });
        return e.phase === 'regroup';
      },
      120,
    );
    expect(e.phase).toBe('regroup');
    expect(walked).toBeGreaterThan(20);
    expect(slid).toBe(0); // every move a step
    // A foot heard as each comes down (none shuffling slower than 0.35 m/s).
    expect(heard).toBeGreaterThan(steps * 0.8);
    expect(heard).toBeLessThanOrEqual(Math.ceil(steps) + 4);
    expect(stoodWalking).toBe(0); // still, the legs still
    // A step as the body draws it: 0.75 m walking … 1.35 m running.
    expect(walked / steps).toBeGreaterThan(0.74);
    expect(walked / steps).toBeLessThan(1.36);
    // Beside a caller walking at 1 m/s he walks too, all along (not a run in and a stop).
    expect(leaderPace.length).toBeGreaterThan(Math.round(3 / H) * 0.8);
    const mean = leaderPace.reduce((a, b) => a + b, 0) / leaderPace.length;
    expect(mean).toBeGreaterThan(0.8);
    expect(mean).toBeLessThan(1.3);
  });

  it('114 with a fire in a lab, the hall not drawn: they come in through its door, opened for them, never through it shut', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.scenes.load('simlab-hub'); // developer jump (setup only)
    run(game, 0.5);
    await game.scenes.load('chemistry-lab'); // the hall behind its shut door: not drawn
    run(game, 0.5);
    expect(game.scenes.offsetOf('simlab-hub')).toBeNull();
    const e = game.emergency;
    expect(game.fires.ignite('chemistry-lab/titration')).toBe(true);
    const asked: string[] = [];
    game.events.subscribe('DoorRequested', ({ entityId }) => asked.push(entityId));
    expect(e.call('114')).toBe('dispatched');
    const came = new Map<number, number>();
    const comingIn: string[] = [];
    const whilePassing = new Set<string>();
    let frame = 0;
    let t = 0;
    for (; t < 150 && e.views.filter((v) => v.action === 'spray').length < 4; t += H) {
      game.update(H);
      if (++frame % 15 === 0) await flush();
      e.views.forEach((v, i) => {
        if (v.sceneId !== 'chemistry-lab' || came.has(i)) return;
        came.set(i, t);
        // The moment each one comes in: the door open before them.
        comingIn.push(
          `${game.doors.state('chemistry-lab/door-hub')} ${game.doors.fraction('simlab-hub/door-chemistry') > 0.9}`,
        );
      });
      // From the first in until the last is through (a crossing takes 1.3 s): open all along.
      const times = [...came.values()];
      if (times.length > 0 && t < Math.max(...times) + 1.3) {
        whilePassing.add(game.doors.state('chemistry-lab/door-hub') ?? 'none');
      }
    }
    // Asked by the lab's leaf (the hall behind it brought in first), never pushed open unseen.
    expect(asked[0]).toBe('chemistry-lab/door-hub');
    expect(came.size).toBe(4);
    expect(comingIn.every((s) => /^(opening|open) true$/.test(s))).toBe(true);
    expect([...whilePassing].filter((s) => s !== 'opening' && s !== 'open')).toEqual([]);
    // One behind another, the leader first.
    const order = [...came.entries()].sort((a, b) => a[1] - b[1]);
    expect(order[0]?.[0]).toBe(0);
    for (let k = 1; k < order.length; k++) {
      expect(order[k]![1] - order[k - 1]![1]).toBeGreaterThan(0.25);
    }
    expect(e.views.every((v) => v.action === 'spray')).toBe(true);
  });

  it('leaving the world ends a call at once, the ceiling whole', async () => {
    const game = await inHub();
    game.emergency.call('911');
    run(game, 12);
    expect(game.emergency.breach).toBe(1);
    await game.scenes.load('main-menu');
    run(game, 0.1);
    expect(game.emergency.phase).toBe('idle');
    expect(game.emergency.breach).toBe(0);
  });
});
