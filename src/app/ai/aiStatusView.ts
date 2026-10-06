import { CircleAlert, Cloud, CloudOff, KeyRound, ShieldAlert, type LucideIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { DEFAULT_MODELS, useAiStore } from '@/ai/aiStore';

export const PROVIDER_NAME = { gemini: 'Gemini', claude: 'Claude', groq: 'Groq' } as const;

interface AiStatusView {
  kind: 'offline' | 'cloud' | 'warn';
  label: string;
  hint: string;
  Icon: LucideIcon;
}

/** Plain-language state of the AI connection ("Đã kết nối Gemini" / "Chưa kết nối AI" / …). */
export function useAiStatusView(): AiStatusView {
  const t = useT();
  const ai = useAiStore(
    useShallow((s) => ({ provider: s.provider, status: s.status, models: s.models })),
  );
  if (ai.provider === 'off') {
    return { kind: 'offline', label: t('ai.off'), hint: t('ai.offHint'), Icon: CloudOff };
  }
  const provider = PROVIDER_NAME[ai.provider];
  switch (ai.status) {
    case 'notAllowed':
      return {
        kind: 'warn',
        label: t('ai.notAllowed'),
        hint: t('ai.notAllowedHint'),
        Icon: ShieldAlert,
      };
    case 'noKey':
    case 'badKey':
      return {
        kind: 'warn',
        label: t('ai.noKey'),
        hint: t(ai.status === 'noKey' ? 'ai.noKeyHint' : 'ai.badKeyHint', { provider }),
        Icon: KeyRound,
      };
    case 'quota':
    case 'badModel':
    case 'error':
      return {
        kind: 'warn',
        label: t('ai.problem'),
        hint: t(`ai.${ai.status}Hint`, { provider }),
        Icon: CircleAlert,
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
      };
    default:
      return { kind: 'offline', label: t('ai.offline'), hint: t('ai.offHint'), Icon: CloudOff };
  }
}
