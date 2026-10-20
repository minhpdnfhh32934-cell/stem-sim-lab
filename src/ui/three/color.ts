/**
 * Colour helpers of the 3D views (pure). Theme tokens are mixed in linear light (as three.js
 * lights them), muted in OKLCH, and compared in OKLab (ΔE_OK). Light temperatures (kelvin) are
 * physical constants of the light rig, not UI colours.
 */

export type Rgb = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** sRGB channels 0…1 of a CSS hex colour (#rgb or #rrggbb); null when it is not one. */
export function parseHex(css: string): Rgb | null {
  const s = css.trim();
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m3)
    return [m3[1], m3[2], m3[3]].map((h) => parseInt(`${h ?? '0'}${h ?? '0'}`, 16) / 255) as Rgb;
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
  if (m6) return [m6[1], m6[2], m6[3]].map((h) => parseInt(h ?? '0', 16) / 255) as Rgb;
  return null;
}

/** #rrggbb of sRGB channels 0…1. */
export function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((c) =>
      Math.round(clamp01(c) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Linear-light channels of a hex colour. */
export function linearOf(css: string): Rgb | null {
  const p = parseHex(css);
  return p ? (p.map(toLinear) as Rgb) : null;
}

/** Hex colour of linear-light channels. */
export function hexOfLinear(lin: Rgb): string {
  return toHex(lin.map((c) => toSrgb(clamp01(c))) as Rgb);
}

/** `a` mixed towards `b` by `t` (0…1) in linear light. Non-hex input returns `a` unchanged. */
export function mixLinear(a: string, b: string, t: number): string {
  const p = linearOf(a);
  const q = linearOf(b);
  if (!p || !q) return a;
  return hexOfLinear([0, 1, 2].map((i) => (p[i] ?? 0) + ((q[i] ?? 0) - (p[i] ?? 0)) * t) as Rgb);
}

/** OKLab of a hex colour (L 0…1). */
export function oklab(css: string): Rgb | null {
  const lin = linearOf(css);
  if (!lin) return null;
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Hex colour of an OKLab triple (out-of-gamut channels are clipped). */
export function fromOklab([L, a, b]: Rgb): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return hexOfLinear([
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]);
}

/** ΔE_OK: Euclidean distance in OKLab (≈ 0.02 is a just-noticeable difference). */
export function deltaEOK(x: string, y: string): number {
  const p = oklab(x);
  const q = oklab(y);
  if (!p || !q) return 0;
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** OKLCH chroma and hue (degrees) of a hex colour. */
export function oklch(css: string): { L: number; C: number; h: number } | null {
  const p = oklab(css);
  if (!p) return null;
  const h = (Math.atan2(p[2], p[1]) * 180) / Math.PI;
  return { L: p[0], C: Math.hypot(p[1], p[2]), h: (h + 360) % 360 };
}

/**
 * A structure colour (membrane, nucleus, glass): mixed `towards` the stage colour by `amount` in
 * linear light, then its OKLCH chroma scaled by `chroma`. Only data colours stay saturated.
 */
export function muted(color: string, towards: string, amount = 0.35, chroma = 0.6): string {
  const mixed = mixLinear(color, towards, amount);
  const p = oklab(mixed);
  if (!p) return color;
  return fromOklab([p[0], p[1] * chroma, p[2] * chroma]);
}

/**
 * Linear RGB (max channel 1) of a black-body light at `kelvin` (Tanner Helland's fit of the
 * CIE data, 1000–40000 K): warm key light 5200 K, cool fill 7500 K.
 */
export function kelvinLinear(kelvin: number): Rgb {
  const t = Math.min(400, Math.max(10, kelvin / 100));
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const lin = [r, g, b].map((c) => toLinear(clamp01(c / 255))) as Rgb;
  const max = Math.max(...lin) || 1;
  return lin.map((c) => c / max) as Rgb;
}
