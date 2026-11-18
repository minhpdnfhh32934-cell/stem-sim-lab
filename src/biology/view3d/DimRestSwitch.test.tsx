import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/app/settings/settingsStore';
import { MeiosisPanel, MitosisPanel } from '../division/views';
import { useMeiosis3D } from '../division/meiosis3d/store';
import { useMitosis3D } from '../division/mitosis3d/store';
import { useDimRest } from './dimRest';

/** Each panel with a way to say whether its 3D view is on screen. */
const PANELS = [
  [
    'mitosis',
    MitosisPanel,
    (active: boolean) => {
      useMitosis3D.setState({ active });
    },
  ],
  [
    'meiosis',
    MeiosisPanel,
    (active: boolean) => {
      useMeiosis3D.setState({ active });
    },
  ],
] as const;

describe('"Làm mờ phần còn lại" (#195 step 3)', () => {
  afterEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS });
    useDimRest.setState({ on: true });
    useMitosis3D.setState({ active: false });
    useMeiosis3D.setState({ active: false });
  });

  for (const [name, Panel, setActive] of PANELS) {
    it(`${name} 3D: the Inspector shows it in Advanced mode only, on by default`, () => {
      useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
      setActive(true);
      const { unmount } = render(<Panel />);
      expect(screen.queryByRole('switch', { name: 'Làm mờ phần còn lại' })).toBeNull();
      unmount();

      useSettingsStore.setState({ uiMode: 'advanced' });
      render(<Panel />);
      const sw = screen.getByRole('switch', { name: 'Làm mờ phần còn lại' });
      expect(sw).toBeChecked();
      fireEvent.click(sw);
      expect(useDimRest.getState().on).toBe(false);
    });

    it(`${name}: no switch while the 2D picture is shown`, () => {
      useSettingsStore.setState({ locale: 'vi', uiMode: 'advanced' });
      setActive(false);
      render(<Panel />);
      expect(screen.queryByRole('switch', { name: 'Làm mờ phần còn lại' })).toBeNull();
    });
  }
});
