import { CircleCheck, LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useAiStore } from '@/ai/aiStore';
import { explainSolution, type Explanation } from '@/ai/explain';
import { getTransport } from '@/ai/transport';
import { toAiError } from '@/ai/types';
import type { PhysicsScene, Solution } from '@/physics/types';
import { resolveAi } from './analyze';
import './ai.css';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; result: Explanation }
  | { kind: 'error'; message: string };

/**
 * "AI diễn giải" (§2.1 b): the AI explains, in words, numbers the engine computed. The
 * reply is checked and hidden when it contains a number the engine did not produce.
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

  if (provider === 'off') return null;

  const run = async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ kind: 'loading' });
    try {
      const ai = await resolveAi();
      const result = await explainSolution(L(scene.title), problemText, solution, {
        transport: getTransport(),
        ...ai,
        signal: ctrl.signal,
      });
      if (!ctrl.signal.aborted) setState({ kind: 'done', result });
    } catch (e) {
      if (!ctrl.signal.aborted)
        setState({ kind: 'error', message: toAiError(e).message || toAiError(e).code });
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
      {state.kind === 'done' && state.result.verified && (
        <section className="explain" aria-label={t('solution.explainTitle')}>
          <p className="explain__head">
            <Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />
            {t('solution.explainTitle')}
          </p>
          <p className="explain__text">{state.result.text}</p>
          <p className="explain__note">
            <CircleCheck size={12} strokeWidth={2} aria-hidden="true" /> {t('solution.explainNote')}
          </p>
        </section>
      )}
      {state.kind === 'done' && !state.result.verified && (
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
