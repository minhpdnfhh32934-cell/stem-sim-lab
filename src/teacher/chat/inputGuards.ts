/** Checks on what would be sent, before any engine is asked (kind + time only are logged). */
import { translate, type Locale } from '@/app/i18n';
import { checkInput, type InputCheck } from '@/safety/moderation';
import { logIncident } from '@/safety/safetyStore';
import { selectionContext, type BoardSelection } from '@/teacher/board/selection';
import { screenContext } from './context';
import { TeacherError } from './teacherErrors';

function logRefusal(reason: Exclude<InputCheck, { ok: true }>['reason']): void {
  logIncident(
    reason === 'crisis'
      ? 'inputCrisis'
      : reason === 'personalData'
        ? 'inputPersonalData'
        : 'inputUnsafe',
  );
}

/**
 * The question itself did not pass the input check (crisis, personal data, unsuitable): it is
 * logged as kind + time only and never sent. The chat does not keep a blocked question, so it is
 * never sent later as history either. Returns the learner's message, or null when it may be sent.
 */
export function questionBlock(question: string, locale: Locale): TeacherError | null {
  const moderation = checkInput(question);
  if (moderation.ok) return null;
  logRefusal(moderation.reason);
  const key =
    moderation.reason === 'crisis'
      ? 'chat.errors.crisis'
      : moderation.reason === 'personalData'
        ? 'chat.errors.personal'
        : 'chat.errors.unsafe';
  return new TeacherError(translate(locale, key), null, false);
}

/** The board's text is the AI's, but it is sent again: it is checked like anything sent. */
export function checkBoardText(circled: BoardSelection, locale: Locale): void {
  const check = checkInput(selectionContext(circled, locale, 'full'));
  if (check.ok) return;
  logRefusal(check.reason);
  throw new Error(
    translate(
      locale,
      check.reason === 'personalData' ? 'chat.errors.boardPersonal' : 'chat.errors.boardUnsafe',
    ),
  );
}

/** What the shared screen would send is checked like the question (it is sent with it). */
export function checkSharedScreen(locale: Locale): void {
  const check = checkInput(screenContext(locale));
  if (check.ok) return;
  logRefusal(check.reason);
  throw new Error(
    translate(
      locale,
      check.reason === 'crisis'
        ? 'chat.errors.crisis'
        : check.reason === 'personalData'
          ? 'chat.errors.screenPersonal'
          : 'chat.errors.screenUnsafe',
    ),
  );
}
