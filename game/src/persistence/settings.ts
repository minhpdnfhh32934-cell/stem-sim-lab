import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../core/i18n';
import type { Logger } from '../core/Logger';
import { describeError } from '../core/SystemRunner';
import type { SaveStorage } from './SaveSystem';

/**
 * A preference of the browser, not of a playthrough: each under its own key, outside every save.
 * `name` and `fallback` only word the warnings ("the language", "English").
 */
interface Setting<T> {
  key: string;
  options: readonly T[];
  fallback: T;
  name: string;
  fallbackName: string;
}

/** The value picked on an earlier visit; the fallback if none was or the stored text is not one. */
function load<T>(storage: SaveStorage, log: Logger, s: Setting<T>): T {
  let stored: string | null;
  try {
    stored = storage.read(s.key);
  } catch (error) {
    log.warn(`Could not read ${s.name}: ${describeError(error)}; using ${s.fallbackName}`);
    return s.fallback;
  }
  const value = s.options.find((o) => String(o) === stored);
  if (stored !== null && value === undefined) {
    log.warn(
      `Stored ${s.name.replace(/^the /, '')} "${stored}" is not one of ${s.options.join(', ')}; using ${s.fallbackName}`,
    );
  }
  return value ?? s.fallback;
}

/** Remembers a value for the next visit; if the browser refuses, it lasts until the tab closes. */
function save<T>(storage: SaveStorage, log: Logger, s: Setting<T>, value: T): void {
  try {
    storage.write(s.key, String(value));
  } catch (error) {
    log.warn(`Could not remember ${s.name}: ${describeError(error)}`);
  }
}

const LANGUAGE: Setting<Language> = {
  key: 'simlab.settings.language',
  options: LANGUAGES,
  fallback: DEFAULT_LANGUAGE,
  name: 'the language',
  fallbackName: 'English',
};

/** The language picked on an earlier visit; English if none was or the stored value is not one. */
export const loadLanguage = (storage: SaveStorage, log: Logger): Language =>
  load(storage, log, LANGUAGE);
export const saveLanguage = (storage: SaveStorage, language: Language, log: Logger): void =>
  save(storage, log, LANGUAGE, language);

/** Frame-rate caps the settings offer (frames per second); 0 is no cap of the game's own. */
export const FRAME_CAPS = [30, 60, 90, 120, 0] as const;
export type FrameCap = (typeof FRAME_CAPS)[number];
/** No cap: the browser's own pace (the display's refresh), as before the setting existed. */
export const DEFAULT_FRAME_CAP: FrameCap = 0;
const FRAME_CAP: Setting<FrameCap> = {
  key: 'simlab.settings.frameCap',
  options: FRAME_CAPS,
  fallback: DEFAULT_FRAME_CAP,
  name: 'the frame-rate cap',
  fallbackName: 'none',
};

export const loadFrameCap = (storage: SaveStorage, log: Logger): FrameCap =>
  load(storage, log, FRAME_CAP);
export const saveFrameCap = (storage: SaveStorage, cap: FrameCap, log: Logger): void =>
  save(storage, log, FRAME_CAP, cap);

/**
 * Graphics quality presets (what each turns on: platform/render/quality.ts). Medium by default: a
 * simulator meets every kind of machine, and medium is the look tuned and measured as the norm.
 */
export const GRAPHICS_QUALITIES = ['low', 'medium', 'high', 'ultra'] as const;
export type GraphicsQuality = (typeof GRAPHICS_QUALITIES)[number];
export const DEFAULT_GRAPHICS_QUALITY: GraphicsQuality = 'medium';
const GRAPHICS_QUALITY: Setting<GraphicsQuality> = {
  key: 'simlab.settings.graphicsQuality',
  options: GRAPHICS_QUALITIES,
  fallback: DEFAULT_GRAPHICS_QUALITY,
  name: 'the graphics quality',
  fallbackName: 'medium',
};

export const loadGraphicsQuality = (storage: SaveStorage, log: Logger): GraphicsQuality =>
  load(storage, log, GRAPHICS_QUALITY);
/** Whether a valid preset was picked on an earlier visit (else the game may suggest one). */
export function graphicsQualityChosen(storage: SaveStorage): boolean {
  try {
    return GRAPHICS_QUALITIES.some((q) => q === storage.read(GRAPHICS_QUALITY.key));
  } catch {
    return false;
  }
}

export const saveGraphicsQuality = (
  storage: SaveStorage,
  quality: GraphicsQuality,
  log: Logger,
): void => save(storage, log, GRAPHICS_QUALITY, quality);

/** The sound's mixer (Phase S): the overall volume and one for each kind of sound. */
export const AUDIO_BUSES = ['master', 'music', 'effects', 'room', 'interface', 'voice'] as const;
export type AudioBus = (typeof AUDIO_BUSES)[number];
/** Volume steps the settings offer (%). */
export const VOLUMES: readonly number[] = Array.from({ length: 21 }, (_, i) => i * 5);
export const DEFAULT_VOLUMES: Readonly<Record<AudioBus, number>> = {
  master: 80,
  // Phú (2026-11-05): chill and subtle, yet easy to hear (50 % was too quiet).
  music: 70,
  effects: 100,
  room: 70,
  interface: 70,
  // Phase Y: the teacher's spoken lines (the browser's speech), under the overall volume.
  voice: 100,
};
const volume = (bus: AudioBus): Setting<number> => ({
  key: `simlab.settings.volume.${bus}`,
  options: VOLUMES,
  fallback: DEFAULT_VOLUMES[bus],
  name: `the ${bus} volume`,
  fallbackName: `${DEFAULT_VOLUMES[bus]} %`,
});
const MUTED: Setting<boolean> = {
  key: 'simlab.settings.muted',
  options: [false, true],
  fallback: false,
  name: 'the mute',
  fallbackName: 'sound on',
};

export function loadVolumes(storage: SaveStorage, log: Logger): Record<AudioBus, number> {
  const out = { ...DEFAULT_VOLUMES };
  for (const bus of AUDIO_BUSES) out[bus] = load(storage, log, volume(bus));
  return out;
}
export const saveVolume = (storage: SaveStorage, bus: AudioBus, value: number, log: Logger): void =>
  save(storage, log, volume(bus), value);
export const loadMuted = (storage: SaveStorage, log: Logger): boolean => load(storage, log, MUTED);
export const saveMuted = (storage: SaveStorage, muted: boolean, log: Logger): void =>
  save(storage, log, MUTED, muted);

/**
 * Rooms out of sight are not drawn (world/dormancy.ts): on unless the player turns it off, e.g. to
 * compare the frame rate.
 */
const ROOM_SLEEP: Setting<boolean> = {
  key: 'simlab.settings.roomSleep',
  options: [false, true],
  fallback: true,
  name: 'the setting for rooms out of sight',
  fallbackName: 'rooms out of sight not drawn',
};
export const loadRoomSleep = (storage: SaveStorage, log: Logger): boolean =>
  load(storage, log, ROOM_SLEEP);
export const saveRoomSleep = (storage: SaveStorage, on: boolean, log: Logger): void =>
  save(storage, log, ROOM_SLEEP, on);

/** Look sensitivity steps (× the configured mouse sensitivity): the mouse, a finger's drag, a pad. */
export const LOOK_SENSITIVITIES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const;
export type LookSensitivity = (typeof LOOK_SENSITIVITIES)[number];
const LOOK_SENSITIVITY: Setting<LookSensitivity> = {
  key: 'simlab.settings.lookSensitivity',
  options: LOOK_SENSITIVITIES,
  fallback: 1,
  name: 'the look sensitivity',
  fallbackName: '1×',
};
export const loadLookSensitivity = (storage: SaveStorage, log: Logger): LookSensitivity =>
  load(storage, log, LOOK_SENSITIVITY);
export const saveLookSensitivity = (
  storage: SaveStorage,
  value: LookSensitivity,
  log: Logger,
): void => save(storage, log, LOOK_SENSITIVITY, value);

/** Looking by tilting a phone or tablet (its gyroscope): off until the player turns it on. */
const TILT_LOOK: Setting<boolean> = {
  key: 'simlab.settings.tiltLook',
  options: [false, true],
  fallback: false,
  name: 'the tilt-to-look setting',
  fallbackName: 'off',
};
export const loadTiltLook = (storage: SaveStorage, log: Logger): boolean =>
  load(storage, log, TILT_LOOK);
export const saveTiltLook = (storage: SaveStorage, on: boolean, log: Logger): void =>
  save(storage, log, TILT_LOOK, on);

/** How far the view turns for the device's turn (×; 1: as far as the device turned). */
const TILT_SENSITIVITY: Setting<LookSensitivity> = {
  key: 'simlab.settings.tiltSensitivity',
  options: LOOK_SENSITIVITIES,
  fallback: 1,
  name: 'the tilt sensitivity',
  fallbackName: '1×',
};
export const loadTiltSensitivity = (storage: SaveStorage, log: Logger): LookSensitivity =>
  load(storage, log, TILT_SENSITIVITY);
export const saveTiltSensitivity = (
  storage: SaveStorage,
  value: LookSensitivity,
  log: Logger,
): void => save(storage, log, TILT_SENSITIVITY, value);

/** The tilt's directions reversed (both: a device whose sensors are mounted the other way). */
const TILT_INVERT: Setting<boolean> = {
  key: 'simlab.settings.tiltInvert',
  options: [false, true],
  fallback: false,
  name: 'the tilt inversion',
  fallbackName: 'not inverted',
};
export const loadTiltInvert = (storage: SaveStorage, log: Logger): boolean =>
  load(storage, log, TILT_INVERT);
export const saveTiltInvert = (storage: SaveStorage, on: boolean, log: Logger): void =>
  save(storage, log, TILT_INVERT, on);
