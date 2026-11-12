import { ProblemDialog } from '@/app/ai/ProblemDialog';
import { useCommandPalette } from '@/app/command/commands';
import { useT } from '@/app/i18n';
import { Onboarding } from '@/app/learner/Onboarding';
import { Tour } from '@/app/project/Tour';
import { useProjectUi } from '@/app/project/uiStore';
import '@/app/project/project.css';
import { ShowcaseOverlay } from '@/app/showcase/ShowcaseOverlay';
import { UpdateDialog } from '@/app/update/UpdateDialog';
import { WhatsNewDialog } from '@/app/whatsnew/WhatsNewDialog';
import { GpuRestartReminder } from '@/teacher/chat/GpuSettings';
import { Toaster } from '@/ui/Toaster';
import { useLoaded, type Loaded } from './useLoaded';

const palette: Loaded = { Component: null };
const sources: Loaded = { Component: null };
const loadPalette = () => import('@/app/command/CommandPalette').then((m) => m.CommandPalette);
const loadSources = () => import('@/app/project/SourcesDialog').then((m) => m.default);
// A failed load withdraws the request: the next Ctrl+K or "Nguồn & Giả định" tries again.
const resetPalette = () => {
  useCommandPalette.setState({ open: false, used: false });
};
const resetSources = () => {
  useProjectUi.setState({ sourcesOpen: false });
};

/** Dialogs and overlays over every room (problem review, first run, updates, palette…). */
export function ShellOverlays({ presentation }: { presentation: boolean }) {
  const sourcesOpen = useProjectUi((s) => s.sourcesOpen);
  const paletteUsed = useCommandPalette((s) => s.used);
  // The shortcut and the header button only flip a flag; the code loads on first use.
  const t = useT();
  const paletteLoaded = useLoaded(
    palette,
    paletteUsed,
    loadPalette,
    t('bench.loadFailed'),
    resetPalette,
  );
  const sourcesLoaded = useLoaded(
    sources,
    sourcesOpen,
    loadSources,
    t('bench.loadFailed'),
    resetSources,
  );
  return (
    <>
      <ProblemDialog />
      {sourcesOpen && sourcesLoaded && sources.Component && <sources.Component />}
      <Onboarding />
      <Tour />
      <UpdateDialog />
      <WhatsNewDialog />
      <Toaster />
      <ShowcaseOverlay />
      {paletteLoaded && palette.Component && <palette.Component />}
      {!presentation && <GpuRestartReminder />}
    </>
  );
}
