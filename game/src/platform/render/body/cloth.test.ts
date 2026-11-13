import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type BodyShape, BONES, buildBody, SKIRT_BONES, type Surface, SURFACES } from './BodyModel';
import { Cloth } from './cloth';

// C-5: the sculpted face, the skin bending at the joints, the skirt's cloth.

const materials = Object.fromEntries(
  SURFACES.map((s) => [s, new THREE.MeshStandardMaterial()]),
) as Record<Surface, THREE.MeshStandardMaterial>;
const SHADOW = new THREE.MeshBasicMaterial();
const BASE: BodyShape = {
  heightM: 1.7,
  shoulderM: 0.37,
  hipM: 0.41,
  waistM: 0.25,
  bustM: 0.045,
  build: 1,
  muscle: 0,
  watch: false,
  earrings: false,
  hair: 'bun',
  lashes: true,
  blush: false,
  neck: 'crew',
  skirt: true,
  glasses: 'none',
  beard: false,
};
const meshOf = (body: ReturnType<typeof buildBody>, surface: Surface) =>
  body.meshes.find((m) => m.userData.surface === surface)!;
/** Every vertex of a surface where it is drawn now (skinned). */
function drawn(body: ReturnType<typeof buildBody>, surface: Surface): THREE.Vector3[] {
  body.group.updateMatrixWorld(true);
  const mesh = meshOf(body, surface);
  mesh.skeleton.update();
  const count = mesh.geometry.getAttribute('position').count;
  return Array.from({ length: count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()));
}

describe('the sculpted face', () => {
  it('is one smooth surface whose most forward point is the nose, facing out', () => {
    const body = buildBody({ ...BASE, lashes: false }, materials, SHADOW);
    const skin = meshOf(body, 'skin').geometry;
    const p = skin.getAttribute('position');
    const n = skin.getAttribute('normal');
    const eyeY = 0.93 * BASE.heightM;
    let front = 0;
    let at = -1;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < eyeY - 0.12 || p.getY(i) > eyeY + 0.1) continue; // the face, not the neck
      if (p.getZ(i) < front) {
        front = p.getZ(i);
        at = i;
      }
    }
    expect(Math.abs(p.getX(at))).toBeLessThan(0.006);
    expect(Math.abs(p.getY(at) - (eyeY - 0.037))).toBeLessThan(0.008); // the nose's tip
    expect(n.getZ(at)).toBeLessThan(-0.8); // facing out of the face
  });
});

describe('the skin at the joints', () => {
  it('blends an elbow: the sleeve near it bends half with each bone', () => {
    const body = buildBody(BASE, materials, SHADOW);
    const top = meshOf(body, 'top').geometry;
    const weight = top.getAttribute('skinWeight');
    const elbow = body.bones.foreArmR.getWorldPosition(new THREE.Vector3());
    const p = top.getAttribute('position');
    const v = new THREE.Vector3();
    let shared = 0;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += weight.getComponent(i, k);
      expect(sum).toBeCloseTo(1, 5);
      if (v.distanceTo(elbow) > 0.05) continue;
      const bones = [0, 1, 2, 3].filter((k) => weight.getComponent(i, k) > 0.2);
      if (bones.length >= 2) shared++;
    }
    expect(shared).toBeGreaterThan(20);
  });
});

describe('the skirt’s cloth', () => {
  const settle = (cloth: Cloth, seconds: number, seat = 0) => {
    for (let t = 0; t < seconds; t += 1 / 60) cloth.step(1 / 60, seat);
  };

  it('hangs still on a body standing still', () => {
    const body = buildBody(BASE, materials, SHADOW);
    const cloth = new Cloth(body);
    settle(cloth, 2);
    for (const swing of cloth.swings()) expect(Math.abs(swing)).toBeLessThan(0.01);
  });

  it('seated, lies over the lap in front and on the seat behind; the legs never through it', () => {
    const body = buildBody(BASE, materials, SHADOW);
    const cloth = new Cloth(body);
    body.bones.thighL.rotation.x = 1.5;
    body.bones.thighR.rotation.x = 1.5;
    body.bones.shinL.rotation.x = -1.5;
    body.bones.shinR.rotation.x = -1.5;
    const hip = body.bones.thighL.getWorldPosition(new THREE.Vector3()).y;
    body.group.position.y = -(hip - 0.47);
    settle(cloth, 2, 0.47);
    const swings = cloth.swings();
    const front = swings[SKIRT_BONES.length / 2] ?? 0; // π: in front
    expect(front).toBeGreaterThan(1.1);
    expect(swings[0]).toBeGreaterThan(1.1); // behind, on the seat
    // The tights: none of their points above the dress's hem out in front of it.
    const dress = drawn(body, 'top');
    const hemFront = Math.min(...dress.map((p) => p.z));
    const knee = body.bones.shinL.getWorldPosition(new THREE.Vector3());
    expect(hemFront).toBeLessThan(knee.z);
  });

  it('trails behind a body walking off, and swings back when it stops', () => {
    const body = buildBody(BASE, materials, SHADOW);
    const cloth = new Cloth(body);
    settle(cloth, 0.5);
    for (let t = 0; t < 1.5; t += 1 / 60) {
      body.group.position.z -= 1.5 / 60; // facing −z: forward
      cloth.step(1 / 60);
    }
    expect(cloth.swings()[0]).toBeGreaterThan(0.05); // the back panel out behind
    settle(cloth, 3);
    expect(Math.abs(cloth.swings()[0] ?? 1)).toBeLessThan(0.02);
  });
});

describe('a dress over the legs', () => {
  it('covers the thighs at the hips, whatever the figure', () => {
    for (const shape of [BASE, { ...BASE, hipM: 0.35, waistM: 0.26, bustM: 0.02, build: 0.9 }]) {
      const body = buildBody(shape, materials, SHADOW);
      const h = shape.heightM;
      const legs = drawn(body, 'bottom').filter((p) => p.y > 0.34 * h && p.y < 0.56 * h);
      // The dress: the top's points that hang from the skirt's bones (not the seat under it, the
      // sleeves or the cuffs).
      const top = meshOf(body, 'top').geometry;
      const index = top.getAttribute('skinIndex');
      const weight = top.getAttribute('skinWeight');
      const hung = new Set(SKIRT_BONES.map((name) => BONES.indexOf(name)));
      const dress: THREE.Vector3[] = [];
      const p = top.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const hangs = [0, 1, 2, 3].some(
          (k) => hung.has(index.getComponent(i, k)) && weight.getComponent(i, k) > 0,
        );
        if (hangs) {
          dress.push(new THREE.Vector3().fromBufferAttribute(p, i));
        }
      }
      // The dress's points by their angle round the body, in bins: a leg point looks at its own.
      const BINS = 120;
      const binOf = (q: THREE.Vector3) =>
        Math.floor(((Math.atan2(q.x, q.z) / (2 * Math.PI) + 1) % 1) * BINS) % BINS;
      const bins = Array.from({ length: BINS }, (): THREE.Vector3[] => []);
      for (const q of dress) bins[binOf(q)]?.push(q);
      for (const leg of legs) {
        const b = binOf(leg);
        const around = [-2, -1, 0, 1, 2].flatMap((d) => bins[(b + d + BINS) % BINS] ?? []);
        // The dress's radius there: between its nearest rows above and below the point.
        const above = around.filter((q) => q.y >= leg.y);
        const below = around.filter((q) => q.y < leg.y);
        if (above.length === 0 || below.length === 0) continue;
        const ya = Math.min(...above.map((q) => q.y));
        const yb = Math.max(...below.map((q) => q.y));
        const ra = Math.max(
          ...above.filter((q) => q.y - ya < 1e-4).map((q) => Math.hypot(q.x, q.z)),
        );
        const rb = Math.max(
          ...below.filter((q) => yb - q.y < 1e-4).map((q) => Math.hypot(q.x, q.z)),
        );
        const outer = rb + ((ra - rb) * (leg.y - yb)) / (ya - yb);

        expect(Math.hypot(leg.x, leg.z)).toBeLessThanOrEqual(outer + 0.002);
      }
    }
  });
});

describe('the bust (C-6)', () => {
  it('is fullest at the chest’s height, rounder below than above, and the coat goes over it', () => {
    const shape: BodyShape = { ...BASE, neck: 'collar', skirt: false };
    const body = buildBody(shape, materials, SHADOW);
    const h = shape.heightM;
    const top = meshOf(body, 'top').geometry.getAttribute('position');
    // The shirt's most forward point, off the middle line (one breast).
    let front = 0;
    let at = 0;
    for (let i = 0; i < top.count; i++) {
      const x = Math.abs(top.getX(i));
      if (x < 0.03 || x > 0.11 || top.getY(i) < 0.6 * h || top.getY(i) > 0.8 * h) continue;
      if (top.getZ(i) < front) {
        front = top.getZ(i);
        at = top.getY(i);
      }
    }
    expect(at / h).toBeGreaterThan(0.69);
    expect(at / h).toBeLessThan(0.74);
    // The coat's front over the fullest point is further out than the shirt's.
    const coat = meshOf(body, 'coat').geometry.getAttribute('position');
    let coatFront = 0;
    for (let i = 0; i < coat.count; i++) {
      const x = Math.abs(coat.getX(i));
      if (x < 0.06 || x > 0.09 || Math.abs(coat.getY(i) - at) > 0.01) continue;
      coatFront = Math.min(coatFront, coat.getZ(i));
    }
    let shirtThere = 0;
    for (let i = 0; i < top.count; i++) {
      const x = Math.abs(top.getX(i));
      if (x < 0.06 || x > 0.09 || Math.abs(top.getY(i) - at) > 0.01) continue;
      shirtThere = Math.min(shirtThere, top.getZ(i));
    }
    expect(coatFront).toBeLessThan(shirtThere);
  });
});
