import { invoke, isTauri } from '@tauri-apps/api/core';
import { checkInput, outputIsSafe, type InputCheck } from '@/safety/moderation';
import type { IncidentKind } from '@/safety/safety';
import { logIncident } from '@/safety/safetyStore';

/**
 * What SimLab gives the game in its frame for LAN rooms (#339; the game's side:
 * game/src/platform/net/simlabHost.ts). The frame is of the same origin and reads
 * `window.simlabRooms` on this window: every chat line passes SimLab's own checks, the same as a
 * question to the AI (`moderation.ts`), and a blocked or reported line is logged as its kind and
 * time only (the incident log never keeps content).
 */
export interface SimlabRooms {
  check(text: string): boolean;
  safe(text: string): boolean;
  report(): void;
}

const BLOCKED: Record<Exclude<InputCheck, { ok: true }>['reason'], IncidentKind> = {
  personalData: 'inputPersonalData',
  unsafe: 'inputUnsafe',
  crisis: 'inputCrisis',
};

export const simlabRooms: SimlabRooms = {
  check(text) {
    const result = checkInput(text);
    if (!result.ok) logIncident(BLOCKED[result.reason]);
    return result.ok;
  },
  safe(text) {
    const ok = outputIsSafe(text) && checkInput(text).ok;
    if (!ok) logIncident('outputUnsafe');
    return ok;
  },
  report() {
    logIncident('userReport');
  },
};

/** Puts the checks where the game's frame finds them; returns the undo. */
export function installGameBridge(): () => void {
  const w = window as unknown as { simlabRooms?: SimlabRooms };
  w.simlabRooms = simlabRooms;
  return () => {
    if (w.simlabRooms === simlabRooms) delete w.simlabRooms;
  };
}

/**
 * SimLab's room server (src-tauri/src/rooms): on the loopback while the game is open; it opens to
 * the LAN by itself only when the learner makes a room. In a plain browser there is none (the
 * game's Multiplayer card then says the server is not running).
 */
export function startRooms(): void {
  if (isTauri()) invoke('rooms_start').catch(() => undefined);
}

export function stopRooms(): void {
  if (isTauri()) invoke('rooms_stop').catch(() => undefined);
}
