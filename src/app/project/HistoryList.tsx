import { History, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useT, type MessageKey } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import type { Subject } from '@/app/workspaceStore';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { toast } from '@/ui/toast';
import {
  clearHistory,
  deleteHistory,
  parseCreatedAt,
  useHistoryStore,
  type HistoryEntry,
} from './history';
import { parseSnapshot, restoreSnapshot } from './snapshot';

function isSubject(s: string): s is Subject {
  return s === 'physics' || s === 'chemistry' || s === 'biology';
}

export function HistoryList() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const entries = useHistoryStore((s) => s.entries);
  const [confirm, setConfirm] = useState(false);
  const fmt = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const reopen = (e: HistoryEntry) => {
    const r = parseSnapshot(e.snapshot);
    if (!r.ok) {
      toast(
        t(`project.invalid.${r.error}`, { name: t(`topics.${e.topicId}` as MessageKey) }),
        'error',
      );
      return;
    }
    void restoreSnapshot(r.snapshot);
  };

  if (entries.length === 0) {
    return (
      <div className="panel__scroll">
        <EmptyState icon={History} compact>
          {t('sidebar.historyEmpty')}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="panel__scroll history">
      <ul className="history__list">
        {entries.map((e) => {
          const Icon = isSubject(e.subject) ? SUBJECT_ICON[e.subject] : History;
          return (
            <li key={e.id} className="history__item">
              <button
                type="button"
                className="history__open"
                title={t('history.reopen')}
                onClick={() => {
                  reopen(e);
                }}
              >
                <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                <span className="history__text">
                  <span className="history__topic">{t(`topics.${e.topicId}` as MessageKey)}</span>
                  {e.title && <span className="history__title">{e.title}</span>}
                  <span className="history__time">{fmt.format(parseCreatedAt(e.createdAt))}</span>
                </span>
              </button>
              <IconButton
                icon={Trash2}
                size="sm"
                label={t('history.delete')}
                tooltipSide="left"
                onClick={() => {
                  void deleteHistory(e.id);
                }}
              />
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="btn history__clear"
        onClick={() => {
          if (confirm) {
            setConfirm(false);
            void clearHistory();
          } else {
            setConfirm(true);
            setTimeout(() => {
              setConfirm(false);
            }, 4000);
          }
        }}
      >
        <Trash2 size={14} aria-hidden="true" />
        {confirm ? t('history.confirmClear') : t('history.clearAll')}
      </button>
    </div>
  );
}
