import { BookOpen, TriangleAlert } from 'lucide-react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { lessonsForTopic, openLesson } from '@/studio/lessons';
import { L, usePublishCard } from '../common';
import { nistEnthalpy } from '../data/enthalpy';
import { EquationText } from '../reaction/Equation';
import { HYDROGEN_HALIDES_CARD } from './cards';
import { bondEnthalpyFromFormation, HALOGEN_ROWS, silverHalideReaction } from './halogens';
import { deg, num } from './format';
import { selectHalogen, useHalogenStore } from './store';
import '../chem.css';
import './halogen.css';

/** The Science Studio lesson on the AgNO₃ test for Cl⁻ (linked, not repeated here). */
const CHLORIDE_LESSON = 'chemistry.chloride-silver-nitrate';

const maxBond = Math.max(...HALOGEN_ROWS.map((r) => r.hx.bond_energy_kj_mol));

/** H–X bond energies (the book's Bảng 22.1) and the acid-strength trend, then the halide tests. */
export function HydrogenHalideStage() {
  usePublishCard(HYDROGEN_HALIDES_CARD);
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const z = useHalogenStore((s) => s.z);
  const lesson = lessonsForTopic('reactionLibrary', []).find((s) => s.id === CHLORIDE_LESSON);
  return (
    <div className="chem-view">
      <h3 className="hh10-title">
        {Lz(L('Năng lượng liên kết H–X (SGK Bảng 22.1)', 'H–X bond energy (SGK Bảng 22.1)'))}
      </h3>
      <ul className="hal-bars" aria-label={Lz(L('Năng lượng liên kết H–X', 'H–X bond energy'))}>
        {HALOGEN_ROWS.map((r) => (
          <li key={r.z} className={r.z === z ? 'is-active' : undefined}>
            <span className="hal-bars__name">{r.hx.formula}</span>
            <span className="hal-bars__track" aria-hidden="true">
              <span
                className="hal-bars__fill"
                style={{ width: `${String((100 * r.hx.bond_energy_kj_mol) / maxBond)}%` }}
              />
            </span>
            <span className="hal-bars__value mono">
              {num(locale, r.hx.bond_energy_kj_mol)} kJ/mol
            </span>
          </li>
        ))}
      </ul>
      <p className="hal-acid">
        <span>HF ({Lz(L('acid yếu', 'weak acid'))})</span>
        <span className="hal-acid__bar" aria-hidden="true" />
        <span>HI ({Lz(L('acid rất mạnh', 'very strong acid'))})</span>
      </p>
      <p className="small">
        {Lz(
          L(
            'Trong dãy hydrohalic acid, tính acid tăng từ hydrofluoric acid (yếu) đến hydroiodic acid (rất mạnh) (SGK tr. 113). Năng lượng liên kết H–X giảm từ HF đến HI: liên kết càng kém bền thì phân tử càng dễ phân li ra H⁺ trong nước.',
            'Along the hydrohalic acids, acid strength rises from hydrofluoric acid (weak) to hydroiodic acid (very strong) (SGK p. 113). The H–X bond energy falls from HF to HI: the weaker the bond, the more easily the molecule gives H⁺ in water.',
          ),
        )}
      </p>
      <h4 className="hal-head">
        {Lz(L('Nhận biết ion halide bằng dung dịch AgNO₃', 'Testing halide ions with AgNO₃'))}
      </h4>
      <ul className="hal-tests">
        {HALOGEN_ROWS.map((r) => {
          const rx = silverHalideReaction(r.symbol);
          return (
            <li key={r.z}>
              <strong>{r.symbol}⁻</strong>
              {rx ? (
                <span>
                  <EquationText r={rx} className="rx-eq--chip" />
                  <span className="small">{Lz(rx.observation)}</span>
                  {lesson && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        openLesson(lesson);
                      }}
                    >
                      <BookOpen size={15} strokeWidth={1.75} aria-hidden="true" />
                      {Lz(
                        L(
                          'Làm thí nghiệm trong Science Studio',
                          'Do the experiment in Science Studio',
                        ),
                      )}
                    </button>
                  )}
                </span>
              ) : (
                <span className="chem-note chem-note--warn">
                  <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
                  {Lz(
                    L(
                      `Phản ứng của AgNO₃ với Na${r.symbol} chưa có trong cơ sở dữ liệu đã kiểm chứng.`,
                      `AgNO₃ with Na${r.symbol} is not in the verified database.`,
                    ),
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The selected HX; in Advanced mode, the Hess cross-check of its bond energy. */
export function HydrogenHalidePanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const z = useHalogenStore((s) => s.z);
  const r = HALOGEN_ROWS.find((x) => x.z === z);
  const hess = r ? bondEnthalpyFromFormation(r.symbol) : undefined;
  const h = nistEnthalpy('H', 'g');
  const x = r ? nistEnthalpy(r.symbol, 'g') : undefined;
  const hx = r ? nistEnthalpy(r.hx.formula, 'g') : undefined;
  return (
    <div className="chem-form">
      <label>
        <span>{Lz(L('Hydrogen halide', 'Hydrogen halide'))}</span>
        <select
          value={z}
          onChange={(e) => {
            selectHalogen(Number(e.target.value));
          }}
        >
          {HALOGEN_ROWS.map((row) => (
            <option key={row.z} value={row.z}>
              {row.hx.formula}
            </option>
          ))}
        </select>
      </label>
      {r && (
        <dl className="hal-facts">
          <dt>{Lz(L('Độ dài liên kết (SGK)', 'Bond length (SGK)'))}</dt>
          <dd>{num(locale, r.hx.bond_length_pm)} pm</dd>
          <dt>{Lz(L('Năng lượng liên kết (SGK)', 'Bond energy (SGK)'))}</dt>
          <dd>{num(locale, r.hx.bond_energy_kj_mol)} kJ/mol</dd>
          <dt>{Lz(L('Nhiệt độ sôi (SGK)', 'Boiling point (SGK)'))}</dt>
          <dd>{deg(locale, r.hx.boiling_c)} °C</dd>
        </dl>
      )}
      {advanced &&
        r &&
        hess !== undefined &&
        h !== undefined &&
        x !== undefined &&
        hx !== undefined && (
          <p className="small muted">
            {Lz(
              L(
                `Đối chiếu (định luật Hess, NIST CODATA): ${num(locale, h, 6)} + ${num(locale, x, 6)} − (${num(locale, hx, 5)}) = ${num(locale, hess, 6)} kJ/mol.`,
                `Cross-check (Hess’s law, NIST CODATA): ${num(locale, h, 6)} + ${num(locale, x, 6)} − (${num(locale, hx, 5)}) = ${num(locale, hess, 6)} kJ/mol.`,
              ),
            )}
          </p>
        )}
    </div>
  );
}

/** The book's Bảng 22.1 and 22.2; Advanced adds the Hess cross-check. */
export function HydrogenHalideBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const z = useHalogenStore((s) => s.z);
  return (
    <table className="chem-table">
      <thead>
        <tr>
          <th scope="col">{Lz(L('Phân tử', 'Molecule'))}</th>
          <th scope="col">{Lz(L('Độ dài liên kết (pm)', 'Bond length (pm)'))}</th>
          <th scope="col">{Lz(L('Năng lượng liên kết (kJ/mol)', 'Bond energy (kJ/mol)'))}</th>
          <th scope="col">{Lz(L('Nhiệt độ sôi (°C)', 'Boiling point (°C)'))}</th>
          {advanced && (
            <th scope="col">{Lz(L('Hess, NIST (đối chiếu)', 'Hess, NIST (cross-check)'))}</th>
          )}
        </tr>
      </thead>
      <tbody>
        {HALOGEN_ROWS.map((r) => {
          const hess = bondEnthalpyFromFormation(r.symbol);
          return (
            <tr key={r.z} className={r.z === z ? 'is-active' : undefined}>
              <th scope="row">{r.hx.formula}</th>
              <td className="num">{num(locale, r.hx.bond_length_pm)}</td>
              <td className="num">{num(locale, r.hx.bond_energy_kj_mol)}</td>
              <td className="num">{deg(locale, r.hx.boiling_c)}</td>
              {advanced && (
                <td className="num">{hess === undefined ? '—' : num(locale, hess, 6)}</td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
