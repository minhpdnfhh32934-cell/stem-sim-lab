import { labContent } from '../content/lab';
import { BUILT_IN_MODELS } from '../simulation/models';
import type { LabPack } from './content';

/**
 * The lab pack: every experiment definition (`content/experiments/<id>.json`), the topics and the
 * simulation models. The game imports it only dynamically (`Game.loadLab`): a chunk of its own,
 * downloaded the first time experiments are needed (the catalog, New game, Continue), never for the
 * menu, and validated against the core content before anything uses it (`addLabContent`).
 */
export const labPack: LabPack = { ...labContent, models: BUILT_IN_MODELS };
