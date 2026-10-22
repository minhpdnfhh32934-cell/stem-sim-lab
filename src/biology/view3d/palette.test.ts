import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SERIES_VARS } from '@/ui/charts/uplot';
import { classLook } from '../genetics/mendel3d/look';
import { LESSON_ROLES, ROLES, STRUCTURES, structureColor } from './palette';

describe('ROLES: one source for every lesson, aligned with the 2D charts', () => {
  it('Hardy–Weinberg: AA, Aa, aa are the chart series 1–3; A looks like AA, a like aa', () => {
    expect([ROLES.genotypeAA.token, ROLES.genotypeAa.token, ROLES.genotypeaa.token]).toEqual(
      SERIES_VARS.slice(0, 3),
    );
    expect(ROLES.alleleA.token).toBe('--chart-1');
    expect(ROLES.allelea.token).toBe('--chart-3');
    expect(ROLES.alleleA.token).toBe(ROLES.genotypeAA.token);
    expect(ROLES.allelea.token).toBe(ROLES.genotypeaa.token);
  });

  it('the allele swatches of the 2D legends use the same tokens', () => {
    const css = readFileSync(resolve(__dirname, '../bio.css'), 'utf8');
    const swatch = (cls: string) =>
      new RegExp(String.raw`\.${cls}\s*\{\s*background:\s*var\((--[\w-]+)\)`).exec(css)?.[1];
    expect(swatch('bio-swatch--allele-A')).toBe(ROLES.alleleA.token);
    expect(swatch('bio-swatch--allele-a')).toBe(ROLES.allelea.token);
  });

  it('Lotka–Volterra: prey is chart series 1, predators the predator series (--chart-4)', () => {
    expect(ROLES.prey.token).toBe(SERIES_VARS[0]);
    expect(ROLES.predator.token).toBe(SERIES_VARS[3]);
    expect(ROLES.prey.token).not.toBe(ROLES.predator.token);
  });

  it('Mendel: an allele bead never looks like a phenotype class (colour and shape together)', () => {
    const alleles = [ROLES.alleleA, ROLES.allelea].map((r) => `${r.token}|${r.shape}`);
    for (let i = 0; i < 9; i++) {
      const c = classLook(i);
      expect(alleles, `class ${String(i)}`).not.toContain(`${c.token}|${c.shape}`);
    }
  });

  it('roles that appear together never look alike', () => {
    for (const [lesson, roles] of Object.entries(LESSON_ROLES)) {
      const looks = roles.map((r) => `${ROLES[r].token}|${ROLES[r].shape}`);
      expect(new Set(looks).size, lesson).toBe(roles.length);
    }
  });

  it('structures are muted or use their own low-chroma tokens', () => {
    const token = (n: string) =>
      ({ '--subject-biology': '#16804a', '--chart-6': '#56b4e9', '--bg-stage': '#fbfcfe' })[n] ??
      `?${n}`;
    expect(structureColor(token, 'membrane')).not.toBe('#16804a');
    expect(structureColor(token, 'nucleus')).not.toBe('#56b4e9');
    expect(structureColor(token, 'spindle')).toBe('?--m3d-spindle');
    expect(STRUCTURES.protein.token).toBe('--bio3d-protein');
  });
});
