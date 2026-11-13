import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import { CharacterDefinitionSchema } from '../../../gameplay/character';
import { Actor } from './actor';
import type { PersonView } from './person';

// Another player's body acting out what they do (2026-11-12): their view's pitch in the head,
// the phone at the chest while dialling, a test paper and a pen while doing a test.

const character = CharacterDefinitionSchema.parse((bundledContent.characters as unknown[])[0]);

function settle(actor: Actor, view: PersonView): void {
  for (let f = 0; f < 120; f++) actor.update(view, 1 / 60, f / 60, null);
}

const person = (more: Partial<PersonView> = {}): PersonView => ({
  id: 'p',
  x: 0,
  z: 0,
  heading: 0,
  speed: 0,
  sit: false,
  gesture: 'idle',
  look: null,
  called: false,
  ...more,
});

describe('another player acted out', () => {
  it('the head follows their view down', () => {
    const actor = new Actor(character, new THREE.MeshBasicMaterial(), 0);
    settle(actor, person());
    const level = actor.model.bones.head.rotation.x;
    settle(actor, person({ pitch: -0.8 }));
    expect(actor.model.bones.head.rotation.x).toBeLessThan(level - 0.4);
  });

  it('dialling shows the phone at the chest; a test shows the paper and a pen', () => {
    const actor = new Actor(character, new THREE.MeshBasicMaterial(), 0);
    const shown = (name: string) => actor.group.getObjectByName(name)?.visible;
    settle(actor, person({ gesture: 'dial' }));
    expect(shown('phone')).toBe(true);
    const hand = actor.model.bones.handR.getWorldPosition(new THREE.Vector3());
    expect(hand.y).toBeGreaterThan(0.9); // up before the chest, not hanging by the hip
    settle(actor, person({ gesture: 'test', pen: 'blue' }));
    expect(shown('phone')).toBe(false);
    expect(shown('test-sheet')).toBe(true);
    settle(actor, person({ gesture: 'hands' }));
    expect(shown('test-sheet')).toBe(false);
    const left = actor.model.bones.handL.getWorldPosition(new THREE.Vector3());
    expect(left.y).toBeGreaterThan(0.85);
    expect(left.z).toBeLessThan(-0.1); // out in front (the body faces −z)
  });
});
