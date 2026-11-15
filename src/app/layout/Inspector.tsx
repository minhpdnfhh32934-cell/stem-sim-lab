import { memo, useContext } from 'react';
import { BenchContext } from '@/app/bench/shellMode';
import { ToolSwitches } from '@/app/bench/ToolSwitches';
import { BadgeInfo, MousePointerClick, SlidersHorizontal } from 'lucide-react';
import { useT } from '@/app/i18n';
import { CONFIDENCE_LEVELS } from '@/science-card/types';
import { ConfidenceBadge, ReviewBadge } from '@/ui/Badges';
import { EmptyState } from '@/ui/EmptyState';
import { Section } from '@/ui/Section';
import { ObjectPanel } from '@/app/sim/ObjectPanel';
import { ParamsPanel } from '@/app/sim/ParamsPanel';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useLocalized } from '@/app/i18n/localized';
import { useModuleStore } from '@/modules/moduleStore';
import { ScienceCard } from '@/science-card/ScienceCard';
import { ModeSwitch } from '@/app/learner/ModeSwitch';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useActiveTopic } from '@/app/topics';
import { TopicLessons } from '@/studio/TopicLessons';

/** Right-hand panel: selected object, parameters, and the Science Card. */
export const Inspector = memo(function Inspector() {
  const t = useT();
  return (
    <aside
      className="panel inspector"
      aria-label={t('inspector.regionLabel')}
      data-tour="inspector"
    >
      <header className="panel__header">
        <h2 className="panel__title">{t('inspector.title')}</h2>
        <ModeSwitch compact />
      </header>

      <div className="panel__scroll">
        <InspectorBody />
      </div>
    </aside>
  );
});

/** The inspector's sections (lessons, object, parameters, Science Card); the bench tray shows them too. */
export function InspectorBody() {
  const t = useT();
  const card = useWorkspaceStore((s) => s.scienceCard);
  const hasScene = useSimStore((s) => s.scene !== null);
  const mod = useModuleStore((s) => s.active);
  const L = useLocalized();
  const ModulePanel = mod?.view.Panel;
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const topicId = useActiveTopic();
  // The bench pins the card's summary above this list and shows the whole card in its notebook.
  const bench = useContext(BenchContext);

  return (
    <>
      <TopicLessons topicId={topicId} />
      {mod ? (
        <Section title={L(mod.view.title)} keepCase>
          {ModulePanel ? (
            <ModulePanel />
          ) : (
            <EmptyState icon={SlidersHorizontal} compact>
              {t('inspector.noParams')}
            </EmptyState>
          )}
        </Section>
      ) : (
        <>
          {advanced && (
            <Section title={t('inspector.objectSection')}>
              {hasScene ? (
                <ObjectPanel />
              ) : (
                <EmptyState icon={MousePointerClick} compact>
                  {t('inspector.noSelection')}
                </EmptyState>
              )}
            </Section>
          )}

          <Section title={t('inspector.paramsSection')}>
            {hasScene ? (
              <ParamsPanel />
            ) : (
              <EmptyState icon={SlidersHorizontal} compact>
                {t('inspector.noParams')}
              </EmptyState>
            )}
          </Section>
          {bench && hasScene && (
            <Section title={t('bench.toolsSection')}>
              <ToolSwitches />
            </Section>
          )}
        </>
      )}

      {!bench && (
        <Section
          title={t('inspector.scienceCard')}
          trailing={<BadgeInfo size={15} strokeWidth={1.75} className="muted" aria-hidden="true" />}
        >
          {card ? (
            <ScienceCard card={card} collapsible={!advanced} />
          ) : (
            <>
              <p className="science-intro">{t('inspector.scienceCardIntro')}</p>
              <ul className="confidence-legend">
                {CONFIDENCE_LEVELS.map((level) => (
                  <li key={level}>
                    <ConfidenceBadge level={level} />
                    <span>{t(`confidence.${level}Desc`)}</span>
                  </li>
                ))}
                <li>
                  <ReviewBadge status="pending" />
                </li>
              </ul>
            </>
          )}
        </Section>
      )}
    </>
  );
}
