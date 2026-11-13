import * as THREE from 'three';

/**
 * The guided task's way on the floor (Phase A contract A5): chevrons every SPACING m along the
 * path TaskGuide found, gliding towards its end so the direction reads at a glance. One instanced
 * draw; the path is copied only when TaskGuide's changes, and the chevrons are placed each frame
 * from it without allocating. Hidden when there is no path.
 */
const SPACING = 0.35;
/** Metres a second the chevrons glide. */
const SPEED = 0.5;
/** Above the floor (m): clear of it without seeming to float. */
const LIFT = 0.012;
const MAX = 96;
const COLOR = '#5fe3ff';

/** A flat chevron pointing along +z, about 0.18 m wide. */
function chevron(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.09, -0.04);
  s.lineTo(0, 0.05);
  s.lineTo(0.09, -0.04);
  s.lineTo(0.09, -0.01);
  s.lineTo(0, 0.08);
  s.lineTo(-0.09, -0.01);
  s.closePath();
  // Drawn in x, y and laid flat: its tip (+y) points along +z, the yaw 0 of `update`.
  return new THREE.ShapeGeometry(s).rotateX(Math.PI / 2);
}

export class FloorPath {
  readonly mesh: THREE.InstancedMesh;
  private readonly geometry = chevron();
  private readonly material = new THREE.MeshBasicMaterial({
    color: COLOR,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  private points = new Float64Array(0);
  /** Distance along the path to each point. */
  private along = new Float64Array(0);
  private total = 0;
  private y = 0;
  private phase = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly one = new THREE.Vector3(1, 1, 1);

  constructor() {
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX);
    this.mesh.name = 'floor-path';
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false; // its instances span the room
    this.mesh.renderOrder = 4;
  }

  /** The way as x, z pairs (TaskGuide.path), on the floor at height `floorY`; empty hides it. */
  set(path: readonly number[], floorY: number): void {
    const n = path.length / 2;
    this.points = Float64Array.from(path);
    this.along = new Float64Array(n);
    this.total = 0;
    for (let i = 1; i < n; i++) {
      const dx = (path[2 * i] ?? 0) - (path[2 * i - 2] ?? 0);
      const dz = (path[2 * i + 1] ?? 0) - (path[2 * i - 1] ?? 0);
      this.total += Math.hypot(dx, dz);
      this.along[i] = this.total;
    }
    this.y = floorY + LIFT;
    this.mesh.visible = n >= 2 && this.total > 0;
    if (!this.mesh.visible) this.mesh.count = 0;
  }

  /** Glides the chevrons (every frame while shown: matrices only). */
  update(dt: number): void {
    if (!this.mesh.visible) return;
    this.phase = (this.phase + dt * SPEED) % SPACING;
    const count = Math.min(MAX, Math.floor((this.total - this.phase) / SPACING) + 1);
    let segment = 1;
    for (let k = 0; k < count; k++) {
      const s = this.phase + k * SPACING;
      while (segment < this.along.length - 1 && (this.along[segment] ?? 0) < s) segment++;
      const s0 = this.along[segment - 1] ?? 0;
      const s1 = this.along[segment] ?? s0;
      const t = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
      const x0 = this.points[2 * segment - 2] ?? 0;
      const z0 = this.points[2 * segment - 1] ?? 0;
      const x1 = this.points[2 * segment] ?? x0;
      const z1 = this.points[2 * segment + 1] ?? z0;
      this.position.set(x0 + (x1 - x0) * t, this.y, z0 + (z1 - z0) * t);
      this.turn.setFromAxisAngle(this.up, Math.atan2(x1 - x0, z1 - z0));
      this.mesh.setMatrixAt(k, this.matrix.compose(this.position, this.turn, this.one));
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
