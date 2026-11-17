import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { BarList, type Bar } from '@/ui/charts/BarList';
import { cx } from '@/ui/cx';
import { L, usePublishCard } from '../common';
import { Segmented } from '../ui';
import { EVOLUTION_CARD, EVOLUTION_TITLE } from './card';
import {
  CYTOCHROME_C,
  EARTH_FORMED_MYA,
  EUKARYOTE_FOSSILS_MYA,
  GEOLOGIC,
  HOMININS,
  PROKARYOTE_FOSSILS_MYA,
  duration,
  geoName,
} from './model';
import { EVOLUTION_TABS, restoreEvolution, useEvolution, type EvolutionTab } from './store';
import '../bio.css';
import '../heredity.css';
import './evolution.css';

const TAB_NAME: Record<EvolutionTab, LocalizedText> = {
  molecular: L('Bằng chứng phân tử', 'Molecular evidence'),
  timescale: L('Các đại địa chất', 'Geological time'),
};

function useN() {
  const locale = useSettingsStore((s) => s.locale);
  return (x: number) => formatNumber(locale, x, { maximumFractionDigits: 1 });
}

function MolecularView() {
  const Lz = useLocalized();
  const n = useN();
  const bars: Bar[] = CYTOCHROME_C.map((s) => ({
    id: s.id,
    label: Lz(s.name),
    value: s.cytochrome_c_diff,
    text: n(s.cytochrome_c_diff),
  }));
  return (
    <div className="bio-scroll heredity">
      <p className="heredity__cross">
        {Lz(
          L(
            'Số amino acid trong cytochrome C khác so với ở người (Bảng 19.1)',
            'Amino acids of cytochrome C that differ from the human protein (Table 19.1)',
          ),
        )}
      </p>
      <BarList bars={bars} label={Lz(L('Khác biệt cytochrome C', 'Cytochrome C differences'))} />
      <p className="heredity__note">
        {Lz(
          L(
            'Các loài có họ hàng càng gần thì trình tự amino acid trong protein càng giống nhau. Cytochrome C của người và tinh tinh không khác nhau: thời gian tiến hóa từ tổ tiên chung còn chưa đủ dài để đột biến tạo nên sự khác biệt.',
            'The closer two species, the more alike their proteins. Human and chimpanzee cytochrome C do not differ: too little time has passed since their common ancestor for mutations to show.',
          ),
        )}
      </p>
    </div>
  );
}

function TimescaleView() {
  const Lz = useLocalized();
  const n = useN();
  const id = useEvolution((s) => s.period);
  const p = GEOLOGIC.find((x) => x.id === id);
  // Older periods last much longer: each band's width shows its share of the Phanerozoic only, so
  // that the short periods stay readable; the two earliest eons are drawn as one block each.
  const phanerozoic = GEOLOGIC.filter((x) => x.eon === 'Phanerozoic');
  const span = phanerozoic.reduce((s, x) => s + duration(x), 0);
  return (
    <div className="bio-scroll heredity">
      <p className="heredity__cross">
        {Lz(
          L(
            'Bảng 22.1: các đại địa chất (triệu năm trước)',
            'Table 22.1: geological time (million years ago)',
          ),
        )}
      </p>
      <div
        className="evo-strip"
        role="group"
        aria-label={Lz(L('Các kỉ, từ cổ đến nay', 'Periods, oldest first'))}
      >
        {[...GEOLOGIC].reverse().map((x) => (
          <button
            key={x.id}
            type="button"
            className={cx(
              'evo-strip__band',
              `evo-strip__band--${x.eon.toLowerCase()}`,
              x.id === id && 'evo-strip__band--on',
            )}
            style={x.eon === 'Phanerozoic' ? { flexGrow: duration(x) / span } : undefined}
            aria-pressed={x.id === id}
            onClick={() => {
              restoreEvolution({ period: x.id });
            }}
          >
            {Lz(x.name).split(' (')[0]}
          </button>
        ))}
      </div>
      {p && (
        <dl className="evo-detail">
          <dt>{Lz(L('Kỉ', 'Period'))}</dt>
          <dd className="evo-detail__name">{Lz(p.name)}</dd>
          <dt>{Lz(L('Đại, siêu đại', 'Era, eon'))}</dt>
          <dd>
            {[geoName(p.era), geoName(p.eon)]
              .filter((x): x is LocalizedText => x !== null)
              .map((x) => Lz(x))
              .join(' · ')}
          </dd>
          <dt>{Lz(L('Thời gian', 'Time'))}</dt>
          <dd className="mono">
            {`${n(p.from_mya)} – ${p.to_mya === null ? Lz(L('nay', 'now')) : n(p.to_mya)} ${Lz(L('triệu năm trước', 'million years ago'))}`}
          </dd>
          <dt>{Lz(L('Sự kiện quan trọng', 'Main events'))}</dt>
          <dd className="evo-detail__event">{Lz(p.event)}</dd>
        </dl>
      )}
      <ul className="heredity__result">
        <li>
          {Lz(
            L(
              `Trái Đất hình thành khoảng ${n(EARTH_FORMED_MYA)} triệu năm trước; hóa thạch tế bào nhân sơ cổ nhất khoảng ${n(PROKARYOTE_FOSSILS_MYA)}, tế bào nhân thực khoảng ${n(EUKARYOTE_FOSSILS_MYA)} triệu năm trước.`,
              `Earth formed about ${n(EARTH_FORMED_MYA)} million years ago; the oldest prokaryote fossils are about ${n(PROKARYOTE_FOSSILS_MYA)}, eukaryote fossils about ${n(EUKARYOTE_FOSSILS_MYA)} million years old.`,
            ),
          )}
        </li>
        {HOMININS.map((h) => (
          <li key={h.id}>
            <i>{h.name}</i>
            {`: ${h.from_mya === h.to_mya ? n(h.from_mya) : `${n(h.from_mya)} – ${h.to_mya === null ? Lz(L('nay', 'now')) : n(h.to_mya)}`} ${Lz(L('triệu năm trước', 'million years ago'))}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EvolutionStage() {
  const Lz = useLocalized();
  const tab = useEvolution((s) => s.tab);
  usePublishCard(EVOLUTION_CARD);
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(EVOLUTION_TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
      </div>
      {tab === 'molecular' ? <MolecularView /> : <TimescaleView />}
    </div>
  );
}

export function EvolutionPanel() {
  const Lz = useLocalized();
  const tab = useEvolution((s) => s.tab);
  return (
    <div className="chem-form">
      <Segmented<EvolutionTab>
        label={L('Phần bài học', 'Part')}
        value={tab}
        options={EVOLUTION_TABS.map((t) => ({ id: t, label: TAB_NAME[t] }))}
        onChange={(t) => {
          restoreEvolution({ tab: t });
        }}
      />
      <p className="small">
        {Lz(
          tab === 'molecular'
            ? L(
                'Bài 19: ngoài bằng chứng phân tử còn có bằng chứng hóa thạch, giải phẫu so sánh (cấu trúc tương đồng như chi trước của người, mèo, cá voi, dơi) và tế bào học.',
                'Lesson 19: besides molecular evidence there are fossils, comparative anatomy (homologous forelimbs of humans, cats, whales, bats) and cell biology.',
              )
            : L(
                'Bài 22: chọn một kỉ trên dải thời gian để xem các sự kiện quan trọng. Độ rộng mỗi kỉ của Hiển sinh gần theo độ dài thời gian (kỉ quá ngắn vẫn đủ rộng để chọn); Nguyên sinh và Thái cổ dài hơn rất nhiều nên vẽ thu gọn.',
                'Lesson 22: pick a period on the strip to see its main events. Phanerozoic periods are drawn roughly to scale (very short ones stay wide enough to pick); the far longer Proterozoic and Archean are drawn compressed.',
              ),
        )}
      </p>
    </div>
  );
}
