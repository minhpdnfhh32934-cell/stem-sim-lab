import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translate, type MessageKey } from '@/app/i18n';
import type { BoardSelection } from '@/teacher/board/selection';
import { provideScreenContext } from './context';
import { TeacherError } from './teacherErrors';

const incidents: string[] = [];
vi.mock('@/safety/safetyStore', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/safety/safetyStore')>();
  return {
    ...real,
    logIncident: (kind: string) => {
      incidents.push(kind);
    },
  };
});

const { checkBoardText, checkSharedScreen, questionBlock } = await import('./inputGuards');

const circled = (text: string): BoardSelection => ({
  face: 0,
  shape: 'closed',
  status: 'ok',
  points: [],
  bbox: { x: 0, y: 0, w: 100, h: 40 },
  hits: [
    {
      id: 'w1',
      kind: 'text',
      column: 'center',
      role: 'body',
      text,
      math: false,
      whole: true,
      status: null,
      struck: false,
      coverage: 1,
      boxes: [],
      x: 10,
      y: 10,
      index: 1,
    },
  ],
  title: 'Bài',
  neighbours: [],
  strokes: 0,
  figures: [],
});

/** text, incident logged, then the learner's sentence for the question, the board, the screen. */
const REFUSED: [string, string, MessageKey, MessageKey, MessageKey][] = [
  [
    'Em không muốn sống nữa',
    'inputCrisis',
    'chat.errors.crisis',
    'chat.errors.boardUnsafe',
    'chat.errors.crisis',
  ],
  [
    'Gọi em số 0912 345 678 nhé',
    'inputPersonalData',
    'chat.errors.personal',
    'chat.errors.boardPersonal',
    'chat.errors.screenPersonal',
  ],
  [
    'khiêu dâm',
    'inputUnsafe',
    'chat.errors.unsafe',
    'chat.errors.boardUnsafe',
    'chat.errors.screenUnsafe',
  ],
];

beforeEach(() => {
  incidents.length = 0;
});

describe('input guards', () => {
  it.each(REFUSED)('%s → %s', (text, incident, question, board, screen) => {
    const blocked = questionBlock(text, 'vi');
    expect(blocked).toBeInstanceOf(TeacherError);
    expect(blocked?.message).toBe(translate('vi', question));
    expect(blocked?.section).toBeNull();
    expect(blocked?.retry).toBe(false);

    const refused = (check: () => void) => {
      try {
        check();
      } catch (e) {
        return e;
      }
      throw new Error('expected a refusal');
    };
    const onBoard = refused(() => {
      checkBoardText(circled(text), 'vi');
    });
    expect(onBoard).not.toBeInstanceOf(TeacherError);
    expect((onBoard as Error).message).toBe(translate('vi', board));

    const remove = provideScreenContext(() => text);
    const onScreen = refused(() => {
      checkSharedScreen('vi');
    });
    remove();
    expect(onScreen).not.toBeInstanceOf(TeacherError);
    expect((onScreen as Error).message).toBe(translate('vi', screen));

    expect(incidents).toEqual([incident, incident, incident]);
  });

  it('lets ordinary text through and logs nothing', () => {
    const text = 'Lực ma sát là gì?';
    expect(questionBlock(text, 'vi')).toBeNull();
    checkBoardText(circled(text), 'vi');
    const remove = provideScreenContext(() => text);
    checkSharedScreen('vi');
    remove();
    expect(incidents).toEqual([]);
  });
});
