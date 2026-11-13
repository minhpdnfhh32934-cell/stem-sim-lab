import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bundledContent } from '../../../content';
import type { Game } from '../../../game/Game';
import { bootTestGame, withTitrationWorkspace } from '../../../game/testing';
import type { BenchView } from '../../../gameplay/experiment/StationSystem';
import { WorkspaceController } from './controller';
import { WORKSPACE_PIECES } from './registry';
import { libraryItems } from './state';
import { byClass, FakeNode, installDom, totalListeners } from './testing/chemDom';

// The shipped Chemistry workspaces at a real station, driven by the host's own controller: a
// library item is held and a piece chosen, as a click does, and the station answers. Nothing here
// draws; the controller sends the commands and shows the station's refusals.

const LAB = 'chemistry-lab';

async function bench(stationId: string) {
  const { game } = await bootTestGame({
    content: withTitrationWorkspace(structuredClone(bundledContent)),
  });
  await game.newGame('researcher-male');
  await game.scenes.load(LAB);
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  const view = (): BenchView => {
    const v = game.stations.view(stationId);
    if (v?.kind !== 'bench') throw new Error(`${stationId} is not a bench station`);
    return v;
  };
  const workspace = view().definition.workspace!;
  const controller = new WorkspaceController(
    {
      events: game.events,
      texts: game.texts,
      stations: game.stations,
      closeWorkspace: () => game.workspace.close(),
    },
    stationId,
    workspace,
  );
  /** Picks up a library item and chooses a piece; returns what the host would show, or null. */
  const place = (itemId: string, pieceId: string): string | null => {
    controller.hold(libraryItems(workspace).find((i) => i.id === itemId)!);
    controller.choose(workspace.pieces.find((p) => p.id === pieceId)!);
    const blocked = controller.blocked;
    controller.hold(null);
    return blocked;
  };
  return { game, view, place, controller, workspace };
}

const settings = (game: Game, id: string) => {
  const v = game.stations.view(id);
  return v?.kind === 'bench' ? v.session.parameters : {};
};

describe('titration workspace', () => {
  const STAND = `${LAB}/titration`;

  it('is set up by placing the burette, the bottles and the flask; a wrong place is refused with the reason', async () => {
    const { game, view, place } = await bench(STAND);
    // Too early: nothing changes, the reason is the step it waits for (filled before it is
    // clamped: Phú, 2026-11-03).
    expect(place('burette', 'stand')).toBe(
      'The burette holds the titrant, NaOH, in this experiment: fill it first.',
    );
    expect(settings(game, STAND)).toMatchObject({ baseConcentration: 0.1 });
    expect(place('flask', 'stand')).toBe(
      'The burette holds the titrant, NaOH, in this experiment: fill it first.',
    );
    // The wrong piece: the step's own reason.
    expect(place('naoh-02', 'flask')).toBe(
      'The burette holds the titrant, NaOH, in this experiment: fill it first.',
    );

    expect(place('naoh-02', 'burette')).toBeNull(); // sets 0.2 mol/L and fills with it
    expect(settings(game, STAND)).toMatchObject({ baseConcentration: 0.2 });
    expect(view().setup.map((s) => [s.step.id, s.done])).toContainEqual(['fill-02', true]);
    expect(place('burette', 'stand')).toBeNull();
    expect(place('flask', 'stand')).toBe('The pipette takes the HCl solution: draw it up first.');
    expect(place('hcl', 'pipette')).toBeNull();
    expect(place('pipette', 'flask')).toBeNull();
    expect(place('methyl-orange', 'flask')).toBeNull(); // sets the endpoint at pH 4.4 and adds it
    expect(settings(game, STAND)).toMatchObject({ endpointPH: 4.4 });
    expect(view().session.state).toBe('idle');
    expect(place('flask', 'stand')).toBeNull();
    expect(view().session.state).toBe('configured');
    expect(view().runBlock).toBeNull();
    game.events.publish('ExperimentCommand', { stationId: STAND, command: 'run' });
    expect(view().session.state).toBe('running');
  });

  it('asks for the other bottle when the solution is changed, and says which', async () => {
    const { game, view, place } = await bench(STAND);
    for (const [item, piece] of [
      ['naoh-01', 'burette'],
      ['burette', 'stand'],
      ['hcl', 'pipette'],
      ['pipette', 'flask'],
      ['phenolphthalein', 'flask'],
      ['flask', 'stand'],
    ] as const) {
      expect(place(item, piece)).toBeNull();
    }
    expect(view().runBlock).toBeNull();
    // The burette's own control (a preset chip) changes the solution: it must be refilled.
    game.events.publish('ExperimentCommand', {
      stationId: STAND,
      command: 'set',
      parameter: 'baseConcentration',
      value: 0.05,
    });
    expect(view().runBlock).toBe(
      'The burette holds the titrant, NaOH, in this experiment: fill it first.',
    );
    expect(place('naoh-005', 'burette')).toBeNull();
    expect(view().runBlock).toBeNull();
  });
});

describe('reaction-rate workspace', () => {
  const COLORIMETER = `${LAB}/kinetics`;

  it('is set up by putting the flasks in the bath and the cuvette in the colorimeter', async () => {
    const { game, view, place } = await bench(COLORIMETER);
    expect(place('cuvette', 'bath')).toBe('Put the cuvette in the colorimeter slot first.');
    expect(place('dye-5', 'bath')).toBeNull();
    expect(place('naoh-025', 'bath')).toBeNull();
    expect(settings(game, COLORIMETER)).toMatchObject({
      initialConcentration: 5e-6,
      naoh: 0.25,
    });
    expect(view().session.state).toBe('idle');
    expect(place('cuvette', 'colorimeter')).toBeNull();
    expect(view().session.state).toBe('configured');
    game.events.publish('ExperimentCommand', { stationId: COLORIMETER, command: 'run' });
    expect(view().session.state).toBe('running');
  });
});

describe('the pieces of the shipped Chemistry workspaces', () => {
  beforeEach(() => installDom());
  afterEach(() => vi.unstubAllGlobals());

  /** Mounts every piece of the station's workspace against the real station; draws on demand. */
  async function mounted(stationId: string) {
    const b = await bench(stationId);
    const roots = b.workspace.pieces.map((piece) => {
      const factory = WORKSPACE_PIECES[piece.kind];
      expect(factory, `a view for "${piece.kind}"`).toBeDefined();
      const view = factory!();
      const root = new FakeNode('div');
      view.mount(root as unknown as HTMLElement, {
        texts: b.game.texts,
        stationId,
        piece,
        send: (command) => b.game.events.publish('ExperimentCommand', { stationId, ...command }),
        refusal: (command, parameter, value) =>
          b.game.stations.refusal(stationId, command, parameter, value),
      });
      return { piece, view, root };
    });
    const draw = () => {
      const v = b.view();
      for (const r of roots) r.view.update(v);
    };
    const find = (pieceId: string, cls: string) =>
      byClass(roots.find((r) => r.piece.id === pieceId)!.root, cls)[0]!;
    const prepare = () => {
      for (const { step } of b.view().setup) {
        if (!b.view().setup.find((s) => s.step.id === step.id)?.done) {
          b.game.events.publish('ExperimentCommand', {
            stationId,
            command: 'setup',
            step: step.id,
          });
        }
      }
    };
    const send = (command: 'run' | 'stop' | 'reset') =>
      b.game.events.publish('ExperimentCommand', { stationId, command });
    const until = (done: () => boolean) => {
      for (let i = 0; !done() && i < 100_000; i++) {
        b.game.update(0.05);
        if (i % 20 === 0) draw();
      }
    };
    const dispose = () => {
      for (const r of roots) r.view.dispose();
      return roots.map((r) => totalListeners(r.root));
    };
    return { ...b, roots, draw, find, prepare, send, until, dispose };
  }

  it('the titration: the burette empties, the flask changes colour, every piece lets go', async () => {
    const t = await mounted(`${LAB}/titration`);
    t.draw();
    t.prepare();
    t.draw();
    const level = t.find('burette', 'chem-liquid');
    const liquid = t.find('flask', 'chem-liquid');
    const [y0, colour0] = [level.getAttribute('y'), liquid.getAttribute('fill')];
    t.send('run');
    t.until(() => t.view().session.state === 'completed');
    t.draw();
    expect(level.getAttribute('y')).not.toBe(y0);
    expect(liquid.getAttribute('fill')).not.toBe(colour0);
    expect(t.dispose().every((n) => n === 0)).toBe(true);
  });

  it('the reaction rate: the violet appears in the colorimeter and fades, every piece lets go', async () => {
    const t = await mounted(`${LAB}/kinetics`);
    t.draw();
    t.prepare();
    t.draw();
    const dye = t.find('colorimeter', 'chem-liquid');
    expect(dye.getAttribute('display')).toBe('none');
    t.send('run');
    for (let i = 0; i < 20; i++) t.game.update(0.05);
    t.draw();
    expect(dye.getAttribute('display')).toBe('inline');
    const dark = Number(dye.getAttribute('fill-opacity'));
    t.until(() => t.view().session.state === 'completed');
    t.draw();
    expect(Number(dye.getAttribute('fill-opacity'))).toBeLessThan(dark);
    expect(t.dispose().every((n) => n === 0)).toBe(true);
  });

  it('the heating curve: the plate glows while it runs and the thermometer rises, every piece lets go', async () => {
    const t = await mounted(`${LAB}/heating`);
    t.draw();
    const plate = t.find('plate', 'chem-plate');
    const column = t.find('thermometer', 'chem-mercury');
    expect(plate.getAttribute('data-on')).toBe('0');
    const rest = column.getAttribute('height');
    t.send('run');
    for (let i = 0; i < 200; i++) t.game.update(0.05);
    t.draw();
    expect(plate.getAttribute('data-on')).toBe('1');
    expect(column.getAttribute('height')).not.toBe(rest);
    t.until(() => t.view().session.state === 'completed');
    t.draw();
    expect(plate.getAttribute('data-on')).toBe('0');
    expect(t.dispose().every((n) => n === 0)).toBe(true);
  });
});
