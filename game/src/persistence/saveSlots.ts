import { z } from 'zod';
import { saveKeys, type SaveStorage } from './SaveSystem';

/*
 * The games kept in this browser (Phú 2026-11-12): single-player games, each its own save, and the
 * LAN rooms played, each with its own progress — listed to play on or delete. The saves themselves
 * are the save system's (`simlab.save.<slot>`, unchanged); this is their list, in its own key.
 * A save from before the list (the one slot, `slot-1`) becomes its first single-player game.
 */

const INDEX_KEY = 'simlab.saves';

export const SaveSlotSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  kind: z.enum(['solo', 'room']),
  /** A single-player game's number (its name: "Game n"). */
  n: z.number().int().min(1),
  /** A room's name, and its ID on the server when last played (a new one if it was made again). */
  room: z.object({ name: z.string().max(40), id: z.string().max(12) }).optional(),
  createdAt: z.string(),
  playedAt: z.string(),
});
export type SaveSlot = z.infer<typeof SaveSlotSchema>;

const IndexSchema = z.object({ version: z.literal(1), slots: z.array(SaveSlotSchema) });

export class SaveSlots {
  constructor(
    private readonly storage: SaveStorage,
    /** The one slot saves were kept in before the list. */
    private readonly legacy = 'slot-1',
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The games of a kind that have a save, the last played first. */
  list(kind: SaveSlot['kind']): SaveSlot[] {
    return this.read()
      .filter((s) => s.kind === kind && this.hasSave(s.id))
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  }

  get(id: string): SaveSlot | undefined {
    return this.read().find((s) => s.id === id);
  }

  /** The last played game with a save, of any kind. */
  latest(): SaveSlot | undefined {
    return this.read()
      .filter((s) => this.hasSave(s.id))
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt))[0];
  }

  /** A new game's place in the list (it shows once it has a save). */
  create(kind: SaveSlot['kind'], room?: SaveSlot['room']): SaveSlot {
    // Places made but never saved (left before the first save) are dropped first.
    const slots = this.read().filter((s) => this.hasSave(s.id));
    const n = 1 + Math.max(0, ...slots.filter((s) => s.kind === kind).map((s) => s.n));
    let id = `${kind}-${n}`;
    for (let i = 2; slots.some((s) => s.id === id) || this.hasSave(id); i++)
      id = `${kind}-${n}-${i}`;
    const at = this.now().toISOString();
    const slot: SaveSlot = { id, kind, n, createdAt: at, playedAt: at, ...(room ? { room } : {}) };
    this.write([...slots, slot]);
    return slot;
  }

  /** The room's own game: the one last played with that room ID, else with that room's name. */
  forRoom(id: string, name: string): SaveSlot | undefined {
    const rooms = this.read().filter((s) => s.kind === 'room' && s.room);
    const lower = name.trim().toLowerCase();
    return (
      rooms.find((s) => s.room?.id === id) ??
      rooms.find((s) => s.room?.name.trim().toLowerCase() === lower)
    );
  }

  /** Marks a game played now (its room's ID as it is now, if given). */
  touch(id: string, room?: SaveSlot['room']): void {
    const slots = this.read();
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    slot.playedAt = this.now().toISOString();
    if (room) slot.room = room;
    this.write(slots);
  }

  /** Deletes a game: its save, its backup and its place in the list. */
  remove(id: string): void {
    for (const key of saveKeys(id)) this.storage.remove(key);
    this.write(this.read().filter((s) => s.id !== id));
  }

  private hasSave(id: string): boolean {
    try {
      return this.storage.read(saveKeys(id)[0]) !== null;
    } catch {
      return false;
    }
  }

  private read(): SaveSlot[] {
    let raw: string | null;
    try {
      raw = this.storage.read(INDEX_KEY);
    } catch {
      return [];
    }
    if (raw !== null) {
      try {
        const parsed = IndexSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data.slots;
      } catch {
        // An unreadable list: made again below from what is saved.
      }
    }
    // No list yet: the save from before it, if any, is the first single-player game.
    if (!this.hasSave(this.legacy)) return [];
    const at = this.now().toISOString();
    const first: SaveSlot = { id: this.legacy, kind: 'solo', n: 1, createdAt: at, playedAt: at };
    this.write([first]);
    return [first];
  }

  private write(slots: readonly SaveSlot[]): void {
    try {
      this.storage.write(INDEX_KEY, JSON.stringify({ version: 1, slots }));
    } catch {
      // Not kept (storage blocked): the games still play; the list is made again next time.
    }
  }
}
