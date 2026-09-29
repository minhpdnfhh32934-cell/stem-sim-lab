import { Search } from 'lucide-react';
import { useLocalized } from '@/app/i18n/localized';
import { ReviewBadge } from '@/ui/Badges';
import { L } from '../common';
import { REACTIONS, findReactions, reactionById, type ReactionCategory } from '../data/reactions';
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

/** Reaction list (search + category) and the selected reaction's facts and sources. */
export function ReactionPanel() {
  const Lz = useLocalized();
  const { id, query, category } = useReactionStore();
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
              {x.mechanism && <span className="rx-list__tag">{Lz(L('cơ chế', 'mechanism'))}</span>}
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
    </div>
  );
}
