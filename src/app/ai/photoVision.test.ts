import { describe, expect, it } from 'vitest';
import { PHOTO_SYSTEM, PHOTO_UNREADABLE, cleanTranscription } from './photoVision';

describe('photo transcription helpers', () => {
  it('rejects empty and unreadable readings', () => {
    expect(cleanTranscription('   ')).toBeNull();
    expect(cleanTranscription(`abc ${PHOTO_UNREADABLE} def`)).toBeNull();
  });

  it('keeps readable text, capped for the problem box', () => {
    expect(cleanTranscription('  Một vật rơi tự do.  ')).toBe('Một vật rơi tự do.');
    expect(cleanTranscription('x'.repeat(9000))?.length).toBe(4000);
  });

  it('asks for transcription only, in both languages', () => {
    expect(PHOTO_SYSTEM.vi).toContain(PHOTO_UNREADABLE);
    expect(PHOTO_SYSTEM.en).toContain(PHOTO_UNREADABLE);
  });
});
