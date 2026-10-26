import {
  ArrowLeft,
  CircleHelp,
  Dna,
  FlaskConical,
  Hammer,
  Orbit,
  PencilLine,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { openLab } from '@/app/topics';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { EmptyState } from '@/ui/EmptyState';
import { Tabs } from '@/ui/Tabs';
import { AuthoringPane } from './authoring/AuthoringPane';
import { useAuthoredFor } from './authoring/authoringStore';
import { biologyPlugin } from './biology/plugin';
import { chemistryPlugin } from './chemistry/plugin';
import { PoeFlow } from './flow/PoeFlow';
import type { SubjectPlugin } from './flow/types';
import { physicsPlugin } from './physics/plugin';
import { ReviewNote } from './ReviewNote';
import type { StudioScenario, StudioSubject } from './scenario';
import { scenariosFor } from './scenarios';
import { STUDIO_TABS, type StudioTab } from './session';
import { StudioGuide } from './StudioGuide';
import { useStudioStore } from './studioStore';
import { TeacherNote } from './TeacherNote';
import './studio.css';

/** Subjects with a working studio slice; the others say so instead of showing placeholders. */
const PLUGINS: Partial<Record<StudioSubject, SubjectPlugin>> = {
  physics: physicsPlugin,
  chemistry: chemistryPlugin,
  biology: biologyPlugin,
};

const TAB_ICON: Record<StudioTab, LucideIcon> = {
  chemistry: FlaskConical,
  biology: Dna,
  physics: Orbit,
  authoring: PencilLine,
};

function Preparing({ tab }: { tab: StudioSubject }) {
  const t = useT();
  return (
    <EmptyState icon={Hammer} title={t('studio.preparing.title')}>
      <p>{t(`studio.preparing.${tab}`)}</p>
      <button type="button" className="btn btn--ghost" onClick={openLab}>
        {t('studio.preparing.openLab')}
      </button>
    </EmptyState>
  );
}

function ScenarioHeader({ scenario }: { scenario: StudioScenario }) {
  const t = useT();
  const L = useLocalized();
  return (
    <header className="studio-scenario">
      <h2>{L(scenario.title)}</h2>
      <p className="muted small">
        {t(`levels.${scenario.level}`)} · {t(`studio.difficulty.${scenario.difficulty}`)}
      </p>
      <ul className="studio-objectives">
        {scenario.objectives.map((o) => (
          <li key={o.vi}>{L(o)}</li>
        ))}
      </ul>
      <TeacherNote scenario={scenario} />
      <ReviewNote status={scenario.review_status} />
    </header>
  );
}

function SubjectPane({ subject }: { subject: StudioSubject }) {
  const t = useT();
  const L = useLocalized();
  const authored = useAuthoredFor(subject);
  const scenarios = useMemo(() => [...scenariosFor(subject), ...authored], [subject, authored]);
  const plugin = PLUGINS[subject];
  const picked = useStudioStore((s) => s.picked[subject]);
  const openScenario = useStudioStore((s) => s.openScenario);
  if (!plugin || scenarios.length === 0) return <Preparing tab={subject} />;
  const scenario = scenarios.find((s) => s.id === picked) ?? scenarios[0];
  if (!scenario) return <Preparing tab={subject} />;
  return (
    <div className="studio-pane">
      {scenarios.length > 1 && (
        <div className="studio-picker" role="group" aria-label={t('studio.pick')}>
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              className="btn btn--ghost"
              aria-pressed={s.id === scenario.id}
              onClick={() => {
                openScenario(subject, s.id);
              }}
            >
              {L(s.title)}
            </button>
          ))}
        </div>
      )}
      <ScenarioHeader scenario={scenario} />
      <PoeFlow key={scenario.id} scenario={scenario} plugin={plugin} />
    </div>
  );
}

/**
 * Science Studio: guided lessons per subject on top of the existing engines. It is shown inside
 * the lab, next to the topic library (user decision 2026-10-20).
 */
export default function StudioScreen() {
  const t = useT();
  const tab = useStudioStore((s) => s.tab);
  const setTab = useStudioStore((s) => s.setTab);
  const openGuide = useStudioStore((s) => s.openGuide);
  // The library beside the lesson lists the same subject as the studio tab.
  useEffect(() => {
    if (tab !== 'authoring') useWorkspaceStore.getState().setSubject(tab);
  }, [tab]);
  const items = STUDIO_TABS.map((id) => ({
    id,
    label: t(`studio.tabs.${id}`),
    icon: TAB_ICON[id],
  }));
  return (
    <section className="studio" aria-labelledby="studio-title">
      <div className="studio__head">
        <div className="studio__head-copy">
          <h1 id="studio-title">{t('studio.title')}</h1>
          <p className="muted">{t('studio.subtitle')}</p>
        </div>
        <div className="studio__head-actions">
          <button
            type="button"
            className="btn btn--ghost"
            data-tip={t('studio.guide.openHint')}
            onClick={openGuide}
          >
            <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
            {t('studio.guide.open')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={openLab}>
            <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
            {t('studio.backToLab')}
          </button>
        </div>
      </div>
      <div data-tour="studio-tabs">
        <Tabs items={items} value={tab} onChange={setTab} label={t('studio.tabsLabel')} />
      </div>
      <div className="studio__panel" role="tabpanel" aria-label={t(`studio.tabs.${tab}`)}>
        {tab === 'authoring' ? <AuthoringPane /> : <SubjectPane key={tab} subject={tab} />}
      </div>
      <StudioGuide />
    </section>
  );
}
