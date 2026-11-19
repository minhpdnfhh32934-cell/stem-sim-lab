import * as THREE from 'three';
import { Swoop, SWOOP_PAST_ROOF, type SwoopState } from '../../../simulation/rocketSwoop';
import { toonGradient } from '../../render/body/BodyModel';
import { burnPulse, NoteVisuals, SPECIES_AT } from './notes3d';
import { IGNITE, type Notes, Plan, type Shot, STUNT } from './plan';
import { CABIN, FLOOR, NOZZLE_END, PrologueRocket } from './rocket';
import { flight, HANG, HANG_OUT, inFlight, makeStuntFrame, SKID_S, type StuntFrame } from './stunt';

/*
 * The rocket opening, played in the live wallpaper's world (Phú 2026-11-18; plan.ts tells it):
 * the rocket on its swoop, Khoa's part of it (the cast plays it from `stunt`), Linh watching
 * (`attention`), the camera's shots, the notes' molecules and arrows, and what the page's notes
 * need (`view`). The wallpaper steps it each frame and runs its world on the rocket's clock.
 */

/** Where the bar Khoa hangs from is as he lets go (world): just off the roof's north-east. */
const GRIP_AT_RELEASE = new THREE.Vector3(21.66, 5.0, -4.11);
/** Where his skid ends on the roof: behind Linh, to her right. */
const STOP = new THREE.Vector3(3.6, 0, 2.6);
/** The wallpaper's clock when he reaches his place by Linh: the sunset sit starts then. */
export const SIT_CLOCK = 140;
/** Puffs of dust where he lands. */
const DUST = 26;
/** Seated and held by her (the sit and the hug's easing done), for a skip. */
const SEATED_AFTER = 8.8;

export interface PrologueView {
  /** Real seconds into it, the rocket's clock, how fast time runs. */
  t: number;
  tau: number;
  scale: number;
  shot: Shot;
  notes: Notes | null;
  notesT: number;
  /** The moments the notes' numbers are taken at (the rocket's clock). */
  chemAt: number;
  physAt: number;
  bioAt: number;
  done: boolean;
}

export type Anchor = 'flame' | 'com' | 'khoa' | 'cabin' | `molecule${number}` | `arrow${number}`;

export class Prologue {
  readonly plan = new Plan();
  readonly swoop = new Swoop(SWOOP_PAST_ROOF);
  readonly rocket: PrologueRocket;
  readonly notes3d: NoteVisuals;
  readonly stunt: StuntFrame = makeStuntFrame();
  readonly attention = new THREE.Vector3();
  /** The moments the notes' numbers are taken at (the rocket's clock). */
  readonly chemAt: number;
  readonly physAt: number;
  readonly bioAt: number;
  private readonly gradient = toonGradient([135, 200, 255]);
  private t = 0;
  private tau: number;
  private finished = false;
  // Scratch.
  private readonly eye = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly follow = new THREE.Vector3();
  private followSet = false;
  private readonly landEye = new THREE.Vector3();
  private readonly shown: PrologueView;
  /** Dust thrown up where he lands. */
  private readonly dust: THREE.InstancedMesh;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s3 = new THREE.Vector3();

  constructor(
    near: THREE.Scene,
    /** Dev, for stills: started this far in (s), and held there. */
    startAt = 0,
    private readonly hold = false,
  ) {
    this.t = Math.min(startAt, this.plan.end - 0.01);
    this.tau = this.plan.tauAt(this.t);
    // Placed so the bar is where it should be as he lets go.
    const at0 = this.swoop.stateAt(0);
    const q = new THREE.Quaternion();
    const probe = new PrologueRocket(this.swoop, new THREE.Vector3(), IGNITE);
    probe.orient(new THREE.Vector3(...at0.axis), q);
    probe.dispose();
    const grip = CABIN.grip
      .clone()
      .applyQuaternion(q)
      .add(new THREE.Vector3(...at0.at));
    const origin = GRIP_AT_RELEASE.clone().sub(grip);
    this.rocket = new PrologueRocket(this.swoop, origin, IGNITE);
    this.notes3d = new NoteVisuals(this.rocket, this.gradient, () => this.rocket.ink.clone());
    this.dust = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshToonMaterial({ color: '#cfcdc7', gradientMap: this.gradient }),
      DUST,
    );
    this.dust.frustumCulled = false;
    this.dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    near.add(this.rocket.group, this.rocket.trail, this.notes3d.forces, this.dust);
    // His flight: from hanging under the bar as he lets go, over the ledge, to his skid's end.
    const s = this.stunt;
    const out = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    s.release.copy(GRIP_AT_RELEASE).addScaledVector(out, HANG_OUT);
    s.release.y -= HANG;
    const T = STUNT.land - STUNT.release;
    const k = SKID_S / (2 * T);
    // The landing spot whose skid ends at STOP (solved for it: the skid runs on his speed).
    s.land.set((STOP.x + k * s.release.x) / (1 + k), 0, (STOP.z + k * s.release.z) / (1 + k));
    flight(s.release, s.land, s.velocity, s.stop, SKID_S);
    // The camera low on the roof ahead of where his skid stops, looking back up at him as he
    // comes over the ledge at it, lands and slides to a stop before it.
    this.a.set(s.velocity.x, 0, s.velocity.z).normalize();
    this.landEye.copy(s.stop).addScaledVector(this.a, 3.4);
    this.landEye.y = 0.28;
    s.camera.copy(this.landEye);
    s.camera.y = 0.5;
    this.chemAt = this.middle('chem');
    this.physAt = this.middle('phys');
    this.bioAt = this.middle('bio');
    this.notes3d.setForces(this.swoop.stateAt(this.physAt));
    this.shown = {
      t: 0,
      tau: this.tau,
      scale: 1,
      shot: 'sky',
      notes: null,
      notesT: 0,
      chemAt: this.chemAt,
      physAt: this.physAt,
      bioAt: this.bioAt,
      done: false,
    };
  }

  /** The rocket's clock in the middle of a note's showing. */
  private middle(which: Notes): number {
    const n = this.plan.notes.find(([w]) => w === which);
    return n ? this.plan.tauAt((n[1] + n[2]) / 2) : 0;
  }

  /** Its state at a note's moment: the numbers the notes show. */
  stateAt(tau: number): SwoopState {
    return this.swoop.stateAt(tau);
  }

  get done(): boolean {
    return this.finished;
  }

  /**
   * One frame of real time `dt`: the rocket's clock moves on by the script; returns how far
   * (the world's own dt) and the wallpaper's clock now.
   */
  step(dt: number): { readonly dt: number; readonly clock: number } {
    const before = this.tau;
    if (!this.finished) {
      this.t = Math.min(this.plan.end, this.t + (this.hold ? 0 : dt));
      this.tau = this.plan.tauAt(this.t);
      if (this.t >= this.plan.end) this.finish();
    } else this.tau += dt;
    return { dt: this.tau - before, clock: SIT_CLOCK + (this.tau - STUNT.standing) };
  }

  /** Straight to its end: he is sat by her, the rocket gone. */
  skip(): void {
    if (this.finished) return;
    this.tau = STUNT.standing + SEATED_AFTER;
    this.t = this.plan.end;
    this.finish();
  }

  private finish(): void {
    this.finished = true;
    this.rocket.group.visible = false;
    this.rocket.trail.visible = false;
    this.notes3d.forces.visible = false;
  }

  /** The stunt for the cast this frame, or none once he is at his place. */
  stuntNow(): StuntFrame | null {
    return this.tau < STUNT.standing && !this.finished ? this.stunt : null;
  }

  /** Linh's look, or none. */
  attentionNow(): THREE.Vector3 | null {
    if (this.finished || this.tau >= STUNT.standing) return null;
    return this.attention;
  }

  /** The rocket, Khoa's points and the notes' 3D at this frame; `inkPx` per metre from the eye. */
  update(inkPx: number, eye: THREE.Vector3): void {
    if (this.finished) return;
    const tau = this.tau;
    const m = this.plan.at(this.t);
    const u = Math.min(1, Math.max(0, (tau - STUNT.doorFrom) / (STUNT.doorTo - STUNT.doorFrom)));
    const chem = m.notes === 'chem' ? m.notesT : -1;
    this.rocket.update(
      tau,
      // Wrenched open: fast at first, running on to its stop.
      1 - (1 - u) ** 3,
      chem >= 0 ? burnPulse(chem) : 0,
      inkPx,
      eye,
    );
    const r = this.rocket;
    const s = this.stunt;
    s.tau = tau;
    s.cabin.copy(r.group.quaternion);
    s.up.set(0, 1, 0).applyQuaternion(s.cabin);
    s.out.set(0, 0, 1).applyQuaternion(s.cabin);
    s.side.set(1, 0, 0).applyQuaternion(s.cabin);
    const v = this.swoop.stateAt(tau).v;
    s.ahead.set(v[0], 0, v[2]).normalize();
    r.local(CABIN.stand, s.stand);
    r.local(CABIN.footL, s.footL);
    r.local(CABIN.footR, s.footR);
    r.onDoor(CABIN.porthole, s.porthole);
    r.onDoor(CABIN.palmL, s.palmL);
    r.onDoor(CABIN.palmR, s.palmR);
    r.onDoor(CABIN.handle, s.handle);
    r.local(CABIN.grip, s.grip);
    r.local(CABIN.frameRear, s.frameRear);
    r.local(CABIN.frameFront, s.frameFront);
    r.local(CABIN.sill, s.sill);
    r.local(CABIN.sillL, s.sillL);
    r.local(CABIN.sillR, s.sillR);
    s.view.set(0.35, 1.0, -0.12); // Linh, on the ledge
    s.rocket.copy(r.group.position);
    // Linh: the rocket coming down, its door as it nears, then him.
    if (tau < -1.6) this.attention.copy(r.group.position);
    else if (tau < STUNT.release) this.attention.copy(s.grip);
    else if (tau < STUNT.land) inFlight(s.release, s.velocity, tau - STUNT.release, this.attention);
    else this.attention.copy(s.stop);
    this.attention.y += 1.1;
    this.updateDust(tau);
    // The notes' molecules and arrows.
    const phys = m.notes === 'phys' ? m.notesT : -1;
    this.notes3d.update(
      chem,
      chem >= 0 ? 1 : 0,
      phys,
      phys >= 0 ? 1 : 0,
      r.group.position,
      this.t,
      inkPx,
      eye,
    );
  }

  /**
   * The camera for this frame: the shot's (cuts between shots; the last one cranes into the
   * wallpaper's own framing, `normal`), its field of view, its up.
   */
  camera(
    camera: THREE.PerspectiveCamera,
    normal: { readonly eye: THREE.Vector3; readonly target: THREE.Vector3; readonly fov: number },
    dt: number,
  ): void {
    if (this.finished) return;
    const m = this.plan.at(this.t);
    const r = this.rocket;
    const com = r.group.position;
    const k = Math.min(1, m.shotT / Math.max(0.001, m.shotLength));
    const ease = k * k * (3 - 2 * k);
    let fov = 40;
    let cabinUp = false;
    switch (m.shot) {
      case 'sky': {
        // From the roof by Linh, low, looking up past her at the rocket diving out of the sky.
        this.eye.set(-3.0, 1.35, 1.9);
        this.a.set(0.35, 0.9, -0.12).sub(this.eye).normalize();
        this.b.copy(com).sub(this.eye).normalize().multiplyScalar(0.85);
        this.look.copy(this.eye).add(this.a.add(this.b).normalize());
        fov = 52 - 8 * ease;
        break;
      }
      case 'tele':
        // Long lens from the roof's corner: the nose swinging up, the engines lighting.
        this.eye.set(15.2, 1.7, 1.2);
        this.look.copy(com).addScaledVector(this.stunt.up, 2);
        fov = 30 - 3 * ease;
        break;
      case 'chem':
        r.local(this.a.set(-8, -27, 33), this.eye);
        r.local(this.b.set(-2.5, -32, 0), this.look);
        fov = 38;
        break;
      case 'phys':
        // Square to the flight's plane: the forces as they are.
        this.eye.copy(com).add(this.a.set(6, 4, 95));
        this.look.copy(com).add(this.a.set(6, 4, 0));
        fov = 38;
        break;
      case 'swoop':
        // From over the city, side-on to its path: the dive curving out along the building.
        this.eye.set(50 - 6 * ease, 9, -72 + 4 * ease);
        // (Leaning towards the tower it is heading for.)
        this.look
          .copy(com)
          .addScaledVector(this.stunt.up, 6)
          .lerp(this.b.set(6, 4, 4), 0.22);
        fov = 46;
        break;
      case 'cabin':
        // In the cabin beside him, by the door: his face at the porthole, the door opening.
        r.local(this.a.set(-1.25, FLOOR + 1.75, 0.15), this.eye);
        r.local(this.b.set(0.2, FLOOR + 1.45, 1.4), this.look);
        fov = 58;
        cabinUp = true;
        break;
      case 'hang':
        // Above and behind him, riding with the rocket: him hanging, the roof and Linh ahead below.
        r.local(this.a.set(2.3, FLOOR + 1.9, 4.3), this.eye);
        this.look
          .copy(this.stunt.grip)
          .multiplyScalar(0.72)
          .addScaledVector(this.b.set(2, 0.4, 1), 0.28);
        this.look.y -= 0.8;
        fov = 60;
        break;
      case 'land':
      case 'crane': {
        // Low on the roof, looking up as he comes over the ledge and lands; then craning into
        // the wallpaper's own framing as he walks to Linh.
        this.khoaAt(this.a);
        const lag = 1 - Math.exp(-6 * dt);
        if (!this.followSet) {
          this.follow.copy(this.a);
          this.followSet = true;
        } else this.follow.lerp(this.a, lag);
        // The impact shakes the camera, dying away (on the rocket's clock: long in the hit-stop).
        const hit = this.tau - STUNT.land;
        const shake = hit > 0 ? 0.09 * Math.exp(-hit / 0.18) : 0;
        if (m.shot === 'land') {
          this.eye.copy(this.landEye);
          this.eye.x += shake * Math.sin(this.t * 71);
          this.eye.y += shake * 0.8 * Math.sin(this.t * 59 + 1);
          this.look.copy(this.follow);
          fov = 48;
        } else {
          this.eye.lerpVectors(this.landEye, normal.eye, ease);
          this.eye.y += 1.2 * Math.sin(Math.PI * ease);
          this.look.lerpVectors(this.follow, normal.target, ease);
          fov = 48 + (normal.fov - 48) * ease;
        }
        break;
      }
    }
    camera.position.copy(this.eye);
    if (cabinUp) camera.up.copy(this.stunt.up);
    else camera.up.set(0, 1, 0);
    camera.lookAt(this.look);
    camera.up.set(0, 1, 0);
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }

  /** A ring of dust thrown out where he lands, settling (none before). */
  private updateDust(tau: number): void {
    const age = tau - STUNT.land;
    const land = this.stunt.land;
    for (let i = 0; i < DUST; i++) {
      const a = (i / DUST) * Math.PI * 2 + 0.37 * Math.sin(i * 7.1);
      let size = 0.0001;
      if (age > 0) {
        const out = 0.2 + (1.1 + 0.5 * Math.sin(i * 3.3)) * (1 - Math.exp(-age / 0.2));
        this.a.set(
          land.x + Math.cos(a) * out,
          0.05 + 0.18 * (1 - Math.exp(-age / 0.3)) * (0.6 + 0.4 * Math.sin(i * 5.7)),
          land.z + Math.sin(a) * out,
        );
        const fade = 1 - Math.min(1, Math.max(0, (age - 0.3) / 0.5));
        size = Math.max(0.0001, (0.07 + 0.16 * (1 - Math.exp(-age / 0.2))) * fade);
      } else this.a.copy(land);
      this.s3.setScalar(size);
      this.m4.compose(this.a, this.q, this.s3);
      this.dust.setMatrixAt(i, this.m4);
    }
    this.dust.instanceMatrix.needsUpdate = true;
  }

  /** About where Khoa's chest is (world), from his part of the script. */
  private khoaAt(out: THREE.Vector3): THREE.Vector3 {
    const s = this.stunt;
    const tau = this.tau;
    if (tau < STUNT.land) inFlight(s.release, s.velocity, Math.max(0, tau - STUNT.release), out);
    else if (tau < STUNT.watched) {
      const u = Math.min(1, (tau - STUNT.land) / SKID_S);
      out.lerpVectors(s.land, s.stop, 1 - (1 - u) * (1 - u));
    } else {
      const u = Math.min(1, (tau - STUNT.watched) / (STUNT.standing - STUNT.watched));
      out.lerpVectors(s.stop, this.b.set(1.05, 0, 0.5), u * u * (3 - 2 * u));
    }
    out.y += 1.0;
    return out;
  }

  /** Where a note points (world), or NaN where there is nothing to point at. */
  anchor(name: Anchor, out: THREE.Vector3): THREE.Vector3 {
    const r = this.rocket;
    if (name === 'flame') return r.local(this.a.set(0, NOZZLE_END - 8, 2.5), out);
    if (name === 'com') return out.copy(r.group.position);
    if (name === 'khoa') return r.local(this.a.set(0.05, FLOOR + 1.62, 1.0), out);
    if (name === 'cabin') return r.local(this.a.set(0.68, FLOOR + 1.46, -1.1), out);
    if (name.startsWith('molecule'))
      return this.notes3d.molecule(SPECIES_AT[Number(name.slice(8))] ?? 0, out);
    return this.notes3d.arrow(Number(name.slice(5)), out);
  }

  arrowVector(i: number): THREE.Vector2 | null {
    return this.notes3d.arrowVector(i);
  }

  /** Where it is now (one object, rewritten by the next call: read it at once). */
  view(): Readonly<PrologueView> {
    const m = this.plan.at(this.t);
    const v = this.shown;
    v.t = this.t;
    v.tau = this.tau;
    v.scale = this.finished ? 1 : m.scale;
    v.shot = m.shot;
    v.notes = this.finished ? null : m.notes;
    v.notesT = m.notesT;
    v.done = this.finished;
    return v;
  }

  /** Everything shown once, for the warm-up to build every shader. */
  showAll(on: boolean): void {
    this.notes3d.showAll(on);
  }

  dispose(): void {
    this.rocket.dispose();
    this.notes3d.dispose();
    this.dust.geometry.dispose();
    (this.dust.material as THREE.Material).dispose();
    this.gradient.dispose();
  }
}
