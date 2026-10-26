import { useEffect } from 'react';
import { useOnboardingPhase } from '@/app/learner/onboardingPhase';
import { TourOverlay } from '@/app/project/Tour';
import { GUIDE_STEPS } from './guideSteps';
import { useStudioStore } from './studioStore';

/**
 * Science Studio's "Cách học" guide: opens by itself on the first visit (once, remembered in
 * `stemsim.studio`), then only from the button. It waits for the first-run questions.
 */
export function StudioGuide() {
  const step = useStudioStore((s) => s.guideStep);
  const seen = useStudioStore((s) => s.guideSeen);
  const ready = ['tour', 'done'].includes(useOnboardingPhase());
  useEffect(() => {
    if (ready && !seen) useStudioStore.getState().openGuide();
  }, [ready, seen]);
  // Leaving the studio closes the guide (its targets are gone).
  useEffect(
    () => () => {
      useStudioStore.getState().closeGuide();
    },
    [],
  );
  if (step === null || !ready) return null;
  return (
    <TourOverlay
      steps={GUIDE_STEPS}
      step={step}
      onStep={useStudioStore.getState().setGuideStep}
      onEnd={useStudioStore.getState().closeGuide}
    />
  );
}
