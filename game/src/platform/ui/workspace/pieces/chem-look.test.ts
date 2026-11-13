import { describe, expect, it } from 'vitest';
import {
  chartFamily,
  indicatorFor,
  indicatorTint,
  precipitateOpacity,
  violetLinear,
  WATER,
} from '../../../labVisuals/chemistry';
import { PRECIPITATES } from '../../../../simulation/models/precipitation';
import { definitionOf, stationView, type Station } from '../testing/chemFixtures';
import type { Frame } from './chem-kit';
import {
  buretteScale,
  contentsMl,
  crystalShare,
  delivered,
  DONE,
  electrodeDepth,
  emptied,
  intoState,
  newTint,
  NO_STEPS,
  PENDING,
  precipitateTint,
  share,
  tintReader,
  bedOf,
} from './chem-look';

// What a Chemistry piece draws, as numbers: from a frame of the pose and the names its piece lists.

const definition = definitionOf('acid-base-titration');
function frame(declared: string[], s: Station = {}): Frame {
  const view = stationView(definition, s);
  const pose =
    view.kind === 'bench' ? view.pose : { status: 'idle' as const, parameters: {}, sample: {} };
  return {
    view,
    pose,
    running: pose.status === 'running',
    completed: pose.status === 'completed',
    sig: 0,
    settings: 0,
    declared: new Set(declared),
  };
}

describe('the liquid colour', () => {
  it('is the indicator colour at the model pH, through the shared map', () => {
    const read = tintReader();
    const out = newTint();
    read(
      frame(['pH'], { status: 'running', parameters: { endpointPH: 8.2 }, sample: { pH: 9.4 } }),
      out,
    );
    const want: [number, number, number] = [0, 0, 0];
    indicatorTint(indicatorFor(8.2), 9.4, want);
    expect(out.kind).toBe('indicator');
    expect(out.rgb).toEqual(want);
    expect(out.form).toBe(1); // inside phenolphthalein 8.2-10
    read(
      frame(['pH'], { status: 'running', parameters: { endpointPH: 8.2 }, sample: { pH: 12 } }),
      out,
    );
    expect(out.form).toBe(2);
    read(
      frame(['pH'], { status: 'running', parameters: { endpointPH: 8.2 }, sample: { pH: 3 } }),
      out,
    );
    expect(out.form).toBe(0);
  });

  it('is the dye colour at the model absorbance', () => {
    const out = newTint();
    tintReader()(frame(['absorbance'], { status: 'running', sample: { absorbance: 0.7 } }), out);
    const want: [number, number, number] = [0, 0, 0];
    expect(out.opacity).toBe(violetLinear(0.7, want));
    expect(out.rgb).toEqual(want);
    expect(out.kind).toBe('violet');
  });

  it('is the clear solution own tint with no run, no value or no variable listed', () => {
    for (const f of [
      frame(['pH', 'absorbance']),
      frame(['pH', 'absorbance'], {
        status: 'running',
        parameters: { endpointPH: 8.2 },
        sample: { pH: NaN, absorbance: NaN },
      }),
      frame([], {
        status: 'running',
        parameters: { endpointPH: 8.2 },
        sample: { pH: 5, absorbance: 1 },
      }),
    ]) {
      const out = newTint();
      tintReader()(f, out);
      expect(out.kind).toBe('none');
      expect(out.rgb).toEqual([...WATER]);
    }
  });

  it('finds the indicator again only when its setting changes', () => {
    const read = tintReader();
    const out = newTint();
    for (const end of [4.4, 4.4, 8.2, 8.2]) {
      read(
        frame(['pH'], { status: 'running', parameters: { endpointPH: end }, sample: { pH: 4 } }),
        out,
      );
      const want: [number, number, number] = [0, 0, 0];
      indicatorTint(indicatorFor(end), 4, want);
      expect(out.rgb).toEqual(want);
    }
  });

  it('shows a precipitate in the colour of the model product, as much as has come out', () => {
    const rgb: [number, number, number] = [0, 0, 0];
    expect(precipitateTint(frame(['product', 'precipitatedPercent']), rgb)).toBe(0);
    const f = frame(['product', 'precipitatedPercent'], {
      status: 'running',
      sample: { product: 3, precipitatedPercent: 50 },
    });
    expect(precipitateTint(f, rgb)).toBe(precipitateOpacity(50));
    expect(PRECIPITATES[2]?.colour).toBe('yellow');
    expect(rgb[0]).toBeGreaterThan(rgb[2]); // AgI is yellow: more red than blue
    expect(precipitateTint(frame(['product'], { sample: { product: 0 } }), rgb)).toBe(0); // none formed
  });
});

describe('what a vessel holds', () => {
  it('is its own sample plus what has run in; the model volume where it has none', () => {
    expect(contentsMl(frame(['volume'], { parameters: { acidVolume: 25 } }))).toBe(25);
    expect(
      contentsMl(frame(['volume'], { parameters: { acidVolume: 25 }, sample: { volume: 12.5 } })),
    ).toBe(37.5);
    expect(
      contentsMl(
        frame(['volumeAdded'], { parameters: { sampleVolume: 3 }, sample: { volumeAdded: 2 } }),
      ),
    ).toBe(5);
    expect(contentsMl(frame(['volume'], { sample: { volume: 40 } }))).toBe(40);
    expect(contentsMl(frame(['volume']))).toBeNaN();
    // A volume the piece does not list is not drawn.
    expect(
      contentsMl(frame([], { parameters: { acidVolume: 25 }, sample: { volume: 12.5 } })),
    ).toBe(25);
  });

  it('counts solid as a share of what was weighed, and none without numbers', () => {
    expect(share(2, 8)).toBe(0.25);
    expect(share(NaN, 8)).toBe(0);
    expect(share(2, 0)).toBe(0);
    expect(share(9, 8)).toBe(1);
    // 10 g of KNO3 (solute 0): bulk 7.9 cm3 of the fullest bed's 100.5, 6 of its 80 grains.
    expect(
      bedOf(frame(['undissolved'], { parameters: { solute: 0 }, sample: { undissolved: 10 } })),
    ).toBe(6 / 80);
    expect(bedOf(frame(['undissolved']))).toBe(0);
    expect(
      crystalShare(
        frame(['crystalMass'], { parameters: { saltMass: 5 }, sample: { crystalMass: 1 } }),
      ),
    ).toBe(0.2);
    expect(crystalShare(frame(['crystalMass']))).toBe(0);
  });
});

describe('the burette and the electrode', () => {
  it('delivers what the model reports, nothing without a run', () => {
    expect(delivered(frame(['volume'], { sample: { volume: 12.4 } }))).toBe(12.4);
    expect(delivered(frame(['volumeAdded'], { sample: { volumeAdded: 3 } }))).toBe(3);
    expect(delivered(frame(['volume'], { sample: { volume: NaN } }))).toBe(0);
    expect(delivered(frame([], { sample: { volume: 12.4 } }))).toBe(0);
  });

  it('takes the smallest standard size holding the reagent volume', () => {
    expect(buretteScale({})).toBe(50);
    expect(buretteScale({ reagentVolume: 10 })).toBe(10);
    expect(buretteScale({ reagentVolume: 11 })).toBe(25);
    expect(buretteScale({ reagentVolume: 60 })).toBe(50);
  });

  it('lowers with the time immersed over the settling time', () => {
    const at = (t: number) =>
      electrodeDepth(
        frame(['immersionTime'], {
          status: 'running',
          parameters: { readTime: 30 },
          sample: { immersionTime: t },
        }),
      );
    expect(at(0)).toBe(0);
    expect(at(15)).toBe(0.5);
    expect(at(99)).toBe(1);
    expect(electrodeDepth(frame(['immersionTime']))).toBe(0);
  });
});

describe('the setup at a piece', () => {
  const step = (id: string, onto: string, done: boolean, place = 'material') => ({
    step: { id, onto, place },
    done,
  });

  it('says whether a step onto it applies and is done', () => {
    expect(intoState(frame([]), 'flask')).toBe(NO_STEPS);
    expect(intoState(frame([], { setup: [step('a', 'flask', false)] }), 'flask')).toBe(PENDING);
    expect(
      intoState(
        frame([], { setup: [step('a', 'flask', false), step('b', 'flask', true)] }),
        'flask',
      ),
    ).toBe(DONE);
    expect(intoState(frame([], { setup: [step('a', 'other', true)] }), 'flask')).toBe(NO_STEPS);
  });

  it('knows a pipette that holds something is emptied when the step that moves it on is done', () => {
    const fetch = step('fetch', 'pipette', true);
    expect(emptied(frame([], { setup: [fetch] }), 'pipette')).toBe(false);
    expect(
      emptied(frame([], { setup: [fetch, step('pour', 'flask', false, 'pipette')] }), 'pipette'),
    ).toBe(false);
    expect(
      emptied(frame([], { setup: [fetch, step('pour', 'flask', true, 'pipette')] }), 'pipette'),
    ).toBe(true);
  });
});

describe('a universal indicator colour families', () => {
  it('run red to violet across the chart', () => {
    expect([0, 3, 5.6, 7, 9, 12].map(chartFamily)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
