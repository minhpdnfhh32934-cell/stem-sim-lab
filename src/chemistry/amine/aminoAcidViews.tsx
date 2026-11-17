import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { ActionRow, ChoiceGroup, LabeledNumber } from '@/ui/ModuleControls';
import { formatFormula } from '../formula';
import { SmilesPicture } from '../molecule/SmilesPicture';
import { AA_TITLE, L, aminoAcidCard } from './card';
import {
  AMINO_ACIDS,
  BOOK_PEPTIDES,
  GLYCINE_NEUTRAL_PH,
  aminoAcid,
  fragments,
  glycineMigration,
  peptide,
} from './model';
import {
  AA_TABS,
  MAX_RESIDUES,
  RESIDUES,
  setAminoAcid,
  useAminoAcidStore,
  type AaTab,
} from './store';
import './amine.css';

const TAB_NAME: Record<AaTab, LocalizedText> = {
  aminoAcids: L('Amino acid', 'Amino acids'),
  peptide: L('Peptide', 'Peptides'),
};
const MIGRATION: Record<ReturnType<typeof glycineMigration>, LocalizedText> = {
  cathode: L('Dạng cation, di chuyển về cực âm (−)', 'A cation, moving to the cathode (−)'),
  none: L('Ion lưỡng cực, hầu như không di chuyển', 'A zwitterion, hardly moving'),
  anode: L('Dạng anion, di chuyển về cực dương (+)', 'An anion, moving to the anode (+)'),
};

function useFmt() {
  const locale = useSettingsStore((s) => s.locale);
  return { locale, n: (v: number, d = 2) => formatNumber(locale, v, { maximumFractionDigits: d }) };
}

function AminoAcidsView() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const { aa, pH } = useAminoAcidStore();
  const a = aminoAcid(aa) ?? AMINO_ACIDS[0];
  const way = glycineMigration(pH);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      // The electrophoresis strip of tr. 43: cathode left, anode right, glycine moving.
      const y = height / 2;
      const x0 = 60;
      const x1 = width - 60;
      ctx.fillStyle = css('--bg-sunken');
      ctx.fillRect(x0, y - 22, x1 - x0, 44);
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = css('--chart-2');
      ctx.fillText('−', x0 - 24, y + 7);
      ctx.fillStyle = css('--chart-4');
      ctx.fillText('+', x1 + 24, y + 7);
      const mid = (x0 + x1) / 2;
      const shift = way === 'none' ? 0 : way === 'cathode' ? -(mid - x0) * 0.6 : (x1 - mid) * 0.6;
      ctx.strokeStyle = css('--text-muted');
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mid, y - 30);
      ctx.lineTo(mid, y + 30);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = css('--accent');
      ctx.beginPath();
      ctx.arc(mid + shift, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css('--text');
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('Gly', mid + shift, y + 40);
    },
    false,
    [way],
  );
  if (!a) return null;
  return (
    <div className="amine-view">
      <div className="amine-main">
        <SmilesPicture
          smiles={a.smiles}
          caption={`${a.common} (${a.id}): ${formatFormula(a.structure)}`}
          className="amine-main__picture"
        />
      </div>
      <section aria-label={Lz(L('Điện di của glycine', 'Electrophoresis of glycine'))}>
        <h3 className="amine-view__head">
          {Lz(
            L(
              `Glycine trong điện trường ở pH ${n(pH, 1)}`,
              `Glycine in an electric field at pH ${n(pH, 1)}`,
            ),
          )}
        </h3>
        <canvas
          ref={ref}
          className="amine-strip"
          role="img"
          aria-label={Lz(
            L(`pH ${n(pH, 1)}: ${MIGRATION[way].vi}`, `pH ${n(pH, 1)}: ${MIGRATION[way].en}`),
          )}
        />
      </section>
    </div>
  );
}

function PeptideView() {
  const Lz = useLocalized();
  const sequence = useAminoAcidStore((s) => s.sequence);
  const p = peptide(sequence);
  const parts = fragments(sequence);
  return (
    <div className="amine-view">
      <div className="amine-main">
        {p.smiles ? (
          <SmilesPicture smiles={p.smiles} caption={p.name} className="amine-main__picture" />
        ) : (
          <p className="amine-view__note">
            {Lz(
              L(
                `${p.name}: sách không in cấu tạo của Tyr nên app không vẽ và không tính công thức.`,
                `${p.name}: the book prints no structure for Tyr, so the app draws and computes no formula.`,
              ),
            )}
          </p>
        )}
      </div>
      <section aria-label={Lz(L('Thủy phân không hoàn toàn', 'Partial hydrolysis'))}>
        <h3 className="amine-view__head">
          {Lz(L('Thủy phân không hoàn toàn có thể tạo:', 'Partial hydrolysis can give:'))}
        </h3>
        {parts.length ? (
          <ul className="amine-fragments">
            {parts.map((f, i) => (
              <li key={`${f.join('-')}-${i}`}>{f.join('-')}</li>
            ))}
          </ul>
        ) : (
          <p className="amine-view__note">
            {Lz(L('Không có peptide nhỏ hơn.', 'No shorter peptide.'))}
          </p>
        )}
      </section>
    </div>
  );
}

export function AminoAcidStage() {
  const Lz = useLocalized();
  const tab = useAminoAcidStore((s) => s.tab);
  const card = useMemo(() => aminoAcidCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view amine">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(AA_TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
      </div>
      {tab === 'aminoAcids' ? <AminoAcidsView /> : <PeptideView />}
    </div>
  );
}

function AminoAcidsPanel() {
  const Lz = useLocalized();
  const { aa, pH } = useAminoAcidStore();
  const a = aminoAcid(aa);
  return (
    <>
      <ChoiceGroup
        label={Lz(L('Amino acid (Bảng 9.1)', 'Amino acid (Table 9.1)'))}
        items={AMINO_ACIDS.map((x) => x.id)}
        value={aa}
        name={(id) => aminoAcid(id)?.common ?? id}
        onPick={(id) => {
          setAminoAcid({ aa: id });
        }}
      />
      {a && (
        <dl className="amine-panel__facts">
          <dt>{Lz(L('Công thức cấu tạo', 'Structure'))}</dt>
          <dd className="mono">{formatFormula(a.structure)}</dd>
          <dt>{Lz(L('Tên thay thế', 'Substitutive name'))}</dt>
          <dd>{a.substitutive}</dd>
          <dt>{Lz(L('Tên bán hệ thống', 'Semi-systematic name'))}</dt>
          <dd>{a.semi}</dd>
          <dt>{Lz(L('Công thức phân tử', 'Molecular formula'))}</dt>
          <dd className="mono">{formatFormula(a.formula)}</dd>
        </dl>
      )}
      <LabeledNumber
        label={Lz(
          L('pH của môi trường (điện di glycine)', 'pH of the medium (glycine electrophoresis)'),
        )}
        value={pH}
        step={0.5}
        min={0}
        max={14}
        onChange={(v) => {
          setAminoAcid({ pH: v });
        }}
      />
      <p className="amine-panel__migration">{Lz(MIGRATION[glycineMigration(pH)])}</p>
      <p className="small">
        {Lz(
          L(
            `Sách nêu ví dụ glycine: ở pH khoảng ${GLYCINE_NEUTRAL_PH} tồn tại chủ yếu ở dạng ion lưỡng cực; pH nhỏ hơn nhận proton thành cation, pH lớn hơn nhường proton thành anion (tr. 43).`,
            `The book’s example is glycine: near pH ${GLYCINE_NEUTRAL_PH} it is mostly a zwitterion; at lower pH it gains a proton (cation), at higher pH it loses one (anion) (p. 43).`,
          ),
        )}
      </p>
    </>
  );
}

function PeptidePanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const sequence = useAminoAcidStore((s) => s.sequence);
  const p = peptide(sequence);
  return (
    <>
      <ActionRow
        label={Lz(L('Thêm amino acid vào cuối mạch (đầu C)', 'Add an amino acid at the C end'))}
        items={RESIDUES}
        name={(id) => id}
        onPick={(id) => {
          if (sequence.length < MAX_RESIDUES) setAminoAcid({ sequence: [...sequence, id] });
        }}
      />
      <ActionRow
        label={Lz(L('Sửa mạch', 'Edit the chain'))}
        items={['undo', 'clear'] as const}
        name={(k) =>
          Lz(k === 'undo' ? L('Bỏ đơn vị cuối', 'Remove the last unit') : L('Xóa hết', 'Clear'))
        }
        onPick={(k) => {
          setAminoAcid({ sequence: k === 'undo' ? sequence.slice(0, -1) : [] });
        }}
      />
      <dl className="amine-panel__facts">
        <dt>{Lz(L('Tên viết tắt', 'Short name'))}</dt>
        <dd className="mono amine-panel__peptide">{p.name || '—'}</dd>
        <dt>{Lz(L('Loại', 'Kind'))}</dt>
        <dd>{sequence.length >= 2 ? p.kind : '—'}</dd>
        <dt>{Lz(L('Số liên kết peptide', 'Peptide bonds'))}</dt>
        <dd className="mono">{p.bonds}</dd>
        <dt>{Lz(L('Phản ứng màu biuret', 'Biuret test'))}</dt>
        <dd className="amine-panel__biuret">
          {Lz(p.biuret ? L('Có (màu tím)', 'Yes (violet)') : L('Không', 'No'))}
        </dd>
        <dt>{Lz(L('Công thức phân tử', 'Molecular formula'))}</dt>
        <dd className="mono amine-panel__formula">{p.formula ? formatFormula(p.formula) : '—'}</dd>
        <dt>M</dt>
        <dd className="mono">{p.M === null ? '—' : `${n(p.M)} g/mol`}</dd>
      </dl>
      <ActionRow
        label={Lz(L('Peptide trong sách', 'Peptides in the book'))}
        items={BOOK_PEPTIDES.map((b) => b.id)}
        name={(id) => BOOK_PEPTIDES.find((b) => b.id === id)?.sequence.join('-') ?? id}
        onPick={(id) => {
          setAminoAcid({ sequence: BOOK_PEPTIDES.find((b) => b.id === id)?.sequence ?? [] });
        }}
      />
    </>
  );
}

export function AminoAcidPanel() {
  const Lz = useLocalized();
  const tab = useAminoAcidStore((s) => s.tab);
  return (
    <div className="chem-form amine-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={AA_TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setAminoAcid({ tab: t });
        }}
        segmented
      />
      {tab === 'aminoAcids' ? <AminoAcidsPanel /> : <PeptidePanel />}
    </div>
  );
}

export function AminoAcidBottom() {
  const Lz = useLocalized();
  return (
    <table className="amine-table">
      <caption>{Lz(L('Bảng 9.1 (SGK)', 'Table 9.1 (textbook)'))}</caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Công thức cấu tạo', 'Structure'))}</th>
          <th scope="col">{Lz(L('Tên thay thế', 'Substitutive'))}</th>
          <th scope="col">{Lz(L('Tên bán hệ thống', 'Semi-systematic'))}</th>
          <th scope="col">{Lz(L('Tên thông thường', 'Common'))}</th>
          <th scope="col">{Lz(L('Kí hiệu', 'Symbol'))}</th>
        </tr>
      </thead>
      <tbody>
        {AMINO_ACIDS.map((a) => (
          <tr key={a.id}>
            <th scope="row" className="mono">
              {formatFormula(a.structure)}
            </th>
            <td>{a.substitutive}</td>
            <td>{a.semi}</td>
            <td>{a.common}</td>
            <td>{a.id}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
