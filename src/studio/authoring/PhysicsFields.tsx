import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { fromSI, toSI, unitLabel } from '@/core/units';
import type { PhysicsScene } from '@/physics/types';
import { controlRange, poeById } from '../physics/comparison';
import { useScene } from '../physics/usePhysics';
import { withControl, withInitial, withPreset } from './bindingDraft';
import { editableParams, physicsPresets, presetKey } from './choices';
import type { AuthorDraft } from './draft';

interface Props {
  draft: AuthorDraft;
  onChange: (d: AuthorDraft) => void;
}

/** Display value of an SI number; 12 significant digits only drop unit-conversion noise. */
function display(valueSI: number, unit: string | undefined): number {
  return Number(fromSI(valueSI, unit ?? '1').toPrecision(12));
}

function ParamRows({ draft, onChange, scene }: Props & { scene: PhysicsScene }) {
  const t = useT();
  const L = useLocalized();
  const b = draft.binding;
  if (b.kind !== 'physics') return null;
  const poe = poeById(b.poe);
  if (!poe) return null;
  return (
    <fieldset className="author-params">
      <legend>{t('studio.authoring.editor.physics.params')}</legend>
      {editableParams(scene).map((def) => {
        const unit = def.unit ? unitLabel(def.unit) : '';
        const [lo, hi] = controlRange(scene, poe, def.key);
        const value = draft.initial[def.key];
        const isControl = b.controls.includes(def.key);
        const sceneDefault = scene.defaults[def.key];
        const inputId = `author-param-${def.key}`;
        return (
          <div key={def.key} className="author-param">
            <p className="author-param__name">{L(def.label)}</p>
            <label className="author-check">
              <input
                type="checkbox"
                checked={isControl}
                onChange={(e) => {
                  onChange(withControl(draft, scene, def.key, e.target.checked));
                }}
              />
              {t('studio.authoring.editor.physics.control')}
            </label>
            <div className="author-param__value">
              <label htmlFor={inputId}>
                {t('studio.authoring.editor.physics.start')} ({unit || '—'})
              </label>
              <input
                id={inputId}
                type="number"
                step={def.step ?? 'any'}
                value={
                  value === undefined || !Number.isFinite(value) ? '' : display(value, def.unit)
                }
                placeholder={
                  sceneDefault === undefined ? '' : String(display(sceneDefault, def.unit))
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  const v = raw === '' ? null : toSI(Number(raw), def.unit ?? '1');
                  onChange(withInitial(draft, def.key, v));
                }}
              />
              <span className="muted small">
                {t('studio.authoring.editor.physics.range', {
                  min: display(lo, def.unit),
                  max: display(hi, def.unit),
                  unit,
                })}
              </span>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

/** Physics: a preset scene + POE from the Physics Studio, with controls and start values. */
export function PhysicsFields({ draft, onChange }: Props) {
  const t = useT();
  const L = useLocalized();
  const b = draft.binding;
  const { scene, failed } = useScene(b.kind === 'physics' ? b.scene : '');
  if (b.kind !== 'physics') return null;
  const presets = physicsPresets();
  const current = presetKey(b);
  const poe = poeById(b.poe);
  const param = scene?.params.find((d) => d.key === poe?.param);
  return (
    <div className="author-binding">
      <label className="author-select">
        <span>{t('studio.authoring.editor.physics.preset')}</span>
        <select
          value={current}
          onChange={(e) => {
            const p = presets.find((x) => presetKey(x.binding) === e.target.value);
            if (p) onChange(withPreset(draft, p));
          }}
        >
          {presets.map((p) => {
            const q = poeById(p.binding.poe);
            return (
              <option key={presetKey(p.binding)} value={presetKey(p.binding)}>
                {q ? L(q.question) : p.binding.scene}
              </option>
            );
          })}
        </select>
      </label>
      {poe && (
        <p className="muted small">
          {t('studio.authoring.editor.physics.presetHint', {
            param: param ? L(param.label) : poe.param,
            factor: poe.factor,
          })}
        </p>
      )}
      {failed && <p className="studio-error">{t('studio.authoring.editor.physics.failed')}</p>}
      {!scene && !failed && <p className="muted">{t('studio.authoring.editor.physics.loading')}</p>}
      {scene && <ParamRows draft={draft} onChange={onChange} scene={scene} />}
    </div>
  );
}
