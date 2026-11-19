import { afterEach, describe, expect, it, vi } from 'vitest';

/** simlabHost.ts reads VITE_SIMLAB_EMBED once, when it loads: each case loads it again. */
async function load(embedded: boolean, bridge?: unknown) {
  vi.resetModules();
  vi.stubEnv('VITE_SIMLAB_EMBED', embedded ? '1' : '');
  vi.stubGlobal('window', { parent: bridge === undefined ? {} : { simlabRooms: bridge } });
  return import('./simlabHost');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('the game inside SimLab: room server and chat checks (#339)', () => {
  it("inside SimLab every line goes through SimLab's checks, and reports reach it", async () => {
    const report = vi.fn();
    const host = await load(true, {
      check: (text: string) => !text.includes('0912'),
      safe: (text: string) => !text.includes('xấu'),
      report,
    });
    expect(host.SIMLAB_ROOMS_ORIGIN).toBe('http://127.0.0.1:5189');
    expect(host.chatAllowed('Chào cả phòng')).toBe(true);
    expect(host.chatAllowed('số em là 0912345678')).toBe(false);
    expect(host.chatShown('Làm thí nghiệm nhé')).toBe(true);
    expect(host.chatShown('lời xấu')).toBe(false);
    host.reportChat();
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('inside SimLab without its checks nothing is sent or shown (closed, never open)', async () => {
    const host = await load(true);
    expect(host.chatAllowed('Chào')).toBe(false);
    expect(host.chatShown('Chào')).toBe(false);
    expect(() => host.reportChat()).not.toThrow();
  });

  it('the game on its own is unchanged', async () => {
    const host = await load(false);
    expect(host.EMBEDDED).toBe(false);
    expect(host.chatAllowed('anything')).toBe(true);
    expect(host.chatShown('anything')).toBe(true);
  });
});
