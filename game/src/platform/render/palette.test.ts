import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LOOKS } from './looks';
import { type Finish, FINISHES, Palette } from './palette';

// The props' one palette: a material per finish and per decor colour, each made once and shared,
// glowing, see-through or plain as its data says, all freed together.

const ALL = Object.keys(FINISHES) as Finish[];

describe('the palette', () => {
  it('makes one material per finish, in its colour and look, and shares it', () => {
    const palette = new Palette();
    for (const finish of ALL) {
      const material = palette.finish(finish);
      expect(palette.finish(finish)).toBe(material);
      expect(`#${material.color.getHexString()}`).toBe(FINISHES[finish].color);
      expect(material.roughness).toBe(LOOKS[FINISHES[finish].look].roughness);
    }
    expect(new Set(ALL.map((f) => palette.finish(f))).size).toBe(ALL.length);
  });

  it('lights lit finishes in their colour, the emblem’s cyan at 0.45, no other', () => {
    const palette = new Palette();
    for (const finish of ALL) {
      const material = palette.finish(finish);
      const { look, color } = FINISHES[finish];
      const glow = look === 'light' ? 1 : finish === 'emblem-cyan' ? 0.45 : 0;
      if (glow === 0) expect(material.emissive.getHex(), finish).toBe(0);
      else {
        expect(`#${material.emissive.getHexString()}`, finish).toBe(color);
        expect(material.emissiveIntensity, finish).toBe(glow);
      }
    }
  });

  it('draws see-through finishes without writing depth, at their own opacity', () => {
    const palette = new Palette();
    for (const finish of ALL) {
      const spec: { look: string; opacity?: number } = FINISHES[finish];
      const material = palette.finish(finish);
      expect(material.transparent, finish).toBe(spec.look === 'glass');
      expect(material.depthWrite, finish).toBe(spec.look !== 'glass');
      expect(material.opacity, finish).toBe(spec.opacity ?? 1);
    }
  });

  it('shares a decor body’s material per colour and look; a light one glows in its colour', () => {
    const palette = new Palette();
    const lit = palette.surface('#f6f2e6', 'light');
    expect(palette.surface('#f6f2e6', 'light')).toBe(lit);
    expect(palette.surface('#f6f2e6', 'satin')).not.toBe(lit);
    expect(lit.emissive.getHexString()).toBe('f6f2e6');
    expect(palette.surface('#f6f2e6', 'satin').emissive.getHex()).toBe(0);
  });

  it('frees every material it made', () => {
    const palette = new Palette();
    const made = [...ALL.map((f) => palette.finish(f)), palette.surface('#ffffff', 'matte')];
    const freed = new Set<THREE.Material>();
    for (const m of made) m.addEventListener('dispose', () => freed.add(m));
    palette.dispose();
    expect(freed.size).toBe(made.length);
    expect(palette.finish('steel')).not.toBe(made[ALL.indexOf('steel')]); // made again after
  });
});
