import { describe, expect, it } from 'vitest';
import { withoutEcho } from './webGemma';

describe('streamed Gemma answer without the echoed question', () => {
  const echo = 'Rơi tự do là gì?';

  it('shows nothing while the echo is still arriving', () => {
    expect(withoutEcho('Rơi tự', echo)).toBe('');
    expect(withoutEcho('Rơi tự do là gì?', echo)).toBe('');
  });

  it('drops the echo once the answer starts', () => {
    expect(withoutEcho('Rơi tự do là gì? Là chuyển động', echo)).toBe('Là chuyển động');
  });

  it('keeps an answer that does not repeat the question', () => {
    expect(withoutEcho('Rơi tự do là chuyển động', echo)).toBe('Rơi tự do là chuyển động');
    expect(withoutEcho('  Trả lời', '')).toBe('Trả lời');
  });
});
