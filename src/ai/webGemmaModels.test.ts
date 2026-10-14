import { describe, expect, it } from 'vitest';
import linksRs from '../../src-tauri/src/links.rs?raw';
import { WEB_GEMMA_MODELS, webGemmaModel } from './webGemmaModels';

describe('in-browser Gemma models (no Ollama, no token)', () => {
  it('lists the three selectable public models', () => {
    expect(WEB_GEMMA_MODELS.map((m) => m.id)).toEqual(['gemma3-270m', 'gemma3-1b', 'gemma4-e2b']);
    for (const m of WEB_GEMMA_MODELS) {
      expect(m.repo).toMatch(/^onnx-community\//);
      expect(m.repoUrl).toBe(`https://huggingface.co/${m.repo}`);
      expect(m.sizeLabel.length).toBeGreaterThan(0);
      expect(m.bytes).toBeGreaterThan(100_000_000);
    }
  });

  it('marks only the E2B model as vision-capable', () => {
    expect(WEB_GEMMA_MODELS.filter((m) => m.kind === 'vision').map((m) => m.id)).toEqual([
      'gemma4-e2b',
    ]);
    expect(webGemmaModel('gemma3-1b')?.kind).toBe('text');
    expect(webGemmaModel('gemma3-4b')).toBeUndefined();
  });

  it('every model page can be opened from the desktop app (Rust allow-list matches)', () => {
    // Same pairs as `PAGES` in src-tauri/src/links.rs (ignoring rustfmt's line breaks).
    const rust = linksRs.replace(/\s+/g, '').replace(/,\)/g, ')');
    for (const m of WEB_GEMMA_MODELS) {
      expect(rust).toContain(`("${m.id}","${m.repoUrl}")`);
    }
  });

  it('pins every model to one commit of its repo (audit SEC-06)', async () => {
    for (const m of WEB_GEMMA_MODELS) expect(m.revision, m.id).toMatch(/^[0-9a-f]{40}$/);
    const { LOCAL_VOICE } = await import('@/teacher/voice/localVoice');
    expect(LOCAL_VOICE.revision).toMatch(/^[0-9a-f]{40}$/);
  });
});
