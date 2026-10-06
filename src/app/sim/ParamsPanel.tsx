import { ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { basicSplit } from './basicParams';
import '@/app/learner/learner.css';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { fromSI, toSI, unitLabel } from '@/core/units';
import type { ParamDef } from '@/physics/types';
import { Equation } from '@/science-card/Equation';
import { sim } from './runtime';
import { useSimStore } from './simStore';

/** Parameter sliders + numeric inputs, with the origin of each value (§2.1). */
export function ParamsPanel() {
  const t = useT();
  const { scene, params, sources } = useSimStore(
    useShallow((s) => ({ scene: s.scene, params: s.params, sources: s.sources })),
  );
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const [showAll, setShowAll] = useState(false);
  if (!scene) return null;
  const visible = scene.params.filter((d) => !d.when || d.when(params));
  const { main, more } = advanced
    ? { main: visible, more: [] as ParamDef[] }
    : basicSplit(visible, sources);
  const rows = showAll ? [...main, ...more] : main;
  return (
    <div className="params">
      {rows.map((d) => (
        <ParamRow
          key={d.key}
          def={d}
          valueSI={params[d.key] ?? 0}
          source={sources[d.key] ?? 'default'}
        />
      ))}
      {more.length > 0 && (
        <button
          type="button"
          className="params__more"
          aria-expanded={showAll}
          onClick={() => {
            setShowAll(!showAll);
          }}
        >
          <ChevronsUpDown size={14} strokeWidth={1.75} aria-hidden="true" />
          {showAll ? t('mode.fewerParams') : t('mode.moreParams', { count: more.length })}
        </button>
      )}
    </div>
  );
}

function ParamRow({
  def,
  valueSI,
  source,
}: {
  def: ParamDef;
  valueSI: number;
  source: 'problem' | 'default' | 'user';
}) {
  const t = useT();
  const L = useLocalized();
  const unit = def.unit ?? '1';
  const shown = def.kind === 'number' ? fromSI(valueSI, unit) : valueSI;
  const id = `param-${def.key}`;
  const set = (displayValue: number) => {
    if (!Number.isFinite(displayValue)) return;
    const clamped = Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, displayValue));
    sim.setParam(def.key, def.kind === 'number' ? toSI(clamped, unit) : clamped);
  };

  return (
    <div className="param" data-source={source}>
      <div className="param__head">
        {def.kind === 'toggle' ? (
          <span className="param__label" id={id}>
            &nbsp;
          </span>
        ) : (
          <label htmlFor={id} className="param__label" id={`${id}-label`}>
            {L(def.label)} {def.symbol && <Equation tex={def.symbol} display={false} />}
          </label>
        )}
        <span
          className={`param__source param__source--${source}`}
          data-tip={t(`params.sourceHint.${source}`)}
          data-tip-side="left"
        >
          {t(`params.source.${source}`)}
        </span>
      </div>
      {def.kind === 'number' && (
        <div className="param__controls">
          <input
            type="range"
            aria-label={L(def.label)}
            min={def.min}
            max={def.max}
            step={def.step ?? 'any'}
            value={Math.min(def.max ?? shown, Math.max(def.min ?? shown, shown))}
            onChange={(e) => {
              set(Number(e.target.value));
            }}
          />
          <input
            id={id}
            className="param__number mono"
            type="number"
            min={def.min}
            max={def.max}
            step={def.step ?? 'any'}
            value={Number(shown.toPrecision(6))}
            onChange={(e) => {
              if (e.target.value !== '') set(Number(e.target.value));
            }}
          />
          <span className="param__unit">{unitLabel(unit)}</span>
        </div>
      )}
      {def.kind === 'choice' && (
        <div className="segmented param__choice" role="radiogroup" aria-labelledby={`${id}-label`}>
          {def.choices?.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={valueSI === c.value}
              className="segmented__item"
              onClick={() => {
                set(c.value);
              }}
            >
              {L(c.label)}
            </button>
          ))}
        </div>
      )}
      {def.kind === 'toggle' && (
        <label className="param__toggle">
          <input
            type="checkbox"
            checked={valueSI > 0.5}
            onChange={(e) => {
              set(e.target.checked ? 1 : 0);
            }}
          />
          <span>{L(def.label)}</span>
        </label>
      )}
      {def.live && <p className="param__hint">{t('params.liveHint')}</p>}
    </div>
  );
}
