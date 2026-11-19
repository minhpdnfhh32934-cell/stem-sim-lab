import * as THREE from 'three';
import {
  Fn,
  cameraFar,
  cameraNear,
  clamp,
  cos,
  dot,
  floor,
  fract,
  instancedBufferAttribute,
  length,
  linearDepth,
  max,
  min,
  mix,
  modelViewMatrix,
  pow,
  screenDPR,
  select,
  sin,
  smoothstep,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
  viewportLinearDepth,
} from 'three/tsl';
import { type Node, PointsNodeMaterial } from 'three/webgpu';
import type { ParticleSource } from '../particles';

/**
 * A particle pool (particles.ts) as instanced sprites for WebGPU, whose points are one pixel: the
 * pool's own buffers and uniforms, its GLSL said again in nodes — a round soft disc, a flame's
 * flickering tongue, or a billow of dust and smoke (fbm curls turning, lit from above, faded as the
 * eye comes into it); each faded where it meets the scene (soft, G2-4). Sizes in metres as the pool's: px = size × uScale / depth.
 */
export function particleSprite(pool: ParticleSource): THREE.Object3D {
  const { geometry, material, capacity } = pool;
  // Each attribute's array as a buffer of its own, sent again when the pool changed it: three
  // wraps a BufferAttribute's array in a buffer whose version the pool's needsUpdate never moves
  // (the sprites were drawn from the first frame's data, clear and sizeless).
  const buffers: {
    attribute: THREE.BufferAttribute;
    buffer: THREE.InterleavedBuffer;
    seen: number;
  }[] = [];
  const buffer = (name: string): THREE.InterleavedBuffer => {
    const attribute = geometry.getAttribute(name) as THREE.BufferAttribute;
    // Instanced: one value per sprite, not per corner of its quad (a plain one sheared each quad).
    const own = new THREE.InstancedInterleavedBuffer(attribute.array, attribute.itemSize, 1);
    own.setUsage(THREE.DynamicDrawUsage);
    buffers.push({ attribute, buffer: own, seen: attribute.version });
    return own;
  };
  const at = (name: string): Node<'float'> =>
    instancedBufferAttribute<'float'>(buffer(name), 'float');
  const u = material.uniforms as Record<string, { value: unknown }>;
  const value = (name: string): number => Number(u[name]?.value ?? 0);
  const scale = uniform(value('uScale')).onRenderUpdate(() => value('uScale'));
  const time = uniform(value('uTime')).onRenderUpdate(() => value('uTime'));
  const ramp = ['uC0', 'uC1', 'uC2'].map(
    (name) => uniform(u[name]?.value as THREE.Color) as unknown as Node<'vec3'>,
  ) as [Node<'vec3'>, Node<'vec3'>, Node<'vec3'>];
  const shape =
    'PUFF' in material.defines ? 'puff' : 'FLAME' in material.defines ? 'flame' : 'round';

  const sprite = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: material.blending,
    sizeAttenuation: false, // the pool's own: below
  });
  sprite.alphaTest = 0.01; // the GLSL's discard below 0.01
  const centre = instancedBufferAttribute<'vec3'>(buffer('position'), 'vec3');
  // The particle's own depth (positionView here is the sprite quad's, at the object's origin).
  const depth = modelViewMatrix.mul(vec4(centre, 1)).z.negate();
  sprite.positionNode = centre;
  // As WebGL draws points: none whose centre is behind the near plane (a sprite there turned into
  // a long sliver across the view), and at most 1024 px (ANGLE's widest point).
  const px = min(at('aSize').mul(scale).div(max(depth, 0.05)), 1024);
  sprite.sizeNode = select(depth.greaterThan(0.05), px, 0).div(screenDPR);
  let alpha = varying(at('aAlpha'));
  if (shape === 'puff') alpha = varying(at('aAlpha').mul(smoothstep(1, 4, depth)));
  const t = varying(at('aT'));
  const seed = varying(at('aSeed'));
  const p = vec2(uv().x.sub(0.5), uv().y.oneMinus().sub(0.5)); // gl_PointCoord − 0.5 (y down)

  let a: Node<'float'>;
  let lit: Node<'float'> | null = null;
  if (shape === 'puff') {
    const turn = select(seed.greaterThan(0.5), 1, -1);
    const angle = seed.mul(6.2831).add(time.mul(seed.mul(0.1).add(0.05)).mul(turn));
    const c = cos(angle);
    const s = sin(angle);
    const q = vec2(c.mul(p.x).add(s.mul(p.y)), s.negate().mul(p.x).add(c.mul(p.y)));
    const n = fbm(
      q
        .mul(3.2)
        .add(seed.mul(19))
        .add(vec2(0, time.mul(0.06))),
    );
    const r = length(p).mul(2).add(n.sub(0.5).mul(0.7));
    a = alpha.mul(smoothstep(0.3, 1, r).oneMinus()).mul(n.mul(0.6).add(0.55));
    lit = clamp(p.y.negate().mul(0.85).add(0.58).add(n.sub(0.5).mul(0.55)), 0.3, 1.25);
  } else if (shape === 'flame') {
    const y = p.y.negate().add(0.5); // 0 at the foot, 1 at the tip
    const sway = sin(time.mul(9).add(seed.mul(40)).add(y.mul(6)))
      .mul(0.08)
      .mul(y);
    const width = mix(0.42, 0.06, pow(y, 0.8));
    const d = length(vec2(p.x.sub(sway).div(max(width, 0.02)), y.sub(0.38).mul(2.2)));
    a = alpha.mul(smoothstep(0.35, 1, d).oneMinus());
  } else a = alpha.mul(smoothstep(0.2, 1, length(p).mul(2)).oneMinus());
  // Soft (G2-4): faded where it meets what stands behind it (a floor, a wall, a bench), within
  // SOFT_M of it, not cut off along a line.
  const behind = viewportLinearDepth.sub(linearDepth()).mul(cameraFar.sub(cameraNear));
  a = a.mul(clamp(behind.div(SOFT_M), 0, 1));
  const [c0, c1, c2] = ramp;
  let color: Node<'vec3'> = select(
    t.lessThan(0.5),
    mix(c0, c1, t.mul(2)),
    mix(c1, c2, t.mul(2).sub(1)),
  );
  if (lit) color = color.mul(lit);
  sprite.colorNode = vec3(color);
  sprite.opacityNode = a;

  const object = new THREE.Sprite(sprite);
  object.count = capacity; // one instance per particle; dead ones are clear (alpha 0)
  object.frustumCulled = false;
  object.renderOrder = 10;
  object.onBeforeRender = () => {
    for (const b of buffers) {
      if (b.attribute.version === b.seen) continue;
      b.seen = b.attribute.version;
      b.buffer.needsUpdate = true;
    }
  };
  return object;
}

/** How near (m) a particle fades into what is behind it. */
const SOFT_M = 0.35;

/** The GLSL's value noise, 4 octaves (particles.ts PUFF). */
function fbm(start: Node<'vec2'>): Node<'float'> {
  const hash = (q: Node<'vec2'>): Node<'float'> =>
    fract(sin(dot(q, vec2(127.1, 311.7))).mul(43758.5453));
  const noise = Fn(([q]: [Node<'vec2'>]) => {
    const i = floor(q);
    const f = fract(q);
    const w = f.mul(f).mul(f.mul(-2).add(3));
    return mix(
      mix(hash(i), hash(i.add(vec2(1, 0))), w.x),
      mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), w.x),
      w.y,
    );
  });
  let v: Node<'float'> = noise(start).mul(0.5);
  let q = start.mul(2.03).add(7.1);
  let amp = 0.25;
  for (let k = 1; k < 4; k++) {
    v = v.add(noise(q).mul(amp));
    q = q.mul(2.03).add(7.1);
    amp *= 0.5;
  }
  return v;
}
