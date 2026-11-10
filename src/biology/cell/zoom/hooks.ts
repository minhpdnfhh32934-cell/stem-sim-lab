/**
 * State helpers of "Từ tế bào đến DNA" shared by the stage, the 3D view and the inspector (no
 * three.js, no components).
 */
import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { prefersReducedMotion } from '../../view3d/support';
import { PART_NAME, lengthText } from './card';
import { LEVELS, LEVEL_PARTS, levelInfo, type ZoomPart } from './levels';
import { setZoomLevel, useCellZoom } from './store';

/** How long the camera glides into the next level's spot (= CAMERA_MOVE_MS, test-checked). */
export const GLIDE_MS = 700;

/** "Hiện tên": the learner's choice, else on in Basic mode. */
export function useShowNames(): boolean {
  const choice = useCellZoom((s) => s.labels);
  const basic = useSettingsStore((s) => s.uiMode === 'basic');
  return choice ?? basic;
}

/** The part names of the level shown (localized), or null when names are off. */
export function useNames(level: number): Partial<Record<ZoomPart, string>> | null {
  const Lz = useLocalized();
  const on = useShowNames();
  return useMemo(() => {
    if (!on) return null;
    const id = levelInfo(level).id;
    return Object.fromEntries(LEVEL_PARTS[id].map((p) => [p, Lz(PART_NAME[p])]));
  }, [on, level, Lz]);
}

/** "5 µm" in the reader's language. */
export function useLength(): (nm: number) => string {
  const Lz = useLocalized();
  return (nm) => Lz(lengthText(nm));
}

/** Zooms in: glides into the spot (3D, motion allowed), then the next level replaces it. */
export function zoomIn(glide: boolean): void {
  const { level, moving } = useCellZoom.getState();
  if (moving || level >= LEVELS.length - 1) return;
  if (glide && !prefersReducedMotion()) useCellZoom.setState({ moving: true });
  else setZoomLevel(level + 1);
}

export function zoomOut(): void {
  const { level, moving } = useCellZoom.getState();
  if (!moving && level > 0) setZoomLevel(level - 1);
}
