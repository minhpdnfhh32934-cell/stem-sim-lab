/**
 * Materials of the 3D division views, shared by mitosis and meiosis so both lessons look alike
 * (0.7.1 beauty pass). Every part has three looks, swapped and never re-created: normal,
 * highlighted (glows in the highlight colour) and dimmed (another part is picked: halfway to the
 * stage colour, see-through parts fainter).
 *
 * Look (illustration only — no count, size or position comes from here):
 * - chromatids: soft sheen, fine relief that stays on each chromatid as it moves, a darker
 *   silhouette (a rod, not a ribbon); the maternal / paternal colours stay exact as albedo
 *   (vertex colours, piece by piece);
 * - membranes: a faint lit back face (the cell's volume) under a front face with a Fresnel rim,
 *   in the muted structure colour (rule 0: saturation = data); on a light stage the cell, the
 *   nuclear envelope and the wall also get a darker outline in a deeper shade of their own colour
 *   (`--m3d-shell-ink`: a pale rim vanishes on a pale stage);
 * - spindle fibres: light, see-through (`SPINDLE_OPACITY`), fading towards the poles, drawn on the
 *   FX layer (no ambient occlusion around them, no dark wires);
 * - centrosomes: a soft emissive core; on the HDR path (High tier on a discrete GPU) the core
 *   glows above the bloom threshold, and the plant cell wall gets a fibrous bump and clear coat.
 * Large shells never get the procedural relief (software frame cost, `relief.ts`).
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { deepen, mixLinear } from '@/ui/three/color';
import { glass, solid, withRim, withTint } from '@/ui/three/materials';
import { withEdgeShade, withRelief, withVertexShade } from '@/ui/three/relief';
import { noiseTexture } from '../../view3d/noise';
import {
  TUBE_SHADE_ATTRIBUTE,
  TUBE_SURFACE_ATTRIBUTE,
} from '../../view3d/primitives/chromosomeTube';

/** The three looks of a part. */
export interface Look<M extends THREE.Material> {
  base: M;
  hi: M;
  dim: M;
}

/** CSS colours of the division parts (theme tokens read by the view). */
export interface DivisionPalette {
  centromere: string;
  membrane: string;
  envelope: string;
  nucleolus: string;
  spindle: string;
  centrosome: string;
  ring: string;
  highlight: string;
  /** Colour unpicked parts fade towards while a part is picked (the stage's colour). */
  backdrop?: string;
  /** Plant cells: the wall and the cell plate. */
  wall?: string;
  plate?: string;
  /** Meiosis: the chiasma. */
  chiasma?: string;
  /** Imaginary guides (the metaphase plate ring): a muted annotation colour. */
  guide?: string;
}

export interface DivisionLookOptions {
  tier: QualityTier;
  /** Front-face opacity of the animal membrane (a theme token: higher in the dark theme). */
  membraneOpacity: number;
  /** Strength of the Fresnel outline of see-through shells (a theme token). */
  rimStrength: number;
  /** How much solids darken towards their silhouette (a theme token, `withEdgeShade`). */
  edgeShade: number;
  /** HDR path (High tier on a discrete GPU): emissive cores bloom, the wall gets its bump. */
  hdr: boolean;
  /**
   * How strongly see-through shells get a darker outline (a theme token: on in the light theme,
   * 0 = off in the dark theme, where the added rim light already outlines them).
   */
  shellInk?: number;
  /** Plant cell: the membrane lines the wall (fainter). */
  plant?: boolean;
}

/** Spindle fibres: opacity at the far end and at the pole (they fade towards the poles). */
export const SPINDLE_OPACITY = { far: 0.55, pole: 0.4 } as const;

/** Glow of a highlighted part (Medium and direct High: never above the bloom threshold). */
const HI_EMISSIVE = 0.85;
/** Emissive strength of the centrosome core: soft on the direct path, above 1 in HDR (blooms). */
const CORE_EMISSIVE = { direct: 0.45, hdr: 2.4 } as const;
/** Emissive strength of the chiasma ring (meiosis): as the centrosome core. */
const CHIASMA_RING_EMISSIVE = { direct: 0.5, hdr: 2.6 } as const;

/**
 * The darker outline of a shell (`shellInk`): its colour is a deeper shade of the shell's own
 * (OKLCH lightness − `darker`, chroma × `chroma` up to `maxChroma`: less saturated than the
 * chromosomes), in a band of falloff `power`; `INK_FILL` spreads a faint tint of it over the
 * face (the cell and the nucleus read as tinted bodies, not milky ghosts).
 */
const SHELL_INK = { darker: 0.28, chroma: 3.4, maxChroma: 0.085, power: 1.8 } as const;
const INK_FILL = { membrane: 0.3, envelope: 0.3 } as const;
/** The plant wall is a large box: a lighter outline (a full one reads as a heavy frame). */
const WALL_INK = 0.6;

/** Colour unpicked parts fade towards when the palette names none. */
const DIM_TOWARDS = '#8f949e';

/**
 * Surface relief (illustration, `relief.ts`): fine grain on the chromatids (it stays on each
 * one as it moves) and granules on the nucleolus. Light only — no shape, size or count changes.
 */
const RELIEF = {
  chromatid: { frequency: 11, height: 0.028, attribute: TUBE_SURFACE_ATTRIBUTE },
  nucleolus: { frequency: 7, height: 0.025 },
  /** HDR only: the nuclear envelope's fine chromatin-like grain. */
  envelope: { frequency: 4.5, height: 0.03 },
} as const;

export interface DivisionLooks {
  tube: Look<THREE.MeshStandardMaterial>;
  bead: Look<THREE.MeshStandardMaterial>;
  chiasma: Look<THREE.MeshStandardMaterial>;
  /** A small glowing ring at the model's crossover point (meiosis). */
  chiasmaRing: Look<THREE.MeshStandardMaterial>;
  envelope: Look<THREE.MeshStandardMaterial>;
  nucleolus: Look<THREE.MeshStandardMaterial>;
  membrane: Look<THREE.MeshStandardMaterial>;
  /**
   * The cell's volume: a faint lit back face of the membrane (never picked on its own; it follows
   * the membrane's look, and its highlighted look is its normal one).
   */
  cytoplasm: Look<THREE.MeshLambertMaterial>;
  wall: Look<THREE.MeshStandardMaterial>;
  centriole: Look<THREE.MeshStandardMaterial>;
  pcm: Look<THREE.MeshStandardMaterial>;
  /** The centrosome's emissive core. */
  core: Look<THREE.MeshStandardMaterial>;
  ring: Look<THREE.MeshStandardMaterial>;
  plate: Look<THREE.MeshStandardMaterial>;
  plateVesicle: Look<THREE.MeshStandardMaterial>;
  spindle: Look<THREE.MeshStandardMaterial>;
  vesicle: Look<THREE.MeshStandardMaterial>;
  pore: Look<THREE.MeshStandardMaterial>;
  /** Imaginary guides (dashed metaphase plate ring): flat, see-through, never picked. */
  guide: THREE.MeshBasicMaterial;
}

/**
 * Builds every look of a division scene. `keep` receives everything made here (the scene frees
 * it on dispose).
 */
export function divisionLooks(
  palette: DivisionPalette,
  o: DivisionLookOptions,
  keep: <T extends { dispose: () => void }>(x: T) => T,
): DivisionLooks {
  const { tier, rimStrength, hdr } = o;
  const towards = new THREE.Color(palette.backdrop ?? DIM_TOWARDS);
  const dimHex = (color: string) => `#${new THREE.Color(color).lerp(towards, 0.5).getHexString()}`;
  const look = <M extends THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>(
    color: string,
    make: (c: string) => M,
  ): Look<M> => {
    const base = keep(make(color));
    const hi = keep(make(color));
    hi.emissive.set(palette.highlight);
    hi.emissiveIntensity = HI_EMISSIVE;
    hi.userData.look = 'hi';
    hi.userData.bloom = false;
    const dim = keep(make(dimHex(color)));
    dim.userData.look = 'dim';
    dim.userData.bloom = false;
    const scale = dim.transparent ? 0.55 : 1;
    dim.opacity *= scale;
    dim.userData.opacityScale = scale;
    return { base, hi, dim };
  };
  const relief =
    <M extends THREE.MeshStandardMaterial>(
      r: (typeof RELIEF)[keyof typeof RELIEF],
      make: (c: string) => M,
    ) =>
    (c: string) =>
      withRelief(make(c), r);
  const firm = (c: string) => solid(c, tier, { roughness: 0.35, clearcoat: 0.3, fades: true });
  const inkAmount = o.shellInk ?? 0;
  /** The darker outline of a shell in colour `c` (none when the theme turns it off). */
  const inkOf = (c: string, fill = 0, share = 1) =>
    inkAmount > 0
      ? {
          ink: {
            color: deepen(c, SHELL_INK.darker, SHELL_INK.chroma, SHELL_INK.maxChroma),
            amount: inkAmount * share,
            power: SHELL_INK.power,
            fill,
          },
        }
      : {};
  const shell =
    (
      opacity: number,
      rimAlpha: number,
      side: THREE.Side = THREE.FrontSide,
      inkFill = 0,
      inkShare = 1,
    ) =>
    (c: string) =>
      glass(c, {
        opacity,
        side,
        rim: { color: c, strength: rimStrength, alpha: rimAlpha, ...inkOf(c, inkFill, inkShare) },
      });
  /** A small shell without the outline (the centrosome's halo). */
  const halo = (opacity: number, rimAlpha: number) => (c: string) =>
    glass(c, { opacity, rim: { color: c, strength: rimStrength, alpha: rimAlpha } });
  /** A part that glows from inside (bloom in HDR); its dimmed look does not glow. */
  const glowing = (strength: { direct: number; hdr: number }) => (c: string) => {
    const m = solid(c, tier, {
      roughness: 0.4,
      emissive: c,
      emissiveIntensity: hdr ? strength.hdr : strength.direct,
      fades: true,
    });
    m.userData.bloom = hdr;
    return m;
  };

  /**
   * Chromatid tubes carry their colours per vertex (maternal / paternal, piece by piece): the
   * material is white. Dimmed: the colour mixed halfway towards the stage colour in the shader.
   */
  const tubeLook = (): Look<THREE.MeshStandardMaterial> => {
    const make = () => {
      const m = keep(
        withEdgeShade(
          withVertexShade(
            withRelief(
              solid('#ffffff', tier, { roughness: 0.55, sheen: 0.7, fades: true }),
              RELIEF.chromatid,
            ),
            TUBE_SHADE_ATTRIBUTE,
          ),
          { strength: 0.6 * o.edgeShade },
        ),
      );
      m.vertexColors = true;
      return m;
    };
    const base = make();
    const hi = make();
    hi.emissive.set(palette.highlight);
    hi.emissiveIntensity = HI_EMISSIVE;
    hi.userData.look = 'hi';
    const dim = withTint(make(), towards, 0.5);
    dim.userData.look = 'dim';
    return { base, hi, dim };
  };

  // The wall (plant): a see-through shell; in HDR a fibrous surface (cellulose, illustrative:
  // stretched noise as a bump map) under a clear coat.
  const fibres = hdr && palette.wall ? keep(noiseTexture(11, 8)) : null;
  if (fibres) fibres.repeat.set(10, 2.5);
  const wallMaterial = (c: string): THREE.MeshStandardMaterial => {
    const rim = { color: c, strength: rimStrength, alpha: 0.6, ...inkOf(c, 0, WALL_INK) };
    if (!fibres) return shell(0.16, 0.6, THREE.FrontSide, 0, WALL_INK)(c);
    const m = new THREE.MeshPhysicalMaterial({
      color: c,
      roughness: 0.45,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      opacity: 0.2,
      bumpMap: fibres,
      bumpScale: 1.4,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
      forceSinglePass: true,
    });
    return withRim(m, rim);
  };

  /**
   * The faint lit back face that gives a see-through cell its volume (the recipes' shell look).
   * Diffuse light only (Lambert): it covers the whole cell, and software rendering pays for every
   * pixel of it.
   */
  const backFace = (c: string) =>
    new THREE.MeshLambertMaterial({
      color: c,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.BackSide,
    });

  const spindleMaterial = (c: string) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.45,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      opacity: SPINDLE_OPACITY.far,
      // The fibre geometry's alpha fades it towards its pole (`fibreGeometry`).
      vertexColors: true,
    });

  const membraneOpacity = o.plant ? o.membraneOpacity * 0.5 : o.membraneOpacity;
  const wallColour = palette.wall ?? palette.membrane;
  const plateColour = palette.plate ?? wallColour;
  const chiasmaColour = palette.chiasma ?? palette.centromere;
  const looks: DivisionLooks = {
    tube: tubeLook(),
    bead: look(palette.centromere, firm),
    chiasma: look(chiasmaColour, firm),
    chiasmaRing: look(chiasmaColour, glowing(CHIASMA_RING_EMISSIVE)),
    // One pass for the see-through double-sided parts (one draw call each, not two).
    envelope: look(
      palette.envelope,
      hdr
        ? relief(RELIEF.envelope, shell(0.3, 0.45, THREE.DoubleSide, INK_FILL.envelope))
        : shell(0.3, 0.45, THREE.DoubleSide, INK_FILL.envelope),
    ),
    nucleolus: look(
      palette.nucleolus,
      relief(RELIEF.nucleolus, (c) => solid(c, tier, { roughness: 0.55, sheen: 0.4, fades: true })),
    ),
    membrane: look(
      palette.membrane,
      shell(membraneOpacity, 0.55, THREE.FrontSide, INK_FILL.membrane),
    ),
    cytoplasm: (() => {
      const l = look(mixLinear(palette.membrane, '#000000', 0.3), backFace);
      // Highlighted with the membrane, the volume keeps its normal look (no yellow fill).
      l.hi.emissiveIntensity = 0;
      l.hi.opacity = l.base.opacity;
      return l;
    })(),
    wall: look(wallColour, wallMaterial),
    // Hollow barrels (seen inside from the open ends), as centrioles are drawn in textbooks.
    centriole: look(palette.centrosome, (c) =>
      solid(c, tier, { roughness: 0.35, clearcoat: 0.3, fades: true, side: THREE.DoubleSide }),
    ),
    pcm: look(palette.centrosome, (c) => {
      const m = halo(0.18, 0.3)(c);
      // A faint glow of its own: the halo reads as soft material around a bright core.
      m.emissive.set(c);
      m.emissiveIntensity = 0.25;
      return m;
    }),
    core: look(palette.centrosome, glowing(CORE_EMISSIVE)),
    ring: look(palette.ring, firm),
    plate: look(plateColour, (c) =>
      glass(c, {
        opacity: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.4,
        rim: { color: c, strength: rimStrength, alpha: 0.35 },
      }),
    ),
    plateVesicle: look(plateColour, (c) =>
      solid(c, tier, { roughness: 0.3, clearcoat: 0.4, fades: true }),
    ),
    spindle: look(palette.spindle, spindleMaterial),
    // Fragments of the nuclear envelope and its pores.
    vesicle: look(palette.envelope, (c) =>
      solid(c, tier, { roughness: 0.3, clearcoat: 0.4, fades: true }),
    ),
    pore: look(palette.envelope, firm),
    guide: keep(
      new THREE.MeshBasicMaterial({
        color: palette.guide ?? palette.spindle,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    ),
  };
  // Dimmed glowing parts recede like the others (no glow of their own).
  for (const l of [looks.core, looks.chiasmaRing]) l.dim.emissiveIntensity = 0.15;
  return looks;
}

/** Sets a look's opacity (highlighted a little more opaque, dimmed fainter). */
export function setLookOpacity(l: Look<THREE.Material>, opacity: number): void {
  l.base.opacity = opacity;
  l.hi.opacity = Math.max(opacity, Math.min(1, opacity + 0.25));
  l.dim.opacity = opacity * ((l.dim.userData.opacityScale as number | undefined) ?? 1);
}
