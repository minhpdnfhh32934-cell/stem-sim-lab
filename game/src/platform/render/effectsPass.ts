import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { particlePools, showParticles, softParticles } from './particles';
import { RIPPLE_GLSL } from './ripples';

/**
 * Max's see-through pass (Phase Max), right after the ambient occlusion: glass that bends what is
 * behind it, then smoke, flames, dust and steam that fade where they meet a surface instead of
 * cutting it — both reading the opaque scene's depth (the AO pass's own: no extra pass).
 *
 * Glass: drawn again over the picture, from the world pass's colour (the AO pass leaves it in the
 * buffer it swapped out: what is behind the glass, its reflection pass included — that pass stays
 * in the world pass, where the lights are) looked up a
 * little off where the glass leans away from the eye. Thin-walled glassware bends the view at its
 * sides and hardly through its middle, so a liquid's level and the scale stay where they are. Its
 * filter tint and darker edge stay.
 *
 * Ripples (Ultra's liquids, ContainerView.ts `stirred`): a stirred liquid's surface drawn again
 * first, from the picture looked up a little off by the ripples' slope — what is under it (the
 * bottom, its print, the tile) wobbles in rings from where a stream or a drop falls in, as through
 * real water — and lighter and darker where the rings gather and spread the light (the bright rings
 * a real ripple throws on the bottom). Into the world pass's picture too, so the glass in front
 * bends the rippled view. Only a surface still stirred is drawn; a still one costs nothing.
 *
 * Particles: drawn at half the resolution into their own target (less to shade where smoke piles
 * up), each fading out over the last part of the way to the surface behind it, then laid over the
 * picture once.
 *
 * In the world pass their materials are hidden (`hide`); here each is drawn on its own, not the
 * scene walked again (the frame is the processor's to spend). A room asleep keeps them undrawn:
 * the camera's layer test is the same.
 */
export interface SeeThrough {
  /** The glassware meshes there are (finishes.ts). */
  readonly glass: () => ReadonlySet<THREE.Mesh>;
  /** Shows or hides the glassware (its materials; not its reflection passes). */
  readonly showGlass: (shown: boolean) => void;
  /** The liquid surfaces stirred now (ContainerView.ts `stirred`): their ripples are drawn here. */
  readonly stirred: () => readonly RippledSurface[];
}

/** A liquid's surface (its disc, the unit circle in its own xz) and how it is stirred. */
export interface RippledSurface {
  readonly cap: THREE.Mesh | null;
  readonly surface: {
    readonly uTime: { value: number };
    readonly uRipple: { value: number };
    readonly uImpact: { value: THREE.Vector2 };
  };
}

/** How far (a share of the picture) a ripple's slope shifts what is under the surface. */
const RIPPLE_SHIFT = 0.012;
/** How much lighter and darker the rings make what is under them (the light they gather). */
const RIPPLE_LENS = 0.35;

const RIPPLE_VERTEX = /* glsl */ `
varying vec2 vSurface;
varying vec3 vAcross;
varying vec3 vAlong;
void main() {
  vSurface = position.xz; // the disc's own unit circle
  vAcross = normalize( normalMatrix * vec3( 1.0, 0.0, 0.0 ) );
  vAlong = normalize( normalMatrix * vec3( 0.0, 0.0, 1.0 ) );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;
/** The rings as ContainerView.ts's reflection draws them (the same waves, the same place). */
const RIPPLE_FRAGMENT = /* glsl */ `
uniform sampler2D tBehind;
uniform sampler2D tDepth;
uniform vec2 uInvSize;
uniform float uTime;
uniform float uRipple;
uniform vec2 uImpact;
uniform float uShift;
uniform float uLens;
varying vec2 vSurface;
varying vec3 vAcross;
varying vec3 vAlong;
${RIPPLE_GLSL}
void main() {
  vec2 uv = gl_FragCoord.xy * uInvSize;
  if ( texture2D( tDepth, uv ).x < gl_FragCoord.z ) discard; // behind something solid
  vec3 wave = ripple( vSurface, uImpact, uTime, uRipple );
  vec3 tilt = wave.x * vAcross + wave.y * vAlong;
  vec2 at = uv - tilt.xy * uShift;
  if ( texture2D( tDepth, at ).x < gl_FragCoord.z ) at = uv; // never what stands in front
  float lens = 1.0 + uLens * wave.z;
  gl_FragColor = vec4( texture2D( tBehind, at ).rgb * lens, 1.0 );
}
`;
/** The rippled pixels copied from the other picture (drawn once, kept in both). */
const COPY_FRAGMENT = /* glsl */ `
uniform sampler2D tBehind;
uniform sampler2D tDepth;
uniform vec2 uInvSize;
void main() {
  vec2 uv = gl_FragCoord.xy * uInvSize;
  if ( texture2D( tDepth, uv ).x < gl_FragCoord.z ) discard;
  gl_FragColor = vec4( texture2D( tBehind, uv ).rgb, 1.0 );
}
`;

/** How far (a share of the picture) the glass shifts what is behind it where seen edge-on. */
const BEND = 0.014;
/** The glassware's filter tint (finishes.ts GLASS_FILTER): its faint cool cast. */
const TINT = new THREE.Color('#e9f3f5');

const GLASS_VERTEX = /* glsl */ `
#include <common>
varying vec3 vN;
varying vec3 vView;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  vN = normalize( transformedNormal );
  vView = -mvPosition.xyz;
}
`;
const GLASS_FRAGMENT = /* glsl */ `
#include <packing>
uniform sampler2D tBehind;
uniform sampler2D tDepth;
uniform vec2 uInvSize;
uniform vec3 uTint;
uniform float uBend;
uniform float uNear;
uniform float uFar;
varying vec3 vN;
varying vec3 vView;
void main() {
  vec2 uv = gl_FragCoord.xy * uInvSize;
  vec3 n = normalize( vN );
  float facing = abs( dot( n, normalize( vView ) ) );
  float edge = pow( 1.0 - facing, 3.0 );
  // Bent where it leans away; never into what stands in front of the glass (its colour would leak),
  // nor across an edge behind it: a thin thing in the glass (a thermometer's column) stays where it
  // is instead of the room far behind it showing in its place.
  vec2 bent = uv + n.xy * uBend * ( 1.0 - facing * facing );
  float there = texture2D( tDepth, bent ).x;
  float here = -perspectiveDepthToViewZ( texture2D( tDepth, uv ).x, uNear, uFar );
  float gap = abs( -perspectiveDepthToViewZ( there, uNear, uFar ) - here );
  vec2 at = there < gl_FragCoord.z || gap > 0.03 + 0.15 * here ? uv : bent;
  vec3 behind = texture2D( tBehind, at ).rgb;
  // The filter (finishes.ts): near-clear with a faint cast, darker towards the edge.
  vec3 through = mix( vec3( 1.0 ), uTint, 0.7 + 0.3 * edge ) * ( 1.0 - 0.45 * edge );
  gl_FragColor = vec4( behind * through, 1.0 );
}
`;

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

/** The opaque scene's depth written into the target drawn on: the glass tests against it. */
const DEPTH_IN = { tDepth: { value: null as THREE.Texture | null } };
const DEPTH_COPY = new THREE.ShaderMaterial({
  uniforms: DEPTH_IN,
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `
uniform sampler2D tDepth;
varying vec2 vUv;
void main() {
  gl_FragDepth = texture2D( tDepth, vUv ).x;
  gl_FragColor = vec4( 0.0 ); // masked (colorWrite false); WebGL wants an output for the buffer
}`,
  depthTest: true,
  depthFunc: THREE.AlwaysDepth,
  depthWrite: true,
  colorWrite: false,
});

/** The particles' picture (premultiplied) laid over the scene. */
const OVER_IN = { tParticles: { value: null as THREE.Texture | null } };
const OVER = new THREE.ShaderMaterial({
  uniforms: OVER_IN,
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `
uniform sampler2D tParticles;
varying vec2 vUv;
void main() { gl_FragColor = texture2D( tParticles, vUv ); }`,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
});

const NO_CHILDREN: THREE.Object3D[] = [];

/** Whether an object and every parent of it are shown (drawn on its own, its parents are not asked). */
function shown(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export class EffectsPass extends Pass {
  private readonly glassIn = {
    tBehind: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uInvSize: { value: new THREE.Vector2() },
    uTint: { value: TINT },
    uBend: { value: BEND },
    uNear: { value: 0.1 },
    uFar: { value: 100 },
  };
  private readonly glassMaterial = new THREE.ShaderMaterial({
    uniforms: this.glassIn,
    vertexShader: GLASS_VERTEX,
    fragmentShader: GLASS_FRAGMENT,
  });
  private readonly rippleIn = {
    tBehind: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uInvSize: { value: new THREE.Vector2() },
    uTime: { value: 0 },
    uRipple: { value: 0 },
    uImpact: { value: new THREE.Vector2() },
    uShift: { value: RIPPLE_SHIFT },
    uLens: { value: RIPPLE_LENS },
  };
  private readonly rippleMaterial = new THREE.ShaderMaterial({
    uniforms: this.rippleIn,
    vertexShader: RIPPLE_VERTEX,
    fragmentShader: RIPPLE_FRAGMENT,
    side: THREE.DoubleSide, // seen from under the surface too, through the side of the glass
    depthTest: false,
    depthWrite: false,
  });
  private readonly copyIn = {
    tBehind: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uInvSize: { value: new THREE.Vector2() },
  };
  private readonly copyMaterial = new THREE.ShaderMaterial({
    uniforms: this.copyIn,
    vertexShader: RIPPLE_VERTEX,
    fragmentShader: COPY_FRAGMENT,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  private readonly quad = new FullScreenQuad();
  private readonly particles: THREE.WebGLRenderTarget;
  private readonly clearColor = new THREE.Color();
  private readonly frustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    /** The opaque scene's depth, at the picture's size (the AO pass's normals pass). */
    private readonly depth: THREE.Texture,
    private readonly through: SeeThrough,
    width: number,
    height: number,
  ) {
    super();
    this.needsSwap = false; // drawn over the picture as it is
    this.particles = new THREE.WebGLRenderTarget(
      Math.max(1, width >> 1),
      Math.max(1, height >> 1),
      { type: THREE.HalfFloatType, depthBuffer: false },
    );
    // Soft from the start: the shader warm-up then compiles the programs drawn (no hitch at a fire).
    const p = this.particles;
    softParticles(depth, camera.near, camera.far, 1 / p.width, 1 / p.height, 0.5);
  }

  /** Hides the glass and particles for the world pass (they are drawn here instead). */
  hide(): void {
    this.through.showGlass(false);
    showParticles(false);
  }

  override setSize(width: number, height: number): void {
    this.particles.setSize(Math.max(1, width >> 1), Math.max(1, height >> 1));
  }

  override render(
    renderer: THREE.WebGLRenderer,
    /** The world pass's picture (the AO pass drew over a copy and swapped). */
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    this.through.showGlass(true);
    showParticles(true);
    const depth = this.depth;
    const camera = this.camera;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.getClearColor(this.clearColor);
    const clearAlpha = renderer.getClearAlpha();
    try {
      // Only what is in view is drawn again (the world pass just set the camera's matrices).
      this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.viewProjection);
      this.ripples(renderer, writeBuffer, readBuffer);
      renderer.setRenderTarget(readBuffer);
      const glass = this.through.glass();
      let first = true;
      for (const mesh of glass) {
        if (!shown(mesh) || !mesh.layers.test(camera.layers)) continue;
        if (mesh.frustumCulled && !this.frustum.intersectsObject(mesh)) continue;
        if (first) {
          // The opaque depth, so glass is hidden behind what stands in front of it.
          first = false;
          DEPTH_IN.tDepth.value = depth;
          this.quad.material = DEPTH_COPY;
          this.quad.render(renderer);
          const u = this.glassIn;
          u.tBehind.value = writeBuffer.texture;
          u.tDepth.value = depth;
          u.uInvSize.value.set(1 / readBuffer.width, 1 / readBuffer.height);
          u.uNear.value = camera.near;
          u.uFar.value = camera.far;
        }
        const own = mesh.material;
        this.glassMaterial.side = Array.isArray(own) ? THREE.FrontSide : own.side;
        mesh.material = this.glassMaterial;
        renderer.render(mesh, camera);
        mesh.material = own;
      }
      // The particles: soft against the opaque scene, at half resolution, then laid over.
      const p = this.particles;
      let any = false;
      for (const points of particlePools()) {
        if (!shown(points) || !points.layers.test(camera.layers)) continue;
        if (!any) {
          any = true;
          softParticles(depth, camera.near, camera.far, 1 / p.width, 1 / p.height, 0.5);
          renderer.setRenderTarget(p);
          renderer.setClearColor(0x000000, 0);
          renderer.clear(true, false, false);
        }
        renderer.render(points, camera);
      }
      if (any) {
        renderer.setRenderTarget(readBuffer);
        OVER_IN.tParticles.value = p.texture;
        this.quad.material = OVER;
        this.quad.render(renderer);
      }
    } finally {
      renderer.setClearColor(this.clearColor, clearAlpha);
      renderer.autoClear = autoClear;
    }
  }

  /**
   * The stirred surfaces in view: rippled into the world pass's picture (read from the frame so far),
   * then those pixels copied into the frame, where the glass is drawn over them from that picture.
   */
  private ripples(
    renderer: THREE.WebGLRenderer,
    picture: THREE.WebGLRenderTarget,
    frame: THREE.WebGLRenderTarget,
  ): void {
    const camera = this.camera;
    const r = this.rippleIn;
    let any = false;
    for (const { cap, surface } of this.through.stirred()) {
      if (!cap || !shown(cap) || !cap.layers.test(camera.layers)) continue;
      if (!this.frustum.intersectsObject(cap)) continue;
      if (!any) {
        any = true;
        renderer.setRenderTarget(picture);
        r.tBehind.value = frame.texture;
        r.tDepth.value = this.depth;
        r.uInvSize.value.set(1 / frame.width, 1 / frame.height);
      }
      r.uTime.value = surface.uTime.value;
      r.uRipple.value = surface.uRipple.value;
      r.uImpact.value.copy(surface.uImpact.value);
      this.drawWith(renderer, cap, this.rippleMaterial);
    }
    if (!any) return;
    renderer.setRenderTarget(frame);
    const c = this.copyIn;
    c.tBehind.value = picture.texture;
    c.tDepth.value = this.depth;
    c.uInvSize.value.copy(r.uInvSize.value);
    for (const { cap } of this.through.stirred()) {
      if (!cap || !shown(cap) || !cap.layers.test(camera.layers)) continue;
      if (!this.frustum.intersectsObject(cap)) continue;
      this.drawWith(renderer, cap, this.copyMaterial);
    }
  }

  /** One mesh on its own in another material, its children (the meniscus band) left out. */
  private drawWith(
    renderer: THREE.WebGLRenderer,
    mesh: THREE.Mesh,
    material: THREE.Material,
  ): void {
    const own = mesh.material;
    const children = mesh.children;
    mesh.material = material;
    mesh.children = NO_CHILDREN;
    try {
      renderer.render(mesh, this.camera);
    } finally {
      mesh.material = own;
      mesh.children = children;
    }
  }

  override dispose(): void {
    softParticles(null, 0, 0, 0, 0, 1);
    showParticles(true);
    this.through.showGlass(true);
    this.particles.dispose();
    this.glassMaterial.dispose();
    this.rippleMaterial.dispose();
    this.copyMaterial.dispose();
    this.quad.dispose();
  }
}
