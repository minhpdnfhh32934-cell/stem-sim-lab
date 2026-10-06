import { memo } from 'react';
import { BadgeInfo, MousePointerClick, SlidersHorizontal, X } from 'lucide-react';
import { useT } from '@/app/i18n';
import { CONFIDENCE_LEVELS } from '@/science-card/types';
import { ConfidenceBadge, ReviewBadge } from '@/ui/Badges';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Section } from '@/ui/Section';
import { ObjectPanel } from '@/app/sim/ObjectPanel';
import { ParamsPanel } from '@/app/sim/ParamsPanel';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useLocalized } from '@/app/i18n/localized';
import { useModuleStore } from '@/modules/moduleStore';
import { ScienceCard } from '@/science-card/ScienceCard';
import { useLayoutStore } from './layoutStore';
import { ModeSwitch } from '@/app/learner/ModeSwitch';
import { useSettingsStore } from '@/app/settings/settingsStore';

/** Right-hand panel: selected object, parameters, and the Science Card. */
export const Inspector = memo(function Inspector() {
  const t = useT();
  const toggle = useLayoutStore((s) => s.toggle);
  const card = useWorkspaceStore((s) => s.scienceCard);
  const hasScene = useSimStore((s) => s.scene !== null);
  const mod = useModuleStore((s) => s.active);
  const L = useLocalized();
  const ModulePanel = mod?.view.Panel;
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');

  return (
    <aside
      className="panel inspector"
      aria-label={t('inspector.regionLabel')}
      data-tour="inspector"
    >
      <header className="panel__header">
        <h2 className="panel__title">{t('inspector.title')}</h2>
        <ModeSwitch compact />
        <IconButton
          icon={X}
          size="sm"
          label={t('layout.toggleRight')}
          tooltipSide="left"
          onClick={() => {
            toggle('right');
          }}
        />
      </header>

      <div className="panel__scroll">
        {mod ? (
          <Section title={L(mod.view.title)}>
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
          </>
        )}

        <Section
          title={t('inspector.scienceCard')}
          trailing={<BadgeInfo size={15} strokeWidth={1.75} className="muted" aria-hidden="true" />}
        >
          {card ? (
            <ScienceCard card={card} />
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
      </div>
    </aside>
  );
});
