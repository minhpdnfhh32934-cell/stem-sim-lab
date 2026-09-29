import { useLocalized } from '@/app/i18n/localized';
import { cx } from '@/ui/cx';
import { L } from '../common';
import { bondChanges, reactionById, sideTotals } from '../data/reactions';
import { FRAME_KIND } from './labels';
import { useReactionStore } from './store';

/** Mechanism steps with the bonds that break/form, or the conservation table. */
export function ReactionBottom() {
  const Lz = useLocalized();
  const { id, t } = useReactionStore();
  const r = reactionById(id);
  if (!r) return null;
  const mech = r.mechanism;
  if (!mech) {
    const a = sideTotals(r.reactants);
    const b = sideTotals(r.products);
    const els = [...new Set([...a.counts.keys(), ...b.counts.keys()])];
    return (
      <div className="chem-block">
        <table className="chem-table">
          <caption className="econf__label">
            {Lz(L('Kiểm tra bảo toàn nguyên tố và điện tích', 'Element and charge conservation'))}
          </caption>
          <thead>
            <tr>
              <th scope="col">{Lz(L('Nguyên tố', 'Element'))}</th>
              <th scope="col" className="num">
                {Lz(L('Vế trái', 'Left'))}
              </th>
              <th scope="col" className="num">
                {Lz(L('Vế phải', 'Right'))}
              </th>
            </tr>
          </thead>
          <tbody>
            {els.map((el) => (
              <tr key={el}>
                <th scope="row">{el}</th>
                <td className="num">{a.counts.get(el) ?? 0}</td>
                <td className="num">{b.counts.get(el) ?? 0}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">{Lz(L('Điện tích', 'Charge'))}</th>
              <td className="num">{a.charge}</td>
              <td className="num">{b.charge}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  const current = Math.min(mech.frames.length - 1, Math.floor(t + 1e-9));
  const name = (f: (typeof mech.frames)[number], map: number) =>
    `${f.atoms.find((a) => a.map === map)?.el ?? '?'}${map}`;
  return (
    <div className="chem-block">
      <ol className="rx-steps">
        {mech.frames.map((f, i) => {
          const next = mech.frames[i + 1];
          const changes = next ? [...bondChanges(f, next)] : [];
          const list = (kind: string) =>
            changes
              .filter(([, c]) => c === kind)
              .map(([k]) => {
                const [a, b] = k.split('-').map(Number) as [number, number];
                return `${name(f, a)}–${name(f, b)}`;
              })
              .join(', ');
          const broken = list('broken');
          const formed = list('formed');
          const changed = list('orderChanged');
          return (
            <li key={i} className={cx(i === current && 'is-active')}>
              <button
                type="button"
                onClick={() => {
                  useReactionStore.setState({ t: i, playing: false });
                }}
              >
                <strong>
                  {i + 1}. {Lz(f.label)}
                </strong>{' '}
                <span className="muted">({Lz(FRAME_KIND[f.kind])})</span>
              </button>
              <p className="small">{Lz(f.description)}</p>
              {next && (broken || formed || changed) && (
                <p className="small rx-steps__changes">
                  {broken && (
                    <span className="rx-break">
                      {Lz(L('Đứt: ', 'Breaks: '))}
                      {broken}
                    </span>
                  )}
                  {formed && (
                    <span className="rx-form">
                      {Lz(L('Tạo: ', 'Forms: '))}
                      {formed}
                    </span>
                  )}
                  {changed && (
                    <span>
                      {Lz(L('Đổi bậc: ', 'Order changes: '))}
                      {changed}
                    </span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="small muted">{Lz(mech.note)}</p>
    </div>
  );
}
