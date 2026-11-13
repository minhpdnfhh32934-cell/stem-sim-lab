import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Ultra's post-processing (Phase G, docs/phase-g-ultra-contract.md §4.1), in a chunk of its own
 * loaded only when Ultra is chosen: the scene drawn into a half-float target, then ambient
 * occlusion where things meet, bloom on what glows brighter than the room, tone mapping and sRGB
 * (three applies neither when drawing into a target), and SMAA last (the canvas's own MSAA does not
 * reach a target; 4× MSAA on the half-float target cost 60–100 ms a frame at 2561×1601 on the RTX
 * 5070 Laptop under ANGLE/D3D11, SMAA a millisecond or two). The outlines' stencil is kept.
 */
export const POST = {
  /** GTAO: radius in metres (a bench's contact, not a room's corner), how strongly it darkens. */
  ao: { radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1, blend: 1 },
  /**
   * Bloom on lamps, lit screens and the laser only. Threshold in linear units of the half-float
   * target: at 1.1 the labs' lit white walls passed it, and bloom's low-resolution blur laid over
   * the whole room made distant things look soft, as if drawn at a low resolution (Phú, on the
   * real display); at 2 the walls stay sharp and the light strips still glow.
   */
  bloom: { strength: 0.35, radius: 0.45, threshold: 2 },
} as const;

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
  render(dt: number): void;
  /** A scene drawn first, behind the world (the city under the hub's glass), or none. */
  setUnder(scene: THREE.Scene | null, camera: THREE.Camera | null): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
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
  });
  ao.blendIntensity = POST.ao.blend;
  composer.addPass(ao);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    POST.bloom.strength,
    POST.bloom.radius,
    POST.bloom.threshold,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(new SMAAPass());
  return {
    get target() {
      return composer.readBuffer;
    },
    render: (dt) => composer.render(dt),
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
