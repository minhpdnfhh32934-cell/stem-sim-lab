import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { usePublishCard } from '@/modules/usePublishCard';
import { ChoiceGroup } from '@/ui/ModuleControls';
import { MoleculeViewer } from '../molecule/MoleculeViewer';
import { L, REACTIONS_TITLE, STRUCTURE_TITLE, reactionsCard, structureCard } from './card';
import {
  COMPLEXES,
  SUBSTITUTIONS,
  chargeSum,
  complex,
  complexModel,
  complexText,
  coordination,
  ligandText,
  metalText,
  substitutionBalanced,
  substitutionText,
  type Complex,
} from './model';
import {
  REACTION_TABS,
  setComplex,
  setComplexReaction,
  useComplexReactionStore,
  useComplexStore,
  type ReactionTab,
} from './store';
import './complexes.css';

const GEOMETRY_NAME: Record<string, LocalizedText> = {
  octahedral: L('bát diện', 'octahedral'),
  square_planar: L('vuông phẳng', 'square planar'),
};

/** Where the book states the geometry (or why the app draws none). */
function geometryText(c: Complex): LocalizedText {
  const n = coordination(c);
  if (c.geometry) {
    const name = GEOMETRY_NAME[c.geometry] ?? L(c.geometry, c.geometry);
    const why =
      c.geometry_from === 'cisplatin'
        ? L('theo cấu tạo cisplatin sách vẽ (tr. 140)', 'as the book draws cisplatin (p. 140)')
        : c.geometry_from === 'q3' || c.geometry_from === 'q3b'
          ? L('sách nêu trong câu hỏi', 'stated in the book’s question')
          : L(
              'phức chất aqua [M(H₂O)₆]ⁿ⁺, hầu hết có dạng bát diện (tr. 136)',
              'an aqua complex [M(H₂O)₆]ⁿ⁺, mostly octahedral (p. 136)',
            );
    return L(`${name.vi} (${why.vi})`, `${name.en} (${why.en})`);
  }
  if (n === 6)
    return L(
      'sách không nêu riêng; trong Bảng 28.1, dạng có 6 phối tử là bát diện',
      'not stated by the book; in Table 28.1 the shape with 6 ligands is octahedral',
    );
  if (n === 4)
    return L(
      'sách không nêu; Bảng 28.1 có hai dạng với 4 phối tử: tứ diện và vuông phẳng',
      'not stated by the book; Table 28.1 has two shapes with 4 ligands: tetrahedral and square planar',
    );
  return L(
    `Bảng 28.1 không có dạng hình học với ${n} phối tử`,
    `Table 28.1 has no shape with ${n} ligands`,
  );
}

/* ───────── Bài 28: structure ───────── */

export function StructureStage() {
  const Lz = useLocalized();
  const { id, labels } = useComplexStore();
  const c = complex(id);
  const model = useMemo(() => complexModel(c), [c]);
  const card = useMemo(() => structureCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view complexes">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(STRUCTURE_TITLE)}</strong>
        </span>
      </div>
      <div className="cx-view">
        <div className="cx-info">
          <p className="cx-formula">{complexText(c)}</p>
          <dl className="cx-facts">
            <dt>{Lz(L('Nguyên tử trung tâm', 'Central atom'))}</dt>
            <dd className="cx-facts__metal">{metalText(c)}</dd>
            <dt>{Lz(L('Phối tử', 'Ligands'))}</dt>
            <dd>{c.ligands.map((l) => `${l.count} ${ligandText(l.ligand)}`).join(', ')}</dd>
            <dt>{Lz(L('Số phối tử', 'Ligand count'))}</dt>
            <dd className="mono cx-facts__cn">{coordination(c)}</dd>
            <dt>{Lz(L('Điện tích', 'Charge'))}</dt>
            <dd className="mono cx-facts__charge">{chargeSum(c)}</dd>
            <dt>{Lz(L('Dạng hình học', 'Geometry'))}</dt>
            <dd className="cx-facts__geometry">{Lz(geometryText(c))}</dd>
            {c.colour && (
              <>
                <dt>{Lz(L('Màu trong dung dịch', 'Colour'))}</dt>
                <dd>{Lz(c.colour)}</dd>
              </>
            )}
          </dl>
        </div>
        {model ? (
          <div className="cx-3d">
            <MoleculeViewer
              molecule={model}
              lonePairs={false}
              labels={labels}
              dipole={false}
              selectedAtoms={[]}
              selectedBond={null}
              ariaLabel={Lz(
                L(
                  `Mô hình ${complexText(c)}: ${GEOMETRY_NAME[c.geometry ?? '']?.vi ?? ''}`,
                  `Model of ${complexText(c)}: ${GEOMETRY_NAME[c.geometry ?? '']?.en ?? ''}`,
                ),
              )}
            />
            <p className="cx-3d__note">
              {Lz(
                L(
                  'Mỗi phối tử được vẽ bằng nguyên tử cho cặp electron; kéo để xoay.',
                  'Each ligand is drawn as its donor atom; drag to turn.',
                ),
              )}
            </p>
          </div>
        ) : (
          <p className="cx-note">
            {Lz(
              L(
                'Không vẽ mô hình 3D vì sách không nêu dạng hình học của phức chất này.',
                'No 3D model: the book does not state this complex’s geometry.',
              ),
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export function StructurePanel() {
  const Lz = useLocalized();
  const { id, labels } = useComplexStore();
  return (
    <div className="chem-form complexes-panel">
      <label>
        <span>{Lz(L('Phức chất trong sách', 'Complex in the book'))}</span>
        <select
          value={id}
          onChange={(e) => {
            setComplex({ id: e.target.value });
          }}
        >
          {COMPLEXES.map((c) => (
            <option key={c.id} value={c.id}>{`${complexText(c)} (tr. ${c.page})`}</option>
          ))}
        </select>
      </label>
      <ChoiceGroup
        label={Lz(L('Tên nguyên tử trên mô hình', 'Atom labels'))}
        items={['on', 'off'] as const}
        value={labels ? 'on' : 'off'}
        name={(v) => Lz(v === 'on' ? L('Hiện', 'Show') : L('Ẩn', 'Hide'))}
        onPick={(v) => {
          setComplex({ labels: v === 'on' });
        }}
        segmented
      />
      <p className="small">
        {Lz(
          L(
            'Liên kết giữa nguyên tử trung tâm và phối tử là liên kết cho – nhận: phối tử cho cặp electron chưa liên kết vào orbital trống của nguyên tử trung tâm (tr. 136).',
            'The bond between the central atom and a ligand is dative: the ligand gives a lone pair into an empty orbital of the central atom (p. 136).',
          ),
        )}
      </p>
    </div>
  );
}

/* ───────── Bài 29: reactions ───────── */

const TAB_NAME: Record<ReactionTab, LocalizedText> = {
  signs: L('Dấu hiệu tạo phức', 'Signs of complex formation'),
  substitution: L('Thế phối tử', 'Ligand substitution'),
};

/** The Cu²⁺ experiments of tr. 138–139, in order. */
const CU_STEPS = [
  { id: 'cu_h2o_6', how: L('Dung dịch CuSO₄', 'CuSO₄ solution') },
  { id: 'cu_oh_2_h2o_4', how: L('Nhỏ vài giọt dung dịch NH₃', 'A few drops of NH₃') },
  { id: 'cu_nh3_4_h2o_2', how: L('Nhỏ dung dịch NH₃ đến dư', 'NH₃ until in excess') },
] as const;

function SignsView() {
  const Lz = useLocalized();
  return (
    <div className="cx-view cx-view--column">
      <h3 className="cx-head">
        {Lz(L('Phức chất của Cu²⁺ (tr. 138–139)', 'Complexes of Cu²⁺ (pp. 138–139)'))}
      </h3>
      <ol className="cx-steps">
        {CU_STEPS.map((s) => {
          const c = complex(s.id);
          return (
            <li key={s.id} className="cx-step">
              <span className="cx-step__how">{Lz(s.how)}</span>
              <strong className="cx-step__formula">{complexText(c)}</strong>
              <span className="cx-step__colour">{c.colour ? Lz(c.colour) : ''}</span>
            </li>
          );
        })}
      </ol>
      <p className="cx-note">
        {Lz(
          L(
            `Nhỏ vài giọt HCl đặc vào dung dịch CuSO₄ loãng: dung dịch chuyển từ màu xanh sang màu vàng do tạo ${complexText(complex('cucl4'))}.`,
            `Concentrated HCl in dilute CuSO₄: the solution turns from blue to yellow as ${complexText(complex('cucl4'))} forms.`,
          ),
        )}
      </p>
      <p className="cx-note">
        {Lz(
          L(
            'Dấu hiệu của phản ứng tạo phức chất: xuất hiện kết tủa, hòa tan kết tủa, thay đổi màu sắc.',
            'Signs of complex formation: a precipitate forms, a precipitate dissolves, the colour changes.',
          ),
        )}
      </p>
    </div>
  );
}

function SubstitutionView() {
  const Lz = useLocalized();
  const id = useComplexReactionStore((s) => s.substitution);
  const s = SUBSTITUTIONS.find((x) => x.id === id);
  if (!s) return null;
  const before = complex(s.before);
  const after = complex(s.after);
  return (
    <div className="cx-view cx-view--column">
      <p className="cx-eq">{substitutionText(s)}</p>
      <dl className="cx-facts">
        <dt>{Lz(L('Phối tử bị thế', 'Ligands replaced'))}</dt>
        <dd>{`${s.leaving_count} ${ligandText(s.leaving)}`}</dd>
        <dt>{Lz(L('Phối tử mới', 'New ligands'))}</dt>
        <dd>{`${s.entering_count} ${ligandText(s.entering)}`}</dd>
        <dt>{Lz(L('Số phối tử', 'Ligand count'))}</dt>
        <dd className="mono">{`${coordination(before)} → ${coordination(after)}`}</dd>
        <dt>{Lz(L('Bảo toàn điện tích', 'Charge kept'))}</dt>
        <dd className="cx-balance">
          {Lz(substitutionBalanced(s) ? L('Có', 'Yes') : L('Không', 'No'))}
        </dd>
        {before.colour && after.colour && (
          <>
            <dt>{Lz(L('Màu sắc', 'Colour'))}</dt>
            <dd>{`${Lz(before.colour)} → ${Lz(after.colour)}`}</dd>
          </>
        )}
      </dl>
      <p className="cx-note">
        {Lz(
          L(
            'Phản ứng thế phối tử thuận lợi khi phức chất mới bền hơn phức chất ban đầu (tr. 140).',
            'A substitution is favoured when the new complex is more stable than the first (p. 140).',
          ),
        )}
      </p>
    </div>
  );
}

export function ReactionsStage() {
  const Lz = useLocalized();
  const tab = useComplexReactionStore((s) => s.tab);
  const card = useMemo(() => reactionsCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view complexes">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(REACTIONS_TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
      </div>
      {tab === 'signs' ? <SignsView /> : <SubstitutionView />}
    </div>
  );
}

export function ReactionsPanel() {
  const Lz = useLocalized();
  const { tab, substitution } = useComplexReactionStore();
  return (
    <div className="chem-form complexes-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={REACTION_TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setComplexReaction({ tab: t });
        }}
        segmented
      />
      {tab === 'substitution' && (
        <ChoiceGroup
          label={Lz(L('Phản ứng trong sách', 'Reaction in the book'))}
          items={SUBSTITUTIONS.map((s) => s.id)}
          value={substitution}
          name={(sid) =>
            complexText(complex(SUBSTITUTIONS.find((s) => s.id === sid)?.before ?? 'cu_h2o_6'))
          }
          onPick={(sid) => {
            setComplexReaction({ substitution: sid });
          }}
        />
      )}
      <p className="small">
        {Lz(
          L(
            'Ứng dụng: cisplatin chữa bệnh ung thư; [Ag(NH₃)₂]⁺ phân biệt aldehyde với ketone; nhiều phản ứng dùng phức chất làm xúc tác (tr. 140–141).',
            'Uses: cisplatin treats cancer; [Ag(NH₃)₂]⁺ tells aldehydes from ketones; many reactions use complexes as catalysts (pp. 140–141).',
          ),
        )}
      </p>
    </div>
  );
}

/** The colours the book gives (tr. 138–139). */
export function ColourBottom() {
  const Lz = useLocalized();
  return (
    <table className="cx-table">
      <caption>
        {Lz(L('Màu sắc của một số phức chất (SGK)', 'Colours of some complexes (textbook)'))}
      </caption>
      <tbody>
        {COMPLEXES.filter((c) => c.colour).map((c) => (
          <tr key={c.id}>
            <th scope="row">{complexText(c)}</th>
            <td>{c.colour ? Lz(c.colour) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
