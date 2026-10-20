/**
 * Pores of the 2D diffusion picture (illustration): slots along the membrane's height, centres
 * spread evenly, each 0.05 of the height wide. The Fick model never uses them (it uses P·A).
 */
export function poreIntervals(n: number): [number, number][] {
  const w = 0.05;
  return Array.from({ length: n }, (_, k) => {
    const c = (k + 0.5) / n;
    return [c - w / 2, c + w / 2];
  });
}
