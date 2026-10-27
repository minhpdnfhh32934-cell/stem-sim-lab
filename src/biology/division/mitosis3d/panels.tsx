import { useLocalized } from '@/app/i18n/localized';
import { cx } from '@/ui/cx';
import { L } from '../../common';
import { useDivisionStore } from '../state';
import { COMPONENTS, STAGE3D_NAME, componentsFor } from './components';
import { timelineFor, useMitosis3D } from './store';
import { STAGES_3D } from './timeline';

/** Inspector list of the cell's parts (the same parts can be clicked in the 3D view). */
export function Mitosis3DParts() {
  const Lz = useLocalized();
  const cellType = useDivisionStore((s) => s.cellType);
  const selected = useMitosis3D((s) => s.selected);
  return (
    <div className="m3d-parts">
      <h4 className="m3d-parts__title">{Lz(L('Bộ phận tế bào', 'Cell parts'))}</h4>
      <div
        className="m3d-parts__list"
        role="group"
        aria-label={Lz(L('Bộ phận tế bào', 'Cell parts'))}
      >
        {componentsFor(cellType).map((id) => {
          const on = selected?.component === id;
          return (
            <button
              key={id}
              type="button"
              className={cx('m3d-parts__item', on && 'is-active')}
              aria-pressed={on}
              onClick={() => {
                useMitosis3D.setState({ selected: on ? null : { component: id } });
              }}
            >
              {Lz(COMPONENTS[id].name)}
            </button>
          );
        })}
      </div>
      <p className="small muted">
        {Lz(
          L(
            'Kích thước và vị trí trong hình 3D là minh họa, không theo tỉ lệ; số lượng NST là chính xác.',
            'Sizes and positions in the 3D picture are illustrative, not to scale; chromosome counts are exact.',
          ),
        )}
      </p>
    </div>
  );
}

const nucleiText = (n: { from: number; to: number }) =>
  n.from === n.to ? String(n.to) : `${String(n.from)} → ${String(n.to)}`;

/**
 * Counts of the seven 3D stages (read from the bookkeeping model). Click a row to go there; with
 * the keyboard, each row header is a button (Tab, then Enter or Space).
 */
export function Mitosis3DBottom() {
  const Lz = useLocalized();
  const pairs = useDivisionStore((s) => s.pairs);
  const cellType = useDivisionStore((s) => s.cellType);
  const tl = timelineFor(pairs, cellType);
  const current = useMitosis3D((s) => tl.stageAt(s.t).index);
  return (
    <div className="chem-block">
      <table className="chem-table">
        <thead>
          <tr>
            <th scope="col">{Lz(L('Kì', 'Stage'))}</th>
            <th scope="col" className="num">
              {Lz(L('Số tế bào', 'Cells'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Số nhân / tế bào', 'Nuclei / cell'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Số NST / tế bào', 'Chromosomes / cell'))}
            </th>
            <th scope="col">{Lz(L('Trạng thái', 'State'))}</th>
            <th scope="col" className="num">
              {Lz(L('Crômatit', 'Chromatids'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Tâm động', 'Centromeres'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Phân tử ADN', 'DNA molecules'))}
            </th>
          </tr>
        </thead>
        <tbody>
          {STAGES_3D.map((id, k) => {
            const c = tl.counts(id);
            return (
              <tr
                key={id}
                className={cx(k === current && 'is-active')}
                onClick={() => {
                  useMitosis3D.setState({ t: tl.keyTime(id), playing: false });
                }}
              >
                <th scope="row">
                  {/* The row's click handler runs (the click bubbles up to the row). */}
                  <button
                    type="button"
                    className="bio-row-btn"
                    aria-current={k === current ? 'step' : undefined}
                  >
                    {Lz(STAGE3D_NAME[id])}
                  </button>
                </th>
                <td className="num">{c.cells}</td>
                <td className="num">{nucleiText(c.nuclei)}</td>
                <td className="num">{c.chromosomes}</td>
                <td>{Lz(c.state === 'double' ? L('kép', 'double') : L('đơn', 'single'))}</td>
                <td className="num">{c.chromatids}</td>
                <td className="num">{c.centromeres}</td>
                <td className="num">{c.dnaMolecules}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small muted">
        {Lz(
          L(
            'Kì cuối: 1 tế bào có 2 nhân, mỗi nhân 2n NST đơn (cả tế bào có 4n NST đơn). Phân chia tế bào chất: số liệu cho mỗi tế bào con. "1 → 0": thay đổi trong kì.',
            'Telophase: one cell with two nuclei, 2n single chromosomes in each (4n single chromosomes in the whole cell). Cytokinesis: counts per daughter cell. "1 → 0": changes during the stage.',
          ),
        )}
      </p>
    </div>
  );
}
