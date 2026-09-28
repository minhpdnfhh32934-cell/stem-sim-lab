import { AlertTriangle, CheckCircle2, Info, ListOrdered } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { fmtQty } from '@/physics/common/tex';
import { Equation } from '@/science-card/Equation';
import { EmptyState } from '@/ui/EmptyState';
import { useSimStore } from './simStore';

/**
 * Engine-computed answers with their numerical cross-checks, and the step-by-step
 * derivation with the actual numbers substituted (MASTER_PROMPT §6.1 "Lời giải").
 */
export function SolutionPanel() {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { scene, params, validation, intervened } = useSimStore(
    useShallow((s) => ({
      scene: s.scene,
      params: s.params,
      validation: s.validation,
      intervened: s.intervened,
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
          <table className="solution__answers">
            <tbody>
              {solution.answers.map((a) => {
                const dev =
                  a.check === undefined
                    ? null
                    : Math.abs(a.value - a.check) / Math.max(Math.abs(a.value), 1e-12);
                return (
                  <tr key={a.id}>
                    <th scope="row">{L(a.label)}</th>
                    <td className="mono solution__value">{fmtQty(locale, a.value, a.unit, 4)}</td>
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
        </section>
        <section>
          <h3 className="solution__heading">{t('solution.steps')}</h3>
          <ol className="solution__steps">
            {solution.steps.map((s, i) => (
              <li key={i}>
                <p>{L(s.text)}</p>
                {s.tex && <Equation tex={s.tex} />}
              </li>
            ))}
          </ol>
          {solution.notes?.map((n) => (
            <p key={n.vi} className="muted small">
              {L(n)}
            </p>
          ))}
        </section>
      </div>
    </div>
  );
}
