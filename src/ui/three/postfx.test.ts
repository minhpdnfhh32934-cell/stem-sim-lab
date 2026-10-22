import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAYER } from './layers';

/** Stand-ins for the three.js passes (jsdom has no WebGL): they record what the chain does. */
const reg = vi.hoisted(() => ({
  passes: [] as {
    kind: string;
    enabled: boolean;
    sizes: [number, number][];
    disposed: number;
    renders: { background: unknown; write: unknown; read: unknown }[];
    [k: string]: unknown;
  }[],
  /** Every step of a frame, in order (passes and renderer.render calls). */
  log: [] as string[],
}));

function passClass(kind: string) {
  return class {
    kind = kind;
    enabled = true;
    sizes: [number, number][] = [];
    disposed = 0;
    renders: { background: unknown; write: unknown; read: unknown }[] = [];
    blendIntensity = 1;
    scene: THREE.Scene | undefined;
    camera: THREE.Camera | undefined;
    clip: THREE.Box3 | null = null;
    params: Record<string, unknown> = {};
    blendMaterial = { depthTest: true, depthWrite: true };
    renderTargetsHorizontal = [{ texture: { name: 'glow' } }];
    constructor(...args: unknown[]) {
      if (kind === 'gtao') {
        this.scene = args[0] as THREE.Scene;
        this.camera = args[1] as THREE.Camera;
      }
      reg.passes.push(this as never);
    }
    setSize(w: number, h: number) {
      this.sizes.push([w, h]);
    }
    render(_r: unknown, write: unknown, read: unknown) {
      this.renders.push({ background: this.scene?.background ?? null, write, read });
      reg.log.push(kind);
    }
    setSceneClipBox(b: THREE.Box3) {
      this.clip = b;
    }
    updateGtaoMaterial(p: Record<string, unknown>) {
      Object.assign(this.params, p);
    }
    dispose() {
      this.disposed++;
    }
  };
}

vi.mock('three/examples/jsm/postprocessing/GTAOPass.js', () => ({ GTAOPass: passClass('gtao') }));
vi.mock('three/examples/jsm/postprocessing/UnrealBloomPass.js', () => ({
  UnrealBloomPass: passClass('bloom'),
}));
vi.mock('three/examples/jsm/postprocessing/SMAAPass.js', () => ({ SMAAPass: passClass('smaa') }));

const { createPostFx, DEGRADE_ORDER, POSTFX, POSTFX_LAYERS } = await import('./postfx');

interface Draw {
  what: 'scene' | 'quad';
  target: THREE.WebGLRenderTarget | null;
  mask: number;
  background: unknown;
  autoClear: boolean;
  material: THREE.Material | null;
}

function fakeRenderer(maxSamples = 4) {
  const draws: Draw[] = [];
  const reset = vi.fn();
  let target: THREE.WebGLRenderTarget | null = null;
  const r = {
    capabilities: { maxSamples },
    transmissionResolutionScale: 1,
    autoClear: true,
    shadowMap: { autoUpdate: true },
    info: { autoReset: true, reset },
    getPixelRatio: () => 1,
    setRenderTarget(t: THREE.WebGLRenderTarget | null) {
      target = t;
    },
    render(scene: THREE.Object3D, camera: THREE.Camera) {
      const isScene = (scene as Partial<THREE.Scene>).isScene ?? false;
      draws.push({
        what: isScene ? 'scene' : 'quad',
        target,
        mask: camera.layers.mask,
        background: isScene ? (scene as THREE.Scene).background : null,
        autoClear: r.autoClear,
        material: isScene ? null : ((scene as THREE.Mesh).material as THREE.Material),
      });
      reg.log.push(isScene ? `scene:${camera.layers.mask}` : 'quad');
    },
  };
  return { renderer: r as unknown as THREE.WebGLRenderer, draws, reset };
}

const pass = (kind: string) => reg.passes.find((p) => p.kind === kind);
const quadMaterial = (draws: Draw[]) =>
  draws.find((d) => d.what === 'quad')?.material as THREE.ShaderMaterial;
const opts = { width: 10, height: 10, pixelRatio: 1, theme: 'light' as const, samples: 4 };

afterEach(() => {
  reg.passes.length = 0;
  reg.log.length = 0;
});

describe('post-processing chain (High tier, discrete GPU)', () => {
  it('HDR half on a 4× MSAA HalfFloat target with a depth texture; passes in device pixels', () => {
    const { renderer, draws } = fakeRenderer();
    const fx = createPostFx(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), {
      ...opts,
      width: 800,
      height: 600,
      pixelRatio: 2,
    });
    fx.render();
    const hdr = draws[0]?.target;
    expect(hdr?.samples).toBe(4);
    expect(hdr?.texture.type).toBe(THREE.HalfFloatType);
    expect(hdr?.depthTexture).toBeInstanceOf(THREE.DepthTexture);
    expect([hdr?.width, hdr?.height]).toEqual([1600, 1200]);
    // GTAO works at half the device size, bloom at the full size.
    expect(pass('gtao')?.sizes.at(-1)).toEqual([800, 600]);
    expect(pass('bloom')?.sizes.at(-1)).toEqual([1600, 1200]);
    fx.setSize(400, 300, 1);
    expect(pass('gtao')?.sizes.at(-1)).toEqual([200, 150]);
    expect([hdr?.width, hdr?.height]).toEqual([400, 300]);
    // Refraction renders the opaque scene at half size while the chain exists.
    expect(renderer.transmissionResolutionScale).toBe(POSTFX.transmissionScale);
    fx.dispose();
    expect(renderer.transmissionResolutionScale).toBe(1);
  });

  it('a frame: HDR → AO → backdrop on screen → tone-mapped surfaces → shells and haze', () => {
    const { renderer, draws, reset } = fakeRenderer();
    const scene = new THREE.Scene();
    const backdrop = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    scene.background = backdrop;
    const camera = new THREE.PerspectiveCamera(34, 2, 0.1, 100);
    camera.layers.enableAll();
    const fx = createPostFx(renderer, scene, camera, opts);
    fx.render();
    expect(reg.log).toEqual([
      `scene:${POSTFX_LAYERS.hdr}`,
      'gtao',
      `scene:${POSTFX_LAYERS.backdrop}`,
      'quad',
      `scene:${POSTFX_LAYERS.forward}`,
    ]);
    const [hdr, screenBackdrop, quad, forward] = draws;
    // 1. Opaque parts and refracting glass, over the backdrop (refraction sees it), cleared.
    expect(hdr?.mask).toBe((1 << LAYER.OPAQUE) | (1 << LAYER.GLASS));
    expect(hdr?.background).toBe(backdrop);
    expect(hdr?.autoClear).toBe(true);
    // AO reads the HDR picture, never with the backdrop as a surface.
    const ao = pass('gtao')?.renders[0];
    expect(ao?.read).toBe(hdr?.target);
    expect(ao?.background).toBeNull();
    // 2. On screen: the backdrop alone (the camera sees no object's layer), clearing first.
    expect(screenBackdrop?.target).toBeNull();
    expect(screenBackdrop?.mask).toBe(POSTFX_LAYERS.backdrop);
    for (const l of Object.values(LAYER)) expect(POSTFX_LAYERS.backdrop & (1 << l)).toBe(0);
    expect(screenBackdrop?.background).toBe(backdrop);
    expect(screenBackdrop?.autoClear).toBe(true);
    // 3. The surfaces, tone-mapped once, writing their depth over it (no clear).
    expect(quad?.target).toBeNull();
    expect(quad?.autoClear).toBe(false);
    const m = quadMaterial(draws);
    expect(m.toneMapped).toBe(true);
    expect(m.depthWrite).toBe(true);
    expect(m.depthFunc).toBe(THREE.AlwaysDepth);
    expect([m.blending, m.blendSrc, m.blendDst]).toEqual([
      THREE.CustomBlending,
      THREE.OneFactor,
      THREE.OneMinusSrcAlphaFactor,
    ]);
    expect(m.uniforms.tColor?.value).toBe((ao?.write as THREE.WebGLRenderTarget).texture);
    expect(m.uniforms.tDepth?.value).toBe(hdr?.target?.depthTexture);
    expect(m.uniforms.glow?.value).toBe(0);
    // 4. Shells and haze forward on screen, without redrawing the backdrop or clearing.
    expect(forward?.target).toBeNull();
    expect(forward?.mask).toBe((1 << LAYER.SHELL) | (1 << LAYER.FX));
    expect(forward?.background).toBeNull();
    expect(forward?.autoClear).toBe(false);
    // Everything is put back; the frame's draw calls add up (one reset, then none).
    expect(scene.background).toBe(backdrop);
    expect(renderer.autoClear).toBe(true);
    expect(renderer.shadowMap.autoUpdate).toBe(true);
    expect(renderer.info.autoReset).toBe(true);
    expect(reset).toHaveBeenCalledTimes(1);
    fx.dispose();
    backdrop.dispose();
  });

  it('the AO camera follows the main camera and sees only the opaque layer', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 2, 0.1, 100);
    camera.layers.enableAll();
    camera.position.set(1, 2, 3);
    const fx = createPostFx(fakeRenderer().renderer, scene, camera, { ...opts, theme: 'dark' });
    const gtao = pass('gtao');
    const aoCam = gtao?.camera as THREE.PerspectiveCamera;
    expect(aoCam).not.toBe(camera);
    camera.position.set(4, 5, 6);
    fx.render();
    expect(aoCam.position.toArray()).toEqual([4, 5, 6]);
    expect(aoCam.layers.mask).toBe(1 << LAYER.OPAQUE);
    // The main camera still draws everything.
    expect(camera.layers.isEnabled(LAYER.SHELL)).toBe(true);
    // Dark theme blends AO a little stronger.
    expect(gtao?.blendIntensity).toBe(POSTFX.aoBlend.dark);
    fx.setTheme('light');
    expect(gtao?.blendIntensity).toBe(POSTFX.aoBlend.light);
    // The subject's bounds set the clip box and a radius of 4 % of its bounding radius.
    const box = new THREE.Box3(new THREE.Vector3(-3, -4, 0), new THREE.Vector3(3, 4, 0));
    fx.setSubject(box);
    expect(gtao?.clip).toBe(box);
    expect((gtao?.params as { radius?: number } | undefined)?.radius).toBeCloseTo(0.2, 6);
    fx.dispose();
  });

  it('bloom runs only while a highlight is shown; its halo reaches the composite', () => {
    const { renderer, draws } = fakeRenderer();
    const fx = createPostFx(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), opts);
    const bloom = pass('bloom');
    expect(bloom?.enabled).toBe(false);
    // Adding the halo never touches the HDR depth (the composite reads it).
    expect(bloom?.blendMaterial).toEqual({ depthTest: false, depthWrite: false });
    fx.setHighlight(true);
    expect(fx.highlight).toBe(true);
    expect(bloom?.enabled).toBe(true);
    fx.render();
    expect(reg.log).toEqual([
      `scene:${POSTFX_LAYERS.hdr}`,
      'gtao',
      'bloom',
      `scene:${POSTFX_LAYERS.backdrop}`,
      'quad',
      `scene:${POSTFX_LAYERS.forward}`,
    ]);
    // Bloom adds into the AO output, which the composite reads, with the halo texture.
    expect(bloom?.renders[0]?.read).toBe(pass('gtao')?.renders[0]?.write);
    const m = quadMaterial(draws);
    expect(m.uniforms.glow?.value).toBe(1);
    expect(m.uniforms.tGlow?.value).toEqual({ name: 'glow' });
    fx.setHighlight(false);
    expect(bloom?.enabled).toBe(false);
    fx.dispose();
  });

  it('degrades AO first, then bloom, then refraction; visual only', () => {
    const { renderer, draws } = fakeRenderer();
    const fx = createPostFx(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), opts);
    fx.setHighlight(true);
    expect(DEGRADE_ORDER).toEqual(['ao', 'bloom', 'transmission']);
    expect(fx.degrade()).toBe('ao');
    expect(pass('gtao')?.enabled).toBe(false);
    // Without AO the composite reads the HDR target itself.
    fx.render();
    expect(reg.log).not.toContain('gtao');
    expect(quadMaterial(draws).uniforms.tColor?.value).toBe(draws[0]?.target?.texture);
    expect(fx.degrade()).toBe('bloom');
    expect(pass('bloom')?.enabled).toBe(false);
    expect(fx.degrade()).toBe('transmission');
    expect(fx.state).toEqual({ ao: false, bloom: false, transmission: false });
    expect(fx.degrade()).toBeNull();
    fx.dispose();
  });

  it('no multisampled target: SMAA before the composite, which reads its output', () => {
    const { renderer, draws } = fakeRenderer(0);
    const fx = createPostFx(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), opts);
    fx.render();
    expect(draws[0]?.target?.samples).toBe(0);
    expect(reg.log.slice(0, 4)).toEqual([
      `scene:${POSTFX_LAYERS.hdr}`,
      'gtao',
      'smaa',
      `scene:${POSTFX_LAYERS.backdrop}`,
    ]);
    const smaa = pass('smaa');
    expect(smaa?.renders[0]?.read).toBe(pass('gtao')?.renders[0]?.write);
    expect(quadMaterial(draws).uniforms.tColor?.value).toBe(
      (smaa?.renders[0]?.write as THREE.WebGLRenderTarget).texture,
    );
    fx.dispose();
    expect(smaa?.disposed).toBe(1);
  });

  it('dispose frees every pass, render target, the depth texture and the composite', () => {
    const disposeRt = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose');
    const disposeDepth = vi.spyOn(THREE.DepthTexture.prototype, 'dispose');
    const disposeMaterial = vi.spyOn(THREE.ShaderMaterial.prototype, 'dispose');
    const fx = createPostFx(
      fakeRenderer().renderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      opts,
    );
    fx.dispose();
    for (const p of reg.passes) expect(p.disposed, p.kind).toBe(1);
    // HDR + AO targets (no SMAA target with MSAA).
    expect(disposeRt).toHaveBeenCalledTimes(2);
    expect(disposeDepth).toHaveBeenCalled();
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
    disposeRt.mockRestore();
    disposeDepth.mockRestore();
    disposeMaterial.mockRestore();
  });
});
