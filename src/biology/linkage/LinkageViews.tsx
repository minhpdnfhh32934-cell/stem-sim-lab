import { lazy, Suspense } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { Bio3DToolbar } from '@/biology/view3d/switch';
import { useShow3d } from '@/biology/view3d/support';
import { BarList, type Bar } from '@/ui/charts/BarList';
import { LabeledNumber } from '@/ui/ModuleControls';
import { L, usePublishCard } from '../common';
import { LINKAGE_CARD, LINKAGE_TITLE } from '../heredityCards';
import { Segmented } from '../ui';
import {
  COUNT_LABELS,
  GAMETES,
  PARENTAL,
  PHENOTYPE,
  frequencyFromCells,
  frequencyFromCounts,
  gameteShares,
} from './model';
import { LINKAGE_TABS, restoreLinkage, useLinkage, type LinkageTab } from './store';
import '../bio.css';
import '../heredity.css';

const Linkage3DView = lazy(() =>
  import('./linkage3d/Linkage3DView').then((m) => ({ default: m.Linkage3DView })),
);

const TAB_NAME: Record<LinkageTab, LocalizedText> = {
  testcross: L('Lai phân tích', 'Testcross'),
  counts: L('Câu 2 tr. 59', 'Question 2, p. 59'),
};

function TestcrossView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { parent, cells } = useLinkage();
  const f = parent === 'male' ? 0 : frequencyFromCells(cells);
  const shares = gameteShares(f);
  const pct = (x: number) => `${formatNumber(locale, 100 * x, { maximumFractionDigits: 2 })} %`;
  const bars: Bar[] = GAMETES.filter((g) => shares[g] > 0).map((g) => ({
    id: g,
    label: `${g}/bv · ${Lz(PHENOTYPE[g])}`,
    value: shares[g],
    text: pct(shares[g]),
    strong: !PARENTAL.includes(g),
  }));
  return (
    <div className="bio-scroll heredity">
      <p className="heredity__cross">
        {`Fa: ${parent === 'male' ? '♂' : '♀'} BV/bv × ${parent === 'male' ? '♀' : '♂'} bv/bv`}
      </p>
      <BarList bars={bars} label={Lz(L('Tỉ lệ kiểu hình ở Fa', 'Shares of the Fa classes'))} />
      <p className="heredity__verdict">
        {parent === 'male'
          ? Lz(
              L(
                'Liên kết gene hoàn toàn: hai kiểu hình giống bố mẹ, mỗi loại 50 %.',
                'Complete linkage: two parental classes, 50 % each.',
              ),
            )
          : Lz(
              L(
                `Tần số hoán vị gene f = ${pct(cells)} : 2 = ${pct(f)} (tổng hai kiểu tái tổ hợp, thanh đậm).`,
                `Recombination frequency f = ${pct(cells)} : 2 = ${pct(f)} (the two recombinant classes, bold).`,
              ),
            )}
      </p>
      <p className="heredity__note">
        {Lz(
          L(
            'Ở phép lai phân tích, cá thể bv/bv chỉ cho một loại giao tử bv, nên tỉ lệ kiểu hình ở Fa bằng tỉ lệ các loại giao tử của cá thể F1. Tần số hoán vị gene luôn nhỏ hơn hoặc bằng 50 %.',
            'In a testcross the bv/bv parent gives only bv gametes, so the Fa shares equal the F1 parent’s gamete shares. The recombination frequency is never above 50 %.',
          ),
        )}
      </p>
    </div>
  );
}

/** What the frequency says (tr. 54–57): complete linkage, crossing over, or 1 : 1 : 1 : 1. */
function CONCLUSION(f: number): LocalizedText {
  if (f === 0) return L('Hai gene liên kết hoàn toàn.', 'The genes are completely linked.');
  if (f < 0.5)
    return L('Hai gene liên kết, có hoán vị gene.', 'The genes are linked, with crossing over.');
  return L(
    'Bốn kiểu hình ngang nhau, như tỉ lệ 1 : 1 : 1 : 1 của quy luật phân li độc lập.',
    'Four equal classes, like the 1 : 1 : 1 : 1 of independent assortment.',
  );
}

function CountsView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const counts = useLinkage((s) => s.counts);
  const f = frequencyFromCounts(counts);
  const total = counts.reduce((s, c) => s + c, 0);
  const bars: Bar[] = counts.map((c, i) => ({
    id: String(i),
    label: Lz(COUNT_LABELS[i] ?? L('', '')),
    value: c,
    text: formatNumber(locale, c),
  }));
  return (
    <div className="bio-scroll heredity">
      <p className="heredity__cross">
        {Lz(
          L(
            'Ruồi cái dị hợp tử thân xám, mắt đỏ × ruồi đực thân đen, mắt tím (câu 2 tr. 59)',
            'Heterozygous grey-body red-eye female × black-body purple-eye male (question 2, p. 59)',
          ),
        )}
      </p>
      <BarList bars={bars} label={Lz(L('Số con mỗi kiểu hình', 'Flies per class'))} />
      <p className="heredity__verdict">
        {f === null
          ? Lz(L('Hãy nhập số con của mỗi kiểu hình.', 'Enter the number of flies in each class.'))
          : Lz(
              L(
                `Hai kiểu hình ít nhất là kiểu tái tổ hợp: f = ${formatNumber(locale, Math.round(f * total))} : ${formatNumber(locale, total)} ≈ ${formatNumber(locale, 100 * f, { maximumFractionDigits: 1 })} %. ${CONCLUSION(f).vi}`,
                `The two smallest classes are the recombinants: f = ${formatNumber(locale, Math.round(f * total))} : ${formatNumber(locale, total)} ≈ ${formatNumber(locale, 100 * f, { maximumFractionDigits: 1 })} %. ${CONCLUSION(f).en}`,
              ),
            )}
      </p>
    </div>
  );
}

export function LinkageStage() {
  const Lz = useLocalized();
  const tab = useLinkage((s) => s.tab);
  const parent = useLinkage((s) => s.parent);
  usePublishCard(LINKAGE_CARD);
  const { show3d } = useShow3d('geneLinkage');
  const chips = (
    <>
      <span className="chem-chip">
        <strong className="stage__hud-title">{Lz(LINKAGE_TITLE)}</strong>
      </span>
      <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
    </>
  );
  // Only the testcross has a 3D picture; the counts tab is a table of numbers (stays 2D).
  if (show3d && tab === 'testcross')
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Linkage3DView
          label={`Fa: ${parent === 'male' ? '♂' : '♀'} BV/bv × ${parent === 'male' ? '♀' : '♂'} bv/bv`}
          top={
            <>
              {chips}
              <span className="chem-chip mono">{`Fa: ${parent === 'male' ? '♂' : '♀'} BV/bv × ${parent === 'male' ? '♀' : '♂'} bv/bv`}</span>
            </>
          }
        />
      </Suspense>
    );
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        {chips}
        {tab === 'testcross' && <Bio3DToolbar lesson="geneLinkage" />}
      </div>
      {tab === 'testcross' ? <TestcrossView /> : <CountsView />}
    </div>
  );
}

export function LinkagePanel() {
  const Lz = useLocalized();
  const { tab, parent, cells, counts } = useLinkage();
  return (
    <div className="chem-form">
      <Segmented<LinkageTab>
        label={L('Phần bài học', 'Part')}
        value={tab}
        options={LINKAGE_TABS.map((t) => ({ id: t, label: TAB_NAME[t] }))}
        onChange={(t) => {
          restoreLinkage({ tab: t });
        }}
      />
      {tab === 'testcross' ? (
        <>
          <div className="heredity-field">
            <span className="heredity-field__label">
              {Lz(L('Cá thể F1 đem lai phân tích', 'F1 parent of the testcross'))}
            </span>
            <Segmented<'male' | 'female'>
              label={L('Cá thể F1 đem lai phân tích', 'F1 parent of the testcross')}
              value={parent}
              options={[
                { id: 'male', label: L('Đực (Hình 11.1)', 'Male (Fig. 11.1)') },
                { id: 'female', label: L('Cái (Hình 11.2)', 'Female (Fig. 11.2)') },
              ]}
              onChange={(p) => {
                restoreLinkage({ parent: p });
              }}
            />
          </div>
          {parent === 'female' && (
            <LabeledNumber
              label={Lz(L('Tỉ lệ tế bào có trao đổi chéo (%)', 'Cells with a crossover (%)'))}
              value={Math.round(cells * 1000) / 10}
              step={1}
              min={0}
              max={100}
              onChange={(v) => {
                restoreLinkage({ cells: v / 100 });
              }}
            />
          )}
        </>
      ) : (
        counts.map((c, i) => (
          <LabeledNumber
            key={i}
            label={Lz(COUNT_LABELS[i] ?? L('', ''))}
            value={c}
            step={1}
            min={0}
            max={100000}
            onChange={(v) => {
              restoreLinkage({ counts: counts.map((x, j) => (j === i ? v : x)) });
            }}
          />
        ))
      )}
    </div>
  );
}
