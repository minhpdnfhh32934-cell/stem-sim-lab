import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNavigationStore } from '@/app/navigationStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useSimStore } from '@/app/sim/simStore';
import { openStudio } from '@/app/topics';
import { ChallengePanel } from '@/learn/ChallengePanel';
import { useProgressStore } from '@/learn/progressStore';
import { freeFall, horizontalProjectile } from '@/physics/projectile/scenes';
import type { PhysicsScene } from '@/physics/types';
import { builtInScenarios } from './scenarios';
import { createSession } from './session';
import { useStudioStore } from './studioStore';
import { TopicLessons } from './TopicLessons';

function showScene(scene: PhysicsScene) {
  act(() => {
    useSimStore.setState({ scene, params: { ...scene.defaults }, sources: {} });
  });
}

function lesson(id: string) {
  const s = builtInScenarios().find((x) => x.id === id);
  if (!s) throw new Error(`missing lesson ${id}`);
  return s;
}

beforeEach(() => {
  useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  useStudioStore.setState({ tab: 'chemistry', sessions: {}, picked: {} });
  useNavigationStore.setState({ screen: 'lab', previousScreen: null });
  useProgressStore.getState().reset();
});

describe('Science Studio from a lab topic', () => {
  it('Rơi tự do: "Dự đoán trước" leads to its lesson instead of a second prediction', async () => {
    const user = userEvent.setup();
    showScene(freeFall);
    render(<ChallengePanel />);
    const predict = screen.getByRole('region', { name: 'Dự đoán trước' });
    // No lab POE choices or run button: the prediction happens once, in the lesson.
    expect(within(predict).queryAllByRole('radio')).toEqual([]);
    expect(within(predict).queryByRole('button', { name: 'Chạy để kiểm tra' })).toBeNull();
    expect(predict).toHaveTextContent('Rơi tự do: thả từ độ cao gấp đôi');
    // The topic's challenges stay in the lab.
    expect(screen.getByRole('region', { name: /^Thử thách:/ })).toBeInTheDocument();
    await user.click(within(predict).getByRole('button', { name: 'Dự đoán trong Science Studio' }));
    expect(useNavigationStore.getState().screen).toBe('studio');
    expect(useStudioStore.getState().tab).toBe('physics');
    expect(useStudioStore.getState().picked.physics).toBe('physics.free-fall-height');
  });

  it('a topic without a lesson keeps its own lab prediction', () => {
    showScene(horizontalProjectile);
    render(<ChallengePanel />);
    const predict = screen.getByRole('region', { name: 'Dự đoán trước' });
    expect(within(predict).getAllByRole('radio').length).toBeGreaterThan(1);
    expect(within(predict).getByRole('button', { name: 'Chạy để kiểm tra' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Dự đoán trong Science Studio' })).toBeNull();
  });

  it('the inspector card opens the topic lesson; topics without one show nothing', async () => {
    const user = userEvent.setup();
    const none = render(<TopicLessons topicId="horizontalProjectile" />);
    expect(none.container).toBeEmptyDOMElement();
    none.unmount();
    render(<TopicLessons topicId="mitosis" />);
    await user.click(
      screen.getByRole('button', {
        name: /^Học theo bài: Nguyên phân 3D: khi nào NST kép xếp hàng/,
      }),
    );
    expect(useNavigationStore.getState().screen).toBe('studio');
    expect(useStudioStore.getState().tab).toBe('biology');
    expect(useStudioStore.getState().picked.biology).toBe('biology.mitosis-equator');
  });

  it('a new entry never resets the saved sessions, tab or picks', () => {
    const chem = lesson('chemistry.chloride-silver-nitrate');
    const fall = lesson('physics.free-fall-height');
    const chemSession = { ...createSession(chem, 1), step: 'observe' as const };
    const fallSession = { ...createSession(fall, 2), step: 'explain' as const };
    useStudioStore.setState({
      tab: 'chemistry',
      picked: { chemistry: chem.id },
      sessions: { [chem.id]: chemSession, [fall.id]: fallSession },
    });
    // The older way in (screen 'studio' via openStudio) and the new topic entry.
    act(() => {
      openStudio();
    });
    expect(useStudioStore.getState().tab).toBe('chemistry');
    showScene(freeFall);
    render(<ChallengePanel />);
    act(() => {
      screen.getByRole('button', { name: 'Dự đoán trong Science Studio' }).click();
    });
    const st = useStudioStore.getState();
    expect(st.sessions[chem.id]).toEqual(chemSession);
    expect(st.sessions[fall.id]).toEqual(fallSession);
    expect(st.picked).toEqual({ chemistry: chem.id, physics: fall.id });
    expect(st.tab).toBe('physics');
  });
});
