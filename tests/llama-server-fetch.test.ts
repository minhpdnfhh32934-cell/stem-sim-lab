import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KEEP,
  LLAMA,
  STAMP,
  URL,
  checkZip,
  isCurrent,
} from '../scripts/llama/fetch-llama-server.mjs';

describe('pinned llama-server for Qwen inside the app (#190)', () => {
  it('pins the same build as docs/AI_TUTOR.md, from the llama.cpp releases only', () => {
    const doc = readFileSync('docs/AI_TUTOR.md', 'utf8');
    for (const v of [LLAMA.tag, LLAMA.commit, LLAMA.file, LLAMA.sha256]) expect(doc).toContain(v);
    expect(doc).toContain('37 892 147 bytes');
    expect(LLAMA.size).toBe(37892147);
    expect(URL).toBe(
      'https://github.com/ggml-org/llama.cpp/releases/download/b12246/llama-b12246-bin-win-vulkan-x64.zip',
    );
  });

  it('keeps one program, the server, with its Vulkan and CPU backends', () => {
    expect(KEEP.filter((f) => f.endsWith('.exe'))).toEqual(['llama-server.exe']);
    expect(KEEP).toEqual(expect.arrayContaining(['ggml-vulkan.dll', 'ggml-cpu-x64.dll']));
    expect(new Set(KEEP).size).toBe(KEEP.length);
    // Not shipped: the CUDA build, the RPC backend, and every other llama.cpp tool.
    expect(KEEP.some((f) => /cuda|rpc|cli|bench|quantize/i.test(f))).toBe(false);
  });

  it('refuses a zip of the wrong size or SHA-256', () => {
    const bytes = Buffer.from('not the zip');
    const pin = {
      ...LLAMA,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    expect(() => {
      checkZip(bytes, pin);
    }).not.toThrow();
    expect(() => {
      checkZip(Buffer.from('not the zap'), pin);
    }).toThrow(/SHA-256/);
    expect(() => {
      checkZip(bytes);
    }).toThrow(/bytes, expected 37892147/);
  });

  it('counts a folder as current only with the stamp of this pin and every kept file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llama-'));
    try {
      for (const f of KEEP) writeFileSync(join(dir, f), '');
      expect(isCurrent(dir)).toBe(false);
      writeFileSync(join(dir, STAMP), 'another-sha\n');
      expect(isCurrent(dir)).toBe(false);
      writeFileSync(join(dir, STAMP), `${LLAMA.sha256}\n`);
      expect(isCurrent(dir)).toBe(true);
      rmSync(join(dir, 'ggml-vulkan.dll'));
      expect(isCurrent(dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('git ignores the fetched files but keeps the llama.cpp licence that ships beside them', () => {
    const ignore = readFileSync('.gitignore', 'utf8');
    expect(ignore).toContain('src-tauri/binaries/llama-server/*');
    expect(ignore).toContain('!src-tauri/binaries/llama-server/LICENSE-llama.cpp.txt');
    const licence = readFileSync('src-tauri/binaries/llama-server/LICENSE-llama.cpp.txt', 'utf8');
    expect(licence).toMatch(/^MIT License/);
    expect(licence).toContain('The ggml authors');
  });
});
