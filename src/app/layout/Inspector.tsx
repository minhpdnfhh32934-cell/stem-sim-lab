import { useContext } from 'react';
import { BenchContext } from '@/app/bench/shellMode';
import { ToolSwitches } from '@/app/bench/ToolSwitches';
import { MousePointerClick, SlidersHorizontal } from 'lucide-react';
import { useT } from '@/app/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { Section } from '@/ui/Section';
import { ObjectPanel } from '@/app/sim/ObjectPanel';
import { ParamsPanel } from '@/app/sim/ParamsPanel';
import { useSimStore } from '@/app/sim/simStore';
import { useLocalized } from '@/app/i18n/localized';
import { useModuleStore } from '@/modules/moduleStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useActiveTopic } from '@/app/topics';
import { TopicLessons } from '@/studio/TopicLessons';

/**
 * The bench tray's sections: lessons, object, parameters and tools. The Science Card is pinned
 * above them and shown whole in the notebook (the classic inspector and its legend went in B8).
 */
export function InspectorBody() {
  const t = useT();
  const hasScene = useSimStore((s) => s.scene !== null);
  const mod = useModuleStore((s) => s.active);
  const L = useLocalized();
  const ModulePanel = mod?.view.Panel;
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const topicId = useActiveTopic();
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
    </>
  );
}
