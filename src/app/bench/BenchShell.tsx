import '@/app/theme/benchFonts';
import { Minimize2 } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { useT } from '@/app/i18n';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useShellServices } from '@/app/layout/useShellServices';
import { useIsHome, useIsLanding, useIsStudio, useIsTeacher } from '@/app/topics';
import { ScreenScan } from '@/teacher/chat/ScreenScan';
import { IconButton } from '@/ui/IconButton';
import { Skeleton } from '@/ui/Skeleton';
import { BenchFrame } from './BenchFrame';
import { BenchHeader } from './BenchHeader';
import { BenchLanding } from './Landing';
import { BenchLibrary } from './Library';
import { Notebook } from './Notebook';
import { BenchContext } from './shellMode';
import { ShellOverlays } from './ShellOverlays';
import { useStudioSlot } from './studioSlot';
import { keepBasicSpeedOnSteps } from './speeds';

const TeacherScreen = lazy(() => import('@/teacher/screen/TeacherScreen'));
const StudioScreen = lazy(() => import('@/studio/StudioScreen'));

/**
 * The "Bàn thí nghiệm" shell (0.8.1, docs/BENCH_DESIGN.md): the app's only shell since B8 (#193).
 * It marks <html data-shell="bench"> so the bench tokens and fonts apply. Rooms: launch, library
 * ("Kệ bài"), the bench for an open topic, Science Studio and AI Teacher.
 */
export default function BenchShell() {
  useShellServices();
  const t = useT();
  const presentation = useLayoutStore((s) => s.presentation);
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
      <BenchLanding />
    </main>
  ) : library ? (
    <BenchLibrary />
  ) : studio ? (
    // A guided lesson is one paper sheet beside the rail's "Thẻ khoa học" and "Hỏi AI", which
    // open over it (docs/BENCH_DESIGN.md §9.7, first cut); the shelf ("Virtual Lab" in the
    // breadcrumb) replaces the classic library column.
    <div className="bench-studio-room">
      <Notebook push={false} pinnedOnly />
      <main className="bench-studio">
        <Suspense fallback={<Skeleton label={t('stage.loading')} variant="lines" />}>
          <StudioScreen />
        </Suspense>
      </main>
      <section
        className="bench-studio-live"
        aria-label={t('studio.liveStage')}
        ref={(el) => {
          useStudioSlot.setState({ el });
        }}
      />
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
