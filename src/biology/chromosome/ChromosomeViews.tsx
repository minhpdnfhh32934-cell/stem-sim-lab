import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { BarList, type Bar } from '@/ui/charts/BarList';
import { LabeledNumber } from '@/ui/ModuleControls';
import { L, usePublishCard } from '../common';
import { CHROMOSOME_CARD, CHROMOSOME_TITLE } from '../heredityCards';
import { Segmented } from '../ui';
import {
  CHIMP_2N,
  DOWN_BY_AGE,
  HUMAN_2N,
  NUMBER_TYPES,
  STRUCTURES,
  allopolyploid,
  chromosomeCount,
  structureChange,
  type NumberType,
  type Structure,
} from './model';
import { CHROMOSOME_TABS, restoreChromosome, useChromosome, type ChromosomeTab } from './store';
import '../bio.css';
import '../heredity.css';

const TAB_NAME: Record<ChromosomeTab, LocalizedText> = {
  structure: L('Đột biến cấu trúc', 'Structural'),
  number: L('Đột biến số lượng', 'Numerical'),
  down: L('Hội chứng Down', 'Down syndrome'),
};
const STRUCTURE_NAME: Record<Structure, LocalizedText> = {
  deletion: L('Mất đoạn', 'Deletion'),
  duplication: L('Lặp đoạn', 'Duplication'),
  inversion: L('Đảo đoạn', 'Inversion'),
  translocation: L('Chuyển đoạn', 'Translocation'),
};
const STRUCTURE_NOTE: Record<Structure, LocalizedText> = {
  deletion: L(
    'Một đoạn NST bị đứt mà không được nối lại, làm mất vật chất di truyền nên phần nhiều là có hại.',
    'A broken piece is not rejoined; genetic material is lost, usually harmful.',
  ),
  duplication: L(
    'Một đoạn NST được lặp lại một hoặc vài lần, làm tăng số bản sao của gene và tăng chiều dài NST.',
    'A piece is repeated once or more, adding copies of genes and lengthening the chromosome.',
  ),
  inversion: L(
    'Một đoạn NST đứt ra, quay ngược rồi nối lại; thường không làm mất vật chất di truyền.',
    'A piece breaks off, turns round and rejoins; usually no material is lost.',
  ),
  translocation: L(
    'Một đoạn NST chuyển sang vị trí khác, ở đây giữa hai NST không tương đồng; có thể thay đổi nhóm gene liên kết.',
    'A piece moves elsewhere, here between two non-homologous chromosomes; linkage groups can change.',
  ),
};
const NUMBER_NAME: Record<NumberType, LocalizedText> = {
  trisomy: L('Thể ba (2n + 1)', 'Trisomy (2n + 1)'),
  monosomy: L('Thể một (2n − 1)', 'Monosomy (2n − 1)'),
  nullisomy: L('Thể không (2n − 2)', 'Nullisomy (2n − 2)'),
  triploid: L('Tam bội (3n)', 'Triploid (3n)'),
  tetraploid: L('Tứ bội (4n)', 'Tetraploid (4n)'),
};

/** Genes as beads; changed letters are marked. */
function Chromosome({ genes, against }: { genes: string; against: string }) {
  return (
    <span className="heredity__chromosome">
      {Array.from(genes).map((g, i) => (
        <span
          key={i}
          className={against.includes(g) ? 'heredity__gene' : 'heredity__gene heredity__gene--new'}
        >
          {g}
        </span>
      ))}
    </span>
  );
}

function StructureView() {
  const Lz = useLocalized();
  const s = useChromosome((st) => st.structure);
  const { before, after } = structureChange(s);
  const all = before.join('');
  return (
    <div className="bio-scroll heredity">
      <p className="heredity__cross">{`${Lz(STRUCTURE_NAME[s])} (${Lz(L('Hình 12.1', 'Figure 12.1'))})`}</p>
      <div className="heredity__rows">
        <span className="heredity__row-label">{Lz(L('Trước', 'Before'))}</span>
        <span className="heredity__row">
          {before.map((g) => (
            <Chromosome key={g} genes={g} against={g} />
          ))}
        </span>
        <span className="heredity__row-label">{Lz(L('Sau', 'After'))}</span>
        <span className="heredity__row heredity__row--after">
          {after.map((g, i) => (
            <Chromosome
              key={i}
              genes={g}
              against={s === 'translocation' ? (before[i] ?? '') : all}
            />
          ))}
        </span>
      </div>
      <p className="heredity__note">{Lz(STRUCTURE_NOTE[s])}</p>
    </div>
  );
}

function NumberView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((st) => st.locale);
  const { twoN, numberType, aTwoN, bTwoN } = useChromosome();
  const count = chromosomeCount(twoN, numberType);
  const allo = allopolyploid(aTwoN, bTwoN);
  const n = (x: number) => formatNumber(locale, x);
  return (
    <div className="bio-scroll heredity">
      <p className="heredity__cross">
        {`${Lz(NUMBER_NAME[numberType])}: 2n = ${n(twoN)} → ${n(count)} ${Lz(L('NST', 'chromosomes'))}`}
      </p>
      <ul className="heredity__result">
        {NUMBER_TYPES.map((t) => (
          <li key={t} className={t === numberType ? 'heredity__strong' : undefined}>
            {`${Lz(NUMBER_NAME[t])}: ${n(chromosomeCount(twoN, t))}`}
          </li>
        ))}
      </ul>
      {twoN === HUMAN_2N && (
        <p className="heredity__note">
          {Lz(
            L(
              `Ở người (2n = ${n(HUMAN_2N)}): hội chứng Down thừa một NST số 21 (${n(chromosomeCount(HUMAN_2N, 'trisomy'))} NST); Klinefelter XXY (${n(HUMAN_2N + 1)}); Turner XO (${n(HUMAN_2N - 1)}). Tinh tinh vẫn giữ bộ NST của tổ tiên chung là ${n(CHIMP_2N)} (tr. 65).`,
              `In humans (2n = ${n(HUMAN_2N)}): Down syndrome has an extra chromosome 21 (${n(chromosomeCount(HUMAN_2N, 'trisomy'))}); Klinefelter XXY (${n(HUMAN_2N + 1)}); Turner XO (${n(HUMAN_2N - 1)}). Chimpanzees keep the common ancestor’s ${n(CHIMP_2N)} (p. 65).`,
            ),
          )}
        </p>
      )}
      <p className="heredity__cross">
        {Lz(L('Lai xa kèm đa bội hóa (Hình 12.3c)', 'Wide cross with doubling (Figure 12.3c)'))}
      </p>
      <p className="heredity__verdict">
        {`2nA = ${n(aTwoN)}, 2nB = ${n(bTwoN)} → ${Lz(L('hợp tử', 'hybrid'))} nA + nB = ${n(allo.hybrid)} → ${Lz(L('đa bội hóa', 'doubled'))} 2nA + 2nB = ${n(allo.doubled)}`}
      </p>
    </div>
  );
}

function DownView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((st) => st.locale);
  const n = (x: number) => formatNumber(locale, x);
  const band = (from: number | null, to: number | null) =>
    from === null
      ? Lz(L(`dưới ${n(to ?? 0)} tuổi`, `under ${n(to ?? 0)}`))
      : to === null
        ? Lz(L(`từ ${n(from)} tuổi`, `${n(from)} and over`))
        : `${n(from)}–${n(to)}`;
  const bars: Bar[] = DOWN_BY_AGE.map((d, i) => ({
    id: String(i),
    label: band(d.from, d.to),
    value: 1 / d.births_per_case,
    text: `1/${n(d.births_per_case)}`,
  }));
  return (
    <div className="bio-scroll heredity">
      <p className="heredity__cross">
        {Lz(
          L(
            'Tỉ lệ mắc hội chứng Down theo tuổi của người mẹ (tr. 67)',
            'Down syndrome by the mother’s age (p. 67)',
          ),
        )}
      </p>
      <BarList bars={bars} label={Lz(L('Tỉ lệ mắc trên số lần sinh', 'Cases per birth'))} />
      <p className="heredity__note">
        {Lz(
          L(
            'Mẹ càng lớn tuổi, con sinh ra càng dễ mắc hội chứng Down do thừa NST 21. Số liệu sách dẫn từ nghiên cứu của Penrose và Smith.',
            'The older the mother, the likelier a child with Down syndrome (an extra chromosome 21). The book quotes Penrose and Smith.',
          ),
        )}
      </p>
    </div>
  );
}

export function ChromosomeStage() {
  const Lz = useLocalized();
  const tab = useChromosome((s) => s.tab);
  usePublishCard(CHROMOSOME_CARD);
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(CHROMOSOME_TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
      </div>
      {tab === 'structure' ? <StructureView /> : tab === 'number' ? <NumberView /> : <DownView />}
    </div>
  );
}

export function ChromosomePanel() {
  const Lz = useLocalized();
  const { tab, structure, twoN, numberType, aTwoN, bTwoN } = useChromosome();
  return (
    <div className="chem-form">
      <Segmented<ChromosomeTab>
        label={L('Phần bài học', 'Part')}
        value={tab}
        options={CHROMOSOME_TABS.map((t) => ({ id: t, label: TAB_NAME[t] }))}
        onChange={(t) => {
          restoreChromosome({ tab: t });
        }}
      />
      {tab === 'structure' && (
        <div className="heredity-field">
          <span className="heredity-field__label">{Lz(L('Dạng đột biến', 'Kind'))}</span>
          <Segmented<Structure>
            label={L('Dạng đột biến cấu trúc', 'Kind of structural mutation')}
            value={structure}
            options={STRUCTURES.map((s) => ({ id: s, label: STRUCTURE_NAME[s] }))}
            onChange={(s) => {
              restoreChromosome({ structure: s });
            }}
          />
        </div>
      )}
      {tab === 'number' && (
        <>
          <LabeledNumber
            label={Lz(L('Bộ NST lưỡng bội 2n của loài', 'The species’ 2n'))}
            value={twoN}
            step={2}
            min={2}
            max={200}
            onChange={(v) => {
              restoreChromosome({ twoN: v });
            }}
          />
          <div className="heredity-field">
            <span className="heredity-field__label">{Lz(L('Dạng đột biến', 'Kind'))}</span>
            <Segmented<NumberType>
              label={L('Dạng đột biến số lượng', 'Kind of numerical mutation')}
              value={numberType}
              options={NUMBER_TYPES.map((t) => ({ id: t, label: NUMBER_NAME[t] }))}
              onChange={(t) => {
                restoreChromosome({ numberType: t });
              }}
            />
          </div>
          <LabeledNumber
            label={Lz(L('Loài A: 2nA', 'Species A: 2nA'))}
            value={aTwoN}
            step={2}
            min={2}
            max={200}
            onChange={(v) => {
              restoreChromosome({ aTwoN: v });
            }}
          />
          <LabeledNumber
            label={Lz(L('Loài B: 2nB', 'Species B: 2nB'))}
            value={bTwoN}
            step={2}
            min={2}
            max={200}
            onChange={(v) => {
              restoreChromosome({ bTwoN: v });
            }}
          />
        </>
      )}
    </div>
  );
}
