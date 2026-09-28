import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { fmtQty } from '@/physics/common/tex';
import { Equation } from '@/science-card/Equation';
import { sim } from './runtime';
import { useSimStore } from './simStore';

/** Live properties of the selected body (refreshed ~10 Hz). */
export function ObjectPanel() {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { scene, selected, params } = useSimStore(
    useShallow((s) => ({ scene: s.scene, selected: s.selected, params: s.params, tick: s.tick })),
  );
  const body = scene?.bodies.find((b) => b.id === selected);
  const state = sim.renderState;
  if (!scene || !body || !state) {
    return <p className="muted small">{t('object.none')}</p>;
  }
  const props = body.properties?.(state, params) ?? [];
  return (
    <div className="object-panel">
      <p className="object-panel__name">{L(body.label)}</p>
      <dl className="object-panel__list">
        {props.map((pr) => (
          <div key={pr.symbol} className="object-panel__row">
            <dt>
              {L(pr.label)} <Equation tex={pr.symbol} display={false} />
            </dt>
            <dd className="mono">{fmtQty(locale, pr.value, pr.unit, 4)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
