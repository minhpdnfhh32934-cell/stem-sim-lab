/** Controls and chips over the enzyme lesson's 2D and 3D pictures (the same text in both). */
import { useLocalized } from '@/app/i18n/localized';
import { L } from '../common';
import { useFmt } from '../fmt';
import { Segmented } from '../ui';
import { paramsOf, useEnzymeData } from './data';
import { apparent } from './enzyme';
import { useEnzyme } from './store';

export function EnzymeChips() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useEnzyme();
  const app = apparent(paramsOf(st));
  const inhibited = st.kind !== 'none';
  const { check } = useEnzymeData();
  return (
    <>
      <Segmented
        label={L('Đồ thị', 'Plot')}
        value={st.view}
        options={[
          { id: 'rate', label: L('v theo [S]', 'v vs [S]') },
          { id: 'time', label: L('[S] theo thời gian', '[S] over time') },
        ]}
        onChange={(view) => {
          useEnzyme.setState({ view });
        }}
      />
      <span className="chem-chip">
        <span>
          V<sub>max</sub>
          {inhibited ? Lz(L(' (biểu kiến)', ' (apparent)')) : ''} = {fmt(app.vmax)} mM/
          {Lz(L('phút', 'min'))}
        </span>
      </span>
      <span className="chem-chip">
        <span>
          K<sub>m</sub>
          {inhibited ? Lz(L(' (biểu kiến)', ' (apparent)')) : ''} = {fmt(app.km)} mM
        </span>
      </span>
      {st.view === 'time' && (
        <span className="chem-chip" title={Lz(L('Kiểm tra chéo', 'Cross-check'))}>
          {Lz(L('Lambert W so với DOPRI5: sai lệch ', 'Lambert W vs DOPRI5: difference '))}
          {fmt(check, 2)}
        </span>
      )}
    </>
  );
}
