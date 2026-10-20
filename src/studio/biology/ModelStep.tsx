import { useMemo } from 'react';
import { Mitosis3DParts } from '@/biology/division/mitosis3d/panels';
import { MitosisStage } from '@/biology/division/views';
import type { StepProps } from '../flow/types';
import { FindParts } from './FindParts';
import { bindingProblems, biologyOf } from './model';
import { BindingError } from './parts';
import { StageRecorder } from './StageRecorder';
import { useLessonModel } from './useModel';
import './biology.css';

/**
 * Interact: the existing mitosis view (3D with tap-to-pick, or its 2D fallback) and its parts
 * list, with the stage recorder and the part-finding activity next to it.
 */
export function ModelStep(props: StepProps) {
  const b = biologyOf(props.scenario);
  const ok = useMemo(() => b !== null && bindingProblems(b).length === 0, [b]);
  useLessonModel(ok ? b : null);
  if (!b || !ok) return <BindingError />;
  return (
    <div className="studio-stack bio-studio">
      <div className="bio-studio__model">
        <MitosisStage />
      </div>
      <Mitosis3DParts />
      <div className="bio-studio__panels">
        <StageRecorder {...props} b={b} />
        <FindParts {...props} b={b} />
      </div>
    </div>
  );
}
