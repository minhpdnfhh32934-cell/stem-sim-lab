/**
 * "Từ tế bào đến DNA": the stage (3D view, or the 2D picture on Low tier / without WebGL 2 /
 * after a lost context / by choice), the zoom controls and the inspector (the six levels and the
 * sizes of the one shown). No three.js here: the 3D view loads only when it is shown.
 */
import { Tags, ZoomIn, ZoomOut } from 'lucide-react';
import { Suspense, lazy, useEffect, useMemo, type ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { cx } from '@/ui/cx';
import { IconButton } from '@/ui/IconButton';
import { L, usePublishCard } from '../../common';
import { useFmt } from '../../fmt';
import { useShow3d } from '../../view3d/support';
import { Bio3DToolbar } from '../../view3d/switch';
import { TRANSITION, levelCaption, levelCard } from './card';
import { drawZoom } from './draw2d';
import {
  LEVELS,
  LEVEL_FACTS,
  LEVEL_NAME,
  SIZES,
  levelInfo,
  sourceOf,
  type LevelFact,
} from './levels';
import { GLIDE_MS, useLength, useNames, useShowNames, zoomIn, zoomOut } from './hooks';
import { setZoomLevel, useCellZoom } from './store';
import '../../bio.css';

const Zoom3DView = lazy(() => import('./Zoom3DView').then((m) => ({ default: m.Zoom3DView })));

/** A printed size: "≈ 700 nm" / "8" (counts). */
function useFactValue(): (f: LevelFact) => string {
  const fmt = useFmt();
  const len = useLength();
  return (f) => {
    const s = SIZES[f.key];
    if (s.unit === 'count') return fmt(s.value);
    return `≈ ${len(s.unit === 'µm' ? s.value * 1000 : s.value)}`;
  };
}

function NamesButton() {
  const Lz = useLocalized();
  const on = useShowNames();
  return (
    <IconButton
      icon={Tags}
      size="lg"
      active={on}
      label={Lz(L('Hiện tên các phần', 'Show part names'))}
      onClick={() => {
        useCellZoom.setState({ labels: !on });
      }}
    />
  );
}

/** Level chip, the main size of the level, and "not to scale" while moving between levels. */
export function ZoomChips() {
  const Lz = useLocalized();
  const level = useCellZoom((s) => s.level);
  const moving = useCellZoom((s) => s.moving);
  const value = useFactValue();
  const id = levelInfo(level).id;
  const main = LEVEL_FACTS[id][0];
  return (
    <>
      <span className="chem-chip">
        {Lz(L('Cấp', 'Level'))} {level + 1}/{LEVELS.length} · {Lz(LEVEL_NAME[id])}
      </span>
      {main && (
        <span className="chem-chip">
          {Lz(main.label)} {value(main)}
        </span>
      )}
      {moving && <span className="chem-chip chem-chip--qual">{Lz(TRANSITION)}</span>}
    </>
  );
}

/** "Thu nhỏ" / "Phóng to": one step down or up the six levels. */
export function ZoomButtons({ glide }: { glide: boolean }) {
  const Lz = useLocalized();
  const level = useCellZoom((s) => s.level);
  const moving = useCellZoom((s) => s.moving);
  const next = LEVEL_NAME[levelInfo(level + 1).id];
  return (
    <div className="zoom__buttons">
      <button type="button" className="btn" disabled={moving || level === 0} onClick={zoomOut}>
        <ZoomOut size={18} aria-hidden="true" />
        {Lz(L('Thu nhỏ', 'Zoom out'))}
      </button>
      <button
        type="button"
        className="btn btn--accent"
        disabled={moving || level === LEVELS.length - 1}
        title={level < LEVELS.length - 1 ? Lz(next) : undefined}
        onClick={() => {
          zoomIn(glide);
        }}
      >
        <ZoomIn size={18} aria-hidden="true" />
        {Lz(L('Phóng to', 'Zoom in'))}
      </button>
    </div>
  );
}

function Zoom2D() {
  const Lz = useLocalized();
  const level = useCellZoom((s) => s.level);
  const names = useNames(level);
  const len = useLength();
  const bar = len(levelInfo(level).barNm);
  const ref = useCanvas(
    (d) => {
      drawZoom(d, level, names, bar);
    },
    false,
    [level, names, bar],
  );
  return (
    <div className="bio-view zoom2d">
      <canvas
        ref={ref}
        className="chem-canvas"
        role="img"
        aria-label={Lz(LEVEL_NAME[levelInfo(level).id])}
      />
      <div className="chem-overlay">
        <ZoomChips />
        <NamesButton />
        <Bio3DToolbar lesson="cellToDna" />
      </div>
      <div className="zoom__bottom">
        <ZoomButtons glide={false} />
        <p className="bio-caption">{Lz(levelCaption(levelInfo(level).id))}</p>
      </div>
    </div>
  );
}

export function CellZoomStage() {
  const level = useCellZoom((s) => s.level);
  const moving = useCellZoom((s) => s.moving);
  const { show3d } = useShow3d('cellToDna');
  const id = levelInfo(level).id;
  const card = useMemo(() => levelCard(id), [id]);
  usePublishCard(card);
  // The glide ends with the next level; leaving the lesson mid-glide ends it at once.
  useEffect(() => {
    if (!moving) return;
    const t = window.setTimeout(() => {
      setZoomLevel(level + 1);
    }, GLIDE_MS);
    return () => {
      window.clearTimeout(t);
    };
  }, [moving, level]);
  useEffect(
    () => () => {
      useCellZoom.setState({ moving: false });
    },
    [],
  );
  if (show3d)
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Zoom3DView tools={<NamesButton />} />
      </Suspense>
    );
  return <Zoom2D />;
}

function Fact({ fact }: { fact: LevelFact }): ReactNode {
  const Lz = useLocalized();
  const value = useFactValue();
  const s = SIZES[fact.key];
  const where = s.pages.length
    ? `${Lz(L('tr.', 'p.'))} ${s.pages.join(', ')}${s.where ? ` · ${s.where}` : ''}`
    : s.where;
  return (
    <li>
      <strong>
        {Lz(fact.label)}: {value(fact)}
      </strong>
      <span className="small muted">
        {sourceOf(fact.key).citation} — {where}
      </span>
    </li>
  );
}

/** Inspector: the six levels (a click jumps there), then the printed sizes of the one shown. */
export function CellZoomPanel() {
  const Lz = useLocalized();
  const level = useCellZoom((s) => s.level);
  const moving = useCellZoom((s) => s.moving);
  const basic = useSettingsStore((s) => s.uiMode === 'basic');
  const len = useLength();
  const id = levelInfo(level).id;
  const title = Lz(L('Sáu cấp phóng to', 'Six zoom levels'));
  return (
    <div className="cell-parts zoom-panel">
      <h4 className="m3d-parts__title">{title}</h4>
      <div className="m3d-parts__list" role="group" aria-label={title}>
        {LEVELS.map((lv, i) => {
          const on = i === level;
          return (
            <button
              key={lv}
              type="button"
              className={cx('m3d-parts__item', on && 'is-active')}
              aria-pressed={on}
              disabled={moving}
              onClick={() => {
                setZoomLevel(i);
              }}
            >
              {i + 1}. {Lz(LEVEL_NAME[lv])}
              {!basic && (
                <span className="small muted">
                  {' '}
                  ({Lz(L('thước', 'bar'))} {len(levelInfo(i).barNm)})
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        <h4 className="m3d-parts__title">{Lz(LEVEL_NAME[id])}</h4>
        <ul className="zoom-facts">
          {LEVEL_FACTS[id].map((f) => (
            <Fact key={f.key} fact={f} />
          ))}
        </ul>
        <p className="small muted">{Lz(L('Chờ giáo viên duyệt', 'Awaiting teacher review'))}</p>
      </div>
    </div>
  );
}
