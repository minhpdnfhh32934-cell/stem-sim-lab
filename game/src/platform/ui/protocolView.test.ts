import { describe, expect, it } from 'vitest';
import { ENGLISH } from '../../core/i18n';
import { bootTestGame } from '../../game/testing';
import type { ProcedureView } from '../../gameplay/procedure/ProcedureSystem';
import { protocolRows } from './protocolView';

// The protocol the HUD draws for a procedure: its stages done, current or not started, then the
// entrance locked until it opens — from the procedure's own view, for each status it can have.

const ENTRANCE = 'Enter the clean area (SIMLAB Hub)';

async function cleanroom() {
  const { game } = await bootTestGame();
  const definition = game.content.procedures.get('cleanroom-entry');
  game.dispose();
  /** The view after `completed` steps, as ProcedureSystem.view gives it. */
  return (completed: number, status: ProcedureView['status']): ProcedureView => ({
    definition,
    status,
    completed,
    total: definition.steps.length,
    step: definition.steps[completed] ?? null,
    stageLabel: null,
    missingEquipment: [],
    timer: null,
    lastHands: null,
  });
}

const states = (view: ProcedureView) =>
  protocolRows(view, ENTRANCE, ENGLISH).map(
    (r) => `${r.label}: ${r.state}${r.progress ? ` ${r.progress}` : ''}`,
  );

describe('the preparation protocol', () => {
  it('starts on its first stage, the entrance locked', async () => {
    const view = await cleanroom();
    expect(states(view(0, 'not-started'))).toEqual([
      'Briefing: current',
      'Gowning: pending',
      'Hand washing: pending',
      'Hand disinfection: pending',
      'Gloves: pending',
      `${ENTRANCE}: locked`,
    ]);
  });

  it('marks finished stages done and counts the steps of the current one', async () => {
    const view = await cleanroom();
    // Rules read, coat and goggles on, water on, hands wet: the third step of hand washing next.
    expect(states(view(5, 'in-progress'))).toEqual([
      'Briefing: done',
      'Gowning: done',
      'Hand washing: current 3/10',
      'Hand disinfection: pending',
      'Gloves: pending',
      `${ENTRANCE}: locked`,
    ]);
  });

  it('keeps the entrance locked while equipment is missing after the last step', async () => {
    const view = await cleanroom();
    expect(states(view(15, 'in-progress')).slice(-2)).toEqual([
      'Gloves: done',
      `${ENTRANCE}: locked`,
    ]);
  });

  it('makes the open entrance the current row, then done once walked through', async () => {
    const view = await cleanroom();
    expect(states(view(15, 'ready')).at(-1)).toBe(`${ENTRANCE}: current`);
    expect(states(view(15, 'entered')).every((s) => s.endsWith(': done'))).toBe(true);
  });
});
