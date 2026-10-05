import { describe, expect, it } from 'vitest';
import { BrowserSafety, TERMS_VERSION, isMinorByYear, statusOf, validPin } from './safety';

// Same cases as the Rust tests in src-tauri/src/safety.rs.
describe('safety rules', () => {
  it('main edition: AI only after "18+ and terms"', () => {
    expect(statusOf({}, false, 2026)).toMatchObject({ answered: false, aiAllowed: false });
    expect(statusOf({ adultTerms: TERMS_VERSION }, false, 2026).aiAllowed).toBe(true);
    expect(statusOf({ adultTerms: TERMS_VERSION - 1 }, false, 2026).aiAllowed).toBe(false);
    expect(statusOf({ declaredMinor: true }, false, 2026)).toMatchObject({
      answered: true,
      minor: true,
      aiAllowed: false,
    });
  });

  it('pilot edition: minors need recorded consent, adults do not', () => {
    expect(statusOf({ birthYear: 2010 }, true, 2026)).toMatchObject({
      answered: true,
      minor: true,
      aiAllowed: false,
    });
    expect(statusOf({ birthYear: 2010, consentDay: '2026-10-05' }, true, 2026).aiAllowed).toBe(
      true,
    );
    expect(statusOf({ birthYear: 2000 }, true, 2026)).toMatchObject({
      minor: false,
      aiAllowed: true,
    });
    expect(statusOf({}, true, 2026).aiAllowed).toBe(false);
  });

  it('counts the boundary birth year as a minor', () => {
    expect(isMinorByYear(2008, 2026)).toBe(true);
    expect(isMinorByYear(2007, 2026)).toBe(false);
  });

  it('accepts 4–8 digit PINs only', () => {
    expect(validPin('1234') && validPin('12345678')).toBe(true);
    expect(validPin('123') || validPin('12a4') || validPin('123456789')).toBe(false);
  });
});

describe('browser copy of the safety layer', () => {
  const fixed = () => new Date('2026-10-05T10:00:00');

  it('main edition: answers are stored and refuse the pilot-only steps', async () => {
    const s = new BrowserSafety(false, fixed);
    expect((await s.answerAdult(true)).aiAllowed).toBe(true);
    expect((await s.answerAdult(false)).aiAllowed).toBe(false);
    await expect(s.setPin('1234')).rejects.toMatchObject({ code: 'notAllowed' });
  });

  it('pilot edition: PIN, consent, session and incident log', async () => {
    const s = new BrowserSafety(true, fixed);
    await expect(s.answerAdult(true)).rejects.toMatchObject({ code: 'notAllowed' });
    expect((await s.setBirthYear(2010)).aiAllowed).toBe(false);
    const withPin = await s.setPin('2468');
    expect(withPin.pinSet).toBe(true);
    expect(localStorage.getItem('stemsim.safety')).not.toContain('2468');
    // Setting the PIN opens the supervisor session: consent without retyping it.
    expect((await s.recordConsent('2026-10-05')).aiAllowed).toBe(true);
    await s.lock();
    // Locked: a student cannot change the birth year or read the log without the PIN.
    await expect(s.setBirthYear(2000)).rejects.toMatchObject({ code: 'wrongPin' });
    await expect(s.incidents('0000')).rejects.toMatchObject({ code: 'wrongPin' });
    const log = await s.incidents('2468');
    expect(log.map((i) => i.kind)).toEqual(['pinFailed', 'pinFailed']);
    expect(Object.keys(log[0] ?? {}).sort()).toEqual(['at', 'kind']);
    await s.clearIncidents('2468');
    expect(await s.incidents('2468')).toEqual([]);
  });
});
