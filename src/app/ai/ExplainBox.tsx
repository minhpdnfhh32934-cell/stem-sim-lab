import { CircleCheck, LoaderCircle, Settings2, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore, type SettingsSection } from '@/app/workspaceStore';
import { useAiStore } from '@/ai/aiStore';
import { isLocalMessage } from '@/ai/errorKind';
import { explainSolution, type Explanation } from '@/ai/explain';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { localTransport } from '@/ai/local/localTransport';
import { toAiError } from '@/ai/types';
import type { PhysicsScene, Solution } from '@/physics/types';
import { AiContentBar } from '@/safety/AiContentBar';
import { CrisisCard } from '@/safety/CrisisCard';
import type { PersonalKind } from '@/safety/moderation';
import { logIncident, useSafetyStore } from '@/safety/safetyStore';
import { resolveAiForAnalysis, safetyBlock, type SafetyBlockCode } from './analyze';
import { useAnalysisEngine } from './engineChoice';
import { localFailure, localFailureText } from './localRuntime';
import './ai.css';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; result: Explanation }
  /**
   * The problem text did not pass the input check (it may come from an opened .stemsim file or
   * from history, not only from a checked "Phân tích đề"): nothing was sent.
   */
  | { kind: 'blocked'; code: SafetyBlockCode; found: string }
  /** `section`: the Settings page that helps (null: none does). */
  | { kind: 'error'; message: string; section: SettingsSection | null };

/**
 * "AI diễn giải" (§2.1 b): the AI explains, in words, numbers the engine computed. The
 * reply is checked and hidden when it contains a number the engine did not produce. It uses the
 * same AI as AI Teacher and "Phân tích đề" (`resolveAiForAnalysis`): a chosen Gemma or runtime on
 * this computer explains there, and never hands the request to the cloud.
 */
export function ExplainBox({
  scene,
  solution,
  problemText,
}: {
  scene: PhysicsScene;
  solution: Solution;
  problemText: string;
}) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const provider = useAiStore((s) => s.provider);
  const engine = useAnalysisEngine();
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);
  const aiAllowed = useSafetyStore((s) => s.status?.aiAllowed ?? false);
  // The explanation belongs to one solution: a new solution shows the button again.
  const [entry, setEntry] = useState<{ solution: Solution; state: State } | null>(null);
  const state: State = entry?.solution === solution ? entry.state : { kind: 'idle' };
  const setState = (next: State) => {
    setEntry({ solution, state: next });
  };
  const abort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [solution],
  );

  // The online AI off (and no AI on this computer chosen), or the safety gates closed (age /
  // consent): no AI button at all.
  if ((provider === 'off' && engine === 'cloud') || !aiAllowed) return null;

  const run = async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ kind: 'loading' });
    // The runtime on this computer was asked: whatever fails is explained as its failure.
    let onComputer = false;
    try {
      // Same input check as "Phân tích đề" (logged as kind + time only); a block sends nothing.
      const blocked = await safetyBlock(problemText);
      if (blocked) {
        if (!ctrl.signal.aborted) {
          setState({ kind: 'blocked', code: blocked.code, found: blocked.detail });
        }
        return;
      }
      const ai = await resolveAiForAnalysis();
      onComputer = ai.transport === localTransport;
      const result = await explainSolution(L(scene.title), problemText, solution, {
        transport: ai.transport,
        provider: ai.provider,
        model: ai.model,
        timeoutSecs: ai.timeoutSecs,
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      if (!result.safe) logIncident('outputUnsafe');
      setState({
        kind: 'done',
        result: ai.modelLabel ? { ...result, model: ai.modelLabel(result.model) } : result,
      });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const err = toAiError(e);
      if (err.code === 'unavailable' && err.message === 'gemma') {
        // The learner chose Gemma but its model is not downloaded: nothing was sent anywhere.
        setState({ kind: 'error', message: t('chat.gemmaMissingNotice'), section: 'local' });
      } else if (err.code === 'unavailable' && err.message === 'off') {
        setState({ kind: 'error', message: t('chat.errors.cloudOff'), section: 'ai' });
      } else if (onComputer || isLocalMessage(err.message)) {
        // A runtime on this computer failed, or wrote no explanation (only its reasoning, or
        // nothing before its limit): its study-partner sentence, never a raw code. Nothing went
        // online.
        const kind = useLocalAiStore.getState().selected?.kind ?? 'openAiCompatible';
        const failure = localFailure(err, 'explain');
        setState({
          kind: 'error',
          message: localFailureText(locale, failure, kind),
          section: failure.section,
        });
      } else {
        setState({ kind: 'error', message: err.message || err.code, section: null });
      }
    }
  };

  return (
    <div className="explain-wrap">
      <button
        type="button"
        className="btn"
        disabled={state.kind === 'loading'}
        onClick={() => {
          void run();
        }}
      >
        {state.kind === 'loading' ? (
          <LoaderCircle className="spin" size={14} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />
        )}{' '}
        {state.kind === 'loading' ? t('solution.explaining') : t('solution.explain')}
      </button>
      {state.kind === 'done' && !state.result.safe && (
        <p className="explain explain--hidden" role="alert">
          <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />{' '}
          {t('solution.explainUnsafe')}
        </p>
      )}
      {state.kind === 'done' && state.result.safe && state.result.verified && (
        <section className="explain" aria-label={t('solution.explainTitle')}>
          <p className="explain__head">
            <Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />
            {t('solution.explainTitle')}
          </p>
          <AiContentBar model={state.result.model} fallback={state.result.fallback} />
          <p className="explain__text">{state.result.text}</p>
          <p className="explain__note">
            <CircleCheck size={12} strokeWidth={2} aria-hidden="true" /> {t('solution.explainNote')}
          </p>
        </section>
      )}
      {state.kind === 'done' && state.result.safe && !state.result.verified && (
        <p className="explain explain--hidden" role="alert">
          <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />{' '}
          {t('solution.explainHidden', {
            numbers: state.result.unknownNumbers
              .slice(0, 5)
              .map((n) => formatNumber(locale, n, { maximumSignificantDigits: 6 }))
              .join('; '),
          })}
        </p>
      )}
      {state.kind === 'blocked' && (
        <div className="explain explain--hidden" role="alert">
          <p className="explain__error">
            {state.code === 'personalData'
              ? t('analyze.error.personalData', {
                  detail: state.found
                    .split(',')
                    .filter((k): k is PersonalKind =>
                      ['phone', 'email', 'idNumber', 'nameOrAddress'].includes(k),
                    )
                    .map((k) => t(`analyze.personal.${k}`))
                    .join(', '),
                })
              : t(`analyze.error.${state.code}`)}
          </p>
          {state.code === 'crisis' && <CrisisCard />}
        </div>
      )}
      {state.kind === 'error' && (
        <div className="explain explain--hidden" role="alert">
          <p className="explain__error">{t('solution.explainError', { message: state.message })}</p>
          {state.section && (
            <button
              type="button"
              className="btn explain__settings"
              onClick={() => {
                if (state.section) openSettingsAt(state.section);
              }}
            >
              <Settings2 size={14} strokeWidth={1.75} aria-hidden="true" /> {t('chat.settings')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
