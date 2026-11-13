import type { GraphicsQuality } from '../../persistence/settings';

/**
 * What each graphics quality preset turns on — the one place that says so; WorldRenderer applies
 * it. Both apply to scenes with enhanced lighting (every world scene since phase UX1); basic
 * scenes look the same under every preset.
 */
export interface QualityConfig {
  /**
   * Each room lit by its own fixtures (world/lighting.ts, phase UX2): a key spot with shadows and
   * fills. Without it one light over the scene, as before UX2: the cheap model, about twice as
   * fast on a software renderer (24 against 11 fps in the Physics Lab under SwiftShader), and the
   * default there (WorldRenderer).
   */
  roomLights: boolean;
  /** Each room's key light casts shadows (one 1024² map per lit room, phase UX2). */
  shadows: boolean;
  /**
   * Image-based light from a generated room (three's RoomEnvironment, prefiltered once): metals
   * and glossy surfaces reflect a soft room instead of only the lights. 0: none. The hemisphere
   * light gives way in proportion (`HEMISPHERE_GIVES_WAY` in WorldRenderer), so the room is not
   * lit twice: High keeps Medium's brightness.
   */
  environment: number;
  /**
   * The most device pixels drawn per CSS pixel, under the config's own cap
   * (`graphics.maxPixelRatio`, 2). Low draws one: on a 1.5–2× laptop screen that is a half to a
   * quarter of the pixels to shade, the largest cut an integrated GPU can take; Medium 1.5 (on a 2×
   * screen, 56 % of the pixels; Phú 2026-11-10); the HUD and menus stay sharp (they are HTML).
   * Every scene, basic or enhanced.
   */
  maxPixelRatio: number;
  /**
   * The anisotropic filtering floor of every texture the renderer draws (render-quality audit
   * F3): a texture gets max(its own value, this), never less than it had; three caps it at the
   * GPU's own maximum when it uploads. A filter, not a pass: Low's one change of cost.
   */
  anisotropy: number;
  /** The key lights' shadow maps (px a side; audit F7). Each key slot keeps one: 4 × size² × ~8 B. */
  shadowMapSize: number;
  /**
   * Live station screens' texels per metre (audit F2; a status screen 1.2× this). They repaint and
   * re-upload with their mipmaps 10 times a second while a run goes: Low keeps the 640 of before,
   * its cost unchanged (review HIGH-2); labels, ruler and tape are drawn once, at F2's density.
   */
  screenPxPerM: number;
  /**
   * Clear glassware drawn as a near-clear filter plus a sheen pass (audit F4; finishes.ts), and
   * liquids' sheen pass (F13): one more draw per glassware mesh. Off: the 35 % paint of before.
   */
  sheen: boolean;
  /**
   * Reflective materials (metal, glass and liquid sheen) get the room light as their own
   * environment map at this intensity, and metal turns fully metallic (audit F5, F6); the walls
   * keep `environment`. 0: none (a full metal without one renders black).
   */
  reflections: number;
  /** A soft contact shadow under each free-standing vessel (audit F14): one instanced draw. */
  contactShadows: boolean;
  /**
   * Mirrors' reflections (Phase H-1): their render target as a share of the drawing buffer's size
   * (one more render of what the mirror sees while it is in view and near). 0: none, the glass
   * alone (Low: no new pass).
   */
  mirrorScale: number;
  /**
   * The most times a second a shadow map is drawn while what it shows moves (shadowCache.ts:
   * otherwise only when something changed). Medium: 30 — a moving dial or ball redraws the whole
   * room's shadows, the heaviest load a laptop CPU met there (Phú 2026-11-10). Infinity: every frame.
   */
  shadowRateHz: number;
  /**
   * How far the key lights' shadow edges are blurred (three's `shadow.radius` on the PCF map: 1 is
   * three's default, a hard edge). Ultra's larger maps take a wider blur, a penumbra like a real
   * lamp's.
   */
  shadowRadius: number;
  /**
   * The post-processing chain (Phase G, `render/post.ts`, its own chunk loaded only for it):
   * ambient occlusion where things meet, bloom on what glows, MSAA on its target, tone mapping in
   * the last pass. Off: the canvas drawn directly, as before.
   */
  post: boolean;
  /**
   * Reflections of the room the player stands in, captured from it once (a cube camera at its
   * middle, prefiltered) instead of the generated room: steel and glass show the lab they are in.
   */
  roomReflections: boolean;
  /**
   * Real surfaces (Phase G-2, `render/surfaces.ts`): photographed CC0 materials laid in world space
   * on floors, walls, ceilings, furniture and props, loaded only for it.
   */
  surfaces: boolean;
  /**
   * Model detail (Phase G-3, `render/detail.ts`): bevelled boxes and twice the segments of round
   * parts, laid over every model as it is drawn; same sizes and places.
   */
  modelDetail: boolean;
  /**
   * The city under a glass floor (Phase V-2, render/city): none (the floor as it was, Low and
   * Medium), a simple city of plain buildings (High), or Ultra's, in full detail near the tower.
   */
  city: 'none' | 'simple' | 'full';
}

/**
 * Measured (P3.5): the room light costs ~0.7 ms a frame on an RTX 5070 Laptop GPU but triples
 * the frame under SwiftShader, and its gain is subtle (steel and brass reflect a soft room): High
 * only. Low drops the shadow passes (one per lit room since phase UX2), the room lights (three
 * lights instead of eleven: quality.test.ts) and the extra pixels of a high-DPI screen.
 * Presentation only: no preset reaches the simulation (quality.test.ts).
 *
 * Render-quality audit (docs/render-quality-audit.md §5, §12): Low stays cost-neutral — no new
 * draw, pass or map, only the texture filter, and live screens keep their old texel density;
 * Medium adds contact shadows; High alone has the glassware filter and sheen, reflections and
 * 2048² shadow maps (~128 MiB for the four key slots, against ~32 MiB at 1024²). Medium keeps the
 * glass paint: without an environment map a sheen pass catches only the spot lights' glints, so
 * a filter there left glass nearly invisible for one more draw each (review MED-1; turning
 * `sheen` on for Medium is one value, for the user's eyes). The look values (sheen, reflection
 * intensity, metalness) are starting points for the user's eyes, not tuned results.
 */
/** Live screens' texels per metre from Medium up (audit F2: sharp from about 1 m, native). */
const SCREEN_PX_PER_M = 1600;

export const QUALITY: Record<GraphicsQuality, QualityConfig> = {
  low: {
    roomLights: false,
    shadows: false,
    environment: 0,
    maxPixelRatio: 1,
    shadowRateHz: Infinity, // (no shadows)
    anisotropy: 4,
    shadowMapSize: 1024,
    screenPxPerM: 640, // as before F2
    sheen: false,
    reflections: 0,
    contactShadows: false,
    mirrorScale: 0,
    shadowRadius: 1,
    post: false,
    roomReflections: false,
    surfaces: false,
    modelDetail: false,
    city: 'none',
  },
  medium: {
    roomLights: true,
    shadows: true,
    environment: 0,
    maxPixelRatio: 1.5,
    shadowRateHz: 30,
    anisotropy: 8,
    shadowMapSize: 1024,
    screenPxPerM: SCREEN_PX_PER_M,
    sheen: false,
    reflections: 0,
    contactShadows: true,
    mirrorScale: 0.5,
    shadowRadius: 1,
    post: false,
    roomReflections: false,
    surfaces: false,
    modelDetail: false,
    city: 'none',
  },
  high: {
    roomLights: true,
    shadows: true,
    // environment was 0.25: it veiled distant contrast
    environment: 0.08,
    maxPixelRatio: Infinity,
    shadowRateHz: Infinity,
    anisotropy: 16,
    shadowMapSize: 2048,
    screenPxPerM: SCREEN_PX_PER_M,
    sheen: true,
    reflections: 1,
    contactShadows: true,
    mirrorScale: 1,
    shadowRadius: 1,
    post: false,
    roomReflections: false,
    surfaces: false,
    modelDetail: false,
    city: 'simple',
  },
  // Phase G (docs/phase-g-ultra-contract.md): High's look and more, for the reference GPU (RTX 5070
  // Laptop, 60 fps or more). Chosen only by the player, after its dialog; never by default.
  ultra: {
    roomLights: true,
    shadows: true,
    environment: 0.08,
    maxPixelRatio: Infinity,
    shadowRateHz: Infinity,
    anisotropy: 16,
    shadowMapSize: 4096,
    screenPxPerM: SCREEN_PX_PER_M,
    sheen: true,
    reflections: 1,
    contactShadows: true,
    mirrorScale: 1,
    shadowRadius: 4,
    post: true,
    roomReflections: true,
    surfaces: true,
    modelDetail: true,
    city: 'full',
  },
};
