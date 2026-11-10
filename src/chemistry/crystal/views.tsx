import { useMemo, useState } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { L, usePublishCard } from '../common';
import { elementBySymbol } from '../data/elements';
import { crystalCard } from './card';
import { countLine } from './count';
import { CrystalViewer } from './CrystalViewer';
import {
  coordination,
  CRYSTALS,
  packingFraction,
  unitCell,
  type CrystalId,
  type SiteKind,
} from './lattice';
import { CRYSTAL_NAME, KIND_NAME, SHORT_NAME } from './names';
import { useCrystalStore } from './store';
import './crystal.css';

const NOT_TO_SCALE = L('Hình minh họa — không theo tỉ lệ', 'Illustration — not to scale');
const KINDS: Record<CrystalId, SiteKind[]> = {
  bcc: ['M'],
  fcc: ['M'],
  hcp: ['M'],
  nacl: ['Na', 'Cl'],
};

function swatch(kind: SiteKind): string {
  return kind === 'M' ? 'var(--chart-2)' : (elementBySymbol(kind)?.jmol_color ?? 'currentColor');
}

export function CrystalStage() {
  const Lz = useLocalized();
  const id = useCrystalStore((s) => s.id);
  const cell = useMemo(() => unitCell(id), [id]);
  const card = useMemo(() => crystalCard(id), [id]);
  usePublishCard(card);
  const [failed, setFailed] = useState(false);
  const counts = KINDS[id].map((k) => `${countLine(id, k)} ${Lz(KIND_NAME[k])}`).join('; ');
  return (
    <div className="chem-view crystal">
      {failed ? (
        <p className="chem-note crystal__fallback" role="note">
          {Lz(
            L(
              'Máy này chưa vẽ được hình 3D; số liệu ô mạng vẫn ở bảng bên.',
              'This computer cannot draw the 3D picture; the cell figures are in the side panel.',
            ),
          )}
        </p>
      ) : (
        <CrystalViewer
          cell={cell}
          label={`${Lz(CRYSTAL_NAME[id])}: ${counts}`}
          onFail={() => {
            setFailed(true);
          }}
        />
      )}
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong>{Lz(CRYSTAL_NAME[id])}</strong>
        </span>
        <span className="chem-chip">
          {KINDS[id].map((k) => (
            <span key={k} className="crystal__legend">
              <span className="rx-swatch" style={{ background: swatch(k) }} /> {Lz(KIND_NAME[k])}
            </span>
          ))}
        </span>
        <span className="chem-chip chem-chip--approx">{Lz(NOT_TO_SCALE)}</span>
      </div>
    </div>
  );
}

export function CrystalPanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const id = useCrystalStore((s) => s.id);
  const eta = packingFraction(id);
  const cn = KINDS[id].map((k) => coordination(id, k).n);
  return (
    <div className="chem-form crystal-panel">
      <div
        className="segmented"
        role="radiogroup"
        aria-label={Lz(L('Kiểu mạng tinh thể', 'Crystal structure'))}
      >
        {CRYSTALS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={id === c}
            className="segmented__item"
            title={Lz(CRYSTAL_NAME[c])}
            onClick={() => {
              useCrystalStore.setState({ id: c });
            }}
          >
            {Lz(SHORT_NAME[c])}
          </button>
        ))}
      </div>
      <dl className="crystal-facts">
        <dt>{Lz(L('Số hạt trong một ô', 'Particles per cell'))}</dt>
        {KINDS[id].map((k) => (
          <dd key={k}>
            <span className="mono">{countLine(id, k)}</span> {Lz(KIND_NAME[k])}
          </dd>
        ))}
        <dt>{Lz(L('Số phối trí', 'Coordination number'))}</dt>
        <dd className="mono">{cn.join(' : ')}</dd>
        <dt>{Lz(L('Độ đặc khít', 'Packing fraction'))}</dt>
        <dd>
          {eta === null ? (
            Lz(L('— (cần bán kính hai ion)', '— (needs the two ionic radii)'))
          ) : (
            <span className="mono">
              {formatNumber(locale, eta * 100, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{' '}
              %
            </span>
          )}
        </dd>
      </dl>
      <p className="small muted">
        {Lz(
          L(
            'Đếm từ toạ độ của ô: đỉnh, mặt, cạnh và tâm góp phần khác nhau vào một ô.',
            'Counted from the cell’s coordinates: corners, faces, edges and the centre count differently.',
          ),
        )}
      </p>
    </div>
  );
}
