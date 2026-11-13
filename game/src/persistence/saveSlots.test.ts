import { describe, expect, it } from 'vitest';
import { MemorySaveStorage } from './SaveSystem';
import { SaveSlots } from './saveSlots';

function setup() {
  const storage = new MemorySaveStorage();
  let t = Date.parse('2026-11-12T08:00:00Z');
  const slots = new SaveSlots(storage, 'slot-1', () => new Date((t += 60_000)));
  const saveIn = (id: string) => storage.write(`simlab.save.${id}`, '{}');
  return { storage, slots, saveIn };
}

describe('SaveSlots', () => {
  it('makes the save from before the list its first single-player game', () => {
    const { slots, saveIn } = setup();
    expect(slots.list('solo')).toEqual([]);
    saveIn('slot-1');
    const fresh = new SaveSlots(new MemorySaveStorage());
    expect(fresh.latest()).toBeUndefined();
    expect(slots.list('solo').map((s) => [s.id, s.n])).toEqual([['slot-1', 1]]);
  });

  it('lists only games with a save, the last played first; numbers single-player games', () => {
    const { slots, saveIn } = setup();
    const a = slots.create('solo');
    expect(slots.list('solo')).toEqual([]); // nothing saved yet
    saveIn(a.id);
    const b = slots.create('solo');
    // b was never saved: dropped when the next game is made, so the numbers go on from a.
    const c = slots.create('solo');
    saveIn(c.id);
    expect(c.n).toBe(2);
    expect(c.id).toBe(b.id); // b's place, never saved, taken again
    expect(slots.list('solo')).toHaveLength(2);
    slots.touch(a.id);
    expect(slots.list('solo').map((s) => s.id)).toEqual([a.id, c.id]);
    expect(slots.latest()?.id).toBe(a.id);
  });

  it('finds a room’s own game by its ID, else by its name; keeps its new ID', () => {
    const { slots, saveIn } = setup();
    const room = slots.create('room', { name: 'Lớp 12A1', id: 'ABC234' });
    saveIn(room.id);
    expect(slots.forRoom('ABC234', 'other')?.id).toBe(room.id);
    // The server was restarted: the room made again under the same name has a new ID.
    expect(slots.forRoom('XYZ789', ' lớp 12a1 ')?.id).toBe(room.id);
    slots.touch(room.id, { name: 'Lớp 12A1', id: 'XYZ789' });
    expect(slots.get(room.id)?.room?.id).toBe('XYZ789');
    expect(slots.list('room').map((s) => s.id)).toEqual([room.id]);
    expect(slots.list('solo')).toEqual([]);
  });

  it('deletes a game with its save and backup', () => {
    const { storage, slots, saveIn } = setup();
    const a = slots.create('solo');
    saveIn(a.id);
    storage.write(`simlab.save.${a.id}.backup`, '{}');
    slots.remove(a.id);
    expect(slots.list('solo')).toEqual([]);
    expect(storage.read(`simlab.save.${a.id}`)).toBeNull();
    expect(storage.read(`simlab.save.${a.id}.backup`)).toBeNull();
  });

  it('makes the list again when it is unreadable', () => {
    const { storage, slots, saveIn } = setup();
    saveIn('slot-1');
    storage.write('simlab.saves', '{not json');
    expect(slots.list('solo').map((s) => s.id)).toEqual(['slot-1']);
  });
});
