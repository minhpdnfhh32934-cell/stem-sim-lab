import { AlertTriangle, CheckCircle2, Eye, Info, Lightbulb, ListOrdered } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ExplainBox } from '@/app/ai/ExplainBox';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { fmtQty } from '@/physics/common/tex';
import type { PhysicsScene, Solution } from '@/physics/types';
import { Equation } from '@/science-card/Equation';
import { EmptyState } from '@/ui/EmptyState';
import { useSimStore } from './simStore';
import '@/learn/learn.css';

/**
 * Engine-computed answers with their numerical cross-checks, and the step-by-step
 * derivation with the actual numbers substituted (MASTER_PROMPT §6.1 "Lời giải").
 */
export function SolutionPanel() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const { scene, params, validation, problem } = useSimStore(
    useShallow((s) => ({
      scene: s.scene,
      params: s.params,
      validation: s.validation,
      problem: s.problem,
    })),
  );
  const solution = useMemo(() => {
    if (!scene || validation.length > 0) return null;
    try {
      return scene.solve(params, locale);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [scene, params, validation, locale]);

  if (!scene) {
    return (
      <EmptyState icon={ListOrdered} compact>
        {t('bottom.solutionEmpty')}
      </EmptyState>
    );
  }
  if (!solution) {
    return (
      <EmptyState icon={AlertTriangle} compact>
        {t('solution.invalid')}
      </EmptyState>
    );
  }
  // A new problem starts again from the first hint.
  return <SolutionBody key={problem?.text ?? ''} scene={scene} solution={solution} />;
}

/**
 * For a problem the learner typed in, the app helps responsibly (PROMPT_PHAN_2 A4.1): hints
 * first (Gợi ý 1 → Gợi ý 2 → … → Lời giải đầy đủ), with a button to see everything at once.
 * Topics opened from the library show the whole solution.
 */
function SolutionBody({ scene, solution }: { scene: PhysicsScene; solution: Solution }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { intervened, problem } = useSimStore(
    useShallow((s) => ({ intervened: s.intervened, problem: s.problem })),
  );
  const [shown, setShown] = useState(problem ? 0 : Infinity);
  const full = shown >= solution.steps.length;
  const showAll = () => {
    setShown(Infinity);
  };

  return (
    <div className="solution">
      <p className="solution__note">
        <Info size={14} strokeWidth={1.75} aria-hidden="true" />
        {t('solution.engineNote')}
      </p>
      {intervened && (
        <p className="solution__note solution__note--warn" role="note">
          <AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('solution.intervenedNote')}
        </p>
      )}
      <div className="solution__grid">
        <section>
          <h3 className="solution__heading">{t('solution.answers')}</h3>
          {full ? (
            <>
              <table className="solution__answers">
                <tbody>
                  {solution.answers.map((a) => {
                    const dev =
                      a.check === undefined
                        ? null
                        : Math.abs(a.value - a.check) / Math.max(Math.abs(a.value), 1e-12);
                    const asked = problem?.questions.includes(a.id) ?? false;
                    return (
                      <tr key={a.id} className={asked ? 'is-asked' : undefined}>
                        <th scope="row">
                          {L(a.label)}
                          {asked && <span className="asked-chip">{t('solution.asked')}</span>}
                        </th>
                        <td className="mono solution__value">
                          {fmtQty(locale, a.value, a.unit, 4)}
                        </td>
                        <td className="solution__check">
                          {dev !== null && (
                            <span data-tip={t('solution.check')}>
                              <CheckCircle2 size={13} strokeWidth={2} aria-hidden="true" />
                              {t('solution.agree', {
                                value:
                                  dev < 1e-15
                                    ? '0'
                                    : formatNumber(locale, dev, {
                                        maximumSignificantDigits: 1,
                                        notation: 'scientific',
                                      }),
                              })}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ExplainBox scene={scene} solution={solution} problemText={problem?.text ?? ''} />
            </>
          ) : (
            <div className="solution__hidden" role="note">
              <p>{t('solution.tryFirst')}</p>
              <button type="button" className="btn" onClick={showAll}>
                <Eye size={15} strokeWidth={1.75} aria-hidden="true" />
                {t('solution.showAll')}
              </button>
            </div>
          )}
        </section>
        <section>
          <h3 className="solution__heading">{t('solution.steps')}</h3>
          <ol className="solution__steps">
            {solution.steps.slice(0, shown).map((s, i) => (
              <li key={i}>
                <p>{L(s.text)}</p>
                {s.tex && <Equation tex={s.tex} />}
              </li>
            ))}
          </ol>
          {full ? (
            solution.notes?.map((n) => (
              <p key={n.vi} className="muted small">
                {L(n)}
              </p>
            ))
          ) : (
            <button
              type="button"
              className="btn btn--accent"
              onClick={() => {
                setShown(shown + 1);
              }}
            >
              <Lightbulb size={15} strokeWidth={1.75} aria-hidden="true" />
              {shown + 1 < solution.steps.length
                ? t('solution.nextHint', { n: shown + 1 })
                : t('solution.fullSolution')}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
