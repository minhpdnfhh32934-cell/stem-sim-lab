import { create } from 'zustand';

/** "SimLab 3D", the 3D lab game, shown over the app in a window of its own (docs/GAME.md). */
interface GameState {
  open: boolean;
}

export const useGameStore = create<GameState>()(() => ({ open: false }));

/** The game's own language setting (its key, not a SimLab one): first visit only. */
const GAME_LANGUAGE_KEY = 'simlab.settings.language';

export function openGame(locale: 'vi' | 'en'): void {
  try {
    // The game starts in English unless told otherwise; a learner's later choice in it stays.
    if (localStorage.getItem(GAME_LANGUAGE_KEY) === null) {
      localStorage.setItem(GAME_LANGUAGE_KEY, locale);
    }
  } catch {
    // No storage (private window): the game starts in English, still playable.
  }
  useGameStore.setState({ open: true });
}

export function closeGame(): void {
  useGameStore.setState({ open: false });
}
