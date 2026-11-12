import {
  BookMarked,
  BookOpenCheck,
  CircleHelp,
  CloudDownload,
  FolderOpen,
  History,
  ImageDown,
  Maximize2,
  Menu,
  MonitorCog,
  Moon,
  Redo2,
  Save,
  Sparkles,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MachineInfoDialog } from '@/app/bench/MachineInfo';
import { toLibrary } from '@/app/bench/toLibrary';
import { useT } from '@/app/i18n';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { openLab } from '@/app/topics';
import { checkForUpdate, updatesSupported } from '@/app/update/updater';
import { openWhatsNew, useWhatsNewStore } from '@/app/whatsnew/whatsNewStore';
import { IconButton } from '@/ui/IconButton';
import { toast } from '@/ui/toast';
import { exportPng, openProject, saveProject } from './actions';
import { redo, undo, useUndoStore } from './undo';
import { openPrivacy } from '@/safety/safetyStore';
import { startTour, useProjectUi } from './uiStore';

interface Item {
  icon: LucideIcon;
  label: string;
  hint?: string;
  run: () => void;
  /** Shown only while the header is short of room (bench.css), like the theme item. */
  className?: string;
  disabled?: boolean;
}

/**
 * "Tệp" menu: open / save `.stemsim`, export PNG, sources page, quick tour — and "Có gì mới"
 * (with a dot on the button) while the notes of an update are unseen, e.g. after "Để sau".
 * When the bench header is short of room the light / dark switch moves in here (#205 B2): the
 * item is always rendered and shown by the header's container query (bench.css).
 */
export function FileMenu({ history = false }: { history?: boolean } = {}) {
  const t = useT();
  const canUndo = useUndoStore((s) => s.canUndo);
  const canRedo = useUndoStore((s) => s.canRedo);
  const [open, setOpen] = useState(false);
  // "Thông tin máy" (Advanced, #201): render quality, FPS and RAM, the classic status bar's three.
  const [infoOpen, setInfoOpen] = useState(false);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const unseen = useWhatsNewStore((s) => s.pending.length > 0);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const dark = useResolvedTheme() === 'dark';
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    // The first item on screen (undo / redo and light / dark are hidden while the header has room).
    menuItems(root.current)[0]?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: Item[] = [
    // Undo / redo of an open topic, here when the header folds them away (#205 B2b).
    ...(history
      ? [
          {
            icon: Undo2,
            label: t('topbar.undo'),
            run: undo,
            className: 'file-menu__history',
            disabled: !canUndo,
          },
          {
            icon: Redo2,
            label: t('topbar.redo'),
            run: redo,
            className: 'file-menu__history',
            disabled: !canRedo,
          },
        ]
      : []),
    ...(unseen ? [{ icon: Sparkles, label: t('whatsnew.menu'), run: openWhatsNew }] : []),
    { icon: FolderOpen, label: t('project.open'), run: () => void openProject() },
    { icon: Save, label: t('project.save'), run: () => void saveProject() },
    { icon: ImageDown, label: t('project.exportPng'), run: () => void exportPng() },
    {
      icon: History,
      label: t('sidebar.history'),
      // The shelf's list (docs/BENCH_DESIGN.md §9.8): Basic has no other way to it.
      run: () => {
        toLibrary();
        useProjectUi.setState({ historyOpen: true, historyFocus: true });
      },
    },
    {
      icon: Maximize2,
      label: t('project.presentation'),
      run: () => {
        useLayoutStore.getState().setPresentation(true);
      },
    },
    {
      icon: BookMarked,
      label: t('project.sources'),
      run: () => {
        useProjectUi.setState({ sourcesOpen: true });
      },
    },
    ...(advanced
      ? [
          {
            icon: MonitorCog,
            label: t('project.machineInfo'),
            run: () => {
              setInfoOpen(true);
            },
          },
        ]
      : []),
    {
      icon: CloudDownload,
      label: t('update.menu'),
      run: () => {
        if (updatesSupported()) void checkForUpdate();
        else toast(t('update.browserOnly'), 'info');
      },
    },
    { icon: BookOpenCheck, label: t('project.privacy'), run: openPrivacy },
    {
      icon: CircleHelp,
      label: t('project.tour'),
      // The tour points at the lab: from the launch page, Studio or AI Teacher, go there first.
      run: () => {
        openLab();
        startTour();
      },
    },
  ];

  return (
    <div className="file-menu" ref={root} data-tour="file">
      <IconButton
        icon={Menu}
        label={unseen ? t('whatsnew.menuButton') : t('project.file')}
        active={open}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
        }}
      />
      {unseen && <span className="file-menu__dot" aria-hidden="true" />}
      {open && (
        <div
          className="file-menu__list"
          role="menu"
          aria-label={t('project.file')}
          data-surface="paper"
        >
          {items.map(({ icon: Icon, label, run, className, disabled }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              className={className ? `file-menu__item ${className}` : 'file-menu__item'}
              // Not `disabled`: the arrow keys still reach it (WAI-ARIA menu).
              aria-disabled={disabled || undefined}
              onClick={() => {
                if (disabled) return;
                setOpen(false);
                run();
              }}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                e.preventDefault();
                const all = menuItems(root.current);
                const i = all.indexOf(e.currentTarget);
                const next = all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length];
                next?.focus();
              }}
            >
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={dark}
            className="file-menu__item file-menu__theme"
            onClick={() => {
              setOpen(false);
              setTheme(dark ? 'light' : 'dark');
            }}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
              e.preventDefault();
              const all = menuItems(root.current);
              const i = all.indexOf(e.currentTarget);
              all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus();
            }}
          >
            <Moon size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{t('bench.darkTheme')}</span>
          </button>
        </div>
      )}
      {infoOpen && (
        <MachineInfoDialog
          onClose={() => {
            setInfoOpen(false);
            // The menu item that opened it is gone: back to Tệp, not <body>.
            root.current?.querySelector<HTMLButtonElement>('button')?.focus();
          }}
        />
      )}
    </div>
  );
}

/** The menu's items on screen (the theme item is hidden while the header has room). */
function menuItems(root: HTMLElement | null): HTMLButtonElement[] {
  return [...(root?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? [])].filter(
    (b) => getComputedStyle(b).display !== 'none',
  );
}
