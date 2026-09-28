import { AppShell } from './layout/AppShell';
import { useApplyTheme } from './theme/useApplyTheme';
import { TooltipLayer } from '@/ui/TooltipLayer';

export function App() {
  useApplyTheme();
  return (
    <>
      <AppShell />
      <TooltipLayer />
    </>
  );
}
