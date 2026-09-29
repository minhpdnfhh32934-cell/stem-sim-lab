import { BookCheck, CircleAlert, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { openTopic } from '@/app/topics';
import type { ScienceCardData } from '@/science-card/types';
import { L, usePublishCard } from '../common';
import {
  EquationError,
  balance,
  conservationMatrix,
  parseEquation,
  type BalanceResult,
  type ParsedEquation,
} from '../balance';
import { matchLibrary } from '../data/reactions';
import { formatFormula } from '../formula';
import { selectReaction, useReactionStore } from './store';
import '../chem.css';

const CARD: ScienceCardData = {
  title: L('Cân bằng phương trình hóa học', 'Balancing chemical equations'),
  model: L(
    'Bảo toàn số nguyên tử của từng nguyên tố và bảo toàn điện tích tạo thành hệ phương trình tuyến tính thuần nhất; hệ số cân bằng là vectơ nguyên dương nhỏ nhất trong không gian nghiệm (null space). Tính bằng số hữu tỉ chính xác, không làm tròn.',
    'Conservation of each element and of charge gives a homogeneous linear system; the coefficients are the smallest positive integer vector of its null space. Exact rational arithmetic, no rounding.',
  ),
  equations: [{ tex: 'A\\,\\vec{x} = \\vec{0},\\quad x_i \\in \\mathbb{Z}_{>0}' }],
  assumptions: [
    L(
      'Cân bằng được chỉ có nghĩa là bảo toàn nguyên tử và điện tích — KHÔNG chứng minh phản ứng xảy ra thật.',
      'A balanced equation only means atoms and charge are conserved — it does NOT prove the reaction happens.',
    ),
    L(
      'Phản ứng không có trong thư viện: chỉ kiểm tra cân bằng, không hiển thị cơ chế.',
      'Reactions not in the library: balance check only, no mechanism.',
    ),
  ],
  confidence: 'exact',
  confidenceNote: L('Đại số tuyến tính chính xác (BigInt).', 'Exact linear algebra (BigInt).'),
  userIntervened: false,
  sources: [
    {
      id: 'sgk-hh10',
      citation: 'Sách giáo khoa Hóa học 10 (GDPT 2018) — cân bằng phản ứng oxi hóa – khử',
    },
  ],
};

const EXAMPLES = [
  'Fe + O2 -> Fe2O3',
  'C3H8 + O2 -> CO2 + H2O',
  'KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O',
  'Cu + HNO3 -> Cu(NO3)2 + NO + H2O',
  'MnO4^- + Fe^2+ + H^+ -> Mn^2+ + Fe^3+ + H2O',
  'FeS2 + O2 -> Fe2O3 + SO2',
];

type Outcome =
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'result'; eq: ParsedEquation; result: BalanceResult };

export function BalanceStage() {
  usePublishCard(CARD);
  const Lz = useLocalized();
  const text = useReactionStore((s) => s.equation);
  const setText = (equation: string) => {
    useReactionStore.setState({ equation });
  };
  const outcome = useMemo<Outcome>(() => {
    if (!text.trim()) return { kind: 'empty' };
    try {
      const eq = parseEquation(text);
      return { kind: 'result', eq, result: balance(eq) };
    } catch (e) {
      return { kind: 'error', message: e instanceof EquationError ? e.message : String(e) };
    }
  }, [text]);

  return (
    <div className="chem-view">
      <label className="rx-input">
        <span className="econf__label">{Lz(L('Nhập phương trình', 'Enter an equation'))}</span>
        <input
          type="text"
          value={text}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
      </label>
      <p className="small muted">
        {Lz(
          L(
            'Dùng “->” hoặc “=” giữa hai vế, “ + ” (có dấu cách) giữa các chất. Điện tích: Fe^3+, SO4^2-, NH4+, OH-; electron: e-. Ngoặc: Ca(OH)2, K4[Fe(CN)6]; ngậm nước: CuSO4·5H2O.',
            'Use “->” or “=” between the sides and “ + ” (with spaces) between species. Charges: Fe^3+, SO4^2-, NH4+, OH-; electron: e-. Brackets: Ca(OH)2, K4[Fe(CN)6]; hydrates: CuSO4·5H2O.',
          ),
        )}
      </p>
      <div className="mol-chips" role="group" aria-label={Lz(L('Ví dụ', 'Examples'))}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            aria-pressed={ex === text}
            onClick={() => {
              setText(ex);
            }}
          >
            {ex}
          </button>
        ))}
      </div>
      {outcome.kind === 'error' && (
        <p className="chem-note chem-note--warn" role="alert">
          <CircleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>
            {Lz(L('Không đọc được phương trình: ', 'Cannot read the equation: '))}
            {outcome.message}
          </span>
        </p>
      )}
      {outcome.kind === 'result' && <ResultView eq={outcome.eq} result={outcome.result} />}
    </div>
  );
}

function ResultView({ eq, result }: { eq: ParsedEquation; result: BalanceResult }) {
  const Lz = useLocalized();
  const species = [...eq.reactants, ...eq.products];
  const match = matchLibrary(species.map((s) => s.text));
  if (result.kind !== 'balanced') {
    return (
      <p className="chem-note chem-note--warn" role="alert">
        <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
        <span>
          {result.kind === 'ambiguous'
            ? Lz(
                L(
                  `Có vô số cách cân bằng (không gian nghiệm ${result.dimension} chiều): phương trình gộp nhiều phản ứng độc lập. Hãy tách thành từng phản ứng.`,
                  `Infinitely many balancings (${result.dimension}-dimensional solution space): the equation mixes independent reactions. Split it into separate reactions.`,
                ),
              )
            : Lz(
                L(
                  'Không thể cân bằng: không có bộ hệ số dương nào bảo toàn được mọi nguyên tố và điện tích. Kiểm tra lại công thức các chất.',
                  'Cannot be balanced: no positive coefficients conserve every element and the charge. Check the formulas.',
                ),
              )}
        </span>
      </p>
    );
  }
  const c = result.coefficients;
  const side = (list: typeof eq.reactants, offset: number) =>
    list
      .map(
        (s, i) =>
          `${(c[offset + i] ?? 1) > 1 ? String(c[offset + i]) : ''}${formatFormula(s.text)}`,
      )
      .join(' + ');
  const { rows, labels } = conservationMatrix(eq);
  const given = species.every((s) => s.given !== null) ? species.map((s) => s.given ?? 0) : null;
  const givenOk = given
    ? given.every((g, i) => g === c[i]) ||
      given.every((g, i) => g * (c[0] ?? 1) === (c[i] ?? 0) * (given[0] ?? 1))
    : null;
  return (
    <>
      <p className="rx-eq rx-eq--big" aria-live="polite">
        {side(eq.reactants, 0)} {eq.reversible ? '⇌' : '→'} {side(eq.products, eq.reactants.length)}
      </p>
      {givenOk !== null && (
        <p className={givenOk ? 'small' : 'chem-note chem-note--warn'}>
          {givenOk
            ? Lz(L('Hệ số bạn nhập đúng.', 'Your coefficients are correct.'))
            : Lz(
                L(
                  'Hệ số bạn nhập chưa đúng; hệ số đúng ở trên.',
                  'Your coefficients are wrong; the correct ones are above.',
                ),
              )}
        </p>
      )}
      <table className="chem-table rx-table">
        <caption className="econf__label">
          {Lz(L('Kiểm tra bảo toàn', 'Conservation check'))}
        </caption>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col" className="num">
              {Lz(L('Vế trái', 'Left'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Vế phải', 'Right'))}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, k) => {
            const left = row
              .slice(0, eq.reactants.length)
              .reduce((s, a, i) => s + a * (c[i] ?? 0), 0);
            const right = -row
              .slice(eq.reactants.length)
              .reduce((s, a, i) => s + a * (c[eq.reactants.length + i] ?? 0), 0);
            const label = labels[k] ?? '';
            return (
              <tr key={label}>
                <th scope="row">{label === 'charge' ? Lz(L('Điện tích', 'Charge')) : label}</th>
                <td className="num">{left}</td>
                <td className="num">{right}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {match ? (
        <p className="chem-note" role="note">
          <BookCheck size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>
            {Lz(L('Có trong thư viện đã kiểm chứng: ', 'In the verified library: '))}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                selectReaction(match.id);
                void openTopic('reactionLibrary');
              }}
            >
              {Lz(match.name)}
            </button>
          </span>
        </p>
      ) : (
        <p className="chem-note chem-note--warn" role="note">
          <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>
            {Lz(
              L(
                'Phản ứng này chưa có trong cơ sở dữ liệu đã kiểm chứng — không hiển thị cơ chế. Cân bằng được không có nghĩa là phản ứng xảy ra thật.',
                'This reaction is not in the verified database — no mechanism is shown. Being balanceable does not mean the reaction really happens.',
              ),
            )}
          </span>
        </p>
      )}
    </>
  );
}
