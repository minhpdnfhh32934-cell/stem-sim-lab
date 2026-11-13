import type { Game } from '../../game/Game';
import type { Doing } from '../../multiplayer/protocol';

/** Looking down this far (rad) with free hands, the player looks at their hands (BodyView). */
const HANDS_PITCH = 0.6;

/**
 * What this player is doing, as the others draw it (2026-11-12): a test paper in hand, talking
 * with a person of the world, working at a station, on the phone (dialling, or on a call),
 * looking at their own hands — the first that holds, else null.
 */
export function doingOf(game: Game): Doing | null {
  const { session, player } = game.state;
  if (session.paper) return 'paper';
  if (session.conversation) return 'talk';
  if (session.workspace || session.explain) return 'work';
  if (game.phone.out) return game.phone.call.state === 'idle' ? 'dial' : 'call';
  const free =
    game.interaction.heldEntity === null && game.actions.current === null && player.rest === null;
  return free && -player.pitch > HANDS_PITCH ? 'hands' : null;
}
