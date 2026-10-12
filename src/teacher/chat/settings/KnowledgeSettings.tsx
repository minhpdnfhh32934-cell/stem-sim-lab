import { invoke, isTauri } from '@tauri-apps/api/core';
import { BookOpen, CircleAlert, FolderOpen, Globe, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatNumber, useT, type MessageKey } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useChatStore } from '../chatStore';
import { builtinKnowledge, builtinPendingCount } from '../knowledge';
import '../chat.css';

const EXTENSIONS = ['txt', 'md', 'csv', 'json'];

/**
 * "Thư viện kiến thức": the built-in notes, the learner's own files (.txt/.md/.csv/.json,
 * stored on this computer) and the opt-in Wikipedia lookup.
 */
export function KnowledgeSettings() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const chat = useChatStore();
  const [docError, setDocError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const desktop = isTauri();

  const addDocument = (name: string, text: string) => {
    if (text.length > 120_000) throw new Error(t('chatSettings.fileTooLarge'));
    const total = chat.documents
      .filter((d) => d.name !== name)
      .reduce((n, d) => n + d.text.length, 0);
    if (total + text.length > 1_500_000) throw new Error(t('chatSettings.libraryFull'));
    chat.addDocument({ id: crypto.randomUUID(), name, text, addedAt: Date.now() });
  };

  const checkExtension = (name: string) => {
    const extension = name.split('.').pop()?.toLowerCase();
    if (!extension || !EXTENSIONS.includes(extension)) {
      throw new Error(t('chatSettings.supportedFiles'));
    }
  };

  const importDocument = async () => {
    setDocError('');
    try {
      if (!desktop) {
        fileInput.current?.click();
        return;
      }
      const opened = await invoke<{ name: string; text: string } | null>('open_text_file', {
        filterName: t('chatSettings.fileFilter'),
        extensions: EXTENSIONS,
      });
      if (!opened) return;
      checkExtension(opened.name);
      addDocument(opened.name, opened.text);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // The native dialog filter is advisory: it still reports very large or binary files.
      setDocError(
        message.toLowerCase().includes('file too large') ? t('chatSettings.fileTooLarge') : message,
      );
    }
  };

  const importBrowserFile = async (file?: File) => {
    if (!file) return;
    setDocError('');
    try {
      checkExtension(file.name);
      // Early-out for absurdly large files (reading megabytes into memory just to count
      // characters would freeze the UI). The precise per-file character limit is enforced
      // by addDocument below, so this message stays truthful.
      if (file.size > 2_000_000) throw new Error(t('chatSettings.fileTooLarge'));
      addDocument(file.name, await file.text());
    } catch (e) {
      setDocError(e instanceof Error ? e.message : String(e));
    }
  };

  const builtIn = builtinKnowledge(locale);
  return (
    <>
      <fieldset className="settings-group">
        <legend>
          <BookOpen size={15} aria-hidden="true" />
          {t('chatSettings.builtInCard')}
        </legend>
        <p className="muted small">
          {t('chatSettings.builtIn', { count: builtIn.length, pending: builtinPendingCount() })}
        </p>
        <div className="chat-settings__builtin">
          {['physics', 'chemistry', 'biology'].map((subject) => (
            <span key={subject}>
              {t(`subjects.${subject}` as MessageKey)} ·{' '}
              {
                builtIn.filter((d) =>
                  d.id.includes(
                    subject === 'physics' ? 'physics' : subject === 'chemistry' ? 'chem' : 'bio',
                  ),
                ).length
              }{' '}
              {t('chatSettings.notes')}
            </span>
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <FolderOpen size={15} aria-hidden="true" />
          {t('chatSettings.library')}
          <span className="settings-count">{chat.documents.length}</span>
        </legend>
        <input
          ref={fileInput}
          className="chat-settings__file-input"
          type="file"
          accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
          onChange={(event) => {
            void importBrowserFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        <div className="chat-settings__actions">
          <button type="button" className="btn btn--accent" onClick={() => void importDocument()}>
            <Upload size={14} />
            {t('chatSettings.addFile')}
          </button>
          <span className="muted small">{t('chatSettings.supportedFiles')}</span>
        </div>
        {docError && (
          <p className="chat-settings__error" role="alert">
            <CircleAlert size={14} />
            {docError}
          </p>
        )}
        {chat.documents.length === 0 ? (
          <p className="muted small">{t('chatSettings.noDocs')}</p>
        ) : (
          <ul className="chat-settings__documents">
            {chat.documents.map((doc) => (
              <li key={doc.id}>
                <span>
                  <strong>{doc.name}</strong>
                  <small>
                    {formatNumber(locale, doc.text.length)} {t('chatSettings.characters')}
                  </small>
                </span>
                <button
                  type="button"
                  aria-label={`${t('chatSettings.removeFile')} ${doc.name}`}
                  onClick={() => {
                    chat.removeDocument(doc.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">{t('chatSettings.localLibraryPrivacy')}</p>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <Globe size={15} aria-hidden="true" />
          {t('chatSettings.webCard')}
        </legend>
        <label className={`chat-toggle chat-settings__web${chat.webLookup ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={chat.webLookup}
            onChange={(e) => {
              chat.setWebLookup(e.target.checked);
            }}
          />
          <span className="chat-toggle__track">
            <span />
          </span>
          <span>
            <strong>{t('chatSettings.webLookup')}</strong>
            <small>{t('chatSettings.webLookupHint')}</small>
          </span>
        </label>
      </fieldset>
    </>
  );
}
