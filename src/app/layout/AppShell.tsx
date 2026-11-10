import { Minimize2 } from 'lucide-react';
import { lazy, Suspense, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ProblemDialog } from '@/app/ai/ProblemDialog';
import { useT } from '@/app/i18n';
import { Tour } from '@/app/project/Tour';
import { useProjectUi } from '@/app/project/uiStore';
import { UpdateDialog } from '@/app/update/UpdateDialog';
import { WhatsNewDialog } from '@/app/whatsnew/WhatsNewDialog';
import { Skeleton } from '@/ui/Skeleton';
import { useCommandPalette } from '@/app/command/commands';
import { Toaster } from '@/ui/Toaster';
import '@/app/project/project.css';
import { useModuleStore } from '@/modules/moduleStore';
import { HomeScreen } from '@/app/learner/HomeScreen';
import { Onboarding } from '@/app/learner/Onboarding';
import { ShowcaseOverlay } from '@/app/showcase/ShowcaseOverlay';
import { useIsHome, useIsLanding, useIsStudio, useIsTeacher } from '@/app/topics';
import { IconButton } from '@/ui/IconButton';
import { BottomPanel } from './BottomPanel';
import { Inspector } from './Inspector';
import { LAYOUT_LIMITS, useLayoutStore } from './layoutStore';
import { LeftSidebar } from './LeftSidebar';
import { Splitter } from './Splitter';
import { useShellServices } from './useShellServices';
import { benchShellOn } from '@/app/bench/shellMode';
import { Stage } from './Stage';
import { StatusBar } from './StatusBar';
import { Timeline } from './Timeline';
import { TopBar } from './TopBar';
import { LandingScreen } from '@/app/learner/LandingScreen';
import { ChatBubble } from '@/teacher/chat/ChatBubble';
import { GpuRestartReminder } from '@/teacher/chat/GpuSettings';

/**
 * Main window layout (MASTER_PROMPT §7.1):
 *
 *   ┌──────────────────────── TopBar ────────────────────────┐
 *   │ Left │            Stage (2D/3D)           │ Inspector  │
 *   │ side │────────────── Timeline ────────────│ + Science  │
 *   │ bar  │──── Bottom panel (graphs/solution) │   Card     │
 *   └──────────────────────── StatusBar ─────────────────────┘
 */
const SourcesDialog = lazy(() => import('@/app/project/SourcesDialog'));
// The AI teacher is its own chunk (PROMPT_PHAN_2 B0: separate from the simulations).
const TeacherScreen = lazy(() => import('@/teacher/screen/TeacherScreen'));
const StudioScreen = lazy(() => import('@/studio/StudioScreen'));
// Quick search (Ctrl+K) loads on first use; the shortcut and the top-bar button only flip a flag.
const CommandPalette = lazy(() =>
  import('@/app/command/CommandPalette').then((m) => ({ default: m.CommandPalette })),
);

// Dev switch (0.8.1 B1, #115): a production build replaces import.meta.env.DEV with false, so the
// bench shell is never even loaded there. Unit tests (MODE 'test') leave it out too: with it, the
// test runner also prepared the bench's large chunk and slowed other lazy screens (2026-11-02).
const BenchShell =
  import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? lazy(() => import('@/app/bench/BenchShell'))
    : null;

export function AppShell() {
  return BenchShell && benchShellOn() ? (
    <Suspense fallback={null}>
      <BenchShell />
    </Suspense>
  ) : (
    <ClassicShell />
  );
}

/** Dialogs and overlays shared by both shells (problem review, first run, updates, palette…). */
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

function ClassicShell() {
  useShellServices();
  const t = useT();
  const layout = useLayoutStore(
    useShallow((s) => ({
      leftWidth: s.leftWidth,
      rightWidth: s.rightWidth,
      bottomHeight: s.bottomHeight,
      presentation: s.presentation,
      setSize: s.setSize,
      setPresentation: s.setPresentation,
    })),
  );
  const { presentation } = layout;
  const moduleActive = useModuleStore((s) => s.active !== null || s.loading);
  // A topic without a table or chart of its own (Mendel, Hardy–Weinberg) gives that height to
  // the stage instead of an empty "no extra panel" box.
  const moduleWithoutBottom = useModuleStore(
    (s) => s.active !== null && s.active.view.Bottom === undefined,
  );
  const teacher = useIsTeacher();
  const studio = useIsStudio() && !teacher;
  const landing = useIsLanding();
  const labHome = useIsHome() && !teacher;
  const home = landing || labHome;
  // Science Studio is part of the lab (user decision 2026-10-20): the topic library stays on the
  // left, the lesson takes the centre. AI Teacher alone owns the whole window.
  const fullPage = teacher || studio;

  const showLeft = !presentation && !teacher && !landing;
  // The home screen uses the whole centre: no timeline, graphs or inspector until a topic opens.
  const showRight = !presentation && !home && !fullPage;
  const showBottom = !presentation && !home && !fullPage && !moduleWithoutBottom;

  const style = {
    '--left-w': `${layout.leftWidth}px`,
    '--right-w': `${layout.rightWidth}px`,
    '--bottom-h': `${layout.bottomHeight}px`,
  } as CSSProperties;

  return (
    <div
      className="shell"
      data-presentation={presentation || undefined}
      data-inspector={showRight || undefined}
      data-bubble={(!presentation && !teacher && !landing) || undefined}
      data-bottom={showBottom || undefined}
      data-timeline={(!moduleActive && !home && !fullPage) || undefined}
      style={style}
    >
      {!presentation && <TopBar />}
      <ShellOverlays presentation={presentation} />

      <div className="shell__body">
        {showLeft && (
          <>
            <LeftSidebar />
            <Splitter
              orientation="vertical"
              value={layout.leftWidth}
              min={LAYOUT_LIMITS.left.min}
              max={LAYOUT_LIMITS.left.max}
              direction={1}
              onResize={(px) => {
                layout.setSize('left', px);
              }}
              onReset={() => {
                layout.setSize('left', LAYOUT_LIMITS.left.default);
              }}
              label={t('layout.resizeLeft')}
            />
          </>
        )}

        <main className="shell__center">
          {teacher ? (
            <Suspense fallback={<Skeleton label={t('stage.loading')} variant="lines" />}>
              <TeacherScreen />
            </Suspense>
          ) : studio ? (
            <Suspense fallback={<Skeleton label={t('stage.loading')} variant="lines" />}>
              <StudioScreen />
            </Suspense>
          ) : landing ? (
            <LandingScreen />
          ) : labHome ? (
            <HomeScreen />
          ) : (
            <Stage />
          )}
          {!moduleActive && !home && !fullPage && <Timeline />}
          {showBottom && (
            <>
              <Splitter
                orientation="horizontal"
                value={layout.bottomHeight}
                min={LAYOUT_LIMITS.bottom.min}
                max={LAYOUT_LIMITS.bottom.max}
                direction={-1}
                onResize={(px) => {
                  layout.setSize('bottom', px);
                }}
                onReset={() => {
                  layout.setSize('bottom', LAYOUT_LIMITS.bottom.default);
                }}
                label={t('layout.resizeBottom')}
              />
              <BottomPanel />
            </>
          )}
        </main>

        {showRight && (
          <>
            <Splitter
              orientation="vertical"
              value={layout.rightWidth}
              min={LAYOUT_LIMITS.right.min}
              max={LAYOUT_LIMITS.right.max}
              direction={-1}
              onResize={(px) => {
                layout.setSize('right', px);
              }}
              onReset={() => {
                layout.setSize('right', LAYOUT_LIMITS.right.default);
              }}
              label={t('layout.resizeRight')}
            />
            <Inspector />
          </>
        )}
      </div>

      {presentation ? (
        <IconButton
          className="shell__exit-presentation"
          icon={Minimize2}
          label={t('layout.exitPresentation')}
          variant="solid"
          size="lg"
          tooltipSide="left"
          onClick={() => {
            layout.setPresentation(false);
          }}
        />
      ) : (
        <StatusBar />
      )}
      {/* The launch page already has its own "AI Teacher" entry: the bubble is for the lab. */}
      {!presentation && !teacher && !landing && <ChatBubble />}
    </div>
  );
}
