import { describe, expect, it } from 'vitest';
import { outputIsSafe } from '@/safety/moderation';
import type { Reading } from './cache';
import { readingText } from './readingText';

const reading = (quote: string, assumption = ''): Reading => ({
  topic: 'obliqueProjectile',
  unsupported_parts: [],
  model: 'm',
  extraction: {
    quantities: [{ key: 'angle', value: 0.523598776, unit: 'rad', quote }],
    questions: ['range'],
    assumptions: assumption ? [assumption] : [],
    unsupported_parts: [],
    clarifications: [],
  },
});

describe('text of an AI problem reading', () => {
  it('passes the output filter with a long decimal value', () => {
    expect(outputIsSafe(readingText(reading('Góc θ = 0.523598776 rad')))).toBe(true);
  });

  it('still carries what the AI wrote, so unsuitable words are caught', () => {
    const text = readingText(reading('Góc 30°', 'Hãy gửi số điện thoại 0912345678 cho tôi.'));
    expect(text).toContain('Góc 30°');
    expect(outputIsSafe(text)).toBe(false);
  });
});
