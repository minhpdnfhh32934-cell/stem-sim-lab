import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../core/EventBus';
import { ENGLISH } from '../../../core/i18n';
import { Logger } from '../../../core/Logger';
import type { GameEvents } from '../../../game/GameEvents';
import type { StationCommand } from '../../../gameplay/experiment/StationSystem';
import type { ExperimentWorkspace } from '../../../simulation/experiment';
import { WorkspaceController } from './controller';
import { libraryItems } from './state';
import { WORKSPACE, viewWith } from './workspaceFixture';

/** A controller on a bus, over a station that refuses what `refused` names (by command or step). */
function setup(options: { done?: string[]; refused?: Record<string, string> } = {}) {
  const events = new EventBus<GameEvents>(Logger.create('error', () => undefined));
  const sent: GameEvents['ExperimentCommand'][] = [];
  events.subscribe('ExperimentCommand', (c) => sent.push(c));
  let closed = 0;
  let views = 0;
  const controller = new WorkspaceController(
    {
      events,
      texts: ENGLISH,
      stations: {
        view: () => {
          views++;
          return viewWith(options.done ?? []);
        },
        refusal: (_id: string, command: StationCommand, parameter?: string) =>
          options.refused?.[`${command}:${parameter ?? ''}`] ?? options.refused?.[command] ?? null,
      },
      closeWorkspace: () => {
        closed++;
        return true;
      },
    },
    'lab/titration',
    WORKSPACE,
  );
  const item = (id: string) => libraryItems(WORKSPACE).find((i) => i.id === id)!;
  const piece = (id: string) => WORKSPACE.pieces.find((p) => p.id === id)!;
  return { events, controller, sent, item, piece, closed: () => closed, views: () => views };
}

describe('Esc', () => {
  it('closes the innermost layer, then the workspace', () => {
    const { controller, item, piece, closed } = setup();
    controller.select('flask'); // callout
    controller.hold(item('naoh')); // placing, over the callout
    controller.open('results');
    expect(controller.escape()).toBe(true); // results
    expect(controller.layers.has('results')).toBe(false);
    expect(controller.escape()).toBe(true); // placing: the item goes back
    expect(controller.held).toBeNull();
    expect(controller.selected).toBe('flask');
    expect(controller.escape()).toBe(true); // callout
    expect(controller.selected).toBeNull();
    expect(closed()).toBe(0);
    expect(controller.escape()).toBe(false); // nothing open: leaves the workspace
    expect(closed()).toBe(1);
    expect(piece('flask').id).toBe('flask');
  });

  it('selecting the selected piece again puts its callout away', () => {
    const { controller } = setup();
    controller.select('flask');
    controller.select('flask');
    expect(controller.selected).toBeNull();
    expect(controller.layers.top).toBeNull();
  });
});

describe('placing a library item', () => {
  it('sends the setting and the step it means, and puts the item down', () => {
    const { controller, item, piece, sent } = setup();
    controller.hold(item('naoh'));
    controller.choose(piece('burette'));
    expect(sent).toEqual([
      { stationId: 'lab/titration', command: 'set', parameter: 'titrant', value: 0.1 },
      { stationId: 'lab/titration', command: 'setup', step: 'fill' },
    ]);
    expect(controller.held).toBeNull();
    expect(controller.layers.has('placing')).toBe(false);
    expect(controller.announcement).toBe('NaOH 0.1 mol/L placed on Burette.');
  });

  it('sends nothing and says why when the station would refuse the step', () => {
    const { controller, item, piece, sent } = setup({
      refused: { 'setup:fill': 'Clamp the burette on the stand first.' },
    });
    controller.hold(item('naoh'));
    controller.choose(piece('burette'));
    expect(sent).toEqual([]);
    expect(controller.blocked).toBe('Clamp the burette on the stand first.');
    expect(controller.held?.id).toBe('naoh'); // still in hand to try elsewhere
  });

  it('refuses a piece that does not take the item with the step’s own reason', () => {
    const { controller, item, piece, sent } = setup();
    controller.hold(item('naoh'));
    controller.choose(piece('flask'));
    expect(sent).toEqual([]);
    expect(controller.blocked).toBe('The burette holds the titrant, NaOH, in this experiment.');
  });

  it('uses a generic reason when no step places the item', () => {
    const { controller, piece, sent } = setup();
    // The stand is equipment nothing places; no setup step names it.
    controller.hold({ kind: 'equipment', id: 'stand', piece: piece('stand') });
    controller.choose(piece('flask'));
    expect(sent).toEqual([]);
    expect(controller.blocked).toBe('Stand does not go on Flask.');
  });

  it('chooses a piece, without an item in hand, by selecting it', () => {
    const { controller, piece, sent } = setup();
    controller.choose(piece('burette'));
    expect(controller.selected).toBe('burette');
    expect(sent).toEqual([]);
  });
});

describe('refusals', () => {
  it('shows the station’s refusal of this station until something changes', () => {
    const { controller, events } = setup();
    controller.take();
    events.publish('ActionBlocked', { entityId: 'other', actionId: 'run', reason: 'not mine' });
    expect(controller.blocked).toBeNull();
    events.publish('ActionBlocked', {
      entityId: 'lab/titration',
      actionId: 'run',
      reason: 'Put the flask under the burette tip first.',
    });
    expect(controller.blocked).toBe('Put the flask under the burette tip first.');
    expect(controller.take()).toBe(true);
    events.publish('ExperimentStationChanged', { stationId: 'lab/titration' });
    expect(controller.blocked).toBeNull();
  });

  it('opens the results when the station says they were asked for', () => {
    const { controller, events } = setup();
    events.publish('ExperimentResultsViewed', { stationId: 'lab/titration' });
    expect(controller.layers.top).toBe('results');
  });

  it('sends commands under its own station and asks the station why before a control is used', () => {
    const { controller, sent } = setup({ refused: { run: 'Not ready.' } });
    controller.send({ command: 'run' });
    expect(sent).toEqual([{ stationId: 'lab/titration', command: 'run' }]);
    expect(controller.refusal('run')).toBe('Not ready.');
    expect(controller.refusal('stop')).toBeNull();
  });
});

describe('redrawing', () => {
  it('reports a change once, and looks at nothing while nothing changed', () => {
    const { controller, events, views } = setup();
    expect(controller.take()).toBe(true); // the first draw
    for (let i = 0; i < 1000; i++) expect(controller.take()).toBe(false);
    expect(views()).toBe(0); // idle frames never describe the station
    events.publish('ExperimentStationChanged', { stationId: 'lab/titration' });
    expect(controller.take()).toBe(true);
    expect(controller.take()).toBe(false);
  });

  it('ignores another station, and everything once disposed', () => {
    const { controller, events } = setup();
    controller.take();
    events.publish('ExperimentStationChanged', { stationId: 'elsewhere' });
    expect(controller.take()).toBe(false);
    controller.dispose();
    events.publish('ExperimentStationChanged', { stationId: 'lab/titration' });
    expect(controller.take()).toBe(false);
  });
});

describe('placing a material whose step applies only once it is chosen (`when`)', () => {
  // The burette's fill step is for 0.2 mol/L only; the station lists it once that is set.
  const WHEN: ExperimentWorkspace = {
    ...WORKSPACE,
    materials: [
      ...WORKSPACE.materials,
      {
        id: 'naoh-02',
        kind: 'solution',
        label: 'NaOH 0.2 mol/L',
        sets: { parameter: 'titrant', value: 0.2 },
      },
    ],
    setup: [
      ...WORKSPACE.setup,
      {
        id: 'fill-02',
        instruction: 'Fill the burette with 0.2 mol/L NaOH.',
        refusal: 'Fill the burette first.',
        place: 'naoh-02',
        onto: 'burette',
        after: ['clamp'],
        phase: 'before-run',
        when: { parameter: 'titrant', values: [0.2] },
      },
    ],
  };

  function place(done: string[], workspace: ExperimentWorkspace = WHEN) {
    const events = new EventBus<GameEvents>(Logger.create('error', () => undefined));
    const sent: GameEvents['ExperimentCommand'][] = [];
    events.subscribe('ExperimentCommand', (c) => sent.push(c));
    const controller = new WorkspaceController(
      {
        events,
        texts: ENGLISH,
        stations: {
          // The station does not know the step yet: it would call it unknown.
          view: () => viewWith(done),
          refusal: (_id: string, command: StationCommand) =>
            command === 'setup' ? 'There is no such step at this apparatus.' : null,
        },
        closeWorkspace: () => true,
      },
      'lab/titration',
      workspace,
    );
    controller.hold(libraryItems(workspace).find((i) => i.id === 'naoh-02')!);
    controller.choose(workspace.pieces.find((p) => p.id === 'burette')!);
    return { controller, sent };
  }

  it('sets it and does the step, which the station lists once the set is done', () => {
    const { controller, sent } = place(['clamp']);
    expect(controller.blocked).toBeNull();
    expect(sent).toEqual([
      { stationId: 'lab/titration', command: 'set', parameter: 'titrant', value: 0.2 },
      { stationId: 'lab/titration', command: 'setup', step: 'fill-02' },
    ]);
  });

  it('still says what the step waits for, and sends nothing', () => {
    const { controller, sent } = place([]);
    expect(controller.blocked).toBe('Clamp the burette on the stand first.');
    expect(sent).toEqual([]);
  });

  it('also waits for an earlier step that applies only once the same material is chosen', () => {
    const rinse = {
      id: 'rinse-02',
      instruction: 'Rinse the burette with 0.2 mol/L NaOH.',
      refusal: 'Rinse the burette first.',
      place: 'burette',
      onto: 'stand',
      after: ['clamp'],
      phase: 'before-run' as const,
      when: { parameter: 'titrant', values: [0.2] },
    };
    const [fill] = WHEN.setup.slice(-1);
    const workspace = {
      ...WHEN,
      setup: [...WHEN.setup.slice(0, -1), rinse, { ...fill!, after: ['rinse-02'] }],
    };
    const { controller, sent } = place(['clamp'], workspace);
    expect(controller.blocked).toBe('Rinse the burette first.');
    expect(controller.announcement).toBeNull();
    expect(sent).toEqual([]);
  });
});
