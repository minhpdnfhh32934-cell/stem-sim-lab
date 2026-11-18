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
import { L, TITLE, esterCard } from './card';
import {
  ACYLS,
  ALKYLS,
  BOILING,
  FAT_COMPOSITION,
  FATTY_ACIDS,
  ester,
  esterIsomers,
  esterificationYield,
  hydrogenNeeded,
  hydrolysis,
  saponify,
  triglyceride,
  triglycerideSmiles,
} from './model';
import { TABS, loadQuestion7, setEster, useEsterStore, type Tab } from './store';
import './ester.css';

const TAB_NAME: Record<Tab, LocalizedText> = {
  names: L('Tên gọi, đồng phân', 'Names and isomers'),
  reactions: L('Phản ứng của ester', 'Reactions of esters'),
  fats: L('Chất béo', 'Fats'),
};
const FAT_QUESTIONS = ['q8', 'q9', 'soap'] as const;
type FatQuestion = (typeof FAT_QUESTIONS)[number];
const FAT_QUESTION_NAME: Record<FatQuestion, LocalizedText> = {
  q8: L('Câu 8 tr. 11: tripalmitin', 'Question 8 p. 11: tripalmitin'),
  q9: L('Câu 9 tr. 12: trilinolein', 'Question 9 p. 12: trilinolein'),
  soap: L('Bài 2 tr. 16: tristearin', 'Lesson 2 p. 16: tristearin'),
};
const FAT_QUESTION_ACIDS: Record<FatQuestion, string> = {
  q8: 'palmitic',
  q9: 'linoleic',
  soap: 'stearic',
};
const KIND_NAME: Record<string, LocalizedText> = {
  alcohol: L('Alcohol', 'Alcohol'),
  carboxylicAcid: L('Carboxylic acid', 'Carboxylic acid'),
  ester: L('Ester', 'Ester'),
};
const BARS = ['--chart-1', '--chart-2', '--chart-4'] as const;

function useFmt() {
  const locale = useSettingsStore((s) => s.locale);
  return {
    locale,
    n: (v: number, d = 2) => formatNumber(locale, v, { maximumFractionDigits: d }),
  };
}

/** "A + B → C + D" with typographic formulas; ⇌ for a reversible reaction. */
const equation = (left: readonly string[], right: readonly string[], reversible: boolean) =>
  `${left.map(formatFormula).join(' + ')} ${reversible ? '⇌' : '→'} ${right.map(formatFormula).join(' + ')}`;

function NamesView() {
  const Lz = useLocalized();
  const { acyl, alkyl, n } = useEsterStore();
  const e = ester(acyl, alkyl);
  const isomers = esterIsomers(n);
  return (
    <div className="ester-view">
      <div className="ester-main">
        <SmilesPicture
          smiles={e.smiles}
          caption={`${formatFormula(e.condensed)}: ${e.iupac}${e.common ? ` (${e.common})` : ''}`}
          className="ester-main__picture"
        />
      </div>
      <section aria-label={Lz(L('Các đồng phân ester', 'Ester isomers'))}>
        <h3 className="ester-view__head">
          {Lz(
            L(
              `Các ester có công thức ${formatFormula(`C${n}H${2 * n}O2`)}: ${isomers.length}`,
              `Esters of formula ${formatFormula(`C${n}H${2 * n}O2`)}: ${isomers.length}`,
            ),
          )}
        </h3>
        <div className="ester-isomers" role="list">
          {isomers.map((x) => (
            <div role="listitem" key={x.condensed}>
              <SmilesPicture
                smiles={x.smiles}
                caption={`${x.iupac}${x.common ? ` (${x.common})` : ''}`}
                className="ester-isomer"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReactionsView() {
  const Lz = useLocalized();
  const { acyl, alkyl } = useEsterStore();
  const e = ester(acyl, alkyl);
  const acidH = hydrolysis(e, 'acid');
  const baseH = hydrolysis(e, 'base');
  return (
    <div className="ester-view ester-reactions">
      <div className="ester-eq">
        <h3>
          {Lz(L('Thủy phân trong môi trường acid (H⁺, t°)', 'Hydrolysis in acid (H⁺, heat)'))}
        </h3>
        <p className="ester-eq__text">{equation(acidH.left, acidH.right, true)}</p>
      </div>
      <div className="ester-eq">
        <h3>{Lz(L('Thủy phân trong môi trường base (t°)', 'Hydrolysis by a base (heat)'))}</h3>
        <p className="ester-eq__text">{equation(baseH.left, baseH.right, false)}</p>
      </div>
      <div className="ester-eq">
        <h3>{Lz(L('Ester hóa (H₂SO₄ đặc, t°)', 'Esterification (conc. H₂SO₄, heat)'))}</h3>
        <p className="ester-eq__text">
          {equation(
            [`${e.acyl.condensed}COOH`, `${e.alkyl.condensed}OH`],
            [e.condensed, 'H2O'],
            true,
          )}
        </p>
      </div>
    </div>
  );
}

function FatsView() {
  const Lz = useLocalized();
  const { locale } = useFmt();
  const { fa1, fa2, fa3 } = useEsterStore();
  const ids: [string, string, string] = [fa1, fa2, fa3];
  const t = triglyceride(ids);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      // Hình 1.2: one stacked bar per fat.
      const left = 170;
      const top = 16;
      const rowH = Math.min(30, (height - top - 30) / FAT_COMPOSITION.length);
      const w = width - left - 16;
      ctx.font = '12px system-ui, sans-serif';
      FAT_COMPOSITION.forEach((f, i) => {
        const y = top + i * rowH;
        ctx.fillStyle = css('--text');
        ctx.textAlign = 'right';
        ctx.fillText(Lz(f.name), left - 8, y + rowH / 2 + 4);
        let x = left;
        [f.saturated, f.one_double, f.several_double].forEach((v, k) => {
          const bw = (v / 100) * w;
          ctx.fillStyle = css(BARS[k] ?? '--chart-1');
          ctx.fillRect(x, y + 3, bw, rowH - 6);
          if (v >= 6) {
            ctx.fillStyle = css('--bg-panel');
            ctx.textAlign = 'center';
            ctx.fillText(`${formatNumber(locale, v)} %`, x + bw / 2, y + rowH / 2 + 4);
          }
          x += bw;
        });
      });
    },
    false,
    [locale, Lz],
  );
  return (
    <div className="ester-view ester-fats">
      <div className="ester-fats__chart">
        <canvas
          ref={ref}
          className="ester-fats__canvas"
          role="img"
          aria-label={Lz(
            L(
              `Hình 1.2: ${FAT_COMPOSITION.map((f) => `${f.name.vi} ${f.saturated} % no, ${f.one_double} % một liên kết đôi, ${f.several_double} % nhiều liên kết đôi`).join('; ')}`,
              `Figure 1.2: ${FAT_COMPOSITION.map((f) => `${f.name.en} ${f.saturated} % saturated, ${f.one_double} % one double bond, ${f.several_double} % several`).join('; ')}`,
            ),
          )}
        />
        <ul className="ester-legend">
          {[
            L('Gốc no', 'Saturated'),
            L('Gốc không no chứa 1 liên kết đôi', 'One double bond'),
            L('Gốc không no chứa nhiều liên kết đôi', 'Several double bonds'),
          ].map((t2, k) => (
            <li key={t2.en}>
              <span
                className="ester-legend__swatch"
                style={{ background: `var(${BARS[k] ?? '--chart-1'})` }}
              />
              {Lz(t2)}
            </li>
          ))}
        </ul>
      </div>
      <SmilesPicture
        smiles={triglycerideSmiles(ids)}
        caption={`${formatFormula(t.formula)} · M = ${formatNumber(locale, t.M, { maximumFractionDigits: 2 })} g/mol`}
        className="ester-main__picture"
      />
    </div>
  );
}

export function EsterStage() {
  const Lz = useLocalized();
  const tab = useEsterStore((s) => s.tab);
  const card = useMemo(() => esterCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view ester">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
      </div>
      {tab === 'names' && <NamesView />}
      {tab === 'reactions' && <ReactionsView />}
      {tab === 'fats' && <FatsView />}
    </div>
  );
}

function GroupPickers() {
  const Lz = useLocalized();
  const { acyl, alkyl } = useEsterStore();
  return (
    <>
      <ChoiceGroup
        label={Lz(L('Gốc carboxylic acid (R)', 'Acid group (R)'))}
        items={ACYLS.map((a) => a.id)}
        value={acyl}
        name={(id) => ACYLS.find((a) => a.id === id)?.acid ?? id}
        onPick={(id) => {
          setEster({ acyl: id });
        }}
      />
      <ChoiceGroup
        label={Lz(L('Gốc alcohol (R′)', 'Alcohol group (R′)'))}
        items={ALKYLS.map((a) => a.id)}
        value={alkyl}
        name={(id) => ALKYLS.find((a) => a.id === id)?.name ?? id}
        onPick={(id) => {
          setEster({ alkyl: id });
        }}
      />
    </>
  );
}

function NamesPanel() {
  const Lz = useLocalized();
  const { n: fmt } = useFmt();
  const { acyl, alkyl, n } = useEsterStore();
  const e = ester(acyl, alkyl);
  return (
    <>
      <GroupPickers />
      <dl className="ester-panel__facts">
        <dt>{Lz(L('Công thức cấu tạo thu gọn', 'Condensed formula'))}</dt>
        <dd className="mono">{formatFormula(e.condensed)}</dd>
        <dt>{Lz(L('Công thức phân tử', 'Molecular formula'))}</dt>
        <dd className="mono">{formatFormula(e.formula)}</dd>
        <dt>{Lz(L('Tên gọi', 'Name'))}</dt>
        <dd className="ester-panel__name">{e.common ? `${e.iupac} (${e.common})` : e.iupac}</dd>
        <dt>M</dt>
        <dd className="mono">{`${fmt(e.M)} g/mol`}</dd>
      </dl>
      <ChoiceGroup
        label={Lz(L('Số nguyên tử C để liệt kê đồng phân', 'Carbons for the isomer list'))}
        items={['2', '3', '4', '5'] as const}
        value={String(n) as '2' | '3' | '4' | '5'}
        name={(k) => formatFormula(`C${k}H${2 * Number(k)}O2`)}
        onPick={(k) => {
          setEster({ n: Number(k) });
        }}
        segmented
      />
      <p className="small">
        {Lz(
          L(
            'Tên ester = tên gốc R′ + tên gốc carboxylic acid (đuôi -ic acid đổi thành -ate). Danh sách đồng phân gồm các ester no, đơn chức, mạch hở.',
            'An ester’s name = the R′ group + the acid’s anion (-ic acid becomes -ate). The isomer list holds the saturated, open-chain esters.',
          ),
        )}
      </p>
    </>
  );
}

function ReactionsPanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const { acyl, alkyl, acidG, alcoholG, esterG } = useEsterStore();
  const e = ester(acyl, alkyl);
  const y = esterificationYield(e, acidG, alcoholG, esterG);
  return (
    <>
      <GroupPickers />
      <h4 className="ester-panel__head">{Lz(L('Hiệu suất ester hóa', 'Esterification yield'))}</h4>
      <LabeledNumber
        label={Lz(L(`Khối lượng ${e.acyl.acid} (g)`, `Mass of ${e.acyl.acid} (g)`))}
        value={acidG}
        onChange={(v) => {
          setEster({ acidG: v });
        }}
      />
      <LabeledNumber
        label={Lz(L(`Khối lượng ${e.alkyl.alcohol} (g)`, `Mass of ${e.alkyl.alcohol} (g)`))}
        value={alcoholG}
        onChange={(v) => {
          setEster({ alcoholG: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Khối lượng ester thu được (g)', 'Mass of ester obtained (g)'))}
        value={esterG}
        onChange={(v) => {
          setEster({ esterG: v });
        }}
      />
      <dl className="ester-panel__facts">
        <dt>{Lz(L('Số mol acid', 'Moles of acid'))}</dt>
        <dd className="mono">{n(y.nAcid, 4)}</dd>
        <dt>{Lz(L('Số mol alcohol', 'Moles of alcohol'))}</dt>
        <dd className="mono">{n(y.nAlcohol, 4)}</dd>
        <dt>{Lz(L('Chất phản ứng hết', 'Limiting reagent'))}</dt>
        <dd>{Lz(y.limiting === 'acid' ? L('acid', 'the acid') : L('alcohol', 'the alcohol'))}</dd>
        <dt>{Lz(L('Khối lượng ester lí thuyết', 'Theoretical mass'))}</dt>
        <dd className="mono">{`${n(y.theoretical, 3)} g`}</dd>
        <dt>{Lz(L('Hiệu suất H', 'Yield H'))}</dt>
        <dd className="mono ester-panel__yield">{`${n(y.yield * 100, 2)} %`}</dd>
      </dl>
      <ActionRow
        label={Lz(L('Bài tập trong sách', 'Questions in the book'))}
        items={['q7'] as const}
        name={() => Lz(L('Câu 7 tr. 9: dầu chuối', 'Question 7 p. 9: banana oil'))}
        onPick={loadQuestion7}
      />
    </>
  );
}

function FatsPanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const { fa1, fa2, fa3, fatG } = useEsterStore();
  const ids: [string, string, string] = [fa1, fa2, fa3];
  const t = triglyceride(ids);
  const sap = saponify(ids, fatG);
  const picker = (key: 'fa1' | 'fa2' | 'fa3', value: string, k: number) => (
    <ChoiceGroup
      key={key}
      label={Lz(L(`Acid béo thứ ${k}`, `Fatty acid ${k}`))}
      items={FATTY_ACIDS.map((a) => a.id)}
      value={value}
      name={(id) => FATTY_ACIDS.find((a) => a.id === id)?.name ?? id}
      onPick={(id) => {
        setEster({ [key]: id });
      }}
    />
  );
  return (
    <>
      {picker('fa1', fa1, 1)}
      {picker('fa2', fa2, 2)}
      {picker('fa3', fa3, 3)}
      <LabeledNumber
        label={Lz(L('Khối lượng chất béo (g)', 'Mass of fat (g)'))}
        value={fatG}
        onChange={(v) => {
          setEster({ fatG: v });
        }}
      />
      <dl className="ester-panel__facts">
        <dt>{Lz(L('Công thức', 'Formula'))}</dt>
        <dd className="mono ester-panel__fat">{formatFormula(t.formula)}</dd>
        <dt>M</dt>
        <dd className="mono">{`${n(t.M)} g/mol`}</dd>
        <dt>{Lz(L('Số liên kết C=C', 'C=C bonds'))}</dt>
        <dd className="mono">{t.doubleBonds}</dd>
        <dt>{Lz(L('NaOH cần (xà phòng hóa)', 'NaOH needed (saponification)'))}</dt>
        <dd className="mono">{`${n(sap.naoh)} g`}</dd>
        <dt>{Lz(L('Glycerol tạo thành', 'Glycerol formed'))}</dt>
        <dd className="mono">{`${n(sap.glycerol)} g`}</dd>
        <dt>{Lz(L('Xà phòng tạo thành', 'Soap formed'))}</dt>
        <dd className="mono ester-panel__soap">{`${n(sap.soap)} g`}</dd>
        <dt>{Lz(L('H₂ để hydrogen hóa hết', 'H₂ for full hydrogenation'))}</dt>
        <dd className="mono">{`${n(hydrogenNeeded(ids, fatG), 4)} mol`}</dd>
      </dl>
      <ActionRow
        label={Lz(L('Bài tập trong sách', 'Questions in the book'))}
        items={FAT_QUESTIONS}
        name={(q) => Lz(FAT_QUESTION_NAME[q])}
        onPick={(q) => {
          const a = FAT_QUESTION_ACIDS[q];
          setEster({ fa1: a, fa2: a, fa3: a });
        }}
      />
    </>
  );
}

export function EsterPanel() {
  const Lz = useLocalized();
  const tab = useEsterStore((s) => s.tab);
  return (
    <div className="chem-form ester-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setEster({ tab: t });
        }}
        segmented
      />
      {tab === 'names' && <NamesPanel />}
      {tab === 'reactions' && <ReactionsPanel />}
      {tab === 'fats' && <FatsPanel />}
    </div>
  );
}

export function EsterBottom() {
  const Lz = useLocalized();
  return (
    <table className="ester-table">
      <caption>{Lz(L('Nhiệt độ sôi (tr. 7, M = 60)', 'Boiling points (p. 7, M = 60)'))}</caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Chất', 'Compound'))}</th>
          <th scope="col">{Lz(L('Loại hợp chất', 'Kind'))}</th>
          <th scope="col">M</th>
          <th scope="col">{Lz(L('Nhiệt độ sôi (°C)', 'Boiling point (°C)'))}</th>
        </tr>
      </thead>
      <tbody>
        {BOILING.map((b) => (
          <tr key={b.formula}>
            <th scope="row">{formatFormula(b.formula)}</th>
            <td>{Lz(KIND_NAME[b.kind] ?? L(b.kind, b.kind))}</td>
            <td className="mono">{b.M}</td>
            <td className="mono">{b.bp_C}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
