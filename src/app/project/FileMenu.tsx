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
  Save,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MachineInfoDialog } from '@/app/bench/MachineInfo';
import { toLibrary } from '@/app/bench/toLibrary';
import { useT } from '@/app/i18n';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { openLab } from '@/app/topics';
import { checkForUpdate, updatesSupported } from '@/app/update/updater';
import { openWhatsNew, useWhatsNewStore } from '@/app/whatsnew/whatsNewStore';
import { IconButton } from '@/ui/IconButton';
import { toast } from '@/ui/toast';
import { exportPng, openProject, saveProject } from './actions';
import { openPrivacy } from '@/safety/safetyStore';
import { startTour, useProjectUi } from './uiStore';

interface Item {
  icon: LucideIcon;
  label: string;
  hint?: string;
  run: () => void;
}

/**
 * "Tệp" menu: open / save `.stemsim`, export PNG, sources page, quick tour — and "Có gì mới"
 * (with a dot on the button) while the notes of an update are unseen, e.g. after "Để sau".
 */
export function FileMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  // "Thông tin máy" (Advanced, #201): render quality, FPS and RAM, the classic status bar's three.
  const [infoOpen, setInfoOpen] = useState(false);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const unseen = useWhatsNewStore((s) => s.pending.length > 0);
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
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: Item[] = [
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
          {items.map(({ icon: Icon, label, run }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              className="file-menu__item"
              onClick={() => {
                setOpen(false);
                run();
              }}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                e.preventDefault();
                const all = [
                  ...(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
                ];
                const i = all.indexOf(e.currentTarget);
                const next = all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length];
                next?.focus();
              }}
            >
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
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
