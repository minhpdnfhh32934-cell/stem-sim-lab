import { AppShell } from './layout/AppShell';
import { useApplyTheme } from './theme/useApplyTheme';
import { useStartupBenchmark } from '@/perf/useStartupBenchmark';
import { TooltipLayer } from '@/ui/TooltipLayer';

export function App() {
  useApplyTheme();
  useStartupBenchmark();
  return (
    <>
      <AppShell />
      <TooltipLayer />
    </>
  );
}
