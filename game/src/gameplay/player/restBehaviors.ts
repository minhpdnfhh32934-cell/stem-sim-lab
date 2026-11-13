import { z } from 'zod';
import type { BehaviorDefinition } from '../interaction/behaviors';

export { restBehavior } from './RestSystem';

/** The hub's laptop (Phase F-2): E opens it — the view shows its start-up, desktop and books. */
export const laptopBehavior: BehaviorDefinition<object> = {
  id: 'laptop',
  params: z.object({}),
  actionIds: () => ['open-laptop'],
  createActions: ({ entity, events, texts }) => [
    {
      id: 'open-laptop',
      get label() {
        return texts.ui('action.openLaptop', 'Use the laptop');
      },
      isAvailable: () => true,
      perform: () => events.publish('LaptopOpened', { entityId: entity.id }),
    },
  ],
};

/**
 * Washing the hands at a basin (Phase F-1): with its water running (the `faucet` behaviour), E
 * acts the washing out (actions.json "wash-hands": the hands rubbed under the tap). Nothing is
 * recorded: a basin in a lab or a washroom, not the cleanroom entry's procedure.
 */
export const washBehavior: BehaviorDefinition<object> = {
  id: 'wash-hands',
  params: z.object({}),
  actionIds: () => ['wash-hands'],
  createActions: ({ entity, entityStates, texts, hands }) => [
    {
      id: 'wash-hands',
      get label() {
        return texts.ui('action.washHands', 'Wash your hands');
      },
      isAvailable: () => hands.heldId === null,
      blocked: () =>
        entityStates.get(entity.id, 'running') === true
          ? null
          : texts.ui('action.waterFirst', 'Turn the water on first.'),
      perform: () => undefined,
    },
  ],
};
