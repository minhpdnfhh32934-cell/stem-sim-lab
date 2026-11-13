import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import { CharacterDefinitionSchema } from '../../../gameplay/character';
import { SEATS, Seating } from './seating';

// The character page's room (C-9): everyone in their place, chosen left to right; the one chosen
// stays where they are and looks at the camera; a pair at a table takes turns talking.

const people = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'custom'];

describe('seating', () => {
  it('has its places left to right as the camera sees them', () => {
    for (let i = 1; i < SEATS.length; i++) expect(SEATS[i]!.x).toBeGreaterThan(SEATS[i - 1]!.x);
    // Partners are each other's.
    SEATS.forEach((s, i) => {
      if (s.partner !== undefined) expect(SEATS[s.partner]!.partner).toBe(i);
    });
  });

  it('chooses left to right, wrapping both ways', () => {
    const room = new Seating(people, 'a');
    expect(room.step(1)).toBe('b');
    expect(room.step(-1)).toBe('a');
    expect(room.step(-1)).toBe('custom');
    expect(room.step(1)).toBe('a');
    room.select('e');
    expect(room.selected).toBe('e');
    room.select('nobody');
    expect(room.selected).toBe('e');
  });

  it('keeps everyone in their place; the one chosen looks at the camera, lit up', () => {
    const room = new Seating(people, 'a');
    const before = room.view();
    room.step(1);
    room.update(5);
    const after = room.view();
    for (const [i, v] of after.entries()) {
      expect([v.x, v.z, v.heading]).toEqual([before[i]!.x, before[i]!.z, before[i]!.heading]);
      expect(v.speed).toBe(0);
    }
    const chosen = after.filter((v) => v.called);
    expect(chosen.map((v) => [v.id, v.look])).toEqual([['b', 'camera']]);
    // Standing, the chosen one strikes their pose; seated, they put down what they hold.
    expect(after[1]!.gesture).toBe('pose');
    room.select('a');
    expect(room.view()[0]!.gesture).toBe('idle');
  });

  it('has a pair take turns: one talks while the other listens, looking at each other', () => {
    const room = new Seating(people, 'a');
    const pair = SEATS.findIndex((s) => s.partner !== undefined);
    const other = SEATS[pair]!.partner!;
    let swaps = 0;
    let last = '';
    for (let t = 0; t < 30; t += 0.25) {
      room.update(0.25);
      const v = room.view();
      expect([v[pair]!.gesture, v[other]!.gesture].sort()).toEqual(['listen', 'talk']);
      expect(v[pair]!.look).toBe(people[other]);
      if (v[pair]!.gesture !== last) swaps++;
      last = v[pair]!.gesture;
    }
    expect(swaps).toBeGreaterThan(4);
  });

  it('refuses more people than places', () => {
    expect(() => new Seating([...people, 'x'], 'a')).toThrow();
  });

  it('gives the cast one place each, left to right from the first, the last left for the player', () => {
    const seats = (bundledContent.characters as unknown[])
      .map((c) => CharacterDefinitionSchema.parse(c).profile.seat)
      .sort((a, b) => a - b);
    expect(seats).toEqual(seats.map((_, i) => i));
    expect(seats.length).toBe(SEATS.length - 1);
  });
});
