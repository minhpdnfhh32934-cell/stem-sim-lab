import { create } from 'zustand';

/**
 * Whether the parts that are not picked are dimmed when a part is picked (the division 3D views).
 * Always on since the bench's switch for it went with the bench; never saved. Only the look
 * changes, never the model.
 */
export const useDimRest = create<{ on: boolean }>(() => ({ on: true }));
