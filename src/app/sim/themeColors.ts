import type { ThemeColors } from '@/physics/types';

/** Reads canvas colors from the CSS design tokens (call again after a theme change). */
export function readThemeColors(el: Element = document.documentElement): ThemeColors {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    text: v('--text', '#172033'),
    muted: v('--text-muted', '#5a6477'),
    faint: v('--text-faint', '#8a93a5'),
    grid: v('--stage-grid', 'rgba(40,60,100,0.07)'),
    gridMajor: v('--stage-grid-major', 'rgba(40,60,100,0.13)'),
    ground: v('--text-muted', '#5a6477'),
    body: v('--chart-2', '#e69f00'),
    bodyAlt: v('--chart-5', '#cc79a7'),
    accent: v('--accent', '#2f62d8'),
    velocity: v('--chart-1', '#0072b2'),
    acceleration: v('--chart-4', '#d55e00'),
    force: v('--chart-3', '#009e73'),
    spring: v('--text-muted', '#5a6477'),
    panel: v('--bg-panel-2', '#f6f8fb'),
  };
}
