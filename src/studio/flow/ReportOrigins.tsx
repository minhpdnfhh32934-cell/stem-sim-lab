import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { fmtQty } from '@/physics/common/tex';
import type { StudioScenario } from '../scenario';
import { engineEvidence, learnerText, predictionLabel, type StudioSession } from '../session';

type Origin = 'engine' | 'learner' | 'ai';

function OriginChip({ origin }: { origin: Origin }) {
  const t = useT();
  return (
    <span className="origin-chip" data-origin={origin}>
      {t(`studio.origin.${origin}`)}
    </span>
  );
}

/**
 * "Báo cáo" on the bench (docs/BENCH_DESIGN.md §9.7, §11 "three inks"): Dự đoán / Số đo / Giải
 * thích / Kết luận, every item with its origin chip ("SimLab tính" / "Bạn ghi" / "AI hỗ trợ"),
 * read from the session as recorded. The Markdown report below it is unchanged.
 */
export function ReportOrigins({ session }: { scenario: StudioScenario; session: StudioSession }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const engine = engineEvidence(session);
  const explanation = learnerText(session, 'explanation');
  const conclusion = learnerText(session, 'conclusion');
  const ai = session.evidence.filter((e) => e.kind === 'ai');
  return (
    <div className="report-origins">
      <section>
        <h4>{t('studio.origin.predict')}</h4>
        {session.prediction ? (
          <p>
            {predictionLabel(session.prediction, locale)} <OriginChip origin="learner" />
          </p>
        ) : (
          <p className="muted">{t('studio.origin.none')}</p>
        )}
      </section>
      <section>
        <h4>{t('studio.origin.measure')}</h4>
        {engine.length === 0 ? (
          <p className="muted">{t('studio.origin.none')}</p>
        ) : (
          engine.map((e) => (
            <div key={e.id}>
              <p>
                <strong>{L(e.title)}</strong> <OriginChip origin="engine" />
              </p>
              <ul>
                {e.quantities.map((q) => (
                  <li key={`${q.condition}-${q.id}`} className="mono">
                    {L(q.label)} ({q.condition}) = {fmtQty(locale, q.value, q.unit)}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      <section>
        <h4>{t('studio.origin.explain')}</h4>
        {explanation ? (
          <p className="report-origins__ink">
            {explanation} <OriginChip origin="learner" />
          </p>
        ) : (
          <p className="muted">{t('studio.origin.none')}</p>
        )}
      </section>
      <section>
        <h4>{t('studio.origin.conclude')}</h4>
        {conclusion ? (
          <p className="report-origins__ink">
            {conclusion} <OriginChip origin="learner" />
          </p>
        ) : (
          <p className="muted">{t('studio.origin.none')}</p>
        )}
      </section>
      {/* AI text is shown only where it was written, with its AI label and report button: here
          only how many notes there are (the report below lists them). */}
      {ai.length > 0 && (
        <section>
          <h4>{t('studio.origin.aiNotes')}</h4>
          <p>
            {t('studio.origin.aiCount', { n: ai.length })} <OriginChip origin="ai" />
          </p>
        </section>
      )}
    </div>
  );
}
