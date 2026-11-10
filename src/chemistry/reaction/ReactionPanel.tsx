import { Search } from 'lucide-react';
import { useContext, useState } from 'react';
import { BenchContext } from '@/app/bench/shellMode';
import { useLocalized } from '@/app/i18n/localized';
import { openTopic } from '@/app/topics';
import { ReviewBadge } from '@/ui/Badges';
import { L } from '../common';
import {
  REACTIONS,
  findReactions,
  reactionById,
  type Reaction,
  type ReactionCategory,
} from '../data/reactions';
import { formatFormula } from '../formula';
import { EquationText } from './Equation';
import { CATEGORY } from './labels';
import { selectReaction, useReactionStore } from './store';

const FILTERS: (ReactionCategory | 'all' | 'mechanism')[] = [
  'all',
  'mechanism',
  'organic',
  'redox',
  'acidBase',
  'precipitation',
  'combustion',
  'synthesis',
  'decomposition',
  'equilibrium',
];

/** "2H₂ + O₂ → 2H₂O" as one line of text (a list row cannot hold the equation's paragraph). */
function equationString(r: Pick<Reaction, 'reactants' | 'products' | 'reversible'>): string {
  const side = (terms: Reaction['reactants']) =>
    terms.map((t) => `${t.coef > 1 ? String(t.coef) : ''}${formatFormula(t.formula)}`).join(' + ');
  return `${side(r.reactants)}${r.reversible ? ' ⇌ ' : ' → '}${side(r.products)}`;
}

/** Reaction list (search + category) and the selected reaction's facts and sources. */
export function ReactionPanel() {
  const Lz = useLocalized();
  const { id, query, category } = useReactionStore();
  const bench = useContext(BenchContext);
  const [other, setOther] = useState('');
  const r = reactionById(id);
  const list = findReactions(query).filter((x) =>
    category === 'all'
      ? true
      : category === 'mechanism'
        ? x.mechanism !== null
        : x.category === category,
  );
  return (
    <div className="chem-form">
      <label className="pt__search">
        <Search size={14} strokeWidth={1.75} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder={Lz(L('Tìm phản ứng: ester, CH4, Cu…', 'Find: ester, CH4, Cu…'))}
          onChange={(e) => {
            useReactionStore.setState({ query: e.target.value });
          }}
        />
      </label>
      <select
        aria-label={Lz(L('Loại phản ứng', 'Reaction type'))}
        value={category}
        onChange={(e) => {
          useReactionStore.setState({
            category: e.target.value as ReactionCategory | 'all' | 'mechanism',
          });
        }}
      >
        {FILTERS.map((f) => (
          <option key={f} value={f}>
            {f === 'all'
              ? Lz(L(`Tất cả (${REACTIONS.length})`, `All (${REACTIONS.length})`))
              : f === 'mechanism'
                ? Lz(L('Có cơ chế', 'With mechanism'))
                : Lz(CATEGORY[f])}
          </option>
        ))}
      </select>
      <ul className="rx-list" role="listbox" aria-label={Lz(L('Phản ứng', 'Reactions'))}>
        {list.map((x) => (
          <li key={x.id}>
            <button
              type="button"
              role="option"
              aria-selected={x.id === id}
              onClick={() => {
                selectReaction(x.id);
              }}
            >
              <span>{Lz(x.name)}</span>
              {bench && <span className="rx-list__eq">{equationString(x)}</span>}
              {x.mechanism && (
                <span className="rx-list__tag">
                  {bench ? Lz(L('Có cơ chế', 'Has a mechanism')) : Lz(L('cơ chế', 'mechanism'))}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {r && (
        <div className="rx-facts">
          <EquationText r={r} />
          <ReviewBadge status={r.review_status} />
          <p className="small">
            <strong>{Lz(L('Lớp: ', 'Grade: '))}</strong>
            {r.level} · {Lz(CATEGORY[r.category])}
          </p>
          <p className="small">
            <strong>{Lz(L('Điều kiện: ', 'Conditions: '))}</strong>
            {Lz(r.conditions)}
          </p>
          <p className="small muted">{r.sources.map((s) => s.citation).join(' · ')}</p>
        </div>
      )}
      {bench && (
        <form
          className="rx-other"
          onSubmit={(e) => {
            e.preventDefault();
            if (!other.trim()) return;
            useReactionStore.setState({ equation: other.trim() });
            void openTopic('equationBalancing');
          }}
        >
          <label>
            <span>{Lz(L('Viết phản ứng khác', 'Write another reaction'))}</span>
            <input
              value={other}
              placeholder="Fe + Cl2 -> FeCl3"
              spellCheck={false}
              onChange={(e) => {
                setOther(e.target.value);
              }}
            />
          </label>
          <button type="submit" className="btn" disabled={!other.trim()}>
            {Lz(L('Kiểm tra', 'Check'))}
          </button>
        </form>
      )}
    </div>
  );
}
