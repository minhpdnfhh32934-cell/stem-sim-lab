/**
 * "Định luật Hardy–Weinberg" in 3D: the population in its habitat (a figure above the lesson's
 * chart and table). Over the picture: the shown generation's genotype counts, p and q and the
 * drawing scale; under it the generation slider (0 = the learner's numbers, then simulated rounds
 * of random mating, `binding.ts`). A tap on an animal or on the gene pool opens its card. In the
 * corner: "Hiện tên" (name callouts on the picture) and the framing, the whole population or a
 * close-up of a few animals beside the gene pool. The animals, plants and motion are
 * illustration (caption); every number is the model's.
 */
import { Pause, Play, RotateCcw, Tags, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useTierConfig } from '@/perf/perfStore';
import { IconButton } from '@/ui/IconButton';
import { prefersReducedMotion } from '@/ui/three/availability';
import { L } from '../../common';
import { Segmented } from '../../ui';
import { useCardHeadFit } from '../../division/mitosis3d/partCardHead';
import { useFmt } from '../../fmt';
import { Bio3DFigureBody, type SceneSpec } from '../../view3d/Bio3DView';
import { usePlayback, type Playback } from '../../view3d/playback';
import { useHw } from '../store';
import {
  ALLELES_OF,
  GENOTYPES,
  HW_GENERATIONS,
  beadCap,
  figureCap,
  generationAt,
  hwModel3d,
  parseSelection,
  selectionId,
  type HwModel3D,
  type HwSelection,
} from './binding';
import {
  CALLOUTS,
  HW3D_SOURCES,
  NO_INDIVIDUALS,
  beadScale,
  dialLabels,
  figureScale,
  pqText,
  selectionCard,
  type Fmt,
} from './facts';
import { HW_VIEW } from './layout';
import { buildHwHabitat } from './scene';
import { useHw3D, type HwCameraMode } from './store';

/** Real seconds per generation while playing. */
const SECONDS_PER_GENERATION = 1.6;
/** The animals move on their own for this long after a change, then the picture rests. */
const LIVELY_MS = 6000;

/** Short honest caption (the Science Card has the full note). */
const CAPTION = L(
  'Minh họa: con vật, chỗ đứng, cây cỏ và cử động; số lượng và tỉ lệ theo mô hình.',
  'Illustration: animals, places, plants and motion; counts and ratios follow the model.',
);

function Beads({ genotype }: { genotype: (typeof GENOTYPES)[number] }) {
  return (
    <span className="hw3d__beads" aria-hidden="true">
      {ALLELES_OF[genotype].map((a, i) => (
        <i key={i} className={`hw3d__bead hw3d__bead--${a}`} />
      ))}
    </span>
  );
}

function Chips({ model, g, fmt }: { model: HwModel3D; g: number; fmt: Fmt }) {
  const Lz = useLocalized();
  const gen = model.generations[g];
  if (!gen) return null;
  const pq = pqText(gen, fmt);
  return (
    <>
      {GENOTYPES.map((gt) => (
        <span key={gt} className="chem-chip hw3d__chip" data-genotype={gt}>
          <i className={`hw3d__swatch hw3d__swatch--${gt}`} aria-hidden="true" />
          {gt}
          <Beads genotype={gt} />
          <strong className="mono">{fmt(gen.counts[gt], 6)}</strong>
        </span>
      ))}
      <span className="chem-chip hw3d__chip" data-chip="pq">
        p = <strong className="mono">{pq.p}</strong> · q = <strong className="mono">{pq.q}</strong>
      </span>
      {gen.n === 0 && (
        <span className="chem-chip" data-chip="empty">
          {Lz(NO_INDIVIDUALS)}
        </span>
      )}
      <span className="chem-chip chem-chip--qual" data-chip="scale">
        {Lz(figureScale(model.per, fmt))} · {Lz(beadScale(model.perBead, fmt))}
      </span>
    </>
  );
}

/** The framings: the whole population, or a few animals beside the gene pool (antenna beads). */
function Framing({ camera }: { camera: HwCameraMode }) {
  return (
    <Segmented<HwCameraMode>
      label={L('Góc nhìn', 'View')}
      value={camera}
      options={[
        { id: 'overview', label: L('Toàn cảnh', 'Whole population') },
        { id: 'closeup', label: L('Cận cảnh cá thể', 'Individuals close up') },
      ]}
      onChange={(v) => {
        useHw3D.setState({ camera: v });
      }}
    />
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
  model: HwModel3D;
  g: number;
  fmt: Fmt;
  camera: HwCameraMode;
}) {
  const Lz = useLocalized();
  const n = model.generations[g]?.n ?? 0;
  return (
    <div className="bio3d__player hw3d__player">
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
        max={HW_GENERATIONS}
        step={1}
        value={g}
        onChange={(e) => {
          playback.setT(Number(e.target.value));
        }}
      />
      <output aria-live="off">
        {Lz(L('Thế hệ', 'Generation'))} {g}/{HW_GENERATIONS} · N = {fmt(n, 6)}
      </output>
      <Framing camera={camera} />
    </div>
  );
}

function PartCard({
  model,
  g,
  selected,
  fmt,
}: {
  model: HwModel3D;
  g: number;
  selected: HwSelection;
  fmt: Fmt;
}) {
  const Lz = useLocalized();
  const slotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useCardHeadFit(slotRef, cardRef, headRef);
  const card = selectionCard(model, g, selected, fmt);
  if (!card) return null;
  return (
    <div ref={slotRef} className="m3d__info-slot">
      <aside ref={cardRef} className="m3d__info hw3d__card" aria-live="polite" data-inset="right">
        <div ref={headRef} className="m3d__info-head">
          <strong>{Lz(card.title)}</strong>
          <div className="m3d__info-actions">
            <IconButton
              icon={X}
              size="lg"
              label={Lz(L('Bỏ chọn', 'Clear selection'))}
              onClick={() => {
                useHw3D.setState({ selected: null });
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
          <p className="small muted m3d__sources">{Lz(HW3D_SOURCES)}</p>
        </div>
      </aside>
    </div>
  );
}

export function HardyWeinberg3DView() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useHw();
  const tier = useTierConfig();
  const cap = figureCap(tier.maxParticles);
  const beads = beadCap(tier.maxParticles);
  const model = useMemo(
    () => hwModel3d({ AA: st.AA, Aa: st.Aa, aa: st.aa, N: st.N, seed: st.seed }, cap, beads),
    [st.AA, st.Aa, st.aa, st.N, st.seed, cap, beads],
  );
  const modelKey = JSON.stringify([st.AA, st.Aa, st.aa, st.N, st.seed, cap, beads]);
  const playback = usePlayback(HW_GENERATIONS, {
    start: 0,
    seconds: HW_GENERATIONS * SECONDS_PER_GENERATION,
  });
  const g = generationAt(playback.t);
  const gen = model.generations[g];
  const selected = useHw3D((s) => s.selected);
  const camera = useHw3D((s) => s.camera);
  // "Hiện tên": on unless the learner turned it off.
  const labelsOn = useHw3D((s) => s.labels) ?? true;

  // "Cho ngẫu phối 1 thế hệ" (under the figure) made a new generation: show it (generation 1).
  const setT = useRef(playback.setT);
  useLayoutEffect(() => {
    setT.current = playback.setT;
  });
  const lastSample = useRef(st.sample);
  useEffect(() => {
    if (st.sample && st.sample !== lastSample.current) setT.current(1);
    lastSample.current = st.sample;
  }, [st.sample]);

  // A figure's slot holds another individual in another generation or population.
  useEffect(() => {
    if (useHw3D.getState().selected?.kind === 'figure') useHw3D.setState({ selected: null });
  }, [g, modelKey]);
  useEffect(
    () => () => {
      useHw3D.setState({ selected: null });
    },
    [],
  );

  // The animals move for a few seconds after each change, then the picture rests (drawn on demand).
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

  const labels = useMemo(() => dialLabels(model, fmt), [model, fmt]);
  const texts = {
    pool: Lz(L('Vốn gen', 'Gene pool')),
    dial: labels.map((x) => Lz(x)),
  };
  const counts = gen?.counts ?? { AA: 0, Aa: 0, aa: 0 };
  const pq = gen ? pqText(gen, fmt) : { p: '—', q: '—' };
  const callouts = useMemo(
    () =>
      labelsOn
        ? Object.fromEntries(Object.entries(CALLOUTS).map(([id, text]) => [id, Lz(text)]))
        : null,
    [labelsOn, Lz],
  );
  const scene: SceneSpec = {
    build: (kit) => buildHwHabitat(kit, { model, texts }),
    buildKey: JSON.stringify([modelKey, texts]),
    label: Lz(
      L(
        `Quần thể thế hệ ${String(g)}: AA ${fmt(counts.AA, 6)}, Aa ${fmt(counts.Aa, 6)}, aa ${fmt(counts.aa, 6)}; vốn gen p = ${pq.p}, q = ${pq.q}.`,
        `Population, generation ${String(g)}: AA ${fmt(counts.AA, 6)}, Aa ${fmt(counts.Aa, 6)}, aa ${fmt(counts.aa, 6)}; gene pool p = ${pq.p}, q = ${pq.q}.`,
      ),
    ),
    time: playback.t,
    running: (playback.playing && !prefersReducedMotion()) || lively,
    viewDir: HW_VIEW,
    aspect: 2.4,
    look: 'outdoor',
    selected: selectionId(selected),
    onPick: (id) => {
      useHw3D.setState({ selected: parseSelection(id) });
    },
    view: camera,
    callouts,
  };
  return (
    <Bio3DFigureBody
      lesson="hardyWeinberg"
      className="hw3d"
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
            useHw3D.setState({ labels: !labelsOn });
          }}
        />
      }
      bottom={
        <GenerationPlayer playback={playback} model={model} g={g} fmt={fmt} camera={camera} />
      }
      info={selected ? <PartCard model={model} g={g} selected={selected} fmt={fmt} /> : undefined}
      caption={Lz(CAPTION)}
    />
  );
}
