import { useLocalized } from '@/app/i18n/localized';
import { cx } from '@/ui/cx';
import { L } from '../../common';
import { DOGMA_ILLUSTRATION, DOGMA_PARTS, DOGMA_PART_ORDER } from './components';
import { useDogma3D } from './store';

/** Inspector list of the parts (the same parts can be clicked in the 3D view). */
export function Dogma3DParts() {
  const Lz = useLocalized();
  const selected = useDogma3D((s) => s.selected);
  const title = Lz(L('Các thành phần', 'Parts'));
  return (
    <div className="m3d-parts">
      <h4 className="m3d-parts__title">{title}</h4>
      <div className="m3d-parts__list" role="group" aria-label={title}>
        {DOGMA_PART_ORDER.map((id) => {
          const on = selected?.kind === 'part' && selected.part === id;
          return (
            <button
              key={id}
              type="button"
              className={cx('m3d-parts__item', on && 'is-active')}
              aria-pressed={on}
              onClick={() => {
                useDogma3D.setState({ selected: on ? null : { kind: 'part', part: id } });
              }}
            >
              {Lz(DOGMA_PARTS[id].name)}
            </button>
          );
        })}
      </div>
      <p className="small muted">
        {Lz(DOGMA_ILLUSTRATION)}{' '}
        {Lz(
          L(
            'Mọi bazơ, bộ ba, bộ ba đối mã và axit amin lấy từ trình tự đã nhập và bảng mã di truyền.',
            'Every base, codon, anticodon and amino acid comes from the sequence typed in and the genetic code.',
          ),
        )}
      </p>
    </div>
  );
}
