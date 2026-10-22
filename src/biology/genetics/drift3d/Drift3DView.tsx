/**
 * "Phiêu bạt di truyền" in 3D: an archipelago, one island per Wright–Fisher run of the lesson
 * (the same seed as the 2D chart). Over the picture: "Chạy lại", how many islands have fixed or
 * lost A at the generation shown, the theory P(fix) = p₀, the beads' key and the drawing scale.
 * Under it the generation slider (0 … the lesson's generations) and the framing (every island, or
 * one island close up). A tap on an island or an animal opens its card and frames that island
 * close up beside it ("Toàn cảnh" closes the card). In the corner: "Hiện tên" (name callouts). Islands, animals, plants and motion are illustration (caption); every number
 * is the model's.
 */
import { Dices, Pause, Play, RotateCcw, Tags, X } from 'lucide-react';
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
import { useDriftRuns } from '../driftData';
import { useDrift } from '../store';
import {
  driftModel3d,
  figureBudget,
  generationAt,
  islandCap,
  islandOf,
  parseSelection,
  selectionId,
  summaryAt,
  type DriftModel3D,
  type DriftSelection,
} from './binding';
import {
  CAPTION,
  SOURCES,
  calloutTexts,
  scaleText,
  selectionCard,
  summaryText,
  type Fmt,
} from './facts';
import { DRIFT_VIEW, frontIsland } from './layout';
import { buildDriftArchipelago, islandFrame } from './scene';
import { useDrift3D, type DriftCameraMode } from './store';

/** The animals hop on their own for this long after a change, then the picture rests. */
const LIVELY_MS = 5000;

/** Real seconds to play every generation (about 12 s for the default 150). */
const playSeconds = (generations: number) => Math.min(24, Math.max(8, generations * 0.08));

function Chips({ model, g, fmt }: { model: DriftModel3D; g: number; fmt: Fmt }) {
  const Lz = useLocalized();
  const s = summaryText(model, g);
  return (
    <>
      <button
        type="button"
        className="btn btn--accent"
        onClick={() => {
          useDrift.setState((st) => ({ seed: st.seed + 1 }));
        }}
      >
        <Dices size={15} aria-hidden="true" /> {Lz(L('Chạy lại', 'Run again'))}
      </button>
      <span className="chem-chip drift3d__chip" data-chip="fates">
        <span data-fate="fixed">
          <i className="hw3d__bead hw3d__bead--A" aria-hidden="true" /> {Lz(s.fixed)}
        </span>
        <span data-fate="lost">
          <i className="hw3d__bead hw3d__bead--a" aria-hidden="true" /> {Lz(s.lost)}
        </span>
        <span data-fate="both">{Lz(s.both)}</span>
      </span>
      <span className="chem-chip" data-chip="theory">
        {Lz(L('Lí thuyết: P(cố định A) = p₀ = ', 'Theory: P(A fixed) = p₀ = '))}
        {fmt(model.p0, 4)}
      </span>
      <span className="chem-chip chem-chip--qual drift3d__chip" data-chip="scale">
        <span>
          {Lz(L('Bản sao gen', 'Gene copies'))}{' '}
          <i className="hw3d__bead hw3d__bead--A" aria-hidden="true" /> A{' '}
          <i className="hw3d__bead hw3d__bead--a" aria-hidden="true" /> a
        </span>
        <span>{Lz(scaleText(model, fmt))}</span>
      </span>
    </>
  );
}

function GenerationPlayer({
  playback,
  model,
  g,
  fmt,
  camera,
}: {
  playback: Playback;
  model: DriftModel3D;
  g: number;
  fmt: Fmt;
  camera: DriftCameraMode;
}) {
  const Lz = useLocalized();
  const s = summaryAt(model, g);
  return (
    <div className="bio3d__player drift3d__player">
      <IconButton
        icon={Play}
        altIcon={Pause}
        showAlt={playback.playing}
        size="lg"
        variant="solid"
        label={
          playback.playing
            ? Lz(L('Tạm dừng', 'Pause'))
            : Lz(L('Phát các thế hệ', 'Play the generations'))
        }
        onClick={playback.toggle}
      />
      <IconButton
        icon={RotateCcw}
        size="lg"
        label={Lz(L('Phát lại từ thế hệ 0', 'Replay from generation 0'))}
        onClick={playback.replay}
      />
      <input
        type="range"
        aria-label={Lz(L('Thế hệ', 'Generation'))}
        min={0}
        max={model.generations}
        step={1}
        value={g}
        onChange={(e) => {
          playback.setT(Number(e.target.value));
        }}
      />
      <output aria-live="off">
        {Lz(L('Thế hệ', 'Generation'))} {g}/{model.generations} · H̄ = {fmt(s.meanH, 3)}
      </output>
      <Segmented<DriftCameraMode>
        label={L('Góc nhìn', 'View')}
        value={camera}
        options={[
          { id: 'overview', label: L('Toàn cảnh', 'All islands') },
          { id: 'closeup', label: L('Cận cảnh một đảo', 'One island close up') },
        ]}
        onChange={(v) => {
          // The whole archipelago has no room beside a card: "Toàn cảnh" closes it.
          useDrift3D.setState(v === 'overview' ? { camera: v, selected: null } : { camera: v });
        }}
      />
    </div>
  );
}

function PartCard({
  model,
  g,
  selected,
  fmt,
}: {
  model: DriftModel3D;
  g: number;
  selected: DriftSelection;
  fmt: Fmt;
}) {
  const Lz = useLocalized();
  const slotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useCardHeadFit(slotRef, cardRef, headRef);
  const card = selectionCard(model, g, selected, fmt);
  // A card taller than the stage's middle row fades out at the bottom while there is more.
  useScrollMore(cardRef, card ? card.lines.map((l) => l.vi).join('|') : '');
  if (!card) return null;
  return (
    <div ref={slotRef} className="m3d__info-slot">
      <aside
        ref={cardRef}
        className="m3d__info drift3d__card"
        aria-live="polite"
        data-inset="right"
      >
        <div ref={headRef} className="m3d__info-head">
          <strong>{Lz(card.title)}</strong>
          <div className="m3d__info-actions">
            <IconButton
              icon={X}
              size="lg"
              label={Lz(L('Bỏ chọn', 'Clear selection'))}
              onClick={() => {
                useDrift3D.setState({ selected: null });
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

export function Drift3DView() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useDrift();
  const runs = useDriftRuns();
  const tier = useTierConfig();
  const cap = islandCap(figureBudget(tier.maxParticles), st.runs);
  const model = useMemo(
    () =>
      driftModel3d(
        { N: st.N, p0: st.p0, generations: st.generations, runs: st.runs, seed: st.seed },
        runs,
        cap,
      ),
    [runs, st.N, st.p0, st.generations, st.runs, st.seed, cap],
  );
  const modelKey = JSON.stringify([st.N, st.p0, st.generations, st.runs, st.seed, cap]);
  const playback = usePlayback(model.generations, {
    start: 0,
    autoplay: true,
    seconds: playSeconds(model.generations),
  });
  const g = generationAt(playback.t, model.generations);
  const selected = useDrift3D((s) => s.selected);
  const camera = useDrift3D((s) => s.camera);
  const focus = useDrift3D((s) => s.focus);
  // "Hiện tên": on unless the learner turned it off.
  const labelsOn = useDrift3D((s) => s.labels) ?? true;

  // The chart under the picture marks the generation shown while this view is on screen.
  useEffect(() => {
    useDrift3D.setState({ t: g, active: true });
  }, [g]);
  useEffect(
    () => () => {
      useDrift3D.setState({ active: false, selected: null });
    },
    [],
  );
  // Another model (another seed, N or number of runs): the old pick may not exist.
  const lastKey = useRef(modelKey);
  useLayoutEffect(() => {
    if (lastKey.current === modelKey) return;
    lastKey.current = modelKey;
    const s = useDrift3D.getState();
    const keep = s.selected && islandOf(model, s.selected) < model.runs.length;
    useDrift3D.setState({
      selected: keep && s.selected?.kind === 'island' ? s.selected : null,
      focus: s.focus !== null && s.focus < model.runs.length ? s.focus : null,
    });
  }, [modelKey, model]);

  // The animals hop for a few seconds after each change, then the picture rests (on demand).
  const liveKey = `${modelKey}|${String(g)}`;
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

  // The names follow the drawing scale (the beads' callout says what one bead stands for).
  const callouts = labelsOn
    ? Object.fromEntries(
        Object.entries(calloutTexts(model, fmt)).map(([id, text]) => [id, Lz(text)]),
      )
    : null;
  const s = summaryAt(model, g);
  // A picked island or animal: its island close up beside the card (the whole archipelago would
  // shrink into the half of the stage the card leaves).
  const pickedIsland = selected ? islandOf(model, selected) : null;
  const closeIsland = pickedIsland ?? focus ?? frontIsland(model.runs.length);
  const shownCamera: DriftCameraMode = pickedIsland !== null ? 'closeup' : camera;
  const scene: SceneSpec = {
    build: (kit) => buildDriftArchipelago(kit, { model }),
    buildKey: modelKey,
    label: Lz(
      L(
        `${String(model.runs.length)} đảo, mỗi đảo một quần thể N = ${fmt(model.N, 6)}; thế hệ ${String(g)}: A cố định ở ${String(s.fixed)} đảo, A mất ở ${String(s.lost)} đảo, còn cả hai ở ${String(s.polymorphic)} đảo.`,
        `${String(model.runs.length)} islands, each a population of N = ${fmt(model.N, 6)}; generation ${String(g)}: A fixed on ${String(s.fixed)}, lost on ${String(s.lost)}, both left on ${String(s.polymorphic)}.`,
      ),
    ),
    time: playback.t,
    running: (playback.playing && !prefersReducedMotion()) || lively,
    viewDir: DRIFT_VIEW,
    aspect: 1.7,
    look: 'outdoor',
    selected: selectionId(selected),
    onPick: (id) => {
      const sel = parseSelection(id);
      useDrift3D.setState(
        sel ? { selected: sel, focus: islandOf(model, sel) } : { selected: null },
      );
    },
    ...(shownCamera === 'closeup' ? { view: islandFrame(closeIsland) } : {}),
    callouts,
  };
  return (
    <Bio3DView
      lesson="drift"
      className="drift3d"
      scene={scene}
      top={<Chips model={model} g={g} fmt={fmt} />}
      tools={
        <IconButton
          icon={Tags}
          size="lg"
          active={labelsOn}
          label={Lz(L('Hiện tên các phần', 'Show the names of the parts'))}
          tooltipSide="left"
          onClick={() => {
            useDrift3D.setState({ labels: !labelsOn });
          }}
        />
      }
      bottom={
        <GenerationPlayer playback={playback} model={model} g={g} fmt={fmt} camera={shownCamera} />
      }
      info={selected ? <PartCard model={model} g={g} selected={selected} fmt={fmt} /> : undefined}
      caption={Lz(CAPTION)}
    />
  );
}
