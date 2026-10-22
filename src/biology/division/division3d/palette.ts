/**
 * Colours of the 3D division views (mitosis, meiosis) from the theme tokens, one mapping for both
 * lessons. Rule 0 of the 3D style guide (saturation = data): the chromosomes keep their chart
 * colours exactly (maternal --chart-4, paternal --chart-1, the chiasma --chart-3); structures are
 * muted towards the stage (membrane, nucleus, wall, cell plate) or have their own low-chroma token
 * (spindle). The contractile ring is a darker band of the membrane's colour (illustrative).
 */
import { mixLinear } from '@/ui/three/color';
import { muted, structureColor } from '../../view3d/palette';

export interface DivisionColours {
  maternal: string;
  paternal: string;
  centromere: string;
  chiasma: string;
  membrane: string;
  envelope: string;
  nucleolus: string;
  wall: string;
  plate: string;
  spindle: string;
  centrosome: string;
  ring: string;
  guide: string;
  highlight: string;
  backdrop: string;
}

/** Reads the colours (`token` returns a CSS custom property's value). */
export function divisionPalette(token: (name: string) => string): DivisionColours {
  const membrane = structureColor(token, 'membrane');
  return {
    maternal: token('--chart-4'),
    paternal: token('--chart-1'),
    centromere: token('--text'),
    chiasma: token('--chart-3'),
    membrane,
    envelope: structureColor(token, 'nucleus'),
    // Its own token: the nucleolus once had the envelope's colour and vanished inside it.
    nucleolus: token('--m3d-nucleolus'),
    wall: muted(token, '--chart-2'),
    plate: muted(token, '--chart-2'),
    spindle: structureColor(token, 'spindle'),
    centrosome: token('--chart-5'),
    ring: mixLinear(membrane, '#000000', 0.35),
    guide: structureColor(token, 'annotation'),
    // Unlike both chromosome colours (the accent blue was the paternal blue).
    highlight: token('--m3d-highlight'),
    // Unpicked parts fade towards the stage colour (they recede in both themes).
    backdrop: token('--bg-panel'),
  };
}
