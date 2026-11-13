import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Game } from '../../game/Game';
import { PHONE_ITEM } from '../../gameplay/phone/PhoneSystem';
import type { GraphicsQuality } from '../../persistence/settings';
import { clockText } from '../../world/clock';
import type { HeldView } from './body/BodyView';

/** The phone's body (m): as its item. */
const W = 0.072;
const H = 0.155;
const D = 0.009;
/**
 * Where it is held, in the camera's frame: low on the right at a forearm's length, tipped back to
 * face the eye — the arm reaches out to it from below (closer, the forearm pointed at the eye and
 * the sleeve filled the view, Phú 2026-11-12).
 */
const HELD_AT = new THREE.Vector3(0.07, -0.15, -0.38);
const HELD_TILT = 0.36;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const;
const FONT = "'Segoe UI', system-ui, sans-serif";

/**
 * The player's phone in the hand (Phase E-2b): taken out of the bag (`game.phone.out`), held low
 * on the right, tipped up to the eye, its screen drawn live — the time, the number dialled, the
 * keypad, the call (ringing, the answer of 114, the brigade's minutes). Built for the graphics
 * preset: Low a plain slab and screen; Medium and High a rounded body with its camera; Ultra a
 * glass front over a sharp screen, a metal band with its buttons, the camera's lenses and flash,
 * the speaker and port slots. The body's right hand closes on it (`held`).
 */
export class PhoneView {
  private readonly group = new THREE.Group();
  private canvasMade: HTMLCanvasElement | null = null;
  private contextMade: CanvasRenderingContext2D | null = null;
  private textureMade: THREE.CanvasTexture | null = null;
  private readonly screenMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
  private readonly owned: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] } = {
    geometries: [],
    materials: [],
  };
  private built: GraphicsQuality | null = null;
  private shown = '';
  private readonly heldView: HeldView;
  private readonly offset = new THREE.Vector3();
  private readonly tilt = new THREE.Quaternion();

  constructor(
    parent: THREE.Object3D,
    private readonly game: Game,
  ) {
    this.group.name = 'phone';
    this.group.visible = false;
    this.tilt.setFromEuler(new THREE.Euler(HELD_TILT, -0.18, 0));
    parent.add(this.group);
    const item = game.content.items.get(PHONE_ITEM);
    this.heldView = { group: this.group, entity: { item }, behind: true };
  }

  /** The screen's canvas, made the first time the phone is built (a browser's document). */
  private get canvas(): HTMLCanvasElement {
    if (!this.canvasMade) {
      this.canvasMade = document.createElement('canvas');
      this.contextMade = this.canvasMade.getContext('2d');
      this.textureMade = new THREE.CanvasTexture(this.canvasMade);
      this.textureMade.colorSpace = THREE.SRGBColorSpace;
      this.screenMaterial.map = this.textureMade;
    }
    return this.canvasMade;
  }

  private get context(): CanvasRenderingContext2D | null {
    return this.contextMade;
  }

  private get texture(): THREE.CanvasTexture | null {
    return this.textureMade;
  }

  /** The phone as a held object for the body's hand, while it is out. */
  get held(): HeldView | null {
    return this.game.phone.out ? this.heldView : null;
  }

  update(camera: THREE.Camera): void {
    const out = this.game.phone.out;
    this.group.visible = out;
    if (!out) return;
    const quality = this.game.graphicsQuality;
    if (quality !== this.built) this.build(quality);
    // In front of the eye, where the camera is now (no lag: it is in the hand, not in the world).
    this.offset.copy(HELD_AT).applyQuaternion(camera.quaternion);
    this.group.position.copy(camera.position).add(this.offset);
    this.group.quaternion.copy(camera.quaternion).multiply(this.tilt);
    this.draw();
  }

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
    this.texture?.dispose();
    this.screenMaterial.dispose();
  }

  // ---- the body, by preset ---------------------------------------------------------------------

  private clear(): void {
    this.group.clear();
    for (const g of this.owned.geometries.splice(0)) g.dispose();
    for (const m of this.owned.materials.splice(0)) m.dispose();
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    this.owned.geometries.push(geometry);
    if (material !== this.screenMaterial && !this.owned.materials.includes(material)) {
      this.owned.materials.push(material);
    }
    this.group.add(mesh);
    return mesh;
  }

  private build(quality: GraphicsQuality): void {
    this.clear();
    this.built = quality;
    const ultra = quality === 'ultra';
    const low = quality === 'low';
    // A sharper screen the higher the preset.
    const px = ultra ? 1024 : low ? 384 : 640;
    this.canvas.width = Math.round((px * W) / H);
    this.canvas.height = px;
    this.shown = '';
    const body = ultra
      ? new THREE.MeshPhysicalMaterial({
          color: '#1b2027',
          metalness: 0.55,
          roughness: 0.32,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
        })
      : new THREE.MeshStandardMaterial({ color: '#1d232b', metalness: 0.3, roughness: 0.5 });
    const radius = low ? 0 : ultra ? 0.0085 : 0.006;
    const shell = low
      ? new THREE.BoxGeometry(W, H, D)
      : new RoundedBoxGeometry(W, H, D, ultra ? 6 : 3, radius);
    this.mesh(shell, body);
    const sw = W - (ultra ? 0.0045 : 0.006);
    const sh = H - (ultra ? 0.006 : 0.012);
    this.mesh(new THREE.PlaneGeometry(sw, sh), this.screenMaterial, 0, 0, D / 2 + 0.0004);
    if (low) return;
    // The camera module on the back.
    const dark = new THREE.MeshStandardMaterial({
      color: '#0d1014',
      metalness: 0.4,
      roughness: 0.35,
    });
    this.mesh(
      new RoundedBoxGeometry(0.026, 0.03, 0.0025, 2, 0.004),
      dark,
      -W / 2 + 0.019,
      H / 2 - 0.021,
      -D / 2 - 0.001,
    );
    if (!ultra) return;
    // Ultra: glass over the screen, the metal band's buttons, the lenses and flash, the slots.
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.12,
      roughness: 0.02,
      metalness: 0,
      clearcoat: 1,
    });
    this.mesh(
      new RoundedBoxGeometry(W - 0.001, H - 0.001, 0.0008, 4, 0.008),
      glass,
      0,
      0,
      D / 2 + 0.0006,
    );
    const band = new THREE.MeshStandardMaterial({
      color: '#8d969f',
      metalness: 1,
      roughness: 0.22,
    });
    for (const [y, h] of [
      [0.035, 0.022],
      [0.006, 0.012],
    ] as const) {
      this.mesh(new RoundedBoxGeometry(0.0016, h, 0.0035, 2, 0.0007), band, W / 2 + 0.0004, y, 0);
    }
    this.mesh(
      new RoundedBoxGeometry(0.0016, 0.03, 0.0035, 2, 0.0007),
      band,
      -W / 2 - 0.0004,
      0.03,
      0,
    );
    const lens = new THREE.MeshPhysicalMaterial({
      color: '#05070a',
      metalness: 0.2,
      roughness: 0.05,
      clearcoat: 1,
    });
    const ring = new THREE.MeshStandardMaterial({
      color: '#a3acb5',
      metalness: 1,
      roughness: 0.25,
    });
    for (const [x, y] of [
      [-W / 2 + 0.013, H / 2 - 0.014],
      [-W / 2 + 0.013, H / 2 - 0.028],
      [-W / 2 + 0.026, H / 2 - 0.014],
    ] as const) {
      const r = new THREE.TorusGeometry(0.0048, 0.0009, 8, 32);
      this.mesh(r, ring, x, y, -D / 2 - 0.0028);
      const l = new THREE.CircleGeometry(0.0042, 32).rotateY(Math.PI);
      this.mesh(l, lens, x, y, -D / 2 - 0.0027);
    }
    const flash = new THREE.MeshStandardMaterial({
      color: '#f5e9c8',
      emissive: '#3a3020',
      roughness: 0.3,
    });
    this.mesh(
      new THREE.CircleGeometry(0.0022, 16).rotateY(Math.PI),
      flash,
      -W / 2 + 0.026,
      H / 2 - 0.028,
      -D / 2 - 0.0027,
    );
    // The speaker over the screen and the port and grilles at the foot.
    this.mesh(
      new RoundedBoxGeometry(0.012, 0.0012, 0.0005, 2, 0.0005),
      dark,
      0,
      H / 2 - 0.0035,
      D / 2 + 0.0002,
    );
    this.mesh(new RoundedBoxGeometry(0.009, 0.0008, 0.003, 2, 0.0004), dark, 0, -H / 2 - 0.0001, 0);
    for (let i = 0; i < 6; i++) {
      const g = new THREE.CylinderGeometry(0.0005, 0.0005, 0.001, 8);
      this.mesh(g, dark, 0.012 + i * 0.0022, -H / 2 - 0.0002, 0);
    }
  }

  // ---- the screen ------------------------------------------------------------------------------

  private draw(): void {
    const c = this.context;
    if (!c) return;
    const phone = this.game.phone;
    const fires = this.game.fires;
    const call = phone.call;
    const brigade = fires.brigadeIn === null ? -1 : Math.ceil(fires.brigadeIn);
    const clockS = this.game.state.world.clockS;
    const key = [
      this.game.language,
      phone.number,
      call.state,
      call.state === 'talking' ? call.outcome : '',
      call.state === 'idle' ? 0 : Math.ceil(call.seconds),
      brigade,
      clockText(clockS),
    ].join('|');
    if (key === this.shown) return;
    this.shown = key;
    const t = this.game.texts;
    const { width: w, height: h } = this.canvas;
    const u = w / 100; // one hundredth of the screen's width
    // Wallpaper.
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0f2a3d');
    sky.addColorStop(1, '#06121c');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    // Status bar: the time, signal and battery.
    c.fillStyle = '#eef4fa';
    c.font = `600 ${5.5 * u}px ${FONT}`;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText(clockText(clockS), 6 * u, 5 * u);
    for (let i = 0; i < 4; i++)
      c.fillRect(70 * u + i * 3 * u, 6.5 * u - i * 1.1 * u, 2 * u, 1.2 * u + i * 1.1 * u);
    c.strokeStyle = '#eef4fa';
    c.lineWidth = 0.5 * u;
    c.strokeRect(84 * u, 3.4 * u, 9 * u, 3.4 * u);
    c.fillRect(85 * u, 4.2 * u, 6 * u, 1.8 * u);
    c.textAlign = 'center';
    if (call.state === 'idle') this.dialler(c, w, h, u);
    else this.inCall(c, w, h, u, brigade);
    // The keys the player has, at the foot.
    c.fillStyle = 'rgba(238,244,250,0.6)';
    c.font = `${3.8 * u}px ${FONT}`;
    c.fillText(
      call.state === 'idle'
        ? t.ui('phone.keys', '0–9 dial · E call · F delete · Q put away')
        : t.ui('phone.keysCall', 'E hang up · Q put away'),
      w / 2,
      h - 4 * u,
    );
    if (this.texture) this.texture.needsUpdate = true;
  }

  /** The number dialled, the emergency numbers to hand, and the keypad. */
  private dialler(c: CanvasRenderingContext2D, w: number, h: number, u: number): void {
    const t = this.game.texts;
    const number = this.game.phone.number;
    c.fillStyle = '#ffffff';
    const size = number.length > 9 ? 11 : 15;
    c.font = `300 ${size * u}px ${FONT}`;
    c.fillText(number || ' ', w / 2, 26 * u);
    c.fillStyle = '#9cc7e6';
    c.font = `${4.4 * u}px ${FONT}`;
    c.fillText(
      number === '114'
        ? t.ui('phone.is114', 'Fire and rescue')
        : number === '113'
          ? t.ui('phone.is113', 'Police')
          : number === '115'
            ? t.ui('phone.is115', 'Ambulance')
            : t.ui('phone.emergency', 'Emergency: 114 fire · 113 police · 115 ambulance'),
      w / 2,
      38 * u,
    );
    // The keypad: three across, round keys, the last digit lit.
    const last = number.at(-1);
    const top = h * 0.36;
    const step = Math.min(26 * u, (h * 0.42) / 4);
    KEYS.forEach((k, i) => {
      const x = w / 2 + ((i % 3) - 1) * 28 * u;
      const y = top + Math.floor(i / 3) * step;
      c.beginPath();
      c.arc(x, y, 10.5 * u, 0, Math.PI * 2);
      c.fillStyle = k === last ? 'rgba(120,190,255,0.45)' : 'rgba(255,255,255,0.12)';
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `400 ${9 * u}px ${FONT}`;
      c.fillText(k, x, y);
    });
    // The call button.
    const y = top + 4 * step + 2 * u;
    c.beginPath();
    c.arc(w / 2, y, 10.5 * u, 0, Math.PI * 2);
    c.fillStyle = number ? '#2fbf5c' : 'rgba(47,191,92,0.35)';
    c.fill();
    handset(c, w / 2, y, u, 0);
  }

  /** A call: ringing, then the answer, the brigade's time to come; the red hang-up key. */
  private inCall(
    c: CanvasRenderingContext2D,
    w: number,
    h: number,
    u: number,
    brigade: number,
  ): void {
    const t = this.game.texts;
    const phone = this.game.phone;
    const call = phone.call;
    c.fillStyle = '#ffffff';
    c.font = `300 ${14 * u}px ${FONT}`;
    c.fillText(phone.number, w / 2, 26 * u);
    c.fillStyle = '#9cc7e6';
    c.font = `${5 * u}px ${FONT}`;
    const lines =
      call.state === 'talking'
        ? wrap(c, answer(t, call.outcome, brigade), w - 14 * u)
        : [t.ui('phone.ringing', 'Calling…')];
    lines.forEach((line, i) => c.fillText(line, w / 2, 40 * u + i * 7 * u));
    // The ring: pulsing circles while it rings.
    if (call.state === 'ringing') {
      c.strokeStyle = 'rgba(156,199,230,0.5)';
      c.lineWidth = 0.8 * u;
      for (let r = 1; r <= 3; r++) {
        c.beginPath();
        c.arc(w / 2, h * 0.58, r * 9 * u, 0, Math.PI * 2);
        c.stroke();
      }
    }
    const y = h * 0.84;
    c.beginPath();
    c.arc(w / 2, y, 10.5 * u, 0, Math.PI * 2);
    c.fillStyle = '#e5484d';
    c.fill();
    handset(c, w / 2, y, u, Math.PI * 0.75);
  }
}

/** What the number answers. */
function answer(
  t: Game['texts'],
  outcome: 'dispatched' | 'already-coming' | 'false-alarm' | 'other-service' | 'no-answer',
  brigade: number,
): string {
  switch (outcome) {
    case 'dispatched':
    case 'already-coming':
      return brigade >= 0
        ? t.ui('phone.dispatched', '114: the fire is reported. The brigade is on its way: {s} s.', {
            s: brigade,
          })
        : t.ui('phone.arrived', '114: the fire brigade has arrived.');
    case 'false-alarm':
      return t.ui(
        'phone.falseAlarm',
        '114: nothing is burning here. A false fire call is against the law — call only for a real fire.',
      );
    case 'other-service':
      return t.ui(
        'phone.otherService',
        'This emergency service is not part of the simulation; for a fire, call 114.',
      );
    case 'no-answer':
      return t.ui('phone.noAnswer', 'The number does not answer.');
  }
}

/** A handset glyph at (x, y), turned by `turn`. */
function handset(c: CanvasRenderingContext2D, x: number, y: number, u: number, turn: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(turn - Math.PI / 4);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.roundRect(-5.5 * u, -1.6 * u, 11 * u, 3.2 * u, 1.6 * u);
  c.fill();
  c.fillRect(-5.5 * u, -1.6 * u, 2.6 * u, 4.6 * u);
  c.fillRect(2.9 * u, -1.6 * u, 2.6 * u, 4.6 * u);
  c.restore();
}

/** Text broken into lines that fit `width`. */
function wrap(c: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
