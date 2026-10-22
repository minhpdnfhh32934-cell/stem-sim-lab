/**
 * "Con mồi – vật ăn thịt (Lotka–Volterra)" in 3D: prey and predators in one habitat whose
 * numbers follow the computed trajectory, two columns x(t), y(t) on one scale and the phase-plane
 * board behind the meadow. Over the picture: the lesson's chips (as over its 2D plot) and the
 * drawing scale. Under it the time slider drawn over the x(t) and y(t) curves themselves (it steps
 * through the computed samples), the moment's numbers and the framing ("Toàn cảnh" or "Cận cảnh
 * đàn"); the time chart under the stage marks the same moment. A tap on an animal, the columns or
 * the board opens its card and moves in on it (either framing button closes the card). In the
 * corner: "Hiện tên". Animals, places, motion, clover, plants and the board's look are
 * illustration (caption); every number is the model's.
 */
import { Pause, Play, RotateCcw, Tags, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useTierConfig } from '@/perf/perfStore';
import { IconButton } from '@/ui/IconButton';
import { prefersReducedMotion } from '@/ui/three/availability';
import { L } from '../../common';
import { useCardHeadFit } from '../../division/mitosis3d/partCardHead';
import { useFmt } from '../../fmt';
import { Segmented } from '../../ui';
import { Bio3DView, type SceneSpec } from '../../view3d/Bio3DView';
import { usePlayback, type Playback } from '../../view3d/playback';
import { useScrollMore } from '../../view3d/useScrollMore';
import { LvChips } from '../chips';
import { useLvData } from '../data';
import { useLv } from '../store';
import {
  curvePoints,
  figureCap,
  lvModel3d,
  momentAt,
  parseSelection,
  playSeconds,
  selectionId,
  type LvModel3D,
  type LvMoment,
  type LvSelection,
} from './binding';
import {
  CALLOUTS,
  CAPTION,
  SOURCES,
  readout,
  scaleText,
  sceneTexts,
  selectionCard,
  type Fmt,
} from './facts';
import { LV_VIEW } from './layout';
import { buildLvHabitat } from './scene';
import { useLv3D, type LvCameraMode } from './store';

/** The animals move on their own for this long after a change, then the picture rests. */
const LIVELY_MS = 6000;

const path = (pts: [number, number][]) =>
  pts
    .map(([u, v], i) => `${i ? 'L' : 'M'}${(u * 100).toFixed(2)} ${(100 - v * 100).toFixed(2)}`)
    .join(' ');

/** The x(t) and y(t) curves behind the time slider (SVG on the columns' scale). */
function CurveTrack({
  model,
  moment,
  playback,
  label,
}: {
  model: LvModel3D;
  moment: LvMoment;
  playback: Playback;
  label: string;
}) {
  const curves = useMemo(() => {
    const c = curvePoints(model);
    return { prey: path(c.prey), predators: path(c.predators) };
  }, [model]);
  const u = model.tEnd > 0 ? moment.t / model.tEnd : 0;
  const steps = Math.max(1, model.traj.t.length - 1);
  const dot = (v: number, kind: 'prey' | 'predators') => (
    <i
      className={`lv3d__dot lv3d__dot--${kind}`}
      style={{ left: `${(u * 100).toFixed(2)}%`, top: `${((1 - v) * 100).toFixed(2)}%` }}
    />
  );
  return (
    <div className="lv3d__track">
      <div className="lv3d__curve" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="lv3d__path lv3d__path--prey" d={curves.prey} />
          <path className="lv3d__path lv3d__path--predators" d={curves.predators} />
        </svg>
        {dot(moment.fill.prey, 'prey')}
        {dot(moment.fill.predators, 'predators')}
      </div>
      <input
        type="range"
        aria-label={label}
        min={0}
        max={model.tEnd}
        step={model.tEnd / steps}
        value={moment.t}
        onChange={(e) => {
          playback.setT(Number(e.target.value));
        }}
      />
    </div>
  );
}

/**
 * The framings: the whole habitat, or the herd close up. While a card is open the camera frames
 * the picked part, so neither is checked; either one closes the card.
 */
function Framing({ camera, picked }: { camera: LvCameraMode; picked: boolean }) {
  return (
    <Segmented<LvCameraMode | 'pick'>
      label={L('Góc nhìn', 'View')}
      value={picked ? 'pick' : camera}
      options={[
        { id: 'overview', label: L('Toàn cảnh', 'Whole habitat') },
        { id: 'closeup', label: L('Cận cảnh đàn', 'Herd close up') },
      ]}
      onChange={(v) => {
        if (v !== 'pick') useLv3D.setState({ camera: v, selected: null });
      }}
    />
  );
}

function TimePlayer({
  playback,
  model,
  moment,
  fmt,
  camera,
  picked,
}: {
  playback: Playback;
  model: LvModel3D;
  moment: LvMoment;
  fmt: Fmt;
  camera: LvCameraMode;
  picked: boolean;
}) {
  const Lz = useLocalized();
  return (
    <div className="bio3d__player lv3d__player">
      <IconButton
        icon={Play}
        altIcon={Pause}
        showAlt={playback.playing}
        size="lg"
        variant="solid"
        label={playback.playing ? Lz(L('Tạm dừng', 'Pause')) : Lz(L('Phát', 'Play'))}
        onClick={playback.toggle}
      />
      <IconButton
        icon={RotateCcw}
        size="lg"
        label={Lz(L('Phát lại từ đầu', 'Replay from the start'))}
        onClick={playback.replay}
      />
      <CurveTrack
        model={model}
        moment={moment}
        playback={playback}
        label={Lz(L('Thời gian t', 'Time t'))}
      />
      <output aria-live="off">{readout(moment, fmt)}</output>
      <Framing camera={camera} picked={picked} />
    </div>
  );
}

function PartCard({
  model,
  moment,
  selected,
  fmt,
}: {
  model: LvModel3D;
  moment: LvMoment;
  selected: LvSelection;
  fmt: Fmt;
}) {
  const Lz = useLocalized();
  const slotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useCardHeadFit(slotRef, cardRef, headRef);
  const card = selectionCard(model, moment, selected, fmt);
  useScrollMore(cardRef, card ? card.lines.map((l) => l.vi).join('|') : '');
  if (!card) return null;
  return (
    <div ref={slotRef} className="m3d__info-slot">
      <aside ref={cardRef} className="m3d__info lv3d__card" aria-live="polite" data-inset="right">
        <div ref={headRef} className="m3d__info-head">
          <strong>{Lz(card.title)}</strong>
          <div className="m3d__info-actions">
            <IconButton
              icon={X}
              size="lg"
              label={Lz(L('Bỏ chọn', 'Clear selection'))}
              onClick={() => {
                useLv3D.setState({ selected: null });
              }}
            />
          </div>
        </div>
        <div className="m3d__info-body">
          {card.lines.map((line) => (
            <p key={line.vi} className="small">
              {Lz(line)}
            </p>
          ))}
          <p className="small muted m3d__sources">{Lz(SOURCES)}</p>
        </div>
      </aside>
    </div>
  );
}

export function Lv3DView() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useLv();
  const { p, traj, drift } = useLvData();
  const tier = useTierConfig();
  const cap = figureCap(tier.maxParticles);
  const model = useMemo(
    () => lvModel3d({ p, traj, tEnd: st.tEnd, drift }, cap),
    [p, traj, st.tEnd, drift, cap],
  );
  const modelKey = JSON.stringify([
    st.alpha,
    st.beta,
    st.delta,
    st.gamma,
    st.x0,
    st.y0,
    st.tEnd,
    cap,
  ]);
  const playback = usePlayback(st.tEnd, {
    start: 0,
    autoplay: true,
    seconds: playSeconds(st.tEnd),
  });
  const moment = momentAt(model, playback.t);
  const selected = useLv3D((s) => s.selected);
  const camera = useLv3D((s) => s.camera);
  // "Hiện tên": on unless the learner turned it off.
  const labelsOn = useLv3D((s) => s.labels) ?? true;

  // The chart under the stage marks the computed sample shown while this view is on screen.
  useLayoutEffect(() => {
    useLv3D.setState({ t: moment.t, active: true });
  }, [moment.t]);
  useEffect(
    () => () => {
      useLv3D.setState({ active: false, selected: null });
    },
    [],
  );
  // A picked animal that is no longer drawn (another moment, another model) is unpicked.
  useEffect(() => {
    const s = useLv3D.getState().selected;
    if (
      (s?.kind === 'prey' && s.slot >= moment.shown.prey) ||
      (s?.kind === 'predator' && s.slot >= moment.shown.predators)
    )
      useLv3D.setState({ selected: null });
  }, [moment.shown.prey, moment.shown.predators]);

  // The animals move for a few seconds after each change, then the picture rests (on demand).
  const liveKey = `${modelKey}|${String(moment.k)}`;
  const [restingKey, setRestingKey] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setRestingKey(liveKey);
    }, LIVELY_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, [liveKey]);
  const lively = restingKey !== liveKey && !prefersReducedMotion();

  const texts = sceneTexts(model, fmt, Lz);
  const callouts = useMemo(
    () =>
      labelsOn
        ? Object.fromEntries(Object.entries(CALLOUTS).map(([id, text]) => [id, Lz(text)]))
        : null,
    [labelsOn, Lz],
  );
  const scale = Lz(scaleText(model.per, fmt));
  const scene: SceneSpec = {
    build: (kit) => buildLvHabitat(kit, { model, texts }),
    buildKey: JSON.stringify([modelKey, texts]),
    label: Lz(
      L(
        `Con mồi và vật ăn thịt: ${readout(moment, fmt)}; ${String(moment.shown.prey)} hình con mồi, ${String(moment.shown.predators)} hình vật ăn thịt (${scale}); cân bằng (x*, y*) = (${fmt(model.eq.x, 4)}; ${fmt(model.eq.y, 4)}).`,
        `Prey and predators: ${readout(moment, fmt)}; ${String(moment.shown.prey)} prey figures, ${String(moment.shown.predators)} predator figures (${scale}); equilibrium (x*, y*) = (${fmt(model.eq.x, 4)}; ${fmt(model.eq.y, 4)}).`,
      ),
    ),
    time: playback.t,
    running: (playback.playing && !prefersReducedMotion()) || lively,
    viewDir: LV_VIEW,
    aspect: 2.2,
    look: 'outdoor',
    selected: selectionId(selected),
    onPick: (id) => {
      useLv3D.setState({ selected: parseSelection(id) });
    },
    // A pick moves in on what it picked (the scene's frame of that id), beside its card; else the
    // learner's framing ('overview' is no frame: the whole subject).
    view: selectionId(selected) ?? camera,
    callouts,
  };
  return (
    <Bio3DView
      lesson="lotkaVolterra"
      className="lv3d"
      scene={scene}
      top={
        <>
          <LvChips />
          <span className="chem-chip chem-chip--qual" data-chip="scale">
            {scale}
          </span>
        </>
      }
      tools={
        <IconButton
          icon={Tags}
          size="lg"
          active={labelsOn}
          label={Lz(L('Hiện tên các phần', 'Show the names of the parts'))}
          tooltipSide="left"
          onClick={() => {
            useLv3D.setState({ labels: !labelsOn });
          }}
        />
      }
      bottom={
        <TimePlayer
          playback={playback}
          model={model}
          moment={moment}
          fmt={fmt}
          camera={camera}
          picked={selected !== null}
        />
      }
      info={
        selected ? (
          <PartCard model={model} moment={moment} selected={selected} fmt={fmt} />
        ) : undefined
      }
      caption={Lz(CAPTION)}
    />
  );
}
