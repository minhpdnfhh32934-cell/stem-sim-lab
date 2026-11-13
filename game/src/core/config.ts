import { z } from 'zod';
import { formatIssues } from './schema';

const KeyList = z.array(z.string().min(1)).min(1);

/**
 * Every tunable setting lives here with its default, so gameplay code never hard-codes them.
 * `prefault({})` makes each section optional: overrides only need the keys they change.
 * Audio settings are added together with the audio system (not in Phase 1).
 */
export const GameConfigSchema = z.object({
  game: z
    .object({
      initialScene: z.string().default('main-menu'),
      newGameScene: z.string().default('preparation-room'),
      saveSlot: z.string().default('slot-1'),
    })
    .prefault({}),
  player: z
    .object({
      walkSpeed: z.number().positive().default(2.2), // m/s
      runSpeed: z.number().positive().default(4.5), // m/s
      radius: z.number().positive().default(0.3), // m, collision capsule radius
      reach: z.number().positive().default(2.2), // m, max interaction and grab distance
      holdDistance: z.number().min(0.3).max(2).default(0.45), // m from the eye to a held object, looking ahead
      // A throw gives the object this impulse (N·s): heavier objects fly slower, as with a real
      // push; capped so very light objects stay sensible.
      throwImpulse: z.number().positive().default(2.5),
      maxThrowSpeed: z.number().positive().default(12), // m/s
      maxCarryMassKg: z.number().positive().default(15), // heaviest object the player can lift
    })
    .prefault({}),
  physics: z
    .object({
      gravity: z.number().min(0).max(50).default(9.81), // m/s², pointing down
      // Fixed simulation step (s). Physics never steps with the variable frame time.
      fixedStep: z
        .number()
        .min(1 / 240)
        .max(1 / 30)
        .default(1 / 60),
      // Steps allowed per frame; time beyond this is dropped so a slow frame cannot snowball.
      // 6 × 1/60 s = the 0.1 s frame cap in main.ts: real time down to 10 fps, slower below.
      maxSubSteps: z.number().int().min(1).max(10).default(6),
    })
    .prefault({}),
  graphics: z
    .object({
      fov: z.number().min(40).max(110).default(70),
      maxPixelRatio: z.number().min(0.5).max(4).default(2),
      antialias: z.boolean().default(true),
    })
    .prefault({}),
  input: z
    .object({
      mouseSensitivity: z.number().positive().default(0.0025), // rad per pixel
      invertY: z.boolean().default(false),
      bindings: z
        .object({
          moveForward: KeyList.default(['KeyW', 'ArrowUp']),
          moveBack: KeyList.default(['KeyS', 'ArrowDown']),
          moveLeft: KeyList.default(['KeyA', 'ArrowLeft']),
          moveRight: KeyList.default(['KeyD', 'ArrowRight']),
          run: KeyList.default(['ShiftLeft', 'ShiftRight']),
          interact: KeyList.default(['KeyE']),
          // The target's second available action (e.g. Inspect next to Grab).
          secondary: KeyList.default(['KeyF']),
          // Mouse buttons are `Mouse<button>` (Mouse0 = left); read only while the mouse is captured.
          throw: KeyList.default(['Mouse0']),
          // Puts the held object away; with free hands, takes the selected hotbar item out.
          stow: KeyList.default(['KeyQ']),
          // Held down: tilts (or squeezes) the held glassware to pour. RMB may not reach the game
          // under pointer lock in every browser (not verified); R always does.
          pour: KeyList.default(['KeyR', 'Mouse2']),
          // Held down: the close-inspection view (narrower field of view).
          inspect: KeyList.default(['KeyC', 'Mouse1']),
          inventory: KeyList.default(['KeyI']),
          // The guided tasks' list in a lab that offers them (Phase A).
          tasks: KeyList.default(['KeyT']),
          // The Explain view at the nearest station: its parts named, its principle step by step.
          explain: KeyList.default(['KeyH']),
          // The player's phone (Phase E-2): out of the bag and away again; dial 114 for a fire.
          phone: KeyList.default(['KeyP']),
          // With the phone out, the number keys dial (1–9 are the hotbar's keys, 0 its own).
          dial0: KeyList.default(['Digit0', 'Numpad0']),
          hotbar1: KeyList.default(['Digit1']),
          hotbar2: KeyList.default(['Digit2']),
          hotbar3: KeyList.default(['Digit3']),
          hotbar4: KeyList.default(['Digit4']),
          hotbar5: KeyList.default(['Digit5']),
          hotbar6: KeyList.default(['Digit6']),
          hotbar7: KeyList.default(['Digit7']),
          hotbar8: KeyList.default(['Digit8']),
          hotbar9: KeyList.default(['Digit9']),
          // In a LAN room (2026-11-12): the chat line to type in, and held down, talking.
          chat: KeyList.default(['Enter', 'NumpadEnter']),
          talk: KeyList.default(['KeyV']),
          toggleDebug: KeyList.default(['F3']),
        })
        .prefault({}),
    })
    .prefault({}),
  debug: z
    .object({
      enabled: z.boolean().default(false),
      logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    })
    .prefault({}),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;
export type InputAction = keyof GameConfig['input']['bindings'];

/** Builds the effective config from (partial) overrides; throws with every invalid path. */
export function resolveConfig(overrides: unknown = {}): GameConfig {
  const parsed = GameConfigSchema.safeParse(overrides);
  if (!parsed.success) {
    throw new Error(`Invalid configuration:\n${formatIssues(parsed.error, 'config').join('\n')}`);
  }
  return parsed.data;
}
