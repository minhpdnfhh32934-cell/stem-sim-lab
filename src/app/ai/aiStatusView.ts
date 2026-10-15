import {
  CircleAlert,
  Cloud,
  CloudOff,
  Cpu,
  KeyRound,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { SettingsSection } from '@/app/workspaceStore';
import { DEFAULT_MODELS, useAiStore } from '@/ai/aiStore';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useAnalysisEngine } from './engineChoice';
import { runtimeName } from './localRuntime';

export const PROVIDER_NAME = { gemini: 'Gemini', claude: 'Claude', groq: 'Groq' } as const;

interface AiStatusView {
  /** `local`: the AI chosen on this computer answers (Gemma or a runtime such as Ollama). */
  kind: 'offline' | 'cloud' | 'local' | 'warn';
  label: string;
  hint: string;
  Icon: LucideIcon;
  /** The Settings page that belongs to this state (null: the page Settings last showed). */
  section: SettingsSection | null;
}

/** "127.0.0.1:11434" of an address. */
const hostPort = (base: string) => base.replace(/^http:\/\//, '');

/**
 * Plain-language state of the AI that reads problems and answers ("Đã kết nối Gemini" / "AI trên
 * máy: Ollama" / "Chưa kết nối AI" / …). It follows the engine the learner chose: with the AI on
 * this computer nothing claims the problem goes online, and no API key is asked for.
 */
export function useAiStatusView(): AiStatusView {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const ai = useAiStore(
    useShallow((s) => ({ provider: s.provider, status: s.status, models: s.models })),
  );
  const engine = useAnalysisEngine();
  const selected = useLocalAiStore((s) => s.selected);
  const gemmaModel = useChatStore((s) => s.gemmaModel);
  // The safety gate closes every AI, on this computer too (the gates live in Rust).
  if (ai.status === 'notAllowed') {
    return {
      kind: 'warn',
      label: t('ai.notAllowed'),
      hint: t('ai.notAllowedHint'),
      Icon: ShieldAlert,
      section: null,
    };
  }
  if (engine === 'local' && selected) {
    return {
      kind: 'local',
      label: t('ai.local', { name: runtimeName(locale, selected.kind) }),
      hint: t('ai.localHint', { label: selected.label, address: hostPort(selected.baseUrl) }),
      Icon: Cpu,
      section: 'runtimes',
    };
  }
  if (engine === 'local' || engine === 'local-missing') {
    return {
      kind: 'warn',
      label: t('ai.localMissing'),
      hint: t('ai.localMissingHint'),
      Icon: CircleAlert,
      section: 'runtimes',
    };
  }
  if (engine === 'gemma') {
    return {
      kind: 'local',
      label: t('ai.gemma'),
      hint: t('ai.gemmaHint', { model: gemmaModel }),
      Icon: Cpu,
      section: 'local',
    };
  }
  if (engine === 'gemma-missing') {
    return {
      kind: 'warn',
      label: t('ai.gemmaMissing'),
      hint: t('ai.gemmaMissingHint'),
      Icon: CircleAlert,
      section: 'local',
    };
  }
  if (ai.provider === 'off') {
    return {
      kind: 'offline',
      label: t('ai.off'),
      hint: t('ai.offHint'),
      Icon: CloudOff,
      section: null,
    };
  }
  const provider = PROVIDER_NAME[ai.provider];
  switch (ai.status) {
    case 'noKey':
    case 'badKey':
      return {
        kind: 'warn',
        label: t('ai.noKey'),
        hint: t(ai.status === 'noKey' ? 'ai.noKeyHint' : 'ai.badKeyHint', { provider }),
        Icon: KeyRound,
        section: null,
      };
    case 'quota':
    case 'badModel':
    case 'error':
      return {
        kind: 'warn',
        label: t('ai.problem'),
        hint: t(`ai.${ai.status}Hint`, { provider }),
        Icon: CircleAlert,
        section: null,
      };
    case 'ok':
      return {
        kind: 'cloud',
        label: t('ai.cloud', { provider }),
        hint: t('ai.cloudHint', {
          provider,
          model: ai.models[ai.provider] || DEFAULT_MODELS[ai.provider],
        }),
        Icon: Cloud,
        section: null,
      };
    default:
      return {
        kind: 'offline',
        label: t('ai.offline'),
        hint: t('ai.offHint'),
        Icon: CloudOff,
        section: null,
      };
  }
}
