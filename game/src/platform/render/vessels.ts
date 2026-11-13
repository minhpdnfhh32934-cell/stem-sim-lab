import * as THREE from 'three';
import type { ContainerDefinition } from '../../gameplay/item';
import type { Profile } from '../../simulation/liquid';
import { LOOKS } from './looks';
import { part } from './props/parts';

/**
 * What makes each kind of physical-lab vessel recognisable beyond its lathe (graphics-fidelity
 * audit §3), drawn around the glass ContainerView builds from the container's profile: a reagent
 * bottle's screw cap and paper label, a volumetric flask's printed capacity and stopper, a
 * pipette's printed capacity on its bulb, a wash bottle's cap and delivery tube. Presentation only:
 * nothing here reads or writes container state except `closed` (cap and stopper shown only while
 * the state says so), and no size here is a model input. Sizes the definitions do not give are
 * IMPLEMENTATION ASSUMPTIONS (a school lab's usual proportions), not scientific data.
 */

/** What a vessel adds: parts always shown, and parts shown only while it is closed. */
export interface Fittings {
  readonly fixed: THREE.Object3D[];
  readonly closed: THREE.Object3D[];
  /** A burette's stopcock key: in line with the bore while its tap is open, across it while shut. */
  readonly tapOpen: THREE.Object3D[];
  readonly tapShut: THREE.Object3D[];
}

/** A burette's scale (mL, 0 at the top mark): marks every 0.1 mL, numbered every 1 mL. */
const BURETTE_SCALE = { ml: 50, step: 0.1 };

/** Glass wall (m), as ContainerView draws it. */
const WALL = 0.0015;
/** Print sits this far outside the glass, so it never fights with the glass for depth. */
const LIFT = 0.0003;
/** Enamel print and marks on volumetric glass: a dark blue that reads on a white bench. */
export const PRINT_COLOR = '#1f3f86';
/** The cuvette's lathe is square: 4 segments, scaled so its area is the profile circle's. */
export const SQUARE_SCALE = Math.sqrt(Math.PI / 2);
/** Print and label texels per metre: legible in the close-inspection view at arm's length. */
const PX_PER_M = 12000;

/**
 * Shared materials, geometries and print textures of every vessel view (one set per renderer),
 * so a cabinet of glassware adds parts, not programs. Textures are cached by their text and size.
 */
export class VesselKit {
  readonly plastic = new THREE.MeshStandardMaterial({ color: '#f1f2ee', ...LOOKS.plastic });
  /** Low-density polyethylene: white and translucent, the liquid level shows through. */
  readonly bottle = new THREE.MeshStandardMaterial({
    color: '#eef0ec',
    ...LOOKS.plastic,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  readonly cap = new THREE.MeshStandardMaterial({ color: '#27467a', ...LOOKS.plastic });
  readonly stopper = new THREE.MeshStandardMaterial({ color: '#e9edf0', ...LOOKS.plastic });
  /** A stopcock's PTFE plug and key, a dropper's rubber teat. */
  readonly ptfe = new THREE.MeshStandardMaterial({ color: '#f4f4f0', ...LOOKS.plastic });
  readonly rubber = new THREE.MeshStandardMaterial({ color: '#2b2e32', ...LOOKS.rubber });
  /** Amber glass over a dropper bottle's clear one: light-sensitive indicator solutions. */
  readonly amber = new THREE.MeshStandardMaterial({
    color: '#8a4b12',
    ...LOOKS.glass,
    opacity: 0.6,
    depthWrite: false,
  });
  private readonly prints = new Map<string, THREE.MeshStandardMaterial>();
  private readonly labels = new Map<string, THREE.MeshStandardMaterial>();
  private readonly geometries: THREE.BufferGeometry[] = [];

  /** The fittings of `def`'s vessel; `name` is the item's display name (a bottle's label). */
  build(def: ContainerDefinition, name: string): Fittings {
    const fixed: THREE.Object3D[] = [];
    const closed: THREE.Object3D[] = [];
    const tapOpen: THREE.Object3D[] = [];
    const tapShut: THREE.Object3D[] = [];
    const profile = def.profile;
    if (!profile) return { fixed, closed, tapOpen, tapShut };
    switch (def.vessel) {
      case 'pipette':
        this.pipette(def, profile, fixed);
        break;
      case 'volumetric-flask':
        this.flask(def, profile, fixed, closed);
        break;
      case 'reagent-bottle':
        this.reagentBottle(def, profile, name, fixed, closed);
        break;
      case 'wash-bottle':
        this.washBottle(def, profile, fixed);
        break;
      case 'burette':
        this.burette(def, profile, fixed, tapOpen, tapShut);
        break;
      case 'conical-flask':
        this.conicalFlask(def, profile, fixed);
        break;
      case 'dropper-bottle':
        this.dropperBottle(profile, fixed);
        break;
      default:
        break; // a cuvette's square glass is the lathe itself (ContainerView: SQUARE_SCALE)
    }
    return { fixed, closed, tapOpen, tapShut };
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    this.geometries.length = 0;
    for (const m of [...this.prints.values(), ...this.labels.values()]) {
      m.map?.dispose();
      m.dispose();
    }
    this.prints.clear();
    this.labels.clear();
    for (const m of [
      this.plastic,
      this.bottle,
      this.cap,
      this.stopper,
      this.ptfe,
      this.rubber,
      this.amber,
    ]) {
      m.dispose();
    }
  }

  // ---- vessels --------------------------------------------------------------------------------

  /** Capacity and reference temperature printed lengthwise on the bulb, as on a real pipette. */
  private pipette(def: ContainerDefinition, profile: Profile, fixed: THREE.Object3D[]): void {
    const bulb = widest(profile);
    if (!bulb) return;
    const volume = def.measured?.volumeMl ?? def.fillLimitMl ?? def.capacityMl;
    const radius = bulb.r + WALL + LIFT;
    const height = (bulb.y1 - bulb.y0) * 0.8;
    const arc = 1.4;
    const material = this.print([`${volume} mL`, '20 °C'], radius * arc, height, true);
    fixed.push(this.band(material, radius, bulb.y, height, arc, 'print'));
  }

  /** Capacity printed round the bulb's widest part; an octagonal-head stopper while closed. */
  private flask(
    def: ContainerDefinition,
    profile: Profile,
    fixed: THREE.Object3D[],
    closed: THREE.Object3D[],
  ): void {
    const bulb = widest(profile);
    if (bulb) {
      const volume = def.fillLimitMl ?? def.capacityMl;
      const radius = bulb.r + WALL + LIFT;
      const height = Math.min(0.016, bulb.y1 - bulb.y0 + 0.012);
      const arc = 1.5;
      const material = this.print([`${volume} mL`, '20 °C'], radius * arc, height, false);
      fixed.push(this.band(material, radius, bulb.y, height, arc, 'print'));
    }
    const mouth = def.mouth;
    if (def.closable && mouth) {
      const [x, y, z] = mouth.center;
      const r = mouth.radius;
      const g = this.keep(
        part('body', false, [
          // The tapered plug inside the neck, then a flat octagonal head above the rim.
          new THREE.CylinderGeometry(r + WALL, r * 0.8, 0.014, 16).translate(0, -0.005, 0),
          new THREE.CylinderGeometry(r * 1.9, r * 1.9, 0.007, 8).translate(0, 0.0055, 0),
        ]).geometry,
      );
      const stopper = new THREE.Mesh(g, this.stopper);
      stopper.name = 'stopper';
      stopper.position.set(x, y, z);
      closed.push(stopper);
    }
  }

  /** A paper label printed with the bottle's own name (its concentration); a screw cap while closed. */
  private reagentBottle(
    def: ContainerDefinition,
    profile: Profile,
    name: string,
    fixed: THREE.Object3D[],
    closed: THREE.Object3D[],
  ): void {
    const body = straightest(profile);
    if (body) {
      const radius = body.r + WALL + LIFT;
      const height = (body.y1 - body.y0) * 0.62;
      const arc = 2.2;
      const y = body.y0 + (body.y1 - body.y0) * 0.45;
      fixed.push(
        this.band(this.label(name, radius * arc, height), radius, y, height, arc, 'label'),
      );
    }
    const mouth = def.mouth;
    if (def.closable && mouth) {
      const [x, y, z] = mouth.center;
      const cap = new THREE.Mesh(
        this.keep(screwCap(mouth.radius + WALL + 0.0012, 0.018)),
        this.cap,
      );
      cap.name = 'stopper';
      cap.position.set(x, y - 0.012, z);
      closed.push(cap);
    }
  }

  /**
   * The screw cap and the delivery tube: up from the cap, over in a bend and down to the nozzle,
   * whose tip is the pour's `spout` (data), so the stream starts where the tube ends.
   */
  private washBottle(def: ContainerDefinition, profile: Profile, fixed: THREE.Object3D[]): void {
    const top = profile[profile.length - 1];
    const spout = def.pour?.spout;
    if (!top || !spout) return;
    const [neckR, neckY] = top;
    const capTop = neckY + 0.012;
    const [sx, sy, sz] = spout;
    const rise = Math.max(capTop + 0.03, sy + 0.02);
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, capTop - 0.002, 0),
      new THREE.Vector3(0, rise - 0.008, 0),
      new THREE.Vector3(sx * 0.25, rise, sz * 0.25),
      new THREE.Vector3(sx * 0.75, rise - 0.004, sz * 0.75),
      new THREE.Vector3(sx, sy + 0.008, sz),
      new THREE.Vector3(sx, sy, sz),
    ]);
    const g = this.keep(
      part('body', false, [
        screwCap(neckR + WALL + 0.0015, 0.016).translate(0, neckY - 0.004, 0),
        new THREE.TubeGeometry(path, 40, 0.0022, 10, false),
      ]).geometry,
    );
    const fitting = new THREE.Mesh(g, this.plastic);
    fitting.name = 'nozzle';
    fixed.push(fitting);
  }

  /**
   * The scale, the stopcock and its key. The scale runs from the 0 mark (its fill limit, at the top)
   * down 50 mL to where the profile's bore ends: marks every 0.1 mL, longer each 0.5 and 1 mL,
   * numbered every 1 mL, printed on two bands (each a texture, so 0.1 mL is a few texels). The
   * stopcock sits 4 cm above the tap's tip; its key is two meshes, shown by the tap's state.
   */
  private burette(
    def: ContainerDefinition,
    profile: Profile,
    fixed: THREE.Object3D[],
    tapOpen: THREE.Object3D[],
    tapShut: THREE.Object3D[],
  ): void {
    const bore = straightest(profile);
    const tip = def.tap?.tip;
    if (!bore || !tip) return;
    // The bore holds 1 mL per (π r²)⁻¹ m of tube; the 50 mL mark is where the bore begins.
    const mlPerM = Math.PI * bore.r * bore.r * 1e6;
    const zero = bore.y0 + BURETTE_SCALE.ml / mlPerM;
    const radius = bore.r + WALL + LIFT;
    const arc = 1.6;
    const half = BURETTE_SCALE.ml / 2;
    for (const from of [0, half]) {
      const margin = 0.004;
      const top = zero - from / mlPerM + margin;
      const bottom = zero - (from + half) / mlPerM - margin;
      const material = this.scale(from, from + half, radius * arc, top - bottom, margin, mlPerM);
      fixed.push(this.band(material, radius, (top + bottom) / 2, top - bottom, arc, 'scale'));
    }
    const [x, y, z] = tip;
    const cock = y + 0.04;
    const barrel = this.keep(
      new THREE.CylinderGeometry(0.0045, 0.004, 0.026, 16)
        .rotateZ(Math.PI / 2)
        .translate(x, cock, z),
    );
    const plug = new THREE.Mesh(barrel, this.ptfe);
    plug.name = 'stopcock';
    fixed.push(plug);
    const glass = this.keep(
      new THREE.CylinderGeometry(0.0035, 0.0028, 0.04, 12).translate(x, y + 0.02, z),
    );
    const stem = new THREE.Mesh(glass, this.ptfe);
    stem.name = 'stopcock-stem';
    fixed.push(stem);
    // The key's paddle at the barrel's +x end: along the bore (vertical) is open, across is shut.
    const paddle = this.keep(new THREE.BoxGeometry(0.004, 0.02, 0.007));
    for (const open of [true, false]) {
      const key = new THREE.Mesh(paddle, this.ptfe);
      key.name = open ? 'tap-open' : 'tap-shut';
      key.position.set(x + 0.016, cock, z);
      if (!open) key.rotation.x = Math.PI / 2;
      (open ? tapOpen : tapShut).push(key);
    }
  }

  /** Approximate volume marks printed on the cone (as on a real one): its nominal volume. */
  private conicalFlask(def: ContainerDefinition, profile: Profile, fixed: THREE.Object3D[]): void {
    const foot = profile[0];
    const neck = profile[profile.length - 2];
    if (!foot || !neck) return;
    // Low on the cone, where it is widest but not yet the foot's curve.
    const y = foot[1] + 0.03;
    const t = (y - foot[1]) / (neck[1] - foot[1]);
    const radius = foot[0] + (neck[0] - foot[0]) * t + WALL + LIFT;
    const arc = 1.0;
    const nominal = Math.round(def.capacityMl / 50) * 50;
    const material = this.print([`${nominal} mL`], radius * arc, 0.012, false);
    fixed.push(this.band(material, radius, y, 0.012, arc, 'print'));
  }

  /** Amber over its body, and the rubber teat of its dropper on the neck. */
  private dropperBottle(profile: Profile, fixed: THREE.Object3D[]): void {
    const body = straightest(profile);
    const top = profile[profile.length - 1];
    if (!body || !top) return;
    const shell = this.keep(
      new THREE.CylinderGeometry(
        body.r + WALL + LIFT,
        body.r + WALL + LIFT,
        body.y1 - body.y0,
        24,
        1,
        true,
      ),
    ).translate(0, (body.y0 + body.y1) / 2, 0);
    const amber = new THREE.Mesh(shell, this.amber);
    amber.name = 'amber';
    amber.renderOrder = 3;
    fixed.push(amber);
    const [neckR, neckY] = top;
    const teat = this.keep(
      part('body', false, [
        new THREE.CylinderGeometry(neckR + WALL + 0.001, neckR + WALL + 0.001, 0.008, 16).translate(
          0,
          neckY - 0.002,
          0,
        ),
        new THREE.SphereGeometry(neckR + 0.0005, 16, 10)
          .scale(1, 1.6, 1)
          .translate(0, neckY + 0.009, 0),
      ]).geometry,
    );
    const rubber = new THREE.Mesh(teat, this.rubber);
    rubber.name = 'teat';
    fixed.push(rubber);
  }

  /**
   * A burette band's scale, mL `from` to `to` read down: ticks every 0.1 mL (longer each 0.5 and
   * 1 mL) and the mL number by each whole one, on a transparent texture `around` × `along` m.
   */
  private scale(
    from: number,
    to: number,
    around: number,
    along: number,
    margin: number,
    mlPerM: number,
  ): THREE.MeshStandardMaterial {
    const key = `scale|${from}|${to}|${around.toFixed(4)}|${along.toFixed(4)}`;
    let material = this.prints.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        ...LOOKS.satin,
        transparent: true,
        depthWrite: false,
        map: canvasTexture(texels(around), 1024, (c, w, h) => {
          const pxPerM = h / along;
          c.fillStyle = PRINT_COLOR;
          c.strokeStyle = PRINT_COLOR;
          c.lineWidth = Math.max(1, pxPerM * 0.00025);
          c.textAlign = 'left';
          c.textBaseline = 'middle';
          c.font = `bold ${Math.round(pxPerM * 0.0032)}px sans-serif`;
          const n = Math.round((to - from) / BURETTE_SCALE.step);
          for (let i = 0; i <= n; i++) {
            const ml = from + i * BURETTE_SCALE.step;
            const py = (margin + (ml - from) / mlPerM) * pxPerM;
            const whole = i % 10 === 0;
            const length = whole ? 0.55 : i % 5 === 0 ? 0.4 : 0.25;
            c.beginPath();
            c.moveTo(w * 0.05, py);
            c.lineTo(w * (0.05 + length * 0.6), py);
            c.stroke();
            if (whole) c.fillText(String(Math.round(ml)), w * 0.42, py);
          }
        }),
      });
      this.prints.set(key, material);
    }
    return material;
  }

  // ---- parts ----------------------------------------------------------------------------------

  /** A curved strip of `arc` rad round the axis, facing +z, centred at height y. */
  private band(
    material: THREE.Material,
    radius: number,
    y: number,
    height: number,
    arc: number,
    name: string,
  ): THREE.Mesh {
    const g = this.keep(
      new THREE.CylinderGeometry(radius, radius, height, 24, 1, true, -arc / 2, arc),
    );
    g.translate(0, y, 0);
    const mesh = new THREE.Mesh(g, material);
    mesh.name = name;
    mesh.renderOrder = 3; // over the glass and the liquid behind it
    return mesh;
  }

  /**
   * Enamel print on clear glass: lines of text on a transparent texture `around` × `along` m
   * (round the vessel × along its axis), read round it or, `lengthwise`, up the stem.
   */
  private print(
    lines: readonly string[],
    around: number,
    along: number,
    lengthwise: boolean,
  ): THREE.MeshStandardMaterial {
    const key = `${lengthwise ? 'l' : 'r'}|${around.toFixed(4)}|${along.toFixed(4)}|${lines.join('|')}`;
    let material = this.prints.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        ...LOOKS.satin,
        transparent: true,
        depthWrite: false,
        map: canvasTexture(texels(around), texels(along), (c, w, h) => {
          c.fillStyle = PRINT_COLOR;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          if (!lengthwise) {
            fitLines(c, lines, w, h);
            return;
          }
          // Up the stem: turned a quarter, the text's width runs along the axis.
          c.translate(w / 2, h / 2);
          c.rotate(-Math.PI / 2);
          c.translate(-h / 2, -w / 2);
          fitLines(c, lines, h, w);
        }),
      });
      this.prints.set(key, material);
    }
    return material;
  }

  /** A paper label `around` × `along` m: the bottle's name on white, a coloured band at its top. */
  private label(name: string, around: number, along: number): THREE.MeshStandardMaterial {
    const key = `${around.toFixed(4)}|${along.toFixed(4)}|${name}`;
    let material = this.labels.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        ...LOOKS.matte,
        color: '#ffffff',
        map: canvasTexture(texels(around), texels(along), (c, w, h) => {
          c.fillStyle = '#f7f6f0';
          c.fillRect(0, 0, w, h);
          c.fillStyle = '#7b4bb0';
          c.fillRect(0, 0, w, h * 0.16);
          c.fillStyle = '#15181c';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.translate(0, h * 0.16);
          fitLines(c, wrap(name), w, h * 0.84);
        }),
      });
      this.labels.set(key, material);
    }
    return material;
  }

  private keep<G extends THREE.BufferGeometry>(g: G): G {
    this.geometries.push(g);
    return g;
  }
}

// ---- helpers ------------------------------------------------------------------------------------

/** A screw cap of outer radius r and height h, its base at y 0: ribbed sides, a flat top. */
function screwCap(r: number, h: number): THREE.BufferGeometry {
  return part('body', false, [
    new THREE.CylinderGeometry(r, r, h, 24).translate(0, h / 2, 0),
    // The grip's ribs: a ring of thin bars round the side.
    ...Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return new THREE.BoxGeometry(0.0012, h * 0.8, 0.0012).translate(
        Math.sin(a) * r,
        h / 2,
        Math.cos(a) * r,
      );
    }),
  ]).geometry;
}

/** The profile's widest stretch: its radius, from and to heights, and its middle. */
function widest(profile: Profile): { r: number; y0: number; y1: number; y: number } | null {
  let r = 0;
  for (const [pr] of profile) r = Math.max(r, pr);
  const at = profile.filter(([pr]) => pr >= r - 1e-6).map(([, y]) => y);
  if (r <= 0 || at.length === 0) return null;
  const y0 = Math.min(...at);
  const y1 = Math.max(...at);
  return { r, y0, y1, y: (y0 + y1) / 2 };
}

/** The longest straight (constant-radius) stretch of a profile: a bottle's body. */
function straightest(profile: Profile): { r: number; y0: number; y1: number } | null {
  let best: { r: number; y0: number; y1: number } | null = null;
  profile.forEach(([r1, y1], i) => {
    const [r0, y0] = profile[i - 1] ?? [r1, y1];
    if (i === 0 || Math.abs(r1 - r0) > 1e-6) return;
    if (!best || y1 - y0 > best.y1 - best.y0) best = { r: r0, y0, y1 };
  });
  return best;
}

/** Texels for a length (m) of print: PX_PER_M, at least 16, at most 1024. */
const texels = (m: number) => Math.max(16, Math.min(1024, Math.round(m * PX_PER_M)));

/** A display name broken into label lines: at its comma, else as it is. */
function wrap(name: string): string[] {
  const at = name.indexOf(',');
  return at > 0 ? [name.slice(0, at).trim(), name.slice(at + 1).trim()] : [name];
}

/** Lines centred in w × h at the largest size that fits. */
function fitLines(c: CanvasRenderingContext2D, lines: readonly string[], w: number, h: number) {
  const n = Math.max(lines.length, 1);
  let px = Math.floor((h / n) * 0.72);
  c.font = `bold ${px}px sans-serif`;
  for (const line of lines) {
    const width = c.measureText(line).width;
    if (width > w * 0.9) px = Math.floor(px * ((w * 0.9) / width));
  }
  c.font = `bold ${px}px sans-serif`;
  lines.forEach((line, i) => c.fillText(line, w / 2, (h / n) * (i + 0.5)));
}

/** A canvas texture drawn once; a blank texture where there is no 2D canvas (Node tests). */
function canvasTexture(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.Texture {
  const c =
    typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!c) return new THREE.Texture();
  c.canvas.width = w;
  c.canvas.height = h;
  draw(c, w, h);
  const texture = new THREE.CanvasTexture(c.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
