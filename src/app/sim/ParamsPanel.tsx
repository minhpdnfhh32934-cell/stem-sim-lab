import { useShallow } from 'zustand/react/shallow';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { fromSI, toSI, unitLabel } from '@/core/units';
import type { ParamDef } from '@/physics/types';
import { Equation } from '@/science-card/Equation';
import { sim } from './runtime';
import { useSimStore } from './simStore';

/** Parameter sliders + numeric inputs, with the origin of each value (§2.1). */
export function ParamsPanel() {
  const { scene, params, sources } = useSimStore(
    useShallow((s) => ({ scene: s.scene, params: s.params, sources: s.sources })),
  );
  if (!scene) return null;
  return (
    <div className="params">
      {scene.params
        .filter((d) => !d.when || d.when(params))
        .map((d) => (
          <ParamRow
            key={d.key}
            def={d}
            valueSI={params[d.key] ?? 0}
            source={sources[d.key] ?? 'default'}
          />
        ))}
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
  const locale = useSettingsStore((s) => s.locale);
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
        <label htmlFor={id} className="param__label">
          {L(def.label)} <Equation tex={def.symbol} display={false} />
        </label>
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
        <div className="segmented param__choice" role="radiogroup" aria-labelledby={id}>
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
            id={id}
            type="checkbox"
            checked={valueSI > 0.5}
            onChange={(e) => {
              set(e.target.checked ? 1 : 0);
            }}
          />
          <span>{formatNumber(locale, valueSI > 0.5 ? 1 : 0)}</span>
        </label>
      )}
      {def.live && <p className="param__hint">{t('params.liveHint')}</p>}
    </div>
  );
}
