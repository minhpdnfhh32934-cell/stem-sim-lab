import { describe, expect, it } from 'vitest';
import { FaceShapeSchema, HairDesignSchema } from '../../../gameplay/character';
import { FACE_PICTURE } from '../../render/body/facePhoto';
import {
  AVERAGE,
  faceFromPhoto,
  picturePlacement,
  type Pixel,
  type PhotoFace,
} from './faceFromPhoto';

// A face made from a photo: synthetic landmarks of an average frontal face (in the face's frame,
// unit the distance between the irises), placed in a 400 × 400 photo, with a hair mask at its own
// size painted in face-frame regions.

const W = 400;
const H = 400;
const SKIN = [0xc9, 0x94, 0x70] as const;
const HAIR = [0x3a, 0x2a, 0x1e] as const;
const IRIS = [0x3b, 0x6e, 0x8f] as const;

// The average face, from `AVERAGE`.
const len = AVERAGE.length;
const mouthY = AVERAGE.mouth * len;
const chinY = mouthY + AVERAGE.chin * len;
const innerX = (AVERAGE.spacing * AVERAGE.eye) / 2;
const LAYOUT: Record<number, Pixel> = {
  1: { x: 0, y: AVERAGE.nose * len }, // nose tip
  10: { x: 0, y: chinY - len }, // forehead
  13: { x: 0, y: mouthY },
  33: { x: -innerX - AVERAGE.eye, y: 0 },
  50: { x: -0.6, y: 0.5 },
  105: { x: -0.5, y: -0.3 },
  133: { x: -innerX, y: 0 },
  151: { x: 0, y: -0.5 },
  152: { x: 0, y: chinY },
  172: { x: (-AVERAGE.jaw * AVERAGE.width) / 2, y: 1.4 },
  199: { x: 0, y: 1.6 },
  234: { x: -AVERAGE.width / 2, y: 0.3 },
  263: { x: innerX + AVERAGE.eye, y: 0 },
  280: { x: 0.6, y: 0.5 },
  334: { x: 0.5, y: -0.3 },
  362: { x: innerX, y: 0 },
  397: { x: (AVERAGE.jaw * AVERAGE.width) / 2, y: 1.4 },
  454: { x: AVERAGE.width / 2, y: 0.3 },
  468: { x: -0.5, y: 0 },
  469: { x: -0.4, y: 0 },
  473: { x: 0.5, y: 0 },
};

interface Face {
  readonly points: Pixel[];
  toLocal(p: Pixel): Pixel;
}

/** The face at `scale` px per unit, eye midpoint at (ox, oy), rolled `rollDeg`, some points moved. */
function makeFace(
  opts: {
    scale?: number;
    ox?: number;
    oy?: number;
    rollDeg?: number;
    at?: Record<number, Pixel>;
  } = {},
): Face {
  const { scale = 80, ox = 200, oy = 140, rollDeg = 0, at = {} } = opts;
  const c = Math.cos((rollDeg * Math.PI) / 180);
  const s = Math.sin((rollDeg * Math.PI) / 180);
  const points = Array.from({ length: 478 }, (_, i): Pixel => {
    const l = at[i] ?? LAYOUT[i];
    if (!l) return { x: 0, y: 0 };
    return { x: ox + scale * (c * l.x - s * l.y), y: oy + scale * (s * l.x + c * l.y) };
  });
  const toLocal = (p: Pixel): Pixel => {
    const dx = (p.x - ox) / scale;
    const dy = (p.y - oy) / scale;
    return { x: c * dx + s * dy, y: -s * dx + c * dy };
  };
  return { points, toLocal };
}

type Region = (l: Pixel) => boolean;

/** Runs the module on `face` over a skin-filled photo, with hair (mask 250 × 320) in `hair`. */
function measure(
  face: Face,
  opts: { skin?: readonly number[]; hair?: Region; paint?: [Region, readonly number[]][] } = {},
): PhotoFace {
  const rgba = new Uint8ClampedArray(W * H * 4);
  const mw = 250;
  const mh = 320;
  const sx = mw / W;
  const sy = mh / H;
  let mask: Float32Array | null = null;
  if (opts.hair) {
    mask = new Float32Array(mw * mh);
    for (let my = 0; my < mh; my++) {
      for (let mx = 0; mx < mw; mx++) {
        if (opts.hair(face.toLocal({ x: (mx + 0.5) / sx, y: (my + 0.5) / sy }))) {
          mask[my * mw + mx] = 1;
        }
      }
    }
  }
  const paints: [Region, readonly number[]][] = [
    // The irises, radius 0.1 (as 468 → 469).
    [(l) => Math.hypot(Math.abs(l.x) - 0.5, l.y) <= 0.1, IRIS],
    ...(opts.paint ?? []),
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = face.toLocal({ x, y });
      let rgb: readonly number[] = opts.skin ?? SKIN;
      for (const [region, colour] of paints) if (region(l)) rgb = colour;
      if (mask && (mask[Math.floor(y * sy) * mw + Math.floor(x * sx)] ?? 0) > 0.5) rgb = HAIR;
      const i = (y * W + x) * 4;
      rgba.set([rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0, 255], i);
    }
  }
  return faceFromPhoto({
    points: face.points,
    rgba,
    width: W,
    height: H,
    hair: mask,
    maskWidth: mw,
    maskHeight: mh,
  });
}

const ok = (r: PhotoFace): PhotoFace => r;

// Hair regions (face frame).
const cap: Region = (l) => Math.abs(l.x) < 1.6 && l.y > -1.6 && l.y < -0.9;
const sidesTo =
  (bottom: number): Region =>
  (l) =>
    Math.abs(l.x) > 0.95 && Math.abs(l.x) < 1.6 && l.y > -1.6 && l.y < bottom;
const either =
  (...rs: Region[]): Region =>
  (l) =>
    rs.some((r) => r(l));

describe('faceFromPhoto', () => {
  it('measures an average face as 1 everywhere, within the character schemas', () => {
    const r = ok(measure(makeFace()));
    for (const [k, v] of Object.entries(r.face)) expect(v, k).toBeCloseTo(1, 2);
    expect(() => FaceShapeSchema.parse(r.face)).not.toThrow();
    expect(() => HairDesignSchema.parse(r.hairDesign)).not.toThrow();
  });

  it('measures a wider face as wider, and keeps extreme faces within the schema', () => {
    const wide = ok(
      measure(makeFace({ at: { 234: { x: -1.2, y: 0.3 }, 454: { x: 1.2, y: 0.3 } } })),
    );
    expect(wide.face.width).toBeGreaterThan(1);
    const absurd = ok(
      measure(
        makeFace({
          scale: 30,
          at: {
            234: { x: -5, y: 0.3 },
            454: { x: 5, y: 0.3 },
            33: { x: -3, y: 0 },
            263: { x: 3, y: 0 },
            152: { x: 0, y: 6 },
          },
        }),
      ),
    );
    expect(absurd.face.width).toBe(1.15);
    expect(() => FaceShapeSchema.parse(absurd.face)).not.toThrow();
    expect(() => HairDesignSchema.parse(absurd.hairDesign)).not.toThrow();
  });

  it('measures the same proportions when the head is rolled', () => {
    const at = { 234: { x: -1.2, y: 0.3 }, 454: { x: 1.2, y: 0.3 }, 13: { x: 0, y: 1.2 } };
    const flat = ok(measure(makeFace({ at })));
    const rolled = ok(measure(makeFace({ at, rollDeg: 20 })));
    for (const [k, v] of Object.entries(flat.face)) {
      expect(rolled.face[k as keyof typeof flat.face], k).toBeCloseTo(v, 2);
    }
  });

  it('reads a head turned from the camera too (a funny face is fine)', () => {
    expect(measure(makeFace({ at: { 1: { x: 0.8, y: 0.65 } } })).ok).toBe(true);
  });

  it('takes the skin from the cheeks and the eyes from the iris rings', () => {
    const r = ok(measure(makeFace()));
    expect(r.skinTone).toBe('#c99470');
    expect(r.eyeColor).toBe('#3b6e8f');
  });

  it('gives no hair design, no hair colour and no beard without a mask on plain skin', () => {
    const r = ok(measure(makeFace()));
    expect(r.hairDesign).toEqual({ length: 0, fringe: 0, parting: 0, volume: 0, curl: 0 });
    expect(r.hairColor).toBeNull();
    expect(r.beard).toBe(false);
  });

  it('measures how far the hair falls and its colour', () => {
    const long = ok(measure(makeFace(), { hair: either(cap, sidesTo(1.6 * chinY)) }));
    expect(long.hairDesign.length).toBeGreaterThan(0.7 - 0.08);
    expect(long.hairDesign.length).toBeLessThan(0.7 + 0.08);
    expect(long.hairColor).toBe('#3a2a1e');
    const short = ok(measure(makeFace(), { hair: either(cap, sidesTo(0)) }));
    expect(short.hairDesign.length).toBeCloseTo(0.22, 1);
  });

  it('measures the fringe and the parting from the forehead', () => {
    const sides = either(cap, sidesTo(0.5));
    const forehead: Region = (l) => Math.abs(l.x) < 0.7 && l.y > -0.95 && l.y < -0.25;
    const full = ok(measure(makeFace(), { hair: either(sides, forehead) }));
    expect(full.hairDesign.fringe).toBeGreaterThan(0.95);
    const half = ok(measure(makeFace(), { hair: either(sides, (l) => forehead(l) && l.x > 0) }));
    expect(half.hairDesign.parting).toBeGreaterThan(0);
    const bare = ok(measure(makeFace(), { hair: sides }));
    expect(bare.hairDesign.fringe).toBe(0);
  });

  it('sees a beard where the chin is darker than the skin', () => {
    const dark = SKIN.map((c) => Math.round(c * 0.5));
    const r = ok(measure(makeFace(), { paint: [[(l) => Math.hypot(l.x, l.y - 1.6) < 0.2, dark]] }));
    expect(r.beard).toBe(true);
  });

  it('places the face picture with its eyes and mouth where the head draws them, rolled or not', () => {
    for (const rollDeg of [0, 25]) {
      const { points } = makeFace({ rollDeg, scale: 60 });
      const [a, b, c, d, e, f] = picturePlacement(points);
      const to = (i: number) => {
        const p = points[i] ?? { x: 0, y: 0 };
        return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f };
      };
      const s = FACE_PICTURE.size;
      const eyes = [to(468), to(473)].sort((m, n) => m.x - n.x);
      expect(eyes[0]?.x).toBeCloseTo(FACE_PICTURE.eyeU * s, 6);
      expect(eyes[1]?.x).toBeCloseTo((1 - FACE_PICTURE.eyeU) * s, 6);
      expect(eyes[0]?.y).toBeCloseTo(FACE_PICTURE.eyeV * s, 6);
      expect(to(13).x).toBeCloseTo(0.5 * s, 6);
      expect(to(13).y).toBeCloseTo(FACE_PICTURE.mouthV * s, 6);
    }
  });
});
