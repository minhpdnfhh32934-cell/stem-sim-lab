import * as THREE from 'three';

/*
 * The head as one smooth, sculpted surface (C-5; C-6 redesigned to natural proportions, Phú
 * 2026-11-08: "make the faces natural"): the cranium and the jaw blended into each other, then
 * the face's forms raised or sunk on it — the brow ridge, the cheekbones, the bridge, tip and wings
 * of the nose, the mouth's mound, both lips (the upper with its bow) and the line between them, the
 * chin, a strong or a soft jaw's angle. The eyes are real eyeballs (a white, an iris, a pupil)
 * set behind lids: round each eye's almond-shaped opening the skin wraps the eyeball, inside it the
 * skin falls away behind it. The surface is star-shaped about a centre inside the head: each
 * direction gets one radius, the mesh a sphere pushed out to it, denser over the face than behind
 * (where the hair is). What lies on the face (brows, lash lines, the lips' colour, blush) are
 * ribbons and patches that follow it.
 */

type V3 = readonly [number, number, number];

export interface Ellipsoid {
  readonly c: V3;
  readonly r: V3;
}

/** An eye: its opening's middle, half width and half heights, the eyeball's radius. */
export interface EyeSpec {
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly upper: number;
  readonly lower: number;
  readonly radius: number;
}

export interface HeadSpec {
  readonly cranium: Ellipsoid;
  readonly jaw: Ellipsoid;
  /** Heights (m, model space) of the eyes, the nose's tip and the mouth's line. */
  readonly eyeY: number;
  readonly noseY: number;
  readonly mouthY: number;
  /** The eyes (the right one; the left mirrors it). */
  readonly eye: EyeSpec;
  /** Softer forms: a rounder chin and jaw, a lighter brow (a character's data, not gender). */
  readonly soft: boolean;
  /**
   * Drawn in the anime style (C-7): a simple, smooth face — a small nose, no lips' forms, a round
   * cheek or a firm jaw — with eyes drawn on it (`BodyModel`), not eyeballs behind lids.
   */
  readonly anime: boolean;
}

/** A smooth raise (a > 0) or hollow of the face, Gaussian about (x, y), sx by sy wide. */
interface Form {
  readonly x: number;
  readonly y: number;
  readonly sx: number;
  readonly sy: number;
  readonly a: number;
}

/** Where an eyeball is (model space) and its radius. */
export interface Eyeball {
  readonly centre: V3;
  readonly radius: number;
}

export interface Head {
  readonly geometry: THREE.BufferGeometry;
  /** The face's surface z (its front, −z) at x, y. */
  readonly front: (x: number, y: number) => number;
  /** The two eyeballs, left (−x) then right. */
  readonly eyeballs: readonly [Eyeball, Eyeball];
  /** An eye's opening: its upper and lower edge at x (null outside it), for side −1 or 1. */
  readonly opening: (side: number, x: number) => { upper: number; lower: number } | null;
  /** A ribbon `half` wide (or by `half(t)` along it) on a line of points, `lift` off the face. */
  ribbon(
    points: readonly (readonly [number, number])[],
    half: number | ((t: number) => number),
    lift: number,
  ): THREE.BufferGeometry;
  /**
   * A shape drawn on the face (an anime eye's white, its iris): from `centre` out to its outline,
   * `outline(t)` for t round 0–1, `lift` off the face.
   */
  drawn(
    centre: readonly [number, number],
    outline: (t: number) => readonly [number, number],
    lift: number,
  ): THREE.BufferGeometry;
  /** A patch of the face inside an ellipse at (x, y), rx by ry, `lift` off it. */
  patch(x: number, y: number, rx: number, ry: number, lift: number): THREE.BufferGeometry;
  /** The face over a rectangle, x0 to x1 and y0 to y1, in a fine grid `lift` off it. */
  grid(x0: number, x1: number, y0: number, y1: number, lift: number): THREE.BufferGeometry;
  /** The lips' colour: the upper (with its bow) and the lower lip, `lift` off them. */
  lips(lift: number): THREE.BufferGeometry;
  /**
   * The hair on the scalp above a hairline, `thickness(x, y, z)` thick (m), thinning to nothing at
   * the hairline so that its edge lies on the skin instead of a cap's brim.
   */
  scalp(
    line: Hairline,
    thickness: (x: number, y: number, z: number) => number,
  ): THREE.BufferGeometry;
  /**
   * A layer on the face between two lines (a beard): round the face from `from` to `to` (rad, 0
   * straight ahead, + to the right), from `top(x)` down to `bottom(x)` (heights), `thick(u, v)` m
   * thick (u across 0–1, v down 0–1). Its edges follow the lines exactly.
   */
  band(
    from: number,
    to: number,
    top: (x: number) => number,
    bottom: (x: number) => number,
    thick: (u: number, v: number) => number,
  ): THREE.BufferGeometry;
  /**
   * A sheet of hair over the face from x0 to x1 (a fringe, a strand): from `top(x)` down to
   * `bottom(x)`, `lift(u, v)` off the face (u across 0–1, v down 0–1).
   */
  cover(
    x0: number,
    x1: number,
    top: (x: number) => number,
    bottom: (x: number) => number,
    lift: (u: number, v: number) => number,
  ): THREE.BufferGeometry;
  /**
   * Hair hanging round the back and sides of the head (a bob, long hair): round the back between
   * its front edges (`edge`), its top at height `y0`, its ends at `end(a)` (a: the
   * angle from the front, 0–π), `out` (m) off the head and flaring `flare` (m per m) down, its
   * ends turned in by `curl` (m).
   */
  curtain(spec: Curtain): THREE.BufferGeometry;
}

/** Where the hair starts, above the eyes' height (m): at the forehead, the temples, over the ears, the nape. */
export interface Hairline {
  readonly front: number;
  readonly temple: number;
  readonly side: number;
  readonly nape: number;
  /** A tongue of hair down in front of each ear. */
  readonly sideburns: boolean;
}

export interface Curtain {
  /** Where its front edges are, round from the front (rad), down its length (v 0–1). */
  readonly edge: (v: number) => number;
  /** How thick the hair is (m): a mass with rounded edges, not a sheet. */
  readonly thick: number;
  readonly y0: number;
  readonly end: (a: number) => number;
  readonly out: number;
  readonly flare: number;
  readonly curl: number;
}

/** How far along unit `d` from `o` the ray leaves ellipsoid `e` (0: it misses). */
function leave(o: V3, d: V3, e: Ellipsoid): number {
  const px = (o[0] - e.c[0]) / e.r[0];
  const py = (o[1] - e.c[1]) / e.r[1];
  const pz = (o[2] - e.c[2]) / e.r[2];
  const dx = d[0] / e.r[0];
  const dy = d[1] / e.r[1];
  const dz = d[2] / e.r[2];
  const a = dx * dx + dy * dy + dz * dz;
  const b = 2 * (px * dx + py * dy + pz * dz);
  const c = px * px + py * py + pz * pz - 1;
  const disc = b * b - 4 * a * c;
  return disc < 0 ? 0 : (-b + Math.sqrt(disc)) / (2 * a);
}

/** How far along unit `d` from `o` the ray leaves the sphere at `c`, radius `r` (0: misses it). */
function leaveSphere(o: V3, d: V3, c: V3, r: number): number {
  const px = o[0] - c[0];
  const py = o[1] - c[1];
  const pz = o[2] - c[2];
  const b = px * d[0] + py * d[1] + pz * d[2];
  const k = b * b - (px * px + py * py + pz * pz - r * r);
  return k < 0 ? 0 : -b + Math.sqrt(k);
}

/** A smooth maximum: the two shapes melt into each other over about k (m). */
function smax(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** The face's forms for a spec, in model space (about natural sizes for a 15 cm wide head). */
function formsOf(s: HeadSpec): Form[] {
  if (s.anime) return animeForms(s);
  const { eyeY, noseY, mouthY } = s;
  const k = s.soft ? 0.6 : 1;
  const ex = s.eye.x;
  // A softer face's nose a little smaller and finer.
  const n = s.soft ? 0.8 : 1;
  const nw = s.soft ? 0.9 : 1;
  const forms: Form[] = [
    // The nose: from its root between the eyes down the bridge to a rounded tip, its wings.
    { x: 0, y: eyeY + 0.006, sx: 0.0065 * nw, sy: 0.009, a: 0.0042 * n },
    { x: 0, y: eyeY - 0.014, sx: 0.0056 * nw, sy: 0.011, a: 0.0085 * n },
    { x: 0, y: noseY + 0.014, sx: 0.006 * nw, sy: 0.009, a: 0.0125 * n },
    { x: 0, y: noseY + 0.002, sx: 0.0074 * nw, sy: 0.0068, a: 0.0158 * n },
    { x: -0.0112 * nw, y: noseY - 0.002, sx: 0.0052 * nw, sy: 0.0052, a: 0.0068 * n },
    { x: 0.0112 * nw, y: noseY - 0.002, sx: 0.0052 * nw, sy: 0.0052, a: 0.0068 * n },
    // The mouth's mound (the teeth behind it), both lips, the line between them, its corners.
    { x: 0, y: mouthY + 0.004, sx: 0.022, sy: 0.016, a: 0.0042 },
    { x: 0, y: mouthY + 0.0042, sx: 0.0145, sy: 0.0038, a: 0.0028 },
    { x: 0, y: mouthY - 0.0058, sx: 0.0128, sy: 0.0048, a: 0.0036 },
    { x: 0, y: mouthY, sx: 0.017, sy: 0.0011, a: -0.0016 },
    { x: -0.021, y: mouthY, sx: 0.0045, sy: 0.0045, a: -0.0014 },
    { x: 0.021, y: mouthY, sx: 0.0045, sy: 0.0045, a: -0.0014 },
    // The philtrum's two ridges down to the upper lip's bow.
    { x: -0.0042, y: mouthY + 0.012, sx: 0.0018, sy: 0.006, a: 0.0006 },
    { x: 0.0042, y: mouthY + 0.012, sx: 0.0018, sy: 0.006, a: 0.0006 },
    // The chin.
    { x: 0, y: mouthY - 0.031, sx: 0.014 + 0.004 * (1 - k), sy: 0.011, a: 0.003 + 0.0022 * k },
  ];
  for (const side of [-1, 1]) {
    forms.push(
      // The brow ridge over each eye; the lower lid's soft fullness.
      { x: side * (ex + 0.002), y: eyeY + 0.021, sx: 0.019, sy: 0.006, a: 0.0032 * k },
      { x: side * ex, y: eyeY - 0.012, sx: 0.012, sy: 0.0035, a: 0.0009 },
      // The cheekbone, and the hollow under it on a strong face.
      { x: side * 0.046, y: eyeY - 0.03, sx: 0.016, sy: 0.012, a: 0.0042 },
      { x: side * 0.046, y: eyeY - 0.06, sx: 0.012, sy: 0.01, a: -0.0018 * k },
      // The jaw's angle; the temple's hollow.
      { x: side * 0.05, y: mouthY - 0.02, sx: 0.012, sy: 0.016, a: 0.003 * k },
      { x: side * 0.062, y: eyeY + 0.02, sx: 0.01, sy: 0.016, a: -0.0015 },
    );
  }
  return forms;
}

/**
 * An anime face's few forms: a small nose (a hint of its bridge, a neat tip), the mouth's line a
 * hair sunk, a round cheek on a soft face, a firm chin and jaw's angle and a brow ridge on a strong
 * one. Everything else is the smooth head.
 */
function animeForms(s: HeadSpec): Form[] {
  const { eyeY, noseY, mouthY, soft } = s;
  const forms: Form[] = [
    { x: 0, y: eyeY - 0.014, sx: 0.0042, sy: 0.013, a: soft ? 0.0012 : 0.0024 },
    { x: 0, y: noseY, sx: 0.0045, sy: 0.0055, a: soft ? 0.0038 : 0.0052 },
    { x: 0, y: mouthY, sx: 0.008, sy: 0.0009, a: -0.0006 },
    soft
      ? { x: 0, y: mouthY - 0.027, sx: 0.0095, sy: 0.008, a: 0.0018 }
      : { x: 0, y: mouthY - 0.03, sx: 0.013, sy: 0.009, a: 0.0042 },
  ];
  for (const side of [-1, 1]) {
    if (soft) {
      forms.push({ x: side * 0.04, y: eyeY - 0.03, sx: 0.016, sy: 0.014, a: 0.003 });
    } else {
      forms.push(
        { x: side * 0.03, y: eyeY + 0.022, sx: 0.018, sy: 0.006, a: 0.0018 },
        { x: side * 0.044, y: eyeY - 0.03, sx: 0.014, sy: 0.012, a: 0.0016 },
        { x: side * 0.046, y: mouthY - 0.016, sx: 0.011, sy: 0.014, a: 0.0028 },
      );
    }
  }
  return forms;
}

export function sculptHead(spec: HeadSpec): Head {
  const { cranium, jaw, eye } = spec;
  // The centre at the nose's height: the face's forms push out almost straight forward from it.
  const o: V3 = [0, spec.eyeY - 0.025, 0.01];
  const forms = formsOf(spec);
  const d = [0, 0, 0] as [number, number, number];
  const base = (dx: number, dy: number, dz: number) => {
    d[0] = dx;
    d[1] = dy;
    d[2] = dz;
    return smax(leave(o, d, cranium), leave(o, d, jaw), 0.022);
  };
  /** The base surface's front z at x, y (before the face's forms), by bisection. */
  const baseFront = (x: number, y: number) => {
    let out = o[2] - 0.3;
    let into = o[2];
    for (let i = 0; i < 30; i++) {
      const m = (out + into) / 2;
      const px = x - o[0];
      const py = y - o[1];
      const pz = m - o[2];
      const l = Math.hypot(px, py, pz);
      if (l < base(px / l, py / l, pz / l)) into = m;
      else out = m;
    }
    return (out + into) / 2;
  };

  // The eyeballs: their fronts a hair proud of where the face would be without them.
  const eyeballs = [-1, 1].map((side): Eyeball => {
    const x = side * eye.x;
    const z = baseFront(x, eye.y) - 0.0012 + eye.radius;
    return { centre: [x, eye.y, z], radius: eye.radius };
  }) as unknown as [Eyeball, Eyeball];

  /** An eye's opening at x: the lids' edges, the outer corner a little higher (a natural tilt). */
  const opening = (side: number, x: number) => {
    const u = (side * x - eye.x) / eye.halfWidth; // −1 inner corner, 1 outer
    if (Math.abs(u) >= 1) return null;
    const tilt = 0.0012 * u;
    // The upper lid's highest point a little inside the middle; the lower lid's a little outside.
    const up = Math.pow(1 - u * u, 0.62) * (1 - 0.12 * u);
    const low = Math.pow(1 - u * u, 0.8) * (1 + 0.1 * u);
    return { upper: eye.y + tilt + eye.upper * up, lower: eye.y + tilt - eye.lower * low };
  };
  /** How far (m) a face point is inside an eye's opening (negative: outside it). */
  const inOpening = (x: number, y: number) => {
    const side = x < 0 ? -1 : 1;
    const u = (side * x - eye.x) / eye.halfWidth;
    if (Math.abs(u) >= 1) {
      // Beyond a corner: how far from it.
      return -Math.hypot(
        (Math.abs(u) - 1) * eye.halfWidth,
        Math.max(0, Math.abs(y - eye.y) - 0.002),
      );
    }
    const at = opening(side, x);
    if (!at) return -1;
    const across = (1 - Math.abs(u)) * eye.halfWidth * 0.5;
    return Math.min(y - at.lower, at.upper - y, across);
  };

  const radius = (dx: number, dy: number, dz: number) => {
    const r0 = base(dx, dy, dz);
    const x = o[0] + r0 * dx;
    const y = o[1] + r0 * dy;
    // Only the face takes the forms; they fade out round the sides.
    const facing = smooth(0.15, 0.55, -dz);
    if (facing === 0) return r0;
    let raise = 0;
    for (const f of forms) {
      const u = (x - f.x) / f.sx;
      const v = (y - f.y) / f.sy;
      const q = u * u + v * v;
      if (q < 12) raise += f.a * Math.exp(-q);
    }
    let r = r0 + facing * raise;
    // The eye: the lids wrap the eyeball round its opening, and inside the opening the skin falls
    // away behind it (the eyeball shows there).
    const ball = x < 0 ? eyeballs[0] : eyeballs[1];
    const lid = spec.anime ? 0 : leaveSphere(o, d, ball.centre, ball.radius + 0.0016);
    if (lid > 0) {
      const inside = inOpening(x, y);
      const wrap = smooth(-0.009, -0.0015, inside);
      r = Math.max(r, r + (lid - r) * wrap);
      const behind = smooth(-0.0006, 0.0009, inside);
      if (behind > 0) r -= behind * (r - (lid - 0.006));
    }
    return r;
  };

  // The sphere's grid, denser over the face: longitude from the back (u 0) round to the front
  // (u ½), latitude from the crown (v 0) to under the chin.
  const cols = 96;
  const rows = 76;
  const dense = (s: number) => (s + 4 * s * s * s) / 5; // slope ⅕ at 0: 5× denser there
  const faceTheta = 1.6; // the face's middle, from the crown (rad)
  const positions: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const s = (2 * r) / rows - 1;
    const theta = faceTheta + dense(s) * (s < 0 ? faceTheta : Math.PI - faceTheta);
    for (let c = 0; c <= cols; c++) {
      const phi = Math.PI + Math.PI * dense((2 * c) / cols - 1);
      const dx = Math.sin(theta) * Math.sin(phi);
      const dy = Math.cos(theta);
      const dz = Math.sin(theta) * Math.cos(phi);
      const k = radius(dx, dy, dz);
      positions.push(o[0] + k * dx, o[1] + k * dy, o[2] + k * dz);
    }
  }
  const index: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = a + cols + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1); // outward: longitude grows towards +x at the front
    }
  }
  const sphere = new THREE.BufferGeometry();
  sphere.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  sphere.setIndex(index);
  sphere.computeVertexNormals();
  const geometry = sphere.toNonIndexed();
  sphere.dispose();

  /** Inside the surface? */
  const inside = (x: number, y: number, z: number) => {
    const px = x - o[0];
    const py = y - o[1];
    const pz = z - o[2];
    const l = Math.hypot(px, py, pz);
    return l < 1e-6 || l < radius(px / l, py / l, pz / l);
  };
  const front = (x: number, y: number) => {
    // From in front of the face back to the centre's plane: where it crosses the surface.
    let out = o[2] - 0.3;
    let into = o[2];
    if (!inside(x, y, into)) return o[2];
    for (let i = 0; i < 24; i++) {
      const m = (out + into) / 2;
      if (inside(x, y, m)) into = m;
      else out = m;
    }
    return (out + into) / 2;
  };

  /** A grid of face points (rows of `across` + 1), lifted off the face along −z. */
  const sheet = (
    at: (i: number, j: number) => [number, number],
    n: number,
    across: number,
    lift: number,
  ) => {
    const pos: number[] = [];
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= across; j++) {
        const [x, y] = at(i, j);
        pos.push(x, y, front(x, y) - lift);
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < across; j++) {
        const a = i * (across + 1) + j;
        const b = a + across + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // Facing out of the face (−z), whichever way the grid ran.
    const nz = g.getAttribute('normal');
    let sum = 0;
    for (let i = 0; i < nz.count; i++) sum += nz.getZ(i);
    if (sum > 0) {
      for (let i = 0; i < idx.length; i += 3) {
        const t = idx[i + 1] ?? 0;
        idx[i + 1] = idx[i + 2] ?? 0;
        idx[i + 2] = t;
      }
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    const flat = g.toNonIndexed();
    g.dispose();
    return flat;
  };

  const ribbon = (
    points: readonly (readonly [number, number])[],
    half: number | ((t: number) => number),
    lift: number,
  ) => {
    const n = (points.length - 1) * 4;
    const along = (t: number): [number, number] => {
      const f = Math.min(points.length - 1.0001, Math.max(0, t * (points.length - 1)));
      const i = Math.floor(f);
      const a = points[i] ?? [0, 0];
      const b = points[i + 1] ?? a;
      return [a[0] + (b[0] - a[0]) * (f - i), a[1] + (b[1] - a[1]) * (f - i)];
    };
    const width =
      typeof half === 'function'
        ? half
        : (t: number) =>
            // Thinner towards its ends.
            half * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.9 + 0.05))));
    return sheet(
      (i, j) => {
        const t = i / n;
        const [x, y] = along(t);
        const [x0, y0] = along(Math.max(0, t - 0.02));
        const [x1, y1] = along(Math.min(1, t + 0.02));
        const l = Math.hypot(x1 - x0, y1 - y0) || 1;
        const k = j === 0 ? -width(t) : width(t);
        return [x - ((y1 - y0) / l) * k, y + ((x1 - x0) / l) * k];
      },
      n,
      1,
      lift,
    );
  };

  const drawn = (
    centre: readonly [number, number],
    outline: (t: number) => readonly [number, number],
    lift: number,
  ) =>
    sheet(
      (i, j) => {
        const [ox, oy] = outline(j / 40);
        const r = i / 6;
        return [centre[0] + (ox - centre[0]) * r, centre[1] + (oy - centre[1]) * r];
      },
      6,
      40,
      lift,
    );

  const patch = (x: number, y: number, rx: number, ry: number, lift: number) =>
    sheet(
      (i, j) => {
        // Rings out from the middle: polar rows, never a square's corners.
        const r = i / 6;
        const a = (j / 24) * Math.PI * 2;
        return [x + rx * r * Math.cos(a), y + ry * r * Math.sin(a)];
      },
      6,
      24,
      lift,
    );

  const lips = (lift: number) => {
    const m = spec.mouthY;
    const half = 0.0205;
    // The upper lip's border: its bow (two peaks either side of a dip), down to the corners.
    const top = (u: number) =>
      m + 0.0068 * Math.pow(1 - u * u, 0.7) - 0.0014 * Math.exp(-((u / 0.11) ** 2));
    const bottom = (u: number) => m - 0.0088 * Math.pow(1 - u * u, 0.55);
    const upper = sheet(
      (i, j) => {
        const u = (j / 20) * 2 - 1;
        return [u * half, m + (i / 4) * (top(u) - m)];
      },
      4,
      20,
      lift,
    );
    const lower = sheet(
      (i, j) => {
        const u = (j / 20) * 2 - 1;
        return [u * half, m + (i / 4) * (bottom(u) - m)];
      },
      4,
      20,
      lift,
    );
    const both = new THREE.BufferGeometry();
    const a = upper.getAttribute('position');
    const b = lower.getAttribute('position');
    const na = upper.getAttribute('normal');
    const nb = lower.getAttribute('normal');
    both.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [...(a.array as Float32Array), ...(b.array as Float32Array)],
        3,
      ),
    );
    both.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(
        [...(na.array as Float32Array), ...(nb.array as Float32Array)],
        3,
      ),
    );
    upper.dispose();
    lower.dispose();
    return both;
  };

  /** The hairline's height above the eyes at angle a (rad from the front, 0–π). */
  const hairline = (line: Hairline, a: number) => {
    const keys: [number, number][] = [
      [0, line.front],
      [0.55, line.temple],
      [1.15, line.side + 0.008],
      [1.95, line.side],
      [2.35, line.nape + 0.03],
      [Math.PI, line.nape],
    ];
    let y = line.nape;
    for (let i = 1; i < keys.length; i++) {
      const [a0, y0] = keys[i - 1] ?? [0, 0];
      const [a1, y1] = keys[i] ?? [0, 0];
      if (a >= a0 && a <= a1) y = y0 + (y1 - y0) * smooth(a0, a1, a);
    }
    if (line.sideburns) y -= 0.042 * Math.exp(-(((a - 1.36) / 0.1) ** 2));
    return spec.eyeY + y;
  };

  /** The surface point (and its direction) at theta from the top, phi round from the back. */
  const surfaceAt = (theta: number, phi: number) => {
    const dx = Math.sin(theta) * Math.sin(phi);
    const dy = Math.cos(theta);
    const dz = Math.sin(theta) * Math.cos(phi);
    const k = radius(dx, dy, dz);
    return { x: o[0] + k * dx, y: o[1] + k * dy, z: o[2] + k * dz, dx, dy, dz };
  };

  const scalp = (line: Hairline, thickness: (x: number, y: number, z: number) => number) => {
    // Each column runs from the crown down to where it meets the hairline exactly: the hair's edge
    // is a smooth curve, never the grid's steps.
    const cols = 96;
    const rows = 36;
    const pos: number[] = [];
    for (let c = 0; c <= cols; c++) {
      const phi = (c / cols) * Math.PI * 2;
      const above = (theta: number) => {
        const p = surfaceAt(theta, phi);
        return p.y - hairline(line, Math.abs(Math.atan2(p.x, -p.z)));
      };
      let lo = 0;
      let hi = 2.6;
      for (let i = 0; i < 28; i++) {
        const m = (lo + hi) / 2;
        if (above(m) > 0) lo = m;
        else hi = m;
      }
      for (let r = 0; r <= rows; r++) {
        // Rows closer together near the edge, where the hair thins into the skin.
        const t = r / rows;
        const theta = lo * (t + 0.6 * t * (1 - t));
        const p = surfaceAt(theta, phi);
        const e = p.y - hairline(line, Math.abs(Math.atan2(p.x, -p.z)));
        const h = thickness(p.x, p.y, p.z) * smooth(0, 0.016, e) + 0.0006;
        pos.push(p.x + h * p.dx, p.y + h * p.dy, p.z + h * p.dz);
      }
    }
    // Columns side by side: column c's rows, then column c + 1's.
    const idx: number[] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const a = c * (rows + 1) + r;
        const b = a + rows + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const flat = g.toNonIndexed();
    g.dispose();
    return flat;
  };

  const band = (
    from: number,
    to: number,
    top: (x: number) => number,
    bottom: (x: number) => number,
    thick: (u: number, v: number) => number,
  ) => {
    const cols = 64;
    const rows = 14;
    const pos: number[] = [];
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const phi = Math.PI + from + (to - from) * u; // the head's grid: π straight ahead
      /** Down the column, where it crosses a height given by a line. */
      const cross = (line: (x: number) => number) => {
        let lo = 0.2;
        let hi = 2.9;
        for (let i = 0; i < 30; i++) {
          const m = (lo + hi) / 2;
          const p = surfaceAt(m, phi);
          if (p.y > line(p.x)) lo = m;
          else hi = m;
        }
        return (lo + hi) / 2;
      };
      const t0 = cross(top);
      const t1 = cross(bottom);
      for (let r = 0; r <= rows; r++) {
        const v = r / rows;
        const p = surfaceAt(t0 + (t1 - t0) * v, phi);
        const h = thick(u, v) + 0.0005;
        pos.push(p.x + h * p.dx, p.y + h * p.dy, p.z + h * p.dz);
      }
    }
    const idx: number[] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const a = c * (rows + 1) + r;
        const b = a + rows + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const flat = g.toNonIndexed();
    g.dispose();
    return flat;
  };

  const cover = (
    x0: number,
    x1: number,
    top: (x: number) => number,
    bottom: (x: number) => number,
    lift: (u: number, v: number) => number,
  ) => {
    const across = 24;
    const down = 8;
    const pos: number[] = [];
    for (let i = 0; i <= down; i++) {
      for (let j = 0; j <= across; j++) {
        const u = j / across;
        const v = i / down;
        const x = x0 + (x1 - x0) * u;
        const y = top(x) + (bottom(x) - top(x)) * v;
        pos.push(x, y, front(x, y) - lift(u, v));
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < down; i++) {
      for (let j = 0; j < across; j++) {
        const a = i * (across + 1) + j;
        const b = a + across + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const flat = g.toNonIndexed();
    g.dispose();
    return flat;
  };

  const curtain = (c: Curtain) => {
    const cols = 48;
    const rows = 16;
    // Its outer and inner surfaces, then the band joining them round the ends and the front
    // edges: a mass of hair with rounded edges.
    const at = (j: number, i: number, inner: boolean): [number, number, number] => {
      const v = i / rows;
      const edge = c.edge(v);
      const a = edge + ((Math.PI * 2 - 2 * edge) * j) / cols; // round the back from the right
      const fold = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      const y = c.y0 + (c.end(fold) - c.y0) * v;
      const dx = Math.sin(a);
      const dz = -Math.cos(a);
      // The head's side at that height (about 9 cm out from the centre): the hair hangs from there.
      const on = Math.max(c.y0 - 0.06, Math.min(y, spec.eyeY + 0.02));
      const up = Math.atan2(on - o[1], 0.09);
      const r0 = radius(dx * Math.cos(up), Math.sin(up), dz * Math.cos(up)) * Math.cos(up);
      // Thinner towards the front edges and the ends.
      const edgeIn = Math.min(1, Math.min(j, cols - j) / 6);
      // Out of the scalp at its top (no ridge where it starts), thinner at the front edges and ends.
      const t =
        c.thick * (0.35 + 0.65 * edgeIn) * (1 - 0.5 * smooth(0.7, 1, v)) * smooth(0, 0.2, v);
      let r =
        r0 + c.out * smooth(0, 0.2, v) + t + c.flare * (c.y0 - y) - c.curl * smooth(0.75, 1, v);
      if (inner) r -= t;
      return [o[0] + r * dx, y, o[2] + r * dz];
    };
    const pos: number[] = [];
    const idx: number[] = [];
    const grid = (inner: boolean) => {
      const start = pos.length / 3;
      for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) pos.push(...at(j, i, inner));
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const a = start + i * (cols + 1) + j;
          const b = a + cols + 1;
          if (inner) idx.push(a, a + 1, b, a + 1, b + 1, b);
          else idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    };
    grid(false);
    grid(true);
    // The rim: along the bottom, and up each front edge.
    const rim = (points: [number, number][]) => {
      const start = pos.length / 3;
      for (const [j, i] of points) pos.push(...at(j, i, false), ...at(j, i, true));
      for (let k = 0; k < points.length - 1; k++) {
        const a = start + 2 * k;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    };
    rim(Array.from({ length: cols + 1 }, (_, j): [number, number] => [j, rows]));
    rim(Array.from({ length: rows + 1 }, (_, i): [number, number] => [0, rows - i]));
    rim(Array.from({ length: rows + 1 }, (_, i): [number, number] => [cols, i]));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const flat = g.toNonIndexed();
    g.dispose();
    return flat;
  };

  return {
    geometry,
    front,
    eyeballs,
    opening,
    ribbon,
    drawn,
    patch,
    grid: (x0: number, x1: number, y0: number, y1: number, lift: number) =>
      sheet((i, j) => [x0 + ((x1 - x0) * j) / 32, y0 + ((y1 - y0) * i) / 36], 36, 32, lift),
    lips,
    scalp,
    band,
    cover,
    curtain,
  };
}

/** A blush's colour for a skin tone: a soft warm flush of it, never a painted disc. */
export function blushColour(skin: string): string {
  const c = new THREE.Color(skin);
  c.lerp(new THREE.Color('#e07f7f'), 0.32);
  return `#${c.getHexString()}`;
}

/**
 * The mouth's colour for a skin tone: rosy, a little deeper than the skin (`rosy`); or the dark
 * line an anime draws for a man's mouth.
 */
export function lipColour(skin: string, rosy: boolean, bold = false): string {
  const c = new THREE.Color(skin);
  if (bold) c.lerp(new THREE.Color('#a32b3a'), 0.66);
  else c.lerp(new THREE.Color(rosy ? '#b0525b' : '#5a2f2b'), rosy ? 0.5 : 0.62);
  return `#${c.getHexString()}`;
}
