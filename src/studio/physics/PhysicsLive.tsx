import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DriverGrid } from '@/app/bench/DriverGrid';
import { useStudioSlot } from '@/app/bench/studioSlot';
import { Stage } from '@/app/layout/Stage';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import type { ParamSource } from '@/physics/types';
import type { StepProps } from '../flow/types';
import { conditionParams, physicsOf } from './comparison';
import { useScene } from './usePhysics';

/**
 * The bench's live stage beside a physics lesson (docs/BENCH_DESIGN.md §9.7): the lab's own scene
 * and engine at the lesson's condition B (what the learner set in it), with the bench edge's
 * player. The learner may run and drag it as in the lab; the lesson's numbers still come from its
 * own runs of the same engine (`getComparison`), so nothing here changes the evidence.
 */
export function PhysicsLive({ scenario, session }: StepProps) {
  const g = useSettingsStore((s) => s.defaultGravity);
  const ctx = physicsOf(scenario);
  const { scene } = useScene(ctx?.b.scene ?? '');
  const inputs = JSON.stringify(session.inputs);
  const slot = useStudioSlot((s) => s.el);
  const opened = useRef(-1);

  useEffect(() => {
    if (!scene || !ctx) return;
    const { B } = conditionParams(scene, scenario, ctx.b, ctx.poe, session.inputs, g);
    const changed = new Set([...ctx.b.controls, ctx.poe.param, ...Object.keys(scenario.initial)]);
    const sources: Record<string, ParamSource> = {};
    for (const key of Object.keys(B)) sources[key] = changed.has(key) ? 'user' : 'default';
    void sim.open(scene.id, { params: B, sources });
    opened.current = sim.openCount;
    // The inputs' text stands for the inputs (the session object changes on every keystroke).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, inputs, g, scenario]);

  // Leaving the lesson closes the stage's run, unless something opened another one since (the
  // lesson's "Mở trong Phòng thí nghiệm" opens the lab's own run before this view goes).
  useEffect(
    () => () => {
      if (sim.openCount === opened.current) sim.shutdown();
    },
    [],
  );

  if (!slot) return null;
  return createPortal(
    <div className="studio-live">
      <div className="studio-live__stage">
        <Stage />
      </div>
      <DriverGrid />
    </div>,
    slot,
  );
}
