import { describe, expect, it } from 'vitest';
import { formatBytes } from './format';

describe('formatBytes', () => {
  it('writes sizes with the learner’s decimal mark', () => {
    expect(formatBytes(3_800_000_000, 'vi')).toBe('3,80 GB');
    expect(formatBytes(3_800_000_000, 'en')).toBe('3.80 GB');
    expect(formatBytes(343_200_000, 'vi')).toBe('343,2 MB');
    expect(formatBytes(512_000, 'vi')).toBe('512 KB');
  });
});
