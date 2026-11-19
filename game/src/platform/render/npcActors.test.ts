import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import type { Game } from '../../game/Game';
import { NpcDefinitionSchema } from '../../gameplay/npc/npc';
import type { NpcView } from '../../gameplay/npc/NpcSystem';
import type { ContactShadows } from './contactShadows';
import { NpcActors } from './npcActors';

// The world's people (2026-11-13): built during a load for its scene and the scenes next door,
// hidden while their scene is not resident and kept — a door never builds one in its frame.

const teacher = NpcDefinitionSchema.parse((bundledContent.npcs as unknown[])[0]);

function people() {
  const view = {
    npc: teacher,
    sceneId: 'simlab-hub',
    x: 1,
    z: 2,
    heading: 0,
    speed: 0,
    sit: 0,
    gesture: 'idle',
    stride: 0,
    card: false,
    paper: 'none',
    pen: 'none',
    reaching: false,
    point: null,
    looking: false,
    lookX: 0,
    lookZ: 0,
    progress: null,
  } as unknown as NpcView;
  const resident = new Set<string>();
  const game = {
    npcs: { views: [view] },
    graphicsQuality: 'medium',
    scenes: { offsetOf: (id: string) => (resident.has(id) ? [0, 0, 0] : null) },
  } as unknown as Game;
  const shadows = new Set<string>();
  const contact = {
    place: (id: string) => shadows.add(id),
    remove: (id: string) => shadows.delete(id),
  } as unknown as ContactShadows;
  const parent = new THREE.Group();
  const actors = new NpcActors(parent, game, contact);
  const drawn = () => parent.getObjectByName(`npc-${teacher.id}`) ?? null;
  return { actors, resident, shadows, drawn };
}

describe('the world people drawn', () => {
  it('builds the people of the scenes asked, hidden; none of the others', () => {
    const { actors, drawn } = people();
    actors.prepare(new Set(['physics-lab']));
    expect(drawn()).toBeNull();
    actors.prepare(new Set(['physics-lab', 'simlab-hub']));
    expect(drawn()?.visible).toBe(false);
    actors.dispose();
  });

  it('shows the one built ahead when their scene comes; hides and keeps it when it goes', () => {
    const { actors, resident, shadows, drawn } = people();
    actors.prepare(new Set(['simlab-hub']));
    const built = drawn();
    resident.add('simlab-hub');
    actors.update(1 / 60);
    expect(drawn()).toBe(built);
    expect(built?.visible).toBe(true);
    expect(shadows.has(`npc-${teacher.id}`)).toBe(true);
    let freed = 0;
    built?.traverse((o) =>
      (o as Partial<THREE.Mesh>).geometry?.addEventListener('dispose', () => freed++),
    );
    resident.delete('simlab-hub');
    actors.update(1 / 60);
    expect(drawn()).toBe(built);
    expect(built?.visible).toBe(false);
    expect(shadows.size).toBe(0);
    expect(freed).toBeGreaterThan(3); // its buffers, uploaded again when it is next drawn
    resident.add('simlab-hub');
    actors.update(1 / 60);
    expect(drawn()).toBe(built); // the same body: never built again
    actors.dispose();
    expect(drawn()).toBeNull();
  });
});
