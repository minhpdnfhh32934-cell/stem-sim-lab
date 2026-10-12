import { create } from 'zustand';

export type AppScreen = 'home' | 'lab' | 'teacher';

interface NavigationState {
  screen: AppScreen;
  previousScreen: Exclude<AppScreen, 'teacher'> | null;
  setScreen: (screen: AppScreen) => void;
  returnFromTeacher: () => void;
}

export const useNavigationStore = create<NavigationState>()((set) => ({
  screen: 'home',
  previousScreen: null,
  setScreen: (screen) => {
    set((state) => ({
      screen,
      previousScreen:
        screen === 'teacher'
          ? state.screen === 'teacher'
            ? state.previousScreen
            : state.screen
          : state.previousScreen,
    }));
  },
  returnFromTeacher: () => {
    set((state) => ({
      screen: state.previousScreen ?? 'home',
      previousScreen: null,
    }));
  },
}));
