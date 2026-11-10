import { Tags } from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { cx } from '@/ui/cx';
import { IconButton } from '@/ui/IconButton';
import { L, usePublishCard } from '../common';
import { Segmented } from '../ui';
import { Bio3DToolbar } from '../view3d/switch';
import { useShow3d } from '../view3d/support';
import { CELL_ILLUSTRATION, cellCard } from './card';
import { drawCell } from './draw';
import { CELL_KINDS, CELL_KIND_NAME, PARTS, partsFor, type CellKind } from './parts';
import { setCellKind, useCell } from './store';
import '../bio.css';

const SHORT_NAME: Record<CellKind, ReturnType<typeof L>> = {
  bacterium: L('Vi khuẩn', 'Bacterium'),
  animal: L('Động vật', 'Animal'),
  plant: L('Thực vật', 'Plant'),
};

const Cell3DView = lazy(() =>
  import('./cell3d/Cell3DView').then((m) => ({ default: m.Cell3DView })),
);

/** "Hiện tên": the learner's choice, else on in Basic mode. */
function useShowNames(): boolean {
  const choice = useCell((s) => s.labels);
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
      label={Lz(L('Hiện tên các bộ phận', 'Show part names'))}
      onClick={() => {
        useCell.setState({ labels: !on });
      }}
    />
  );
}

/**
 * "Tế bào nhân sơ và nhân thực": the 3D cell (loaded when shown), or the 2D picture (Cell2D) on a
 * weak device, without WebGL 2, after a lost context or by the learner's choice.
 */
export function CellStage() {
  const { show3d } = useShow3d('cellStructure');
  const showNames = useShowNames();
  const kind = useCell((s) => s.kind);
  const card = useMemo(() => cellCard(kind), [kind]);
  usePublishCard(card);
  if (show3d)
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Cell3DView tools={<NamesButton on={showNames} />} showNames={showNames} />
      </Suspense>
    );
  return <Cell2D />;
}

function Cell2D() {
  const Lz = useLocalized();
  const kind = useCell((s) => s.kind);
  const selected = useCell((s) => s.selected);
  const showNames = useShowNames();
  const names = useMemo(
    () => Object.fromEntries(partsFor(kind).map((id) => [id, Lz(PARTS[id].name)])),
    [kind, Lz],
  );
  const ref = useCanvas(
    (d) => {
      drawCell(d, kind, names, selected, showNames);
    },
    false,
    [kind, names, selected, showNames],
  );
  return (
    <div className="bio-view cell2d">
      <canvas ref={ref} className="chem-canvas" role="img" aria-label={Lz(CELL_KIND_NAME[kind])} />
      <div className="chem-overlay">
        <NamesButton on={showNames} />
        <span className="chem-chip chem-chip--qual">{Lz(L('Định tính', 'Qualitative'))}</span>
        <Bio3DToolbar lesson="cellStructure" />
      </div>
      <p className="bio-caption">{Lz(CELL_ILLUSTRATION)}</p>
    </div>
  );
}

/**
 * Inspector (also the input panel of "Tự dựng cảnh"): the cell choice, then the cell's parts
 * (buttons ≥ 40 px); a click opens the part's name and function.
 */
export function CellPanel() {
  const Lz = useLocalized();
  const kind = useCell((s) => s.kind);
  const selected = useCell((s) => s.selected);
  const info = selected ? PARTS[selected] : null;
  const title = Lz(L('Bộ phận tế bào', 'Cell parts'));
  return (
    <div className="cell-parts">
      <Segmented<CellKind>
        label={L('Loại tế bào', 'Cell type')}
        value={kind}
        options={CELL_KINDS.map((id) => ({ id, label: SHORT_NAME[id] }))}
        onChange={setCellKind}
      />
      <h4 className="m3d-parts__title">{Lz(CELL_KIND_NAME[kind])}</h4>
      <div className="m3d-parts__list" role="group" aria-label={title}>
        {partsFor(kind).map((id) => {
          const on = selected === id;
          return (
            <button
              key={id}
              type="button"
              className={cx('m3d-parts__item', on && 'is-active')}
              aria-pressed={on}
              onClick={() => {
                useCell.setState({ selected: on ? null : id });
              }}
            >
              {Lz(PARTS[id].name)}
            </button>
          );
        })}
      </div>
      {/* Always mounted, so a screen reader announces the card that appears inside it. */}
      <div aria-live="polite">
        {info ? (
          <div className="cell-part-card">
            <strong>{Lz(info.name)}</strong>
            <p>{Lz(info.role)}</p>
            <p className="small muted">
              {Lz(L('Nguồn', 'Source'))}: {info.source.citation} ·{' '}
              {Lz(L('chờ giáo viên duyệt', 'awaiting teacher review'))}
            </p>
          </div>
        ) : (
          <p className="small muted">
            {Lz(
              L(
                'Chọn một bộ phận để xem tên và chức năng của nó.',
                'Pick a part to see its name and what it does.',
              ),
            )}
          </p>
        )}
      </div>
    </div>
  );
}
