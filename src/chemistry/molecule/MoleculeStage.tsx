import { Eye, LoaderCircle, Tag, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { IconButton } from '@/ui/IconButton';
import { CSRC, L, usePublishCard } from '../common';
import { ELEMENTS_SOURCE } from '../data/elements';
import {
  MOLECULES_SOURCE,
  findMolecules,
  moleculeById,
  prettyFormula,
  type Molecule,
} from '../data/molecules';
import { METHOD_LABEL } from './labels';
import { MoleculeViewer } from './MoleculeViewer';
import { inspectSmiles, type SmilesInfo } from './rdkit';
import { pickAtom, pickBond, selectMolecule, useMoleculeStore, type MoleculeTopic } from './store';
import '../chem.css';

/** Molecules offered as quick picks for each topic. */
const QUICK: Record<MoleculeTopic, string[]> = {
  molecule3d: ['h2o', 'nh3', 'ch4', 'co2', 'c2h4', 'c2h2', 'c6h6', 'c2h5oh', 'ch3cooh', 'glucose'],
  vsepr: [
    'becl2',
    'co2',
    'bf3',
    'so2',
    'ch4',
    'nh3',
    'h2o',
    'pcl5',
    'sf4',
    'clf3',
    'xef2',
    'sf6',
    'xef4',
  ],
  bondPolarity: [
    'h2',
    'hcl',
    'h2o',
    'co2',
    'nh3',
    'ch4',
    'ccl4',
    'chcl3',
    'bf3',
    'so2',
    'hcn',
    'c2h5oh',
  ],
};

const TITLES: Record<MoleculeTopic, LocalizedText> = {
  molecule3d: L('Phân tử 3D', '3D molecules'),
  vsepr: L('Hình học phân tử (VSEPR)', 'Molecular geometry (VSEPR)'),
  bondPolarity: L('Độ phân cực liên kết', 'Bond polarity'),
};

function cardFor(topic: MoleculeTopic, m: Molecule): ScienceCardData {
  const method = m.geometry_method;
  const assumptions: LocalizedText[] = [
    L(
      'Cấu trúc là một cấu dạng ở pha khí, không phải trung bình dao động nhiệt.',
      'The structure is one gas-phase conformer, not a thermal average.',
    ),
  ];
  if (topic === 'vsepr' || topic === 'molecule3d') {
    assumptions.push(
      L(
        'Số cặp electron tự do tính từ công thức Lewis: E = (e hóa trị − điện tích − tổng bậc liên kết)/2. Vị trí vẽ các cặp electron tự do chỉ minh họa.',
        'Lone pairs from the Lewis formula: E = (valence e − charge − Σ bond orders)/2. Their drawn positions are illustrative.',
      ),
    );
  }
  if (topic === 'bondPolarity') {
    assumptions.push(
      L(
        'Loại liên kết theo hiệu độ âm điện Pauling: Δχ < 0,4 cộng hóa trị không phân cực; 0,4 ≤ Δχ < 1,7 phân cực; Δχ ≥ 1,7 ion (quy ước SGK).',
        'Bond type from the Pauling difference: Δχ < 0.4 non-polar; 0.4 ≤ Δχ < 1.7 polar; Δχ ≥ 1.7 ionic (textbook convention).',
      ),
      L(
        'Độ phân cực phân tử: tổng vectơ các momen liên kết (tỉ lệ Δχ). Đây là dự đoán định tính; ví dụ PH₃ có Δχ ≈ 0 nhưng vẫn phân cực nhẹ do cặp electron tự do.',
        'Molecular polarity: vector sum of bond dipoles (∝ Δχ). Qualitative; e.g. PH₃ has Δχ ≈ 0 yet is slightly polar due to its lone pair.',
      ),
    );
  }
  return {
    title: TITLES[topic],
    model: METHOD_LABEL[method],
    equations:
      topic === 'bondPolarity'
        ? [
            { tex: '\\Delta\\chi = |\\chi_A - \\chi_B|' },
            { tex: '\\vec{\\mu} \\propto \\sum \\Delta\\chi_i\\,\\hat{e}_i' },
          ]
        : topic === 'vsepr'
          ? [{ tex: '\\text{AX}_n\\text{E}_m:\\ n + m = \\text{số hướng electron}' }]
          : [],
    assumptions,
    confidence:
      topic === 'bondPolarity'
        ? 'qualitative'
        : method === 'experimental'
          ? 'exact'
          : method === 'vsepr-ideal'
            ? 'qualitative'
            : 'approx',
    confidenceNote:
      method === 'mmff94' || method === 'uff'
        ? L(
            'Test tự động: độ dài liên kết lệch < 0,03 Å và góc lệch < 3° so với thực nghiệm (H₂O, NH₃, CH₄, C₂H₄, C₂H₂, C₆H₆, HCN, C₂H₆).',
            'Automated test: bond lengths within 0.03 Å and angles within 3° of experiment (H₂O, NH₃, CH₄, C₂H₄, C₂H₂, C₆H₆, HCN, C₂H₆).',
          )
        : method === 'vsepr-ideal'
          ? L(
              'Góc lý tưởng; độ dài liên kết chỉ gần đúng.',
              'Ideal angles; bond lengths are approximate.',
            )
          : L('Số liệu thực nghiệm tra cứu.', 'Looked-up experimental data.'),
    userIntervened: false,
    sources: [
      MOLECULES_SOURCE,
      ELEMENTS_SOURCE,
      topic === 'vsepr' ? CSRC.gillespie : CSRC.rdkit,
      CSRC.sgk10,
    ],
    reviewStatus: 'pending',
  };
}

export function MoleculeStage({ topic }: { topic: MoleculeTopic }) {
  const Lz = useLocalized();
  const st = useMoleculeStore(
    useShallow((s) => ({
      id: s.id,
      atoms: s.atoms,
      bond: s.bond,
      lonePairs: s.lonePairs,
      labels: s.labels,
      dipole: s.dipole,
      query: s.query,
    })),
  );
  const molecule = moleculeById(st.id) ?? moleculeById('h2o');
  const card = useMemo(() => (molecule ? cardFor(topic, molecule) : null), [topic, molecule]);
  usePublishCard(card);
  const [open, setOpen] = useState(false);
  const [smiles, setSmiles] = useState<
    { state: 'idle' | 'loading' | 'invalid' } | { state: 'ok'; info: SmilesInfo }
  >({
    state: 'idle',
  });
  const results = useMemo(() => findMolecules(st.query).slice(0, 40), [st.query]);
  const looksLikeSmiles =
    /^[A-Za-z0-9@+\-[\]()=#$/\\%.]+$/.test(st.query.trim()) && st.query.trim().length > 1;

  // Unknown input that looks like SMILES → RDKit (2D only).
  useEffect(() => {
    if (!st.query.trim() || results.length > 0 || !looksLikeSmiles) return;
    let alive = true;
    const t = window.setTimeout(() => {
      setSmiles({ state: 'loading' });
      void inspectSmiles(st.query.trim())
        .then((info) => {
          if (alive) setSmiles(info ? { state: 'ok', info } : { state: 'invalid' });
        })
        .catch(() => {
          if (alive) setSmiles({ state: 'invalid' });
        });
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [st.query, results.length, looksLikeSmiles]);

  if (!molecule) return null;
  const showSmiles = st.query.trim() !== '' && results.length === 0;

  return (
    <div className="chem-view chem-view--flush">
      {showSmiles ? (
        <SmilesView state={smiles} />
      ) : (
        <MoleculeViewer
          molecule={molecule}
          lonePairs={st.lonePairs}
          labels={st.labels}
          dipole={st.dipole}
          selectedAtoms={st.atoms}
          selectedBond={st.bond}
          polarityColors={topic === 'bondPolarity'}
          onPickAtom={pickAtom}
          onPickBond={pickBond}
          ariaLabel={`${Lz(molecule.name)} — ${prettyFormula(molecule.display_formula)}`}
        />
      )}
      <div className="chem-overlay">
        <div className="mol-search">
          <input
            type="search"
            value={st.query}
            placeholder={Lz(
              L('Tìm: nước, ethanol, C2H6O, CCO…', 'Search: water, ethanol, C2H6O, CCO…'),
            )}
            aria-label={Lz(
              L(
                'Tìm phân tử theo tên, công thức hoặc SMILES',
                'Find a molecule by name, formula or SMILES',
              ),
            )}
            onFocus={() => {
              setOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setOpen(false);
              }, 150);
            }}
            onChange={(e) => {
              useMoleculeStore.setState({ query: e.target.value });
              setSmiles({ state: 'idle' });
              setOpen(true);
            }}
          />
          {open && results.length > 0 && (
            <ul className="mol-search__list" role="listbox">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={m.id === molecule.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={() => {
                      selectMolecule(m.id);
                      useMoleculeStore.setState({ query: '' });
                      setOpen(false);
                    }}
                  >
                    <span>{Lz(m.name)}</span>
                    <span className="mol-search__formula">{prettyFormula(m.display_formula)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          className="mol-chips"
          role="group"
          aria-label={Lz(L('Phân tử gợi ý', 'Suggested molecules'))}
        >
          {QUICK[topic].map((id) => {
            const m = moleculeById(id);
            if (!m) return null;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={id === molecule.id && !showSmiles}
                onClick={() => {
                  selectMolecule(id);
                  useMoleculeStore.setState({ query: '' });
                }}
              >
                {prettyFormula(m.display_formula)}
              </button>
            );
          })}
        </div>
        <IconButton
          icon={Tag}
          size="sm"
          label={Lz(L('Hiện/ẩn nhãn nguyên tử', 'Show/hide atom labels'))}
          active={st.labels}
          onClick={() => {
            useMoleculeStore.setState((s) => ({ labels: !s.labels }));
          }}
        />
        <IconButton
          icon={Eye}
          size="sm"
          label={Lz(
            L('Hiện/ẩn cặp electron tự do (minh họa)', 'Show/hide lone pairs (illustrative)'),
          )}
          active={st.lonePairs}
          onClick={() => {
            useMoleculeStore.setState((s) => ({ lonePairs: !s.lonePairs }));
          }}
        />
      </div>
      {!showSmiles && (
        <div className="mol-footer">
          <span className="chem-chip">{Lz(METHOD_LABEL[molecule.geometry_method])}</span>
          <span className="chem-chip">
            {Lz(
              L(
                'Kéo để xoay · lăn chuột để phóng to · Shift+nhấp để đo',
                'Drag to rotate · wheel to zoom · Shift+click to measure',
              ),
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function SmilesView({
  state,
}: {
  state: { state: 'idle' | 'loading' | 'invalid' } | { state: 'ok'; info: SmilesInfo };
}) {
  const Lz = useLocalized();
  return (
    <div className="mol-2d">
      <div>
        {state.state === 'loading' && (
          <p className="muted">
            <LoaderCircle className="spin" size={16} aria-hidden="true" />{' '}
            {Lz(L('Đang kiểm tra bằng RDKit…', 'Checking with RDKit…'))}
          </p>
        )}
        {(state.state === 'invalid' || state.state === 'idle') && (
          <p className="muted">
            {Lz(
              L(
                'Không tìm thấy trong thư viện. Nếu bạn nhập SMILES, app sẽ kiểm tra hóa trị bằng RDKit.',
                'Not in the library. If you type a SMILES string, the app checks valences with RDKit.',
              ),
            )}
            {state.state === 'invalid' && ` ${Lz(L('SMILES không hợp lệ.', 'Invalid SMILES.'))}`}
          </p>
        )}
        {state.state === 'ok' && (
          <>
            <p className="chem-note chem-note--warn" role="note">
              <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>
                {Lz(
                  L(
                    'Phân tử này chưa có trong thư viện đã kiểm chứng — chỉ hiển thị cấu trúc 2D, chưa có cấu trúc 3D.',
                    'This molecule is not in the verified library — 2D structure only, no 3D structure.',
                  ),
                )}
              </span>
            </p>
            {/* Rendered as an image so nothing in the SVG can run as page content. */}
            <img
              className="mol-2d__img"
              alt={state.info.canonical}
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(state.info.svg)}`}
            />
            <p className="mono">
              {prettyFormula(state.info.formula)} · {state.info.canonical}
              {state.info.molarMass !== null && ` · M = ${state.info.molarMass.toFixed(2)} g/mol`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
