import { CircleCheck, LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useAiStore } from '@/ai/aiStore';
import { isLocalMessage } from '@/ai/errorKind';
import { explainSolution, type Explanation } from '@/ai/explain';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { toAiError } from '@/ai/types';
import type { PhysicsScene, Solution } from '@/physics/types';
import { AiContentBar } from '@/safety/AiContentBar';
import { logIncident, useSafetyStore } from '@/safety/safetyStore';
import { resolveAiForAnalysis } from './analyze';
import { useAnalysisEngine } from './engineChoice';
import { localFailure, localFailureText } from './localRuntime';
import './ai.css';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; result: Explanation }
  | { kind: 'error'; message: string };

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
    try {
      const ai = await resolveAiForAnalysis();
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
      // A runtime on this computer failed: its study-partner sentence (nothing went online).
      const kind = useLocalAiStore.getState().selected?.kind ?? 'openAiCompatible';
      setState({
        kind: 'error',
        message: isLocalMessage(err.message)
          ? localFailureText(locale, localFailure(err), kind)
          : err.message || err.code,
      });
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
      {state.kind === 'error' && (
        <p className="explain explain--hidden" role="alert">
          {t('solution.explainError', { message: state.message })}
        </p>
      )}
    </div>
  );
}
