import * as THREE from 'three';
import { type BodyModel, SKIRT_BONES, SKIRT_DEPTH, skirtAngle } from './BodyModel';

/*
 * The skirt's cloth (C-5, Phú 2026-11-08: clothes that move, never through the body): the lab
 * coat's skirt and a dress hang in eight panels from a ring round the waist (`SKIRT_BONES`). Each
 * panel swings out (+) and in about its top as a damped pendulum, pushed by the body's own motion
 * — it lags when the body starts or stops, trails when it walks, flares when it turns — and it
 * never goes through a leg: a thigh or a shin in the panel's way lifts it over (a stride kicks the
 * coat forward, sitting lays it on the lap). Neighbouring panels pull on each other, so the hem
 * stays one piece. Presentation only: no game state reads it, and the bodies it moves are the
 * renderer's. No allocation per step.
 */

const N = SKIRT_BONES.length;
const STIFF = 70; // 1/s²: back to hanging
const DAMP = 7; // 1/s
const LAG = 3.2; // rad per (m/s²): how far an acceleration swings a panel
const DRAG = 6; // 1/s² per (m/s): air trailing a panel in a walk
const FLARE = 0.25; // a turn's spin (rad/s)² flaring the skirt out
const PULL = 0.1; // how much a panel follows its neighbours each step
const MARGIN = 0.012; // m of cloth kept off a leg
const MIN = -0.25;
const MAX = 1.45;
/** Along each thigh and shin, where the legs are checked (share of the bone). */
const SAMPLES = [0.2, 0.45, 0.7, 1] as const;

const v = new THREE.Vector3();
const w = new THREE.Vector3();
const q = new THREE.Quaternion();
const inverse = new THREE.Matrix4();

export class Cloth {
  private readonly theta = new Float64Array(N);
  private readonly omega = new Float64Array(N);
  private readonly floor = new Float64Array(N);
  /** Each panel's pivot (hips space), outward direction and swing axis. */
  private readonly pivots: THREE.Vector3[];
  private readonly outward: THREE.Vector3[];
  private readonly axes: THREE.Vector3[];
  /** This step's outward direction and axis: seated, the front's turned forward along the lap. */
  private readonly ways: THREE.Vector3[];
  private readonly turns: THREE.Vector3[];
  private readonly rest: number;
  private readonly length: number;
  private readonly halfWidth: number;
  /** The legs' sample points and radii, in hips space this step. */
  private readonly legs: THREE.Vector3[] = [];
  private readonly legR: number[] = [];
  private readonly at = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly accel = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly localVel = new THREE.Vector3();
  private readonly localAcc = new THREE.Vector3();
  private yaw = 0;
  private spin = 0;
  private started = false;

  constructor(private readonly model: BodyModel) {
    this.pivots = SKIRT_BONES.map((name) => model.bones[name].position.clone());
    this.outward = SKIRT_BONES.map((_, k) => {
      const a = skirtAngle(k);
      return new THREE.Vector3(Math.sin(a), 0, Math.cos(a) * SKIRT_DEPTH).normalize();
    });
    // Down × out: a turn by +θ about it swings the panel's hem outward.
    this.axes = this.outward.map((u) => new THREE.Vector3(0, -1, 0).cross(u).normalize());
    this.ways = this.outward.map((u) => u.clone());
    this.turns = this.axes.map((a) => a.clone());
    const ring = Math.hypot(this.pivots[0]?.x ?? 0, (this.pivots[0]?.z ?? 0) / SKIRT_DEPTH);
    const { skirtLength, skirtHem } = model.fit;
    this.length = skirtLength;
    this.rest = Math.atan2(skirtHem - ring, skirtLength);
    this.halfWidth = ((Math.PI * ring) / N) * 1.3;
    for (let i = 0; i < 4 * SAMPLES.length; i++) {
      this.legs.push(new THREE.Vector3());
      this.legR.push(0);
    }
  }

  /**
   * Moves the panels `dt` s on, after the body's pose for this frame is set; `seat` is the world
   * height of what is under the body (the floor, or a chair's seat): no hem goes below it.
   */
  step(dt: number, seat = 0): void {
    if (dt <= 0) return;
    const b = this.model.bones;
    this.model.group.updateMatrixWorld(true);
    const hips = b.hips;
    hips.getWorldPosition(v);
    hips.getWorldQuaternion(q);
    const yaw = 2 * Math.atan2(q.y, q.w);
    if (!this.started) {
      this.started = true;
      this.at.copy(v);
      this.yaw = yaw;
      this.velocity.set(0, 0, 0);
    }
    const h = Math.min(dt, 1 / 30);
    // The hips' velocity and acceleration, in their own frame.
    w.subVectors(v, this.at).divideScalar(dt);
    this.accel.subVectors(w, this.velocity).divideScalar(dt);
    // A teleport (a scene jump) is no motion.
    if (w.lengthSq() > 100) {
      w.set(0, 0, 0);
      this.accel.set(0, 0, 0);
    }
    this.velocity.copy(w);
    this.at.copy(v);
    let dyaw = yaw - this.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    this.spin += (dyaw / dt - this.spin) * Math.min(1, dt * 10);
    this.yaw = yaw;
    this.turn.copy(q).invert();
    const localVel = this.localVel.copy(this.velocity).applyQuaternion(this.turn);
    const localAcc = this.localAcc.copy(this.accel).applyQuaternion(this.turn);

    // The legs in the hips' frame: points along each thigh and shin.
    inverse.copy(hips.matrixWorld).invert();
    let n = 0;
    const { thighR, kneeR } = this.model.fit;
    for (const [upper, lower, end] of [
      [b.thighL, b.shinL, b.footL],
      [b.thighR, b.shinR, b.footR],
    ] as const) {
      for (const [from, to, r0, r1] of [
        [upper, lower, thighR, kneeR],
        [lower, end, kneeR, kneeR * 0.7],
      ] as const) {
        from.getWorldPosition(v);
        to.getWorldPosition(w);
        for (const s of SAMPLES) {
          const p = this.legs[n];
          if (p) p.lerpVectors(v, w, s).applyMatrix4(inverse);
          this.legR[n] = r0 + (r1 - r0) * s + MARGIN;
          n++;
        }
      }
    }

    // Seated, a rigid panel at the front's corners would have to stand out sideways to clear a
    // thigh: cloth lies along the lap instead, so the front half swings forward, over the thighs.
    const lap = THREE.MathUtils.smoothstep(seat, 0.05, 0.3);
    for (let k = 0; k < N; k++) {
      const u0 = this.outward[k];
      const way = this.ways[k];
      const turn = this.turns[k];
      if (!u0 || !way || !turn) continue;
      const front = lap * Math.max(0, Math.min(1, -u0.z * 3));
      way.set(u0.x * (1 - 0.8 * front), 0, u0.z - front * 0.6).normalize();
      turn.set(0, -1, 0).cross(way).normalize();
    }

    // Each panel's least swing that clears the legs.
    for (let k = 0; k < N; k++) {
      const pivot = this.pivots[k];
      const u = this.ways[k];
      const axis = this.turns[k];
      if (!pivot || !u || !axis) continue;
      let least = MIN;
      for (let i = 0; i < n; i++) {
        const p = this.legs[i];
        const r = this.legR[i] ?? 0;
        if (!p) continue;
        v.subVectors(p, pivot);
        if (Math.abs(v.dot(axis)) > this.halfWidth + r) continue;
        const out = v.dot(u);
        const down = -v.y;
        const far = Math.hypot(out, down);
        if (down <= 0 || far > this.length + r || far < 1e-3) continue;
        const need = Math.atan2(out, down) + Math.asin(Math.min(1, r / far)) - this.rest;
        if (need > least) least = need;
      }
      // The panels behind lie on the seat (or the floor) when it is that close: swung out as far as
      // that takes. At the sides and in front a seat is not there: they hang past its edges.
      const above = v.copy(pivot).applyMatrix4(hips.matrixWorld).y - seat - 0.01;
      if ((u.z > 0.35 || seat <= 0) && above < this.length) {
        const lie = Math.acos(Math.max(-1, above / this.length)) - this.rest;
        if (lie > least) least = lie;
      }
      this.floor[k] = Math.min(MAX, least);
    }

    // The pendulums, then the neighbours' pull, then the legs.
    const spinFlare = FLARE * this.spin * this.spin;
    for (let k = 0; k < N; k++) {
      const u = this.ways[k];
      if (!u) continue;
      const theta = this.theta[k] ?? 0;
      const drive =
        -LAG * localAcc.dot(u) - DRAG * localVel.dot(u) * 0.5 + spinFlare - STIFF * theta;
      const omega = (this.omega[k] ?? 0) + (drive - DAMP * (this.omega[k] ?? 0)) * h;
      this.omega[k] = omega;
      this.theta[k] = theta + omega * h;
    }
    for (let k = 0; k < N; k++) {
      const left = this.theta[(k + N - 1) % N] ?? 0;
      const right = this.theta[(k + 1) % N] ?? 0;
      const own = this.theta[k] ?? 0;
      // (Seated, the lap's panels would drag the sides up with them: cloth folds there instead.)
      this.theta[k] = own + PULL * (1 - lap) * ((left + right) / 2 - own);
    }
    for (let k = 0; k < N; k++) {
      const floor = this.floor[k] ?? MIN;
      let theta = Math.min(MAX, Math.max(MIN, this.theta[k] ?? 0));
      if (theta < floor) {
        // Lifted by the leg: it moves with it, never back into it.
        this.omega[k] = Math.max(this.omega[k] ?? 0, (floor - theta) / h);
        theta = floor;
      }
      this.theta[k] = theta;
      const name = SKIRT_BONES[k];
      const axis = this.turns[k];
      if (name && axis) b[name].quaternion.setFromAxisAngle(axis, theta);
    }
  }

  /** The panels' swings (rad), for tests. */
  swings(): readonly number[] {
    return Array.from(this.theta);
  }
}
