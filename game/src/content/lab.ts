import type { LabPack } from '../game/content';
import actions from './actions.json';
import items from './items.json';
import placements from './lab-placements.json';
import laboratories from './laboratories.json';
import tasks from './tasks.json';
import topics from './topics.json';

/** Every experiment definition, one file each, named after its id: `experiments/<id>.json`. */
const files = import.meta.glob<unknown>('./experiments/*.json', { eager: true, import: 'default' });

const idOf = (path: string) => path.slice('./experiments/'.length, -'.json'.length);
const listed = (laboratories as { experiments?: string[] }[]).flatMap((l) => l.experiments ?? []);
/** Where an experiment goes: as the laboratories list it, then any other one, by id. */
const rank = (id: string) => (listed.includes(id) ? listed.indexOf(id) : listed.length);

/**
 * The lab pack's content (`game/labPack.ts`): the experiments, in that stable order — validation
 * paths name one by its place in it (`experiments.2.instruments.0`) — their topics, the items only
 * the labs place (`items.json`: apparatus, station controls, lab furniture) and the labs'
 * placements, by room (`lab-placements.json`: the stations and everything else in a lab but its
 * doors and ceiling fittings, which are the core's).
 */
export const labContent: Omit<LabPack, 'models'> = {
  experiments: Object.keys(files)
    .map(idOf)
    .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1))
    .map((id) => files[`./experiments/${id}.json`]),
  topics,
  tasks,
  items,
  placements,
  actions,
};
