import { afterEach, describe, expect, it, vi } from 'vitest';

const logged: string[] = [];
vi.mock('@/safety/safetyStore', () => ({
  logIncident: (kind: string) => {
    logged.push(kind);
  },
}));

const { installGameBridge, simlabRooms } = await import('./gameBridge');

afterEach(() => {
  logged.length = 0;
});

describe("the game's LAN chat goes through SimLab's checks (#339)", () => {
  it('a line with personal details is not sent; the log keeps its kind only', () => {
    expect(simlabRooms.check('Mình làm thí nghiệm rơi tự do nhé')).toBe(true);
    expect(simlabRooms.check('Số điện thoại của mình là 0912345678')).toBe(false);
    expect(logged).toEqual(['inputPersonalData']);
  });

  it("another player's line with contact details is hidden", () => {
    expect(simlabRooms.safe('Đo lại góc ném đi')).toBe(true);
    expect(simlabRooms.safe('gọi mình 0912345678')).toBe(false);
    expect(logged).toEqual(['outputUnsafe']);
  });

  it('"Báo cáo" logs a report; the bridge is on the window only while the game is open', () => {
    simlabRooms.report();
    expect(logged).toEqual(['userReport']);
    const w = window as unknown as { simlabRooms?: unknown };
    const uninstall = installGameBridge();
    expect(w.simlabRooms).toBe(simlabRooms);
    uninstall();
    expect(w.simlabRooms).toBeUndefined();
  });
});
