import type { LocalizedText } from '@/core/data/dataset';
import type { Dimension } from '@/core/units';
import type { Locale } from '@/app/i18n/types';
import type { ScienceCardData } from '@/science-card/types';
import type { Camera } from './render/camera';

/** All scene parameters are numbers in SI (choices/toggles are encoded as numbers). */
export type Params = Record<string, number>;

/** Where a parameter value came from — shown to the user (§2.1). */
export type ParamSource = 'problem' | 'default' | 'user';

export interface ChoiceOption {
  value: number;
  label: LocalizedText;
}

export interface ParamDef {
  key: string;
  label: LocalizedText;
  /** KaTeX symbol, e.g. "v_0". */
  symbol: string;
  kind: 'number' | 'choice' | 'toggle';
  /** Physical dimension (for unit conversion); omit for dimensionless. */
  dim?: Dimension;
  /** Unit shown in the UI (value stored in SI). */
  unit?: string;
  /** Slider range in display units. */
  min?: number;
  max?: number;
  step?: number;
  choices?: ChoiceOption[];
  /** Can be changed while the simulation runs (applied live, counted as intervention). */
  live?: boolean;
  /** Parameter only relevant when `when(params)` is true. */
  when?: (p: Params) => boolean;
}

export interface SeriesDef {
  id: string;
  label: LocalizedText;
  /** Value in SI from the (interpolated) state vector. */
  value: (state: Float64Array, p: Params) => number;
}

export interface GraphDef {
  id: string;
  title: LocalizedText;
  /** Axis label, e.g. "x (m)". */
  yLabel: LocalizedText;
  series: SeriesDef[];
}

export interface Answer {
  id: string;
  label: LocalizedText;
  /** Value in SI. */
  value: number;
  /** Display unit symbol. */
  unit: string;
  /** Independent numerical cross-check of `value` (same unit), when available. */
  check?: number;
}

export interface SolutionStep {
  text: LocalizedText;
  /** KaTeX with the numbers already substituted. */
  tex?: string;
}

export interface Solution {
  answers: Answer[];
  steps: SolutionStep[];
  notes?: LocalizedText[];
}

/** Body that the user can pick/drag; positions are read from the state vector. */
export interface BodyDef {
  id: string;
  label: LocalizedText;
  /** World position (m) of the body's centre. */
  position: (state: Float64Array, p: Params) => { x: number; y: number };
  /** Pick radius in metres. */
  radius: (p: Params) => number;
  draggable: boolean;
  /** Properties listed in the Inspector while selected (SI values + display unit). */
  properties?: (
    state: Float64Array,
    p: Params,
  ) => { label: LocalizedText; symbol: string; value: number; unit: string }[];
}

export interface DrawOptions {
  vectors: boolean;
  /** The user dragged/changed something mid-run: analytic predictions no longer apply. */
  intervened: boolean;
  trail: boolean;
  selected: string | null;
  locale: Locale;
  colors: ThemeColors;
  time: number;
}

export interface ThemeColors {
  text: string;
  muted: string;
  faint: string;
  grid: string;
  gridMajor: string;
  ground: string;
  body: string;
  bodyAlt: string;
  accent: string;
  velocity: string;
  acceleration: string;
  force: string;
  spring: string;
  panel: string;
}

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  cam: Camera;
  state: Float64Array;
  p: Params;
  opts: DrawOptions;
}

export interface WorldBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** A physics topic: parameters, engine, analytic solution, card, graphs and drawing. */
export interface PhysicsScene {
  id: string;
  engineId: string;
  title: LocalizedText;
  params: ParamDef[];
  /**
   * Parameters a problem must state for the scene to be meaningful. When the AI cannot
   * find them in the problem, the confirmation table asks the user instead of guessing.
   */
  required: string[];
  /** Default parameter values (SI). Gravity is filled from Settings when `usesGravity`. */
  defaults: Params;
  usesGravity: boolean;
  /**
   * Recomputes parameters that are still at their default from the ones the problem gave
   * (e.g. a time span long enough to see the cars meet). Never overrides problem/user values.
   */
  autoDefaults?: (p: Params, sources: Record<string, ParamSource>) => Params;
  /** Playback speed that shows the whole run in a few seconds (e.g. ×100 for hour-long trips). */
  suggestedSpeed?: (p: Params) => number;
  /** Maps scene parameters to the engine's parameters (identity when omitted). */
  engineParams?: (p: Params) => Params;
  /** Stops/validates parameter combinations; returns localized error messages. */
  validate?: (p: Params) => LocalizedText[];
  scienceCard: (p: Params) => ScienceCardData;
  solve: (p: Params, locale: Locale) => Solution;
  graphs: GraphDef[];
  bodies: BodyDef[];
  /** World region to frame on load. */
  view: (p: Params) => WorldBounds;
  draw: (dc: DrawContext) => void;
  /** Trail point (world) for the trail tool, per body index. */
  trail?: (state: Float64Array, p: Params) => { x: number; y: number }[];
}
