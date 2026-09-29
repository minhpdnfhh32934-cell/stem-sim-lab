import { Info, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import type { ScienceCardData } from '@/science-card/types';
import { cx } from '@/ui/cx';
import {
  ELEMENTS_SOURCE,
  aufbauPrediction,
  configString,
  electronsPerShell,
  elementByZ,
  energyOrder,
  hundBoxes,
  isAufbauException,
  shellOrder,
  shorthand,
  unpairedElectrons,
} from '../data/elements';
import { CSRC, L, usePublishCard } from '../common';
import { ElementPicker } from '../periodic/ElementPicker';
import { usePeriodicStore } from '../periodic/store';
import '../chem.css';

const SHELL_LETTERS = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];

const CARD: ScienceCardData = {
  title: L('Cấu hình electron', 'Electron configuration'),
  model: L(
    'Cấu hình electron trạng thái cơ bản của nguyên tử tự do, lấy từ bảng dữ liệu thực nghiệm (NIST). Không suy ra từ quy tắc Aufbau.',
    'Ground-state configuration of the free atom, taken from the experimental data table (NIST). Not derived from the Aufbau rule.',
  ),
  equations: [
    {
      tex: '1s < 2s < 2p < 3s < 3p < 4s < 3d < 4p < 5s < 4d < \\dots',
      label: L('Thứ tự mức năng lượng (quy tắc n + l)', 'Energy order (n + l rule)'),
    },
  ],
  assumptions: [
    L(
      'Sơ đồ ô orbital điền electron theo quy tắc Hund (tối đa số electron độc thân) trong từng phân lớp.',
      "Orbital boxes are filled by Hund's rule (maximum unpaired electrons) within each subshell.",
    ),
    L(
      'Với Cr, Cu, Mo, Ag, Pd, Au… cấu hình thực tế khác dự đoán Aufbau; app luôn hiển thị cấu hình thực tế.',
      'For Cr, Cu, Mo, Ag, Pd, Au… the real configuration differs from the Aufbau prediction; the app always shows the real one.',
    ),
    L(
      'Cấu hình của các nguyên tố siêu nặng (Z > 103) là dự đoán lý thuyết.',
      'Configurations of superheavy elements (Z > 103) are theoretical predictions.',
    ),
  ],
  confidence: 'exact',
  confidenceNote: L('Số liệu tra cứu từ bảng dữ liệu.', 'Looked up from the data table.'),
  userIntervened: false,
  sources: [ELEMENTS_SOURCE, CSRC.nistAsd, CSRC.sgk10],
  reviewStatus: 'pending',
};

/** Electron configuration of the selected element with an orbital box diagram. */
export function ConfigStage() {
  usePublishCard(CARD);
  const Lz = useLocalized();
  const z = usePeriodicStore((s) => s.selected);
  const e = elementByZ(z);
  const exception = e ? isAufbauException(e) : false;
  const predicted = useMemo(() => configString(shellOrder(aufbauPrediction(z))), [z]);
  if (!e) return null;
  const shells = electronsPerShell(e);
  const outer = shells[shells.length - 1] ?? 0;

  return (
    <div className="chem-view">
      <div className="chem-toolbar">
        <ElementPicker />
      </div>

      <p className="econf__label">{Lz(L('Theo thứ tự mức năng lượng', 'In energy order'))}</p>
      <p className="econf__big">{configString(energyOrder(e.configuration))}</p>
      <p className="econf__label">{Lz(L('Viết theo lớp (đáp án SGK)', 'Grouped by shell'))}</p>
      <p className="econf__big">{configString(shellOrder(e.configuration))}</p>
      <p className="econf__label">{Lz(L('Viết gọn', 'Noble-gas shorthand'))}</p>
      <p className="econf__big">{shorthand(e)}</p>

      <p className="chem-note" role="note">
        <Info size={15} strokeWidth={1.75} aria-hidden="true" />
        <span>
          {Lz(
            L(
              `Lớp electron: ${shells.map((n, i) => `${SHELL_LETTERS[i] ?? i + 1}: ${n}`).join(' · ')}. Lớp ngoài cùng có ${outer} electron; ${unpairedElectrons(e)} electron độc thân.`,
              `Shells: ${shells.map((n, i) => `${SHELL_LETTERS[i] ?? i + 1}: ${n}`).join(' · ')}. Outer shell: ${outer} electrons; ${unpairedElectrons(e)} unpaired.`,
            ),
          )}
        </span>
      </p>
      {exception && (
        <p className="chem-note chem-note--warn" role="note">
          <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>
            {Lz(
              L(
                `Ngoại lệ: cấu hình thực tế của ${e.symbol} khác dự đoán theo quy tắc Aufbau (${predicted}). App dùng cấu hình thực tế từ bảng dữ liệu.`,
                `Exception: the real configuration of ${e.symbol} differs from the Aufbau prediction (${predicted}). The app uses the real configuration from the data table.`,
              ),
            )}
          </span>
        </p>
      )}

      <p className="econf__label">{Lz(L('Sơ đồ ô orbital', 'Orbital box diagram'))}</p>
      <div className="econf__boxes">
        {energyOrder(e.configuration).map(([n, l, k]) => (
          <div
            key={`${n}${l}`}
            className={cx('econf__sub', exception && (l === 'd' || l === 's') && 'is-exception')}
          >
            <div className="econf__sub-row" role="img" aria-label={`${n}${l} ${k} electron`}>
              {hundBoxes(l, k).map((b, i) => (
                <span key={i} className="econf__box" aria-hidden="true">
                  {b === 2 ? '↑↓' : b === 1 ? '↑' : ''}
                </span>
              ))}
            </div>
            <span className="econf__sub-name">
              {n}
              {l}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
