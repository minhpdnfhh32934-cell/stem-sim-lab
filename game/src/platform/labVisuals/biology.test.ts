import { describe, expect, it } from 'vitest';
import { offspringGenotype } from '../../simulation/models/genetics';
import { GAS_SYRINGE } from '../render/bench/gas-syringe-rig';
import { LENGTH_PER_GRAM as RACK_LENGTH_PER_GRAM } from '../render/bench/osmosis-rack';
import {
  arrowWidth,
  CAPILLARY_ML,
  cylinderLength,
  classCells,
  countTicks,
  fanPeriod,
  GAS_SYRINGE_CAPACITY,
  genotypeLetters,
  knobTurns,
  LENGTH_PER_GRAM,
  objectiveSlot,
  phenotypeClass,
  punnettCells,
  runExists,
  stomatalOpening,
} from './biology';
import { clockText, fraction, thermalTint } from './readouts';

describe('microscope maps', () => {
  it('finds the nosepiece slot of an objective', () => {
    expect([4, 10, 40, 5, NaN].map(objectiveSlot)).toEqual([0, 1, 2, -1, -1]);
  });

  it('turns the fine focus by the stage travel since the start, and not at all without a run', () => {
    expect(knobTurns(true, 100, 50)).toBe(0.25);
    expect(knobTurns(true, 100, 100)).toBe(0);
    expect(knobTurns(false, 100, 50)).toBe(0);
    expect(knobTurns(true, 100, NaN)).toBe(0);
  });

  it('has a lamp on while a run exists', () => {
    expect(['idle', 'configured'].some(runExists)).toBe(false);
    expect(['running', 'stopped', 'completed'].every(runExists)).toBe(true);
  });

  it('marks n cells after completion only', () => {
    const out: number[] = [];
    expect(countTicks(3, false, out)).toEqual([]);
    expect(countTicks(0, true, out)).toEqual([]);
    expect(countTicks(NaN, true, out)).toEqual([]);
    countTicks(4, true, out);
    expect(out).toHaveLength(4);
    expect(out[0]).toBeCloseTo(-0.75, 12);
    expect(out[3]).toBeCloseTo(0.75, 12);
  });
});

describe('osmosis and enzyme maps', () => {
  it("keeps the rack renderer's sizes (it has its own copy)", () => {
    expect(LENGTH_PER_GRAM).toBe(RACK_LENGTH_PER_GRAM);
    expect(GAS_SYRINGE_CAPACITY).toBe(GAS_SYRINGE.capacity);
  });

  it("scales the cylinder as the rack's volume cube root does", () => {
    // osmosis-rack.test.ts: length = m₀·LENGTH_PER_GRAM·∛(1 + 1.08 (m − m₀)/m₀).
    for (const [m, m0] of [
      [3, 3],
      [3.9, 3],
      [2.1, 3],
      [7, 6],
    ] as const) {
      const k = Math.cbrt(1 + (1.08 * (m - m0)) / m0);
      expect(cylinderLength(m, m0)).toBeCloseTo(m0 * RACK_LENGTH_PER_GRAM * k, 12);
    }
    expect(cylinderLength(NaN, 3)).toBeNaN();
    expect(cylinderLength(3, 0)).toBeNaN();
  });

  it('draws the arrows wider with a bigger potential difference, none without one', () => {
    expect(arrowWidth(NaN, 2437)).toBe(0);
    expect(arrowWidth(100, 0)).toBe(0);
    expect(arrowWidth(0, 2437)).toBe(2);
    expect(arrowWidth(-2437, 2437)).toBe(12);
    expect(arrowWidth(-9999, 2437)).toBe(12);
    expect(arrowWidth(1200, 2437)).toBeLessThan(arrowWidth(2400, 2437));
  });
});

describe('plant maps', () => {
  it('stops the fan at the slowest air speed and spins it faster with more', () => {
    expect(fanPeriod(0.1, 0.1)).toBeNull();
    expect(fanPeriod(NaN, 0.1)).toBeNull();
    expect(fanPeriod(0.5, 0.1)!).toBeGreaterThan(fanPeriod(1, 0.1)!);
    expect(fanPeriod(1, 0.1)!).toBeGreaterThan(fanPeriod(3, 0.1)!);
  });

  it('opens the pore from the dark conductance to the open one, closed without a run', () => {
    expect(stomatalOpening(0.01)).toBe(0);
    expect(stomatalOpening(0.3)).toBe(1);
    expect(stomatalOpening(NaN)).toBe(0);
    expect(stomatalOpening(0.155)).toBeCloseTo(0.5, 12);
  });

  it('holds the capillary at its bore and length', () => {
    // The 3D rig's gas column: bore r = 1.5 mm over gasTop − bottom = 0.31 − 0.115 m.
    expect(CAPILLARY_ML).toBeCloseTo(Math.PI * 0.0015 ** 2 * (0.31 - 0.115) * 1e6, 9);
  });
});

describe('genetics maps', () => {
  it('writes genotype codes as letters', () => {
    expect([22, 21, 12, 11, 10, 2, 0].map(genotypeLetters)).toEqual([
      'YYRR',
      'YYRr',
      'YyRR',
      'YyRr',
      'Yyrr',
      'yyRR',
      'yyrr',
    ]);
    expect([NaN, 3, 23, -1].map(genotypeLetters)).toEqual(['—', '—', '—', '—']);
  });

  it('classes a genotype by its dominant traits', () => {
    expect([22, 10, 2, 0, NaN].map(phenotypeClass)).toEqual([0, 1, 2, 3, -1]);
  });

  it("lays out the sixteen cells with the model's offspringGenotype: 9:3:3:1 for YyRr × YyRr", () => {
    const cells = punnettCells(11, 11, []);
    expect(cells).toHaveLength(16);
    cells.forEach((code, i) =>
      expect(code).toBe(offspringGenotype(11, 11, (i >> 2) | ((i & 3) << 2))),
    );
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    classCells(cells, counts);
    expect(counts).toEqual([9, 3, 3, 1]);
  });

  it('gives 1:1:1:1 for the test cross and one class for YYRR × YYRR; nothing for no parent', () => {
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    classCells(punnettCells(11, 0, []), counts);
    expect(counts).toEqual([4, 4, 4, 4]);
    classCells(punnettCells(22, 22, []), counts);
    expect(counts).toEqual([16, 0, 0, 0]);
    expect(punnettCells(NaN, 11, [])).toEqual([]);
    expect(punnettCells(11, 5, [])).toEqual([]);
  });
});

describe('readout maps', () => {
  it('writes a clock, a dash for none', () => {
    expect([0, 59.9, 60, 3599, 3600, 14400, NaN, -1].map(clockText)).toEqual([
      '00:00',
      '00:59',
      '01:00',
      '59:59',
      '1:00:00',
      '4:00:00',
      '—',
      '—',
    ]);
  });

  it('places a value in its range, 0 for none', () => {
    expect([
      fraction(15, 10, 20),
      fraction(5, 10, 20),
      fraction(30, 10, 20),
      fraction(NaN, 0, 1),
    ]).toEqual([0.5, 0, 1, 0]);
    expect(fraction(1, 1, 1)).toBe(0);
  });

  it('tints a bath from cool to warm', () => {
    expect(thermalTint(0)).toBe('#5b9fd0');
    expect(thermalTint(1)).toBe('#e08a3c');
    expect(thermalTint(NaN)).toBe(thermalTint(0));
    expect(thermalTint(0.5)).not.toBe(thermalTint(0));
  });
});
