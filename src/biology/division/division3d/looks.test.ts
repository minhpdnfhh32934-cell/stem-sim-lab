import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { oklch } from '@/ui/three/color';
import { rimFragment } from '@/ui/three/materials';
import { divisionLooks } from './looks';
import { divisionPalette } from './palette';

/** The theme stylesheet, read as text (no browser needed). */
const CSS = readFileSync(resolve(__dirname, '../../../app/theme/tokens.css'), 'utf8');

/** Every token of one theme block (the block starting at `selector`). */
function block(selector: string): Map<string, string> {
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`no block ${selector}`);
  const end = CSS.indexOf('\n}', start);
  const out = new Map<string, string>();
  for (const m of CSS.slice(start, end).matchAll(/(--[\w-]+):\s*([^;]+);/g))
    if (m[1] && m[2]) out.set(m[1], m[2].trim());
  return out;
}
const ROOT = block(':root {');
const THEMES = {
  light: new Map([...ROOT, ...block(":root[data-theme='light']")]),
  dark: new Map([...ROOT, ...block(":root[data-theme='dark']")]),
};

type Rgb = [number, number, number];
/** WCAG relative luminance of a linear RGB colour, and the contrast ratio of two. */
const luminance = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};
/** A see-through fragment blended over `under` (linear light, as the GPU blends). */
const over = (f: { rgb: Rgb; alpha: number }, under: Rgb): Rgb =>
  f.rgb.map((c, i) => c * f.alpha + (under[i] ?? 0) * (1 - f.alpha)) as Rgb;
const linear = (css: string): Rgb => {
  const c = new THREE.Color(css);
  return [c.r, c.g, c.b];
};

function scene(theme: 'light' | 'dark') {
  const tokens = THEMES[theme];
  const token = (name: string): string => {
    const v = tokens.get(name) ?? '';
    const ref = /^var\((--[\w-]+)\)$/.exec(v);
    return ref?.[1] ? token(ref[1]) : v;
  };
  const number = (name: string) => Number.parseFloat(token(name));
  const palette = divisionPalette(token);
  const looks = divisionLooks(
    palette,
    {
      tier: 'high',
      membraneOpacity: number('--m3d-membrane-opacity'),
      rimStrength: number('--m3d-rim'),
      edgeShade: number('--m3d-edge-shade'),
      shellInk: number('--m3d-shell-ink'),
      hdr: false,
    },
    (x) => x,
  );
  const panel = linear(token('--bg-panel'));
  // The cell from the front: its lit back face (the volume), then the membrane's front face.
  const cyto = looks.cytoplasm.base;
  const behind = over(
    { rgb: [cyto.color.r, cyto.color.g, cyto.color.b], alpha: cyto.opacity },
    panel,
  );
  const membraneAt = (edge: number) => over(rimFragment(looks.membrane.base, edge)!, behind);
  return { token, palette, looks, panel, membraneAt };
}

/** Near the silhouette (1 − |n · v| = 0.8: about two pixels inside a cell 130 px across). */
const OUTLINE = 0.8;

describe('division 3D shells: outlines read on both stages', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: the cell outline reaches 1.5 : 1 on the panel, the cell body shows`, () => {
      const s = scene(theme);
      expect(contrast(s.membraneAt(OUTLINE), s.panel)).toBeGreaterThanOrEqual(1.5);
      // The body (facing the camera) is tinted, not a milky ghost of the stage colour.
      expect(contrast(s.membraneAt(0), s.panel)).toBeGreaterThanOrEqual(1.1);
    });

    it(`${theme}: the nucleus outline reaches 1.5 : 1 on the cell body`, () => {
      const s = scene(theme);
      const body = s.membraneAt(0);
      // The envelope is double-sided: near its silhouette its back and front faces both show.
      const face = rimFragment(s.looks.envelope.base, OUTLINE)!;
      expect(s.looks.envelope.base.side).toBe(THREE.DoubleSide);
      const edge = over(face, over(face, body));
      expect(contrast(edge, body)).toBeGreaterThanOrEqual(1.5);
    });
  }

  it('light: the outline is a deeper shade of the shell, less saturated than the chromosomes', () => {
    const s = scene('light');
    const inkOf = (m: THREE.Material) =>
      `#${(m.userData.rim as { uRimInk: { value: THREE.Color } }).uRimInk.value.getHexString()}`;
    const amount = (m: THREE.Material) =>
      (m.userData.rim as { uRimInkAmount: { value: number } }).uRimInkAmount.value;
    const chromosomeChroma = Math.min(
      oklch(s.token('--chart-1'))?.C ?? 0,
      oklch(s.token('--chart-4'))?.C ?? 0,
    );
    for (const [shell, colour] of [
      [s.looks.membrane.base, s.palette.membrane],
      [s.looks.envelope.base, s.palette.envelope],
    ] as const) {
      expect(amount(shell)).toBeGreaterThan(0);
      const ink = oklch(inkOf(shell));
      const own = oklch(colour);
      expect(ink && own).toBeTruthy();
      expect(ink!.L).toBeLessThan(own!.L - 0.2);
      expect(Math.abs(ink!.h - own!.h)).toBeLessThan(8);
      expect(ink!.C).toBeLessThan(chromosomeChroma);
    }
  });

  it('dark: no ink (the added rim light already outlines the shells)', () => {
    const s = scene('dark');
    for (const m of [s.looks.membrane.base, s.looks.envelope.base])
      expect((m.userData.rim as { uRimInkAmount: { value: number } }).uRimInkAmount.value).toBe(0);
  });
});

describe('division 3D looks without accents (software WebGL)', () => {
  const token = (name: string): string => {
    const v = THEMES.light.get(name) ?? '';
    const ref = /^var\((--[\w-]+)\)$/.exec(v);
    return ref?.[1] ? token(ref[1]) : v;
  };
  const make = (accents?: boolean) =>
    divisionLooks(
      divisionPalette(token),
      {
        tier: 'high',
        membraneOpacity: 0.16,
        rimStrength: 0.7,
        edgeShade: 0.3,
        hdr: false,
        ...(accents === undefined ? {} : { accents }),
      },
      (x) => x,
    );

  it('the lit back face is not drawn and the solids lose their clear coat; colours stay', () => {
    const full = make();
    const lean = make(false);
    expect(full.cytoplasm.base.visible).toBe(true);
    for (const l of [lean.cytoplasm.base, lean.cytoplasm.hi, lean.cytoplasm.dim])
      expect(l.visible).toBe(false);
    const coat = (m: THREE.Material) => (m as THREE.MeshPhysicalMaterial).clearcoat;
    expect(coat(full.bead.base)).toBe(0.3);
    expect(coat(lean.bead.base)).toBe(0);
    expect(coat(lean.centriole.base)).toBe(0);
    // Look only: every colour (a data colour for the chromosomes' parts) is unchanged.
    for (const part of ['bead', 'membrane', 'envelope', 'nucleolus', 'centriole'] as const)
      expect(lean[part].base.color.getHex()).toBe(full[part].base.color.getHex());
  });
});
