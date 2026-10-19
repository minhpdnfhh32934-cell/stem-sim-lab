/**
 * Whether a biology 3D view can be shown, and why not when it cannot. The same rules for every
 * lesson (mitosis included): WebGL 2 is needed; the Low quality tier, chosen or reached by the
 * overload ladder, uses the 2D picture; a view whose GPU context was lost never retries.
 */
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { hasWebGL2 } from '@/perf/benchmark';
import { chosenTier, effectiveTier, usePerfStore } from '@/perf/perfStore';
import { L } from '../common';
import { use3dWanted, useBio3DHealth, type Bio3DLesson } from './prefs';

export type No3dReason = 'tier' | 'overload' | 'webgl';

let webgl2: boolean | null = null;
/** WebGL 2 support, checked once (three.js needs WebGL 2). */
export function webgl2Available(): boolean {
  webgl2 ??= usePerfStore.getState().benchmark?.webgl2 ?? hasWebGL2();
  return webgl2;
}

/**
 * Why the 3D view cannot be shown now (null = it can): no WebGL (or a lost context: `failed`),
 * the Low quality setting (chosen in Settings, or by the benchmark), or the app lowering the
 * quality by itself after sustained overload.
 */
export function useNo3dReason(failed: boolean): No3dReason | null {
  const tier = usePerfStore(effectiveTier);
  const chosen = usePerfStore(chosenTier);
  if (failed || !webgl2Available()) return 'webgl';
  if (tier !== 'low') return null;
  return chosen === 'low' ? 'tier' : 'overload';
}

const NOTICE: Record<No3dReason, LocalizedText> = {
  tier: L(
    'Đang ở chất lượng hiển thị Thấp nên dùng hình 2D (đổi trong Cài đặt → Chất lượng hiển thị).',
    'Display quality is Low, so the 2D picture is used (change it in Settings → Display quality).',
  ),
  overload: L(
    'Máy đang chạy chậm nên app tạm dùng hình 2D (số liệu không đổi). Mở lại chủ đề này để thử lại hình 3D.',
    'This computer is running slowly, so the app is using the 2D picture for now (the numbers are the same). Open this topic again to try 3D again.',
  ),
  webgl: L(
    'Máy này chưa vẽ được 3D (WebGL), nên dùng hình 2D.',
    'This computer cannot draw 3D (WebGL) here, so the 2D picture is used.',
  ),
};

/** Why the 2D picture is shown although the learner chose 3D (null: it was their choice). */
export function useNo3dNotice(wanted3d: boolean, reason: No3dReason | null): string | undefined {
  const Lz = useLocalized();
  return wanted3d && reason ? Lz(NOTICE[reason]) : undefined;
}

/** For tests: forget the cached WebGL check. */
export function resetWebgl2Cache(): void {
  webgl2 = null;
}

/** The learner asked the system for less motion: nothing starts moving on its own. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Whether the lesson shows its 3D view now, and why not when the learner wanted it. */
export function useShow3d(lesson: Bio3DLesson): { show3d: boolean; notice: string | undefined } {
  const wanted = use3dWanted(lesson);
  const reason = useNo3dReason(useBio3DHealth((s) => s.failed));
  const notice = useNo3dNotice(wanted, reason);
  return { show3d: wanted && !reason, notice };
}
