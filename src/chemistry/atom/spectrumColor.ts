/**
 * Approximate sRGB colour of monochromatic light (Bruton's piecewise approximation).
 * Illustration only: screens cannot show spectral colours exactly. Returns null outside
 * the visible range (≈ 380–750 nm).
 */
export function wavelengthColor(nm: number): string | null {
  if (nm < 380 || nm > 750) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) {
    r = -(nm - 440) / (440 - 380);
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / (490 - 440);
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = -(nm - 510) / (510 - 490);
  } else if (nm < 580) {
    r = (nm - 510) / (580 - 510);
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = -(nm - 645) / (645 - 580);
  } else {
    r = 1;
  }
  // Intensity falls off near the limits of vision.
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  const c = (v: number) => Math.round(255 * (v * f) ** 0.8);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

export type SpectralRegion = 'uv' | 'visible' | 'ir';
export function regionOf(nm: number): SpectralRegion {
  return nm < 380 ? 'uv' : nm > 750 ? 'ir' : 'visible';
}
