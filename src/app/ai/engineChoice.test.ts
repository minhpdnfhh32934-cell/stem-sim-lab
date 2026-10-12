import { describe, expect, it } from 'vitest';
import { analysisEngineFor } from './engineChoice';

describe('engine for problem analysis and chat', () => {
  it('uses the API unless Gemma is selected', () => {
    expect(analysisEngineFor('cloud', true, true)).toBe('cloud');
  });
  it('uses Gemma whenever its model is ready', () => {
    expect(analysisEngineFor('gemma', false, true)).toBe('gemma');
    expect(analysisEngineFor('gemma', true, true)).toBe('gemma');
  });
  it('a default (not chosen) Gemma without a model falls back to the API', () => {
    expect(analysisEngineFor('gemma', false, false)).toBe('cloud');
  });
  it('a Gemma the learner chose never silently goes online', () => {
    expect(analysisEngineFor('gemma', true, false)).toBe('gemma-missing');
  });
});
