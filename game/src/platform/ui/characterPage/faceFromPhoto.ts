import { FACE_PICTURE } from '../../render/body/facePhoto';
import type { FaceShape, HairDesign } from '../../../gameplay/character';

/*
 * A face made from a photo (Phú 2026-11-12): the face's landmarks (MediaPipe's 478-point face mesh,
 * in pixels), the photo's pixels and its hair mask (MediaPipe's hair segmenter, 0–1 per pixel) give
 * the character's skin, eyes, hair colour, beard, the face's proportions and a hairstyle drawn from
 * its own measures. Pure: no DOM, no MediaPipe. The photo itself is never kept — only these.
 *
 * Proportions are measured in the face's own frame (origin between the irises, x along them toward
 * the image's right, y down the face, unit the distance between the irises) and compared with an
 * average adult face (`AVERAGE`), so tilting the head or the photo's size does not change them.
 */

export interface Pixel {
  readonly x: number;
  readonly y: number;
}

export interface PhotoInput {
  /** The 478 landmarks, in the photo's pixels. */
  readonly points: readonly Pixel[];
  /** The photo's pixels, RGBA. */
  readonly rgba: ArrayLike<number>;
  readonly width: number;
  readonly height: number;
  /** How likely each pixel is hair (0–1), at its own size; null when there is no mask. */
  readonly hair: ArrayLike<number> | null;
  readonly maskWidth: number;
  readonly maskHeight: number;
}

/** Read from any face found, turned or not (Phú: a funny face is fine). */
export type PhotoFace = {
  readonly ok: true;
  readonly skinTone: string;
  readonly eyeColor: string;
  /** Null when there is too little hair to tell (the current colour stays). */
  readonly hairColor: string | null;
  readonly beard: boolean;
  readonly face: FaceShape;
  readonly hairDesign: HairDesign;
};

/** MediaPipe face-mesh landmarks used here. */
const P = {
  noseTip: 1,
  forehead: 10,
  lipsInner: 13,
  rightEyeOuter: 33,
  rightCheek: 50,
  rightBrow: 105,
  rightEyeInner: 133,
  foreheadLow: 151,
  chin: 152,
  rightJaw: 172,
  chinFront: 199,
  rightEdge: 234,
  leftEyeOuter: 263,
  leftCheek: 280,
  leftBrow: 334,
  leftEyeInner: 362,
  leftJaw: 397,
  leftEdge: 454,
  irisA: 468,
  irisAEdge: 469,
  irisB: 473,
} as const;

/**
 * An average adult face in the mesh's terms (the unit: the distance between the pupils, ≈ 63 mm):
 * from common adult measures (face 140 mm wide at the cheeks, 165 mm from the upper forehead to the
 * chin, jaw 105 mm, eye 30 mm wide, 32 mm between the eyes' inner corners, the nose tip 41 mm and the
 * mouth 68 mm below the pupils, 45 mm from the mouth to the chin).
 * shortcut: estimates, not fitted to measured photos; refit them on real photos if faces come out
 * too wide or narrow.
 */
export const AVERAGE = {
  width: 2.22,
  length: 2.62,
  jaw: 0.75,
  chin: 0.27,
  eye: 0.48,
  spacing: 1.07,
  nose: 0.25,
  mouth: 0.41,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A measure against its average, its difference scaled by `gain`, kept in [lo, hi]. */
const ratio = (m: number, average: number, gain: number, lo: number, hi: number) =>
  Number(clamp(1 + gain * (m / average - 1), lo, hi).toFixed(3));
const dist = (a: Pixel, b: Pixel) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pixel, b: Pixel): Pixel => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const hex = (rgb: readonly number[]) =>
  '#' +
  rgb
    .map((c) =>
      Math.round(clamp(c, 0, 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const luma = (rgb: readonly number[]) =>
  0.2126 * (rgb[0] ?? 0) + 0.7152 * (rgb[1] ?? 0) + 0.0722 * (rgb[2] ?? 0);

function median(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

/** Straight lines through (x, y) stops, flat past the ends. */
function through(stops: readonly (readonly [number, number])[], x: number): number {
  const first = stops[0] ?? [0, 0];
  if (x <= first[0]) return first[1];
  for (let i = 1; i < stops.length; i++) {
    const [x0, y0] = stops[i - 1] ?? first;
    const [x1, y1] = stops[i] ?? first;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return (stops[stops.length - 1] ?? first)[1];
}

export function faceFromPhoto(input: PhotoInput): PhotoFace {
  const at = (i: number): Pixel => input.points[i] ?? { x: 0, y: 0 };
  // The face's frame.
  let a = at(P.irisA);
  let b = at(P.irisB);
  if (b.x < a.x) [a, b] = [b, a];
  const o = mid(a, b);
  const iod = Math.max(1e-6, dist(a, b));
  const ux = (b.x - a.x) / iod;
  const uy = (b.y - a.y) / iod;
  // Down the face: perpendicular to the irises' line, toward the chin.
  const chinP = at(P.chin);
  const down = (chinP.x - o.x) * -uy + (chinP.y - o.y) * ux >= 0 ? 1 : -1;
  const vx = -uy * down;
  const vy = ux * down;
  const local = (p: Pixel) => ({
    x: ((p.x - o.x) * ux + (p.y - o.y) * uy) / iod,
    y: ((p.x - o.x) * vx + (p.y - o.y) * vy) / iod,
  });

  const nose = at(P.noseTip);

  // Proportions.
  const width = dist(at(P.rightEdge), at(P.leftEdge)) / iod;
  const length = dist(at(P.forehead), chinP) / iod;
  const jaw = dist(at(P.rightJaw), at(P.leftJaw)) / iod / width;
  const chinY = local(chinP).y;
  const mouthY = local(at(P.lipsInner)).y;
  const eyeWidth =
    (dist(at(P.rightEyeOuter), at(P.rightEyeInner)) +
      dist(at(P.leftEyeOuter), at(P.leftEyeInner))) /
    2 /
    iod;
  const spacing = dist(at(P.rightEyeInner), at(P.leftEyeInner)) / iod / eyeWidth;
  const face: FaceShape = {
    width: ratio(width, AVERAGE.width, 1, 0.85, 1.15),
    length: ratio(length, AVERAGE.length, 1, 0.85, 1.15),
    jaw: ratio(jaw, AVERAGE.jaw, 1.2, 0.8, 1.2),
    chin: ratio((chinY - mouthY) / length, AVERAGE.chin, 1.2, 0.8, 1.2),
    eyeSize: ratio(eyeWidth, AVERAGE.eye, 1.5, 0.8, 1.25),
    eyeSpacing: ratio(spacing, AVERAGE.spacing, 1.2, 0.88, 1.12),
    nose: ratio(local(nose).y / length, AVERAGE.nose, 1.2, 0.85, 1.15),
    mouth: ratio(mouthY / length, AVERAGE.mouth, 1.2, 0.85, 1.15),
  };

  // The hair mask: how likely hair is at a photo pixel.
  const mask = input.hair;
  const sx = input.maskWidth / input.width;
  const sy = input.maskHeight / input.height;
  const hairAt = (x: number, y: number): number => {
    if (!mask) return 0;
    const mx = Math.floor(x * sx);
    const my = Math.floor(y * sy);
    if (mx < 0 || my < 0 || mx >= input.maskWidth || my >= input.maskHeight) return 0;
    return mask[my * input.maskWidth + mx] ?? 0;
  };

  /** The median colour of the pixels within `r` of `c` (hair left out, unless `onHair`). */
  const colourNear = (centres: readonly Pixel[], r: number, inner = 0, onHair = false) => {
    const ch: [number[], number[], number[]] = [[], [], []];
    const step = Math.max(1, Math.floor(r / 8));
    for (const c of centres) {
      for (let y = Math.floor(c.y - r); y <= c.y + r; y += step) {
        for (let x = Math.floor(c.x - r); x <= c.x + r; x += step) {
          const d = Math.hypot(x - c.x, y - c.y);
          if (d > r || d < inner || x < 0 || y < 0 || x >= input.width || y >= input.height) {
            continue;
          }
          if (!onHair && hairAt(x, y) > 0.5) continue;
          const i = (y * input.width + x) * 4;
          ch[0].push(input.rgba[i] ?? 0);
          ch[1].push(input.rgba[i + 1] ?? 0);
          ch[2].push(input.rgba[i + 2] ?? 0);
        }
      }
    }
    return ch[0].length ? ch.map(median) : null;
  };

  const skin = colourNear([at(P.rightCheek), at(P.leftCheek), at(P.foreheadLow)], 0.12 * iod) ?? [
    200, 160, 130,
  ];
  const irisR = Math.max(1, dist(at(P.irisA), at(P.irisAEdge)));
  const iris = colourNear([at(P.irisA), at(P.irisB)], irisR * 0.9, irisR * 0.35, true) ?? [
    74, 52, 38,
  ];
  const chinFront = at(P.chinFront);
  const chinColour = colourNear([chinFront], 0.12 * iod, 0, true);
  const beard =
    hairAt(chinFront.x, chinFront.y) > 0.5 ||
    (chinColour !== null && luma(chinColour) < 0.72 * luma(skin));

  // The hair, sampled over the photo on a grid of about 200 × 200, in the face's frame.
  const step = Math.max(1, Math.floor(Math.max(input.width, input.height) / 200));
  const topY = local(at(P.forehead)).y;
  const browY = (local(at(P.rightBrow)).y + local(at(P.leftBrow)).y) / 2;
  const sideX = 0.4 * width;
  const BIN = 0.1; // rows of the silhouette, in the frame's unit
  const ROWS = 200;
  const left = new Array<number>(ROWS).fill(Infinity);
  const right = new Array<number>(ROWS).fill(-Infinity);
  const ch: [number[], number[], number[]] = [[], [], []];
  let hairCells = 0;
  let lowest = -Infinity;
  let foreheadCells = 0;
  let foreheadHair = 0;
  let fringeLeft = 0;
  let fringeRight = 0;
  let crownLeft = Infinity;
  let crownRight = -Infinity;
  for (let y = 0; y < input.height; y += step) {
    for (let x = 0; x < input.width; x += step) {
      const p = local({ x, y });
      const inForehead = Math.abs(p.x) < 0.6 && p.y > topY && p.y < browY;
      if (inForehead) foreheadCells++;
      const h = hairAt(x, y);
      if (h <= 0.5) continue;
      hairCells++;
      if (inForehead) {
        foreheadHair++;
        if (p.x > 0) fringeRight++;
        else fringeLeft++;
      }
      if (Math.abs(p.x) > sideX) lowest = Math.max(lowest, p.y);
      if (Math.abs(p.y - topY) < 0.3) {
        crownLeft = Math.min(crownLeft, p.x);
        crownRight = Math.max(crownRight, p.x);
      }
      const row = Math.floor((p.y + 6) / BIN);
      if (row >= 0 && row < ROWS) {
        left[row] = Math.min(left[row] ?? Infinity, p.x);
        right[row] = Math.max(right[row] ?? -Infinity, p.x);
      }
      if (h > 0.8) {
        const i = (y * input.width + x) * 4;
        ch[0].push(input.rgba[i] ?? 0);
        ch[1].push(input.rgba[i + 1] ?? 0);
        ch[2].push(input.rgba[i + 2] ?? 0);
      }
    }
  }
  // Too little hair to tell (about a quarter of the face's area): cropped very short or none.
  const hairArea = (hairCells * step * step) / (iod * iod);
  if (hairArea < 0.25 * width * length) {
    return {
      ok: true,
      skinTone: hex(skin),
      eyeColor: hex(iris),
      hairColor: ch[0].length > 20 ? hex(ch.map(median)) : null,
      beard,
      face,
      hairDesign: { length: 0, fringe: 0, parting: 0, volume: 0, curl: 0 },
    };
  }

  // How far down the sides it falls, in eye-to-chin lengths: the stops of the drawn style's
  // lengths (`hairBelowEye`: past the ears at the eyes' height, the jaw, the shoulders, the back).
  const fall = Number.isFinite(lowest) ? lowest / Math.max(0.5, chinY) : -0.3;
  const hairLength = through(
    [
      [-0.3, 0],
      [0, 0.22],
      [0.7, 0.45],
      [1.6, 0.7],
      [3.3, 1],
    ],
    fall,
  );
  const covered = foreheadCells ? foreheadHair / foreheadCells : 0;
  const fringe = clamp((covered - 0.08) / 0.6, 0, 1);
  // Parted toward the side the fringe covers less (positive: more covered on the image's right).
  const parting =
    foreheadHair > 0
      ? clamp(((fringeRight - fringeLeft) / foreheadHair) * Math.min(1, covered / 0.3), -1, 1)
      : 0;
  const crown = Number.isFinite(crownLeft) ? (crownRight - crownLeft) / width : 1;
  const volume = clamp((crown - 1) / 0.6, 0, 1);
  // Curls: how ragged the silhouette's edges are from row to row.
  let rough = 0;
  let rows = 0;
  for (const edge of [left, right]) {
    for (let r = 1; r < ROWS - 1; r++) {
      const e0 = edge[r - 1] ?? NaN;
      const e1 = edge[r] ?? NaN;
      const e2 = edge[r + 1] ?? NaN;
      if (!Number.isFinite(e0) || !Number.isFinite(e1) || !Number.isFinite(e2)) continue;
      rough += Math.abs(e2 - 2 * e1 + e0);
      rows++;
    }
  }
  // shortcut: the silhouette's raggedness stands for curl; a texture measure if curls are missed.
  const curl = rows ? clamp((rough / rows - 0.05) / 0.15, 0, 1) : 0;
  const round = (v: number) => Number(v.toFixed(3));
  return {
    ok: true,
    skinTone: hex(skin),
    eyeColor: hex(iris),
    hairColor: ch[0].length > 20 ? hex(ch.map(median)) : null,
    beard,
    face,
    hairDesign: {
      length: round(hairLength),
      fringe: round(fringe),
      parting: round(parting),
      volume: round(volume),
      curl: round(curl),
    },
  };
}

/**
 * The canvas transform (a, b, c, d, e, f) that cuts the face picture out of the photo: the irises
 * onto the picture's eyes and the mouth onto its mouth (`FACE_PICTURE`), the eye on the photo's
 * left onto the picture's left.
 */
export function picturePlacement(
  points: readonly Pixel[],
): [number, number, number, number, number, number] {
  const at = (i: number): Pixel => points[i] ?? { x: 0, y: 0 };
  let a = at(P.irisA);
  let b = at(P.irisB);
  if (b.x < a.x) [a, b] = [b, a];
  const m = at(P.lipsInner);
  const s = FACE_PICTURE.size;
  const to: readonly Pixel[] = [
    { x: FACE_PICTURE.eyeU * s, y: FACE_PICTURE.eyeV * s },
    { x: (1 - FACE_PICTURE.eyeU) * s, y: FACE_PICTURE.eyeV * s },
    { x: 0.5 * s, y: FACE_PICTURE.mouthV * s },
  ];
  const from = [a, b, m];
  // Solve [x y 1]·(p, q, r) = target for each output coordinate (Cramer's rule).
  const det3 = (r: readonly (readonly number[])[]) => {
    const [r0 = [], r1 = [], r2 = []] = r;
    const g = (row: readonly number[], i: number) => row[i] ?? 0;
    return (
      g(r0, 0) * (g(r1, 1) * g(r2, 2) - g(r1, 2) * g(r2, 1)) -
      g(r0, 1) * (g(r1, 0) * g(r2, 2) - g(r1, 2) * g(r2, 0)) +
      g(r0, 2) * (g(r1, 0) * g(r2, 1) - g(r1, 1) * g(r2, 0))
    );
  };
  const rows = from.map((p) => [p.x, p.y, 1]);
  const det = det3(rows) || 1e-9;
  const solve = (target: readonly number[]) =>
    [0, 1, 2].map(
      (col) =>
        det3(rows.map((row, i) => row.map((v, j) => (j === col ? (target[i] ?? 0) : v)))) / det,
    );
  const [px = 0, qx = 0, rx = 0] = solve(to.map((p) => p.x));
  const [py = 0, qy = 0, ry = 0] = solve(to.map((p) => p.y));
  // Canvas: x' = a·x + c·y + e, y' = b·x + d·y + f.
  return [px, py, qx, qy, rx, ry];
}
