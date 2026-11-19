import * as THREE from 'three';
import {
  Fn,
  abs,
  attribute,
  cameraViewMatrix,
  clamp,
  dot,
  faceDirection,
  fwidth,
  length,
  min,
  modelWorldMatrix,
  positionGeometry,
  sin,
  smoothstep,
  sRGBTransferEOTF,
  uv,
  vec2,
  instanceColor,
  materialColor,
  materialEmissive,
  materialRoughness,
  max,
  mix,
  modelViewMatrix,
  mx_noise_float,
  normalLocal,
  normalView,
  normalWorldGeometry,
  output,
  positionLocal,
  positionViewDirection,
  positionWorld,
  pow,
  select,
  texture,
  uniform,
  vec3,
  vec4,
  vertexColor,
} from 'three/tsl';
import {
  MeshBasicNodeMaterial,
  type Node,
  type NodeBuilder,
  type WebGPURenderer,
} from 'three/webgpu';
import { LIQUID_EDGE, LIQUID_FILL, LIQUID_RIM } from '../looks';
import { type NodeLook, nodeLookOf } from '../nodeLooks';

/**
 * The looks of nodeLooks.ts built from nodes for Ultra's WebGPU device (Phase G2-1): each is the
 * GLSL of its module said again (finishes.ts, looks.ts, outlines.ts, body/BodyModel.ts,
 * city/CityView.ts, surfaces.ts). The nodes are set on the material itself: three's WebGPU device
 * copies a classic material's properties onto the node material it draws with; WebGL ignores them.
 */
type Slot =
  | 'colorNode'
  | 'roughnessNode'
  | 'normalNode'
  | 'aoNode'
  | 'emissiveNode'
  | 'positionNode'
  | 'outputNode';
type Nodes = Partial<Record<Slot, Node>>;

/** The look each material's nodes were built from, and the slots they took. */
const applied = new WeakMap<THREE.Material, { look: NodeLook; slots: Slot[] }>();

/**
 * Each classic material gets its look's nodes as three converts it for drawing (its library's
 * `fromMaterial`, on every build): no walk of the scene, and a material made later is covered. A
 * look that changes comes with the material's own `needsUpdate` (its WebGL patch's), which builds
 * it again.
 */
export function installLooks(renderer: WebGPURenderer): void {
  const library = renderer.library;
  const convert = library.fromMaterial.bind(library);
  library.fromMaterial = (material: THREE.Material) => {
    if ((material as Partial<THREE.ShaderMaterial>).isShaderMaterial) {
      const look = nodeLookOf(material);
      if (look) return replacementOf(material as THREE.ShaderMaterial, look);
    } else if (!(material as Partial<{ isNodeMaterial: boolean }>).isNodeMaterial) adopt(material);
    return convert(material);
  };
}

/** The node material drawing a ShaderMaterial (WebGPU has no GLSL), made once for it. */
const replacements = new WeakMap<THREE.ShaderMaterial, MeshBasicNodeMaterial>();

function replacementOf(material: THREE.ShaderMaterial, look: NodeLook): MeshBasicNodeMaterial {
  let node = replacements.get(material);
  if (node) return node;
  node = new MeshBasicNodeMaterial();
  for (const key of SHARED) (node as unknown as Record<string, unknown>)[key] = material[key];
  if (look.kind === 'water-column') waterColumn(node, look);
  else if (look.kind === 'water-splash') waterSplash(node, look);
  else if (look.kind === 'lens-image') lensImage(node, look);
  replacements.set(material, node);
  return node;
}

/** What a ShaderMaterial says of how it is drawn, kept by its node material. */
const SHARED = [
  'transparent',
  'depthWrite',
  'depthTest',
  'side',
  'blending',
  'toneMapped',
  'polygonOffset',
  'polygonOffsetFactor',
  'polygonOffsetUnits',
] as const;

/**
 * A soft rim of light round a person (G2-5): their own colour, lightened, where the surface turns
 * away from the eye — `strength` at the very edge.
 */
function rim(color: Node<'vec3'>, strength: number): Node<'vec3'> {
  const edge = pow(clamp(dot(normalView, positionViewDirection), 0, 1).oneMinus(), 3);
  return color.mul(0.5).add(0.5).mul(edge.mul(strength));
}

/** A `{ value }` the module changes, read each frame. */
const follow = (box: { value: number }) => uniform(box.value).onRenderUpdate(() => box.value);

/** water.ts COLUMN_*: a swell and streaks running down, a rim and a glint, unlit. */
function waterColumn(
  node: MeshBasicNodeMaterial,
  look: Extract<NodeLook, { kind: 'water-column' }>,
): void {
  const time = follow(look.time);
  const color = uniform(look.color) as unknown as Node<'vec3'>;
  const worldY = modelWorldMatrix.mul(vec4(positionLocal, 1)).y;
  const swell = sin(worldY.mul(45).add(time.mul(54)))
    .mul(0.1)
    .add(1);
  node.positionNode = vec3(positionLocal.x.mul(swell), positionLocal.y, positionLocal.z.mul(swell));
  const rim = facing().oneMinus();
  const y = positionWorld.y;
  const streak = sin(
    y
      .mul(60)
      .add(time.mul(72))
      .add(sin(y.mul(23).add(time.mul(27))).mul(1.5)),
  )
    .mul(0.5)
    .add(0.5);
  const glint = pow(max(dot(normalView, vec3(0.55, 0.35, 1).normalize()), 0), 24);
  node.colorNode = color
    .mul(streak.mul(0.35).add(0.75))
    .add(vec3(0.9).mul(glint.add(rim.mul(streak).mul(0.2))));
  node.opacityNode = clamp(
    mix(0.22, 0.8, rim.mul(rim)).mul(streak.mul(0.2).add(0.8)).add(glint.mul(0.5)),
    0,
    1,
  );
}

/** water.ts SPLASH_*: rings running out over a bright spot. */
function waterSplash(
  node: MeshBasicNodeMaterial,
  look: Extract<NodeLook, { kind: 'water-splash' }>,
): void {
  const time = follow(look.time);
  const color = uniform(look.color) as unknown as Node<'vec3'>;
  const r = length(uv().mul(2).sub(1));
  const ring = sin(r.mul(14).sub(time.mul(60)))
    .mul(0.5)
    .add(0.5);
  node.colorNode = mix(color, vec3(1), ring.mul(0.3).add(0.5));
  node.opacityNode = smoothstep(0.35, 1, r)
    .oneMinus()
    .mul(ring.mul(0.3).add(0.12))
    .add(smoothstep(0, 0.3, r).oneMinus().mul(0.45));
}

/** bench/optical-bench.ts IMAGE_*: the arrow's image, its edges blurred by the blur disc. */
function lensImage(
  node: MeshBasicNodeMaterial,
  look: Extract<NodeLook, { kind: 'lens-image' }>,
): void {
  const m = follow(look.m);
  const blur = follow(look.blur);
  const glow = follow(look.glow);
  const height = follow(look.height);
  const edge = new THREE.Vector2(look.head, look.headWidth / 2).normalize();
  const o = positionGeometry.xy.div(m);
  const base = height.sub(look.head);
  const shaft = min(
    min(
      abs(o.x)
        .negate()
        .add(look.shaft / 2),
      o.y,
    ),
    base.sub(o.y),
  );
  const head = min(
    o.y.sub(base),
    dot(vec2(abs(o.x), o.y.sub(height)), vec2(edge.x, edge.y)).negate(),
  );
  const inside = max(shaft, head).mul(abs(m));
  const w = max(blur.mul(0.5), fwidth(inside));
  node.colorNode = uniform(look.color);
  node.opacityNode = smoothstep(w.negate(), w, inside).mul(glow);
}

/** `material` given the nodes of its look, or relieved of them (being built: no new version). */
function adopt(material: THREE.Material): void {
  const look = nodeLookOf(material);
  const before = applied.get(material);
  if ((before?.look ?? null) === look) return;
  const slots = material as unknown as Record<Slot, Node | null>;
  for (const slot of before?.slots ?? []) slots[slot] = null;
  applied.delete(material);
  if (look) {
    const nodes = build(look);
    const taken = Object.keys(nodes) as Slot[];
    for (const slot of taken) slots[slot] = nodes[slot] ?? null;
    applied.set(material, { look, slots: taken });
  }
}

/** 1 where the surface faces the eye, 0 where the view grazes it. */
const facing = (): Node<'float'> => abs(dot(normalView, positionViewDirection));

function build(look: NodeLook): Nodes {
  switch (look.kind) {
    case 'glass-edge':
      return {
        outputNode: Fn((_: unknown, builder: NodeBuilder) => {
          const edge = pow(facing().oneMinus(), 3);
          // Drawn as a filter (premultiplied, multiplied): darker at the edge; as paint: more opaque
          // and lighter there.
          if (builder.material.premultipliedAlpha)
            return vec4(output.rgb.mul(edge.mul(-0.45).add(1)), output.a);
          return vec4(
            mix(output.rgb, vec3(1), edge.mul(0.25)),
            clamp(output.a.mul(edge.mul(2.2).add(0.6)), 0, 0.92),
          );
        })(),
      };
    case 'liquid-filter': {
      const graze = facing().oneMinus();
      return {
        outputNode: vec4(output.rgb.mul(mix(1, LIQUID_EDGE, graze.mul(graze))), output.a),
      };
    }
    case 'liquid-rim': {
      const graze = facing().oneMinus();
      // The filter's own colour object (it follows `transmit`); a colour uniform is a vec3.
      const tint = uniform(look.tint) as unknown as Node<'vec3'>;
      const kept = tint.mul(tint).mul(LIQUID_FILL).add(graze.mul(graze).mul(LIQUID_RIM));
      return { outputNode: vec4(output.rgb.mul(kept), output.a) };
    }
    case 'outline-shell': {
      const width = uniform(look.width.value).onRenderUpdate(() => look.width.value);
      const glow = uniform(look.glow.value).onRenderUpdate(() => look.glow.value);
      const depth = max(modelViewMatrix.mul(vec4(positionLocal, 1)).z.negate(), 0.3);
      return {
        positionNode: positionLocal.add(
          attribute<'vec3'>('outlineNormal', 'vec3').mul(width).mul(depth),
        ),
        outputNode: vec4(output.rgb.mul(glow), output.a),
      };
    }
    case 'body-cloth':
      return {
        emissiveNode: rim(materialColor.rgb, 0.14),
        colorNode: Fn(() => {
          const diffuse = materialColor.rgb;
          const tone = vertexColor();
          const fold = tone.r.oneMinus();
          const light = dot(diffuse, vec3(0.299, 0.587, 0.114));
          // three multiplies the colour by the vertex colour after this node (vertexColors): on a
          // dark cloth, where the fold is drawn lighter instead, it is divided out first.
          return select(
            light.lessThan(0.045),
            diffuse.add(fold.mul(0.22)).div(max(tone.rgb, 0.001)),
            diffuse,
          );
        })(),
      };
    case 'body-skin':
      return {
        emissiveNode: rim(materialColor.rgb, 0.22),
        // Anime skin's shadow is warm, as light comes through it: a little red where it is darker.
        outputNode: Fn(() => {
          const base = max(dot(materialColor.rgb, vec3(0.299, 0.587, 0.114)), 0.001);
          const lit = dot(output.rgb, vec3(0.299, 0.587, 0.114));
          const shade = clamp(lit.div(base).oneMinus(), 0, 1);
          return vec4(output.rgb.add(vec3(0.09, 0.025, 0).mul(shade).mul(base)), output.a);
        })(),
      };
    case 'body-hair': {
      // The ring of light on the top of the head, where the hair faces up and to the eye.
      const up = normalView.y;
      const ring = smoothstep(0.35, 0.6, up).mul(smoothstep(0.95, 0.7, up));
      return {
        ...build({ kind: 'body-cloth' }),
        emissiveNode: rim(materialColor.rgb, 0.18).add(vec3(ring.mul(0.16))),
      };
    }
    case 'body-outline': {
      const width = uniform(look.width.value).onRenderUpdate(() => look.width.value);
      return { positionNode: positionLocal.add(normalLocal.normalize().mul(width)) };
    }
    case 'decoded-map':
      // Its colour times the picture, the picture decoded from sRGB here (as WebGL's define does).
      return {
        colorNode: materialColor.mul(
          sRGBTransferEOTF(texture(look.map).rgb) as unknown as Node<'vec3'>,
        ),
      };
    case 'city-window':
      return {
        emissiveNode: Fn((_: unknown, builder: NodeBuilder) =>
          (builder.object as Partial<THREE.InstancedMesh>).instanceColor
            ? materialEmissive.mul(instanceColor)
            : materialEmissive,
        )(),
      };
    case 'surface':
      return surface(look);
    case 'water-column':
    case 'water-splash':
    case 'lens-image':
      return {}; // ShaderMaterials: drawn by a node material of their own (replacementOf)
  }
}

/**
 * How much wear darkens a worn patch on a floor or top and the foot of a wall, and how much
 * smoother the patch is (roughness taken off).
 */
const WEAR = { top: 0.06, foot: 0.09, polish: 0.08 };

/** surfaces.ts's triplanar patch: colour, roughness, normal and (with a map) occlusion; wear. */
function surface(look: Extract<NodeLook, { kind: 'surface' }>): Nodes {
  const n = normalWorldGeometry;
  const p = positionWorld.div(look.scale);
  const w0 = pow(abs(n), vec3(4));
  const w = w0.div(w0.x.add(w0.y).add(w0.z));
  const tri = (map: THREE.Texture): Node<'vec4'> =>
    texture(map, p.zy).mul(w.x).add(texture(map, p.xz).mul(w.y)).add(texture(map, p.xy).mul(w.z));
  const luminance = dot(tri(look.color).rgb, vec3(0.2126, 0.7152, 0.0722));
  const roughness = tri(look.roughness).g;
  // The tangent-space normals of the three projections, blended in world space ("whiteout"),
  // then to view space, where three lights.
  const tangent = (uv: Node<'vec2'>): Node<'vec3'> => {
    const t = texture(look.normal, uv).xyz.mul(2).sub(1);
    return vec3(t.xy.mul(look.normalScale), t.z);
  };
  const nX = tangent(p.zy);
  const nY = tangent(p.xz);
  const nZ = tangent(p.xy);
  const bX = vec3(nX.xy.add(n.zy), abs(nX.z).mul(n.x));
  const bY = vec3(nY.xy.add(n.xz), abs(nY.z).mul(n.y));
  const bZ = vec3(nZ.xy.add(n.xy), abs(nZ.z).mul(n.z));
  const world = bX.zyx.mul(w.x).add(bY.xzy.mul(w.y)).add(bZ.xyz.mul(w.z)).normalize();
  // Wear (G2-5): patches walked or worked smoother and a little darker on floors and tops, grime
  // at the foot of walls — a used lab, not a dirty one (the labs stay bright).
  const flat = smoothstep(0.7, 0.9, n.y);
  const upright = smoothstep(0.35, 0.1, abs(n.y));
  const patches = mx_noise_float(positionWorld.mul(vec3(0.35, 0, 0.35)))
    .mul(0.5)
    .add(0.5);
  const scuff = smoothstep(0.55, 0.85, patches).mul(flat);
  const grime = smoothstep(0.3, 0, positionWorld.y).mul(upright);
  const worn = scuff.mul(WEAR.top).add(grime.mul(WEAR.foot)).oneMinus();
  const nodes: Nodes = {
    colorNode: materialColor.mul(mix(1, luminance.div(look.colorMean), look.detail)).mul(worn),
    roughnessNode: clamp(
      materialRoughness
        .mul(mix(1, roughness.div(look.roughMean), look.rough))
        .sub(scuff.mul(WEAR.polish)),
      0.04,
      1,
    ),
    normalNode: cameraViewMatrix.mul(vec4(world, 0)).xyz.normalize().mul(faceDirection),
  };
  if (look.ao) nodes.aoNode = mix(1, tri(look.ao).r, 0.8);
  return nodes;
}
