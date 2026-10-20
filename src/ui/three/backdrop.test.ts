import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mixLinear, parseHex } from './color';
import {
  BACKDROP_LOOK,
  BACKDROP_SIZE,
  backdropTexture,
  skyTexture,
  stageBackdrop,
  type BackdropTokens,
} from './backdrop';

const pixel = (tex: THREE.DataTexture, x: number, y: number) => {
  const data = tex.image.data as Uint8Array;
  const k = 4 * (y * BACKDROP_SIZE + x);
  return [data[k] ?? 0, data[k + 1] ?? 0, data[k + 2] ?? 0, data[k + 3] ?? 0];
};
const bytes = (hex: string) => (parseHex(hex) ?? [0, 0, 0]).map((c) => Math.round(c * 255));

const LIGHT: BackdropTokens = {
  stage: '#fbfcfe',
  sunken: '#e7ebf2',
  app: '#eef1f6',
  skyTop: '#dbe7f3',
  skyHorizon: '#f3f6f9',
};

describe('backdrop', () => {
  it('the centre is the stage token; dither never moves a pixel by more than one step', () => {
    const tex = backdropTexture('#fbfcfe', '#e9edf3', 0.1);
    const mid = BACKDROP_SIZE / 2;
    expect(pixel(tex, mid, mid)).toEqual([...bytes('#fbfcfe'), 255]);
    // Against the plain gradient (no dither), no channel of any pixel moves by more than 1.
    const plain = backdropTexture('#fbfcfe', '#e9edf3', 0.1, false);
    const data = tex.image.data as Uint8Array;
    const ref = plain.image.data as Uint8Array;
    let off = 0;
    let moved = 0;
    for (let k = 0; k < data.length; k++) {
      const d = Math.abs((data[k] ?? 0) - (ref[k] ?? 0));
      off = Math.max(off, d);
      if (d > 0) moved++;
    }
    expect(off).toBe(1);
    // The dither does move pixels (it is not a no-op) — only where the gradient sits between steps.
    expect(moved).toBeGreaterThan(0);
    // Neighbours along a row differ by at most 1 step + the gradient's own slope.
    let worst = 0;
    for (let x = 1; x < BACKDROP_SIZE; x++) {
      const a = pixel(tex, x - 1, mid);
      const b = pixel(tex, x, mid);
      worst = Math.max(worst, ...[0, 1, 2].map((i) => Math.abs((a[i] ?? 0) - (b[i] ?? 0))));
    }
    expect(worst).toBeLessThanOrEqual(2);
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
    tex.dispose();
    plain.dispose();
  });

  it('dither stays within ±1 of the exact gradient value', () => {
    // A flat backdrop (centre = edge, no vignette): every pixel is the token, exactly.
    const flat = backdropTexture('#7f8081', '#7f8081', 0);
    const want = bytes('#7f8081');
    const data = flat.image.data as Uint8Array;
    for (let k = 0; k < data.length; k += 4) {
      for (let i = 0; i < 3; i++) expect(Math.abs((data[k + i] ?? 0) - (want[i] ?? 0))).toBe(0);
    }
    flat.dispose();
  });

  it('corners are deeper than the centre (gradient + vignette)', () => {
    const tex = backdropTexture('#fbfcfe', '#e9edf3', 0.1);
    const c = pixel(tex, 128, 128);
    const corner = pixel(tex, 0, 0);
    for (let i = 0; i < 3; i++) expect(corner[i] ?? 0).toBeLessThan(c[i] ?? 0);
    tex.dispose();
  });

  it('sky: the top is the sky token, the lower part the horizon token', () => {
    const tex = skyTexture('#dbe7f3', '#f3f6f9');
    expect(pixel(tex, 10, BACKDROP_SIZE - 1).slice(0, 3)).toEqual(bytes('#dbe7f3'));
    expect(pixel(tex, 10, 0).slice(0, 3)).toEqual(bytes('#f3f6f9'));
    tex.dispose();
  });

  it('stage backdrop per theme and preset; none without readable tokens', () => {
    const light = stageBackdrop(LIGHT, 'light', 'studio');
    expect(light).not.toBeNull();
    expect(pixel(light!, 128, 128).slice(0, 3)).toEqual(bytes(LIGHT.stage));
    // The edge colour is the linear mix of the stage and the sunken token.
    const edge = mixLinear(LIGHT.stage, LIGHT.sunken, BACKDROP_LOOK.light.edgeMix);
    expect(edge).not.toBe(LIGHT.stage);
    light?.dispose();
    const sky = stageBackdrop(LIGHT, 'light', 'outdoor');
    expect(sky).not.toBeNull();
    sky?.dispose();
    expect(stageBackdrop({ ...LIGHT, stage: '' }, 'light', 'studio')).toBeNull();
    expect(stageBackdrop({ ...LIGHT, skyTop: '' }, 'dark', 'outdoor')).toBeNull();
  });
});
