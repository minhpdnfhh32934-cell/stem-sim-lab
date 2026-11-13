import { beforeEach, describe, expect, it } from 'vitest';
import { useNavigationStore } from '@/app/navigationStore';
import { TERMS_VERSION } from '@/safety/safety';
import { useSafetyStore } from '@/safety/safetyStore';
import {
  closeTeacher,
  openTeacher,
  openTeacherWithQuestion,
  useTeacherStore,
} from './teacherStore';

/** The launch page's age lock holds whichever way AI Teacher is asked for (Ctrl+K, "Hỏi thầy"…). */
describe('openTeacher follows the launch page’s age lock', () => {
  beforeEach(() => {
    closeTeacher();
    useNavigationStore.setState({ screen: 'lab', previousScreen: null });
  });

  it('under 18: neither way opens the page or writes a question', () => {
    useSafetyStore.setState({
      status: { termsVersion: TERMS_VERSION, answered: true, aiAllowed: false, minor: true },
    });
    openTeacher();
    openTeacherWithQuestion('Thầy giải thích giúp em về tâm động ạ?');
    expect(useTeacherStore.getState()).toMatchObject({ open: false, draft: null });
    expect(useNavigationStore.getState().screen).toBe('lab');
  });

  it('18 and over: the page opens with the question in its box', () => {
    useSafetyStore.setState({
      status: { termsVersion: TERMS_VERSION, answered: true, aiAllowed: true, minor: false },
    });
    openTeacherWithQuestion('Thầy giải thích giúp em về tâm động ạ?');
    expect(useTeacherStore.getState()).toMatchObject({
      open: true,
      draft: 'Thầy giải thích giúp em về tâm động ạ?',
    });
    expect(useNavigationStore.getState().screen).toBe('teacher');
  });
});
