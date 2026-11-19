import * as THREE from 'three';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { gaussianBlur } from 'three/examples/jsm/tsl/display/GaussianBlurNode.js';
import { ssgi } from 'three/examples/jsm/tsl/display/SSGINode.js';
import { traa } from 'three/examples/jsm/tsl/display/TRAANode.js';
import {
  clamp,
  diffuseColor,
  luminance,
  mix,
  mrt,
  output,
  pass,
  renderOutput,
  screenUV,
  uniform,
  vec3,
  vec4,
  velocity,
} from 'three/tsl';
import {
  type MRTNode,
  type Node,
  type PassNode,
  type RenderTarget,
  RenderPipeline,
  type WebGPURenderer,
} from 'three/webgpu';
import type { RoomGrade } from '../../../world/definitions';
import { type Grade, gradeOf, POST } from '../postLook';
import { AIR_LAYER } from '../roomLights';
import { GpuAir } from './air';

/**
 * Ultra's post-processing on WebGPU (Phase G2-1; under WebGL it is post.ts), the look of postLook.ts:
 * since G2-2 light bounced from what is in view and the occlusion where things meet (three's SSGI
 * in place of GTAO; the bounce lights each pixel's own colour, its `diffuseColor`, written beside
 * the frame's — `mrt`), since G2-3 every frame jittered and blended with the last (TRAA, in place
 * of SMAA: no shimmer, the bounce's noise averaged), then light in dust, smoke and steam (air.ts),
 * bloom on what glows brighter than the room, tone mapping and sRGB, the room's grade.
 * The occlusion is found from the frame's own depth, its normals rebuilt from it (2026-11-14):
 * - a pass of the opaque scene alone for it, the occlusion then put into the indirect light only,
 *   cost 24.4 ms a frame against 11.6 (production build, RTX 5070 Laptop: three's per-object work
 *   twice);
 * - normals written beside the colour (a second output) took a see-through puff's whole square as
 *   a surface, and three builds a material's shaders later than it is asked to (its pipelines made
 *   ahead, GpuDevice.compile), reading the renderer's outputs then: built for one, drawn into two.
 * The city under the hub's glass (`setUnder`) is drawn by a pass of its own and is the world's
 * background (sampled where each pixel is): the glass is then laid over it as WebGL lays it over
 * the city drawn first. Laid under the finished world by the world's coverage instead, it was lost
 * once SMAA took the picture into a texture (three r186: a second scene pass inside it is not drawn).
 */
/**
 * What the world's pass writes, and how precisely (GpuDevice.cubeTarget draws a room's capture with
 * the same): the colour; each pixel's own colour before light (what bounced light lights);
 * how far each pixel moved since the last frame (TRAA).
 */
export const OUTPUTS = {
  output: THREE.HalfFloatType,
  diffuseColor: THREE.UnsignedByteType,
  velocity: THREE.HalfFloatType,
} as const;

export class GpuPipeline {
  private readonly pipeline: RenderPipeline;
  private underScene: THREE.Scene | null = null;
  private underCamera: THREE.Camera | null = null;
  /** The world's pass: what the frame draws into (GpuDevice.compile makes pipelines for it). */
  private world!: PassNode;
  /**
   * The render call depth the world's pass draws at (GpuDevice.frameDepth), taken as it draws:
   * three nests it in TRAA's texture's (2 in r186; SMAA's made it 3); that until the first frame.
   * shortcut: a guess until then, the nesting of the graph below; when the graph changes, check it
   * (a wrong one made every compile ahead build for another context: 2026-11-15, frames of 17–50
   * ms while the frame built it all again).
   */
  depth = 2;

  constructor(
    private readonly renderer: WebGPURenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.pipeline = new RenderPipeline(renderer);
    // Tone mapping and sRGB in the graph (renderOutput), before the room's grade.
    this.pipeline.outputColorTransform = false;
    this.build();
  }

  /** Light in the air (air.ts), and whether the air holds any now. */
  private air!: GpuAir;
  private airOn = false;
  private readonly airStrength = uniform(0);
  /** The room's grade (postLook.ts), eased towards `to`. */
  private readonly warmth = uniform(0);
  private readonly saturation = uniform(1);
  private readonly contrast = uniform(1);
  private readonly to: Grade = { warmth: 0, saturation: 1, contrast: 1 };

  /** A frame, `dt` s after the last, its colour that of a room of `grade` at `daylight` (0…1). */
  render(dt = 0, grade: RoomGrade = 'neutral', daylight = 1): void {
    this.airOn = this.air.update();
    this.airStrength.value = this.airOn ? POST.air.strength : 0;
    gradeOf(grade, daylight, this.to);
    // Eased: crossing a door, the colour turns over a second, not at once.
    const k = dt > 0 ? 1 - Math.exp(-dt / POST.gradeEase) : 1;
    this.warmth.value += (this.to.warmth - this.warmth.value) * k;
    this.saturation.value += (this.to.saturation - this.saturation.value) * k;
    this.contrast.value += (this.to.contrast - this.contrast.value) * k;
    this.pipeline.render();
  }

  /** Where the world is drawn (a material's pipeline is made for its target). */
  get target(): RenderTarget {
    return this.world.renderTarget;
  }

  /** What the world's draw writes besides its colour (a material is built for it; OUTPUTS). */
  readonly mrt: MRTNode = mrt({ output, diffuseColor, velocity });

  /** A scene drawn first, behind the world (the city under the hub's glass), or none. */
  setUnder(scene: THREE.Scene | null, camera: THREE.Camera | null): void {
    if (scene === this.underScene && camera === this.underCamera) return;
    this.underScene = scene;
    this.underCamera = camera;
    const under = scene && camera ? pass(scene, camera).getTextureNode('output') : null;
    // three's WebGPU device draws a background node over the scene's background colour; WebGL
    // ignores it (it draws the city first itself).
    (this.scene as unknown as { backgroundNode: Node | null }).backgroundNode = under
      ? under.sample(screenUV)
      : null;
  }

  dispose(): void {
    this.setUnder(null, null);
    this.air.dispose();
    this.pipeline.dispose();
  }

  /** The pass graph, made once. */
  private build(): void {
    const { scene, camera } = this;
    // No stencil: three cannot sample a depth that has one (outlines.ts useStencil).
    const world = pass(scene, camera);
    this.world = world;
    const internals = this.renderer as unknown as { _callDepth: number };
    const update = world.updateBefore.bind(world);
    world.updateBefore = (frame) => {
      this.depth = internals._callDepth + 1; // its draw goes one deeper
      return update(frame);
    };
    world.setMRT(this.mrt);
    for (const [name, type] of Object.entries(OUTPUTS)) world.getTexture(name).type = type;
    const depth = world.getTextureNode('depth');
    const raw = world.getTextureNode('output');
    const albedo = world.getTextureNode('diffuseColor');
    const none = null as unknown as Node; // no normals: rebuilt from depth
    // Light bounced from what is in view, and the occlusion where things meet (G2-2), its noise
    // averaged over frames by TRAA below (G2-3).
    const light = ssgi(raw, depth, none, camera);
    light.useScreenSpaceSampling.value = false; // the radius in metres
    const { gi } = POST;
    light.sliceCount.value = gi.slices;
    light.stepCount.value = gi.steps;
    light.radius.value = gi.radius;
    light.thickness.value = gi.thickness;
    light.giIntensity.value = gi.intensity;
    light.aoIntensity.value = gi.ao;
    const lit = raw.rgb.mul(light.getAONode().r).add(albedo.rgb.mul(light.getGINode().rgb));
    // Every pass above jittered a fraction of a pixel each frame and the frames blended (TRAA):
    // no shimmer on grout, wires and ropes, and the bounce's noise averaged. In place of SMAA.
    const steady = traa(vec4(lit, 1), depth, world.getTextureNode('velocity'), camera);
    // Light in the air (G2-2): a pass of the volume alone, a quarter of the frame, blurred up.
    this.air = new GpuAir(depth);
    scene.add(this.air.mesh);
    const air = pass(scene, camera, { depthBuffer: false, samples: 0 });
    const layers = new THREE.Layers();
    layers.set(AIR_LAYER);
    air.setLayers(layers);
    air.setResolutionScale(POST.air.resolution);
    const drawAir = air.updateBefore.bind(air);
    const own = scene as unknown as { background: unknown; backgroundNode: Node | null };
    air.updateBefore = (frame) => {
      if (!this.airOn) return; // clear air: no pass (its strength is 0)
      // Not the scene's background (the city under the hub's glass): the air alone.
      const { background, backgroundNode } = own;
      own.background = null;
      own.backgroundNode = null;
      try {
        return drawAir(frame);
      } finally {
        own.background = background;
        own.backgroundNode = backgroundNode;
      }
    };
    const haze = gaussianBlur(air.getTextureNode(), null, POST.air.blur);
    const color = vec4(steady.rgb.add(haze.rgb.mul(this.airStrength)), 1);
    const glow = bloom(color, POST.bloom.strength, POST.bloom.radius, POST.bloom.threshold);
    const shown = renderOutput(vec4(color.rgb.add(glow.rgb), 1));
    // The room's grade (postLook.ts), on the picture as shown: white balance, saturation, contrast.
    const balanced = shown.rgb.mul(
      vec3(this.warmth.mul(0.06).add(1), 1, this.warmth.mul(-0.06).add(1)),
    );
    const saturated = mix(vec3(luminance(balanced)), balanced, this.saturation);
    const graded = clamp(saturated.sub(0.5).mul(this.contrast).add(0.5), 0, 1);
    this.pipeline.outputNode = vec4(graded, 1);
    this.pipeline.needsUpdate = true;
  }
}
