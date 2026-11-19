import type { RoomGrade } from '../../world/definitions';

/**
 * Ultra's post-processing (Phase G, docs/phase-g-ultra-contract.md §4.1; under WebGL post.ts, under
 * WebGPU gpu/pipeline.ts), in a chunk of its own loaded only when Ultra is chosen: the scene drawn into a half-float target, then ambient
 * occlusion where things meet, bloom on what glows brighter than the room, tone mapping and sRGB
 * (three applies neither when drawing into a target), and SMAA last (the canvas's own MSAA does not
 * reach a target; 4× MSAA on the half-float target cost 60–100 ms a frame at 2561×1601 on the RTX
 * 5070 Laptop under ANGLE/D3D11, SMAA a millisecond or two). The outlines' stencil is kept.
 */
export const POST = {
  /** GTAO: radius in metres (a bench's contact, not a room's corner), how strongly it darkens. */
  ao: { radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1, blend: 1 },
  /**
   * Bloom on lamps, lit screens and the laser only. Threshold in linear units of the half-float
   * target: at 1.1 the labs' lit white walls passed it, and bloom's low-resolution blur laid over
   * the whole room made distant things look soft, as if drawn at a low resolution (Phú, on the
   * real display); at 2 the walls stay sharp and the light strips still glow.
   */
  bloom: { strength: 0.35, radius: 0.45, threshold: 2 },
  /**
   * WebGPU only (G2-2, gpu/pipeline.ts): light bounced from what is in view (SSGI) and its
   * occlusion, in place of GTAO. Slices × steps × 2 samples a pixel (three's SSGINode: 2 × 8 is its
   * "low" without temporal filtering, denoised); radius and thickness in metres.
   */
  gi: { slices: 2, steps: 8, radius: 1.5, thickness: 0.5, intensity: 8, ao: 0.7 },
  /**
   * WebGPU only (G2-2): a room's colour (RoomGrade), on the picture as shown. `warmth` tilts white
   * towards amber (+) or blue (−), `saturation` and `contrast` (round mid-grey) scale. A hall's
   * follows the daylight between its day and its night.
   */
  grade: {
    neutral: { warmth: 0, saturation: 1, contrast: 1 },
    hall: { warmth: 0.5, saturation: 1.08, contrast: 1.04 },
    hallNight: { warmth: -0.6, saturation: 0.9, contrast: 1.06 },
  },
  /** Seconds the grade takes to turn most of the way (crossing a door). */
  gradeEase: 0.8,
  /**
   * WebGPU only (G2-2, gpu/air.ts): light in dust, smoke and steam — how strongly it is added,
   * at what share of the frame's resolution it is drawn, and its blur's sigma (px of that).
   */
  air: { strength: 0.06, resolution: 0.25, blur: 2 },
} as const;

export interface Grade {
  warmth: number;
  saturation: number;
  contrast: number;
}

/** The grade of a room of `grade` at `daylight` (0 night … 1 day), into `out`. */
export function gradeOf(grade: RoomGrade, daylight: number, out: Grade): Grade {
  const { neutral, hall, hallNight } = POST.grade;
  if (grade === 'neutral') return Object.assign(out, neutral);
  const d = Math.min(1, Math.max(0, daylight));
  out.warmth = hallNight.warmth * (1 - d) + hall.warmth * d;
  out.saturation = hallNight.saturation * (1 - d) + hall.saturation * d;
  out.contrast = hallNight.contrast * (1 - d) + hall.contrast * d;
  return out;
}
