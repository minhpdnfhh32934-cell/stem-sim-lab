import '@/app/theme/benchFonts';
import './bench.css';
import { Minimize2 } from 'lucide-react';
import { lazy, Suspense, useEffect, type CSSProperties } from 'react';
import { useT } from '@/app/i18n';
import { ShellOverlays } from '@/app/layout/AppShell';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { LeftSidebar } from '@/app/layout/LeftSidebar';
import { SubjectSwitch } from '@/app/layout/SubjectSwitch';
import { useShellServices } from '@/app/layout/useShellServices';
import { LandingScreen } from '@/app/learner/LandingScreen';
import { useIsHome, useIsLanding, useIsStudio, useIsTeacher } from '@/app/topics';
import { ScreenScan } from '@/teacher/chat/ScreenScan';
import { IconButton } from '@/ui/IconButton';
import { Skeleton } from '@/ui/Skeleton';
import { BenchFrame } from './BenchFrame';
import { BenchHeader } from './BenchHeader';
import { BenchLibrary } from './Library';
import { BenchContext } from './shellMode';
import { keepBasicSpeedOnSteps } from './speeds';

const TeacherScreen = lazy(() => import('@/teacher/screen/TeacherScreen'));
const StudioScreen = lazy(() => import('@/studio/StudioScreen'));

/**
 * The "Bàn thí nghiệm" shell (0.8.1, docs/BENCH_DESIGN.md), shown only behind the dev switch
 * (`benchShellOn`). It marks <html data-shell="bench"> so the bench tokens and fonts apply. Rooms:
 * launch, library (the classic library column for now, B3), the bench for an open topic, Science
 * Studio and AI Teacher (their own screens until B6/B7).
 */
export default function BenchShell() {
  useShellServices();
  const t = useT();
  const presentation = useLayoutStore((s) => s.presentation);
  const leftWidth = useLayoutStore((s) => s.leftWidth);
  const teacher = useIsTeacher();
  const studio = useIsStudio() && !teacher;
  const landing = useIsLanding();
  const library = useIsHome() && !teacher;

  useEffect(keepBasicSpeedOnSteps, []);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.shell = 'bench';
    return () => {
      delete root.dataset.shell;
    };
  }, []);

  const room = teacher ? (
    // The teacher page has its own <main>.
    <div className="bench-room bench-room--full">
      <Suspense fallback={<Skeleton label={t('stage.loading')} variant="lines" />}>
        <TeacherScreen />
      </Suspense>
    </div>
  ) : landing ? (
    <main className="bench-room bench-room--full">
      <LandingScreen />
    </main>
  ) : library ? (
    <BenchLibrary />
  ) : studio ? (
    <div className="bench-room" style={{ '--left-w': `${leftWidth}px` } as CSSProperties}>
      <div className="bench-library">
        <SubjectSwitch />
        <LeftSidebar />
      </div>
      <main className="bench-room__main">
        <Suspense fallback={<Skeleton label={t('stage.loading')} variant="lines" />}>
          <StudioScreen />
        </Suspense>
      </main>
    </div>
  ) : (
    <BenchFrame />
  );

  return (
    <BenchContext.Provider value={true}>
      <div className="bench-shell" data-presentation={presentation || undefined}>
        {!presentation && <BenchHeader />}
        <ShellOverlays presentation={presentation} />
        <ScreenScan />
        {room}
        {presentation && (
          <IconButton
            className="shell__exit-presentation"
            icon={Minimize2}
            label={t('layout.exitPresentation')}
            variant="solid"
            size="lg"
            tooltipSide="left"
            onClick={() => {
              useLayoutStore.getState().setPresentation(false);
            }}
          />
        )}
      </div>
    </BenchContext.Provider>
  );
}
