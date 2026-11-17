import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { ChoiceGroup } from '@/ui/ModuleControls';
import { formatFormula } from '../formula';
import { SmilesPicture } from '../molecule/SmilesPicture';
import { AMINE_TITLE, L, amineCard } from './card';
import { AMINE_TABLE, amineIsomers, type Amine } from './model';
import { AMINE_TABS, isomerKey, setAmine, useAmineStore, type AmineTab } from './store';
import './amine.css';

const TAB_NAME: Record<AmineTab, LocalizedText> = {
  names: L('Tên gọi, đồng phân', 'Names and isomers'),
  properties: L('Tính chất', 'Properties'),
};
const DEGREE: Record<number, LocalizedText> = {
  1: L('bậc một', 'primary'),
  2: L('bậc hai', 'secondary'),
  3: L('bậc ba', 'tertiary'),
};

function useFmt() {
  const locale = useSettingsStore((s) => s.locale);
  return { locale, n: (v: number, d = 2) => formatNumber(locale, v, { maximumFractionDigits: d }) };
}

function useChosen(): { isomers: Amine[]; chosen: Amine } {
  const { n, pick } = useAmineStore();
  const isomers = useMemo(() => amineIsomers(n), [n]);
  const chosen = isomers.find((a) => isomerKey(a.groups) === pick) ?? isomers[0];
  if (!chosen) throw new Error('no amine');
  return { isomers, chosen };
}

function NamesView() {
  const Lz = useLocalized();
  const { n } = useAmineStore();
  const { isomers, chosen } = useChosen();
  const formula = formatFormula(`C${n === 1 ? '' : n}H${2 * n + 3}N`);
  return (
    <div className="amine-view">
      <div className="amine-main">
        <SmilesPicture
          smiles={chosen.smiles}
          caption={`${formatFormula(chosen.condensed)}: ${chosen.radicofunctional} · ${chosen.substitutive}`}
          className="amine-main__picture"
        />
      </div>
      <section aria-label={Lz(L('Các đồng phân amine', 'Amine isomers'))}>
        <h3 className="amine-view__head">
          {Lz(
            L(
              `Các amine có công thức ${formula}: ${isomers.length}`,
              `Amines of formula ${formula}: ${isomers.length}`,
            ),
          )}
        </h3>
        <div className="amine-isomers" role="list">
          {isomers.map((a) => (
            <div role="listitem" key={isomerKey(a.groups)}>
              <SmilesPicture
                smiles={a.smiles}
                caption={`${a.radicofunctional} (${Lz(DEGREE[a.degree] ?? L('', ''))})`}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PropertiesView() {
  const Lz = useLocalized();
  const { locale } = useFmt();
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      // Boiling points of Bảng 8.1 as bars, 0 °C marked.
      const left = 150;
      const top = 20;
      const rowH = Math.min(34, (height - top - 30) / AMINE_TABLE.length);
      const lo = -20;
      const hi = 200;
      const w = width - left - 60;
      const X = (t: number) => left + ((t - lo) / (hi - lo)) * w;
      ctx.font = '13px system-ui, sans-serif';
      AMINE_TABLE.forEach((a, i) => {
        const y = top + i * rowH;
        ctx.fillStyle = css('--text');
        ctx.textAlign = 'right';
        ctx.fillText(a.name, left - 8, y + rowH / 2 + 4);
        ctx.fillStyle = css(a.name === 'aniline' ? '--chart-4' : '--chart-1');
        const x0 = X(0);
        const x1 = X(a.bp_C);
        ctx.fillRect(Math.min(x0, x1), y + 4, Math.abs(x1 - x0), rowH - 8);
        ctx.fillStyle = css('--text');
        // A value below 0 °C is written right of the zero line, clear of the name column.
        ctx.textAlign = 'left';
        ctx.fillText(`${formatNumber(locale, a.bp_C)} °C`, Math.max(x0, x1) + 6, y + rowH / 2 + 4);
      });
      ctx.strokeStyle = css('--text-muted');
      ctx.beginPath();
      ctx.moveTo(X(0), top - 6);
      ctx.lineTo(X(0), top + rowH * AMINE_TABLE.length);
      ctx.stroke();
      ctx.fillStyle = css('--text-muted');
      ctx.textAlign = 'center';
      ctx.fillText('0 °C', X(0), top + rowH * AMINE_TABLE.length + 16);
    },
    false,
    [locale],
  );
  return (
    <div className="amine-view">
      <canvas
        ref={ref}
        className="amine-chart"
        role="img"
        aria-label={Lz(
          L(
            `Nhiệt độ sôi (Bảng 8.1): ${AMINE_TABLE.map((a) => `${a.name} ${formatNumber(locale, a.bp_C)} °C`).join(', ')}`,
            `Boiling points (Table 8.1): ${AMINE_TABLE.map((a) => `${a.name} ${formatNumber(locale, a.bp_C)} °C`).join(', ')}`,
          ),
        )}
      />
      <div className="amine-eqs">
        <p>
          {formatFormula('CH3NH2 + HCl')} → {formatFormula('CH3NH3Cl')}
        </p>
        <p>
          {formatFormula('FeCl3 + 3CH3NH2 + 3H2O')} → {formatFormula('Fe(OH)3 + 3CH3NH3Cl')}
        </p>
        <p>
          {formatFormula('CH3NH2 + HONO')} → {formatFormula('CH3OH + N2 + H2O')}
        </p>
        <p>
          {formatFormula('C6H5NH2 + 3Br2')} → {formatFormula('C6H2Br3NH2 + 3HBr')}
        </p>
      </div>
    </div>
  );
}

export function AmineStage() {
  const Lz = useLocalized();
  const tab = useAmineStore((s) => s.tab);
  const card = useMemo(() => amineCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view amine">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(AMINE_TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
      </div>
      {tab === 'names' ? <NamesView /> : <PropertiesView />}
    </div>
  );
}

function NamesPanel() {
  const Lz = useLocalized();
  const { n: fmt } = useFmt();
  const { n } = useAmineStore();
  const { isomers, chosen } = useChosen();
  return (
    <>
      <ChoiceGroup
        label={Lz(L('Số nguyên tử C', 'Carbon atoms'))}
        items={['1', '2', '3', '4'] as const}
        value={String(n) as '1' | '2' | '3' | '4'}
        name={(k) => formatFormula(`C${k === '1' ? '' : k}H${2 * Number(k) + 3}N`)}
        onPick={(k) => {
          setAmine({ n: Number(k) });
        }}
        segmented
      />
      <ChoiceGroup
        label={Lz(L('Đồng phân', 'Isomer'))}
        items={isomers.map((a) => isomerKey(a.groups))}
        value={isomerKey(chosen.groups)}
        name={(k) => isomers.find((a) => isomerKey(a.groups) === k)?.radicofunctional ?? k}
        onPick={(k) => {
          setAmine({ pick: k });
        }}
      />
      <dl className="amine-panel__facts">
        <dt>{Lz(L('Công thức thu gọn', 'Condensed formula'))}</dt>
        <dd className="mono">{formatFormula(chosen.condensed)}</dd>
        <dt>{Lz(L('Bậc amine', 'Degree'))}</dt>
        <dd>{Lz(DEGREE[chosen.degree] ?? L('', ''))}</dd>
        <dt>{Lz(L('Tên gốc – chức', 'Radicofunctional name'))}</dt>
        <dd className="amine-panel__radico">{chosen.radicofunctional}</dd>
        <dt>{Lz(L('Tên thay thế', 'Substitutive name'))}</dt>
        <dd className="amine-panel__subst">{chosen.substitutive}</dd>
        <dt>M</dt>
        <dd className="mono">{`${fmt(chosen.M)} g/mol`}</dd>
      </dl>
      <p className="small">
        {Lz(
          L(
            'Bậc amine là số gốc hydrocarbon liên kết với nguyên tử N. Tên thay thế dùng N làm chỉ số vị trí cho các gốc gắn trên nitrogen (tr. 36).',
            'The degree is the number of hydrocarbon groups on the N. Substitutive names use N as the locant of the groups on nitrogen (p. 36).',
          ),
        )}
      </p>
    </>
  );
}

function PropertiesPanel() {
  const Lz = useLocalized();
  return (
    <ul className="amine-panel__list">
      <li>
        {Lz(
          L(
            'Dung dịch alkylamine làm quỳ tím đổi màu xanh; dung dịch aniline không làm đổi màu quỳ tím.',
            'Alkylamine solutions turn litmus blue; aniline solution does not.',
          ),
        )}
      </li>
      <li>
        {Lz(
          L(
            'Methylamine, ethylamine tạo phức màu xanh lam với Cu(OH)₂.',
            'Methylamine and ethylamine form a deep blue complex with Cu(OH)₂.',
          ),
        )}
      </li>
      <li>
        {Lz(
          L(
            'Alkylamine bậc một tác dụng với nitrous acid ở nhiệt độ thường giải phóng khí N₂; aniline ở 0–5 °C tạo muối diazonium.',
            'Primary alkylamines release N₂ with nitrous acid at room temperature; aniline at 0–5 °C gives a diazonium salt.',
          ),
        )}
      </li>
      <li>
        {Lz(
          L(
            'Aniline tác dụng với nước bromine tạo kết tủa trắng 2,4,6-tribromoaniline.',
            'Aniline with bromine water gives a white precipitate of 2,4,6-tribromoaniline.',
          ),
        )}
      </li>
    </ul>
  );
}

export function AminePanel() {
  const Lz = useLocalized();
  const tab = useAmineStore((s) => s.tab);
  return (
    <div className="chem-form amine-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={AMINE_TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setAmine({ tab: t });
        }}
        segmented
      />
      {tab === 'names' ? <NamesPanel /> : <PropertiesPanel />}
    </div>
  );
}

export function AmineBottom() {
  const Lz = useLocalized();
  const { n } = useFmt();
  return (
    <table className="amine-table">
      <caption>{Lz(L('Bảng 8.1 (SGK)', 'Table 8.1 (textbook)'))}</caption>
      <thead>
        <tr>
          <th scope="col">Amine</th>
          <th scope="col">{Lz(L('Tên gọi', 'Name'))}</th>
          <th scope="col">{Lz(L('Nhiệt độ nóng chảy (°C)', 'Melting point (°C)'))}</th>
          <th scope="col">{Lz(L('Nhiệt độ sôi (°C)', 'Boiling point (°C)'))}</th>
        </tr>
      </thead>
      <tbody>
        {AMINE_TABLE.map((a) => (
          <tr key={a.formula}>
            <th scope="row">{formatFormula(a.formula)}</th>
            <td>{a.name}</td>
            <td className="mono">{n(a.mp_C, 1)}</td>
            <td className="mono">{n(a.bp_C, 1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
