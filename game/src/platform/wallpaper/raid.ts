import * as THREE from 'three';
import responders from '../../content/responders.json';
import { ResponderSquadSchema } from '../../gameplay/emergency/squad';
import { Helicopter } from '../render/emergency/helicopter';
import { blownAt, heliAt, type HeliPose, RAID, ropesAt, slideAt } from './raidPlan';

/*
 * The raid drawn (Phase W-5, times in `raidPlan.ts`): the game's police helicopter (its own model,
 * `render/emergency/helicopter.ts`), two ropes, four of the squad sliding down them, and the blast
 * at the oculus — a flash that lights the lab, a fireball, a ring of shock, glass and panel bits
 * thrown out and falling, smoke rolling up and drifting downwind for a minute, the hole glowing
 * inside. All made once; particles live in fixed pools (nothing allocated per frame).
 */

export interface RaidView {
  readonly group: THREE.Group;
  /**
   * The blast's flash, to be added to the scene apart from the group: it must always be in the
   * scene (dark between raids). Inside the group, hidden with it between raids, the scene lost a
   * light at each raid's end and gained one at the next, and three rebuilt every program it
   * lights each time (the whole city: a long stall).
   */
  readonly light: THREE.PointLight;
  /** `t`: seconds into the raid (negative or past its end: nothing shown); `at`: the oculus (world). */
  update(
    t: number,
    dt: number,
    at: THREE.Vector3,
    night: number,
    camera: THREE.PerspectiveCamera,
    height: number,
  ): void;
  /** Whether the oculus's glass is blown at `t`. */
  blown(t: number): boolean;
  dispose(): void;
}

const SMOKE = 110;
const FIRE = 40;
const DEBRIS = 36;

const POINTS_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const POINTS_FRAGMENT = /* glsl */ `
uniform vec3 uColour;
uniform sampler2D uMap;
varying float vAlpha;
void main() {
  vec4 c = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(uColour * c.rgb, c.a * vAlpha);
}`;

/** A soft round puff with some lumps (for smoke and fire). */
function puffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) throw new Error('no 2D canvas for the smoke');
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 14; i++) {
    const x = 64 + (rnd() - 0.5) * 40;
    const y = 64 + (rnd() - 0.5) * 40;
    const r = 22 + rnd() * 26;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

function pool(count: number, colour: string, additive: boolean, map: THREE.Texture) {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const alpha = new Float32Array(count);
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: 1 },
      uColour: { value: new THREE.Color(colour) },
      uMap: { value: map },
    },
    vertexShader: POINTS_VERTEX,
    fragmentShader: POINTS_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, position, size, alpha, geometry, material };
}

/** A small deterministic hash: each particle's own spread, the same every raid. */
const h = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function raidView(): RaidView {
  const group = new THREE.Group();
  group.name = 'wallpaper-raid';
  const raw = (responders as unknown[]).find((s) => (s as { id?: string }).id === 'police-squad');
  const heli = new Helicopter(ResponderSquadSchema.parse(raw));
  group.add(heli.group);
  const pose: HeliPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, bank: 0, rotor: 1, visible: false };
  const view = { visible: false, x: 0, y: 0, z: 0, yaw: 0, bank: 0, pitch: 0, rotor: 1 };

  // Ropes: thin dark cylinders from the doors down to the hole, scaled to how far they hang.
  const ropeMaterial = new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.9 });
  const ropeGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1, 5).translate(0, -0.5, 0);
  const rope = (side: number) => {
    const r = new THREE.Mesh(ropeGeometry, ropeMaterial);
    r.userData.side = side;
    group.add(r);
    return r;
  };
  const ropes = [rope(-1), rope(1)] as const;
  // The four: a dark body, a helmet, a pack.
  const kit = new THREE.MeshStandardMaterial({ color: '#1e2633', roughness: 0.8 });
  const helmet = new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.5 });
  const bodyGeometry = new THREE.CapsuleGeometry(0.22, 1.1, 4, 8);
  const headGeometry = new THREE.SphereGeometry(0.15, 10, 8);
  const squad = [0, 1, 2, 3].map(() => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(bodyGeometry, kit);
    b.position.y = -0.85;
    const hd = new THREE.Mesh(headGeometry, helmet);
    hd.position.y = -0.1;
    g.add(b, hd);
    group.add(g);
    return g;
  });

  // The blast: a flash light (always there, so no shader is rebuilt when it fires), a fireball,
  // the shock ring, the hole's glow, the smoke, the bits.
  const flash = new THREE.PointLight('#ffb36b', 0, 0, 2);
  const puff = puffTexture();
  const fire = pool(FIRE, '#ffa043', true, puff);
  const smoke = pool(SMOKE, '#8a847c', false, puff);
  group.add(smoke.points, fire.points);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: '#ffd2a0',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  const holeMaterial = new THREE.MeshBasicMaterial({
    color: '#ff7a2a',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32), holeMaterial);
  hole.rotation.x = -Math.PI / 2;
  group.add(hole);
  const debrisMaterial = new THREE.MeshStandardMaterial({
    color: '#b9c6cf',
    metalness: 0.6,
    roughness: 0.3,
  });
  const debris = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.06, 0.6),
    debrisMaterial,
    DEBRIS,
  );
  debris.frustumCulled = false;
  group.add(debris);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const door = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  return {
    group,
    light: flash,
    blown: blownAt,
    update(t, dt, at, night, camera, height) {
      const active = t >= -1 && t < RAID.mended + 2;
      group.visible = active;
      if (!active) return;
      heliAt(t, pose);
      Object.assign(view, pose);
      view.y += RAID.hover;
      heli.update(view, at.x, at.y, at.z, dt, t, night);
      // Ropes from either side of the cabin down towards the hole, and the four on them.
      const hang = ropesAt(t);
      for (const r of ropes) {
        r.visible = hang > 0.01 && pose.visible;
        door
          .set((r.userData.side as number) * 1.1, RAID.hover - 0.4, 0)
          .applyAxisAngle(Y, pose.yaw);
        r.position.set(at.x + pose.x + door.x, at.y + pose.y + door.y, at.z + pose.z + door.z);
        r.scale.set(1, RAID.rope * hang, 1);
      }
      squad.forEach((g, i) => {
        const u = slideAt(t, i);
        g.visible = u >= 0;
        if (u < 0) return;
        const r = ropes[i % 2 === 0 ? 0 : 1];
        g.position.copy(r.position).add(tmp.set(0, -RAID.rope * u, 0));
        g.rotation.y = pose.yaw;
      });

      // The blast and what it leaves.
      const since = t - RAID.blast;
      const blasted = since >= 0;
      flash.position.copy(at);
      flash.intensity = blasted ? 4.0e6 * Math.exp(-since * 9) * (1 + night) : 0;
      ring.visible = blasted && since < 1.2;
      if (ring.visible) {
        ring.position.copy(at).add(tmp.set(0, 0.5, 0));
        ring.scale.setScalar(3 + since * 70);
        ringMaterial.opacity = 0.7 * (1 - since / 1.2);
      }
      hole.visible = blownAt(t);
      hole.position.copy(at).add(tmp.set(0, -0.6, 0));
      holeMaterial.opacity = hole.visible
        ? Math.max(0, 1 - since / 50) * (0.6 + 0.2 * Math.sin(t * 9))
        : 0;
      const scale = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      (fire.material.uniforms.uScale as { value: number }).value = scale;
      (smoke.material.uniforms.uScale as { value: number }).value = scale;
      // Fire: a ball swelling in the first second and a half, then flames licking from the hole.
      for (let i = 0; i < FIRE; i++) {
        const born = i < 24 ? 0 : (i - 24) * 1.4;
        const life = i < 24 ? 1.6 : 2.2;
        const a = since - born;
        const loop = i < 24 ? a : a % (life * 8);
        const alive = blasted && a >= 0 && (i < 24 ? a < life : since < 40) && loop < life;
        const u = alive ? loop / life : 0;
        const dir = tmp.set(h(i, 1) - 0.5, 0.6 + h(i, 2), h(i, 3) - 0.5).normalize();
        const reach = i < 24 ? 20 * Math.sqrt(u) : 6 * u;
        fire.position[i * 3] = at.x + dir.x * reach;
        fire.position[i * 3 + 1] = at.y + 1 + dir.y * reach + (i < 24 ? 0 : 6 * u);
        fire.position[i * 3 + 2] = at.z + dir.z * reach;
        fire.size[i] = alive ? (i < 24 ? 22 + 30 * u : 8 + 8 * u) : 0;
        fire.alpha[i] = alive ? (1 - u) * (i < 24 ? 1 : 0.6) : 0;
        if (i === 0) {
          // The flash itself: a wide glare for half a second.
          const glare = blasted && since < 0.5;
          fire.position[0] = at.x;
          fire.position[1] = at.y + 3;
          fire.position[2] = at.z;
          fire.size[0] = glare ? 110 * (1 - since / 0.5) : 0;
          fire.alpha[0] = glare ? 1 : 0;
        }
      }
      // Smoke: born in the first seconds then steadily from the hole, rising, swelling, drifting.
      for (let i = 0; i < SMOKE; i++) {
        const born = i < 20 ? 0.1 * i : 2 + (i - 20) * 1.1;
        const life = 18;
        const a = since - born;
        const alive = blasted && a >= 0 && a < life && born < 60;
        const u = alive ? a / life : 0;
        smoke.position[i * 3] = at.x + (h(i, 4) - 0.5) * 22 + u * (60 + 50 * h(i, 12));
        smoke.position[i * 3 + 1] = at.y + 1 + 22 * u + 50 * u * u + h(i, 5) * 5;
        smoke.position[i * 3 + 2] = at.z + (h(i, 6) - 0.5) * 22 - u * (15 + 30 * h(i, 13));
        smoke.size[i] = alive ? 8 + (45 + 40 * h(i, 14)) * u : 0;
        smoke.alpha[i] = alive ? Math.min(1, a * 1.2) * (1 - u) * (1 - u) * 0.38 : 0;
      }
      for (const pl of [fire, smoke]) {
        for (const name of ['position', 'aSize', 'aAlpha'])
          pl.geometry.getAttribute(name).needsUpdate = true;
      }
      // Bits: thrown out and up, tumbling, falling away; gone after six seconds.
      for (let i = 0; i < DEBRIS; i++) {
        const live = blasted && since < 6;
        const v = 14 + 14 * h(i, 7);
        const ang = h(i, 8) * Math.PI * 2;
        const up = 10 + 14 * h(i, 9);
        const tt = Math.max(0, since);
        p.set(
          at.x + Math.cos(ang) * v * tt,
          at.y + 1 + up * tt - 4.9 * tt * tt,
          at.z + Math.sin(ang) * v * tt,
        );
        e.set(tt * (4 + 6 * h(i, 10)), tt * 5, tt * 3);
        q.setFromEuler(e);
        const k = live ? 0.7 + 1.8 * h(i, 11) : 0;
        debris.setMatrixAt(i, m.compose(p, q, s.setScalar(k)));
      }
      debris.instanceMatrix.needsUpdate = true;
    },
    dispose: () => {
      heli.dispose();
      ropeGeometry.dispose();
      ropeMaterial.dispose();
      kit.dispose();
      helmet.dispose();
      bodyGeometry.dispose();
      headGeometry.dispose();
      for (const pl of [fire, smoke]) {
        pl.geometry.dispose();
        pl.material.dispose();
      }
      puff.dispose();
      ring.geometry.dispose();
      ringMaterial.dispose();
      hole.geometry.dispose();
      holeMaterial.dispose();
      debris.geometry.dispose();
      debrisMaterial.dispose();
    },
  };
}

const Y = new THREE.Vector3(0, 1, 0);
