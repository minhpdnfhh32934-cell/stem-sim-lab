import { AppShell } from './layout/AppShell';
import { useApplyTheme } from './theme/useApplyTheme';
import { useStartupBenchmark } from '@/perf/useStartupBenchmark';
import { TooltipLayer } from '@/ui/TooltipLayer';
import { AgeGate } from '@/safety/AgeGate';
import { PrivacyDialog } from '@/safety/PrivacyDialog';

export function App() {
  useApplyTheme();
  useStartupBenchmark();
  return (
    <>
      <AppShell />
      <AgeGate />
      <PrivacyDialog />
      <TooltipLayer />
    </>
  );
}
