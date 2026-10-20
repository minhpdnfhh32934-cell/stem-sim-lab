/**
 * The backdrop behind every 3D picture (`scene.background`): a soft radial gradient from the
 * stage colour at the centre to a slightly deeper edge, with a light vignette — or, for an
 * outdoor habitat, a sky gradient. Built from numbers (no canvas, jsdom-safe) as a 256² texture
 * with ±1/255 ordered dither, so the gradient never bands. One screen quad, no extra pass; the
 * picture is opaque, so "Xuất ảnh PNG" saves exactly what is on screen.
 */
import * as THREE from 'three';
import { mixLinear, parseHex, type Rgb } from './color';

export const BACKDROP_SIZE = 256;

/** 4 × 4 Bayer matrix, as offsets in (−0.5, 0.5) of one 8-bit step. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (v) => (v + 0.5) / 16 - 0.5,
);

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function texture(data: Uint8Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, BACKDROP_SIZE, BACKDROP_SIZE, THREE.RGBAFormat);
  // The bytes are sRGB: the background is drawn untouched by tone mapping, so the centre shows
  // the stage token exactly.
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function fill(colorAt: (u: number, v: number) => Rgb, dither = true): Uint8Array {
  const n = BACKDROP_SIZE;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const c = colorAt((x + 0.5) / n, (y + 0.5) / n);
      const d = dither ? (BAYER[(y % 4) * 4 + (x % 4)] ?? 0) : 0;
      const k = 4 * (y * n + x);
      for (let i = 0; i < 3; i++) {
        data[k + i] = Math.min(255, Math.max(0, Math.round((c[i] ?? 0) * 255 + d)));
      }
      data[k + 3] = 255;
    }
  }
  return data;
}

/**
 * Radial gradient: `center` at the middle, `edge` at the corners, darkened towards the corners by
 * `vignette` (0…1). Colours are CSS hex values (theme tokens). Texture row 0 is the bottom.
 * `dither: false` is for tests (the plain gradient the dither is measured against).
 */
export function backdropTexture(
  center: string,
  edge: string,
  vignette: number,
  dither = true,
): THREE.DataTexture {
  const c = parseHex(center) ?? [1, 1, 1];
  // The edge colour is a linear-light mix (done once); per pixel the sRGB values blend.
  const e = parseHex(edge) ?? c;
  const corner = Math.SQRT1_2;
  return texture(
    fill((u, v) => {
      const r = Math.hypot(u - 0.5, v - 0.5) / corner;
      const t = smooth(0, 1, r);
      const dim = 1 - vignette * smooth(0.45, 1.05, r);
      return [0, 1, 2].map((i) => ((c[i] ?? 0) + ((e[i] ?? 0) - (c[i] ?? 0)) * t) * dim) as Rgb;
    }, dither),
  );
}

/** Sky gradient for habitats: `top` at the top of the picture, `horizon` from 60 % down. */
export function skyTexture(top: string, horizon: string): THREE.DataTexture {
  const a = parseHex(top) ?? [1, 1, 1];
  const b = parseHex(horizon) ?? a;
  return texture(
    fill((_u, v) => {
      // v = 0 is the bottom row: the horizon colour fills the lower part.
      const t = smooth(0.4, 1, v);
      return [0, 1, 2].map((i) => (b[i] ?? 0) + ((a[i] ?? 0) - (b[i] ?? 0)) * t) as Rgb;
    }),
  );
}

/** Tokens the backdrop is made of (CSS values; empty when the stylesheet is missing). */
export interface BackdropTokens {
  stage: string;
  sunken: string;
  app: string;
  skyTop: string;
  skyHorizon: string;
}

export const BACKDROP_TOKEN_NAMES: Record<keyof BackdropTokens, string> = {
  stage: '--bg-stage',
  sunken: '--bg-sunken',
  app: '--bg-app',
  skyTop: '--bio3d-sky-top',
  skyHorizon: '--bio3d-sky-horizon',
};

/** Style guide values: edge mix and vignette per theme. */
export const BACKDROP_LOOK = {
  light: { edgeMix: 0.8, vignette: 0.1 },
  dark: { edgeMix: 0.9, vignette: 0.25 },
} as const;

/**
 * The backdrop of a look, or null when the theme tokens cannot be read (tests without the
 * stylesheet: the canvas stays transparent over the stage colour, as before).
 */
export function stageBackdrop(
  tokens: BackdropTokens,
  theme: 'light' | 'dark',
  preset: 'studio' | 'outdoor',
): THREE.DataTexture | null {
  if (preset === 'outdoor') {
    if (!parseHex(tokens.skyTop) || !parseHex(tokens.skyHorizon)) return null;
    return skyTexture(tokens.skyTop, tokens.skyHorizon);
  }
  const deeper = theme === 'dark' ? tokens.app : tokens.sunken;
  if (!parseHex(tokens.stage) || !parseHex(deeper)) return null;
  const look = BACKDROP_LOOK[theme];
  return backdropTexture(
    tokens.stage,
    mixLinear(tokens.stage, deeper, look.edgeMix),
    look.vignette,
  );
}
