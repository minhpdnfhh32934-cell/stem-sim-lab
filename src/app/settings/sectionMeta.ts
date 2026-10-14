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
  ScrollText,
  ShieldCheck,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import type { MessageKey } from '@/app/i18n';
import type { SettingsSection } from '@/app/workspaceStore';

/**
 * Title, hint, icon and group of each Settings page — light enough for the command palette
 * (Ctrl+K) to list the pages without loading their contents.
 */
export interface SectionMeta {
  icon: LucideIcon;
  title: MessageKey;
  hint: MessageKey;
  group: 'general' | 'ai' | 'privacy';
}

/** One page per section; the navigation lists them in this order, grouped. */
export const SECTIONS: Record<SettingsSection, SectionMeta> = {
  appearance: {
    icon: Palette,
    title: 'settings.nav.appearance',
    hint: 'settings.nav.appearanceHint',
    group: 'general',
  },
  simulation: {
    icon: Orbit,
    title: 'settings.nav.simulation',
    hint: 'settings.nav.simulationHint',
    group: 'general',
  },
  ai: {
    icon: PlugZap,
    title: 'settings.ai',
    hint: 'settings.nav.aiHint',
    group: 'ai',
  },
  teacher: {
    icon: GraduationCap,
    title: 'settings.nav.teacher',
    hint: 'settings.nav.teacherHint',
    group: 'ai',
  },
  local: {
    icon: Cpu,
    title: 'settings.nav.local',
    hint: 'settings.nav.localHint',
    group: 'ai',
  },
  gpu: {
    icon: Gpu,
    title: 'settings.nav.gpu',
    hint: 'settings.nav.gpuHint',
    group: 'ai',
  },
  knowledge: {
    icon: BookOpen,
    title: 'settings.nav.knowledge',
    hint: 'settings.nav.knowledgeHint',
    group: 'ai',
  },
  memory: {
    icon: History,
    title: 'settings.nav.memory',
    hint: 'settings.nav.memoryHint',
    group: 'ai',
  },
  voice: {
    icon: Volume2,
    title: 'settings.nav.voice',
    hint: 'settings.nav.voiceHint',
    group: 'ai',
  },
  safety: {
    icon: ShieldCheck,
    title: 'safety.settings.title',
    hint: 'settings.nav.safetyHint',
    group: 'privacy',
  },
  shortcuts: {
    icon: Keyboard,
    title: 'settings.shortcuts',
    hint: 'settings.nav.shortcutsHint',
    group: 'general',
  },
  versions: {
    icon: ScrollText,
    title: 'settings.nav.versions',
    hint: 'settings.nav.versionsHint',
    group: 'general',
  },
};
