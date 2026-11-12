import { Check, LassoSelect, Send, Square, X } from 'lucide-react';
import type { KeyboardEvent, RefObject, SyntheticEvent } from 'react';
import { useT, type MessageKey } from '@/app/i18n';
import { useBoardStore } from '@/teacher/board/boardStore';
import { subtitleText } from '@/teacher/board/lesson';
import { cut, selectionExcerpt, type BoardSelection } from '@/teacher/board/selection';
import { stopSpeaking } from '@/teacher/voice/speak';
import { cx } from '@/ui/cx';
import { useChatStore, type ChatEngine } from './chatStore';

const QUICK_ACTIONS = ['hint', 'again', 'slower', 'example', 'simpler', 'lost'] as const;
export type QuickAction = (typeof QUICK_ACTIONS)[number];

/**
 * Where the learner asks: the quick buttons about the last answer, the chip of the circled part
 * that goes with the question, the box, Think, and send (or "Dừng" while an answer is written).
 */
export function ChatComposer({
  showQuickActions,
  onQuickAction,
  boardAsk,
  boardInWords,
  draft,
  onDraftChange,
  onFocusChange,
  inputRef,
  onSend,
  busy,
  pending,
  engine,
}: {
  showQuickActions: boolean;
  onQuickAction: (key: QuickAction) => void;
  boardAsk: BoardSelection | undefined;
  boardInWords: boolean;
  draft: string;
  onDraftChange: (text: string) => void;
  /** The box gains or loses the keyboard focus. */
  onFocusChange?: (focused: boolean) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /** Sends the typed question (with the circled part when the chip is there). */
  onSend: () => void;
  busy: boolean;
  /** An answer is being written, here or in another panel. */
  pending: boolean;
  engine: ChatEngine;
}) {
  const t = useT();
  const thinkEnabled = useChatStore((s) => s.thinkEnabled);
  const setThinkEnabled = useChatStore((s) => s.setThinkEnabled);
  const stopAnswer = useChatStore((s) => s.stopAnswer);
  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    onSend();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      // Only a fresh press sends. A held Enter repeats: one that opened this page from a button
      // (e.g. "Hỏi thầy về bộ phận này", which writes a question into this box and focuses it)
      // must not send that question on its own; a held key never sends twice either.
      if (e.repeat) return;
      onSend();
    }
  };
  return (
    <>
      {/* "Giải thích lại", "Chậm hơn"… only make sense once there is an answer to rework. */}
      {showQuickActions && (
        <div className="teacher__quick-actions" role="group" aria-label={t('teacher.chipsLabel')}>
          {QUICK_ACTIONS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onQuickAction(key);
              }}
              disabled={busy}
            >
              {t(`teacher.chips.${key}` as MessageKey)}
            </button>
          ))}
        </div>
      )}
      {boardAsk && (
        // The question goes with what was circled; the learner can take it off.
        <div className="chat-panel__board-chip">
          <LassoSelect size={14} aria-hidden="true" />
          <span className="chat-panel__board-chip-text">
            {boardInWords
              ? t('chat.boardChipPictureWords')
              : boardAsk.status === 'picture'
                ? t('chat.boardChipPicture')
                : t('chat.boardChip', {
                    excerpt: cut(subtitleText(selectionExcerpt(boardAsk, 160)), 60),
                  })}
          </span>
          <button
            type="button"
            className="chat-panel__icon-button"
            onClick={() => {
              useBoardStore.getState().set({ selection: null });
            }}
            aria-label={t('chat.boardChipRemove')}
            title={t('chat.boardChipRemove')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <form className="chat-panel__composer" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            onDraftChange(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          rows={2}
          maxLength={4000}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.inputLabel')}
        />
        <div className="chat-panel__composer-actions">
          <button
            type="button"
            className={cx('chat-panel__think', thinkEnabled && 'is-on')}
            aria-pressed={thinkEnabled}
            onClick={() => {
              setThinkEnabled(!thinkEnabled);
            }}
            title={t('chat.thinkTitle')}
          >
            <Check size={14} /> {t('chat.think')}{' '}
            {/* A draft written on this computer is reviewed by one API only. */}
            {thinkEnabled && (
              <span>{engine === 'cloud' ? t('chat.twoApis') : t('chat.oneApiReview')}</span>
            )}
          </button>
          <span className="chat-panel__composer-spacer" />
          {pending && stopAnswer ? (
            // While an answer is being written, the main action is to stop it.
            <button
              type="button"
              className="btn chat-panel__stop"
              onClick={() => {
                stopSpeaking();
                stopAnswer();
              }}
              aria-label={t('chat.stopLabel')}
              title={t('chat.stopLabel')}
            >
              <Square size={14} aria-hidden="true" />
              {t('chat.stop')}
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn--accent chat-panel__send"
              disabled={!draft.trim() || busy}
              aria-label={t('chat.send')}
              data-tip={t('chat.enterHint')}
              data-tip-side="top"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </form>
    </>
  );
}
