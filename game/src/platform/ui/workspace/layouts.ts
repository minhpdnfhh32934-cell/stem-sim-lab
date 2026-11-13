import type { Presentation } from '../../../simulation/experiment';

/**
 * One layout per presentation, as data: the regions the stage offers (a piece stands in the
 * region its `slot` names), where the live monitor graph goes and whether the workspace covers the
 * lab or stands beside the 3D apparatus. The arrangement itself is CSS, selected by the root's
 * `data-presentation`; nothing here or in the host reads a subject or an experiment id.
 */
export interface LayoutSpec {
  /** The regions the stage offers, by name. */
  readonly regions: readonly string[];
  /** Where a piece whose slot names no region goes. */
  readonly fallback: string;
  /** Where the live monitor graph is drawn: the notebook, a dock on the stage, a card. */
  readonly monitor: 'notebook' | 'dock' | 'card';
  /** `full`: a dimmed overlay over the lab; `anchored`: panels beside the 3D apparatus. */
  readonly overlay: 'full' | 'anchored';
  /** Two regions that take turns as the hero (microscopy: prep tile, eyepiece field). */
  readonly hero?: readonly [string, string];
}

const BENCH: LayoutSpec = {
  regions: ['bench'],
  fallback: 'bench',
  monitor: 'notebook',
  overlay: 'full',
};

export const WORKSPACE_LAYOUTS: Readonly<Record<Presentation, LayoutSpec>> = {
  '2d-workspace': BENCH,
  observation: {
    regions: [
      'back-left',
      'back-centre',
      'back-right',
      'front-left',
      'front-centre',
      'front-right',
      'lens',
    ],
    fallback: 'front-centre',
    monitor: 'dock',
    overlay: 'full',
  },
  microscopy: {
    regions: ['library', 'instrument', 'prep', 'field'],
    fallback: 'instrument',
    monitor: 'dock',
    overlay: 'full',
    hero: ['prep', 'field'],
  },
  'bench-embedded': {
    regions: ['anchor'],
    fallback: 'anchor',
    monitor: 'card',
    overlay: 'anchored',
  },
  // Never opened as workspaces (the station refuses); present so the table is total.
  'physical-3d': BENCH,
  'physical-lab': BENCH,
};

/** `stand.clamp` is in region `stand` when the layout has one; an exact slot name wins. */
export function regionOf(layout: LayoutSpec, slot: string): string {
  if (layout.regions.includes(slot)) return slot;
  const head = slot.split('.')[0] ?? slot;
  return layout.regions.includes(head) ? head : layout.fallback;
}

/**
 * The ink that reads on a surface colour at 4.5:1 or better (WCAG relative luminance): the dark or
 * the light house ink, whichever contrasts more; black or white when a mid-tone leaves both short.
 */
export function readableInk(surface: string, dark = '#1b2430', light = '#f2f8fc'): string {
  const luminance = (hex: string) => {
    const channel = (at: number) => {
      const c = parseInt(hex.slice(at, at + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const contrast = (ink: string) => {
    const [a, b] = [luminance(surface), luminance(ink)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const best = [dark, light, '#000000', '#ffffff'].find((ink) => contrast(ink) >= 4.5);
  return best ?? (contrast(dark) >= contrast(light) ? dark : light);
}
