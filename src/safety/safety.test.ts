import { describe, expect, it } from 'vitest';
import { BrowserSafety, TERMS_VERSION, statusOf } from './safety';

// Same cases as the Rust tests in src-tauri/src/safety.rs.
describe('safety rule', () => {
  it('AI only after "18+ and terms"', () => {
    expect(statusOf({})).toMatchObject({ answered: false, aiAllowed: false });
    expect(statusOf({ adultTerms: TERMS_VERSION }).aiAllowed).toBe(true);
    expect(statusOf({ adultTerms: TERMS_VERSION - 1 }).aiAllowed).toBe(false);
    expect(statusOf({ declaredMinor: true })).toMatchObject({
      answered: true,
      minor: true,
      aiAllowed: false,
    });
  });
});

describe('browser copy of the safety layer', () => {
  const fixed = () => new Date('2026-10-05T10:00:00');

  it('stores the answer', async () => {
    const s = new BrowserSafety(fixed);
    expect((await s.answerAdult(true)).aiAllowed).toBe(true);
    expect((await s.answerAdult(false)).aiAllowed).toBe(false);
  });

  it('keeps an incident log of kind and time only', async () => {
    const s = new BrowserSafety(fixed);
    await s.clearIncidents();
    await s.logIncident('userReport');
    const log = await s.incidents();
    expect(log.map((i) => i.kind)).toEqual(['userReport']);
    expect(Object.keys(log[0] ?? {}).sort()).toEqual(['at', 'kind']);
    await s.clearIncidents();
    expect(await s.incidents()).toEqual([]);
  });
});
