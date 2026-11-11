import { lazy, Suspense } from 'react';
import { ProblemDialog } from '@/app/ai/ProblemDialog';
import { useCommandPalette } from '@/app/command/commands';
import { Onboarding } from '@/app/learner/Onboarding';
import { Tour } from '@/app/project/Tour';
import { useProjectUi } from '@/app/project/uiStore';
import '@/app/project/project.css';
import { ShowcaseOverlay } from '@/app/showcase/ShowcaseOverlay';
import { UpdateDialog } from '@/app/update/UpdateDialog';
import { WhatsNewDialog } from '@/app/whatsnew/WhatsNewDialog';
import { GpuRestartReminder } from '@/teacher/chat/GpuSettings';
import { Toaster } from '@/ui/Toaster';

const SourcesDialog = lazy(() => import('@/app/project/SourcesDialog'));
// Quick search (Ctrl+K) loads on first use; the shortcut and the header button only flip a flag.
const CommandPalette = lazy(() =>
  import('@/app/command/CommandPalette').then((m) => ({ default: m.CommandPalette })),
);

/** Dialogs and overlays over every room (problem review, first run, updates, palette…). */
export function ShellOverlays({ presentation }: { presentation: boolean }) {
  const sourcesOpen = useProjectUi((s) => s.sourcesOpen);
  const paletteUsed = useCommandPalette((s) => s.used);
  return (
    <>
      <ProblemDialog />
      {sourcesOpen && (
        <Suspense fallback={null}>
          <SourcesDialog />
        </Suspense>
      )}
      <Onboarding />
      <Tour />
      <UpdateDialog />
      <WhatsNewDialog />
      <Toaster />
      <ShowcaseOverlay />
      {paletteUsed && (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      )}
      {!presentation && <GpuRestartReminder />}
    </>
  );
}
