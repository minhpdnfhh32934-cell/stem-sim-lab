import * as THREE from 'three';

/**
 * The outline round what the held object can act on, and round a task step's object (Phase A
 * contract A2, its §12 amendment 4): three draws per outlined mesh, no post-processing pass.
 * - A mask: the mesh again, writing 1 into the stencil where it is seen (no colour, no depth).
 * - Two shells: the mesh pushed out along its smoothed normals (`outlineNormal`) by a width that
 *   grows with distance (about constant on screen), drawn only where the stencil is not 1, outside
 *   the object's own silhouette: a wide amber one, then a narrow dark one over its inner part. The
 *   amber reads on a dark background, the dark band on a light one; neither is added light, so
 *   neither washes out to white. A see-through vessel is never filled with them.
 * Mask and shells are children of the outlined mesh: they follow it with no work per frame.
 * And a marker: a small turning diamond above each outlined object, about constant on screen,
 * larger over a task step's object, faint where something stands in front of it (one instanced
 * draw seen, one hidden, for every marker together).
 * The renderer needs a stencil buffer (`stencil: true`). Look values (colours, pulse, widths) are
 * Phú's choice (contract §11, amended: amber in place of the white-cyan that washed out).
 */

/** The outline's and the marker's colour, and the dark band inside the outline. */
const AMBER = new THREE.Color('#ffc23a');
const DARK = new THREE.Color('#140d02');
const DARK_OPACITY = 0.8;
/** The shells' push per metre away (≈ 1140 px per metre at 1 m on a 1600 px tall screen). */
const AMBER_WIDTH = 0.0075;
const DARK_WIDTH = 0.0024;
/** The pulse: the amber's width and brightness from this share to full and back, this often (Hz). */
const PULSE_LOW = 0.8;
const PULSE_HZ = 1;
/** Most outlined meshes at once (three draws each). */
export const MAX_OUTLINES = 12;
const STENCIL_REF = 1;
/** Drawn after every glass, liquid and print (their render orders are 1–3). */
const ORDER = 10;
/** The marker's height per metre away (a task step's, any other's), its turn and bob (Hz). */
const MARKER_STEP = 0.026;
const MARKER_TARGET = 0.016;
const MARKER_TURN_HZ = 0.5;
const MARKER_BOB_HZ = 0.5;
/** Every motion here repeats within this (s): the clock wraps on it with no jump. */
const PERIOD = 2;
const MARKER_HIDDEN_OPACITY = 0.4;
/** The attribute the shells push along (a box's split normals would open notches at its corners). */
const OUTLINE_NORMAL = 'outlineNormal';

/**
 * The geometry's normals averaged over the vertices that share a position, made once per geometry
 * and kept on it: a shell pushed along them stays closed at hard edges.
 */
export function outlineNormals(geometry: THREE.BufferGeometry): THREE.BufferAttribute {
  const kept = geometry.getAttribute(OUTLINE_NORMAL);
  if (kept instanceof THREE.BufferAttribute) return kept;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const out = new Float32Array(position.count * 3);
  if (normal) {
    const sums = new Map<string, number[]>();
    const keys: string[] = [];
    for (let k = 0; k < position.count; k++) {
      const key = `${Math.round(position.getX(k) * 1e5)},${Math.round(position.getY(k) * 1e5)},${Math.round(position.getZ(k) * 1e5)}`;
      keys.push(key);
      const [x = 0, y = 0, z = 0] = sums.get(key) ?? [];
      sums.set(key, [x + normal.getX(k), y + normal.getY(k), z + normal.getZ(k)]);
    }
    for (let k = 0; k < position.count; k++) {
      const [x = 0, y = 0, z = 0] = sums.get(keys[k] ?? '') ?? [];
      const length = Math.hypot(x, y, z) || 1;
      out[k * 3] = x / length;
      out[k * 3 + 1] = y / length;
      out[k * 3 + 2] = z / length;
    }
  }
  const attribute = new THREE.BufferAttribute(out, 3);
  geometry.setAttribute(OUTLINE_NORMAL, attribute);
  return attribute;
}

/** A shell's vertex push and its brightness, installed on its material's shader. */
function shell(uniforms: { width: { value: number }; glow: { value: number } }) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.outlineWidth = uniforms.width;
    shader.uniforms.outlineGlow = uniforms.glow;
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        'uniform float outlineWidth;\nattribute vec3 outlineNormal;\nvoid main() {',
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3( position );
         float outlineDepth = max( -( modelViewMatrix * vec4( position, 1.0 ) ).z, 0.3 );
         transformed += outlineNormal * outlineWidth * outlineDepth;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float outlineGlow;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        '#include <opaque_fragment>\ngl_FragColor.rgb *= outlineGlow;',
      );
  };
}

/** A shell's material: drawn where the mask is not, over what is behind (no light added). */
function shellMaterial(color: THREE.Color, opacity: number, uniforms: Uniforms) {
  const material = new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    stencilWrite: true,
    stencilRef: STENCIL_REF,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  });
  material.onBeforeCompile = shell(uniforms);
  return material;
}

/** The marker: a diamond, its upper faces light amber, its lower ones deep (it reads on white). */
function diamond(): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(0.5).scale(0.6, 1, 0.6); // 1 tall, not indexed
  const position = g.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const deep = AMBER.clone().multiplyScalar(0.35);
  const light = AMBER.clone().lerp(new THREE.Color(1, 1, 1), 0.35);
  for (let face = 0; face * 3 < position.count; face++) {
    const up = position.getY(face * 3) + position.getY(face * 3 + 1) + position.getY(face * 3 + 2);
    const color = up < 0 ? deep : face % 2 === 0 ? light : AMBER;
    for (let v = 0; v < 3; v++) color.toArray(colors, (face * 3 + v) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

interface Uniforms {
  width: { value: number };
  glow: { value: number };
}

interface Pair {
  readonly mask: THREE.Mesh;
  readonly amber: THREE.Mesh;
  readonly dark: THREE.Mesh;
  /** The outlined mesh (its marker follows it), and whether it is a task step's object. */
  mesh: THREE.Mesh | null;
  step: boolean;
}

export class Outlines {
  private readonly amberUniforms: Uniforms = { width: { value: AMBER_WIDTH }, glow: { value: 1 } };
  private readonly darkUniforms: Uniforms = { width: { value: DARK_WIDTH }, glow: { value: 1 } };
  readonly maskMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    transparent: true,
    stencilWrite: true,
    stencilRef: STENCIL_REF,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  readonly amberMaterial = shellMaterial(AMBER, 1, this.amberUniforms);
  readonly darkMaterial = shellMaterial(DARK, DARK_OPACITY, this.darkUniforms);
  /** Outlined meshes by entity id. */
  private readonly active = new Map<string, Pair>();
  private readonly free: Pair[] = [];
  private clock = 0;
  /**
   * A pair kept in the scene, hidden, from the start: the renderer compiles hidden objects with
   * the scene (`compileHidden`), so the first outline costs no shader compile in its frame.
   */
  readonly warm: THREE.Group = new THREE.Group();
  private readonly warmGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  /** The markers: add this to the scene. Shown (depth tested) and hidden (behind something). */
  readonly markers = new THREE.Group();
  private readonly markerGeometry = diamond();
  private readonly markerMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  private readonly hiddenMarkerMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
    transparent: true,
    opacity: MARKER_HIDDEN_OPACITY,
    depthWrite: false,
    depthFunc: THREE.GreaterDepth,
  });
  private readonly seen: THREE.InstancedMesh;
  private readonly hidden: THREE.InstancedMesh;
  // Reused by every frame: nothing is allocated there.
  private readonly at = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly size = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor() {
    outlineNormals(this.warmGeometry);
    const pair = this.make();
    pair.mask.geometry = this.warmGeometry;
    pair.amber.geometry = this.warmGeometry;
    pair.dark.geometry = this.warmGeometry;
    this.warm.add(pair.mask, pair.amber, pair.dark);
    this.warm.visible = false;
    this.seen = new THREE.InstancedMesh(this.markerGeometry, this.markerMaterial, MAX_OUTLINES);
    this.hidden = new THREE.InstancedMesh(
      this.markerGeometry,
      this.hiddenMarkerMaterial,
      MAX_OUTLINES,
    );
    this.hidden.instanceMatrix = this.seen.instanceMatrix; // the same places, drawn twice
    this.seen.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.seen.name = 'markers';
    this.hidden.name = 'markers-hidden';
    this.hidden.renderOrder = ORDER + 2;
    for (const m of [this.seen, this.hidden]) {
      m.count = 0;
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false; // placed every frame
    }
    this.markers.add(this.seen, this.hidden);
    this.markers.visible = false;
  }

  /** Entity ids outlined now (tests). */
  get ids(): readonly string[] {
    return [...this.active.keys()];
  }

  /** Markers drawn now (tests). */
  get markerCount(): number {
    return this.markers.visible ? this.seen.count : 0;
  }

  /**
   * Outlines exactly `ids` (at most MAX_OUTLINES): `meshOf` gives each one's mesh to follow, or
   * null for an entity with no view; those also in `steps` get the larger marker. Pairs are
   * reused; nothing is built while nothing changes.
   */
  sync(
    ids: readonly string[],
    meshOf: (id: string) => THREE.Mesh | null,
    steps: readonly string[] = [],
  ): void {
    for (const [id, pair] of [...this.active]) {
      if (!ids.includes(id)) this.release(id, pair);
    }
    for (const id of ids) {
      const kept = this.active.get(id);
      if (kept) {
        kept.step = steps.includes(id);
        continue;
      }
      if (this.active.size >= MAX_OUTLINES) continue;
      const mesh = meshOf(id);
      if (!mesh) continue;
      outlineNormals(mesh.geometry);
      const pair = this.free.pop() ?? this.make();
      pair.mask.geometry = mesh.geometry;
      pair.amber.geometry = mesh.geometry;
      pair.dark.geometry = mesh.geometry;
      pair.mesh = mesh;
      pair.step = steps.includes(id);
      mesh.add(pair.mask, pair.amber, pair.dark);
      this.active.set(id, pair);
    }
    this.markers.visible = this.active.size > 0;
  }

  /** The pulse (two uniforms) and the markers over their objects, seen from `eye` (world). */
  update(dt: number, eye: THREE.Vector3): void {
    this.clock = (this.clock + dt) % PERIOD;
    const wave = 0.5 - 0.5 * Math.cos(2 * Math.PI * PULSE_HZ * this.clock);
    const pulse = PULSE_LOW + (1 - PULSE_LOW) * wave;
    this.amberUniforms.glow.value = pulse;
    this.amberUniforms.width.value = AMBER_WIDTH * pulse;
    if (!this.markers.visible) return;
    const bob = Math.sin(2 * Math.PI * MARKER_BOB_HZ * this.clock);
    this.turn.setFromAxisAngle(this.up, 2 * Math.PI * MARKER_TURN_HZ * this.clock);
    let n = 0;
    for (const pair of this.active.values()) {
      const mesh = pair.mesh;
      if (!mesh) continue;
      const geometry = mesh.geometry;
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      const sphere = geometry.boundingSphere;
      if (!sphere) continue;
      // Over the top of the mesh as last drawn (its world matrix: one frame old at most).
      this.at.copy(sphere.center).applyMatrix4(mesh.matrixWorld);
      this.at.y += sphere.radius * mesh.matrixWorld.getMaxScaleOnAxis();
      const height = this.at.distanceTo(eye) * (pair.step ? MARKER_STEP : MARKER_TARGET);
      this.at.y += height * (1.1 + 0.25 * bob);
      this.size.setScalar(height);
      this.seen.setMatrixAt(n++, this.matrix.compose(this.at, this.turn, this.size));
    }
    this.seen.count = n;
    this.hidden.count = n;
    this.seen.instanceMatrix.needsUpdate = true;
  }

  /** An entity's view went away: its pair goes back to the pool (its mesh is being freed). */
  forget(id: string): void {
    const pair = this.active.get(id);
    if (pair) this.release(id, pair);
    this.markers.visible = this.active.size > 0;
  }

  dispose(): void {
    for (const [id, pair] of [...this.active]) this.release(id, pair);
    this.free.length = 0;
    this.warm.removeFromParent();
    this.markers.removeFromParent();
    this.seen.dispose();
    this.hidden.dispose();
    this.warmGeometry.dispose();
    this.markerGeometry.dispose();
    this.maskMaterial.dispose();
    this.amberMaterial.dispose();
    this.darkMaterial.dispose();
    this.markerMaterial.dispose();
    this.hiddenMarkerMaterial.dispose();
  }

  private make(): Pair {
    const mask = new THREE.Mesh(this.warmGeometry, this.maskMaterial);
    const amber = new THREE.Mesh(this.warmGeometry, this.amberMaterial);
    const dark = new THREE.Mesh(this.warmGeometry, this.darkMaterial);
    mask.name = 'outline-mask';
    amber.name = 'outline';
    dark.name = 'outline-inner';
    mask.renderOrder = ORDER;
    amber.renderOrder = ORDER + 1;
    dark.renderOrder = ORDER + 2; // over the amber's inner part
    for (const m of [mask, amber, dark]) {
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false; // the shell is wider than the geometry's bounds
    }
    return { mask, amber, dark, mesh: null, step: false };
  }

  private release(id: string, pair: Pair): void {
    for (const m of [pair.mask, pair.amber, pair.dark]) {
      m.removeFromParent();
      m.geometry = this.warmGeometry; // never keep a freed mesh's geometry
    }
    pair.mesh = null;
    this.active.delete(id);
    this.free.push(pair);
  }
}
