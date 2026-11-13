import * as THREE from 'three';
import type { Game } from '../../game/Game';
import {
  edgeNodes,
  holeCount,
  minusPost,
  nodeAt,
  nodeCount,
  partNodes,
  plusPost,
  type MountedPart,
} from '../../gameplay/circuit/board';
import { type Board, LEAD_HEAT, type Reading } from '../../gameplay/circuit/CircuitSystem';
import type { ItemDefinition } from '../../gameplay/item';
import type { Palette } from './palette';
import type { Particles } from './particles';
import { rheostatKnob, rheostatParts, switchParts } from './props/circuit';
import type { PropCache, PropPart } from './props';

/** Light output of a filament lamp against its rated output: (P/P_rated)^(3.4/1.6) (∝ V^3.4). */
const lampOutput = (watts: number, rated: number) => Math.pow(Math.max(0, watts) / rated, 2.125);
/** A lead's insulation fumes from this rise (K): `LEAD_HEAT.smoke` of the circuit system. */
const LEAD_HEAT_SMOKE = LEAD_HEAT.smoke ?? 130;
const DISPLAY_FONT = "bold 44px 'Consolas', 'Courier New', monospace";
const LEAD_COLOURS = ['#c62828', '#1e1e1e', '#1565c0', '#2e7d32', '#f9a825'];

interface PartView {
  readonly group: THREE.Group;
  /** A lamp's glowing bulb and the glow round it. */
  readonly bulb?: THREE.MeshStandardMaterial;
  readonly halo?: THREE.SpriteMaterial;
  /** A meter's reading. */
  readonly screen?: Screen;
}

interface Screen {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  readonly material: THREE.MeshBasicMaterial;
  shown: string;
}

interface BoardView {
  readonly group: THREE.Group;
  /** What changes with the circuit: parts and leads (rebuilt when the board's version moves). */
  readonly built: THREE.Group;
  readonly parts: PartView[];
  readonly geometries: THREE.BufferGeometry[];
  readonly materials: THREE.Material[];
  /** Each lead's own material, to show it glowing hot. */
  readonly leads: THREE.MeshStandardMaterial[];
  readonly supply: Screen;
  version: number;
}

/**
 * The circuit bench drawn (Phase E-1): each board's sockets, its supply's posts, knob and display,
 * the parts plugged in (their props, a switch's blade and a rheostat's slider posed), the leads
 * as arcs, lamps glowing by their light output, meters and the supply showing their readings, and
 * what the aim is on. Reads `game.circuits` only; rebuilt when a board's version changes.
 */
export class CircuitView {
  private readonly views = new Map<string, BoardView>();
  private readonly holder = new THREE.Group();
  private readonly socketGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.002, 12);
  private readonly socketMaterial = new THREE.MeshStandardMaterial({
    color: '#30353b',
    metalness: 0.6,
    roughness: 0.4,
  });
  private readonly postGeometry = new THREE.CylinderGeometry(0.009, 0.009, 0.022, 16);
  private readonly red = new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.5 });
  private readonly black = new THREE.MeshStandardMaterial({ color: '#1e1e1e', roughness: 0.5 });
  private readonly panel = new THREE.MeshStandardMaterial({ color: '#2b3138', roughness: 0.6 });
  private readonly aimMaterial = new THREE.MeshBasicMaterial({
    color: '#4fd6ff',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  private readonly blockedMaterial = new THREE.MeshBasicMaterial({
    color: '#ff5a4f',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  private readonly ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.02, 0.0035, 6, 24).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#0a8cff', toneMapped: false }),
  );
  private readonly ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.aimMaterial);
  private readonly leadGeometry = new THREE.BufferGeometry();
  private readonly lead = new THREE.Line(
    this.leadGeometry,
    new THREE.LineBasicMaterial({ color: '#c62828' }),
  );
  private readonly leadPoints = new Float32Array(3 * 2);
  /** Switch and rheostat variants, built once per size. */
  private readonly variants = new Map<string, readonly PropPart[]>();
  private readonly reading: Reading = { volts: 0, amps: 0, watts: 0 };
  /** A part ruined by heat: blackened all over. */
  private readonly charred = new THREE.MeshStandardMaterial({ color: '#221d1a', roughness: 1 });
  private readonly at = new THREE.Vector3();

  constructor(
    parent: THREE.Object3D,
    private readonly game: Game,
    private readonly palette: Palette,
    private readonly props: PropCache,
    /** Where hot parts and leads smoke into (the fire view's smoke). */
    private readonly smoke: Particles | null = null,
  ) {
    this.holder.name = 'circuit-boards';
    parent.add(this.holder);
    this.leadGeometry.setAttribute('position', new THREE.BufferAttribute(this.leadPoints, 3));
    this.ring.visible = this.ghost.visible = this.lead.visible = false;
  }

  update(dt = 0): void {
    const seen = new Set<string>();
    for (const board of this.game.circuits.all()) {
      seen.add(board.entity.id);
      let view = this.views.get(board.entity.id);
      if (!view) {
        view = this.create(board);
        this.views.set(board.entity.id, view);
      }
      const { position, rotation } = board.entity.pose;
      view.group.position.fromArray(position);
      view.group.quaternion.fromArray(rotation);
      if (view.version !== board.version) this.rebuild(board, view);
      this.glow(board, view, dt);
      this.aim(board, view);
    }
    for (const [id, view] of this.views) if (!seen.has(id)) this.drop(id, view);
  }

  dispose(): void {
    for (const [id, view] of this.views) this.drop(id, view);
    this.holder.removeFromParent();
    for (const parts of this.variants.values()) for (const p of parts) p.geometry.dispose();
    this.socketGeometry.dispose();
    this.postGeometry.dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.ghost.geometry.dispose();
    this.leadGeometry.dispose();
    this.halo?.dispose();
    (this.lead.material as THREE.Material).dispose();
    this.charred.dispose();
    for (const m of [
      this.socketMaterial,
      this.red,
      this.black,
      this.panel,
      this.aimMaterial,
      this.blockedMaterial,
    ])
      m.dispose();
  }

  // ---- a board's fixed parts: sockets, posts, the supply panel --------------------------------

  private create(board: Board): BoardView {
    const { spec } = board;
    const top = board.entity.item.visual.size[1] / 2;
    const group = new THREE.Group();
    group.name = `circuit:${board.entity.id}`;
    const sockets = new THREE.InstancedMesh(
      this.socketGeometry,
      this.socketMaterial,
      holeCount(spec),
    );
    const matrix = new THREE.Matrix4();
    for (let n = 0; n < holeCount(spec); n++) {
      const [x, z] = nodeAt(spec, n);
      sockets.setMatrixAt(n, matrix.makeTranslation(x, top + 0.001, z));
    }
    sockets.receiveShadow = true;
    group.add(sockets);
    for (const [node, material] of [
      [plusPost(spec), this.red],
      [minusPost(spec), this.black],
    ] as const) {
      const post = new THREE.Mesh(this.postGeometry, material);
      const [x, z] = nodeAt(spec, node);
      post.position.set(x, top + 0.011, z);
      post.castShadow = true;
      group.add(post);
    }
    const [x0, z0, x1, z1] = spec.panel;
    const face = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.004, z1 - z0), this.panel);
    face.position.set((x0 + x1) / 2, top + 0.002, (z0 + z1) / 2);
    group.add(face);
    const supply = this.screen(256, 128);
    const display = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0 - 0.03, (z1 - z0) * 0.45),
      supply.material,
    );
    display.rotation.x = -Math.PI / 2;
    display.position.set((x0 + x1) / 2, top + 0.0045, z0 + (z1 - z0) * 0.3);
    group.add(display);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.018, 20), this.black);
    knob.position.set((x0 + x1) / 2, top + 0.013, z0 + (z1 - z0) * 0.75);
    knob.castShadow = true;
    group.add(knob);
    const built = new THREE.Group();
    group.add(built);
    this.holder.add(group);
    return {
      group,
      built,
      parts: [],
      geometries: [face.geometry, display.geometry, knob.geometry],
      materials: [],
      leads: [],
      supply,
      version: -1,
    };
  }

  private screen(width: number, height: number): Screen {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D canvas for the circuit displays');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    return { canvas, context, texture, material, shown: '' };
  }

  private write(screen: Screen, lines: readonly string[], ink: string): void {
    const key = lines.join('\n');
    if (key === screen.shown) return;
    screen.shown = key;
    const { context: c, canvas } = screen;
    c.fillStyle = '#0d1a12';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = ink;
    const px = Math.floor(Math.min(canvas.height / lines.length / 1.3, 64));
    c.font = DISPLAY_FONT.replace('44px', `${px}px`);
    const widest = Math.max(...lines.map((l) => c.measureText(l).width));
    if (widest > canvas.width * 0.92)
      c.font = DISPLAY_FONT.replace('44px', `${Math.floor((px * canvas.width * 0.92) / widest)}px`);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    lines.forEach((line, i) =>
      c.fillText(line, canvas.width / 2, ((i + 0.5) * canvas.height) / lines.length),
    );
    screen.texture.needsUpdate = true;
  }

  // ---- what is plugged in ---------------------------------------------------------------------

  private rebuild(board: Board, view: BoardView): void {
    this.clear(view);
    view.version = board.version;
    const { spec } = board;
    const top = board.entity.item.visual.size[1] / 2;
    board.state.parts.forEach((mounted) => {
      const item = this.game.content.items.tryGet(mounted.item);
      if (item) view.parts.push(this.mount(board, view, mounted, item, top));
    });
    // Leads: arcs from socket to socket, higher the farther apart.
    board.state.wires.forEach(([m, n], i) => {
      const [ax, az] = nodeAt(spec, m);
      const [bx, bz] = nodeAt(spec, n);
      const span = Math.hypot(bx - ax, bz - az);
      const lift = top + 0.01 + Math.min(0.12, 0.05 + span * 0.25);
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(ax, top + 0.012, az),
        new THREE.Vector3((ax + bx) / 2, lift + 0.01 * (i % 3), (az + bz) / 2),
        new THREE.Vector3(bx, top + 0.012, bz),
      );
      const geometry = new THREE.TubeGeometry(curve, 20, 0.0025, 6, false);
      const material = new THREE.MeshStandardMaterial({
        color: LEAD_COLOURS[i % LEAD_COLOURS.length] ?? '#c62828',
        roughness: 0.5,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      view.built.add(mesh);
      view.geometries.push(geometry);
      view.materials.push(material);
      view.leads.push(material);
      // The plugs at its ends.
      for (const [x, z] of [
        [ax, az],
        [bx, bz],
      ] as const) {
        const plug = new THREE.Mesh(this.postGeometry, material);
        plug.scale.set(0.6, 0.6, 0.6);
        plug.position.set(x, top + 0.008, z);
        view.built.add(plug);
      }
    });
  }

  private mount(
    board: Board,
    view: BoardView,
    mounted: MountedPart,
    item: ItemDefinition,
    top: number,
  ): PartView {
    const { spec } = board;
    const size = item.visual.size;
    const [m, n] = edgeNodes(spec, mounted.edge);
    const [ax, az] = nodeAt(spec, m);
    const [bx, bz] = nodeAt(spec, n);
    const group = new THREE.Group();
    group.position.set((ax + bx) / 2, top + size[1] / 2, (az + bz) / 2);
    // Its −x end (its + terminal) at the lower-numbered socket, unless turned round.
    group.rotation.y = (ax === bx ? -Math.PI / 2 : 0) + (mounted.flip ? Math.PI : 0);
    const kind = item.circuit?.kind;
    const prop = item.visual.prop;
    const parts =
      kind === 'switch'
        ? this.variant(`switch:${mounted.setting >= 0.5}:${size.join()}`, () =>
            switchParts(size, mounted.setting >= 0.5),
          )
        : kind === 'rheostat'
          ? this.variant(`rheostat:${size.join()}`, () => rheostatParts(size, false))
          : prop
            ? (this.props.get(prop, size) ?? [])
            : [];
    let bulb: THREE.MeshStandardMaterial | undefined;
    for (const part of parts) {
      let material: THREE.Material = mounted.broken
        ? this.charred
        : part.finish === 'body'
          ? this.palette.surface(item.visual.color, item.visual.material)
          : this.palette.finish(part.finish);
      if (kind === 'lamp' && part.finish === 'glass' && !mounted.broken) {
        bulb = new THREE.MeshStandardMaterial({
          color: '#fff7e0',
          emissive: '#ffcf7a',
          emissiveIntensity: 0,
          transparent: true,
          opacity: 0.55,
          roughness: 0.1,
        });
        view.materials.push(bulb);
        material = bulb;
      }
      const mesh = new THREE.Mesh(part.geometry, material);
      mesh.castShadow = part.casts;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (kind === 'rheostat') {
      const knob = new THREE.Mesh(rheostatKnob(size, mounted.setting), this.palette.finish('trim'));
      view.geometries.push(knob.geometry);
      group.add(knob);
    }
    let screen: Screen | undefined;
    if (kind === 'ammeter' || kind === 'voltmeter') {
      // The meter's window (props/circuit.ts: 5 × 3 cm at its nominal 9 cm), read from the
      // board's front whichever way the meter is plugged in: plugged in front to back, its
      // window stands tall and the reading takes two lines.
      const k = size[0] / 0.09;
      const across = Math.abs(Math.sin(group.rotation.y)) > 0.5;
      screen = across ? this.screen(96, 160) : this.screen(160, 96);
      const [pw, pd] = [0.05 * k - 0.002, 0.03 * k - 0.002];
      const display = new THREE.Mesh(
        new THREE.PlaneGeometry(across ? pd : pw, across ? pw : pd),
        screen.material,
      );
      display.rotation.x = -Math.PI / 2;
      display.rotation.z = -group.rotation.y;
      display.position.set(0, size[1] / 2 + 0.0005, -0.003 * k);
      view.geometries.push(display.geometry);
      view.materials.push(screen.material);
      group.add(display);
    }
    let halo: THREE.SpriteMaterial | undefined;
    if (bulb) {
      // The bulb's glow seen round it: its centre as props/circuit.ts draws it, scaled.
      const k = size[0] / 0.09;
      halo = new THREE.SpriteMaterial({
        map: this.haloTexture(),
        color: '#ffd38a',
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0,
      });
      view.materials.push(halo);
      const sprite = new THREE.Sprite(halo);
      sprite.position.set(0, (-size[1] / k / 2 + 0.012 + 0.04) * k, 0);
      sprite.scale.setScalar(0.16);
      group.add(sprite);
    }
    view.built.add(group);
    return {
      group,
      ...(bulb ? { bulb } : {}),
      ...(halo ? { halo } : {}),
      ...(screen ? { screen } : {}),
    };
  }

  private halo: THREE.CanvasTexture | null = null;

  /** A soft round glow, white at its middle, made once. */
  private haloTexture(): THREE.CanvasTexture {
    if (this.halo) return this.halo;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const c = canvas.getContext('2d');
    if (c) {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    }
    this.halo = new THREE.CanvasTexture(canvas);
    return this.halo;
  }

  private variant(key: string, build: () => readonly PropPart[]): readonly PropPart[] {
    let parts = this.variants.get(key);
    if (!parts) {
      parts = build();
      this.variants.set(key, parts);
    }
    return parts;
  }

  /**
   * Lamps by their light output, meters and the supply by their readings; hot parts and leads
   * smoking (more the hotter), leads glowing red to yellow as they near copper's melting point.
   */
  private glow(board: Board, view: BoardView, dt: number): void {
    board.state.parts.forEach((mounted, i) => {
      const part = view.parts[i];
      const spec = this.game.content.items.tryGet(mounted.item)?.circuit;
      if (!part || !spec) return;
      const smokeAt = spec.heat?.smoke;
      const rise = board.partRise[i] ?? 0;
      if (smokeAt !== undefined && rise >= smokeAt * 0.8) {
        this.puff(part.group, (6 * rise) / smokeAt, dt, 0.04);
      }
      const r = this.game.circuits.reading(board, i, this.reading);
      if (part.bulb) {
        const output = lampOutput(r.watts, spec.watts ?? 1);
        part.bulb.emissiveIntensity = Math.min(6, 3 * output);
        if (part.halo) part.halo.opacity = Math.min(1, 0.9 * Math.sqrt(output));
      }
      if (part.screen) {
        const text = meterText(spec.kind, r, spec);
        const tall = part.screen.canvas.height > part.screen.canvas.width;
        this.write(part.screen, tall ? text.split(' ') : [text], '#7dff9a');
      }
    });
    view.leads.forEach((material, k) => {
      const rise = board.wireRise[k] ?? 0;
      // Copper shows red from about 500 °C, orange to yellow towards its melting point.
      const glow = Math.max(0, Math.min(1, (rise - 480) / 580));
      material.emissive.setRGB(1, 0.25 + 0.5 * glow, 0.05 * glow);
      material.emissiveIntensity = glow > 0 ? 0.4 + 2.5 * glow : 0;
      if (rise >= LEAD_HEAT_SMOKE) {
        const [m, n] = board.state.wires[k] ?? [0, 0];
        const [ax, az] = nodeAt(board.spec, m);
        const [bx, bz] = nodeAt(board.spec, n);
        this.at.set((ax + bx) / 2, board.entity.item.visual.size[1] / 2 + 0.05, (az + bz) / 2);
        view.group.localToWorld(this.at);
        this.emitSmoke(this.at, (8 * rise) / LEAD_HEAT_SMOKE, dt, 0.06);
      }
    });
    const s = this.game.circuits.supply(board);
    this.write(
      view.supply,
      [`${s.volts.toFixed(1)} V`, `${s.amps.toFixed(2)} A${s.limited ? ' CC' : ''}`],
      s.limited ? '#ff8a65' : '#ff5a4f',
    );
  }

  /** Smoke from a part, at `rate` puffs a second. */
  private puff(group: THREE.Object3D, rate: number, dt: number, up: number): void {
    group.getWorldPosition(this.at);
    this.at.y += up;
    this.emitSmoke(this.at, rate, dt, 0.03);
  }

  private emitSmoke(at: THREE.Vector3, rate: number, dt: number, spread: number): void {
    if (!this.smoke || Math.random() > rate * dt) return;
    const j = (Math.random() - 0.5) * spread;
    this.smoke.emit(at.x + j, at.y, at.z - j, 0, 0.25, 0, 0.05, 2 + Math.random());
  }

  /** What the aim is on: a socket ringed, where a held part would go, a lead being drawn. */
  private aim(board: Board, view: BoardView): void {
    const spot = board.aim;
    const top = board.entity.item.visual.size[1] / 2;
    const { spec } = board;
    this.ring.visible = this.ghost.visible = false;
    if (spot?.kind === 'node') {
      const [x, z] = nodeAt(spec, spot.node);
      view.group.add(this.ring);
      this.ring.position.set(x, top + 0.004, z);
      this.ring.visible = true;
    } else if (spot?.kind === 'edge') {
      const held = this.game.interaction.heldEntity?.item;
      const [m, n] = edgeNodes(spec, spot.edge);
      const [ax, az] = nodeAt(spec, m);
      const [bx, bz] = nodeAt(spec, n);
      const [w, h, d] = held?.visual.size ?? [0.09, 0.03, 0.05];
      view.group.add(this.ghost);
      this.ghost.scale.set(w, h, d);
      this.ghost.position.set((ax + bx) / 2, top + h / 2, (az + bz) / 2);
      this.ghost.rotation.y = ax === bx ? -Math.PI / 2 : 0;
      this.ghost.material = board.state.parts.some((p) => p.edge === spot.edge)
        ? this.blockedMaterial
        : this.aimMaterial;
      this.ghost.visible = true;
    } else if (spot?.kind === 'part') {
      const mounted = board.state.parts[spot.index];
      const item = mounted && this.game.content.items.tryGet(mounted.item);
      if (mounted && item) {
        const [a, b] = partNodes(spec, mounted);
        const [ax, az] = nodeAt(spec, a);
        const [bx, bz] = nodeAt(spec, b);
        const [w, h, d] = item.visual.size;
        view.group.add(this.ghost);
        this.ghost.scale.set(w + 0.006, h + 0.006, d + 0.006);
        this.ghost.position.set((ax + bx) / 2, top + h / 2, (az + bz) / 2);
        this.ghost.rotation.y = ax === bx ? -Math.PI / 2 : 0;
        this.ghost.material = this.aimMaterial;
        this.ghost.visible = true;
      }
    }
    const pending = this.game.circuits.pendingLead;
    this.lead.visible = pending?.boardId === board.entity.id && pending.node < nodeCount(spec);
    if (pending && this.lead.visible) {
      const [x, z] = nodeAt(spec, pending.node);
      const [tx, tz] = spot ? board.aimAt : [x, z];
      this.leadPoints.set([x, top + 0.012, z, tx, top + 0.03, tz]);
      this.leadGeometry.getAttribute('position').needsUpdate = true;
      view.group.add(this.lead);
    }
  }

  private clear(view: BoardView): void {
    for (const part of view.parts) part.screen?.texture.dispose();
    view.parts.length = 0;
    view.leads.length = 0;
    view.built.clear();
    // The fixed ones (panel, display, knob) are the first three.
    for (const g of view.geometries.splice(3)) g.dispose();
    for (const m of view.materials.splice(0)) m.dispose();
  }

  private drop(id: string, view: BoardView): void {
    this.clear(view);
    for (const g of view.geometries) g.dispose();
    view.supply.texture.dispose();
    view.supply.material.dispose();
    view.group.removeFromParent();
    this.views.delete(id);
  }
}

/** A meter's display: the reading at its resolution, OL past its range, − when reversed. */
export function meterText(
  kind: string,
  r: Reading,
  spec: { amps?: number | undefined; volts?: number | undefined },
): string {
  // A reading under half a digit shows 0, never −0.
  const shown = (x: number, digits: number) =>
    (Math.abs(x) < 0.5 * 10 ** -digits ? 0 : x).toFixed(digits);
  if (kind === 'ammeter') {
    return Math.abs(r.amps) > (spec.amps ?? 3) ? 'OL' : `${shown(r.amps, 3)} A`;
  }
  return Math.abs(r.volts) > (spec.volts ?? 20) ? 'OL' : `${shown(r.volts, 2)} V`;
}
