import { House, Maximize2, Moon, Redo2, Search, Settings, Sun, Undo2 } from 'lucide-react';
import { memo } from 'react';
import { AiStatusPill } from '@/app/ai/AiStatusPill';
import { useT } from '@/app/i18n';
import { goHome, useIsHome, useIsLanding, useIsStudio, useIsTeacher } from '@/app/topics';
import { FileMenu } from '@/app/project/FileMenu';
import { redo, undo, useUndoStore } from '@/app/project/undo';
import { SettingsDialog } from '@/app/settings/SettingsDialog';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { IconButton } from '@/ui/IconButton';
import { Logo } from '@/ui/Logo';
import { useCommandPalette } from '@/app/command/commands';
import { useLayoutStore } from './layoutStore';
import { ProblemInput } from './ProblemInput';
import { SubjectSwitch } from './SubjectSwitch';

export const TopBar = memo(function TopBar() {
  const t = useT();
  const theme = useResolvedTheme();
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const setPresentation = useLayoutStore((s) => s.setPresentation);
  const settingsOpen = useWorkspaceStore((s) => s.settingsOpen);
  const setSettingsOpen = useWorkspaceStore((s) => s.setSettingsOpen);
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);
  const canUndo = useUndoStore((s) => s.canUndo);
  const canRedo = useUndoStore((s) => s.canRedo);

  const teacher = useIsTeacher();
  const studio = useIsStudio();
  const landing = useIsLanding();
  const home = (useIsHome() || landing) && !teacher;

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__brand"
        aria-label={t('home.goHome')}
        data-tip={t('home.goHome')}
        data-tip-side="bottom"
        aria-current={home ? 'page' : undefined}
        onClick={goHome}
      >
        <Logo />
        <span className="topbar__brand-text">
          <span className="topbar__name">{t('app.name')}</span>
          <span className="topbar__tagline">{t('app.tagline')}</span>
        </span>
        <House className="topbar__home-icon" size={15} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {/* Subjects and undo/redo belong to the lab; the AI Teacher page does not use them. */}
      {!landing && !teacher && !studio && <SubjectSwitch />}

      {/* On the home screen the big problem box is the main action; no second one up here. */}
      {home || teacher || studio ? <div className="topbar__spacer" /> : <ProblemInput />}

      <div className="topbar__actions">
        <AiStatusPill
          onClick={(section) => {
            if (section) openSettingsAt(section);
            else setSettingsOpen(true);
          }}
        />
        <IconButton
          icon={Search}
          label={t('command.openButton')}
          onClick={() => {
            useCommandPalette.getState().setOpen(true);
          }}
        />
        <span className="topbar__divider" aria-hidden="true" />
        {!teacher && (
          <>
            <IconButton
              icon={Undo2}
              label={t('topbar.undo')}
              disabled={!canUndo}
              onClick={() => {
                undo();
              }}
            />
            <IconButton
              icon={Redo2}
              label={t('topbar.redo')}
              disabled={!canRedo}
              onClick={() => {
                redo();
              }}
            />
          </>
        )}
        <IconButton
          icon={Moon}
          altIcon={Sun}
          showAlt={theme === 'dark'}
          label={t('topbar.toggleTheme')}
          animation="spin"
          onClick={() => {
            toggleTheme(theme);
          }}
        />
        <IconButton
          icon={Maximize2}
          label={t('topbar.presentation')}
          onClick={() => {
            setPresentation(true);
          }}
        />
        <FileMenu />
        <IconButton
          icon={Settings}
          label={t('topbar.settings')}
          animation="spin"
          onClick={() => {
            setSettingsOpen(true);
          }}
        />
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
        }}
      />
    </header>
  );
});
