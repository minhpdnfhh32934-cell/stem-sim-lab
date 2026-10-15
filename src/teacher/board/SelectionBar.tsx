import { CircleHelp, LassoSelect, MessageCircleQuestion, X } from 'lucide-react';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useBoardPictureReader } from '@/teacher/chat/pictureReader';
import { BOARD_ASK_EVENT } from './boardAsk';
import { useBoardStore } from './boardStore';
import { subtitleText } from './lesson';
import { cut, pickHits, selectionExcerpt, type SelectionHit } from './selection';

/** A hit as the learner reads it: formulas in plain symbols, short. */
function hitLabel(hit: SelectionHit, max = 48): string {
  return cut(subtitleText(hit.math ? `$${hit.text}$` : hit.text), max);
}

/**
 * What the learner circled, inside the board ("Khoanh để hỏi"): what the app read there and the
 * one main action, "Hỏi thầy chỗ này". When nothing was hit, or only a picture an AI on this
 * computer cannot read, the app says so itself and nothing is sent. Too much circled: the learner
 * picks one part or "Cả phần này". The selection stays until "Bỏ chọn", "Khoanh lại" or "Quay
 * lại bài giảng"; letting it go never resumes the lesson by itself.
 */
export function SelectionBar() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const selection = useBoardStore((s) => s.selection);
  const answering = useChatStore((s) => s.answering);
  const reader = useBoardPictureReader();
  if (!selection) return null;
  const store = () => useBoardStore.getState();
  const again = () => {
    store().set({ selection: null, askMode: true, penMode: false });
  };
  const clear = () => {
    store().set({ selection: null, askMode: false });
  };
  const ask = () => {
    window.dispatchEvent(new Event(BOARD_ASK_EVENT));
  };
  const pick = (ids: string[] | 'all') => {
    const s = store();
    if (s.selection) s.set({ selection: pickHits(s.selection, ids, s, locale) });
  };
  const status = selection.status;
  const canAsk = status === 'ok' || (status === 'picture' && reader !== null);
  return (
    <div className="board__ask-bar" role="group" aria-label={t('board.ask.barLabel')}>
      {status === 'ok' && (
        <p className="board__ask-text" aria-live="polite">
          <strong>{t('board.ask.excerpt')}</strong>{' '}
          <span className="board__ask-excerpt">
            «{subtitleText(selectionExcerpt(selection, 160))}»
          </span>
        </p>
      )}
      {status === 'picture' && (
        <p className="board__ask-text" aria-live="polite">
          {reader !== null ? (
            <>
              <strong>{t('board.ask.picture')}</strong> {t('board.ask.pictureLocal')}
            </>
          ) : (
            t('board.ask.pictureUnreadable')
          )}
        </p>
      )}
      {status === 'none' && (
        <p className="board__ask-text" aria-live="polite">
          {t('board.ask.none')}
        </p>
      )}
      {status === 'ambiguous' && (
        <>
          <p className="board__ask-text" aria-live="polite">
            <CircleHelp size={15} aria-hidden="true" />{' '}
            {t(selection.reason === 'unsure' ? 'board.ask.unsure' : 'board.ask.many')}
          </p>
          <div className="board__ask-choices">
            {selection.hits.slice(0, 8).map((hit) => (
              <button
                key={hit.id}
                type="button"
                className="btn"
                onClick={() => {
                  pick([hit.id]);
                }}
              >
                {hitLabel(hit)}
              </button>
            ))}
            <button
              type="button"
              className="btn"
              onClick={() => {
                pick('all');
              }}
            >
              {t('board.ask.all')}
            </button>
          </div>
        </>
      )}
      <div className="board__ask-actions">
        {canAsk && (
          <button type="button" className="btn btn--accent" disabled={answering} onClick={ask}>
            <MessageCircleQuestion size={15} aria-hidden="true" />
            {t('board.ask.ask')}
          </button>
        )}
        <button type="button" className="btn" onClick={again}>
          <LassoSelect size={15} aria-hidden="true" />
          {t('board.ask.again')}
        </button>
        <button type="button" className="btn" onClick={clear}>
          <X size={15} aria-hidden="true" />
          {t('board.ask.clear')}
        </button>
      </div>
    </div>
  );
}
