import {
  BookOpen,
  Cpu,
  GraduationCap,
  Gpu,
  History,
  Keyboard,
  Orbit,
  Palette,
  PlugZap,
  ShieldCheck,
  Volume2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { AiSettings } from '@/app/ai/AiSettings';
import { useT, type MessageKey } from '@/app/i18n';
import { SETTINGS_SECTIONS, useWorkspaceStore, type SettingsSection } from '@/app/workspaceStore';
import { SafetySettings } from '@/safety/SafetySettings';
import { GemmaGpuSettings } from '@/teacher/chat/settings/GemmaGpuSettings';
import { GemmaSettings } from '@/teacher/chat/settings/GemmaSettings';
import { KnowledgeSettings } from '@/teacher/chat/settings/KnowledgeSettings';
import { MemorySettings } from '@/teacher/chat/settings/MemorySettings';
import { TeacherSettings } from '@/teacher/chat/settings/TeacherSettings';
import { VoiceSettings } from '@/teacher/voice/VoiceSettings';
import { IconButton } from '@/ui/IconButton';
import { AppearanceSettings, ShortcutSettings, SimulationSettings } from './GeneralSettings';
import './settings.css';

interface SectionMeta {
  icon: LucideIcon;
  title: MessageKey;
  hint: MessageKey;
  group: 'general' | 'ai' | 'privacy';
  Body: ComponentType;
}

/** One page per section; the navigation lists them in this order, grouped. */
const SECTIONS: Record<SettingsSection, SectionMeta> = {
  appearance: {
    icon: Palette,
    title: 'settings.nav.appearance',
    hint: 'settings.nav.appearanceHint',
    group: 'general',
    Body: AppearanceSettings,
  },
  simulation: {
    icon: Orbit,
    title: 'settings.nav.simulation',
    hint: 'settings.nav.simulationHint',
    group: 'general',
    Body: SimulationSettings,
  },
  ai: {
    icon: PlugZap,
    title: 'settings.ai',
    hint: 'settings.nav.aiHint',
    group: 'ai',
    Body: AiSettings,
  },
  teacher: {
    icon: GraduationCap,
    title: 'settings.nav.teacher',
    hint: 'settings.nav.teacherHint',
    group: 'ai',
    Body: TeacherSettings,
  },
  local: {
    icon: Cpu,
    title: 'settings.nav.local',
    hint: 'settings.nav.localHint',
    group: 'ai',
    Body: GemmaSettings,
  },
  gpu: {
    icon: Gpu,
    title: 'settings.nav.gpu',
    hint: 'settings.nav.gpuHint',
    group: 'ai',
    Body: GemmaGpuSettings,
  },
  knowledge: {
    icon: BookOpen,
    title: 'settings.nav.knowledge',
    hint: 'settings.nav.knowledgeHint',
    group: 'ai',
    Body: KnowledgeSettings,
  },
  memory: {
    icon: History,
    title: 'settings.nav.memory',
    hint: 'settings.nav.memoryHint',
    group: 'ai',
    Body: MemorySettings,
  },
  voice: {
    icon: Volume2,
    title: 'settings.nav.voice',
    hint: 'settings.nav.voiceHint',
    group: 'ai',
    Body: VoiceSettings,
  },
  safety: {
    icon: ShieldCheck,
    title: 'safety.settings.title',
    hint: 'settings.nav.safetyHint',
    group: 'privacy',
    Body: SafetySettings,
  },
  shortcuts: {
    icon: Keyboard,
    title: 'settings.shortcuts',
    hint: 'settings.nav.shortcutsHint',
    group: 'general',
    Body: ShortcutSettings,
  },
};

const GROUPS: { id: SectionMeta['group']; title: MessageKey }[] = [
  { id: 'general', title: 'settings.nav.groupGeneral' },
  { id: 'ai', title: 'settings.nav.groupAi' },
  { id: 'privacy', title: 'settings.nav.groupPrivacy' },
];

const ORDER: readonly SettingsSection[] = GROUPS.flatMap((g) =>
  SETTINGS_SECTIONS.filter((id) => SECTIONS[id].group === g.id),
);

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Settings: a list of small pages on the left (Giao diện, Kết nối AI, AI local, GPU cho Gemma,
 * Trí nhớ hội thoại, Giọng nói…), one page shown on the right, each made of small cards.
 * A page stays mounted once visited, so a Gemma download or a typed key survives a page switch.
 */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const section = useWorkspaceStore((s) => s.settingsSection);
  const setSection = useWorkspaceStore((s) => s.setSettingsSection);
  const [visited, setVisited] = useState<ReadonlySet<SettingsSection>>(() => new Set([section]));
  const tabs = useRef(new Map<SettingsSection, HTMLButtonElement>());
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Derived during render (React's "adjust state when a prop changes" pattern).
  if (!visited.has(section)) setVisited(new Set([...visited, section]));

  useEffect(() => {
    if (panel.current) panel.current.scrollTop = 0;
    // On narrow windows the page list is a scrolling row: keep the chosen page in view.
    const tab = tabs.current.get(section);
    if (tab?.scrollIntoView) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [section]);

  const onNavKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const i = ORDER.indexOf(section);
    const next =
      event.key === 'Home'
        ? ORDER[0]
        : event.key === 'End'
          ? ORDER[ORDER.length - 1]
          : ORDER[(i + (event.key === 'ArrowDown' ? 1 : ORDER.length - 1)) % ORDER.length];
    if (!next) return;
    setSection(next);
    tabs.current.get(next)?.focus();
  };

  return (
    <dialog
      ref={ref}
      className="dialog settings-dialog"
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(e) => {
        // Click on the backdrop closes the dialog.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="dialog__header">
        <h2 id="settings-title">{t('settings.title')}</h2>
        <IconButton icon={X} label={t('settings.close')} onClick={onClose} tooltipSide="left" />
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('settings.nav.label')}>
          <div role="tablist" aria-orientation="vertical" onKeyDown={onNavKey}>
            {GROUPS.map((group) => (
              <div key={group.id} className="settings-nav__group" role="presentation">
                <p className="settings-nav__group-title" role="presentation">
                  {t(group.title)}
                </p>
                {ORDER.filter((id) => SECTIONS[id].group === group.id).map((id) => {
                  const meta = SECTIONS[id];
                  const Icon = meta.icon;
                  const selected = id === section;
                  return (
                    <button
                      key={id}
                      ref={(el) => {
                        if (el) tabs.current.set(id, el);
                        else tabs.current.delete(id);
                      }}
                      type="button"
                      role="tab"
                      id={`settings-tab-${id}`}
                      aria-selected={selected}
                      aria-controls={`settings-${id}`}
                      tabIndex={selected ? 0 : -1}
                      className="settings-nav__item"
                      onClick={() => {
                        setSection(id);
                      }}
                    >
                      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                      <span>{t(meta.title)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className="settings-panels" ref={panel}>
          {ORDER.filter((id) => visited.has(id) || id === section).map((id) => {
            const meta = SECTIONS[id];
            const Body = meta.Body;
            return (
              <section
                key={id}
                id={`settings-${id}`}
                role="tabpanel"
                aria-labelledby={`settings-tab-${id}`}
                className="settings-panel"
                hidden={id !== section}
              >
                <header className="settings-panel__header">
                  <h3>{t(meta.title)}</h3>
                  <p>{t(meta.hint)}</p>
                </header>
                <Body />
              </section>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}
