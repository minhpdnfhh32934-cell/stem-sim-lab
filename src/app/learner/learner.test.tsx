import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { availableCount, chaptersFor, CURRICULUM_MAPPING, suggestions } from '@/app/levels';
import { basicSplit, BASIC_PARAM_COUNT } from '@/app/sim/basicParams';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useAiStore } from '@/ai/aiStore';
import { loadSafety } from '@/safety/safetyStore';
import { Onboarding } from './Onboarding';
import { useProfileStore } from './profileStore';

describe('levels (Level → Subject → Topic)', () => {
  it('every current topic is in "Nền tảng"; "Đại cương" is planned and empty', () => {
    expect(chaptersFor('foundation', 'physics').length).toBeGreaterThan(0);
    expect(chaptersFor('general', 'physics')).toEqual([]);
    expect(availableCount('general', 'biology')).toBe(0);
  });

  it('curriculum mapping is not invented: empty and pending review', () => {
    expect(CURRICULUM_MAPPING.review_status).toBe('pending');
    expect(Object.keys(CURRICULUM_MAPPING.entries)).toHaveLength(0);
  });

  it('suggestions list available topics, the chosen subjects first', () => {
    const s = suggestions('foundation', ['biology']);
    expect(s[0]?.subject).toBe('biology');
    expect(s.every((x) => x.topic.status === 'available')).toBe(true);
    expect(suggestions('general', ['physics'])).toEqual([]);
  });
});

describe('Basic mode parameters', () => {
  const defs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((key) => ({ key }));

  it(`shows the first ${BASIC_PARAM_COUNT}, the rest behind "Thêm thông số"`, () => {
    const { main, more } = basicSplit(defs, {});
    expect(main.map((d) => d.key)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(more.map((d) => d.key)).toEqual(['f', 'g']);
  });

  it('never hides a value from the problem or changed by the learner', () => {
    const { main, more } = basicSplit(defs, { g: 'problem', f: 'user' });
    expect(main.map((d) => d.key)).toContain('g');
    expect(main.map((d) => d.key)).toContain('f');
    expect(more).toHaveLength(0);
  });
});

describe('settings migration', () => {
  it('new installs start in Basic mode', () => {
    expect(useSettingsStore.getState().uiMode).toBe('basic');
  });

  it('people upgrading from v1 keep the full (Advanced) layout', async () => {
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { theme: 'dark', locale: 'vi', fontScale: 1 }, version: 1 }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().uiMode).toBe('advanced');
    expect(useSettingsStore.getState().theme).toBe('dark');
    act(() => {
      useSettingsStore.setState({ uiMode: 'basic', theme: 'system' });
    });
  });
});

describe('first-run onboarding', () => {
  beforeEach(() => {
    useProfileStore.setState({
      onboarded: false,
      connectSeen: false,
      interests: [],
      level: 'foundation',
    });
    useAiStore.setState({ status: 'noKey' });
  });

  it('level → subjects, then (main) "Kết nối AI" with "Để sau"', async () => {
    const user = userEvent.setup();
    await act(async () => {
      await loadSafety();
    });
    render(<Onboarding />);
    expect(screen.getByRole('heading', { name: /trình độ nào/ })).toBeInTheDocument();
    // "Đại cương" is shown but not available yet.
    expect(screen.getByRole('radio', { name: /Đại cương/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Tiếp' }));
    await user.click(screen.getByRole('button', { name: /Hóa học/ }));
    expect(useProfileStore.getState().interests).toEqual(['chemistry']);
    await user.click(screen.getByRole('button', { name: 'Xong' }));
    expect(useProfileStore.getState().onboarded).toBe(true);
    // The age gate is open in unit tests (tests/setup.ts), so "Kết nối AI" comes next.
    expect(await screen.findByRole('heading', { name: /Kết nối AI/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Để sau' }));
    expect(useProfileStore.getState().connectSeen).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Bỏ qua" finishes the profile steps at once', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: 'Bỏ qua' }));
    expect(useProfileStore.getState().onboarded).toBe(true);
  });
});
