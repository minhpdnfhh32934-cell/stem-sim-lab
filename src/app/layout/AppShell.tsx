import { Minimize2 } from 'lucide-react';
import { lazy, Suspense, useEffect, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ProblemDialog } from '@/app/ai/ProblemDialog';
import { useAiStatusPolling } from '@/app/ai/useAiStatus';
import { useT } from '@/app/i18n';
import { initHistory } from '@/app/project/history';
import { Tour } from '@/app/project/Tour';
import { useProjectUi } from '@/app/project/uiStore';
import { initUndo } from '@/app/project/undo';
import { useGlobalShortcuts } from '@/app/shortcuts/useGlobalShortcuts';
import { UpdateDialog } from '@/app/update/UpdateDialog';
import { scheduleAutoCheck } from '@/app/update/updater';
import { useMemoryWatchdog } from '@/perf/useMemoryWatchdog';
import { Toaster } from '@/ui/Toaster';
import '@/app/project/project.css';
import { useModuleStore } from '@/modules/moduleStore';
import { IconButton } from '@/ui/IconButton';
import { BottomPanel } from './BottomPanel';
import { Inspector } from './Inspector';
import { LAYOUT_LIMITS, useLayoutStore } from './layoutStore';
import { LeftSidebar } from './LeftSidebar';
import { Splitter } from './Splitter';
import { Stage } from './Stage';
import { StatusBar } from './StatusBar';
import { Timeline } from './Timeline';
import { TopBar } from './TopBar';
import { usePresentationFullscreen } from './usePresentationFullscreen';

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

export function AppShell() {
  useGlobalShortcuts();
  useAiStatusPolling();
  useMemoryWatchdog();
  usePresentationFullscreen();
  useEffect(() => {
    const offUndo = initUndo();
    const offHistory = initHistory();
    const offUpdate = scheduleAutoCheck();
    return () => {
      offUndo();
      offHistory();
      offUpdate();
    };
  }, []);
  const sourcesOpen = useProjectUi((s) => s.sourcesOpen);
  const t = useT();
  const layout = useLayoutStore(
    useShallow((s) => ({
      leftWidth: s.leftWidth,
      rightWidth: s.rightWidth,
      bottomHeight: s.bottomHeight,
      leftOpen: s.leftOpen,
      rightOpen: s.rightOpen,
      bottomOpen: s.bottomOpen,
      presentation: s.presentation,
      setSize: s.setSize,
      setPresentation: s.setPresentation,
    })),
  );
  const { presentation } = layout;
  const moduleActive = useModuleStore((s) => s.active !== null || s.loading);

  const showLeft = layout.leftOpen && !presentation;
  const showRight = layout.rightOpen && !presentation;
  const showBottom = layout.bottomOpen && !presentation;

  const style = {
    '--left-w': `${layout.leftWidth}px`,
    '--right-w': `${layout.rightWidth}px`,
    '--bottom-h': `${layout.bottomHeight}px`,
  } as CSSProperties;

  return (
    <div className="shell" data-presentation={presentation || undefined} style={style}>
      {!presentation && <TopBar />}
      <ProblemDialog />
      {sourcesOpen && (
        <Suspense fallback={null}>
          <SourcesDialog />
        </Suspense>
      )}
      <Tour />
      <UpdateDialog />
      <Toaster />

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
          <Stage />
          {!moduleActive && <Timeline />}
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
    </div>
  );
}
