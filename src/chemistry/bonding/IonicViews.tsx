import { ArrowRight, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { openTopic } from '@/app/topics';
import { L, usePublishCard } from '../common';
import { selectCrystal } from '../crystal/store';
import { configString, electronsPerShell, type ElementData, type Subshell } from '../data/elements';
import { BOND_TYPE } from '../molecule/labels';
import { IONIC_CARD } from './cards';
import { ANIONS, CATIONS, ionConfiguration, ionicCompound, ionLabel } from './ionic';
import { useBondingStore } from './store';
import '../chem.css';
import './bonding.css';

function perShell(conf: readonly Subshell[]): number[] {
  const shells = Array.from({ length: Math.max(0, ...conf.map(([n]) => n)) }, () => 0);
  for (const [n, , k] of conf) shells[n - 1] = (shells[n - 1] ?? 0) + k;
  return shells;
}

/**
 * Electron shells as rings with their electrons (illustration of the configuration table).
 * `marked` electrons of the outer shell are drawn hollow: the ones that leave or arrive.
 */
function ShellDiagram({
  shells,
  marked,
  label,
}: {
  shells: number[];
  marked: number;
  label: string;
}) {
  const R0 = 16;
  const DR = 12;
  const size = 2 * (R0 + DR * shells.length) + 8;
  const c = size / 2;
  return (
    <svg
      className="shells"
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      role="img"
      aria-label={label}
    >
      <circle className="shells__core" cx={c} cy={c} r={7} />
      {shells.map((n, s) => {
        const r = R0 + DR * s;
        const outer = s === shells.length - 1;
        return (
          <g key={s}>
            <circle className="shells__ring" cx={c} cy={c} r={r} />
            {Array.from({ length: n }, (_, k) => {
              const a = (2 * Math.PI * k) / n - Math.PI / 2;
              const moving = outer && k >= n - marked;
              return (
                <circle
                  key={k}
                  className={moving ? 'shells__e shells__e--moving' : 'shells__e'}
                  cx={c + r * Math.cos(a)}
                  cy={c + r * Math.sin(a)}
                  r={3}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function IonColumn({ e, charge }: { e: ElementData; charge: number }) {
  const Lz = useLocalized();
  const ion = ionConfiguration(e, charge);
  const n = Math.abs(charge);
  const ionName = ionLabel(e.symbol, charge);
  const shellsAtom = electronsPerShell(e);
  const shellsIon = perShell(ion);
  const step =
    charge > 0
      ? `${e.symbol} → ${ionName} + ${String(n)}e`
      : `${e.symbol} + ${String(n)}e → ${ionName}`;
  return (
    <div className="ionic__col">
      <p className="ionic__step">{step}</p>
      <div className="ionic__pair">
        <ShellDiagram
          shells={shellsAtom}
          marked={charge > 0 ? n : 0}
          label={`${e.symbol} (${shellsAtom.join(', ')})`}
        />
        <ArrowRight size={18} aria-hidden="true" />
        <ShellDiagram
          shells={shellsIon}
          marked={charge < 0 ? n : 0}
          label={`${ionName} (${shellsIon.join(', ')})`}
        />
      </div>
      <p className="ionic__conf">
        {e.symbol}: {configString(e.configuration)}
      </p>
      <p className="ionic__conf">
        {ionName}: {configString(ion)}
      </p>
      <p className="small muted">
        {charge > 0
          ? Lz(L(`nhường ${String(n)} electron`, `gives ${String(n)} electron(s)`))
          : Lz(L(`nhận ${String(n)} electron`, `takes ${String(n)} electron(s)`))}
      </p>
    </div>
  );
}

function useCompound() {
  const metal = useBondingStore((s) => s.metal);
  const nonmetal = useBondingStore((s) => s.nonmetal);
  return useMemo(() => ionicCompound(metal, nonmetal), [metal, nonmetal]);
}

const signed = (n: number) => (n > 0 ? `+${String(n)}` : `−${String(-n)}`);

export function IonicStage() {
  const Lz = useLocalized();
  usePublishCard(IONIC_CARD);
  const k = useCompound();
  const balance = `${String(k.cations)} × (${signed(k.cationCharge)}) + ${String(k.anions)} × (${signed(k.anionCharge)}) = 0`;
  return (
    <div className="chem-view bond-view">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong>{k.formula}</strong>
        </span>
        <span className="chem-chip">
          {Lz(L('Hình minh họa các lớp electron', 'Illustration of the electron shells'))}
        </span>
      </div>
      <div className="ionic">
        <div className="ionic__row">
          <IonColumn e={k.metal} charge={k.cationCharge} />
          <IonColumn e={k.nonmetal} charge={k.anionCharge} />
        </div>
        <p className="ionic__balance" aria-label={Lz(L('Cân bằng điện tích', 'Charge balance'))}>
          {balance} → <strong>{k.formula}</strong>
        </p>
      </div>
    </div>
  );
}

export function IonicPanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const metal = useBondingStore((s) => s.metal);
  const nonmetal = useBondingStore((s) => s.nonmetal);
  const k = useCompound();
  const gas = (g: ElementData | null) =>
    g ? Lz(L(`giống khí hiếm ${g.symbol}`, `like the noble gas ${g.symbol}`)) : '—';
  return (
    <div className="chem-form">
      <label>
        <span>{Lz(L('Kim loại', 'Metal'))}</span>
        <select
          value={metal}
          onChange={(e) => {
            useBondingStore.setState({ metal: e.target.value });
          }}
        >
          {CATIONS.map((i) => (
            <option key={i.element} value={i.element}>
              {i.element} → {ionLabel(i.element, i.charge)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{Lz(L('Phi kim', 'Non-metal'))}</span>
        <select
          value={nonmetal}
          onChange={(e) => {
            useBondingStore.setState({ nonmetal: e.target.value });
          }}
        >
          {ANIONS.map((i) => (
            <option key={i.element} value={i.element}>
              {i.element} → {ionLabel(i.element, i.charge)}
            </option>
          ))}
        </select>
      </label>
      <table className="chem-table">
        <tbody>
          <tr>
            <th scope="row">{Lz(L('Ion dương', 'Cation'))}</th>
            <td className="num">
              {ionLabel(k.metal.symbol, k.cationCharge)} ({gas(k.cationGas)})
            </td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Ion âm', 'Anion'))}</th>
            <td className="num">
              {ionLabel(k.nonmetal.symbol, k.anionCharge)} ({gas(k.anionGas)})
            </td>
          </tr>
          <tr>
            <th scope="row">
              {Lz(L('Electron chuyển (mỗi công thức)', 'Electrons moved (per formula)'))}
            </th>
            <td className="num">{k.electrons}</td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Công thức', 'Formula'))}</th>
            <td className="num">
              <strong>{k.formula}</strong>
            </td>
          </tr>
          <tr>
            <th scope="row">|Δχ|</th>
            <td className="num">
              {k.deltaEn === null
                ? '—'
                : formatNumber(locale, k.deltaEn, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Loại liên kết (Bảng 12.1)', 'Bond type (Table 12.1)'))}</th>
            <td>{k.bondType ? Lz(BOND_TYPE[k.bondType]) : '—'}</td>
          </tr>
        </tbody>
      </table>
      {k.bondType && k.bondType !== 'ionic' && (
        <p className="chem-note chem-note--warn" role="note">
          <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>
            {Lz(
              L(
                'Hiệu độ âm điện nhỏ hơn 1,7: theo Bảng 12.1, liên kết này nghiêng về cộng hoá trị phân cực. Công thức ở đây chỉ là cân bằng điện tích của mô hình ion.',
                'The electronegativity difference is below 1.7: by Table 12.1 this bond leans to polar covalent. The formula here is only the charge balance of the ionic model.',
              ),
            )}
          </span>
        </p>
      )}
      <button
        type="button"
        className="btn"
        onClick={() => {
          selectCrystal('nacl');
          void openTopic('crystalStructure');
        }}
      >
        {Lz(L('Xem tinh thể NaCl', 'See the NaCl crystal'))}
      </button>
    </div>
  );
}
