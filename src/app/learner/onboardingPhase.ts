import { useAiStore } from '@/ai/aiStore';
import { useProjectUi } from '@/app/project/uiStore';
import { useGateVisible, useSafetyStore } from '@/safety/safetyStore';
import { useProfileStore } from './profileStore';

/**
 * First-run order (PROMPT_PHAN_2 A4.2):
 * - main:  level → subjects → 18+ and terms (AgeGate) → "Kết nối AI" (with "Để sau") → tour;
 * - pilot: subject → age gate / parental consent (supervisor PIN) → tour. No key step.
 * Each piece shows only in its phase, so two dialogs never stack.
 */
export type OnboardingPhase = 'profile' | 'loading' | 'gate' | 'connect' | 'tour' | 'done';

export function useOnboardingPhase(): OnboardingPhase {
  const onboarded = useProfileStore((s) => s.onboarded);
  const connectSeen = useProfileStore((s) => s.connectSeen);
  const loaded = useSafetyStore((s) => s.status !== null);
  const gate = useGateVisible();
  // Only when AI is allowed but has no key (not for "under 18" or an already saved key).
  const noKey = useAiStore((s) => s.status === 'noKey' && s.provider !== 'off');
  const tour = useProjectUi((s) => s.tourStep !== null);
  if (!onboarded) return 'profile';
  if (!loaded) return 'loading';
  if (gate) return 'gate';
  if (__EDITION__ === 'main' && !connectSeen && noKey) return 'connect';
  return tour ? 'tour' : 'done';
}
