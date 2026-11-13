import type { RawContent } from '../game/content';
import { coreContent } from './core';
import coreItems from './core-items.json';
import labItems from './items.json';
import { labContent } from './lab';
import { questionBanks } from './questions';
import labPlacements from './lab-placements.json';
import rooms from './rooms.json';

/**
 * All the bundled content at once, for tests (`buildContent` validates and cross-checks it whole):
 * every item, and every room with all its placements — the lab pack's after the core's, as the game
 * has them once the pack is added. The game never imports it: it boots with `coreContent` and loads
 * the lab pack on demand.
 */
export const bundledContent: RawContent = {
  ...coreContent,
  items: [...coreItems, ...labItems],
  rooms: rooms.map((room) => ({
    ...room,
    placements: [
      ...room.placements,
      ...labPlacements.flatMap((a): readonly unknown[] => (a.room === room.id ? a.placements : [])),
    ],
  })),
  experiments: labContent.experiments,
  topics: labContent.topics,
  questions: questionBanks,
  tasks: labContent.tasks,
  actions: labContent.actions,
};
