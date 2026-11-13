import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bootTestGame } from '../../game/testing';
import { SELF_LAYER } from './body/BodyModel';
import { Mirrors, reflectedOffset, screenRect } from './mirrors';
import { QUALITY } from './quality';

const reflectors = (mirrors: Mirrors) =>
  mirrors.group.children.filter((o) => (o as { isReflector?: boolean }).isReflector);

async function preparationRoom() {
  const { game } = await bootTestGame();
  await game.newGame('researcher-female'); // the preparation room
  const mirror = game.world.entity('preparation-room/mirror');
  if (!mirror) throw new Error('no mirror in the preparation room');
  return { game, mirror };
}

describe('mirrors (Phase H-1)', () => {
  it('reflect at the preset’s scale: High whole, Medium half, Low none', () => {
    expect([QUALITY.low.mirrorScale, QUALITY.medium.mirrorScale, QUALITY.high.mirrorScale]).toEqual(
      [0, 0.5, 1],
    );
  });

  it('lay a reflection over the glass, facing the room, that sees the whole body', async () => {
    const { game, mirror } = await preparationRoom();
    const hands = new THREE.Group();
    const mirrors = new Mirrors(hands);
    mirrors.add(mirror);
    expect(reflectors(mirrors)).toHaveLength(0); // no scale yet (Low): the glass alone
    mirrors.setScale(1, 1600, 900);
    const [reflector] = reflectors(mirrors);
    if (!reflector) throw new Error('no reflection');
    // On the west wall (x −3), its glass 1.5 cm proud of it, facing east into the room.
    const at = reflector.getWorldPosition(new THREE.Vector3());
    expect(at.x).toBeCloseTo(-3 + 0.03 - 0.004 + 0.0005, 4);
    expect(at.y).toBeCloseTo(0.15 + 0.8, 6);
    const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(
      reflector.getWorldQuaternion(new THREE.Quaternion()),
    );
    expect(facing.x).toBeCloseTo(1, 4);
    const camera = new THREE.PerspectiveCamera();
    const reflection = (
      reflector as unknown as { getReflectionCamera(c: THREE.Camera): THREE.Camera }
    ).getReflectionCamera(camera);
    expect(reflection.layers.isEnabled(0)).toBe(true);
    expect(reflection.layers.isEnabled(SELF_LAYER)).toBe(true); // the head and arms
    // Out of range it is not drawn; near, it is.
    mirrors.update(new THREE.Vector3(2.5, 1.6, 0));
    expect(reflector.visible).toBe(true);
    mirrors.update(new THREE.Vector3(10, 1.6, 0));
    expect(reflector.visible).toBe(false);
    // Off (Low) and removed: nothing left.
    mirrors.setScale(0, 1600, 900);
    expect(reflectors(mirrors)).toHaveLength(0);
    mirrors.setScale(0.5, 1600, 900);
    expect(reflectors(mirrors)).toHaveLength(1);
    mirrors.remove(mirror.id);
    expect(reflectors(mirrors)).toHaveLength(0);
    mirrors.dispose();
    game.dispose();
  });

  it('draw a reflection for the glass’s own part of the view, never past its edges', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 50);
    camera.position.set(0, 1.6, 2);
    camera.updateMatrixWorld();
    const vp = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    // A 0.5 × 1.2 m glass straight ahead: a narrow, tall rectangle in the middle of the view.
    const glass = [
      [-0.25, 1, 0],
      [0.25, 1, 0],
      [-0.25, 2.2, 0],
      [0.25, 2.2, 0],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const rect = screenRect(glass, vp, 1920, 1080)!;
    expect(rect.x + rect.w / 2).toBeCloseTo(960, -1);
    expect(rect.w).toBeLessThan(1920 / 3);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.h).toBeLessThanOrEqual(1080);
    // A corner behind the eye, or a glass filling the view: the whole view instead.
    const behind = glass.map((p) => p.clone().setZ(p.z + (p.x < 0 ? 3 : 0)));
    expect(screenRect(behind, vp, 1920, 1080)).toBeNull();
    const close = glass.map((p) =>
      p
        .clone()
        .multiplyScalar(4)
        .setZ(1.9)
        .setY(p.y * 4 - 4.8),
    );
    expect(screenRect(close, vp, 1920, 1080)).toBeNull();
  });

  it('crop the reflection where the glass is in the reflected view: off the middle too', () => {
    // A glass on the wall x = 0 facing +x, seen from aside and turned: well off the view's middle.
    const width = 1600;
    const height = 900;
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.05, 50);
    camera.position.set(2, 1.6, 1.2);
    camera.lookAt(0, 1.2, 1.4);
    camera.updateMatrixWorld();
    const normal = new THREE.Vector3(1, 0, 0);
    const centre = new THREE.Vector3(0, 1.2, 0);
    const glass = [
      [0, 0.6, -0.25],
      [0, 0.6, 0.25],
      [0, 1.8, -0.25],
      [0, 1.8, 0.25],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const vp = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    const rect = screenRect(glass, vp, width, height)!;
    expect(Math.abs(rect.x + rect.w / 2 - width / 2)).toBeGreaterThan(200); // off the middle
    // The reflected camera as three's Reflector makes it (a turn: lookAt with a reflected up).
    const reflect = (p: THREE.Vector3) => p.clone().sub(centre).reflect(normal).add(centre);
    const virtual = new THREE.PerspectiveCamera();
    virtual.copy(camera, false);
    const [x, y] = reflectedOffset(rect, width);
    virtual.setViewOffset(width, height, x, y, rect.w, rect.h);
    virtual.position.copy(reflect(camera.position));
    const rotation = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    virtual.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
    const ahead = new THREE.Vector3(0, 0, -1).applyMatrix4(rotation).add(camera.position);
    virtual.lookAt(reflect(ahead));
    virtual.updateMatrixWorld();
    // Every corner of the glass lands inside the reflection's crop.
    for (const p of glass) {
      const ndc = p.clone().project(virtual);
      expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1.02);
      expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1.02);
    }
    // Cropped where the glass is in the player's view instead, it falls outside (the streaks).
    virtual.setViewOffset(width, height, rect.x, rect.y, rect.w, rect.h);
    const outside = glass.some((p) => Math.abs(p.clone().project(virtual).x) > 1.5);
    expect(outside).toBe(true);
  });
});
