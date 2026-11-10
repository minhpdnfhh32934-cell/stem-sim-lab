import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { ConfidenceBadge } from '@/ui/Badges';

/**
 * The Science Card's summary pinned at the top of the tray (docs/BENCH_DESIGN.md §9.4): the
 * confidence, the model's name and its validity, "Xem thẻ" for the whole card (the notebook's
 * "Thẻ khoa học"). After an intervention it says so and offers the reset back to the exact run.
 */
export function ScienceSummary() {
  const t = useT();
  const L = useLocalized();
  const card = useWorkspaceStore((s) => s.scienceCard);
  const hasScene = useSimStore((s) => s.scene !== null);
  if (!card) return null;
  return (
    <section
      className="science-card science-card--summary"
      aria-label={t('inspector.scienceCard')}
      data-intervened={card.userIntervened || undefined}
    >
      <div className="science-card__summary-head">
        <ConfidenceBadge level={card.confidence} />
        <strong className="science-card__summary-title">{L(card.title)}</strong>
      </div>
      {card.validity && <p className="science-card__summary-validity">{L(card.validity)}</p>}
      <button
        type="button"
        className="btn btn--small science-card__summary-open"
        onClick={() => {
          const layout = useLayoutStore.getState();
          layout.setNotebookTab(useWorkspaceStore.getState().subject, 'science');
          layout.setNotebookOpen(true);
        }}
      >
        {t('bench.viewCard')}
      </button>
      {card.userIntervened && (
        <div className="science-card__intervened" role="status">
          <span>{t('science.intervened')}</span>
          {hasScene && (
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                sim.reset();
              }}
            >
              {t('bench.resetExact')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
