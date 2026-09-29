import constants from '@data/constants.json';
import elements from '@data/elements.json';
import geneticCode from '@data/genetic_code.json';
import molecules from '@data/molecules.json';
import reactions from '@data/reactions.json';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { BSRC } from '@/biology/common';
import { CSRC } from '@/chemistry/common';
import type { LocalizedText, Source } from '@/core/data/dataset';
import { SRC } from '@/physics/common/sources';
import { IconButton } from '@/ui/IconButton';
import { useProjectUi } from './uiStore';

const L = (vi: string, en: string): LocalizedText => ({ vi, en });

/** The app's scientific-integrity rules (MASTER_PROMPT §2), stated for the judges. */
const PRINCIPLES: LocalizedText[] = [
  L(
    'Mọi con số do chương trình tính bằng mô hình ghi trong Thẻ Khoa học. AI chỉ đọc đề (trích số liệu có trong đề) và diễn giải kết quả bằng lời; diễn giải chứa số không có trong kết quả bị ẩn.',
    'Every number is computed by the program from the model stated in the Science Card. The AI only reads the problem (extracting numbers that appear in it) and explains results in words; explanations with foreign numbers are hidden.',
  ),
  L(
    'Giá trị mặc định (ví dụ g) do chương trình điền và luôn được đánh dấu "mặc định". Phần đề chưa hỗ trợ được báo rõ, không làm tròn hay xấp xỉ âm thầm.',
    'Defaults (e.g. g) are filled in by the program and always marked "default". Unsupported parts of a problem are reported, never silently approximated.',
  ),
  L(
    'Mỗi mô phỏng có mức tin cậy: chính xác (khớp lời giải giải tích), gần đúng (tích phân số có kiểm soát sai số), định tính (chỉ minh họa). Khi người dùng kéo vật bằng chuột, kết quả chuyển sang "gần đúng".',
    'Each simulation has a confidence level: exact (matches the analytic solution), approximate (numerical integration with error control), qualitative (illustration only). Dragging objects turns results into "approximate".',
  ),
  L(
    'Cơ chế phản ứng chỉ hiển thị cho phản ứng trong thư viện đã tuyển chọn có nguồn; chuyển động giữa các bước là "chuyển tiếp minh họa — không phải quỹ đạo nguyên tử thực".',
    'Reaction mechanisms are shown only for curated, cited reactions; motion between steps is an "illustrative transition — not real atomic trajectories".',
  ),
  L(
    'Cấu hình electron lấy từ bảng dữ liệu (có ngoại lệ Cr, Cu…), không suy ra từ quy tắc Aufbau.',
    'Electron configurations come from the data table (with the Cr, Cu… exceptions), not from the Aufbau rule.',
  ),
  L(
    'Khi máy quá tải, ứng dụng giảm độ mượt (chất lượng hiển thị, chuyển động chậm có ghi tỉ lệ) chứ không giảm độ chính xác.',
    'Under overload the app sacrifices smoothness (display quality, labelled slow motion), never accuracy.',
  ),
];

interface DatasetRow {
  name: LocalizedText;
  source: Source;
  items: { review_status?: string }[];
  file: string;
}

const DATASETS: DatasetRow[] = [
  { name: L('Hằng số vật lý', 'Physical constants'), file: 'data/constants.json', ...constants },
  { name: L('118 nguyên tố', '118 elements'), file: 'data/elements.json', ...elements },
  { name: L('Phân tử 3D', '3D molecules'), file: 'data/molecules.json', ...molecules },
  {
    name: L('Phản ứng và cơ chế', 'Reactions and mechanisms'),
    file: 'data/reactions.json',
    ...reactions,
  },
  { name: L('Bảng mã di truyền', 'Genetic code'), file: 'data/genetic_code.json', ...geneticCode },
];

const REFERENCES: { subject: LocalizedText; list: Source[] }[] = [
  { subject: L('Vật lý', 'Physics'), list: Object.values(SRC) },
  { subject: L('Hóa học', 'Chemistry'), list: Object.values(CSRC) },
  { subject: L('Sinh học', 'Biology'), list: Object.values(BSRC) },
];

function Citation({ s }: { s: Source }) {
  return (
    <>
      {s.citation}
      {s.url && (
        <>
          {' '}
          <span className="mono small muted">({s.url})</span>
        </>
      )}
    </>
  );
}

/** "Nguồn & Giả định": every source, dataset and assumption in one place. */
export default function SourcesDialog() {
  const t = useT();
  const Lz = useLocalized();
  const ref = useRef<HTMLDialogElement>(null);
  const card = useWorkspaceStore((s) => s.scienceCard);
  const close = () => {
    useProjectUi.setState({ sourcesOpen: false });
  };

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog dialog--wide sources"
      aria-labelledby="sources-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header className="dialog__header">
        <h2 id="sources-title">{t('sourcesPage.title')}</h2>
        <IconButton icon={X} label={t('sourcesPage.close')} onClick={close} tooltipSide="left" />
      </header>
      <div className="dialog__body">
        <p className="small muted">{t('sourcesPage.intro')}</p>

        <h3>{t('sourcesPage.principles')}</h3>
        <ol className="sources__list">
          {PRINCIPLES.map((p) => (
            <li key={p.en}>{Lz(p)}</li>
          ))}
        </ol>

        <h3>{t('sourcesPage.current')}</h3>
        {card ? (
          <div className="sources__current">
            <p>
              <strong>{Lz(card.title)}</strong> — {Lz(card.model)}
            </p>
            <ul className="sources__list">
              {card.assumptions.map((a) => (
                <li key={a.en}>{Lz(a)}</li>
              ))}
            </ul>
            <ul className="sources__list sources__refs">
              {card.sources
                .filter((s, i, all) => all.findIndex((o) => o.id === s.id) === i)
                .map((s) => (
                  <li key={s.id}>
                    <Citation s={s} />
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          <p className="small muted">{t('sourcesPage.noCurrent')}</p>
        )}

        <h3>{t('sourcesPage.datasets')}</h3>
        <table className="chem-table sources__table">
          <tbody>
            {DATASETS.map((d) => {
              const pending = d.items.filter((i) => i.review_status !== 'verified').length;
              return (
                <tr key={d.file}>
                  <th scope="row">
                    {Lz(d.name)}
                    <div className="mono small muted">{d.file}</div>
                  </th>
                  <td>
                    <Citation s={d.source} />
                  </td>
                  <td className="num">
                    {t('sourcesPage.items', { n: d.items.length })}
                    <div className={pending > 0 ? 'sources__pending' : 'sources__verified'}>
                      {pending > 0
                        ? `${String(pending)} ${t('sourcesPage.pending')}`
                        : t('sourcesPage.verified')}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3>{t('sourcesPage.references')}</h3>
        {REFERENCES.map((g) => (
          <section key={g.subject.en}>
            <h4>{Lz(g.subject)}</h4>
            <ul className="sources__list sources__refs">
              {g.list.map((s) => (
                <li key={s.id}>
                  <Citation s={s} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </dialog>
  );
}
