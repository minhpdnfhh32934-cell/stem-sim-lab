import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useFmt } from '@/biology/fmt';
import type { LocalizedText } from '@/core/data/dataset';
import { SliderField } from '@/ui/SliderField';
import { L, usePublishCard } from '../common';
import { superscript } from '../data/elements';
import { COMPOSITION_CARD } from './cards';
import {
  atomKind,
  composition,
  electronRange,
  notation,
  N_MAX,
  PARTICLES,
  Z_MAX,
  Z_MIN,
  type AtomKind,
  type Composition,
  type ParticleKind,
} from './composition';
import { electronDots, ELECTRON_R, NUCLEON_R, nucleons } from './picture';
import { setComposition, useCompositionStore } from './store';
import '../chem.css';
import './nuclide.css';

const NOT_TO_SCALE = L('Hình minh họa, không theo tỉ lệ', 'Illustration, not to scale');

const PARTICLE_NAME: Record<ParticleKind, LocalizedText> = {
  proton: L('Proton', 'Proton'),
  neutron: L('Neutron', 'Neutron'),
  electron: L('Electron', 'Electron'),
};

const KIND_NAME: Record<AtomKind, LocalizedText> = {
  neutral: L('nguyên tử trung hòa', 'neutral atom'),
  cation: L('ion dương (cation)', 'positive ion (cation)'),
  anion: L('ion âm (anion)', 'negative ion (anion)'),
};

function useComposition(): Composition {
  const { z, n, electrons } = useCompositionStore();
  return useMemo(() => composition(z, n, electrons), [z, n, electrons]);
}

/** "Na — Sodium (natri)": the data table's name, with the Vietnamese one in Vietnamese. */
function useElementName(c: Composition): string {
  const locale = useSettingsStore((s) => s.locale);
  const alias = locale === 'vi' ? c.element.aliases_vi[0] : undefined;
  return `${c.element.symbol} — ${c.element.name}${alias ? ` (${alias})` : ''}`;
}

/** The atom drawn as an illustration: nucleons in a disc, electrons as dots around it. */
export function CompositionStage() {
  usePublishCard(COMPOSITION_CARD);
  const Lz = useLocalized();
  const c = useComposition();
  const name = useElementName(c);
  const { protons, neutrons } = useMemo(() => nucleons(c.z, c.n), [c.z, c.n]);
  const dots = useMemo(() => electronDots(c.electrons, c.a), [c.electrons, c.a]);
  const label = Lz(
    L(
      `Hình minh họa: ${c.z} proton, ${c.n} neutron, ${c.electrons} electron`,
      `Illustration: ${c.z} protons, ${c.n} neutrons, ${c.electrons} electrons`,
    ),
  );
  return (
    <div className="chem-view chem-view--flush">
      <svg className="atom-pic" viewBox="-100 -100 200 200" role="img" aria-label={label}>
        {neutrons.map((d, i) => (
          <circle key={`n${i}`} className="atom-pic__neutron" cx={d.x} cy={d.y} r={NUCLEON_R} />
        ))}
        {protons.map((d, i) => (
          <g key={`p${i}`} transform={`translate(${d.x} ${d.y})`}>
            <circle className="atom-pic__proton" r={NUCLEON_R} />
            <path className="atom-pic__plus" d="M-2.6 0H2.6M0 -2.6V2.6" />
          </g>
        ))}
        {dots.map((d, i) => (
          <circle key={`e${i}`} className="atom-pic__electron" cx={d.x} cy={d.y} r={ELECTRON_R} />
        ))}
      </svg>
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong>{notation(c)}</strong> {name}
        </span>
        <span className="chem-chip">
          {PARTICLES.map((k) => (
            <span key={k} className="atom-legend">
              <span className={`atom-legend__dot atom-legend__dot--${k}`} aria-hidden="true" />
              {Lz(PARTICLE_NAME[k])}
            </span>
          ))}
        </span>
        <span className="chem-chip chem-chip--approx">{Lz(NOT_TO_SCALE)}</span>
      </div>
    </div>
  );
}

/** Z, N, electrons, and what follows from them: element, A, charge, mass share, sizes. */
export function CompositionPanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const fmt = useFmt();
  const c = useComposition();
  const name = useElementName(c);
  const [eMin, eMax] = electronRange(c.z);
  const charge = c.charge === 0 ? '0' : `${c.charge > 0 ? '+' : '−'}${Math.abs(c.charge)}`;
  const pct = formatNumber(locale, c.nucleusShare * 100, { maximumFractionDigits: 3 });
  // "≈ 2,6 × 10⁴": two significant digits, the exponent taken after rounding (9,96 → 10).
  const ratio = c.sizeRatio === null ? null : Number(c.sizeRatio.toPrecision(2));
  const exponent = ratio === null ? 0 : Math.floor(Math.log10(ratio));
  return (
    <div className="chem-form atom-panel">
      <SliderField
        label={Lz(L('Số proton Z', 'Protons Z'))}
        value={c.z}
        min={Z_MIN}
        max={Z_MAX}
        step={1}
        onChange={(z) => {
          setComposition({ z });
        }}
      />
      <SliderField
        label={Lz(L('Số neutron N', 'Neutrons N'))}
        value={c.n}
        min={0}
        max={N_MAX}
        step={1}
        onChange={(n) => {
          setComposition({ n });
        }}
      />
      <SliderField
        label={Lz(L('Số electron', 'Electrons'))}
        value={c.electrons}
        min={eMin}
        max={eMax}
        step={1}
        onChange={(electrons) => {
          setComposition({ electrons });
        }}
      />
      <dl className="atom-facts">
        <dt>{Lz(L('Nguyên tố (theo Z)', 'Element (from Z)'))}</dt>
        <dd>{name}</dd>
        <dt>{Lz(L('Số khối A = Z + N', 'Mass number A = Z + N'))}</dt>
        <dd className="mono">{c.a}</dd>
        <dt>{Lz(L('Điện tích', 'Charge'))}</dt>
        <dd>
          <span className="mono">{charge}</span> · {Lz(KIND_NAME[atomKind(c.charge)])} ·{' '}
          {notation(c)}
        </dd>
        <dt>{Lz(L('Khối lượng nằm ở hạt nhân', 'Mass in the nucleus'))}</dt>
        <dd className="mono">{pct} %</dd>
        <dt>{Lz(L('Bán kính hạt nhân R = r₀·A^(1/3)', 'Nuclear radius R = r₀·A^(1/3)'))}</dt>
        <dd className="mono">≈ {fmt(c.nucleusRadiusFm, 2)} fm</dd>
        <dt>{Lz(L('Bán kính nguyên tử (cộng hóa trị)', 'Atomic radius (covalent)'))}</dt>
        <dd className="mono">{c.atomRadiusPm === null ? '—' : `${fmt(c.atomRadiusPm, 3)} pm`}</dd>
        <dt>{Lz(L('Nguyên tử lớn hơn hạt nhân', 'The atom is larger than the nucleus'))}</dt>
        <dd>
          {ratio === null ? (
            '—'
          ) : (
            <>
              <span className="mono">
                ≈ {formatNumber(locale, ratio / 10 ** exponent)} × 10{superscript(exponent)}
              </span>{' '}
              {Lz(L('lần', 'times'))}
            </>
          )}
        </dd>
      </dl>
      <p className="small muted">
        {Lz(
          L(
            '1 fm = 10⁻¹⁵ m, 1 pm = 10⁻¹² m. Bán kính hạt nhân là công thức gần đúng: chỉ tin cỡ độ lớn.',
            '1 fm = 10⁻¹⁵ m, 1 pm = 10⁻¹² m. The nuclear radius is an approximate formula: trust only its order of magnitude.',
          ),
        )}
      </p>
    </div>
  );
}

/** The particles' masses (kg and u), their sum, and the real atom's mass when it is known. */
export function CompositionBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const fmt = useFmt();
  const c = useComposition();
  const u = (v: number, digits = 7) =>
    `${formatNumber(locale, v, { maximumSignificantDigits: digits })} u`;
  const kg = (v: number, digits = 5) => `${fmt(v, digits)} kg`;
  const neutral = notation({ ...c, charge: 0 });
  return (
    <div className="atom-bottom">
      <table className="chem-table">
        <thead>
          <tr>
            <th scope="col">{Lz(L('Hạt', 'Particle'))}</th>
            <th scope="col">{Lz(L('Số hạt', 'Count'))}</th>
            {/* Basic mode: the totals only (the single-particle constants are on the card). */}
            {advanced && <th scope="col">{Lz(L('1 hạt (kg)', 'One (kg)'))}</th>}
            {advanced && <th scope="col">{Lz(L('1 hạt (u)', 'One (u)'))}</th>}
            <th scope="col">{Lz(L('Tổng (kg)', 'Total (kg)'))}</th>
            <th scope="col">{Lz(L('Tổng (u)', 'Total (u)'))}</th>
          </tr>
        </thead>
        <tbody>
          {PARTICLES.map((k) => {
            const m = c.masses[k];
            return (
              <tr key={k}>
                <th scope="row">{Lz(PARTICLE_NAME[k])}</th>
                <td className="num">{m.count}</td>
                {advanced && <td className="num">{kg(m.eachKg, 6)}</td>}
                {advanced && <td className="num">{u(m.eachU, 10)}</td>}
                <td className="num">{kg(m.totalKg)}</td>
                <td className="num">{u(m.totalU)}</td>
              </tr>
            );
          })}
          <tr className="is-active">
            <th scope="row">{Lz(L('Tổng các hạt', 'All particles'))}</th>
            <td className="num">{c.z + c.n + c.electrons}</td>
            {advanced && <td />}
            {advanced && <td />}
            <td className="num">{kg(c.totalKg)}</td>
            <td className="num">{u(c.totalU)}</td>
          </tr>
        </tbody>
      </table>
      {c.nuclide && c.massDefectU !== null ? (
        <p className="atom-defect">
          {Lz(
            L(
              `Khối lượng thực của nguyên tử ${neutral} (trung hòa, bảng đồng vị): ${u(c.nuclide.mass_u, 10)}. Tổng khối lượng các hạt của nguyên tử trung hòa lớn hơn ${fmt(c.massDefectU, 4)} u, chỉ bằng ${fmt((100 * c.massDefectU) / c.nuclide.mass_u, 2)} % khối lượng nguyên tử. ${c.a === 1 ? '¹H không có liên kết hạt nhân (một nucleon): phần chênh lệch này là năng lượng liên kết của electron (khoảng 13,6 eV).' : 'Đó là độ hụt khối, do năng lượng liên kết hạt nhân.'}`,
              `Real mass of the ${neutral} atom (neutral, isotope table): ${u(c.nuclide.mass_u, 10)}. The particles of the neutral atom add up to ${fmt(c.massDefectU, 4)} u more, only ${fmt((100 * c.massDefectU) / c.nuclide.mass_u, 2)} % of the atom’s mass. ${c.a === 1 ? '¹H has no nuclear binding (one nucleon): this difference is the electron’s binding energy (about 13.6 eV).' : 'That is the mass defect, from the nuclear binding energy.'}`,
            ),
          )}
        </p>
      ) : (
        <p className="atom-defect muted">
          {Lz(
            L(
              `${neutral} không có trong bảng đồng vị tự nhiên: chưa có khối lượng thực để so sánh.`,
              `${neutral} is not in the table of natural isotopes: there is no real mass to compare with.`,
            ),
          )}
        </p>
      )}
    </div>
  );
}
