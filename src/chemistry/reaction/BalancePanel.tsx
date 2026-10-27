import { useLocalized } from '@/app/i18n/localized';
import { L } from '../common';
import { formatEquationText } from '../formula';
import { useReactionStore } from './store';
import '../chem.css';

const EXAMPLES = [
  'Fe + O2 -> Fe2O3',
  'C3H8 + O2 -> CO2 + H2O',
  'KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O',
  'Cu + HNO3 -> Cu(NO3)2 + NO + H2O',
  'MnO4^- + Fe^2+ + H^+ -> Mn^2+ + Fe^3+ + H2O',
  'FeS2 + O2 -> Fe2O3 + SO2',
];

/** Inspector of the balancer: how to write an equation and sample equations (UI-32, #70). */
export function BalancePanel() {
  const Lz = useLocalized();
  const text = useReactionStore((s) => s.equation);
  return (
    <div className="chem-form">
      <p className="small muted">
        {Lz(
          L(
            'Dùng “->” hoặc “=” giữa hai vế, “ + ” (có dấu cách) giữa các chất. Điện tích: Fe^3+, SO4^2-, NH4+, OH-; electron: e-. Ngoặc: Ca(OH)2, K4[Fe(CN)6]; ngậm nước: CuSO4·5H2O.',
            'Use “->” or “=” between the sides and “ + ” (with spaces) between species. Charges: Fe^3+, SO4^2-, NH4+, OH-; electron: e-. Brackets: Ca(OH)2, K4[Fe(CN)6]; hydrates: CuSO4·5H2O.',
          ),
        )}
      </p>
      <p className="econf__label">{Lz(L('Ví dụ', 'Examples'))}</p>
      <div className="mol-chips" role="group" aria-label={Lz(L('Ví dụ', 'Examples'))}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            aria-pressed={ex === text}
            onClick={() => {
              useReactionStore.setState({ equation: ex });
            }}
          >
            {formatEquationText(ex)}
          </button>
        ))}
      </div>
    </div>
  );
}
