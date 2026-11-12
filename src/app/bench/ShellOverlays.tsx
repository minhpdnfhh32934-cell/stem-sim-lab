import { useEffect, useState, type ComponentType } from 'react';
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

/** A dialog's code, loaded the first time it is needed (start-up stays light). */
interface Loaded {
  Component: ComponentType | null;
}
const palette: Loaded = { Component: null };
const sources: Loaded = { Component: null };
const loadPalette = () => import('@/app/command/CommandPalette').then((m) => m.CommandPalette);
const loadSources = () => import('@/app/project/SourcesDialog').then((m) => m.default);

/**
 * Loads `slot`'s code once `when` holds; true once it is there. By hand rather than with
 * `lazy()`: React retries a suspended `lazy()` at a low priority that never expires, and a lesson
 * that runs without end (an update every frame, slow on a weak machine) starved it for good:
 * Ctrl+K and "Nguồn & Giả định" opened nothing (#205, seen on CI).
 */
function useLoaded(slot: Loaded, when: boolean, load: () => Promise<ComponentType>): boolean {
  const [loaded, setLoaded] = useState(slot.Component !== null);
  useEffect(() => {
    if (!when || loaded) return;
    let live = true;
    void load().then((c) => {
      slot.Component = c;
      if (live) setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [when, loaded, slot, load]);
  return loaded;
}

/** Dialogs and overlays over every room (problem review, first run, updates, palette…). */
export function ShellOverlays({ presentation }: { presentation: boolean }) {
  const sourcesOpen = useProjectUi((s) => s.sourcesOpen);
  const paletteUsed = useCommandPalette((s) => s.used);
  // The shortcut and the header button only flip a flag; the code loads on first use.
  const paletteLoaded = useLoaded(palette, paletteUsed, loadPalette);
  const sourcesLoaded = useLoaded(sources, sourcesOpen, loadSources);
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
