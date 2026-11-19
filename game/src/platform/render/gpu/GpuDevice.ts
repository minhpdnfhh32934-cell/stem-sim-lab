import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CubeRenderTarget, PMREMGenerator, WebGPURenderer } from 'three/webgpu';
import { nodeLookOf } from '../nodeLooks';
import { useParticleSprites } from '../particles';
import { installLooks } from './looks';
import { particleSprite } from './particles';
import { GpuPipeline, OUTPUTS } from './pipeline';

export { gpuMirror } from './mirror';

/** A room's capture's cube faces (px), as WebGL's (WorldRenderer.startCapture). */
const CUBE_SIZE = 256;

/** three r186's renderer internals a draw's render context hangs on (GpuDevice.frameDepth). */
interface Internals {
  _callDepth: number;
  _renderContexts: { get(at: unknown, mrt?: unknown, depth?: number): unknown };
}

/**
 * Ultra's drawing device (Phase G2, docs/phase-g2-ultra-next-contract.md §2): three's
 * WebGPURenderer on a canvas of its own, in a chunk loaded only for Ultra. Low, Medium and High
 * keep the WebGLRenderer. WebGPU only: where the browser has none, three would fall back to WebGL 2
 * under the same name, and that is refused here (§4: nothing else is called Ultra).
 */
export class GpuDevice {
  /** The prefilter for environment maps, made with the first. */
  private pmrem: PMREMGenerator | null = null;
  private room: THREE.Texture | null = null;
  private cube: CubeRenderTarget | null = null;
  /** reflection's map, and the map it holds now. */
  private live: THREE.RenderTarget | null = null;
  private shown: THREE.Texture | null = null;
  /** Ultra's post-processing, while an enhanced scene is drawn (pipeline.ts). */
  post: GpuPipeline | null = null;
  /** Pipelines a draw asked for, still being made (inBackground). */
  private making = 0;
  /** compile() calls under way. */
  private compiles = 0;
  /** Counts each time every one asked for is made (WorldRenderer draws its shadows again). */
  settled = 0;

  private constructor(readonly renderer: WebGPURenderer) {
    this.inBackground();
    this.builtForFrame();
  }

  /**
   * shortcut: three r186's private `_nodes` (recheck on an upgrade). compileAsync builds its items
   * one after another across awaits, each for the target and outputs the renderer has as its build
   * starts (NodeMaterial.setup, synchronous in NodeBuilder.prebuild): between frames the canvas,
   * one output, while the frame's pass writes two (pipeline.ts mrt) — the frame's pipelines then
   * failed ("Color target has no corresponding fragment stage output", G2-2). A build begun there
   * (the only async builds: compile below) begins with the frame's.
   */
  private builtForFrame(): void {
    const r = this.renderer;
    const nodes = (
      r as unknown as {
        _nodes: { getForRender(object: unknown, useAsync?: boolean): unknown };
      }
    )._nodes;
    const build = nodes.getForRender.bind(nodes);
    nodes.getForRender = (object, useAsync = false) => {
      if (!useAsync || !this.post) return build(object, useAsync);
      const target = r.getRenderTarget();
      const mrt = r.getMRT();
      r.setRenderTarget(this.post.target);
      r.setMRT(this.post.mrt);
      try {
        return build(object, true);
      } finally {
        r.setRenderTarget(target);
        r.setMRT(mrt);
      }
    };
  }

  /**
   * Pipelines are being made: for a draw (what needs them is not drawn yet), or ahead (compile:
   * built meanwhile, a draw builds it again itself, ~25 ms a material).
   */
  get compiling(): boolean {
    return this.making > 0 || this.compiles > 0;
  }

  /**
   * shortcut: three r186's private `_pipelines` (recheck on an upgrade). Every pipeline a draw asks
   * for is made in the background (createRenderPipelineAsync, on Chrome's worker threads), as
   * compileAsync makes them; three makes them synchronously, and Chrome compiles those on its GPU
   * thread, every frame waiting behind them (2026-11-15 trace, preparation room: ~130, 0.3–0.9 s a
   * batch, frames of up to 4 s). What a pipeline is not ready for is not drawn until it is (three's
   * Pipelines.isReady): a moment later, the first time only.
   */
  private inBackground(): void {
    const pipelines = (
      this.renderer as unknown as {
        _pipelines: {
          getForRender(object: unknown, promises?: Promise<unknown>[] | null): unknown;
          updateForRender(object: unknown): void;
        };
      }
    )._pipelines;
    const asked: Promise<unknown>[] = [];
    const made = () => {
      if (--this.making === 0) this.settled++;
    };
    pipelines.updateForRender = (object) => {
      pipelines.getForRender(object, asked);
      if (asked.length === 0) return; // every frame, every object: nothing made, nothing allocated
      for (const promise of asked) {
        this.making++;
        void promise.then(made, made);
      }
      asked.length = 0;
    };
  }

  /** The device on `canvas` (a fresh one: a canvas keeps the first kind of context it gave). */
  static async create(canvas: HTMLCanvasElement): Promise<GpuDevice> {
    const renderer = new WebGPURenderer({
      canvas,
      antialias: false, // the frame's anti-aliasing is a pass of its own (as under WebGL's Ultra)
      stencil: true, // outlines draw outside their object's silhouette (outlines.ts)
      powerPreference: 'high-performance',
    });
    try {
      await renderer.init();
    } catch (error) {
      void renderer.dispose();
      throw new Error('WebGPU could not start', { cause: error });
    }
    if (!(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend) {
      void renderer.dispose();
      throw new Error('WebGPU is not available in this browser');
    }
    installLooks(renderer); // the materials' own shader looks, from nodes (looks.ts)
    useParticleSprites(particleSprite); // points are one pixel under WebGPU
    return new GpuDevice(renderer);
  }

  /** three's generated room, prefiltered once (WorldRenderer.environmentMap under WebGL). */
  roomLight(): THREE.Texture {
    if (!this.room) {
      this.pmrem ??= new PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.room = this.pmrem.fromScene(room, 0.04).texture;
      room.dispose();
      // A room capture's prefilter once now, on the empty cube: built and made here, not in the
      // frame a room's reflections are first taken (0.6 s, 2026-11-15; WebGL compiles it ahead too).
      const cube = this.cubeTarget();
      this.renderer.initRenderTarget(cube);
      this.pmrem.fromCubemap(cube.texture).dispose();
    }
    return this.room;
  }

  /**
   * The one reflection map the scene and the materials take (WorldRenderer.applyQuality), holding
   * `captured` (a room's, prefiltered) or else the generated room: three builds every lit material
   * again when the texture they reflect changes (1.8 s entering the preparation room, its capture
   * applied), not when its content does. Prefiltered maps are alike in size (cubes of 256).
   */
  reflection(captured: THREE.Texture | null): THREE.Texture {
    const source = captured ?? this.roomLight();
    const { width, height } = source.image as { width: number; height: number };
    if (!this.live || this.live.width !== width || this.live.height !== height) {
      this.live?.dispose();
      // As three's PMREMGenerator makes its own (a cube's faces and their blurs, side by side).
      this.live = new THREE.RenderTarget(width, height, {
        magFilter: THREE.LinearFilter,
        minFilter: THREE.LinearFilter,
        generateMipmaps: false,
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        colorSpace: THREE.LinearSRGBColorSpace,
        depthBuffer: false,
      });
      this.live.texture.mapping = THREE.CubeUVReflectionMapping;
      (this.live.texture as THREE.Texture & { isPMREMTexture: boolean }).isPMREMTexture = true;
      this.shown = null;
    }
    if (this.shown !== source) {
      this.renderer.copyTextureToTexture(source, this.live.texture);
      this.shown = source;
    }
    return this.live.texture;
  }

  /**
   * The cube a room's capture draws into (WorldRenderer.startCapture): one, kept while the device
   * lives, its formats the frame's pass's (half-float colour, three's own depth), so the capture
   * draws with the frame's pipelines (drawFace). three r186 shares a render context between targets
   * alike, and a compile (below) makes its pipelines over several frames from the context as the
   * last draw into it left it, maybe a capture's: kept, that never holds a freed depth (a capture's
   * freed gave pipelines no depth format: they failed).
   */
  cubeTarget(): CubeRenderTarget {
    if (!this.cube) {
      // The frame's outputs too (pipeline.ts mrt): a context, and so a build, for an output count.
      const names = Object.keys(OUTPUTS) as (keyof typeof OUTPUTS)[];
      const cube = new CubeRenderTarget(CUBE_SIZE, { type: OUTPUTS.output, count: names.length });
      cube.texture.name = 'output';
      names.forEach((name, i) => {
        if (i === 0) return;
        // A cube too (three r186 makes only the first one a cube: the others are flat, one layer).
        const more = cube.texture.clone();
        more.name = name;
        more.type = OUTPUTS[name];
        more.renderTarget = cube;
        cube.textures[i] = more;
      });
      this.cube = cube;
    }
    return this.cube;
  }

  /**
   * `scene` seen by `camera` into `face` of `target` (a room's capture), straight (no
   * post-processing). Not the city under the hub's glass: it is the frame's view (pipeline.ts
   * setUnder), and WebGL's captures leave it out too.
   */
  drawFace(
    scene: THREE.Scene,
    camera: THREE.Camera,
    target: THREE.RenderTarget<THREE.CubeTexture>,
    face: number,
  ): void {
    const r = this.renderer;
    const before = r.getRenderTarget();
    const own = scene as unknown as { backgroundNode: unknown };
    const under = own.backgroundNode;
    own.backgroundNode = null;
    // At the frame's depth (frameDepth): drawn with what the frame's materials built, not built
    // again for the capture (2.3 s of builds entering the preparation room).
    const internals = r as unknown as Internals;
    const depth = internals._callDepth;
    internals._callDepth = this.frameDepth - 1; // a draw goes one deeper
    const mrt = r.getMRT();
    try {
      r.setRenderTarget(target, face);
      if (this.post) r.setMRT(this.post.mrt); // and with the frame's outputs (cubeTarget)
      r.render(scene, camera);
    } finally {
      internals._callDepth = depth;
      r.setRenderTarget(before);
      r.setMRT(mrt);
      own.backgroundNode = under;
    }
  }

  /** A room's captured cube prefiltered for its reflections, rough and smooth alike. */
  prefilter(cube: THREE.CubeTexture): THREE.Texture {
    this.pmrem ??= new PMREMGenerator(this.renderer);
    return this.pmrem.fromCubemap(cube).texture;
  }

  /**
   * `objects` (each listed: not their children) given their pipelines before they are drawn, for
   * where the frame draws (the post-processing's target, or the canvas), lit by `scene`: WebGPU
   * makes them in the background, so no frame waits (WorldRenderer.compileOnly under WebGL). Hidden
   * ones, those on another layer and those out of view too; each is put back as it was.
   */
  async compile(
    objects: readonly THREE.Object3D[],
    camera: THREE.Camera,
    scene: THREE.Scene,
  ): Promise<void> {
    // Not what WebGPU cannot draw: a ShaderMaterial with no node look (a particle pool's points:
    // its sprites are drawn instead, particles.ts).
    objects = objects.filter(drawable);
    if (objects.length === 0) return;
    const r = this.renderer;
    const kept = objects.map((o) => [o.visible, o.layers.mask, o.frustumCulled] as const);
    for (const o of objects) {
      o.visible = true;
      o.layers.mask = camera.layers.mask;
      o.frustumCulled = false;
    }
    // shortcut: a stand-in root whose children are the objects (three r186's compileAsync only walks
    // children from it); never updated, so their own world matrices stay. Recheck on an upgrade.
    const root = new THREE.Object3D();
    root.matrixWorldAutoUpdate = false;
    root.children = [...objects];
    const target = r.getRenderTarget();
    const mrt = r.getMRT();
    if (this.post) {
      r.setRenderTarget(this.post.target);
      r.setMRT(this.post.mrt); // built for the frame's outputs, as it draws
    }
    // compileAsync takes its render context at the top depth: asked at the frame's (frameDepth).
    const contexts = (r as unknown as Internals)._renderContexts;
    const get = contexts.get.bind(contexts);
    const depth = this.frameDepth;
    contexts.get = (at: unknown, mrt: unknown = null) => get(at, mrt, depth);
    let compiled: Promise<void>;
    try {
      compiled = r.compileAsync(root, camera, scene); // what it draws is taken before it returns
    } finally {
      delete (contexts as Partial<Internals['_renderContexts']>).get; // its class's again
      r.setRenderTarget(target);
      r.setMRT(mrt);
      objects.forEach((o, i) => {
        const [visible, mask, culled] = kept[i] ?? [o.visible, o.layers.mask, o.frustumCulled];
        o.visible = visible;
        o.layers.mask = mask;
        o.frustumCulled = culled;
      });
    }
    this.compiles++;
    try {
      await compiled;
    } finally {
      this.compiles--;
    }
  }

  /**
   * shortcut: three r186 keeps what a material's build makes per render context, and a context per
   * call depth (its private `_callDepth`, `_renderContexts`; recheck on an upgrade). The frame draws
   * the world nested (pipeline.ts's pass, inside TRAA's), compileAsync and a capture at the top:
   * what they built went unused and the frame built it all again, its pipelines too, compiled on
   * Chrome's GPU thread while frames waited (preparation room: frames of 0.7–1.2 s, 2026-11-15
   * trace). Both are put at the frame's depth.
   */
  private get frameDepth(): number {
    return this.post ? this.post.depth : 0;
  }

  /** The post-processing on or off (WorldRenderer.syncPost). */
  usePost(on: boolean, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (on) this.post ??= new GpuPipeline(this.renderer, scene, camera);
    else {
      this.post?.dispose();
      this.post = null;
    }
  }

  dispose(): void {
    useParticleSprites(null);
    this.post?.dispose();
    this.post = null;
    this.room?.dispose();
    this.room = null;
    this.cube?.dispose();
    this.cube = null;
    this.live?.dispose();
    this.live = null;
    this.shown = null;
    this.pmrem?.dispose();
    this.pmrem = null;
    void this.renderer.dispose();
  }
}

function drawable(object: THREE.Object3D): boolean {
  const material = (object as Partial<THREE.Mesh>).material;
  for (const m of Array.isArray(material) ? material : material ? [material] : []) {
    if ((m as Partial<THREE.ShaderMaterial>).isShaderMaterial && !nodeLookOf(m)) return false;
  }
  return true;
}
