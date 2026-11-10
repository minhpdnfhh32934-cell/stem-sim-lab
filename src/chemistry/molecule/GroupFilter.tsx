import { useLocalized } from '@/app/i18n/localized';
import { L } from '../common';
import { MOLECULES, prettyFormula } from '../data/molecules';
import { GROUP_NAME, GROUPS, type FunctionalGroup } from './groups';
import { selectMolecule, useMoleculeStore } from './store';

/**
 * "Lọc theo nhóm chức" (#54 item 11): the organic molecules of the library that contain a
 * functional group, found by the data script (RDKit SMARTS), never written by hand.
 */
export function GroupFilter() {
  const Lz = useLocalized();
  const id = useMoleculeStore((s) => s.id);
  const group = useMoleculeStore((s) => s.group);
  const present = GROUPS.filter((g) => MOLECULES.some((m) => m.groups?.includes(g)));
  const list = group ? MOLECULES.filter((m) => m.groups?.includes(group)) : [];
  return (
    <div className="mol-groups">
      <label>
        <span>{Lz(L('Lọc theo nhóm chức', 'Filter by functional group'))}</span>
        <select
          value={group ?? ''}
          onChange={(e) => {
            useMoleculeStore.setState({
              group: (e.target.value || null) as FunctionalGroup | null,
            });
          }}
        >
          <option value="">{Lz(L('— Chọn nhóm chức —', '— Choose a group —'))}</option>
          {present.map((g) => (
            <option key={g} value={g}>
              {Lz(GROUP_NAME[g])}
            </option>
          ))}
        </select>
      </label>
      {list.length > 0 && (
        <div
          className="mol-chips mol-groups__list"
          role="group"
          aria-label={Lz(L('Phân tử có nhóm chức này', 'Molecules with this group'))}
        >
          {list.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === id}
              title={Lz(m.name)}
              onClick={() => {
                selectMolecule(m.id);
                useMoleculeStore.setState({ query: '' });
              }}
            >
              {prettyFormula(m.display_formula)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
