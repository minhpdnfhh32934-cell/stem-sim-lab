import { create } from 'zustand';

/**
 * Whether the parts that are not picked are dimmed when a part is picked (the division 3D views).
 * On by default; the Inspector's "Làm mờ phần còn lại" switch (Advanced, `DimRestSwitch`) turns it
 * off. Never saved. Only the look changes, never the model.
 */
export const useDimRest = create<{ on: boolean }>(() => ({ on: true }));
