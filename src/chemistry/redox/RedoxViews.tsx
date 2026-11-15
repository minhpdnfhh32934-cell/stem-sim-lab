import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { EquationError, parseEquation } from '../balance';
import { L, usePublishCard } from '../common';
import { matchLibrary, reactionById, REACTIONS } from '../data/reactions';
import { formatFormula } from '../formula';
import { REDOX_CARD } from './card';
import { OxFormula } from './OxFormula';
import type { OxNote, OxRefusal, OxResult } from './oxidation';
import { analyzeRedox, moleculeAtoms, type Change, type RedoxAnalysis } from './redox';
import { selectRedoxReaction, useRedoxStore } from './store';
import '../chem.css';
import './redox.css';

const NOT_IN_LIBRARY = L(
  'Phản ứng này chưa có trong cơ sở dữ liệu đã kiểm chứng — không phân tích số oxi hoá.',
  'This reaction is not in the verified database — no oxidation-number analysis.',
);

const REFUSAL: Record<OxRefusal, (els: string) => LocalizedText> = {
  twoUnknown: (els) =>
    L(
      `còn hai nguyên tố chưa biết (${els}): quy tắc không đủ để xác định`,
      `two unknown elements (${els}): the rules cannot decide`,
    ),
  organic: () =>
    L(
      'hợp chất hữu cơ nhiều nguyên tử C: mỗi nguyên tử C có số oxi hoá riêng, quy tắc chỉ cho giá trị trung bình',
      'organic compound with several C atoms: each C has its own oxidation number, the rules give only the mean',
    ),
  mixed: (els) =>
    L(
      `${els} được viết ở hai nhóm nguyên tử: các nguyên tử có thể khác nhau, quy tắc chỉ cho giá trị trung bình`,
      `${els} is written in two groups of atoms: its atoms may differ, the rules give only the mean`,
    ),
  fractional: (els) =>
    L(
      `số oxi hoá của ${els} tính ra không nguyên: chỉ là giá trị trung bình`,
      `the oxidation number of ${els} is not a whole number: only a mean`,
    ),
  outOfRange: (els) =>
    L(
      `${els} sẽ vượt số oxi hoá cao nhất của nhóm: công thức có liên kết đặc biệt`,
      `${els} would exceed its group’s highest oxidation number: the formula hides an unusual bond`,
    ),
  inconsistent: () =>
    L('các quy tắc mâu thuẫn với công thức này', 'the rules contradict this formula'),
};

const NOTE: Record<OxNote, LocalizedText> = {
  peroxide: L('O là −1 (peroxide)', 'O is −1 (peroxide)'),
  hydride: L('H là −1 (liên kết với kim loại)', 'H is −1 (bonded to a metal)'),
  oxygenFluoride: L('O dương khi liên kết với F', 'O is positive with F'),
  halide: L(
    'Cl, Br, I là −1 trong hợp chất với kim loại',
    'Cl, Br, I are −1 in compounds with a metal',
  ),
};

/** Why a species is refused, in words. */
const refusalText = (ox: OxResult): LocalizedText | null =>
  ox.ok ? null : REFUSAL[ox.reason](ox.elements.join(', '));

/** Every library reaction with its verdict, computed once. */
const VERDICTS = REACTIONS.map((r) => ({ r, kind: analyzeRedox(r).kind }));

function useAnalysis(): { name: LocalizedText; analysis: RedoxAnalysis } | null {
  const id = useRedoxStore((s) => s.id);
  return useMemo(() => {
    const r = reactionById(id);
    return r ? { name: r.name, analysis: analyzeRedox(r) } : null;
  }, [id]);
}

const formulas = (list: string[]) => list.map(formatFormula).join(', ');

/** One process of the book's Bước 2, multiplied as in Bước 3 ("4 × N⁻³ → N⁺² + 5e"). */
function HalfEquation({ c }: { c: Change }) {
  const side = (species: string[], value: number) => {
    const values = new Map([[c.el, value]]);
    const [molecule] = species;
    if (molecule && c.unit > 1 && moleculeAtoms(species) === c.unit)
      return <OxFormula formula={molecule} values={values} />;
    return <OxFormula formula={c.el} values={values} coef={c.unit} />;
  };
  const e = `${String(Math.abs(c.to - c.from) * c.unit)}e`;
  const oxidation = c.to > c.from;
  return (
    <p className="redox-half">
      <span className="redox-half__times">{c.multiplier} ×</span>
      {side(c.fromSpecies, c.from)}
      {!oxidation && <span>+ {e}</span>}
      <span>→</span>
      {side(c.toSpecies, c.to)}
      {oxidation && <span>+ {e}</span>}
    </p>
  );
}

function Verdict({ analysis }: { analysis: RedoxAnalysis }) {
  const Lz = useLocalized();
  if (analysis.kind === 'notRedox')
    return (
      <p className="chem-note" role="note">
        {Lz(
          L(
            'Không có nguyên tố nào thay đổi số oxi hoá: đây không phải phản ứng oxi hoá – khử.',
            'No element changes its oxidation number: this is not a redox reaction.',
          ),
        )}
      </p>
    );
  if (analysis.kind === 'undecided')
    return (
      <div className="chem-note chem-note--warn" role="note">
        <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
        <div>
          <p>
            {Lz(
              L(
                'Quy tắc xác định số oxi hoá chưa đủ cho:',
                'The oxidation-number rules are not enough for:',
              ),
            )}
          </p>
          <ul>
            {analysis.refused.map((s) => {
              const why = refusalText(s.ox);
              return (
                <li key={s.formula}>
                  {formatFormula(s.formula)}: {why ? Lz(why) : ''}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  if (analysis.kind === 'ambiguous')
    return (
      <p className="chem-note chem-note--warn" role="note">
        {Lz(
          L(
            `${analysis.elements.join(', ')} có nhiều số oxi hoá ở cả hai vế: không ghép được nguyên tử nào thay đổi.`,
            `${analysis.elements.join(', ')} has several oxidation numbers on both sides: the changing atoms cannot be paired.`,
          ),
        )}
      </p>
    );
  return (
    <dl className="redox-facts">
      <dt>{Lz(L('Chất khử (chất nhường electron)', 'Reducing agent (gives electrons)'))}</dt>
      <dd>{formulas(analysis.reducingAgents)}</dd>
      <dt>{Lz(L('Chất oxi hoá (chất nhận electron)', 'Oxidising agent (takes electrons)'))}</dt>
      <dd>{formulas(analysis.oxidisingAgents)}</dd>
      <dt>{Lz(L('Quá trình oxi hoá', 'Oxidation'))}</dt>
      <dd>
        {analysis.oxidised.map((c) => (
          <HalfEquation key={`${c.el}${String(c.from)}`} c={c} />
        ))}
      </dd>
      <dt>{Lz(L('Quá trình khử', 'Reduction'))}</dt>
      <dd>
        {analysis.reduced.map((c) => (
          <HalfEquation key={`${c.el}${String(c.from)}`} c={c} />
        ))}
      </dd>
      <dt>{Lz(L('Electron trao đổi', 'Electrons transferred'))}</dt>
      <dd>
        {Lz(
          L(
            `Trong phương trình đã cân bằng: tổng số electron chất khử nhường = tổng số electron chất oxi hoá nhận = ${String(analysis.electrons)}`,
            `In the balanced equation: electrons given by the reducing agent = electrons taken by the oxidising agent = ${String(analysis.electrons)}`,
          ),
        )}
      </dd>
    </dl>
  );
}

/** The balanced equation with every oxidation number written above its symbol. */
export function RedoxStage() {
  usePublishCard(REDOX_CARD);
  const Lz = useLocalized();
  const sel = useAnalysis();
  if (!sel) return null;
  const { species } = sel.analysis;
  const side = (which: 'reactant' | 'product') =>
    species
      .filter((s) => s.side === which)
      .map((s, i) => (
        <span key={s.formula} className="redox-eq">
          {i > 0 && <span className="rx-eq__plus">+</span>}
          <OxFormula formula={s.formula} values={s.ox.ok ? s.ox.values : undefined} coef={s.coef} />
        </span>
      ));
  return (
    <div className="chem-view">
      <h3 className="hh10-title">{Lz(sel.name)}</h3>
      <div
        className="rx-eq rx-eq--big redox-eq"
        role="group"
        aria-label={Lz(L('Phương trình và số oxi hoá', 'Equation and oxidation numbers'))}
      >
        {side('reactant')}
        <span className="rx-eq__arrow">→</span>
        {side('product')}
      </div>
      {sel.analysis.coefficientsBy === 'library' && (
        <p className="small muted">
          {Lz(
            L(
              'Hệ số lấy từ thư viện (bộ cân bằng tìm được nhiều cách cân bằng độc lập).',
              'Coefficients from the library (the balancer finds several independent balancings).',
            ),
          )}
        </p>
      )}
      <Verdict analysis={sel.analysis} />
    </div>
  );
}

const GROUP: Record<RedoxAnalysis['kind'], LocalizedText> = {
  redox: L('Phản ứng oxi hoá – khử', 'Redox reactions'),
  notRedox: L('Không phải oxi hoá – khử', 'Not redox'),
  undecided: L('Quy tắc chưa đủ để xác định', 'Rules not enough to decide'),
  ambiguous: L('Không ghép được nguyên tử', 'Atoms cannot be paired'),
};

/** Choice of a library reaction; in Advanced mode, an equation typed to find it. */
export function RedoxPanel() {
  const Lz = useLocalized();
  const id = useRedoxStore((s) => s.id);
  const equation = useRedoxStore((s) => s.equation);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const lookup = useMemo(() => {
    if (!equation.trim()) return null;
    try {
      const eq = parseEquation(equation);
      const m = matchLibrary(
        eq.reactants.map((s) => s.text),
        eq.products.map((s) => s.text),
      );
      // The exact reverse of a reversible library reaction is in the library too (as the
      // balancer says); the analysis shown is the forward direction's.
      return m?.exact ? { found: m.reaction, reverse: m.reverse } : { found: null };
    } catch (e) {
      return { error: e instanceof EquationError ? e.message : String(e) };
    }
  }, [equation]);
  const kinds = ['redox', 'notRedox', 'undecided', 'ambiguous'] as const;
  return (
    <div className="chem-form">
      <label>
        <span>{Lz(L('Phản ứng', 'Reaction'))}</span>
        <select
          value={id}
          onChange={(e) => {
            selectRedoxReaction(e.target.value);
          }}
        >
          {kinds.map((k) => {
            const list = VERDICTS.filter((v) => v.kind === k);
            return list.length ? (
              <optgroup key={k} label={Lz(GROUP[k])}>
                {list.map(({ r }) => (
                  <option key={r.id} value={r.id}>
                    {Lz(r.name)}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>
      {advanced && (
        <>
          <label>
            <span>{Lz(L('Tìm phương trình', 'Find an equation'))}</span>
            <input
              type="text"
              value={equation}
              spellCheck={false}
              onChange={(e) => {
                const text = e.target.value;
                useRedoxStore.setState({ equation: text });
              }}
            />
          </label>
          {lookup && 'error' in lookup && (
            <p className="chem-note chem-note--warn" role="alert">
              {Lz(L('Không đọc được phương trình: ', 'Cannot read the equation: '))}
              {lookup.error}
            </p>
          )}
          {lookup && 'found' in lookup && lookup.found === null && (
            <p className="chem-note chem-note--warn" role="note">
              <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>{Lz(NOT_IN_LIBRARY)}</span>
            </p>
          )}
          {lookup && 'found' in lookup && lookup.found && lookup.reverse && (
            <p className="chem-note" role="note">
              {Lz(
                L(
                  `Có trong thư viện: chiều nghịch của phản ứng thuận nghịch “${lookup.found.name.vi}”. Số oxi hoá được phân tích cho chiều thuận.`,
                  `In the library: the reverse of the reversible reaction “${lookup.found.name.en}”. The oxidation numbers are analysed for the forward direction.`,
                ),
              )}
            </p>
          )}
          {lookup && 'found' in lookup && lookup.found && lookup.found.id !== id && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (lookup.found) selectRedoxReaction(lookup.found.id);
              }}
            >
              {Lz(L('Mở phản ứng này', 'Open this reaction'))}
            </button>
          )}
        </>
      )}
      <p className="small muted">
        {Lz(
          L(
            'Dấu hiệu nhận biết phản ứng oxi hoá – khử: có sự thay đổi số oxi hoá của các nguyên tử (SGK tr. 74).',
            'A redox reaction is recognised by a change in the atoms’ oxidation numbers (SGK p. 74).',
          ),
        )}
      </p>
    </div>
  );
}

/** Every species: its oxidation numbers, the exception used, or why the rules stop. */
export function RedoxBottom() {
  const Lz = useLocalized();
  const sel = useAnalysis();
  if (!sel) return null;
  return (
    <table className="chem-table">
      <thead>
        <tr>
          <th scope="col">{Lz(L('Chất', 'Species'))}</th>
          <th scope="col">{Lz(L('Hệ số', 'Coefficient'))}</th>
          <th scope="col">{Lz(L('Số oxi hoá', 'Oxidation numbers'))}</th>
          <th scope="col">{Lz(L('Ghi chú', 'Note'))}</th>
        </tr>
      </thead>
      <tbody>
        {sel.analysis.species.map((s) => {
          const why = refusalText(s.ox);
          return (
            <tr key={`${s.side}${s.formula}`}>
              <th scope="row">{formatFormula(s.formula)}</th>
              <td className="num">{s.coef}</td>
              <td>
                <OxFormula formula={s.formula} values={s.ox.ok ? s.ox.values : undefined} />
              </td>
              <td>
                {s.ox.ok ? s.ox.notes.map((n) => Lz(NOTE[n])).join('; ') : why ? Lz(why) : ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
