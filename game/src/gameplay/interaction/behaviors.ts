import { z } from 'zod';
import type { EventBus } from '../../core/EventBus';
import { localized, type Texts } from '../../core/i18n';
import { IdSchema } from '../../core/schema';
import type { GameEvents } from '../../game/GameEvents';
import type { DoorState } from '../door/DoorSystem';
import type { HingeState } from '../door/HingeSystem';
import type { ItemDefinition } from '../item';
import type { Equipment } from '../player/Equipment';
import type { EntityStates } from '../../world/EntityStates';
import type { WorldEntity } from '../../world/World';
import { CIRCUIT_BEHAVIORS } from '../circuit/behaviors';
import { laptopBehavior, restBehavior, washBehavior } from '../player/restBehaviors';
import { EXPERIMENT_BEHAVIORS } from '../experiment/behaviors';
import type { InteractionAction } from './InteractionSystem';

/** What the player is carrying, provided by the interaction system. */
export interface Hands {
  /** Entity currently held, or null. */
  readonly heldId: string | null;
  readonly heldEntity: WorldEntity | null;
  /** True if the hands are free and the entity can be lifted (dynamic, light enough). */
  canGrab(entity: WorldEntity): boolean;
  grab(entity: WorldEntity): boolean;
}

export interface BehaviorContext {
  readonly entity: WorldEntity;
  readonly events: EventBus<GameEvents>;
  readonly entityStates: EntityStates;
  readonly hands: Hands;
  readonly equipment: Equipment;
  /** Player-facing text in the current language: labels and reasons are read when shown. */
  readonly texts: Texts;
  /** Walk-through doors as they are now (closed without it: every door is then a teleport). */
  readonly doors?: DoorState | undefined;
  /** Hinged leaves as they are now (without it they swing at any time). */
  readonly hinges?: HingeState | undefined;
  /** What the player sees another entity called (e.g. the wardrobe), in the current language. */
  nameOf(entityId: string): string;
  /** An item's definition (e.g. one the player wears), or undefined. */
  readonly itemOf: (itemId: string) => ItemDefinition | undefined;
}

/** A content id a behaviour's parameters point at, checked when content loads. */
export interface ContentRef {
  /**
   * placement: another placement id in the same room · arrival: a door's entity id
   * (`<room>/<placement>`) in `scene`, where the player comes out · station: a placement in the
   * same room that is an experiment apparatus, optionally with one of its `parameter`s.
   * `workspace`: the experiment must have a workspace (it is not `physical-3d`).
   */
  readonly kind: 'scene' | 'experiment' | 'placement' | 'arrival' | 'station';
  readonly id: string;
  readonly scene?: string;
  readonly parameter?: string;
  readonly workspace?: boolean;
}

/**
 * Reusable interaction logic that items opt into by id (`"interactions": ["openable"]`).
 * Parameters come from each placement and are validated by `params` at content load.
 * Behaviours talk to other systems only through events and entity state.
 */
export interface BehaviorDefinition<P = unknown> {
  readonly id: string;
  readonly params: z.ZodType<P>;
  references?(params: P): ContentRef[];
  /** Ids of the actions it can offer (validated content refers to them, e.g. procedure steps). */
  actionIds(params: P): string[];
  /** Content check against the item that lists this behaviour; returns a problem or null. */
  check?(item: ItemDefinition): string | null;
  createActions(context: BehaviorContext, params: P): InteractionAction[];
}

const inspect: BehaviorDefinition<object> = {
  id: 'inspect',
  params: z.object({}),
  actionIds: () => ['inspect'],
  createActions: ({ entity, events, texts }) => [
    {
      id: 'inspect',
      get label() {
        return texts.ui('action.inspect', 'Inspect');
      },
      isAvailable: () => true,
      perform: () => {
        events.publish('ItemInspected', { entityId: entity.id, itemId: entity.item.id });
      },
    },
  ],
};

type Label = (texts: Texts) => string;

/** Two-state behaviour over one boolean entity-state key (absent = false). */
function stateToggle(
  id: string,
  key: string,
  on: { id: string; label: Label },
  off: { id: string; label: Label },
): BehaviorDefinition<object> {
  return {
    id,
    params: z.object({}),
    actionIds: () => [on.id, off.id],
    createActions: ({ entity, entityStates, texts, hinges }) => {
      const isOn = () => entityStates.get(entity.id, key) === true;
      // Hinged leaves (a cabinet's doors, the washroom door) never swing into the player: asked to
      // open or close with the player in the way, it waits for them to step back.
      const swings = key === 'open' && entity.item.hinged !== undefined && hinges !== undefined;
      const clear = (open: boolean) =>
        !open && hinges?.blockedShut(entity.id) === true
          ? texts.ui('action.objectInWay', 'Something is in the way of the door.')
          : hinges?.clear(entity.id, open) !== false
            ? null
            : open
              ? texts.ui('action.standClearOpen', 'Step back to open it.')
              : texts.ui('action.standClear', 'Step back to close it.');
      return [
        {
          id: on.id,
          get label() {
            return on.label(texts);
          },
          isAvailable: () => !isOn(),
          ...(swings ? { blocked: () => clear(true) } : {}),
          perform: () => entityStates.set(entity.id, key, true),
        },
        {
          id: off.id,
          get label() {
            return off.label(texts);
          },
          isAvailable: isOn,
          ...(swings ? { blocked: () => clear(false) } : {}),
          perform: () => entityStates.set(entity.id, key, false),
        },
      ];
    },
  };
}

const toggle = stateToggle(
  'toggle',
  'active',
  { id: 'activate', label: (t) => t.ui('action.turnOn', 'Turn on') },
  { id: 'deactivate', label: (t) => t.ui('action.turnOff', 'Turn off') },
);

/** A room's light switch: its entity state `lightsOff` (saved) darkens the room it is in. */
export const LIGHTS_OFF = 'lightsOff';
/** The behaviour id of a room's light switch (the renderer finds switches by it). */
export const ROOM_LIGHTS = 'room-lights';
const roomLights = stateToggle(
  ROOM_LIGHTS,
  LIGHTS_OFF,
  { id: 'lights-off', label: (t) => t.ui('action.lightsOff', 'Switch the lights off') },
  { id: 'lights-on', label: (t) => t.ui('action.lightsOn', 'Switch the lights on') },
);

const openable = stateToggle(
  'openable',
  'open',
  { id: 'open', label: (t) => t.ui('action.open', 'Open') },
  { id: 'close', label: (t) => t.ui('action.close', 'Close') },
);

const TravelParams = z.object({
  targetScene: IdSchema,
  label: z.string().min(1).optional(),
  ...localized('label'),
  /**
   * Entity id (`<room>/<placement>`) of the door in the target scene the player comes out of;
   * without it the player arrives at the scene's spawn.
   */
  arrival: z.string().min(1).optional(),
});

/**
 * A door to another scene. A walk-through door (its item has `door`) opens with `travel`, and the
 * player walks through; while it is not closed it offers `close-door` instead (the door system
 * decides both). Any other door loads its target scene at once, the player at its arrival.
 */
const travel: BehaviorDefinition<z.infer<typeof TravelParams>> = {
  id: 'travel',
  params: TravelParams,
  actionIds: () => ['travel', 'close-door'],
  references: ({ targetScene, arrival }) => [
    { kind: 'scene', id: targetScene },
    ...(arrival ? [{ kind: 'arrival' as const, id: arrival, scene: targetScene }] : []),
  ],
  createActions: ({ entity, events, texts, doors }, params) => {
    const walkThrough = entity.item.door !== undefined;
    const isOpen = () => walkThrough && doors?.isOpen(entity.id) === true;
    const request = () => events.publish('DoorRequested', { entityId: entity.id });
    return [
      {
        id: 'travel',
        get label() {
          // Asked for, its far scene still being readied: the press is answered at once.
          if (walkThrough && doors?.state(entity.id) === 'preparing') {
            return texts.ui('action.doorOpening', 'Opening…');
          }
          return params.label
            ? texts.of(params, 'label')
            : texts.ui('action.goThrough', 'Go through');
        },
        isAvailable: () => !isOpen(),
        perform: () => {
          if (walkThrough) {
            request();
            return;
          }
          const { targetScene, arrival } = params;
          events.publish('SceneChangeRequested', {
            sceneId: targetScene,
            ...(arrival ? { arrival } : {}),
          });
        },
      },
      {
        id: 'close-door',
        get label() {
          return texts.ui('action.closeDoor', 'Close the door');
        },
        isAvailable: isOpen,
        perform: request,
      },
    ];
  },
};

const faucet = stateToggle(
  'faucet',
  'running',
  { id: 'water-on', label: (t) => t.ui('action.waterOn', 'Turn on water') },
  { id: 'water-off', label: (t) => t.ui('action.waterOff', 'Turn off water') },
);

const WearParams = z.object({
  /** Placement id (same room) of a container that must be open, e.g. the wardrobe. */
  container: IdSchema.optional(),
  /** A dispenser (glove box) stays in place; a garment leaves its spot and is put back there. */
  dispenser: z.boolean().default(false),
});

/** Put on / take off a piece of protective equipment; the player's equipment is the record. */
const wear: BehaviorDefinition<z.infer<typeof WearParams>> = {
  id: 'wear',
  params: WearParams,
  actionIds: () => ['wear', 'take-off'],
  references: ({ container }) => (container ? [{ kind: 'placement', id: container }] : []),
  check: (item) =>
    item.category === 'ppe' && item.wornOn ? null : '"wear" needs category "ppe" and "wornOn"',
  // Disposable PPE (gloves) is used once worn: it goes into a waste bin, never back here.
  createActions: (context, { container, dispenser }) => {
    const { entity, entityStates, equipment, texts } = context;
    const itemId = entity.item.id;
    const item = () => ({ item: texts.of(entity.item, 'displayName').toLowerCase() });
    const containerId = container ? `${entity.roomId}/${container}` : null;
    const taken = () => entityStates.get(entity.id, 'taken') === true;
    const closed = () =>
      containerId !== null && entityStates.get(containerId, 'open') !== true
        ? texts.ui('action.openFirst', 'Open the {container} first.', {
            container: context.nameOf(containerId).toLowerCase(),
          })
        : null;
    return [
      {
        id: 'wear',
        get label() {
          return texts.ui('action.putOn', 'Put on {item}', item());
        },
        isAvailable: () => !equipment.isWearing(itemId) && (dispenser || !taken()),
        blocked: closed,
        perform: () => {
          equipment.wear(itemId);
          if (!dispenser) entityStates.set(entity.id, 'taken', true);
        },
      },
      {
        id: 'take-off',
        get label() {
          return dispenser
            ? texts.ui('action.takeOff', 'Take off {item}', item())
            : texts.ui('action.putBack', 'Put back {item}', item());
        },
        isAvailable: () =>
          !entity.item.disposable && equipment.isWearing(itemId) && (dispenser || taken()),
        blocked: closed,
        perform: () => {
          equipment.remove(itemId);
          if (!dispenser) entityStates.set(entity.id, 'taken', false);
        },
      },
    ];
  },
};

const UseParams = z.object({ action: IdSchema, label: z.string().min(1), ...localized('label') });

/**
 * A station action (wash hands, take soap, use sanitizer, ...). It changes nothing by itself:
 * its meaning comes from the procedure that counts it (see ProcedureSystem), which also refuses
 * it with a reason when it is not the next step.
 */
const use: BehaviorDefinition<z.infer<typeof UseParams>> = {
  id: 'use',
  params: UseParams,
  actionIds: ({ action }) => [action],
  createActions: ({ texts }, params) => [
    {
      id: params.action,
      get label() {
        return texts.of(params, 'label');
      },
      isAvailable: () => true,
      perform: () => undefined,
    },
  ],
};

/** Pick the object up; while held, the interaction system offers Drop and (if throwable) Throw. */
const grab: BehaviorDefinition<object> = {
  id: 'grab',
  params: z.object({}),
  actionIds: () => ['grab'],
  check: (item) =>
    item.physical.body === 'dynamic' ? null : '"grab" needs physical.body "dynamic"',
  createActions: ({ entity, hands, texts }) => [
    {
      id: 'grab',
      get label() {
        return texts.ui('action.grab', 'Grab');
      },
      isAvailable: () => hands.canGrab(entity),
      perform: () => {
        if (!hands.grab(entity)) throw new Error(`"${entity.id}" could not be grabbed`);
      },
    },
  ],
};

/**
 * A waste bin: the used disposable PPE the player wears (gloves) is discarded into it — taken off
 * for good; a fresh pair comes from the dispenser.
 */
const wasteBin: BehaviorDefinition<object> = {
  id: 'waste-bin',
  params: z.object({}),
  actionIds: () => ['discard'],
  createActions: ({ equipment, texts, itemOf }) => {
    const used = () => equipment.worn.filter((id) => itemOf(id)?.disposable === true);
    return [
      {
        id: 'discard',
        get label() {
          const names = used().map((id) => {
            const item = itemOf(id);
            return item ? texts.of(item, 'displayName').toLowerCase() : id;
          });
          return texts.ui('action.discard', 'Discard used {items}', { items: names.join(', ') });
        },
        isAvailable: () => used().length > 0,
        perform: () => {
          for (const id of used()) equipment.remove(id, true);
        },
      },
    ];
  },
};

export const BUILT_IN_BEHAVIORS: readonly BehaviorDefinition[] = [
  ...EXPERIMENT_BEHAVIORS,
  ...CIRCUIT_BEHAVIORS,
  restBehavior,
  washBehavior,
  laptopBehavior,
  inspect,
  toggle,
  roomLights,
  openable,
  travel,
  grab,
  faucet,
  wear,
  wasteBin,
  use,
] as readonly BehaviorDefinition[];
