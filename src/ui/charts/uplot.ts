import type uPlotType from 'uplot';

type UPlotCtor = typeof uPlotType;
let uplotPromise: Promise<UPlotCtor> | undefined;

/** Loads uPlot (and its CSS) on first use only. */
export function loadUPlot(): Promise<UPlotCtor> {
  uplotPromise ??= Promise.all([import('uplot'), import('uplot/dist/uPlot.min.css')]).then(
    ([m]) => m.default,
  );
  return uplotPromise;
}

/** Categorical series colors in fixed order (validated palette, see tokens.css). */
export const SERIES_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'];
