import {
  ArrowDownToLine,
  Bot,
  Calculator,
  CircleHelp,
  ClipboardList,
  LassoSelect,
  Settings2,
  VolumeX,
} from 'lucide-react';
import { useT } from '@/app/i18n';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { AiContentBar } from '@/safety/AiContentBar';
import { boardAnswerText, subtitleText } from '@/teacher/board/lesson';
import { cut } from '@/teacher/board/selection';
import { cx } from '@/ui/cx';
import type { ChatEngine, ChatMessageRecord } from './chatStore';
import { answersPicture } from './memory';
import { MessageBody } from './MessageBody';
import { chipNumbers } from './provenance';

/** One message of the conversation, with the notes the app writes under an answer. */
export function ChatMessageView({
  message,
  index,
  messages,
  canContinue,
  unread,
  busy,
  engine,
  onContinue,
}: {
  message: ChatMessageRecord;
  index: number;
  messages: readonly ChatMessageRecord[];
  /** "Viết tiếp" is offered here: the last message, or the lesson's last answer. */
  canContinue: boolean;
  /** An answer about a circled picture that was not read aloud (readAloud). */
  unread: boolean;
  busy: boolean;
  engine: ChatEngine;
  onContinue: (message: ChatMessageRecord) => void;
}) {
  const t = useT();
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);
  return (
    <article className={cx('chat-message', `chat-message--${message.role}`)}>
      {message.role === 'assistant' && (
        <span className="chat-message__avatar">
          <Bot size={15} />
        </span>
      )}
      <div className="chat-message__body">
        {message.role === 'assistant' && message.missingData && (
          // Written by the app (missingData.ts), set apart from the AI's text above it.
          <div className="chat-message__app-notice" role="note">
            <strong>
              <ClipboardList size={14} aria-hidden="true" />
              {t('chat.missingDataTitle')}
            </strong>
            <span>{t('chat.missingData')}</span>
          </div>
        )}
        {message.role === 'assistant' ? (
          <MessageBody
            content={boardAnswerText(message.content, {
              reviewed: message.checkedBy !== undefined,
              question: questionBefore(messages, index),
            })}
          />
        ) : (
          <>
            <p>{message.content}</p>
            {message.boardRef && (
              // What the question was about: the board's own text, as it was circled.
              <small className="chat-message__board-ref">
                <LassoSelect size={13} aria-hidden="true" />{' '}
                {message.boardRef.excerpt
                  ? t('chat.boardRef', {
                      excerpt: cut(subtitleText(message.boardRef.excerpt), 120),
                    })
                  : t('chat.boardRefPicture')}
              </small>
            )}
          </>
        )}
        {message.role === 'assistant' && message.facts && message.facts.length > 0 && (
          <div className="chat-message__facts" role="note">
            <strong>
              <Calculator size={14} aria-hidden="true" />
              {t('chat.factsTitle')}
            </strong>
            <ul>
              {message.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </div>
        )}
        {message.role === 'assistant' &&
          message.unverifiedNumbers &&
          message.unverifiedNumbers.length > 0 &&
          (() => {
            // provenance.ts: values nobody gave the AI. Unverified, not "wrong". Written
            // by the app, so labelled as SimLab's like the missing-data notice.
            const chip = chipNumbers(message.unverifiedNumbers);
            const numbers = chip.shown.join(', ');
            return (
              <div
                className="chat-message__unverified"
                role="note"
                title={t('chat.unverifiedHint')}
              >
                <strong>
                  <CircleHelp size={14} aria-hidden="true" />
                  {t('chat.unverifiedTitle')}
                </strong>
                <span>
                  {t('chat.unverifiedNumbers', {
                    numbers: chip.more
                      ? `${numbers} ${t('chat.unverifiedMore', { count: chip.more })}`
                      : numbers,
                  })}
                </span>
              </div>
            );
          })()}
        {message.role === 'assistant' && (
          <AiContentBar
            {...(message.model ? { model: message.model } : {})}
            fallback={message.fallback === true}
          />
        )}
        {message.role === 'assistant' && message.checkedBy && (
          <small className="chat-message__meta">
            {t('chat.checkedMeta', { model: message.checkedBy })}
          </small>
        )}
        {message.role === 'assistant' && message.continuedUnreviewed && (
          <small className="chat-message__meta">{t('chat.continuedUnreviewed')}</small>
        )}
        {message.role === 'assistant' && message.reviewSkipped === 'picture' && (
          <small className="chat-message__meta">{t('chat.reviewSkippedPicture')}</small>
        )}
        {message.role === 'assistant' && unread && (
          <div className="chat-message__quiet" role="note">
            <VolumeX size={14} aria-hidden="true" />
            <small>{t('chat.notReadAloud')}</small>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                openSettingsAt('voice');
              }}
            >
              <Settings2 size={14} aria-hidden="true" /> {t('chat.voiceSettings')}
            </button>
          </div>
        )}
        {message.role === 'assistant' && message.references && message.references.length > 0 && (
          <small className="chat-message__references">
            {t('chat.references')}: {message.references.join(' · ')}
          </small>
        )}
        {message.role === 'assistant' &&
          message.truncated &&
          (() => {
            // The rest of an answer about a circled picture is written on this computer
            // only: an online AI never sees that answer (withoutPictureAsks), so it would
            // write the rest of something else.
            const staysHere =
              answersPicture(messages, index) || message.reviewSkipped === 'picture';
            return (
              <div className="chat-message__continue">
                <small>{t('chat.truncatedNote')}</small>
                {canContinue && staysHere && engine === 'cloud' ? (
                  <small>{t('chat.continuePictureLocal')}</small>
                ) : (
                  canContinue && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => {
                        onContinue(message);
                      }}
                    >
                      <ArrowDownToLine size={14} aria-hidden="true" />
                      {t('chat.continue')}
                    </button>
                  )
                )}
              </div>
            );
          })()}
      </div>
    </article>
  );
}

/**
 * The learner's question that the message at `index` answers (the user message before it), or
 * ''. A Think answer to a question about the learner's own draft keeps its words about a draft.
 */
function questionBefore(messages: readonly ChatMessageRecord[], index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === 'user') return m.content;
  }
  return '';
}
