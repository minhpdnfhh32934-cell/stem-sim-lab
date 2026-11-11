import { create } from 'zustand';

const TOUR_KEY = 'stemsim.tourDone';

/** The lab tour was done or skipped once (`stemsim.tourDone`): this is not the first run. */
export function readTourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return true;
  }
}

export interface ProjectUiState {
  sourcesOpen: boolean;
  /** The shelf's "Lịch sử" list is open (Tệp → Lịch sử opens it in Basic too). */
  historyOpen: boolean;
  /** Once: the shelf moves the focus to "Lịch sử" when it shows it (Tệp → Lịch sử). */
  historyFocus: boolean;
  /** Index of the tour step shown, or null when the tour is closed. */
  tourStep: number | null;
}

export const useProjectUi = create<ProjectUiState>()(() => ({
  sourcesOpen: false,
  historyOpen: false,
  historyFocus: false,
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
