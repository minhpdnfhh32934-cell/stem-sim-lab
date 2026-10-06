import {
  AlertTriangle,
  DraftingCompass,
  Hand,
  Loader2,
  MousePointer2,
  MoveUpRight,
  Ruler,
  Scan,
  Spline,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { StageCanvas } from '@/app/sim/StageCanvas';
import { Stopwatch } from '@/app/sim/Stopwatch';
import { useSimStore } from '@/app/sim/simStore';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { useWorkspaceStore, type StageTool } from '@/app/workspaceStore';
import { useModuleStore } from '@/modules/moduleStore';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';

/** `basic`: shown in Basic mode too (drag, measure, vectors, camera — PROMPT_PHAN_2 A4.2). */
const MODES: { id: StageTool; icon: LucideIcon; basic: boolean }[] = [
  { id: 'select', icon: MousePointer2, basic: true },
  { id: 'drag', icon: Hand, basic: true },
  { id: 'ruler', icon: Ruler, basic: true },
  { id: 'protractor', icon: DraftingCompass, basic: false },
];

type Toggle = 'stopwatch' | 'vectors' | 'trail';
const TOGGLES: { id: Toggle; icon: LucideIcon; basic: boolean }[] = [
  { id: 'stopwatch', icon: Timer, basic: false },
  { id: 'vectors', icon: MoveUpRight, basic: true },
  { id: 'trail', icon: Spline, basic: false },
];

/**
 * Central simulation area: the canvas of the open scene, the floating tool bar and
 * status overlays (time, intervention, invalid parameters).
 */
export const Stage = memo(function Stage() {
  const t = useT();
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  // A tool switched on in Advanced stays visible, so it can be switched off again.
  const shown = (basic: boolean, on: boolean) => advanced || basic || on;
  const { subject, activeTool, setActiveTool, hasSimulation, simTime } = useWorkspaceStore(
    useShallow((s) => ({
      subject: s.subject,
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      hasSimulation: s.hasSimulation,
      simTime: s.simTime,
    })),
  );
  const sim = useSimStore(
    useShallow((s) => ({
      scene: s.scene,
      loading: s.loading,
      error: s.error,
      validation: s.validation,
      intervened: s.intervened,
      finished: s.finished,
      stopwatch: s.stopwatch,
      vectors: s.vectors,
      trail: s.trail,
      scrubTime: s.scrubTime,
    })),
  );
  const mod = useModuleStore(
    useShallow((s) => ({ active: s.active, loading: s.loading, error: s.error })),
  );
  const SubjectIcon = SUBJECT_ICON[subject];
  const disabled = !hasSimulation;

  if (mod.active || mod.loading || mod.error) {
    const View = mod.active?.view.Stage;
    return (
      <section className="stage stage--module" aria-label={t('stage.regionLabel')}>
        {View && <View />}
        {mod.loading && (
          <div className="stage__empty">
            <Loader2 className="spin" size={28} strokeWidth={1.5} aria-label={t('stage.loading')} />
          </div>
        )}
        {mod.error && (
          <div className="stage__message" role="alert">
            <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
            <p>{`${t('stage.engineError')}: ${mod.error}`}</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="stage" aria-label={t('stage.regionLabel')}>
      {!sim.scene && <div className="stage__grid" aria-hidden="true" />}
      {sim.scene && <StageCanvas scene={sim.scene} />}

      <div className="stage__toolbar" role="toolbar" aria-label={t('stage.toolbarLabel')}>
        {MODES.filter((m) => shown(m.basic, activeTool === m.id)).map((m) => {
          const label = t(`stage.tools.${m.id}`);
          const off = disabled && m.id !== 'select';
          return (
            <IconButton
              key={m.id}
              icon={m.icon}
              label={off ? `${label} — ${t('stage.toolUnavailable')}` : label}
              tooltipSide="right"
              active={activeTool === m.id}
              disabled={off}
              onClick={() => {
                setActiveTool(m.id);
              }}
            />
          );
        })}
        <span className="stage__toolbar-sep" aria-hidden="true" />
        {TOGGLES.filter((tg) => shown(tg.basic, sim[tg.id])).map((tg) => {
          const label = t(`stage.tools.${tg.id}`);
          return (
            <IconButton
              key={tg.id}
              icon={tg.icon}
              label={disabled ? `${label} — ${t('stage.toolUnavailable')}` : label}
              tooltipSide="right"
              active={!disabled && sim[tg.id]}
              disabled={disabled}
              onClick={() => {
                useSimStore.setState((s) => ({ [tg.id]: !s[tg.id] }));
              }}
            />
          );
        })}
        <span className="stage__toolbar-sep" aria-hidden="true" />
        <IconButton
          icon={Scan}
          label={
            disabled
              ? `${t('stage.tools.fitView')} — ${t('stage.toolUnavailable')}`
              : t('stage.tools.fitView')
          }
          tooltipSide="right"
          disabled={disabled}
          onClick={() => {
            useSimStore.setState((s) => ({ fitRequest: s.fitRequest + 1 }));
          }}
        />
      </div>

      {sim.scene && (
        <div className="stage__hud" aria-live="polite">
          <span className="stage__hud-title">{Lz(sim.scene.title)}</span>
          <span className="mono">
            t ={' '}
            {formatNumber(locale, sim.scrubTime ?? simTime, {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}{' '}
            s
          </span>
          {sim.finished && <span className="stage__chip">{t('stage.finished')}</span>}
          {sim.scrubTime !== null && <span className="stage__chip">{t('stage.replay')}</span>}
          {sim.intervened && (
            <span className="stage__chip stage__chip--warn">{t('science.intervened')}</span>
          )}
        </div>
      )}

      {sim.stopwatch && sim.scene && <Stopwatch />}

      {sim.scene && sim.validation.length > 0 && (
        <div className="stage__message" role="alert">
          <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
          <div>
            {sim.validation.map((v) => (
              <p key={v.vi}>{Lz(v)}</p>
            ))}
          </div>
        </div>
      )}

      {sim.error && (
        <div className="stage__message" role="alert">
          <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
          <p>
            {sim.error === 'nonFinite'
              ? t('stage.nonFinite')
              : `${t('stage.engineError')}: ${sim.error}`}
          </p>
        </div>
      )}

      {sim.loading && (
        <div className="stage__empty">
          <Loader2 className="spin" size={28} strokeWidth={1.5} aria-label={t('stage.loading')} />
        </div>
      )}

      {!hasSimulation && !sim.loading && (
        <div className="stage__empty">
          <EmptyState icon={SubjectIcon} title={t('stage.emptyTitle')}>
            <p>{t('stage.emptyBody')}</p>
          </EmptyState>
        </div>
      )}
    </section>
  );
});
