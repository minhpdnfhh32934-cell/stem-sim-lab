import { z } from 'zod';
import type { BehaviorDefinition } from '../interaction/behaviors';

/**
 * The circuit parts cabinet (Phase E-2): holding a part, E hands it back there — a broken one is
 * swapped for a sound one, a sound one put back on its shelf. It only asks
 * (`CircuitPartReturned`); the circuit system does it.
 */
const partsReturn: BehaviorDefinition<object> = {
  id: 'parts-return',
  params: z.object({}),
  actionIds: () => ['return-part'],
  createActions: ({ events, hands, entityStates, texts }) => [
    {
      id: 'return-part',
      withHeld: true,
      get label() {
        const held = hands.heldEntity;
        return held && entityStates.get(held.id, 'broken') === true
          ? texts.ui('circuit.swapBroken', 'Hand in the broken part for a new one')
          : texts.ui('circuit.putBack', 'Put it back in the cabinet');
      },
      isAvailable: () => hands.heldEntity?.item.circuit !== undefined,
      perform: () => {
        const held = hands.heldEntity;
        if (held) events.publish('CircuitPartReturned', { entityId: held.id });
      },
    },
  ],
};

export const CIRCUIT_BEHAVIORS: readonly BehaviorDefinition[] = [
  partsReturn,
] as readonly BehaviorDefinition[];
