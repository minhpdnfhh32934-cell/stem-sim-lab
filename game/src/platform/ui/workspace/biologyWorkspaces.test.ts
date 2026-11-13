import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import { bootTestGame } from '../../../game/testing';
import type { BenchView } from '../../../gameplay/experiment/StationSystem';
import { WorkspaceController } from './controller';
import { WORKSPACE_PIECES } from './registry';
import { libraryItems } from './state';

// The shipped Biology workspaces at a real station: every piece has a registered view, and the
// microscope is made up by the host's own controller (a library item held and a piece chosen, as a
// click does) while the station answers. Nothing here draws.

const LAB = 'biology-lab';
const SCOPE = `${LAB}/digital-microscope`;

async function bench(stationId: string) {
  const { game } = await bootTestGame({ content: bundledContent });
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
  return { game, view, place, workspace };
}

describe('the Biology workspaces', () => {
  it('draw every piece with a registered view, and the library lists only what the definition gives', async () => {
    const { game } = await bench(SCOPE);
    const shipped = ['microscope', 'osmosis', 'enzyme-activity', 'photosynthesis'];
    const presentations: string[] = [];
    for (const id of shipped) {
      const definition = game.content.experiments.get(id);
      presentations.push(definition.presentation);
      for (const piece of definition.workspace!.pieces) {
        expect(WORKSPACE_PIECES[piece.kind], `${id}/${piece.id} (${piece.kind})`).toBeDefined();
      }
      // Every Vietnamese label is there, for the pieces, the materials and the steps.
      for (const piece of definition.workspace!.pieces) expect(piece.vi?.label).toBeTruthy();
      for (const step of definition.workspace!.setup) {
        expect(step.vi?.instruction).toBeTruthy();
        expect(step.vi?.refusal).toBeTruthy();
      }
    }
    expect(presentations).toEqual(['microscopy', '2d-workspace', '2d-workspace', 'observation']);
  });

  it('makes the onion slide by placing, refuses a wrong place with the reason, and nothing else is offered', async () => {
    const { game, view, place, workspace } = await bench(SCOPE);
    // The library: the one material the preparation names and the pieces its steps place.
    expect(libraryItems(workspace).map((i) => [i.kind, i.id])).toEqual([
      ['material', 'onion'],
      ['equipment', 'stains'],
      ['equipment', 'slide'],
      ['equipment', 'coverslip'],
    ]);
    expect(place('slide', 'stage')).toBe('Take a clean slide first.'); // too early
    expect(place('onion', 'stage')).toBe('Put the onion epidermis on the slide first.'); // wrong piece
    expect(place('slide', 'slide')).toBeNull();
    expect(place('coverslip', 'slide')).toBe('Put the onion epidermis on the slide first.');
    expect(place('onion', 'slide')).toBeNull();
    expect(place('stains', 'slide')).toBeNull();
    expect(place('coverslip', 'slide')).toBeNull();
    expect(view().session.state).toBe('idle');
    expect(place('slide', 'stage')).toBeNull();
    expect(view().session.state).toBe('configured');
    expect(view().runBlock).toBeNull();
    game.events.publish('ExperimentCommand', { stationId: SCOPE, command: 'run' });
    expect(view().session.state).toBe('running');
  });

  it('chooses the onion from the library as a setting, and a prepared slide needs only the stage', async () => {
    const { game, view, place } = await bench(SCOPE);
    const set = (specimen: number) =>
      game.events.publish('ExperimentCommand', {
        stationId: SCOPE,
        command: 'set',
        parameter: 'specimen',
        value: specimen,
      });
    set(1); // the cheek cells, a prepared slide chosen in the specimen library
    expect(view().setup.map((s) => s.step.id)).toEqual(['stage']);
    expect(place('onion', 'specimens')).toBeNull(); // sets specimen 0, nothing else
    expect(view().session.parameters.specimen).toBe(0);
    expect(view().setup.map((s) => s.step.id)).toEqual([
      'new-slide',
      'specimen',
      'stain',
      'coverslip',
      'stage',
    ]);
  });
});
