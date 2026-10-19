import { useLocalized } from '@/app/i18n/localized';
import { cx } from '@/ui/cx';
import { L } from '../../common';
import { useDivisionStore } from '../state';
import {
  MEIOSIS_ILLUSTRATION,
  MEIOSIS_PARTS,
  MEIOSIS_PART_ORDER,
  MEIOSIS_STAGE_NAME,
} from './components';
import { distinctGametes } from './facts';
import { meiosisTimelineFor, useMeiosis3D } from './store';
import { MEIOSIS_STAGES_3D } from './timeline';

/** The lesson's timeline (the same run as the 2D picture: 2n, crossing over, seed). */
function useTimeline() {
  const pairs = useDivisionStore((s) => s.pairs);
  const crossover = useDivisionStore((s) => s.crossover);
  const seed = useDivisionStore((s) => s.seed);
  return meiosisTimelineFor(pairs, crossover, seed);
}

/** Inspector list of the cell's parts (the same parts can be clicked in the 3D view). */
export function Meiosis3DParts() {
  const Lz = useLocalized();
  const selected = useMeiosis3D((s) => s.selected);
  const title = Lz(L('Bộ phận tế bào', 'Cell parts'));
  return (
    <div className="m3d-parts">
      <h4 className="m3d-parts__title">{title}</h4>
      <div className="m3d-parts__list" role="group" aria-label={title}>
        {MEIOSIS_PART_ORDER.map((id) => {
          const on = selected?.component === id;
          return (
            <button
              key={id}
              type="button"
              className={cx('m3d-parts__item', on && 'is-active')}
              aria-pressed={on}
              onClick={() => {
                useMeiosis3D.setState({ selected: on ? null : { component: id } });
              }}
            >
              {Lz(MEIOSIS_PARTS[id].name)}
            </button>
          );
        })}
      </div>
      <p className="small muted">
        {Lz(MEIOSIS_ILLUSTRATION)}{' '}
        {Lz(
          L(
            'Số lượng NST, màu từng đoạn crômatit và điểm trao đổi chéo lấy từ mô hình.',
            'Chromosome counts, the colour of each chromatid piece and the crossover point come from the model.',
          ),
        )}
      </p>
    </div>
  );
}

const nucleiText = (n: { from: number; to: number }) =>
  n.from === n.to ? String(n.to) : `${String(n.from)} → ${String(n.to)}`;

/**
 * Counts of the twelve 3D stages (read from the bookkeeping model). Click a row to go there; with
 * the keyboard, each row header is a button (Tab, then Enter or Space).
 */
export function Meiosis3DBottom() {
  const Lz = useLocalized();
  const tl = useTimeline();
  const current = useMeiosis3D((s) => tl.stageAt(s.t).index);
  const gametes = distinctGametes(tl);
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
              {Lz(L('Cromatit', 'Chromatids'))}
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
          {MEIOSIS_STAGES_3D.map((id, k) => {
            const c = tl.counts(id);
            return (
              <tr
                key={id}
                className={cx(k === current && 'is-active')}
                onClick={() => {
                  useMeiosis3D.setState({ t: tl.keyTime(id), playing: false });
                }}
              >
                <th scope="row">
                  {/* The row's click handler runs (the click bubbles up to the row). */}
                  <button
                    type="button"
                    className="bio-row-btn"
                    aria-current={k === current ? 'step' : undefined}
                  >
                    {Lz(MEIOSIS_STAGE_NAME[id])}
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
            `Kì cuối I, kì cuối II: mỗi tế bào có 2 nhân, mỗi nhân n NST (quy ước của bản 3D). Phân chia tế bào chất: số liệu cho mỗi tế bào con. Không có nhân đôi ADN giữa hai lần phân bào. Lần chạy này cho ${gametes} loại giao tử khác nhau.`,
            `Telophase I, telophase II: each cell has two nuclei with n chromosomes each (the 3D convention). Cytokinesis: counts per daughter cell. No DNA replication between the two divisions. This run gives ${gametes} different kinds of gamete.`,
          ),
        )}
      </p>
    </div>
  );
}
