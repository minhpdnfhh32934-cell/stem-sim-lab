import { AppShell } from './layout/AppShell';
import { useApplyTheme } from './theme/useApplyTheme';
import { useStartupBenchmark } from '@/perf/useStartupBenchmark';
import { TooltipLayer } from '@/ui/TooltipLayer';
import { AgeGate } from '@/safety/AgeGate';
import { PrivacyDialog } from '@/safety/PrivacyDialog';
import { useProfileStore } from './learner/profileStore';

export function App() {
  useApplyTheme();
  useStartupBenchmark();
  const onboarded = useProfileStore((s) => s.onboarded);
  return (
    <>
      <AppShell />
      <AgeGate hold={!onboarded} />
      <PrivacyDialog />
      <TooltipLayer />
    </>
  );
}
