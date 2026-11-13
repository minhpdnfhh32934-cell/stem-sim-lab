import type { InputAction } from '../../core/config';
import type { EventBus } from '../../core/EventBus';
import type { Texts } from '../../core/i18n';
import type { Logger } from '../../core/Logger';
import type { Registry } from '../../core/Registry';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState, InventoryStack } from '../../game/GameState';
import type { Placement, RoomDefinition } from '../../world/definitions';
import { entityFromPlacement, type World, type WorldEntity } from '../../world/World';
import { heldClearance } from '../interaction/hold';
import type { ItemDefinition } from '../item';
import type { InputState } from '../player/InputState';

/** The hotbar keys (config bindings): the hotbar is the inventory's first slots. */
export const HOTBAR_KEYS = [
  'hotbar1',
  'hotbar2',
  'hotbar3',
  'hotbar4',
  'hotbar5',
  'hotbar6',
  'hotbar7',
  'hotbar8',
  'hotbar9',
] as const satisfies readonly InputAction[];
export const HOTBAR_SLOTS = HOTBAR_KEYS.length;
/** The hotbar and two rows of nine. */
export const INVENTORY_SLOTS = 27;
/**
 * Most half the diagonal of a carried item's box may be (m), and the player capsule's radius: an
 * item is taken out on the capsule's axis, inside it whichever way it is turned, clear of every
 * wall. shortcut: the default capsule radius (config.player.radius 0.3 m); a smaller configured
 * radius lets the biggest items start against a wall (physics separates them).
 */
export const MAX_CARRIED_RADIUS = 0.3;
/**
 * Play time (s) an item taken out has to come clear of the player's capsule; after it, or if it is
 * let go before, it goes back in the bag. Under the hold's own release of a stuck object (0.5 s).
 */
const EMERGE_SECONDS = 0.3;

/** The radius of a sphere around an item's box (its sphere, for a ball), from its centre. */
const boundingRadius = ({ visual: { shape, size } }: ItemDefinition) =>
  shape === 'sphere' ? size[0] / 2 : Math.hypot(...size) / 2;

/** What the inventory needs from the player's hands (implemented by the interaction system). */
export interface InventoryHands {
  readonly heldEntity: WorldEntity | null;
  grab(entity: WorldEntity): boolean;
  /** Lets go of the held object at rest (reason `placed`); returns it, or null. */
  place(): WorldEntity | null;
}

export interface InventorySystemDeps {
  state: GameState;
  input: InputState;
  events: EventBus<GameEvents>;
  world: World;
  rooms: Registry<RoomDefinition>;
  items: Registry<ItemDefinition>;
  hands: InventoryHands;
  texts: Texts;
  log: Logger;
  /**
   * Instances that are no placement but known elsewhere (Phase Y-5: a test paper, by its paper
   * id): carried like any, never taken out into the world — `give` puts them in, `discard`
   * takes them out of the game.
   */
  virtual?: (itemId: string, instanceId: string) => boolean;
  /**
   * A carried-only instance "taken out" (Q): true when something uses it there (the phone into
   * the hand), so it is not refused. It stays in the bag either way.
   */
  use?: (itemId: string, instanceId: string) => boolean;
  /** The bag's keys wait while this holds (the phone is out: its keys are the number keys). */
  busy?: () => boolean;
}

const isSlot = (slot: number, count: number) => Number.isInteger(slot) && slot >= 0 && slot < count;
const bySlot = (a: InventoryStack, b: InventoryStack) => a.slot - b.slot;

/**
 * What the player carries (`player.inventory`, saved), and its only writer. An item's definition
 * is its items.json entry, carried if it has an `inventory` block; an instance is the entity id
 * `<room>/<placement>` it was placed as, and is in exactly one place: the world (at its
 * placement, where physics left it, or in the hands) or a stack here. A carried instance has no
 * world entity and the scene manager does not spawn its placement (`holds`); its entity states
 * stay keyed by its id. Items come in only from the hands (`stow`, Q while holding) and go out only
 * into them (`takeOut`, Q with free hands): from there they are the world objects they were.
 * PPE is never carried: it is worn (Equipment).
 */
export class InventorySystem implements GameSystem {
  readonly id = 'inventory';
  /** An item just taken out, still on its way out of the capsule, and the slot it came from. */
  private emerging: { entity: WorldEntity; slot: number; seconds: number } | null = null;

  constructor(private readonly deps: InventorySystemDeps) {}

  /** The stacks, sorted by slot: views read them, the commands below change them. */
  get stacks(): readonly InventoryStack[] {
    return this.deps.state.player.inventory.stacks;
  }

  /** The selected hotbar slot (0–8): what Q takes out. */
  get selected(): number {
    return this.deps.state.player.inventory.selected;
  }

  /** The stack in `slot` (0–26), or null. */
  at(slot: number): InventoryStack | null {
    for (const stack of this.stacks) if (stack.slot === slot) return stack;
    return null;
  }

  /** True while the instance (entity id) is carried: then it has no world entity. */
  holds(entityId: string): boolean {
    for (const stack of this.stacks) if (stack.placements.includes(entityId)) return true;
    return false;
  }

  update(dt: number): void {
    const { state, input, hands } = this.deps;
    if (state.session.phase !== 'playing' || state.session.paused) return;
    if (this.deps.busy?.()) return;
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const key = HOTBAR_KEYS[i]; // an index loop: nothing allocated per frame
      if (key && input.wasPressed(key)) this.select(i);
    }
    if (input.wasPressed('stow')) {
      if (hands.heldEntity) this.stow();
      else this.takeOut(this.selected);
    }
    if (this.emerging) this.emerge(dt);
  }

  /** Selects hotbar slot `slot` (0–8). False if it is not one, or already selected. */
  select(slot: number): boolean {
    const inventory = this.deps.state.player.inventory;
    if (!isSlot(slot, HOTBAR_SLOTS) || slot === inventory.selected) return false;
    inventory.selected = slot;
    this.changed('select');
    return true;
  }

  /** Selects the next (1) or previous (−1) hotbar slot, wrapping around (the mouse wheel). */
  step(direction: 1 | -1): boolean {
    return this.select((this.selected + direction + HOTBAR_SLOTS) % HOTBAR_SLOTS);
  }

  /**
   * Puts the held object away (Q): onto the lowest stack of its item with room, else into the
   * lowest empty slot; that slot is selected if it is in the hotbar (Q again takes it back out).
   * Refused with the reason (ActionBlocked) for an object that is not carried in the inventory,
   * or with no room: then it stays in the hands.
   */
  stow(): boolean {
    const { hands, texts } = this.deps;
    const held = hands.heldEntity;
    if (!held || !this.playing()) return false;
    const limit = this.limitOf(held.item.id);
    if (limit === 0 || !this.placementOf(held.id, held.item.id)) {
      const reason = texts.ui('inventory.notCarried', 'This does not go in the inventory.');
      return this.refuse(held.id, 'stow', reason);
    }
    const slot = this.slotFor(held.item.id, limit);
    if (slot < 0) {
      return this.refuse(held.id, 'stow', texts.ui('inventory.full', 'The inventory is full.'));
    }
    this.keep(held, slot);
    if (slot < HOTBAR_SLOTS) this.deps.state.player.inventory.selected = slot;
    this.changed('stow');
    return true;
  }

  /**
   * Takes the last instance of the stack in `slot` out into the free hands (Q, or the panel): the
   * entity it was (id, item, behaviours, entity states), rebuilt from its placement and spawned
   * at the top of the player's capsule axis, where nothing static can be; physics then carries it
   * towards the hold point and stops it at the first surface on the way. If it does not come
   * clear of the capsule (a wall or furniture in the way), it goes back in the bag with the
   * reason (`emerge`): an item left in the capsule would push the player away once let go.
   * False with nothing to take out or the hands full; refused with the reason if it cannot be
   * held (the bag is unchanged).
   */
  takeOut(slot: number): boolean {
    const { hands, world, state, texts } = this.deps;
    const stack = this.at(slot);
    const id = stack?.placements.at(-1);
    if (!stack || id === undefined || hands.heldEntity || !this.playing()) return false;
    if (this.deps.virtual?.(stack.item, id)) {
      if (this.deps.use?.(stack.item, id)) return true;
      const reason = texts.ui(
        'inventory.stays',
        'This stays in your bag: choose it, then press E to use it.',
      );
      return this.refuse(id, 'take-out', reason);
    }
    const home = this.placementOf(id, stack.item);
    const item = this.deps.items.tryGet(stack.item);
    if (!home || !item) return false; // never: only such instances come in (stow, sanitize)
    const entity = entityFromPlacement(home.room.id, home.placement, item);
    const { position, height } = state.player;
    entity.pose.position[0] = position[0];
    entity.pose.position[1] = position[1] + height - MAX_CARRIED_RADIUS; // high: over benches
    entity.pose.position[2] = position[2];
    stack.placements.pop();
    // Spawned and held in one go: no physics step sees it overlap the player (held objects
    // ignore the player's capsule).
    world.spawn(entity);
    if (!hands.grab(entity)) {
      world.despawn(id);
      stack.placements.push(id);
      const reason = texts.ui('inventory.cannotTakeOut', 'It cannot be taken out now.');
      return this.refuse(id, 'take-out', reason);
    }
    if (stack.placements.length === 0) this.remove(stack);
    this.emerging = { entity, slot, seconds: 0 };
    this.changed('take-out');
    return true;
  }

  /**
   * Puts virtual instance `id` of item `itemId` in the bag (Phase Y-5: a paper the teacher hands
   * over): onto a stack of it with room, else into the lowest empty slot, selected if that is in
   * the hotbar. False, with the reason (ActionBlocked), when the bag is full; never a placement.
   */
  give(itemId: string, id: string): boolean {
    const limit = this.limitOf(itemId);
    if (limit === 0 || !this.deps.virtual?.(itemId, id) || this.holds(id)) return false;
    const slot = this.slotFor(itemId, limit);
    if (slot < 0) {
      const reason = this.deps.texts.ui('inventory.full', 'The inventory is full.');
      return this.refuse(id, 'stow', reason);
    }
    const stack = this.at(slot);
    if (stack) stack.placements.push(id);
    else this.insert({ slot, item: itemId, placements: [id] });
    if (slot < HOTBAR_SLOTS) this.deps.state.player.inventory.selected = slot;
    this.changed('stow');
    return true;
  }

  /**
   * Keeps carried-only instance `id` in the bag (the phone, from the start): in the last free
   * hotbar slot, else the first free one; the selection is left as it is. False if it is not
   * carried-only, or the bag is full.
   */
  carry(itemId: string, id: string): boolean {
    if (this.holds(id)) return true;
    if (!this.deps.virtual?.(itemId, id)) return false;
    // The hotbar from its last slot back, then the rest of the bag.
    const order = Array.from({ length: INVENTORY_SLOTS }, (_, i) =>
      i < HOTBAR_SLOTS ? HOTBAR_SLOTS - 1 - i : i,
    );
    const slot = order.find((s) => !this.at(s));
    if (slot === undefined) return false;
    this.insert({ slot, item: itemId, placements: [id] });
    this.changed('stow');
    return true;
  }

  /** Whether one more of item `itemId` fits in the bag now. */
  hasRoom(itemId: string): boolean {
    const limit = this.limitOf(itemId);
    return limit > 0 && this.slotFor(itemId, limit) >= 0;
  }

  /** Takes virtual instance `id` out of the bag for good (a paper thrown away); false if not carried. */
  discard(id: string): boolean {
    for (const stack of this.stacks) {
      const at = stack.placements.indexOf(id);
      if (at < 0 || !this.deps.virtual?.(stack.item, id)) continue;
      stack.placements.splice(at, 1);
      if (stack.placements.length === 0) this.remove(stack);
      this.changed('move');
      return true;
    }
    return false;
  }

  /**
   * Moves `count` instances (default: all) of the stack in `from` to slot `to`, the last ones
   * first: into an empty slot (a split when fewer than all), onto the same item up to its stack
   * size (the rest stays), or — the whole stack only — swapping with another item's stack.
   * False, with nothing changed, when it cannot: nothing in `from`, `to` is `from` or not a slot
   * (0–26), a full stack, or part of a stack onto another item.
   */
  move(from: number, to: number, count?: number): boolean {
    const source = this.at(from);
    if (!source || from === to || !isSlot(to, INVENTORY_SLOTS)) return false;
    const all = source.placements.length;
    const n = count === undefined ? all : Math.min(count, all);
    if (!Number.isInteger(n) || n < 1) return false;
    const target = this.at(to);
    if (target?.item === source.item) {
      const moved = Math.min(n, this.limitOf(target.item) - target.placements.length);
      if (moved < 1) return false;
      target.placements.push(...source.placements.splice(-moved));
      if (source.placements.length === 0) this.remove(source);
    } else if (target) {
      if (n < all) return false;
      target.slot = from;
      source.slot = to;
    } else if (n < all) {
      this.insert({ slot: to, item: source.item, placements: source.placements.splice(-n) });
    } else {
      source.slot = to;
    }
    this.deps.state.player.inventory.stacks.sort(bySlot);
    this.changed('move');
    return true;
  }

  /** Moves the larger half of the stack in `from` to `to` (see `move`): a split. */
  split(from: number, to: number): boolean {
    return this.move(from, to, Math.ceil((this.at(from)?.placements.length ?? 0) / 2));
  }

  /**
   * Makes a restored inventory agree with the content (Continue, before the scene loads),
   * keeping what it can and logging each problem: a stack of an unknown item, or of one that is
   * not carried, is dropped; so is an instance that is not a placement of its item, one already
   * carried, and those beyond the stack size; a stack outside the slots or on a taken one moves
   * to the lowest free slot (dropped if none); a selection outside the hotbar becomes slot 0.
   * What is dropped is simply not carried: its placement spawns at home, never lost, never twice.
   */
  sanitize(): void {
    const { state, log } = this.deps;
    const inventory = state.player.inventory;
    const carried = new Set<string>();
    const kept: InventoryStack[] = [];
    const misplaced: InventoryStack[] = [];
    const taken = (slot: number) => kept.some((s) => s.slot === slot);
    for (const { slot, item, placements } of inventory.stacks) {
      const limit = this.limitOf(item);
      if (limit === 0) {
        log.warn(`Dropped the stack in slot ${slot}: "${item}" is not an item that is carried`);
        continue;
      }
      const valid: string[] = [];
      for (const id of placements) {
        const problem = carried.has(id)
          ? 'it is carried twice'
          : !this.placementOf(id, item) && !this.deps.virtual?.(item, id)
            ? `it is not a placement of "${item}"`
            : valid.length === limit
              ? `more than ${limit} in a stack`
              : null;
        if (problem) {
          log.warn(`Dropped "${id}" from slot ${slot}: ${problem}`);
          continue;
        }
        valid.push(id);
        carried.add(id);
      }
      if (valid.length === 0) {
        log.warn(`Dropped the stack in slot ${slot}: nothing left in it`);
        continue;
      }
      const stack = { slot, item, placements: valid };
      (isSlot(slot, INVENTORY_SLOTS) && !taken(slot) ? kept : misplaced).push(stack);
    }
    for (const stack of misplaced) {
      let free = 0;
      while (free < INVENTORY_SLOTS && taken(free)) free++;
      if (free === INVENTORY_SLOTS) {
        log.warn(`Dropped the stack in slot ${stack.slot}: no free slot`);
        continue;
      }
      log.warn(`Moved the stack in slot ${stack.slot} to the free slot ${free}`);
      kept.push({ ...stack, slot: free });
    }
    inventory.stacks = kept.sort(bySlot);
    if (!isSlot(inventory.selected, HOTBAR_SLOTS)) {
      log.warn(`Selected slot ${inventory.selected} is not in the hotbar; selecting slot 0`);
      inventory.selected = 0;
    }
  }

  // ---- helpers ------------------------------------------------------------------------------

  /**
   * Follows an item taken out until it is clear of the capsule. One still in it after
   * EMERGE_SECONDS (blocked by a wall or furniture), or let go before (dropped, thrown), goes back
   * where it came from with the reason — in the frame this is decided, before any physics step
   * could push the player with it. Gone from the world (put away again, a scene change): done.
   */
  private emerge(dt: number): void {
    const { world, hands, texts } = this.deps;
    const out = this.emerging;
    if (!out) return;
    const { entity, slot } = out;
    out.seconds += dt;
    if (world.entity(entity.id) !== entity || this.clearOfPlayer(entity)) {
      this.emerging = null;
      return;
    }
    if (hands.heldEntity === entity && out.seconds < EMERGE_SECONDS) return;
    this.emerging = null;
    const limit = this.limitOf(entity.item.id);
    const own = this.at(slot);
    const back =
      !own || (own.item === entity.item.id && own.placements.length < limit)
        ? slot
        : this.slotFor(entity.item.id, limit);
    if (back < 0) return; // never: it came out of the bag a moment ago
    this.keep(entity, back);
    this.changed('stow');
    const reason = texts.ui('inventory.cannotTakeOut', 'It cannot be taken out now.');
    this.refuse(entity.id, 'take-out', reason);
  }

  /**
   * True when an item is clear of the player's capsule: wholly over the head, or beside it by its
   * held clearance (`heldClearance`, where the hold keeps it), within its 2 cm margin (the hold's
   * drive closes in on it).
   */
  private clearOfPlayer(entity: WorldEntity): boolean {
    const { position, height } = this.deps.state.player;
    const p = entity.pose.position;
    if (p[1] - boundingRadius(entity.item) >= position[1] + height) return true;
    const across = Math.hypot(p[0] - position[0], p[2] - position[2]);
    return across >= heldClearance(MAX_CARRIED_RADIUS, entity.item) - 0.015;
  }

  /** Into the bag, in `slot` (which takes it): out of the hands and out of the world. */
  private keep(entity: WorldEntity, slot: number): void {
    if (this.deps.hands.heldEntity === entity) this.deps.hands.place();
    this.deps.world.despawn(entity.id);
    const stack = this.at(slot);
    if (stack) stack.placements.push(entity.id);
    else this.insert({ slot, item: entity.item.id, placements: [entity.id] });
  }

  /** In a world and not paused: the only time objects come and go. */
  private playing(): boolean {
    const { phase, paused } = this.deps.state.session;
    return phase === 'playing' && !paused;
  }

  /** How many of an item a slot takes; 0 if it is not carried (or unknown). */
  private limitOf(itemId: string): number {
    return this.deps.items.tryGet(itemId)?.inventory?.stack ?? 0;
  }

  /** The room and placement an instance was placed as, if the content has it as `itemId`. */
  private placementOf(
    entityId: string,
    itemId: string,
  ): { room: RoomDefinition; placement: Placement } | null {
    const slash = entityId.indexOf('/');
    const room = slash > 0 ? this.deps.rooms.tryGet(entityId.slice(0, slash)) : undefined;
    const placement = room?.placements.find((p) => p.id === entityId.slice(slash + 1));
    return room && placement?.item === itemId ? { room, placement } : null;
  }

  /** The lowest slot with a stack of the item that has room, else the lowest empty one (−1). */
  private slotFor(itemId: string, limit: number): number {
    let empty = -1;
    for (let slot = 0; slot < INVENTORY_SLOTS; slot++) {
      const stack = this.at(slot);
      if (stack?.item === itemId && stack.placements.length < limit) return slot;
      if (!stack && empty < 0) empty = slot;
    }
    return empty;
  }

  private insert(stack: InventoryStack): void {
    const stacks = this.deps.state.player.inventory.stacks;
    stacks.push(stack);
    stacks.sort(bySlot);
  }

  private remove(stack: InventoryStack): void {
    const stacks = this.deps.state.player.inventory.stacks;
    stacks.splice(stacks.indexOf(stack), 1);
  }

  private refuse(entityId: string, actionId: 'stow' | 'take-out', reason: string): false {
    this.deps.events.publish('ActionBlocked', { entityId, actionId, reason });
    return false;
  }

  private changed(cause: GameEvents['InventoryChanged']['cause']): void {
    this.deps.events.publish('InventoryChanged', { cause });
  }
}
