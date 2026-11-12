import { describe, expect, it } from 'vitest';
import { glideFrom } from './glide';

describe('the orb glides between layouts', () => {
  it('a large orb above the chat → the small corner one: starts where and as big as it was', () => {
    // talk: 200 px at (583, 120); board: 88 px at (24, 112).
    expect(glideFrom({ left: 583, top: 120, width: 200 }, { left: 24, top: 112, width: 88 })).toBe(
      `translate(559px, 8px) scale(${String(200 / 88)})`,
    );
  });

  it('and back: the corner orb grows from its corner', () => {
    expect(glideFrom({ left: 24, top: 112, width: 88 }, { left: 583, top: 120, width: 200 })).toBe(
      'translate(-559px, -8px) scale(0.44)',
    );
  });

  it('nothing to play when the box has not moved, or is not laid out', () => {
    const box = { left: 10, top: 20, width: 100 };
    expect(glideFrom(box, { ...box })).toBeNull();
    expect(glideFrom(box, { left: 0, top: 0, width: 0 })).toBeNull();
    expect(glideFrom({ left: 0, top: 0, width: 0 }, box)).toBeNull();
  });
});
