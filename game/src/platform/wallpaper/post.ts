import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/*
 * The wallpaper's picture (Phase W), as the game's Ultra under WebGL (`render/post.ts`): drawn into
 * a half-float target — the far pass, then the near pass over it with the depth cleared — bloom on
 * what glows past the threshold, tone mapping and sRGB, a grade (warmth, saturation, contrast and
 * a light vignette, on the picture as shown), SMAA last. No grain: Phú dislikes noise.
 */

export interface Grade {
  /** + amber, − blue. */
  warmth: number;
  saturation: number;
  contrast: number;
  /** How much the corners darken (0–1). */
  vignette: number;
}

export interface WallpaperPost {
  readonly grade: Grade;
  readonly bloom: UnrealBloomPass;
  /**
   * Every program the picture needs compiled ahead, off the page's thread where the browser can:
   * the scenes' as drawn into the picture's own target (three builds another kind for the screen;
   * compiled for the screen, they were all built again at the first frame, ~4 s), and the passes'.
   * `clipped`: what in the near pass is cut by a plane of its own (the people, by the outfits'
   * scan): three builds those with the plane only when drawing, so they are compiled again with
   * one (left out, the first near frame rebuilt every body's program, 1.4 s).
   */
  compile(clipped?: THREE.Object3D): Promise<void>;
  /** One pass drawn into the picture's target alone (0 the far, 1 the near): its first time. */
  warm(pass: 0 | 1): void;
  render(): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    warmth: { value: 0 },
    saturation: { value: 1 },
    contrast: { value: 1 },
    vignette: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float warmth;
    uniform float saturation;
    uniform float contrast;
    uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col *= vec3(1.0 + 0.06 * warmth, 1.0 + 0.01 * warmth, 1.0 - 0.07 * warmth);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * smoothstep(0.35, 0.95, length(d * vec2(1.25, 1.0)) * 1.25);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

export function wallpaperPost(
  renderer: THREE.WebGLRenderer,
  far: THREE.Scene,
  farCamera: THREE.Camera,
  near: THREE.Scene,
  nearCamera: THREE.Camera,
  width: number,
  height: number,
): WallpaperPost {
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1); // sizes are the drawing buffer's, in device pixels
  composer.setSize(width, height);
  composer.addPass(new RenderPass(far, farCamera));
  const nearPass = new RenderPass(near, nearCamera);
  nearPass.clear = false;
  nearPass.clearDepth = true;
  composer.addPass(nearPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.28, 0.5, 2.4);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const gradePass = new ShaderPass(GRADE_SHADER);
  composer.addPass(gradePass);
  composer.addPass(new SMAAPass());
  const u = gradePass.uniforms as Record<keyof Grade, { value: number }>;
  const grade: Grade = { warmth: 0.35, saturation: 1.06, contrast: 1.04, vignette: 0.22 };
  return {
    grade,
    bloom,
    warm: (pass) => {
      const was = renderer.getRenderTarget();
      renderer.setRenderTarget(composer.readBuffer);
      if (pass === 0) renderer.render(far, farCamera);
      else renderer.render(near, nearCamera);
      renderer.setRenderTarget(was);
    },
    compile: async (clipped) => {
      const was = renderer.getRenderTarget();
      renderer.setRenderTarget(composer.readBuffer);
      await renderer.compileAsync(far, farCamera);
      await renderer.compileAsync(near, nearCamera);
      if (clipped) {
        renderer.clippingPlanes = [new THREE.Plane()];
        await renderer.compileAsync(clipped, nearCamera, near);
        renderer.clippingPlanes = [];
      }
      renderer.setRenderTarget(was);
      // The passes' own materials, each on a quad in a scene of their own.
      const quads = new THREE.Scene();
      const plane = new THREE.PlaneGeometry(2, 2);
      for (const pass of composer.passes) {
        for (const value of Object.values(pass) as unknown[]) {
          for (const m of Array.isArray(value) ? (value as unknown[]) : [value]) {
            if (m instanceof THREE.ShaderMaterial) quads.add(new THREE.Mesh(plane, m));
          }
        }
      }
      await renderer.compileAsync(quads, new THREE.OrthographicCamera());
      plane.dispose();
    },
    render: () => {
      u.warmth.value = grade.warmth;
      u.saturation.value = grade.saturation;
      u.contrast.value = grade.contrast;
      u.vignette.value = grade.vignette;
      composer.render();
    },
    setSize: (w, h) => composer.setSize(w, h),
    dispose: () => {
      for (const pass of composer.passes) pass.dispose();
      composer.dispose();
    },
  };
}
