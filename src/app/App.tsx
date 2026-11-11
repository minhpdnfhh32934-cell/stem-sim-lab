import BenchShell from './bench/BenchShell';
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
      <BenchShell />
      <AgeGate hold={!onboarded} />
      <PrivacyDialog />
      <TooltipLayer />
    </>
  );
}
