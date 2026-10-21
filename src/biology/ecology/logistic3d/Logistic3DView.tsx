/**
 * "Tăng trưởng logistic" in 3D: the population in its habitat filling up as N(t) of the exact
 * solution grows towards K (or falls to it when N₀ > K). Over the picture: the lesson's chips
 * (the same as over its 2D chart) and the drawing scale. Under it the time slider drawn over the
 * N(t) curve itself (on the gauge's scale, K dashed, t* marked), "Tới t*" and the moment's
 * numbers; the dN/dt chart under the stage marks the same moment. A tap on an animal, the column
 * or the clover opens its card. In the corner: "Hiện tên" (name callouts). Animals, places,
 * fence, clover, plants and motion are illustration (caption); every number is the model's.
 */
import { Crosshair, Pause, Play, RotateCcw, Tags, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useTierConfig } from '@/perf/perfStore';
import { IconButton } from '@/ui/IconButton';
import { prefersReducedMotion } from '@/ui/three/availability';
import { L } from '../../common';
import { useCardHeadFit } from '../../division/mitosis3d/partCardHead';
import { useFmt } from '../../fmt';
import { Bio3DView, type SceneSpec } from '../../view3d/Bio3DView';
import { usePlayback, type Playback } from '../../view3d/playback';
import { useScrollMore } from '../../view3d/useScrollMore';
import { LogisticChips } from '../chips';
import { useLogistic } from '../store';
import {
  curvePoints,
  figureCap,
  logisticModel3d,
  momentAt,
  parseSelection,
  selectionId,
  tStarInRun,
  type LogiSelection,
  type LogisticModel3D,
  type LogisticMoment,
} from './binding';
import {
  CALLOUTS,
  CAPTION,
  SOURCES,
  gaugeMarks,
  momentLabel,
  readout,
  scaleText,
  selectionCard,
  type Fmt,
} from './facts';
import { LOGI_VIEW } from './layout';
import { buildLogisticHabitat } from './scene';
import { useLogistic3D } from './store';

/** Real seconds the whole time span plays in. */
const SECONDS = 10;
/** The animals move on their own for this long after a change, then the picture rests. */
const LIVELY_MS = 6000;

/** The N(t) curve behind the time slider (SVG, stretched to the track; strokes stay thin). */
function CurveTrack({
  model,
  moment,
  playback,
  label,
}: {
  model: LogisticModel3D;
  moment: LogisticMoment;
  playback: Playback;
  label: string;
}) {
  const path = useMemo(
    () =>
      curvePoints(model)
        .map(([u, v], i) => `${i ? 'L' : 'M'}${(u * 100).toFixed(2)} ${(100 - v * 100).toFixed(2)}`)
        .join(' '),
    [model],
  );
  const kY = 100 - (model.K / model.top) * 100;
  const star = tStarInRun(model) ? (model.tStar / model.tEnd) * 100 : null;
  const u = model.tEnd > 0 ? moment.t / model.tEnd : 0;
  const v = moment.fill;
  return (
    <div className="logi3d__track">
      <div className="logi3d__curve" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line className="logi3d__k" x1="0" x2="100" y1={kY} y2={kY} />
          {star !== null && <line className="logi3d__star" x1={star} x2={star} y1="0" y2="100" />}
          <path className="logi3d__path" d={path} />
        </svg>
        <i
          className="logi3d__dot"
          style={{ left: `${(u * 100).toFixed(2)}%`, top: `${((1 - v) * 100).toFixed(2)}%` }}
        />
      </div>
      <input
        type="range"
        aria-label={label}
        min={0}
        max={model.tEnd}
        step={model.tEnd / 400}
        value={moment.t}
        onChange={(e) => {
          playback.setT(Number(e.target.value));
        }}
      />
    </div>
  );
}

function TimePlayer({
  playback,
  model,
  moment,
  fmt,
}: {
  playback: Playback;
  model: LogisticModel3D;
  moment: LogisticMoment;
  fmt: Fmt;
}) {
  const Lz = useLocalized();
  const canStar = tStarInRun(model);
  return (
    <div className="bio3d__player logi3d__player">
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
      <button
        type="button"
        className="btn logi3d__star-btn"
        disabled={!canStar}
        title={Lz(
          canStar
            ? L(
                'Tới điểm uốn: N = K/2, tăng nhanh nhất',
                'Go to the inflection: N = K/2, fastest growth',
              )
            : L('Không có điểm uốn trong khoảng thời gian này', 'No inflection in this time span'),
        )}
        onClick={() => {
          playback.setT(model.tStar);
        }}
      >
        <Crosshair size={15} aria-hidden="true" /> {Lz(L('Tới t*', 'Go to t*'))}
      </button>
      <CurveTrack
        model={model}
        moment={moment}
        playback={playback}
        label={Lz(L('Thời gian t', 'Time t'))}
      />
      <output aria-live="off">{readout(moment, fmt)}</output>
    </div>
  );
}

function PartCard({
  model,
  moment,
  selected,
  fmt,
}: {
  model: LogisticModel3D;
  moment: LogisticMoment;
  selected: LogiSelection;
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
      <aside ref={cardRef} className="m3d__info logi3d__card" aria-live="polite" data-inset="right">
        <div ref={headRef} className="m3d__info-head">
          <strong>{Lz(card.title)}</strong>
          <div className="m3d__info-actions">
            <IconButton
              icon={X}
              size="lg"
              label={Lz(L('Bỏ chọn', 'Clear selection'))}
              onClick={() => {
                useLogistic3D.setState({ selected: null });
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

export function Logistic3DView() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useLogistic();
  const tier = useTierConfig();
  const cap = figureCap(tier.maxParticles);
  const model = useMemo(
    () => logisticModel3d({ N0: st.N0, r: st.r, K: st.K, tEnd: st.tEnd }, cap),
    [st.N0, st.r, st.K, st.tEnd, cap],
  );
  const modelKey = JSON.stringify([st.N0, st.r, st.K, st.tEnd, cap]);
  const playback = usePlayback(st.tEnd, { start: 0, autoplay: true, seconds: SECONDS });
  const moment = momentAt(model, playback.t);
  const selected = useLogistic3D((s) => s.selected);
  // "Hiện tên": on unless the learner turned it off.
  const labelsOn = useLogistic3D((s) => s.labels) ?? true;

  // The chart under the stage marks the moment shown while this view is on screen.
  useLayoutEffect(() => {
    useLogistic3D.setState({ t: playback.t, active: true });
  }, [playback.t]);
  useEffect(
    () => () => {
      useLogistic3D.setState({ active: false, selected: null });
    },
    [],
  );
  // A picked animal that is no longer drawn (earlier moment, another model) is unpicked.
  useEffect(() => {
    const s = useLogistic3D.getState().selected;
    if (s?.kind === 'figure' && s.slot >= moment.shown) useLogistic3D.setState({ selected: null });
  }, [moment.shown]);

  // The animals move for a few seconds after each change, then the picture rests (on demand).
  const liveKey = `${modelKey}|${String(playback.t)}`;
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

  const marks = gaugeMarks(model, fmt);
  const title = Lz(L('Số cá thể N(t)', 'Population N(t)'));
  const texts = {
    title,
    k: marks.k,
    half: marks.half,
    moment: (m: LogisticMoment) => momentLabel(m, fmt),
  };
  const callouts = useMemo(
    () =>
      labelsOn
        ? Object.fromEntries(Object.entries(CALLOUTS).map(([id, text]) => [id, Lz(text)]))
        : null,
    [labelsOn, Lz],
  );
  const scale = Lz(scaleText(model.per, fmt));
  const scene: SceneSpec = {
    build: (kit) => buildLogisticHabitat(kit, { model, texts }),
    buildKey: JSON.stringify([modelKey, title, marks, fmt(1.5)]),
    label: Lz(
      L(
        `Quần thể tăng trưởng logistic: ${readout(moment, fmt)}, ${String(moment.shown)} hình (${scale}); sức chứa K = ${fmt(model.K, 4)}.`,
        `Logistic population growth: ${readout(moment, fmt)}, ${String(moment.shown)} figures (${scale}); carrying capacity K = ${fmt(model.K, 4)}.`,
      ),
    ),
    time: playback.t,
    running: (playback.playing && !prefersReducedMotion()) || lively,
    viewDir: LOGI_VIEW,
    aspect: 2.2,
    look: 'outdoor',
    selected: selectionId(selected),
    onPick: (id) => {
      useLogistic3D.setState({ selected: parseSelection(id) });
    },
    callouts,
  };
  return (
    <Bio3DView
      lesson="logistic"
      className="logi3d"
      scene={scene}
      top={
        <>
          <LogisticChips />
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
            useLogistic3D.setState({ labels: !labelsOn });
          }}
        />
      }
      bottom={<TimePlayer playback={playback} model={model} moment={moment} fmt={fmt} />}
      info={
        selected ? (
          <PartCard model={model} moment={moment} selected={selected} fmt={fmt} />
        ) : undefined
      }
      caption={Lz(CAPTION)}
    />
  );
}
