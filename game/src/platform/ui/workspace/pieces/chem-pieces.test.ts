import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  conicalFlaskLevel,
  FLASKS,
  flaskLevel,
  iceHeight,
  indicatorFor,
  indicatorTint,
  linearCss,
  waterLevel,
  WATER,
} from '../../../labVisuals/chemistry';
import { vi } from 'vitest';
import { byClass, findAll, installDom, totalListeners } from '../testing/chemDom';
import { definitionOf, mountPiece, piece, stationView } from '../testing/chemFixtures';
import { CHEM_PIECES, pieces } from './chem-pieces';

// The Chemistry piece views against fake station views: that they draw what the model gives
// (through the shared maps), look idle without a run, write only what changed, send commands the
// station can refuse, and release everything.

const titration = definitionOf('acid-base-titration');
const kinetics = definitionOf('reaction-rate');
const heating = definitionOf('heating-curve');

beforeEach(() => installDom());
afterEach(() => vi.unstubAllGlobals());

const num = (node: { getAttribute(n: string): string | null }, name: string) =>
  Number(node.getAttribute(name));

describe('the Chemistry piece registry', () => {
  it('registers every kind the design lists, for the host to read as `pieces`', () => {
    expect(pieces).toBe(CHEM_PIECES);
    const kinds = [
      'vessel',
      'conical-flask',
      'beaker',
      'volumetric-flask',
      'boiling-tube',
      'evaporating-dish',
      'cuvette',
      'burette',
      'pipette',
      'reagent-rack',
      'wash-bottle',
      'filter-funnel',
      'hot-plate',
      'balance',
      'ph-meter',
      'colorimeter',
      'timer',
      'stopwatch',
      'thermometer',
      'water-bath',
      'spotting-tile',
      'retort-stand',
      'periodic-table',
    ];
    expect(Object.keys(CHEM_PIECES).sort()).toEqual(kinds.sort());
  });

  it('mounts, shows an idle look without a run, and releases everything', () => {
    for (const [kind, factory] of Object.entries(CHEM_PIECES)) {
      const owns = kind === 'reagent-rack' ? ['endpointPH'] : [];
      const m = mountPiece(factory, piece(kind, [], owns));
      m.view.update(stationView(titration, { status: 'configured' }));
      m.view.update(stationView(titration, { status: 'configured' }));
      // Displays hold a dash and colours have no name: no number before a run.
      for (const lcd of byClass(m.root, 'chem-lcd-text')) {
        expect(lcd.textContent, kind).toBe('–');
      }
      for (const twin of byClass(m.root, 'chem-twin')) {
        expect(twin.textContent, kind).not.toMatch(/\d/);
      }
      m.view.dispose();
      expect(m.root.children, kind).toHaveLength(0);
      expect(totalListeners(m.root as never), kind).toBe(0);
    }
  });
});

describe('a vessel', () => {
  const flask = () =>
    mountPiece(
      CHEM_PIECES['conical-flask']!,
      piece('conical-flask', [{ variable: 'pH' }, { variable: 'volume' }]),
    );
  const liquid = (m: ReturnType<typeof flask>) => byClass(m.root, 'chem-liquid')[0]!;
  const PARAMS = { acidVolume: 25, endpointPH: 4.4 };

  it('holds the acid sample plus what has run in, at the shared level', () => {
    const m = flask();
    m.view.update(stationView(titration, { parameters: PARAMS }));
    expect(num(liquid(m), 'height') / 1000).toBeCloseTo(conicalFlaskLevel(25), 6);
    m.view.update(
      stationView(titration, {
        status: 'running',
        parameters: PARAMS,
        sample: { volume: 12.4, pH: 3.9 },
      }),
    );
    expect(num(liquid(m), 'height') / 1000).toBeCloseTo(conicalFlaskLevel(37.4), 6);
  });

  it('tints it with the indicator the endpoint names, at the model’s pH, and says so in words', () => {
    const m = flask();
    m.view.update(
      stationView(titration, {
        status: 'running',
        parameters: PARAMS,
        sample: { volume: 12.4, pH: 3.9 },
      }),
    );
    const T: [number, number, number] = [0, 0, 0];
    indicatorTint(indicatorFor(4.4), 3.9, T);
    expect(liquid(m).getAttribute('fill')).toBe(linearCss(T));
    const twin = byClass(m.root, 'chem-twin')[0]!.textContent;
    expect(twin).toContain('Methyl orange');
    expect(twin).toContain('colour changing');
  });

  it('is clear and unnamed before a run, and when the model has no value', () => {
    const m = flask();
    m.view.update(stationView(titration, { parameters: PARAMS }));
    expect(liquid(m).getAttribute('fill')).toBe(linearCss(WATER));
    m.view.update(
      stationView(titration, {
        status: 'running',
        parameters: PARAMS,
        sample: { volume: NaN, pH: NaN },
      }),
    );
    expect(liquid(m).getAttribute('fill')).toBe(linearCss(WATER));
    expect(num(liquid(m), 'height') / 1000).toBeCloseTo(conicalFlaskLevel(25), 6);
    expect(byClass(m.root as never, 'chem-twin')[0]!.textContent).toBe('');
  });

  it('draws only the variables its piece lists', () => {
    const m = mountPiece(
      CHEM_PIECES['conical-flask']!,
      piece('conical-flask', [{ variable: 'volume' }]),
    );
    m.view.update(
      stationView(titration, {
        status: 'running',
        parameters: PARAMS,
        sample: { volume: 12.4, pH: 3.9 },
      }),
    );
    expect(liquid(m).getAttribute('fill')).toBe(linearCss(WATER)); // pH not listed: no tint
  });

  it('holds nothing until the step that puts the acid in is done', () => {
    const m = flask();
    const step = { id: 'acid', onto: 'conical-flask' };
    m.view.update(stationView(titration, { parameters: PARAMS, setup: [{ step, done: false }] }));
    expect(num(liquid(m), 'height')).toBe(0);
    m.view.update(stationView(titration, { parameters: PARAMS, setup: [{ step, done: true }] }));
    expect(num(liquid(m), 'height') / 1000).toBeCloseTo(conicalFlaskLevel(25), 6);
  });

  it('writes nothing again for an unchanged view', () => {
    const m = flask();
    const view = stationView(titration, {
      status: 'running',
      parameters: PARAMS,
      sample: { volume: 12.4, pH: 3.9 },
    });
    m.view.update(view);
    const writes = findAll(m.root as never, () => true).reduce((n, node) => n + node.writes, 0);
    m.view.update(view);
    m.view.update(view);
    expect(findAll(m.root as never, () => true).reduce((n, node) => n + node.writes, 0)).toBe(
      writes,
    );
  });

  it('draws the volumetric flask the final-volume setting names, to the shared level', () => {
    const m = mountPiece(
      CHEM_PIECES['volumetric-flask']!,
      piece('volumetric-flask', [{ variable: 'volume' }]),
    );
    const dilution = definitionOf('acid-base-titration'); // any definition: only the pose is read
    m.view.update(
      stationView(dilution, {
        status: 'running',
        parameters: { finalVolume: 100 },
        sample: { volume: 40 },
      }),
    );
    const shown = findAll(m.root, (n) => n.tag === 'g' && n.getAttribute('display') === 'inline');
    expect(shown).toHaveLength(1);
    const flask100 = FLASKS[2];
    const rects = byClass(shown[0]!, 'chem-liquid');
    expect(num(rects[0]!, 'height') / 1000).toBeCloseTo(flaskLevel(flask100, 40), 6);
  });

  it('draws the ice and meltwater of a heating curve by mass', () => {
    const m = mountPiece(
      CHEM_PIECES.beaker!,
      piece('beaker', [
        { variable: 'waterMass' },
        { variable: 'iceFraction' },
        { variable: 'state' },
      ]),
    );
    m.view.update(stationView(heating, { parameters: { mass: 0.2, startTemperature: -10 } }));
    const ice = () => byClass(m.root, 'chem-ice')[0]!;
    expect(num(ice(), 'height') / 1000).toBeCloseTo(iceHeight(0.2), 6);
    expect(num(byClass(m.root as never, 'chem-liquid')[0]!, 'height')).toBe(0);
    m.view.update(
      stationView(heating, {
        status: 'running',
        parameters: { mass: 0.2 },
        sample: { waterMass: 0.1, iceFraction: 0.5, state: 1 },
      }),
    );
    expect(num(byClass(m.root as never, 'chem-liquid')[0]!, 'height') / 1000).toBeCloseTo(
      waterLevel(0.1),
      6,
    );
    expect(num(ice(), 'height') / 1000).toBeCloseTo(iceHeight(0.1), 6);
  });
});

describe('a burette', () => {
  const make = (refuse: Record<string, string | null> = {}) =>
    mountPiece(CHEM_PIECES.burette!, piece('burette', [{ variable: 'volume' }]), refuse);
  const column = (m: ReturnType<typeof make>) => byClass(m.root, 'chem-liquid')[0]!;

  it('is full to the 0 mark without a run, and falls with the volume delivered', () => {
    const m = make();
    m.view.update(stationView(titration, { parameters: { flowRate: 0.25 } }));
    expect(num(column(m), 'y')).toBe(26);
    m.view.update(
      stationView(titration, {
        status: 'running',
        parameters: { flowRate: 0.25 },
        sample: { volume: 12.4 },
      }),
    );
    expect(num(column(m), 'y')).toBeCloseTo(26 + (12.4 / 50) * 240, 2);
  });

  it('opens the tap and drops only while the run goes, at the model’s flow', () => {
    const m = make();
    const drop = byClass(m.root, 'chem-drop')[0]!;
    m.view.update(stationView(titration, { parameters: { flowRate: 0.25 } }));
    expect(drop.getAttribute('display')).toBe('none');
    m.view.update(
      stationView(titration, {
        status: 'running',
        parameters: { flowRate: 0.25 },
        sample: { volume: 1 },
      }),
    );
    expect(drop.getAttribute('display')).toBe('inline');
    expect(drop.getAttribute('style')).toBe('animation-duration:0.2s');
  });

  it('sends run or stop from its tap button, and not when the station would refuse', () => {
    const m = make();
    const buttons = () =>
      findAll(m.root, (n) => n.tag === 'button' && n.className === 'chem-button');
    m.view.update(stationView(titration, { parameters: {} }));
    buttons()[0]!.dispatch('click');
    expect(m.sent).toEqual([{ command: 'run' }]);

    const refused = make({ run: 'Put the flask under the tip first.' });
    refused.view.update(stationView(titration, { parameters: {} }));
    const button = findAll(refused.root, (n) => n.tag === 'button')[0]!;
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(byClass(refused.root as never, 'chem-reason')[0]!.textContent).toBe(
      'Put the flask under the tip first.',
    );
    button.dispatch('click');
    expect(refused.sent).toEqual([]);
  });

  it('enables its button again once a changed setting makes the run allowed', () => {
    const m = make({ run: 'Choose the indicator first.' });
    const button = () => findAll(m.root, (n) => n.tag === 'button')[0]!;
    m.view.update(stationView(titration, { parameters: { flowRate: 0.25 } }));
    expect(button().getAttribute('aria-disabled')).toBe('true');
    m.refuse.run = null;
    m.view.update(stationView(titration, { parameters: { flowRate: 0.5 } }));
    expect(button().getAttribute('aria-disabled')).toBe('false');
  });

  it('draws a delivery beyond its scale on the next size up, not clipped', () => {
    const m = make();
    const dilute = { ...titration, initialConditions: { reagentVolume: 10 } };
    m.view.update(
      stationView(dilute, { status: 'running', parameters: {}, sample: { volume: 30 } }),
    );
    expect(num(column(m), 'y')).toBeCloseTo(26 + (30 / 50) * 240, 2);
  });

  it('sizes its scale to the reagent volume the definition names', () => {
    const m = make();
    const dilute = { ...titration, initialConditions: { reagentVolume: 10 } };
    m.view.update(
      stationView(dilute, { status: 'running', parameters: {}, sample: { volume: 5 } }),
    );
    expect(num(column(m), 'y')).toBeCloseTo(26 + (5 / 10) * 240, 2);
  });
});

describe('instruments', () => {
  it('a colorimeter lights while running and shows the dye at the model’s absorbance', () => {
    const m = mountPiece(
      CHEM_PIECES.colorimeter!,
      piece('colorimeter', [{ variable: 'absorbance' }]),
    );
    const lamp = byClass(m.root, 'chem-lamp')[0]!;
    const [absorbance] = byClass(m.root, 'chem-lcd-text');
    m.view.update(stationView(kinetics, { status: 'configured' }));
    expect(lamp.getAttribute('data-on')).toBe('0');
    expect(absorbance!.textContent).toBe('–');
    m.view.update(stationView(kinetics, { status: 'running', sample: { absorbance: 0.5 } }));
    expect(lamp.getAttribute('data-on')).toBe('1');
    expect(absorbance!.textContent).toBe('0.500');
  });

  it('a timer shows a dash before a run and whole steps of its resolution while running', () => {
    const m = mountPiece(
      CHEM_PIECES.timer!,
      piece('timer', [{ variable: 'elapsed' }], ['timerResolution']),
    );
    const [clock] = byClass(m.root, 'chem-lcd-text');
    m.view.update(stationView(kinetics, { parameters: { timerResolution: 0.1 } }));
    expect(clock!.textContent).toBe('–');
    m.view.update(
      stationView(kinetics, {
        status: 'running',
        parameters: { timerResolution: 0.1 },
        sample: { elapsed: 12.37 },
      }),
    );
    expect(clock!.textContent).toBe('12.3');
  });

  it('a hot plate glows while running and shows the setting it owns', () => {
    const m = mountPiece(CHEM_PIECES['hot-plate']!, piece('hot-plate', [], ['power']));
    const plate = byClass(m.root, 'chem-plate')[0]!;
    m.view.update(stationView(heating, { dials: { power: 500 } }));
    expect(plate.getAttribute('data-on')).toBe('0');
    expect(byClass(m.root as never, 'chem-lcd-text')[0]!.textContent).toBe('500 W');
    m.view.update(
      stationView(heating, {
        status: 'running',
        dials: { power: 500 },
        parameters: { power: 500 },
      }),
    );
    expect(plate.getAttribute('data-on')).toBe('1');
  });

  it('a pH meter lowers its electrode with the time immersed and reads to its resolution', () => {
    const m = mountPiece(
      CHEM_PIECES['ph-meter']!,
      piece(
        'ph-meter',
        [{ variable: 'reading' }, { variable: 'immersionTime' }],
        ['meterResolution'],
      ),
    );
    const params = { meterResolution: 0.01, readTime: 30 };
    const probe = findAll(m.root, (n) => n.tag === 'g')[0]!;
    m.view.update(stationView(kinetics, { parameters: params }));
    expect(probe.getAttribute('transform')).toBe('translate(0 0)');
    m.view.update(
      stationView(kinetics, {
        status: 'running',
        parameters: params,
        sample: { immersionTime: 15, reading: 4.7634 },
      }),
    );
    expect(probe.getAttribute('transform')).toBe('translate(0 30)');
    expect(byClass(m.root as never, 'chem-lcd-text')[0]!.textContent).toBe('4.76');
  });

  it('a thermometer’s column follows the temperature, from the setting before a run', () => {
    const m = mountPiece(
      CHEM_PIECES.thermometer!,
      piece('thermometer', [{ variable: 'temperature' }]),
    );
    const mercury = byClass(m.root, 'chem-mercury')[0]!;
    m.view.update(stationView(heating, { parameters: { startTemperature: -30 } }));
    expect(num(mercury, 'height')).toBe(8);
    m.view.update(
      stationView(heating, { status: 'running', parameters: {}, sample: { temperature: 110 } }),
    );
    expect(num(mercury, 'height')).toBe(208);
  });
});

describe('a spotting tile', () => {
  it('shows the universal indicator at the model’s pH, named in words, and nothing without a run', () => {
    const m = mountPiece(
      CHEM_PIECES['spotting-tile']!,
      piece('spotting-tile', [{ variable: 'pH' }]),
    );
    const drop = byClass(m.root, 'chem-liquid')[0]!;
    const twin = byClass(m.root, 'chem-twin')[0]!;
    m.view.update(stationView(kinetics, {}));
    expect(drop.getAttribute('display')).toBe('none');
    expect(twin.textContent).toBe('');
    m.view.update(stationView(kinetics, { status: 'running', sample: { pH: 7.2 } }));
    expect(drop.getAttribute('display')).toBe('inline');
    expect(twin.textContent).toBe('Universal indicator: green (a guide to about 1 pH)');
  });
});

describe('a reagent rack', () => {
  it('stands one bottle per preset of the parameter it owns and chooses by click, if allowed', () => {
    const m = mountPiece(CHEM_PIECES['reagent-rack']!, piece('reagent-rack', [], ['endpointPH']));
    m.view.update(stationView(titration, { dials: { endpointPH: 8.2 } }));
    const bottles = byClass(m.root, 'chem-bottle');
    expect(bottles).toHaveLength(2);
    bottles[0]!.dispatch('click');
    expect(m.sent).toEqual([{ command: 'set', parameter: 'endpointPH', value: 4.4 }]);

    const refused = mountPiece(
      CHEM_PIECES['reagent-rack']!,
      piece('reagent-rack', [], ['endpointPH']),
      {
        set: 'Stop the run before changing its parameters.',
      },
    );
    refused.view.update(stationView(titration, { dials: { endpointPH: 8.2 } }));
    byClass(refused.root, 'chem-bottle')[0]!.dispatch('click');
    expect(refused.sent).toEqual([]);
    const reasons = byClass(refused.root, 'chem-reason');
    expect(reasons[reasons.length - 1]!.textContent).toBe(
      'Stop the run before changing its parameters.',
    );
  });
});

describe('a setup step at its piece', () => {
  it('is a button that sends the step, pressed once done', () => {
    const m = mountPiece(CHEM_PIECES.pipette!, piece('pipette', [], ['acidVolume']));
    const setup = [{ step: { id: 'fetch', onto: 'pipette' }, done: false }];
    m.view.update(stationView(titration, { parameters: { acidVolume: 25 }, setup }));
    const button = findAll(m.root, (n) => n.className === 'chem-step')[0]!;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.dispatch('click');
    expect(m.sent).toEqual([{ command: 'setup', step: 'fetch' }]);
    m.view.update(
      stationView(titration, {
        parameters: { acidVolume: 25 },
        setup: [{ ...setup[0]!, done: true }],
      }),
    );
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('an instrument reading after the run', () => {
  const run = {
    runId: 'r1',
    status: 'completed',
    results: { 'endpoint-volume': 21.2507 },
    inputs: { resolution: 0.05 },
  };

  it('shows the reading to the resolution, only once the run completed', () => {
    const m = mountPiece(
      CHEM_PIECES.colorimeter!,
      piece('colorimeter', [{ instrument: 'endpoint-volume' }]),
    );
    const shown = () => byClass(m.root, 'chem-lcd-text')[1]!.textContent;
    m.view.update(
      stationView(titration, { status: 'running', run: { ...run, status: 'running' } }),
    );
    expect(shown()).toBe('–');
    m.view.update(stationView(titration, { status: 'completed', run }));
    expect(shown()).toBe('21.25');
    m.view.update(stationView(titration, { status: 'configured' }));
    expect(shown()).toBe('–');
  });

  it('never reads out an answer the student works out', () => {
    const answer = {
      ...titration,
      results: titration.results.map((r) => ({ ...r, answer: { proportionalTo: 'x' } })),
    };
    const m = mountPiece(
      CHEM_PIECES.colorimeter!,
      piece('colorimeter', [{ instrument: 'endpoint-volume' }]),
    );
    m.view.update(stationView(answer, { status: 'completed', run }));
    expect(byClass(m.root, 'chem-lcd-text')[1]!.textContent).toBe('–');
  });

  it('never draws a variable that holds an answer', () => {
    const m = mountPiece(
      CHEM_PIECES['conical-flask']!,
      piece('conical-flask', [{ variable: 'inferredAcidConcentration' }, { variable: 'pH' }]),
    );
    const f = byClass(m.root, 'chem-liquid')[0]!;
    m.view.update(
      stationView(titration, {
        status: 'running',
        parameters: { acidVolume: 25, endpointPH: 8.2 },
        sample: { pH: 9.4, inferredAcidConcentration: 0.085 },
      }),
    );
    expect(f.getAttribute('fill')).not.toBe(linearCss(WATER)); // the pH is shown
    expect(m.root.textContent).not.toContain('0.085');
  });
});
