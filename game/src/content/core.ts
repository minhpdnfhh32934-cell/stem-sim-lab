import type { CoreRawContent } from '../game/content';
import characters from './characters.json';
import items from './core-items.json';
import laboratories from './laboratories.json';
import npcs from './npcs.json';
import procedures from './procedures.json';
import rooms from './rooms.json';
import scenes from './scenes.json';
import strings from './strings.json';

// shortcut: one JSON file per definition type (experiments: one file each, `lab.ts`); switch to
// import.meta.glob over a folder per type once a file grows past a few hundred definitions.

/**
 * The content the game boots with — the menu and the rooms it leads to, with their walls, doors and
 * lights, and the placements of every item a room outside the labs places (`core-items.json`).
 * The experiments, their topics, the items only the labs place and those placements are the lab
 * pack's (`lab.ts`), downloaded on first need, never for the menu.
 */
export const coreContent: CoreRawContent = {
  characters,
  items,
  rooms,
  laboratories,
  scenes,
  procedures,
  strings,
  npcs,
};
