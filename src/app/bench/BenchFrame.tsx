import { useEffect, useSyncExternalStore, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BENCH_RAIL, notebookPushes, useLayoutStore } from '@/app/layout/layoutStore';
import { Stage } from '@/app/layout/Stage';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { DriverGrid } from './DriverGrid';
import { Notebook } from './Notebook';
import { Tray } from './Tray';

const onResize = (cb: () => void) => {
  window.addEventListener('resize', cb);
  return () => {
    window.removeEventListener('resize', cb);
  };
};

/**
 * One frame for every topic (docs/BENCH_DESIGN.md §8): notebook rail and drawer on the left, the
 * stage, the tray on the right (or its spine) and the bench edge along the bottom. At 1366×768
 * with the defaults the stage is 998×656.
 */
export function BenchFrame() {
  const layout = useLayoutStore(
    useShallow((s) => ({
      trayFolded: s.trayFolded,
      trayWidth: s.trayWidth,
      notebookWidth: s.notebookWidth,
      notebookOpen: s.notebookOpen,
      presentation: s.presentation,
    })),
  );
  const viewport = useSyncExternalStore(onResize, () => window.innerWidth);
  // A physics topic's first visit: its notebook lands on Thử thách when opened (§9.4); the drawer
  // itself stays as the learner left it (default: closed).
  const sceneId = useSimStore((s) => s.scene?.id ?? null);
  useEffect(() => {
    if (sceneId)
      useLayoutStore.getState().landOnChallenge(sceneId, useWorkspaceStore.getState().subject);
  }, [sceneId]);
  const push = layout.notebookOpen && notebookPushes(viewport, layout);
  const style = {
    '--tray-w': `${layout.trayFolded ? BENCH_RAIL : layout.trayWidth}px`,
    '--notebook-w': `${layout.notebookWidth}px`,
  } as CSSProperties;
  return (
    <div
      className="bench"
      style={style}
      data-push={push || undefined}
      data-presentation={layout.presentation || undefined}
    >
      {!layout.presentation && <Notebook push={push} />}
      <main className="bench__stage">
        <Stage />
      </main>
      {!layout.presentation && <Tray />}
      <DriverGrid />
    </div>
  );
}
