/** What a person's arms and head do (`actor.ts` animates each). */
export type Gesture =
  | 'idle'
  | 'talk'
  | 'listen'
  | 'type'
  | 'write'
  | 'drink'
  | 'read'
  | 'phone'
  | 'pose'
  | 'wait'
  /** Another player (2026-11-12): looking at their hands, dialling at the chest, doing a test. */
  | 'hands'
  | 'dial'
  | 'test';

/** A person as drawn this frame: the character page's people and the world's (Phase Y). */
export interface PersonView {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** Where the body faces (rad): 0 away from the camera (−z), π towards it. */
  readonly heading: number;
  /** Walking speed (m/s; 0 standing or seated). */
  readonly speed: number;
  readonly sit: boolean;
  readonly gesture: Gesture;
  /** Who or what they look at: a person's id, 'camera', or nothing in particular. */
  readonly look: string | null;
  /** Chosen: lit up. */
  readonly called: boolean;
  /** The walk's swing (rad) when their steps are heard (the world's people): the legs follow it. */
  readonly stride?: number;
  /** A key card in the right hand (tapping a door's reader). */
  readonly card?: boolean;
  /** A sheet of paper in the right hand (a test given or taken, Phase Y-5): the arm aims, NpcActors draws it. */
  readonly paper?: boolean;
  /** A pen in the right hand, and its ink. */
  readonly pen?: 'blue' | 'red' | null;
  /** Where the head looks up (+) or down (−), rad (another player's view): the head follows. */
  readonly pitch?: number;
}
