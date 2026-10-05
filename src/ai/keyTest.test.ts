import { describe, expect, it } from 'vitest';
import { classifyKeyTest, maskKey } from './keyTest';

describe('key test (same rules as the Rust gateway)', () => {
  it.each([
    [200, '{}', 'ok'],
    [
      400,
      '{"error":{"message":"API key not valid.","details":[{"reason":"API_KEY_INVALID"}]}}',
      'badKey',
    ],
    [401, '{"error":{"type":"authentication_error"}}', 'badKey'],
    [404, 'models/x is not found', 'badModel'],
    [429, 'RESOURCE_EXHAUSTED', 'quota'],
    [400, '{"error":{"message":"Your credit balance is too low"}}', 'quota'],
    [500, 'oops', 'error'],
  ] as const)('HTTP %i → %s', (status, body, expected) => {
    expect(classifyKeyTest(status, body)).toBe(expected);
  });

  it('shows only the last 4 characters', () => {
    expect(maskKey('AIzaSyA-1234567890abcd')).toBe('••••••••abcd');
    expect(maskKey('abcd')).toBe('••••••••');
  });
});
