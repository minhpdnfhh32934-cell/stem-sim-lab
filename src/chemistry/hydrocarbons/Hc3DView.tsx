/**
 * The 3D view of "Alkane, alkene, alkyne, arene" (three.js side, loaded when the learner picks
 * 3D): the chosen series' straight-chain member with n carbons in the app's molecule viewer, from
 * the coordinates of `data/molecules.json` — or a note when that compound has none.
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { L } from '../common';
import { formatFormula } from '../formula';
import { MoleculeViewer } from '../molecule/MoleculeViewer';
import { MEMBERS } from './model';
import { memberAt, moleculeFor } from './molecule3d';
import { useHcStore } from './store';
// The molecule viewer's layout (.mol-viewer) lives with the molecule lessons' styles.
import '../chem.css';

export function Hc3DView({ top }: { top: ReactNode }) {
  const Lz = useLocalized();
  const { cls, n } = useHcStore();
  const member = memberAt(cls, n);
  const mol = moleculeFor(member);
  const available = MEMBERS.filter((m) => m.class === cls && m.straight && moleculeFor(m)).map(
    (m) => m.name,
  );
  return (
    <div className="chem-view chem-view--flush hc-3d">
      {mol && member ? (
        <MoleculeViewer
          molecule={mol}
          lonePairs={false}
          labels={false}
          dipole={false}
          selectedAtoms={[]}
          selectedBond={null}
          ariaLabel={`${member.name} — ${member.formula}`}
        />
      ) : (
        <p className="hc-3d__missing">
          {Lz(
            L(
              `Dữ liệu của app chưa có tọa độ 3D của ${member?.name ?? `chất có n = ${String(n)}`}, nên không vẽ (không tự tạo tọa độ). Các chất của dãy này có hình 3D: ${available.join(', ')}.`,
              `The app’s data has no 3D coordinates for ${member?.name ?? `the member with n = ${String(n)}`}, so none is drawn (no coordinates are made up). Members of this series with a 3D shape: ${available.join(', ')}.`,
            ),
          )}
        </p>
      )}
      <div className="chem-overlay">
        {top}
        {member && (
          <span className="chem-chip mono">{`${member.name} · ${formatFormula(member.formula)}`}</span>
        )}
      </div>
      {mol && (
        <p className="hc-3d__caption">
          {Lz(
            L(
              'Mô hình 3D lấy từ dữ liệu phân tử của app (tọa độ tính bằng RDKit, trường lực MMFF94, như bài Phân tử 3D). Kéo để xoay, cuộn để phóng to.',
              'The 3D model comes from the app’s molecule data (coordinates from RDKit, MMFF94 force field, as in the Molecules in 3D lesson). Drag to turn, scroll to zoom.',
            ),
          )}
        </p>
      )}
    </div>
  );
}
