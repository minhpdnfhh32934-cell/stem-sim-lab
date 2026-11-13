import { z } from 'zod';
import { localized } from '../../core/i18n';
import { IdSchema } from '../../core/schema';
import type { GameEvents } from '../../game/GameEvents';
import type { BehaviorContext, BehaviorDefinition } from '../interaction/behaviors';

type Command = GameEvents['ExperimentCommand'];

/** Every experiment control only asks; the StationSystem decides (and its guard says why not). */
const send =
  ({ events }: BehaviorContext, command: Command) =>
  () => {
    events.publish('ExperimentCommand', command);
  };

/** `<room>/<placement>` of the apparatus a control in the same room belongs to. */
const stationOf = ({ entity }: BehaviorContext, placement: string) =>
  `${entity.roomId}/${placement}`;

const ApparatusParams = z.object({ experimentId: IdSchema });

/**
 * The apparatus of a station (its item carries `geometry`), naming its experiment. Drawn from its
 * session, it has nothing to load — the pendulum's bob hangs ready, the tower's ball waits in its
 * clamp, the spring hangs from its stand, a bench's rig stands on it — and the desk controls run
 * it; the launcher adds its own actions. Inspect comes from the item.
 */
const apparatus = (
  id: string,
  geometry: 'launcher' | 'pendulum' | 'dropTower' | 'springStand' | 'bench',
): BehaviorDefinition<z.infer<typeof ApparatusParams>> => ({
  id,
  params: ApparatusParams,
  actionIds: () => [],
  references: ({ experimentId }) => [{ kind: 'experiment', id: experimentId }],
  check: (item) => (item[geometry] ? null : `"${id}" needs the item's ${geometry} geometry`),
  createActions: () => [],
});

const APPARATUS = ['launcher', 'pendulum', 'dropTower', 'springStand', 'bench'] as const;

/**
 * Work at the apparatus: E opens its experiment's workspace (the WorkspaceSystem decides, the
 * StationSystem's guard says why not). Listed beside the apparatus behaviour, for an experiment
 * that is not `physical-3d` (checked when the lab pack loads).
 */
const openWorkspace: BehaviorDefinition<z.infer<typeof ApparatusParams>> = {
  id: 'open-workspace',
  params: ApparatusParams,
  actionIds: () => ['open-workspace'],
  references: ({ experimentId }) => [{ kind: 'experiment', id: experimentId, workspace: true }],
  check: (item) =>
    APPARATUS.some((geometry) => item[geometry])
      ? null
      : '"open-workspace" needs an apparatus geometry',
  createActions: ({ entity, events, texts }) => [
    {
      id: 'open-workspace',
      get label() {
        return texts.ui('action.openWorkspace', 'Work at the bench');
      },
      isAvailable: () => true,
      perform: () => events.publish('WorkspaceRequested', { stationId: entity.id }),
    },
  ],
};

const LauncherParams = ApparatusParams.extend({
  /** Item tag of what it can be loaded with. */
  accepts: z.string().min(1).default('projectile'),
});

/**
 * The apparatus of an experiment station (its item carries the `launcher` geometry). While the
 * player holds something it accepts, it offers Load; loaded, it offers to take the ball out.
 */
const launcher: BehaviorDefinition<z.infer<typeof LauncherParams>> = {
  ...apparatus('launcher', 'launcher'),
  params: LauncherParams,
  actionIds: () => ['load', 'unload'],
  createActions: (context, { accepts }) => {
    const { entity, entityStates, hands, texts } = context;
    const loaded = () => {
      const value = entityStates.get(entity.id, 'loaded');
      return typeof value === 'string' && value !== '';
    };
    return [
      {
        id: 'load',
        get label() {
          return texts.ui('action.load', 'Load into the launcher');
        },
        withHeld: true,
        isAvailable: () => !loaded() && (hands.heldEntity?.item.tags.includes(accepts) ?? false),
        perform: send(context, { stationId: entity.id, command: 'load' }),
      },
      {
        id: 'unload',
        get label() {
          return texts.ui('action.unload', 'Take the ball out');
        },
        isAvailable: () => loaded() && !hands.heldId,
        perform: send(context, { stationId: entity.id, command: 'unload' }),
      },
    ];
  },
};

const DialParams = z.object({
  /** Placement id of the apparatus (same room). */
  station: IdSchema,
  parameter: z.string().min(1),
  /** How the prompt names the quantity, e.g. "v₀". */
  label: z.string().min(1),
  ...localized('label'),
});

/** A control-panel dial: E raises the parameter by one step (or preset), F lowers it. */
const parameterDial: BehaviorDefinition<z.infer<typeof DialParams>> = {
  id: 'parameter-dial',
  params: DialParams,
  actionIds: () => ['raise', 'lower'],
  references: ({ station, parameter }) => [{ kind: 'station', id: station, parameter }],
  createActions: (context, params) => {
    const { texts } = context;
    const { parameter } = params;
    const stationId = stationOf(context, params.station);
    const quantity = () => ({ quantity: texts.of(params, 'label') });
    return [
      {
        id: 'raise',
        get label() {
          return texts.ui('action.raise', 'Raise {quantity}', quantity());
        },
        isAvailable: () => true,
        perform: send(context, { stationId, command: 'adjust', parameter, direction: 1 }),
      },
      {
        id: 'lower',
        get label() {
          return texts.ui('action.lower', 'Lower {quantity}', quantity());
        },
        isAvailable: () => true,
        perform: send(context, { stationId, command: 'adjust', parameter, direction: -1 }),
      },
    ];
  },
};

const ControlParams = z.object({
  station: IdSchema,
  command: z.enum(['run', 'stop', 'reset', 'clear']),
  label: z.string().min(1),
  ...localized('label'),
});

/**
 * A RUN, STOP or RESET button of a station, or one that clears its bench (`clear`: a physical
 * lab's containers restocked and put back, the setup started again).
 */
const experimentControl: BehaviorDefinition<z.infer<typeof ControlParams>> = {
  id: 'experiment-control',
  params: ControlParams,
  actionIds: ({ command }) => [command],
  references: ({ station }) => [{ kind: 'station', id: station }],
  createActions: (context, params) => [
    {
      id: params.command,
      get label() {
        return context.texts.of(params, 'label');
      },
      isAvailable: () => true,
      perform: send(context, {
        stationId: stationOf(context, params.station),
        command: params.command,
      }),
    },
  ],
};

const InstrumentParams = z.object({ station: IdSchema });

/** The station's results screen: E reads the results (graphs, theory against measurement). */
const resultsDisplay: BehaviorDefinition<z.infer<typeof InstrumentParams>> = {
  id: 'results-display',
  params: InstrumentParams,
  actionIds: () => ['view-results'],
  references: ({ station }) => [{ kind: 'station', id: station }],
  createActions: (context, { station }) => [
    {
      id: 'view-results',
      get label() {
        return context.texts.ui('action.viewResults', 'Read the results');
      },
      isAvailable: () => true,
      perform: send(context, { stationId: stationOf(context, station), command: 'view' }),
    },
  ],
};

/** An instrument that only displays a station's state (e.g. the desk screen); no actions. */
const instrument: BehaviorDefinition<z.infer<typeof InstrumentParams>> = {
  id: 'instrument',
  params: InstrumentParams,
  actionIds: () => [],
  references: ({ station }) => [{ kind: 'station', id: station }],
  createActions: () => [],
};

const ContainerParams = z.object({
  /** Placement id of the apparatus (same room); none when the container is part of it. */
  station: IdSchema.optional(),
  /** The workspace piece it is (the step vocabulary). */
  piece: IdSchema,
  /** The workspace material it is or holds (a glassware choice, a solution). */
  material: IdSchema.optional(),
  /** AFFORDANCE: bookkeeping volume (mL) of its material it is placed with; no model reads it. */
  fill: z.number().nonnegative().optional(),
});

/**
 * A container of a physical-lab station (the item's `container`). While the player holds an
 * empty volumetric pipette, E fills it to its mark from this container; holding a filled one, E
 * delivers it into this container's mouth. A closable one is stoppered or opened (F after the
 * grab). Each only asks (`ContainerRequested`): the StationSystem decides, says why not and
 * commits. Pouring is not an action: it is the held `pour` input over a mouth (LiquidSystem).
 */
const container: BehaviorDefinition<z.infer<typeof ContainerParams>> = {
  id: 'container',
  params: ContainerParams,
  actionIds: () => [
    'fill',
    'deliver',
    'drops',
    'open-tap',
    'close-tap',
    'record',
    'unclamp',
    'stopper',
    'unstopper',
  ],
  references: ({ station }) => (station ? [{ kind: 'station', id: station }] : []),
  check: (item) => (item.container ? null : '"container" needs the item\x27s container'),
  createActions: (context) => {
    const { entity, events, entityStates, hands, texts } = context;
    const nameOf = (id: string) => context.nameOf(id);
    const own = entity.item.container;
    const pipette = () => {
      const held = hands.heldEntity;
      return held && held !== entity && held.item.container?.measured ? held : null;
    };
    const dropper = () => {
      const held = hands.heldEntity;
      return held && held !== entity && held.item.container?.drops ? held : null;
    };
    const filled = (id: string) => entityStates.get(id, 'filled') === true;
    const closed = () => entityStates.get(entity.id, 'closed') === true;
    const clamped = () => {
      const at = entityStates.get(entity.id, 'clamp');
      return typeof at === 'string' && at !== '';
    };
    const tapOpen = () => entityStates.get(entity.id, 'tapOpen') === true;
    const tap = () => own?.tap !== undefined && clamped() && !hands.heldId;
    const ask = (action: GameEvents['ContainerRequested']['action']) => () =>
      events.publish('ContainerRequested', { entityId: entity.id, action });
    return [
      {
        id: 'fill',
        get label() {
          const held = pipette();
          return texts.ui('action.fillPipette', 'Fill the {name} to the mark ({volume} mL)', {
            name: held ? nameOf(held.id) : '',
            volume: held?.item.container?.measured?.volumeMl ?? 0,
          });
        },
        withHeld: true,
        isAvailable: () => {
          const held = pipette();
          return held !== null && !filled(held.id);
        },
        perform: ask('fill'),
      },
      {
        id: 'deliver',
        get label() {
          return texts.ui('action.deliverInto', 'Deliver into the {name}', {
            name: nameOf(entity.id),
          });
        },
        withHeld: true,
        isAvailable: () => {
          const held = pipette();
          return held !== null && filled(held.id) && own?.mouth !== undefined;
        },
        perform: ask('deliver'),
      },
      {
        id: 'drops',
        get label() {
          const held = dropper();
          return texts.ui('action.addDrops', 'Add {count} drops of {name}', {
            name: held ? nameOf(held.id) : '',
            count: held?.item.container?.drops?.count ?? 0,
          });
        },
        withHeld: true,
        isAvailable: () => dropper() !== null && own?.mouth !== undefined,
        perform: ask('drops'),
      },
      {
        id: 'open-tap',
        get label() {
          return texts.ui('action.openTap', 'Open the tap');
        },
        isAvailable: () => tap() && !tapOpen(),
        perform: ask('open-tap'),
      },
      {
        id: 'close-tap',
        get label() {
          return texts.ui('action.closeTap', 'Close the tap');
        },
        isAvailable: () => tap() && tapOpen(),
        perform: ask('close-tap'),
      },
      {
        id: 'record',
        get label() {
          return texts.ui('action.recordReading', 'Record the reading');
        },
        isAvailable: () => tap() && !tapOpen() && entityStates.get(entity.id, 'run') === true,
        perform: ask('record'),
      },
      {
        id: 'unclamp',
        get label() {
          return texts.ui('action.unclamp', 'Take the {name} out of the clamp', {
            name: nameOf(entity.id),
          });
        },
        isAvailable: () => clamped() && !hands.heldId,
        perform: ask('unclamp'),
      },
      {
        id: 'stopper',
        get label() {
          return texts.ui('action.stopper', 'Put the stopper in');
        },
        isAvailable: () => own?.closable === true && !closed() && !hands.heldId,
        perform: ask('stopper'),
      },
      {
        id: 'unstopper',
        get label() {
          return texts.ui('action.unstopper', 'Take the stopper out');
        },
        isAvailable: () => own?.closable === true && closed() && !hands.heldId,
        perform: ask('unstopper'),
      },
    ];
  },
};

const ClampParams = z.object({
  /** Placement id of the apparatus (same room); none when the clamp is part of it. */
  station: IdSchema.optional(),
});

/**
 * A clamp that holds a vessel off any surface (the item's `clamps`): while the player holds a
 * vessel one of them accepts, E puts it there. It only asks (`ContainerRequested` `clamp`): the
 * StationSystem decides, says why not and holds it (the vessel's `unclamp` takes it out).
 */
const clamp: BehaviorDefinition<z.infer<typeof ClampParams>> = {
  id: 'clamp',
  params: ClampParams,
  actionIds: () => [
    'clamp',
    'raise-clamp',
    'open-tap',
    'close-tap',
    'record',
    'lower-clamp',
    'unclamp',
  ],
  references: ({ station }) => (station ? [{ kind: 'station', id: station }] : []),
  check: (item) => (item.clamps ? null : '"clamp" needs the item\x27s clamps'),
  createActions: (context) => {
    const { entity, events, entityStates, hands, texts } = context;
    // The vessel in the clamp (entity state `holding`, the StationSystem's): it stands inside the
    // stand's own aim box, so its tap and its reading are worked from the stand.
    const vessel = () => {
      const id = entityStates.get(entity.id, 'holding');
      return typeof id === 'string' && id !== '' && !hands.heldId ? id : null;
    };
    const slides = entity.item.clamps?.some((c) => c.lowered !== undefined) ?? false;
    const raised = () => !slides || entityStates.get(entity.id, 'clampRaised') === true;
    const tap = () => {
      const id = vessel();
      return id !== null && raised() && entityStates.get(id, 'tapOpen') !== undefined ? id : null;
    };
    const slide = (action: 'raise-clamp' | 'lower-clamp') => () =>
      events.publish('ContainerRequested', { entityId: entity.id, action });
    const ask = (action: GameEvents['ContainerRequested']['action']) => () => {
      const id = vessel();
      if (id !== null) events.publish('ContainerRequested', { entityId: id, action });
    };
    const fits = () => {
      const held = hands.heldEntity;
      const tags = held?.item.tags ?? [];
      return entity.item.clamps?.some((c) => c.accepts.some((t) => tags.includes(t))) ?? false;
    };
    return [
      {
        id: 'clamp',
        get label() {
          const held = hands.heldEntity;
          return texts.ui('action.clamp', 'Clamp the {name}', {
            name: held ? context.nameOf(held.id) : '',
          });
        },
        withHeld: true,
        isAvailable: fits,
        perform: () =>
          events.publish('ContainerRequested', { entityId: entity.id, action: 'clamp' }),
      },
      {
        id: 'raise-clamp',
        get label() {
          return texts.ui('action.raiseClamp', 'Raise the clamp');
        },
        isAvailable: () => slides && !raised() && !hands.heldId,
        perform: slide('raise-clamp'),
      },
      {
        id: 'open-tap',
        get label() {
          return texts.ui('action.openTap', 'Open the tap');
        },
        isAvailable: () => {
          const id = tap();
          return id !== null && entityStates.get(id, 'tapOpen') !== true;
        },
        perform: ask('open-tap'),
      },
      {
        id: 'close-tap',
        get label() {
          return texts.ui('action.closeTap', 'Close the tap');
        },
        isAvailable: () => {
          const id = tap();
          return id !== null && entityStates.get(id, 'tapOpen') === true;
        },
        perform: ask('close-tap'),
      },
      {
        id: 'record',
        get label() {
          return texts.ui('action.recordReading', 'Record the reading');
        },
        isAvailable: () => {
          const id = tap();
          return (
            id !== null &&
            entityStates.get(id, 'tapOpen') !== true &&
            entityStates.get(id, 'run') === true
          );
        },
        perform: ask('record'),
      },
      {
        id: 'lower-clamp',
        get label() {
          return texts.ui('action.lowerClamp', 'Lower the clamp');
        },
        isAvailable: () =>
          slides &&
          raised() &&
          !hands.heldId &&
          entityStates.get(vessel() ?? '', 'run') !== true &&
          entityStates.get(vessel() ?? '', 'tapOpen') !== true,
        perform: slide('lower-clamp'),
      },
      {
        id: 'unclamp',
        get label() {
          const id = vessel();
          return texts.ui('action.unclamp', 'Take the {name} out of the clamp', {
            name: id === null ? '' : context.nameOf(id),
          });
        },
        isAvailable: () => vessel() !== null,
        perform: ask('unclamp'),
      },
    ];
  },
};

export const EXPERIMENT_BEHAVIORS = [
  launcher,
  apparatus('pendulum', 'pendulum'),
  apparatus('drop-tower', 'dropTower'),
  apparatus('spring-stand', 'springStand'),
  apparatus('bench', 'bench'),
  openWorkspace,
  parameterDial,
  experimentControl,
  resultsDisplay,
  instrument,
  container,
  clamp,
] as readonly BehaviorDefinition[];
