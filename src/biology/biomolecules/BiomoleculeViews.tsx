import { Tags } from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { cx } from '@/ui/cx';
import { IconButton } from '@/ui/IconButton';
import { L, usePublishCard } from '../common';
import { Segmented } from '../ui';
import { Bio3DToolbar } from '../view3d/switch';
import { useShow3d } from '../view3d/support';
import { MOLECULE_CAPTION, biomoleculeCard } from './card';
import {
  BIOMOLECULES,
  GROUPS,
  GROUP_INFO,
  PART_NAME,
  biomolecule,
  moleculesOf,
  type Biomolecule,
  type GroupId,
} from './data';
import { drawMolecule } from './draw2d';
import { setGroup, setMolecule, useBiomolecules } from './store';
import '../bio.css';
import '../sh10.css';

const Molecule3DView = lazy(() =>
  import('./Molecule3DView').then((m) => ({ default: m.Molecule3DView })),
);

const SHORT: Record<GroupId, ReturnType<typeof L>> = {
  carbohydrate: L('Carbohydrate', 'Carbohydrates'),
  lipid: L('Lipid', 'Lipids'),
  protein: L('Protein', 'Proteins'),
  nucleicAcid: L('Nucleic acid', 'Nucleic acids'),
};

/** The molecule shown (the store's id is always one of the data's). */
function useMolecule(): Biomolecule {
  const id = useBiomolecules((s) => s.molecule);
  return biomolecule(id) ?? (BIOMOLECULES[0] as Biomolecule);
}

/** "Hiện tên": the learner's choice, else on in Basic mode. */
function useShowNames(): boolean {
  const choice = useBiomolecules((s) => s.labels);
  const basic = useSettingsStore((s) => s.uiMode === 'basic');
  return choice ?? basic;
}

function NamesButton({ on }: { on: boolean }) {
  const Lz = useLocalized();
  return (
    <IconButton
      icon={Tags}
      size="lg"
      active={on}
      label={Lz(L('Hiện tên các nhóm', 'Show group names'))}
      onClick={() => {
        useBiomolecules.setState({ labels: !on });
      }}
    />
  );
}

/**
 * "Các phân tử sinh học": the representative molecule in 3D (loaded when shown), or its 2D
 * picture on a weak device, without WebGL 2, after a lost context or by the learner's choice.
 */
export function BiomoleculeStage() {
  const { show3d } = useShow3d('biomolecules');
  const m = useMolecule();
  const showNames = useShowNames();
  const card = useMemo(() => biomoleculeCard(m), [m]);
  usePublishCard(card);
  if (show3d)
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Molecule3DView
          molecule={m}
          tools={m.parts.length > 0 ? <NamesButton on={showNames} /> : undefined}
          showNames={showNames}
        />
      </Suspense>
    );
  return <Molecule2D molecule={m} showNames={showNames} />;
}

function Molecule2D({ molecule: m, showNames }: { molecule: Biomolecule; showNames: boolean }) {
  const Lz = useLocalized();
  const part = useBiomolecules((s) => s.part);
  const names = useMemo(
    () => (showNames ? Object.fromEntries(m.parts.map((p) => [p.id, Lz(PART_NAME[p.id])])) : null),
    [m, showNames, Lz],
  );
  const ref = useCanvas(
    (d) => {
      drawMolecule(d, m, names, part);
    },
    false,
    [m, names, part],
  );
  return (
    <div className="bio-view">
      <canvas ref={ref} className="chem-canvas" role="img" aria-label={Lz(m.name)} />
      <div className="chem-overlay">
        {m.parts.length > 0 && <NamesButton on={showNames} />}
        <span className="chem-chip chem-chip--approx">{Lz(L('Gần đúng', 'Approximate'))}</span>
        <Bio3DToolbar lesson="biomolecules" />
      </div>
      <p className="bio-caption">{Lz(MOLECULE_CAPTION)}</p>
    </div>
  );
}

/**
 * Inspector: the four groups, the group's monomer and text, the molecule shown (formula, molar
 * mass, PubChem CID) and its parts (buttons ≥ 40 px; a click highlights the part).
 */
export function BiomoleculePanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const group = useBiomolecules((s) => s.group);
  const part = useBiomolecules((s) => s.part);
  const m = useMolecule();
  const g = GROUP_INFO[group];
  return (
    <div className="cell-parts bm-panel">
      <Segmented<GroupId>
        label={L('Nhóm phân tử sinh học', 'Group of biomolecules')}
        value={group}
        options={GROUPS.map((id) => ({ id, label: SHORT[id] }))}
        onChange={setGroup}
      />
      <h4 className="m3d-parts__title">{Lz(g.name)}</h4>
      <p>
        <strong>{Lz(L('Đơn phân', 'Monomer'))}:</strong> {Lz(g.monomer)}
      </p>
      <p className="small">{Lz(g.text)}</p>
      {moleculesOf(group).length > 1 && (
        <Segmented<string>
          label={L('Phân tử', 'Molecule')}
          value={m.id}
          options={moleculesOf(group).map((x) => ({ id: x.id, label: x.name }))}
          onChange={setMolecule}
        />
      )}
      <p data-testid="biomol-formula">
        <strong>{Lz(m.name)}</strong>: {m.display_formula} · M ={' '}
        {formatNumber(locale, m.molar_mass, { maximumFractionDigits: 2 })} g/mol · PubChem CID{' '}
        {m.cid}
      </p>
      {m.parts.length > 0 && (
        <>
          <h4 className="m3d-parts__title">
            {Lz(L('Các nhóm trong phân tử', 'Groups in the molecule'))}
          </h4>
          <div
            className="m3d-parts__list"
            role="group"
            aria-label={Lz(L('Các nhóm trong phân tử', 'Groups in the molecule'))}
          >
            {m.parts.map((p) => {
              const on = part === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={cx('m3d-parts__item', on && 'is-active')}
                  aria-pressed={on}
                  onClick={() => {
                    useBiomolecules.setState({ part: on ? null : p.id });
                  }}
                >
                  {Lz(PART_NAME[p.id])}
                </button>
              );
            })}
          </div>
        </>
      )}
      <p className="small muted">
        {Lz(L('Nguồn chữ', 'Text'))}: SGK Sinh học 10 KNTT, tr. {g.pages} ·{' '}
        {Lz(L('chờ giáo viên duyệt', 'awaiting teacher review'))}
      </p>
    </div>
  );
}
