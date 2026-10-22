import { describe, expect, it } from 'vitest';
import { lotkaVolterra, lvDrift } from '../ecology';
import { lvModel3d, momentAt, momentOf, type LvModel3D } from './binding';
import { CALLOUTS, CAPTION, readout, sceneTexts, selectionCard } from './facts';

const P = { alpha: 1, beta: 0.1, delta: 0.075, gamma: 1.5 };
const model = (): LvModel3D => {
  const traj = lotkaVolterra(P, 10, 5, 30, 800);
  return lvModel3d({ p: P, traj, tEnd: 30, drift: lvDrift(P, traj) }, 200);
};
/** A plain formatter (the view passes the learner's locale). */
const fmt = (v: number, d = 3) => String(Number(v.toPrecision(d)));

describe('predator–prey 3D texts', () => {
  it('the readout is the sample’s t, x and y', () => {
    const m = model();
    const s = momentAt(m, 12);
    expect(readout(s, fmt)).toBe(`t = 12 · x = ${fmt(s.x, 4)} · y = ${fmt(s.y, 4)}`);
  });

  it('cards carry the model’s numbers and the right reason for each trend', () => {
    const m = model();
    // Find a sample where the prey grow and the predators shrink, and one the other way round.
    let grow = -1;
    let fall = -1;
    for (let k = 0; k < m.traj.t.length; k++) {
      const s = momentOf(m, k);
      if (grow < 0 && s.dxdt > 0 && s.dydt < 0 && s.shown.prey > 0 && s.shown.predators > 0)
        grow = k;
      if (fall < 0 && s.dxdt < 0 && s.dydt > 0 && s.shown.prey > 0 && s.shown.predators > 0)
        fall = k;
    }
    expect(grow).toBeGreaterThanOrEqual(0);
    expect(fall).toBeGreaterThanOrEqual(0);
    const g = momentOf(m, grow);
    const prey = selectionCard(m, g, { kind: 'prey', slot: 0 }, fmt);
    const preyText = prey?.lines.map((l) => l.vi).join(' ') ?? '';
    expect(preyText).toContain('Hình này là 1 cá thể.');
    expect(preyText).toContain(`x = ${fmt(g.x, 4)} con mồi, y = ${fmt(g.y, 4)} vật ăn thịt`);
    expect(preyText).toContain('nên con mồi đang tăng');
    expect(preyText).toContain(`y* = α/β = ${fmt(m.eq.y, 4)}`);
    expect(preyText).toContain(`dx/dt = αx − βxy = ${fmt(g.dxdt, 3)}`);
    const pred = selectionCard(m, g, { kind: 'predator', slot: 0 }, fmt);
    const predText = pred?.lines.map((l) => l.vi).join(' ') ?? '';
    expect(predText).toContain('nên vật ăn thịt đang giảm');
    expect(predText).toContain(`x* = γ/δ = ${fmt(m.eq.x, 4)}`);
    expect(predText).toContain(`dy/dt = δxy − γy = −${fmt(-g.dydt, 3)}`);
    const f = momentOf(m, fall);
    const cols = selectionCard(m, f, { kind: 'columns' }, fmt)
      ?.lines.map((l) => l.vi)
      .join(' ');
    expect(cols).toContain('nên con mồi đang giảm');
    expect(cols).toContain('nên vật ăn thịt đang tăng');
    expect(cols).toContain(`= ${fmt(m.rateRef, 3)} cá thể/đơn vị t`);
    const board = selectionCard(m, f, { kind: 'board' }, fmt)
      ?.lines.map((l) => l.vi)
      .join(' ');
    expect(board).toContain(`(x, y) = (${fmt(f.x, 4)}; ${fmt(f.y, 4)})`);
    expect(board).toContain(`= (${fmt(m.eq.x, 4)}; ${fmt(m.eq.y, 4)})`);
    expect(board).toContain(`2π/√(αγ) = ${fmt(m.eq.period, 3)}`);
    expect(board).toContain(
      `V = δx − γ ln x + βy − α ln y = ${f.V < 0 ? `−${fmt(-f.V, 6)}` : fmt(f.V, 6)}`,
    );
  });

  it('a pick that is no longer drawn has no card; every text has both languages', () => {
    const m = model();
    const s = momentAt(m, 0);
    expect(selectionCard(m, s, { kind: 'prey', slot: s.shown.prey }, fmt)).toBeNull();
    expect(selectionCard(m, s, { kind: 'predator', slot: s.shown.predators }, fmt)).toBeNull();
    const all = [
      CAPTION,
      ...Object.values(CALLOUTS),
      ...(['columns', 'board'] as const).flatMap((kind) => {
        const c = selectionCard(m, s, { kind }, fmt);
        return c ? [c.title, ...c.lines] : [];
      }),
    ];
    for (const t of all) {
      expect(t.vi.length).toBeGreaterThan(0);
      expect(t.en.length).toBeGreaterThan(0);
    }
    const tx = sceneTexts(m, fmt, (t) => t.en);
    expect(tx.columns.xStar).toBe(`x* = ${fmt(m.eq.x, 4)}`);
    expect(tx.columns.yStar).toBe(`y* = ${fmt(m.eq.y, 4)}`);
    expect(tx.board.title).toBe('Phase plane (x, y)');
  });
});
