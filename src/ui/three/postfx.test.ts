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
    renders: { background: unknown }[];
    [k: string]: unknown;
  }[],
  composers: [] as { targets: { dispose: () => void; samples: number }[]; disposed: number }[],
}));

vi.mock('three/examples/jsm/postprocessing/EffectComposer.js', () => ({
  EffectComposer: class {
    passes: { enabled: boolean; setSize: (w: number, h: number) => void; render: () => void }[] =
      [];
    pr = 1;
    disposed = 0;
    targets: { dispose: () => void; samples: number; clone: () => unknown }[];
    constructor(_r: unknown, rt: { dispose: () => void; samples: number; clone: () => never }) {
      this.targets = [rt, rt.clone()];
      reg.composers.push(this);
    }
    addPass(p: never) {
      this.passes.push(p);
    }
    setPixelRatio(pr: number) {
      this.pr = pr;
    }
    setSize(w: number, h: number) {
      for (const p of this.passes) p.setSize(w * this.pr, h * this.pr);
    }
    render() {
      for (const p of this.passes) if (p.enabled) p.render();
    }
    dispose() {
      this.disposed++;
      for (const t of this.targets) t.dispose();
    }
  },
}));

function passClass(kind: string) {
  return class {
    kind = kind;
    enabled = true;
    sizes: [number, number][] = [];
    disposed = 0;
    renders: { background: unknown }[] = [];
    blendIntensity = 1;
    scene: THREE.Scene | undefined;
    camera: THREE.Camera | undefined;
    clip: THREE.Box3 | null = null;
    params: Record<string, unknown> = {};
    constructor(...args: unknown[]) {
      if (kind === 'gtao' || kind === 'render') {
        this.scene = args[0] as THREE.Scene;
        this.camera = args[1] as THREE.Camera;
      }
      reg.passes.push(this as never);
    }
    setSize(w: number, h: number) {
      this.sizes.push([w, h]);
    }
    render() {
      this.renders.push({ background: this.scene?.background ?? null });
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

vi.mock('three/examples/jsm/postprocessing/RenderPass.js', () => ({
  RenderPass: passClass('render'),
}));
vi.mock('three/examples/jsm/postprocessing/GTAOPass.js', () => ({ GTAOPass: passClass('gtao') }));
vi.mock('three/examples/jsm/postprocessing/UnrealBloomPass.js', () => ({
  UnrealBloomPass: passClass('bloom'),
}));
vi.mock('three/examples/jsm/postprocessing/OutputPass.js', () => ({
  OutputPass: passClass('output'),
}));
vi.mock('three/examples/jsm/postprocessing/SMAAPass.js', () => ({ SMAAPass: passClass('smaa') }));

const { createPostFx, DEGRADE_ORDER, POSTFX } = await import('./postfx');

function fakeRenderer(maxSamples = 4) {
  return {
    capabilities: { maxSamples },
    transmissionResolutionScale: 1,
    getPixelRatio: () => 1,
  } as unknown as THREE.WebGLRenderer;
}

const pass = (kind: string) => reg.passes.find((p) => p.kind === kind);

afterEach(() => {
  reg.passes.length = 0;
  reg.composers.length = 0;
});

describe('post-processing chain (High tier, discrete GPU)', () => {
  it('render → GTAO (half resolution) → bloom → output, on a 4× MSAA HalfFloat target', () => {
    const renderer = fakeRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const fx = createPostFx(renderer, scene, camera, {
      width: 800,
      height: 600,
      pixelRatio: 2,
      theme: 'light',
      samples: 4,
    });
    expect(reg.passes.map((p) => p.kind)).toEqual(['render', 'gtao', 'bloom', 'output']);
    const target = reg.composers[0]?.targets[0] as unknown as THREE.WebGLRenderTarget;
    expect(target.samples).toBe(4);
    expect(target.texture.type).toBe(THREE.HalfFloatType);
    expect([target.width, target.height]).toEqual([1600, 1200]);
    // The composer sizes passes in device pixels; GTAO works at half of that.
    expect(pass('gtao')?.sizes.at(-1)).toEqual([800, 600]);
    expect(pass('bloom')?.sizes.at(-1)).toEqual([1600, 1200]);
    fx.setSize(400, 300, 1);
    expect(pass('gtao')?.sizes.at(-1)).toEqual([200, 150]);
    // Refraction renders the opaque scene at half size while the chain exists.
    expect(renderer.transmissionResolutionScale).toBe(POSTFX.transmissionScale);
    fx.dispose();
    expect(renderer.transmissionResolutionScale).toBe(1);
  });

  it('the AO pass sees only the opaque layer, and never the backdrop', () => {
    const scene = new THREE.Scene();
    const backdrop = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    scene.background = backdrop;
    const camera = new THREE.PerspectiveCamera(34, 2, 0.1, 100);
    camera.layers.enableAll();
    camera.position.set(1, 2, 3);
    const fx = createPostFx(fakeRenderer(), scene, camera, {
      width: 100,
      height: 50,
      pixelRatio: 1,
      theme: 'dark',
      samples: 4,
    });
    const gtao = pass('gtao');
    const aoCam = gtao?.camera as THREE.PerspectiveCamera;
    expect(aoCam).not.toBe(camera);
    camera.position.set(4, 5, 6);
    fx.render();
    // Copied from the main camera each frame, without the see-through layers.
    expect(aoCam.position.toArray()).toEqual([4, 5, 6]);
    const shell = new THREE.Layers();
    shell.set(LAYER.SHELL);
    const haze = new THREE.Layers();
    haze.set(LAYER.FX);
    const opaque = new THREE.Layers();
    expect(aoCam.layers.test(shell)).toBe(false);
    expect(aoCam.layers.test(haze)).toBe(false);
    expect(aoCam.layers.test(opaque)).toBe(true);
    // The main camera still draws everything.
    expect(camera.layers.test(shell)).toBe(true);
    // During AO the backdrop is off; afterwards it is back.
    expect(gtao?.renders.at(-1)?.background).toBeNull();
    expect(scene.background).toBe(backdrop);
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
    backdrop.dispose();
  });

  it('bloom runs only while a highlight is shown', () => {
    const fx = createPostFx(fakeRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), {
      width: 10,
      height: 10,
      pixelRatio: 1,
      theme: 'light',
      samples: 4,
    });
    expect(pass('bloom')?.enabled).toBe(false);
    fx.setHighlight(true);
    expect(fx.highlight).toBe(true);
    expect(pass('bloom')?.enabled).toBe(true);
    fx.render();
    expect(pass('bloom')?.renders.length).toBe(1);
    fx.setHighlight(false);
    expect(pass('bloom')?.enabled).toBe(false);
    fx.dispose();
  });

  it('degrades AO first, then bloom, then refraction; visual only', () => {
    const fx = createPostFx(fakeRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), {
      width: 10,
      height: 10,
      pixelRatio: 1,
      theme: 'light',
      samples: 4,
    });
    fx.setHighlight(true);
    expect(DEGRADE_ORDER).toEqual(['ao', 'bloom', 'transmission']);
    expect(fx.degrade()).toBe('ao');
    expect(pass('gtao')?.enabled).toBe(false);
    expect(fx.degrade()).toBe('bloom');
    expect(pass('bloom')?.enabled).toBe(false);
    expect(fx.degrade()).toBe('transmission');
    expect(fx.state).toEqual({ ao: false, bloom: false, transmission: false });
    expect(fx.degrade()).toBeNull();
    fx.dispose();
  });

  it('no multisampled target: SMAA after the output pass', () => {
    const fx = createPostFx(fakeRenderer(0), new THREE.Scene(), new THREE.PerspectiveCamera(), {
      width: 10,
      height: 10,
      pixelRatio: 1,
      theme: 'light',
      samples: 4,
    });
    expect(reg.passes.map((p) => p.kind)).toEqual(['render', 'gtao', 'bloom', 'output', 'smaa']);
    expect(reg.composers[0]?.targets[0]?.samples).toBe(0);
    fx.dispose();
    expect(pass('smaa')?.disposed).toBe(1);
  });

  it('dispose frees every pass and both render targets', () => {
    const disposeRt = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose');
    const fx = createPostFx(fakeRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), {
      width: 10,
      height: 10,
      pixelRatio: 1,
      theme: 'light',
      samples: 4,
    });
    fx.dispose();
    for (const p of reg.passes) expect(p.disposed, p.kind).toBe(1);
    expect(reg.composers[0]?.disposed).toBe(1);
    expect(disposeRt).toHaveBeenCalledTimes(2);
    disposeRt.mockRestore();
  });
});
