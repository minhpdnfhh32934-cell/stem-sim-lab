import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { usePublishCard } from '@/modules/usePublishCard';
import { L } from '../common';
import { formatFormula } from '../formula';
import { signed } from '../redox/oxidation';
import { refusalText } from '../redox/refusal';
import { nsCard, TITLE } from './card';
import {
  AXES,
  NS_REACTIONS,
  SUBSTANCES,
  analyse,
  place,
  type Element,
  type NsReaction,
  type Placement,
  type Role,
} from './model';
import { addFormula, removeFormula, setNs, useNsStore } from './store';
import './nitrogenSulfur.css';

const ELEMENT_NAME: Record<Element, LocalizedText> = {
  N: L('Nitrogen', 'Nitrogen'),
  S: L('Sulfur', 'Sulfur'),
};
const ROLE: Record<Role, LocalizedText> = {
  reducing: L('chỉ có tính khử (số oxi hóa thấp nhất)', 'reducing only (lowest number)'),
  oxidising: L('chỉ có tính oxi hóa (số oxi hóa cao nhất)', 'oxidising only (highest number)'),
  both: L('vừa có tính oxi hóa vừa có tính khử', 'both oxidising and reducing'),
};

function whyNot(p: Placement, el: Element): LocalizedText {
  if (p.ok) return L('', '');
  if (p.reason === 'absent')
    return L(`không có nguyên tố ${el} trong công thức`, `no ${el} in the formula`);
  if (p.reason === 'unreadable')
    return L('SimLab không đọc được công thức này', 'SimLab cannot read this formula');
  return refusalText({ ok: false, reason: p.reason, elements: [el] }) ?? L('', '');
}

/** The species of the element's axis: the book's, then the learner's. */
function useAxis() {
  const { element, extraN, extraS } = useNsStore();
  return useMemo(() => {
    const axis = AXES[element];
    const extra = element === 'N' ? extraN : extraS;
    const book = axis.species.map((f) => ({ placement: place(element, f), own: false }));
    const mine = extra.map((f) => ({ placement: place(element, f), own: true }));
    return { element, axis, items: [...book, ...mine] };
  }, [element, extraN, extraS]);
}

export function NsStage() {
  const Lz = useLocalized();
  const card = useMemo(() => nsCard(), []);
  usePublishCard(card);
  const { element, axis, items } = useAxis();
  const span = axis.max - axis.min;
  const placed = items.filter((i) => i.placement.ok);
  const refused = items.filter((i) => !i.placement.ok);
  // Chips at the same number stack upward.
  const level = new Map<number, number>();
  return (
    <div className="chem-view ns">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(TITLE)}</strong>
        </span>
        <span className="chem-chip">
          {Lz(
            L(
              `Trục số oxi hóa của ${Lz(ELEMENT_NAME[element])} (tr. ${String(axis.page)})`,
              `Oxidation-number axis of ${Lz(ELEMENT_NAME[element])} (p. ${String(axis.page)})`,
            ),
          )}
        </span>
      </div>
      <div
        className="ns-axis"
        role="list"
        aria-label={Lz(L(`Trục số oxi hóa của ${element}`, `Oxidation-number axis of ${element}`))}
      >
        {placed.map(({ placement, own }) => {
          if (!placement.ok) return null;
          const k = level.get(placement.value) ?? 0;
          level.set(placement.value, k + 1);
          return (
            <span
              key={placement.formula}
              role="listitem"
              className={`ns-chip ns-chip--${placement.role}${own ? ' ns-chip--own' : ''}`}
              style={{
                left: `${String(((placement.value - axis.min) / span) * 100)}%`,
                bottom: `calc(72px + ${String(k)} * 40px)`,
              }}
              title={Lz(ROLE[placement.role])}
              // A list item takes no name from its content: the label carries the number.
              aria-label={`${formatFormula(placement.formula)}: ${element} ${signed(placement.value)}, ${Lz(ROLE[placement.role])}`}
            >
              {formatFormula(placement.formula)}
            </span>
          );
        })}
        <div className="ns-axis__line" aria-hidden="true">
          {Array.from({ length: span + 1 }, (_, i) => axis.min + i).map((v) => (
            <span
              key={v}
              className="ns-axis__tick"
              style={{ left: `${String(((v - axis.min) / span) * 100)}%` }}
            >
              {signed(v)}
            </span>
          ))}
        </div>
        <div className="ns-axis__ends" aria-hidden="true">
          <span>{Lz(L('← tính khử', '← reducing'))}</span>
          <span>{Lz(L('tính oxi hóa →', 'oxidising →'))}</span>
        </div>
      </div>
      {refused.length > 0 && (
        <ul className="ns-refused small">
          {refused.map(({ placement }) => (
            <li key={placement.formula}>
              <strong>{formatFormula(placement.formula)}</strong>: {Lz(whyNot(placement, element))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NsPanel() {
  const Lz = useLocalized();
  const { element, selected, extraN, extraS } = useNsStore();
  const [draft, setDraft] = useState('');
  const extra = element === 'N' ? extraN : extraS;
  const substance = SUBSTANCES.find((s) => s.id === selected);
  const list = SUBSTANCES.filter((s) => s.element === element);
  return (
    <div className="chem-form ns-panel">
      <div className="segmented" role="radiogroup" aria-label={Lz(L('Nguyên tố', 'Element'))}>
        {(['N', 'S'] as const).map((el) => (
          <button
            key={el}
            type="button"
            role="radio"
            aria-checked={element === el}
            className="segmented__item"
            onClick={() => {
              setNs({ element: el, selected: SUBSTANCES.find((s) => s.element === el)?.id });
            }}
          >
            {Lz(ELEMENT_NAME[el])}
          </button>
        ))}
      </div>
      <form
        className="ns-panel__add"
        onSubmit={(e) => {
          e.preventDefault();
          addFormula(draft);
          setDraft('');
        }}
      >
        <label>
          <span>{Lz(L('Đặt thêm một chất lên trục', 'Place another compound on the axis'))}</span>
          <input
            className="input mono"
            value={draft}
            placeholder={element === 'N' ? 'NH4NO3, N2O5…' : 'Na2SO3, FeS…'}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
          />
        </label>
        <button type="submit" className="btn" disabled={!draft.trim()}>
          {Lz(L('Đặt lên trục', 'Place'))}
        </button>
      </form>
      {extra.length > 0 && (
        <ul className="ns-panel__own">
          {extra.map((f) => (
            <li key={f}>
              <span className="mono">{formatFormula(f)}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label={Lz(L(`Bỏ ${f} khỏi trục`, `Remove ${f} from the axis`))}
                onClick={() => {
                  removeFormula(f);
                }}
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div
        className="ns-panel__substances"
        role="radiogroup"
        aria-label={Lz(L('Chất', 'Substance'))}
      >
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={selected === s.id}
            className="btn btn--ghost"
            onClick={() => {
              setNs({ selected: s.id });
            }}
          >
            {Lz(s.name)}
          </button>
        ))}
      </div>
      {substance && (
        <section className="ns-card" aria-label={Lz(substance.name)}>
          <h3>
            {Lz(substance.name)}{' '}
            <span className="muted small">
              {Lz(L(`Bài ${String(substance.lesson)}`, `Lesson ${String(substance.lesson)}`))}
            </span>
          </h3>
          <ul>
            {substance.facts.map((f) => (
              <li key={f.text.vi}>
                {Lz(f.text)} <span className="muted small">(tr. {f.page})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Equation({ r }: { r: NsReaction }) {
  const side = (terms: NsReaction['reactants']) =>
    terms.map((t) => `${t.coef > 1 ? String(t.coef) : ''}${formatFormula(t.formula)}`).join(' + ');
  return (
    <span className="mono">
      {side(r.reactants)} {r.reversible ? '⇌' : '→'} {side(r.products)}
    </span>
  );
}

function Verdict({ r }: { r: NsReaction }) {
  const Lz = useLocalized();
  const a = analyse(r);
  if (a.kind === 'notRedox')
    return <>{Lz(L('Không phải phản ứng oxi hóa – khử', 'Not a redox reaction'))}</>;
  if (a.kind === 'redox')
    return (
      <>
        {Lz(L('Chất khử: ', 'Reducing agent: '))}
        {a.reducingAgents.map(formatFormula).join(', ')}
        {' · '}
        {Lz(L('chất oxi hóa: ', 'oxidising agent: '))}
        {a.oxidisingAgents.map(formatFormula).join(', ')}
        {' · '}
        {[...a.oxidised, ...a.reduced]
          .map((c) => `${c.el} ${signed(c.from)} → ${signed(c.to)}`)
          .join('; ')}
      </>
    );
  const refused = a.kind === 'undecided' ? a.refused.map((s) => s.formula) : a.elements;
  return (
    <>
      {Lz(
        L(
          `Chưa xác định được: ${refused.map(formatFormula).join(', ')} có nguyên tố ở nhiều mức số oxi hóa`,
          `Cannot decide: ${refused.map(formatFormula).join(', ')} holds an element at several levels`,
        ),
      )}
    </>
  );
}

export function NsBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const element = useNsStore((s) => s.element);
  return (
    <table className="ns-table">
      <caption className="sr-only">
        {Lz(L('Phản ứng trong SGK và số oxi hóa', 'Textbook reactions and oxidation numbers'))}
      </caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Phản ứng', 'Reaction'))}</th>
          <th scope="col">{Lz(L('Điều kiện', 'Conditions'))}</th>
          <th scope="col">ΔᵣH°</th>
          <th scope="col">{Lz(L('Số oxi hóa (SimLab tính)', 'Oxidation numbers (computed)'))}</th>
        </tr>
      </thead>
      <tbody>
        {NS_REACTIONS.filter((r) => r.element === element).map((r) => (
          <tr key={r.id}>
            <th scope="row">
              <Equation r={r} /> <span className="muted small">(tr. {r.page})</span>
            </th>
            <td>{Lz(r.conditions)}</td>
            <td className="mono">
              {r.dH_kJ === null ? '—' : `${formatNumber(locale, r.dH_kJ)} kJ`}
            </td>
            <td>
              <Verdict r={r} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
