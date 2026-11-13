import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { posesFor } from './HandsView';

// The hand-hygiene motions as the body's hands act them out (unturned: palm down, fingers ahead,
// thumb inwards): palm to palm means the two palms face each other, thumbs up — never back to back.

type Pose = [number, number, number, number, number, number];
const facing = (pose: Pose, local: THREE.Vector3) =>
  local.applyEuler(new THREE.Euler(pose[3], pose[4], pose[5]));

describe('hand-hygiene motions', () => {
  it.each(['rub-palms', 'sanitize', 'rub-fingers', 'rub-thumbs', 'dry'] as const)(
    '%s: palm to palm, thumbs up',
    (motion) => {
      for (const t of [0, 0.1, 0.25, 0.4]) {
        const l: Pose = [0, 0, 0, 0, 0, 0];
        const r: Pose = [0, 0, 0, 0, 0, 0];
        posesFor(motion, t, l, r);
        expect(l[0]).toBeLessThan(r[0]); // the left hand on the left
        expect(facing(l, new THREE.Vector3(0, -1, 0)).x, 'left palm').toBeGreaterThan(0.5);
        expect(facing(r, new THREE.Vector3(0, -1, 0)).x, 'right palm').toBeLessThan(-0.5);
        expect(facing(l, new THREE.Vector3(1, 0, 0)).y, 'left thumb').toBeGreaterThan(0.5);
        expect(facing(r, new THREE.Vector3(-1, 0, 0)).y, 'right thumb').toBeGreaterThan(0.5);
      }
    },
  );

  it('rub-backs: one palm down on the back of the other hand', () => {
    const l: Pose = [0, 0, 0, 0, 0, 0];
    const r: Pose = [0, 0, 0, 0, 0, 0];
    posesFor('rub-backs', 0, l, r);
    expect(facing(r, new THREE.Vector3(0, -1, 0)).y).toBeLessThan(-0.9); // the rubbing palm, down
    expect(r[1]).toBeGreaterThan(l[1]); // over the other hand
  });
});
