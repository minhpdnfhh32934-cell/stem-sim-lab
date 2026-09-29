import { create } from 'zustand';

const TOUR_KEY = 'stemsim.tourDone';

function readTourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return true;
  }
}

export interface ProjectUiState {
  sourcesOpen: boolean;
  /** Index of the tour step shown, or null when the tour is closed. */
  tourStep: number | null;
}

export const useProjectUi = create<ProjectUiState>()(() => ({
  sourcesOpen: false,
  tourStep: readTourDone() ? null : 0,
}));

export function startTour(): void {
  useProjectUi.setState({ tourStep: 0 });
}

export function endTour(): void {
  useProjectUi.setState({ tourStep: null });
  try {
    localStorage.setItem(TOUR_KEY, '1');
  } catch {
    // Not persisted: the tour shows again next time, which is harmless.
  }
}
