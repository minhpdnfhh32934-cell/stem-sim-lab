/**
 * Furniture and architecture drawn as a model inside the item's box (platform/render/props): the
 * box stays the collider and the aim box. A closed list, like `visual.model` and `material`: the
 * builders are three.js code in the renderer's bundle, so content is validated against these
 * names, never against the builders. Strings only (this file is in the menu's bundle).
 */
export const PROPS = [
  // the hub
  'column',
  'pilaster',
  'beam',
  'clerestory',
  'oculus',
  'light-panel',
  'emblem',
  'emblem-floor',
  'door-portal',
  'reception-desk',
  'bench-seat',
  'planter',
  'pendant',
  'path-light',
  // the laboratories
  'lab-island',
  'stool',
  'wall-bench',
  'wall-bench-sink',
  'tap',
  'cabinet-doors',
  'glassware-shelf',
  'safety-shower',
  'extinguisher',
  'microscope',
  'specimen-cabinet',
  'refrigerator',
  'plant-shelf',
  'fume-hood',
  // the physical lab
  'reagent-cabinet',
  'light-switch',
  // the other rooms
  'bookshelf',
  'whiteboard',
  // UX2 lobby
  'floor-field',
  'wainscot',
  'sign-mount',
  'periodic-table',
  'progress-board',
  'atom-model',
  'dna-helix',
  'standing-wave',
  'low-table',
  // UX2 preparation
  'ppe-cabinet',
  'bed-frame',
  'desk-drawer',
  'chair-frame',
  'notice-board',
  'sign-standoff',
  'locker-bank',
  'gowning-bench',
  'ppe-shelf',
  'hand-wash-sink',
  'wall-faucet',
  'liquid-dispenser',
  'towel-dispenser',
  'glove-dispenser',
  'pedal-bin',
  'wall-rail',
  'architrave',
  // UX3 doors: the sliding leaf and the hardware round its opening (platform/render/props/doors.ts)
  'door-leaf',
  'door-header',
  'door-rail',
  'door-jamb',
  'door-jamb-sealed',
  'door-plate-clean',
  'door-plate-hazard',
  // Phase U: the doors between a subject's rooms
  'starship-leaf',
  'starship-frame',
  // UX3 rooms: the teacher's washroom, and ceiling details shared by the rooms
  'toilet',
  'wall-basin',
  'mirror',
  'mirror-light',
  'roll-holder',
  'tile-wainscot',
  'fixture-trim',
  'air-diffuser',
  'ceiling-grille',
  'access-panel',
  'cable-tray',
  'coffer-ring',
  // UX3.1 PPE: what the PPE cabinet holds (platform/render/props/preparation.ts)
  'coat-on-hanger',
  'safety-goggles',
  'face-shield',
  // UX3.1 washroom door: a hinged leaf in its casing (platform/render/props/washroom.ts)
  'wc-door',
  // Phase E-1: the circuit bench's plug-in parts (platform/render/props/circuit.ts)
  'parts-cabinet',
  // Phase F-2: the hub's laptop (platform/render/props/laptop.ts)
  'gaming-laptop',
  'part-resistor',
  'part-lamp',
  'part-switch',
  'part-cell',
  'part-meter',
  'part-rheostat',
  'part-fuse',
] as const;

export type Prop = (typeof PROPS)[number];

/**
 * The tag of decorative items: no interactions, never focused; the renderer may draw their copies
 * together (platform/render/decorBatches.ts).
 */
export const DECOR = 'decor';
