import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { RoomGrade } from '../../world/definitions';
import { EffectsPass, type SeeThrough } from './effectsPass';
import { type Grade, gradeOf, POST } from './postLook';

/** Ultra's post-processing under WebGL (Phase G): its look is postLook.ts, shared with gpu/pipeline.ts. */
export { POST };

/**
 * GTAO that leaves out see-through objects: glass and liquids would darken what is behind them
 * as if solid (three's pass leaves out points and lines only).
 */
class SolidAoPass extends GTAOPass {
  private readonly seeThrough: THREE.Object3D[] = [];

  _overrideVisibility(): void {
    const hidden = this.seeThrough;
    this.scene.traverse((object) => {
      const mesh = object as Partial<THREE.Mesh> & THREE.Object3D;
      if (!object.visible) return;
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const lineLike =
        (object as Partial<THREE.Points>).isPoints === true ||
        (object as Partial<THREE.Line>).isLine === true;
      if (lineLike || material?.transparent === true) {
        object.visible = false;
        hidden.push(object);
      }
    });
  }

  _restoreVisibility(): void {
    for (const object of this.seeThrough) object.visible = true;
    this.seeThrough.length = 0;
  }

  /**
   * Its normals pass draws the whole scene again: without this, three drew every light's shadow
   * map a second time each frame for it (the profile of a door walk: ~300 ms of shadow passes in
   * the long frames alone). The frame's shadows are drawn already; normals need none.
   */
  _renderOverride(renderer: THREE.WebGLRenderer, ...rest: unknown[]): void {
    const auto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    try {
      BASE_OVERRIDE.call(this, renderer, ...rest);
    } finally {
      renderer.shadowMap.autoUpdate = auto;
    }
  }
}

/** three's own normals pass (not in its type declarations). */
const BASE_OVERRIDE = (
  GTAOPass.prototype as unknown as {
    _renderOverride: (this: GTAOPass, renderer: THREE.WebGLRenderer, ...rest: unknown[]) => void;
  }
)._renderOverride;

export interface Post {
  /** What the scene is drawn into first (the shader warm-up draws there too: same programs). */
  readonly target: THREE.WebGLRenderTarget;
  /** A frame, `dt` s after the last; under Max, coloured as a room of `grade` at `daylight` (0…1). */
  render(dt: number, grade?: RoomGrade, daylight?: number): void;
  /** A scene drawn first, behind the world (the city under the hub's glass), or none. */
  setUnder(scene: THREE.Scene | null, camera: THREE.Camera | null): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

/** What Max adds to Ultra's chain (quality.ts `grade`, `aoSamples`, `effects`). */
export interface PostOptions {
  readonly grade: boolean;
  readonly aoSamples: number;
  /** The glassware for the see-through pass (effectsPass.ts), or null: no such pass. */
  readonly seeThrough: SeeThrough | null;
}

/**
 * The room's grade (Max; postLook.ts, the same look as gpu/pipeline.ts): white balance, saturation
 * and contrast, on the picture as shown (after tone mapping and sRGB), before SMAA.
 */
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    warmth: { value: 0 },
    saturation: { value: 1 },
    contrast: { value: 1 },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float warmth;
uniform float saturation;
uniform float contrast;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  vec3 balanced = c.rgb * vec3(1.0 + 0.06 * warmth, 1.0, 1.0 - 0.06 * warmth);
  vec3 saturated = mix(vec3(dot(balanced, vec3(0.2126, 0.7152, 0.0722))), balanced, saturation);
  gl_FragColor = vec4(clamp((saturated - 0.5) * contrast + 0.5, 0.0, 1.0), c.a);
}`,
};

/** Under this from neutral, the grade pass is skipped (a neutral lab draws no extra pass). */
const NEUTRAL_EPS = 0.002;

export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  options: PostOptions = { grade: false, aoSamples: 16, seeThrough: null },
): Post {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    stencilBuffer: true,
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1); // sizes are the drawing buffer's, in device pixels
  composer.setSize(width, height);
  // The city under the glass (Phase V-2), when there is one in view: drawn first, the world over it.
  const under = new RenderPass(new THREE.Scene(), camera);
  under.enabled = false;
  composer.addPass(under);
  const world = new RenderPass(scene, camera);
  composer.addPass(world);
  const ao = new SolidAoPass(scene, camera, width, height);
  ao.updateGtaoMaterial({
    radius: POST.ao.radius,
    distanceExponent: POST.ao.distanceExponent,
    thickness: POST.ao.thickness,
    scale: POST.ao.scale,
    samples: options.aoSamples,
  });
  if (options.aoSamples !== 16) ao.updatePdMaterial({ samples: options.aoSamples });
  ao.blendIntensity = POST.ao.blend;
  composer.addPass(ao);
  // Right after the AO: it leaves the world pass's picture in the buffer it swapped out.
  const effects = options.seeThrough
    ? new EffectsPass(camera, ao.depthTexture, options.seeThrough, width, height)
    : null;
  if (effects) composer.addPass(effects);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    POST.bloom.strength,
    POST.bloom.radius,
    POST.bloom.threshold,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const gradePass = new ShaderPass(GRADE_SHADER);
  gradePass.enabled = false;
  if (options.grade) composer.addPass(gradePass);
  composer.addPass(new SMAAPass());
  const to: Grade = { warmth: 0, saturation: 1, contrast: 1 };
  const u = gradePass.uniforms as Record<'warmth' | 'saturation' | 'contrast', { value: number }>;
  return {
    get target() {
      return composer.readBuffer;
    },
    render: (dt, grade = 'neutral', daylight = 1) => {
      if (options.grade) {
        gradeOf(grade, daylight, to);
        // Eased towards the room's (a door crossed): POST.gradeEase s most of the way.
        const k = dt > 0 ? 1 - Math.exp(-dt / POST.gradeEase) : 1;
        u.warmth.value += (to.warmth - u.warmth.value) * k;
        u.saturation.value += (to.saturation - u.saturation.value) * k;
        u.contrast.value += (to.contrast - u.contrast.value) * k;
        gradePass.enabled =
          Math.abs(u.warmth.value) > NEUTRAL_EPS ||
          Math.abs(u.saturation.value - 1) > NEUTRAL_EPS ||
          Math.abs(u.contrast.value - 1) > NEUTRAL_EPS;
      }
      effects?.hide(); // drawn in their own pass, not the world pass
      composer.render(dt);
    },
    setUnder: (s, c) => {
      under.enabled = s !== null && c !== null;
      if (s && c) [under.scene, under.camera] = [s, c];
      world.clear = !under.enabled;
      world.clearDepth = under.enabled;
    },
    setSize: (w, h) => composer.setSize(w, h),
    dispose: () => {
      for (const pass of composer.passes) pass.dispose();
      composer.dispose();
    },
  };
}
