import {
  CornerDownLeft,
  Keyboard,
  CloudDownload,
  FolderOpen,
  GraduationCap,
  House,
  Languages,
  Maximize2,
  Presentation,
  Save,
  Search,
  SlidersHorizontal,
  SunMoon,
  FlaskConical,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CATALOG } from '@/app/catalog';
import { useT, type MessageKey } from '@/app/i18n';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { openProject, saveProject } from '@/app/project/actions';
import { SECTIONS } from '@/app/settings/sectionMeta';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { goHome, openLab, openTopic } from '@/app/topics';
import { checkForUpdate, updatesSupported } from '@/app/update/updater';
import { SETTINGS_SECTIONS, SUBJECTS, useWorkspaceStore } from '@/app/workspaceStore';
import { openTeacher, useTeacherStore } from '@/teacher/teacherStore';
import { cx } from '@/ui/cx';
import { rankCommands, useCommandPalette, type Command } from './commands';
import './command.css';

/** Ctrl+K: search topics, pages, Settings and quick actions in one box. */
export function CommandPalette() {
  const t = useT();
  const open = useCommandPalette((s) => s.open);
  const setOpen = useCommandPalette((s) => s.setOpen);
  const theme = useResolvedTheme();
  const uiMode = useSettingsStore((s) => s.uiMode);
  const locale = useSettingsStore((s) => s.locale);
  const hasSimulation = useWorkspaceStore((s) => s.hasSimulation);
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();

  const commands = useMemo<Command[]>(() => {
    const items: Command[] = [
      {
        id: 'go.home',
        group: 'go',
        label: t('command.home'),
        icon: House,
        run: goHome,
      },
      {
        id: 'go.lab',
        group: 'go',
        label: t('command.lab'),
        icon: FlaskConical,
        run: openLab,
      },
      {
        id: 'go.teacher',
        group: 'go',
        label: t('command.teacherTalk'),
        keywords: 'chat hoi bai',
        icon: GraduationCap,
        run: () => {
          openTeacher();
          useTeacherStore.getState().setLayout('talk');
        },
      },
      {
        id: 'go.board',
        group: 'go',
        label: t('command.teacherBoard'),
        keywords: 'whiteboard bang trang giang',
        icon: Presentation,
        run: () => {
          // After openTeacher(), which always opens the talk layout.
          openTeacher();
          useTeacherStore.getState().setLayout('board');
        },
      },
    ];
    for (const subject of SUBJECTS) {
      for (const chapter of CATALOG[subject]) {
        for (const topic of chapter.topics) {
          if (topic.status !== 'available') continue;
          items.push({
            id: `topic.${topic.id}`,
            group: 'topics',
            label: t(topic.titleKey),
            hint: `${t(`subjects.${subject}`)} · ${t(chapter.titleKey)}`,
            icon: SUBJECT_ICON[subject],
            run: () => void openTopic(topic.id),
          });
        }
      }
    }
    for (const id of SETTINGS_SECTIONS) {
      const meta = SECTIONS[id];
      items.push({
        id: `settings.${id}`,
        group: 'settings',
        label: t(meta.title),
        hint: t(meta.hint),
        keywords: 'cai dat settings',
        icon: meta.icon,
        run: () => {
          useWorkspaceStore.getState().openSettingsAt(id);
        },
      });
    }
    const settings = useSettingsStore.getState();
    items.push(
      {
        id: 'action.theme',
        group: 'actions',
        label: t('command.theme'),
        keywords: 'dark light toi sang',
        icon: SunMoon,
        run: () => {
          settings.toggleTheme(theme);
        },
      },
      {
        id: 'action.mode',
        group: 'actions',
        label: t(uiMode === 'advanced' ? 'command.modeBasic' : 'command.modeAdvanced'),
        keywords: 'co ban nang cao basic advanced',
        icon: SlidersHorizontal,
        run: () => {
          settings.setUiMode(uiMode === 'advanced' ? 'basic' : 'advanced');
        },
      },
      {
        id: 'action.language',
        group: 'actions',
        label: t('command.language'),
        keywords: 'ngon ngu language english tieng viet',
        icon: Languages,
        run: () => {
          settings.setLocale(locale === 'vi' ? 'en' : 'vi');
        },
      },
      {
        id: 'action.presentation',
        group: 'actions',
        label: t('command.presentation'),
        keywords: 'trinh chieu fullscreen',
        icon: Maximize2,
        run: () => {
          useLayoutStore.getState().setPresentation(true);
        },
      },
    );
    if (hasSimulation) {
      items.push({
        id: 'action.save',
        group: 'actions',
        label: t('command.save'),
        icon: Save,
        run: () => void saveProject(),
      });
    }
    items.push({
      id: 'action.open',
      group: 'actions',
      label: t('command.open'),
      icon: FolderOpen,
      run: () => void openProject(),
    });
    if (updatesSupported()) {
      items.push({
        id: 'action.update',
        group: 'actions',
        label: t('command.update'),
        keywords: 'update cap nhat',
        icon: CloudDownload,
        run: () => void checkForUpdate(),
      });
    }
    return items;
  }, [t, theme, uiMode, locale, hasSimulation]);

  // Nothing is ranked or rendered while closed (the list would repeat every topic in the page).
  const results = useMemo(
    () => (open ? rankCommands(commands, query) : []),
    [open, commands, query],
  );
  const current = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      input.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  // Keep the highlighted row in view while moving with the arrow keys.
  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>(`[data-index="${String(current)}"]`);
    // jsdom has no scrollIntoView.
    if (row && 'scrollIntoView' in row) row.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const close = () => {
    setOpen(false);
    // Cleared on the way out: a learner who types right after Ctrl+K must not land on old text.
    setQuery('');
    setActive(0);
  };
  const run = (command: Command | undefined) => {
    if (!command) return;
    close();
    // After the dialog closed, so a page or another dialog can take the focus.
    requestAnimationFrame(() => {
      command.run();
    });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((current + 1) % Math.max(results.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((current - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[current]);
    }
  };

  const optionId = (i: number) => `${listId}-${String(i)}`;
  return (
    <dialog
      ref={ref}
      className="dialog command-palette"
      aria-label={t('command.title')}
      onClose={close}
      onClick={(e) => {
        // A click on the backdrop (outside the box) closes it.
        if (e.target === ref.current) close();
      }}
    >
      <div className="command-palette__search">
        <Search size={18} strokeWidth={1.75} aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results.length > 0 ? optionId(current) : undefined}
          aria-label={t('command.title')}
          placeholder={t('command.placeholder')}
          value={query}
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd>Esc</kbd>
      </div>
      <ul ref={list} id={listId} role="listbox" className="command-palette__list">
        {open && results.length === 0 && (
          <li className="command-palette__empty">{t('command.empty')}</li>
        )}
        {[...new Set(results.map((c) => c.group))].map((group) => {
          const inGroup = results.filter((c) => c.group === group);
          if (inGroup.length === 0) return null;
          return (
            <li key={group} role="presentation">
              <p className="command-palette__group" aria-hidden="true">
                {t(`command.groups.${group}` as MessageKey)}
              </p>
              <ul role="group" aria-label={t(`command.groups.${group}` as MessageKey)}>
                {inGroup.map((c) => {
                  const i = results.indexOf(c);
                  const Icon = c.icon;
                  return (
                    <li
                      key={c.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === current}
                      data-index={i}
                      className={cx('command-palette__item', i === current && 'is-active')}
                      onMouseMove={() => {
                        if (i !== current) setActive(i);
                      }}
                      onClick={() => {
                        run(c);
                      }}
                    >
                      <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                      <span className="command-palette__text">
                        <span>{c.label}</span>
                        {c.hint && <small>{c.hint}</small>}
                      </span>
                      {i === current && (
                        <CornerDownLeft
                          className="command-palette__enter"
                          size={14}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
      <footer className="command-palette__footer">
        <Keyboard size={13} strokeWidth={1.75} aria-hidden="true" />
        {t('command.keys')}
      </footer>
    </dialog>
  );
}
