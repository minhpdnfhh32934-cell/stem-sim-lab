/**
 * Positions of the illustration "Hình minh họa, không theo tỉ lệ" (HH10 Bài 1), in a 200 × 200
 * box centred on 0: nucleons packed in a disc, electrons scattered around it. Only the counts
 * mean anything; the sizes and places do not (no electron shells: that is Bài 3).
 */
export const NUCLEON_R = 5;
export const ELECTRON_R = 3;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/** Sunflower step: neighbours end up about 2 radii apart (the nucleons touch). */
const SPACING = 1.07 * NUCLEON_R;

export interface Dot {
  x: number;
  y: number;
}

/** Z protons and N neutrons on a sunflower spiral; protons spread evenly through the disc. */
export function nucleons(z: number, n: number): { protons: Dot[]; neutrons: Dot[] } {
  const total = z + n;
  const protons: Dot[] = [];
  const neutrons: Dot[] = [];
  for (let k = 0; k < total; k++) {
    const r = SPACING * Math.sqrt(k + 0.5);
    const dot = { x: r * Math.cos(k * GOLDEN), y: r * Math.sin(k * GOLDEN) };
    // The k-th nucleon is a proton when the running share of protons steps up.
    if (Math.floor(((k + 1) * z) / total) > Math.floor((k * z) / total)) protons.push(dot);
    else neutrons.push(dot);
  }
  return { protons, neutrons };
}

/** Radius of the drawn nucleus disc (for placing the electrons outside it). */
export const nucleusRadius = (a: number) => SPACING * Math.sqrt(Math.max(a, 1) - 0.5) + NUCLEON_R;

/** Electrons as dots in the ring between the nucleus and the box edge, evenly by golden angle. */
export function electronDots(count: number, a: number): Dot[] {
  const inner = nucleusRadius(a) + 14;
  const outer = 94;
  return Array.from({ length: count }, (_, k) => {
    const t = (k * 0.618034 + 0.31) % 1;
    const r = inner + (outer - inner) * (0.15 + 0.8 * t);
    return { x: r * Math.cos(k * GOLDEN + 0.7), y: r * Math.sin(k * GOLDEN + 0.7) };
  });
}
