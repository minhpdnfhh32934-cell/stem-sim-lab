import {
  ChevronLeft,
  ChevronRight,
  Focus,
  GraduationCap,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useLocalized } from '@/app/i18n/localized';
import { formatNumber, useT } from '@/app/i18n';
import { openTeacherWithQuestion } from '@/teacher/teacherStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { FrameMonitor } from '@/perf/frameMonitor';
import { effectiveTier, reportOverload, usePerfStore, useTierConfig } from '@/perf/perfStore';
import type { QualityTier } from '@/perf/tiers';
import { IconButton } from '@/ui/IconButton';
import { cx } from '@/ui/cx';
import { L, usePublishCard } from '../../common';
import { Segmented } from '../../ui';
import { SPEEDS, useDivisionStore } from '../state';
import {
  CELL_TYPE_NAME,
  COMPONENTS,
  STAGE3D_NAME,
  card3d,
  componentVisible,
  stageNote,
  type CameraMode,
  type Selection,
} from './components';
import { VIEW_DIR, applyViewport, placeCamera } from './camera';
import { buildMitosisScene, type MitosisScene, type ScenePalette } from './scene';
import { stateFor, timelineFor, useMitosis3D } from './store';
import { createTapTracker } from './tap';
import { STAGES_3D, type CellType, type Stage3D, type Timeline, type Vec3 } from './timeline';
import { Mitosis3DSwitch } from './Mitosis3DSwitch';
import '../../bio.css';

/** The part of THREE.WebGLRenderer the view uses (tests pass a fake one: jsdom has no WebGL). */
export interface RendererLike {
  domElement: HTMLCanvasElement;
  localClippingEnabled: boolean;
  setPixelRatio: (ratio: number) => void;
  setSize: (width: number, height: number) => void;
  render: (scene: THREE.Object3D, camera: THREE.Camera) => void;
  dispose: () => void;
  /** Frees the GPU context at once (THREE.WebGLRenderer has it). */
  forceContextLoss?: () => void;
  info: {
    memory: { geometries: number; textures: number };
    programs: unknown[] | null;
    render: { calls: number; triangles: number };
  };
}
export type RendererFactory = (opts: { antialias: boolean }) => RendererLike;

const webglRenderer: RendererFactory = ({ antialias }) =>
  new THREE.WebGLRenderer({
    antialias,
    alpha: true,
    // Keeps the last frame readable for "Xuất ảnh PNG" (the view renders on demand only).
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });

/** Read-only hook for end-to-end tests (dev builds only). */
interface DebugHook {
  /** GPU memory and, for the last frame drawn, its draw calls and triangles. */
  info(): {
    geometries: number;
    textures: number;
    programs: number;
    objects: number;
    calls: number;
    triangles: number;
  };
  stage(): Stage3D;
  /** Quality tier in effect, and whether the app lowered it by itself (overload). */
  quality(): { tier: QualityTier; degraded: boolean };
}
declare global {
  interface Window {
    __simlabMitosis3d?: DebugHook;
  }
}

function readPalette(): ScenePalette {
  const css = getComputedStyle(document.documentElement);
  // Theme tokens only; the neutral fallback is for environments without the stylesheet.
  const token = (name: string) => css.getPropertyValue(name).trim() || 'gray';
  return {
    maternal: token('--chart-4'),
    paternal: token('--chart-1'),
    centromere: token('--text'),
    membrane: token('--subject-biology'),
    envelope: token('--chart-6'),
    nucleolus: token('--chart-6'),
    wall: token('--chart-2'),
    spindle: token('--text-muted'),
    centrosome: token('--chart-5'),
    plate: token('--chart-2'),
    ring: token('--chart-7'),
    highlight: token('--accent'),
  };
}

/** The learner asked the system for less motion: nothing starts moving on its own. */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const SHORT: Record<Stage3D, ReturnType<typeof L>> = {
  g1: L('Trung gian G1', 'Interphase G1'),
  g2: L('Trung gian G2', 'Interphase G2'),
  prophase: L('Kì đầu', 'Prophase'),
  metaphase: L('Kì giữa', 'Metaphase'),
  anaphase: L('Kì sau', 'Anaphase'),
  telophase: L('Kì cuối', 'Telophase'),
  cytokinesis: L('Chia tế bào chất', 'Cytokinesis'),
};

/** Jumps the playback to a stage's characteristic moment. */
function goToStage(tl: Timeline, index: number) {
  const stage = STAGES_3D[Math.max(0, Math.min(STAGES_3D.length - 1, index))];
  if (stage) useMitosis3D.setState({ t: tl.keyTime(stage), playing: false });
}

/**
 * Stage strip: one button per stage, filled up to the current time. The accessible name is the
 * visible (short) text; the full stage name is the tooltip.
 */
function StageStrip({ tl }: { tl: Timeline }) {
  const Lz = useLocalized();
  const t = useMitosis3D((s) => s.t);
  const current = tl.stageAt(t).index;
  return (
    <div className="m3d__stages" role="group" aria-label={Lz(L('Các kì', 'Stages'))}>
      {tl.stages.map((w, k) => {
        const fill = Math.min(1, Math.max(0, (t - w.start) / (w.end - w.start)));
        const short = Lz(SHORT[w.id]);
        const full = Lz(STAGE3D_NAME[w.id]);
        return (
          <button
            key={w.id}
            type="button"
            className={cx('m3d__stage', k === current && 'is-current')}
            aria-current={k === current ? 'step' : undefined}
            title={full === short ? undefined : full}
            style={{ '--fill': fill } as CSSProperties}
            onClick={() => {
              goToStage(tl, k);
            }}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Name + function of the picked part (and whether it can be seen at this moment), and
 * "Hỏi thầy về bộ phận này": AI Teacher opens with a question written from this module's own
 * texts (part, stage, cell type), never an AI's; the learner sends it (no picture goes with it).
 */
function PartInfo({
  tl,
  selected,
  stage,
  cellType,
}: {
  tl: Timeline;
  selected: Selection;
  stage: Stage3D;
  cellType: CellType;
}) {
  const Lz = useLocalized();
  const t = useT();
  const visible = useMitosis3D((s) => componentVisible(selected.component, stateFor(tl, s.t)));
  const info = COMPONENTS[selected.component];
  const askTeacher = () => {
    // A part the card says cannot be seen now gets a question that does not assume it is there
    // (e.g. the spindle in G1, the nucleus at metaphase).
    openTeacherWithQuestion(
      t(visible ? 'teacher.askMitosisPartQuestion' : 'teacher.askMitosisPartHiddenQuestion', {
        part: Lz(info.name),
        stage: Lz(STAGE3D_NAME[stage]),
        // Mid-sentence, as in the Science Card title.
        cell: Lz(CELL_TYPE_NAME[cellType]).toLowerCase(),
      }),
    );
  };
  return (
    // The slot is the card's grid row (its height decides whether the head can stay in view).
    <div className="m3d__info-slot">
      <aside className="m3d__info" aria-live="polite">
        {/* Name and actions: in the head row (no extra height); the card scrolls as one. */}
        <div className="m3d__info-head">
          <strong>{Lz(info.name)}</strong>
          <div className="m3d__info-actions">
            <button
              type="button"
              className="btn m3d__ask"
              aria-label={t('teacher.askMitosisPart')}
              data-tip={t('teacher.askMitosisPart')}
              data-tip-side="top"
              onClick={askTeacher}
            >
              <GraduationCap size={16} aria-hidden="true" />
              {t('teacher.askMitosisPartShort')}
            </button>
            <IconButton
              icon={X}
              size="lg"
              label={Lz(L('Bỏ chọn', 'Clear selection'))}
              onClick={() => {
                useMitosis3D.setState({ selected: null });
              }}
            />
          </div>
        </div>
        <div className="m3d__info-body">
          <p>{Lz(info.role)}</p>
          {!visible && (
            <p className="small muted">
              {Lz(
                L(
                  'Bộ phận này không thấy rõ ở kì đang xem.',
                  'This part is not visible at this stage.',
                ),
              )}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function CountsChip({ tl, stage }: { tl: Timeline; stage: Stage3D }) {
  const Lz = useLocalized();
  const c = tl.counts(stage);
  // Telophase nuclei count once their envelope has formed (≥ 0.5, as in the counts table).
  const formed = useMitosis3D((s) =>
    stage === 'telophase' ? stateFor(tl, s.t).nuclei.filter((n) => n.envelope >= 0.5).length : 0,
  );
  const kind = (n: number) =>
    Lz(
      L(
        c.state === 'double' ? `${n} NST kép` : `${n} NST đơn`,
        c.state === 'double' ? `${n} double chromosomes` : `${n} single chromosomes`,
      ),
    );
  let text: string;
  if (stage === 'telophase' && formed >= c.nuclei.to) {
    text = Lz(
      L(
        `1 tế bào · ${formed} nhân · mỗi nhân ${kind(c.perNucleus ?? 0)}`,
        `1 cell · ${formed} nuclei · ${kind(c.perNucleus ?? 0)} per nucleus`,
      ),
    );
  } else if (stage === 'telophase') {
    text = Lz(
      L(
        `1 tế bào · ${kind(c.chromosomes)} · đang hình thành ${c.nuclei.to} nhân`,
        `1 cell · ${kind(c.chromosomes)} · ${c.nuclei.to} nuclei forming`,
      ),
    );
  } else if (stage === 'cytokinesis') {
    text = Lz(
      L(
        `Sau khi chia: ${c.cells} tế bào con · mỗi tế bào ${kind(c.chromosomes)}`,
        `After division: ${c.cells} daughter cells · ${kind(c.chromosomes)} each`,
      ),
    );
  } else {
    text = Lz(L(`1 tế bào · ${kind(c.chromosomes)}`, `1 cell · ${kind(c.chromosomes)}`));
  }
  return <span className="chem-chip">{text}</span>;
}

export function Mitosis3DView({
  createRenderer = webglRenderer,
}: {
  createRenderer?: RendererFactory;
}) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const pairs = useDivisionStore((s) => s.pairs);
  const cellType = useDivisionStore((s) => s.cellType);
  const speed = useDivisionStore((s) => s.speed);
  const tier = useTierConfig();
  const theme = useResolvedTheme();
  const tl = timelineFor(pairs, cellType);
  const card = useMemo(() => card3d(cellType), [cellType]);
  usePublishCard(card);
  const stageIndex = useMitosis3D((s) => tl.stageAt(s.t).index);
  const playing = useMitosis3D((s) => s.playing);
  const atEnd = useMitosis3D((s) => s.t >= tl.total);
  const selected = useMitosis3D((s) => s.selected);
  const camera = useMitosis3D((s) => s.camera);
  const cellLocked = useMitosis3D((s) => s.cellLocked);
  const stage = STAGES_3D[stageIndex] ?? 'g1';
  const hostRef = useRef<HTMLDivElement>(null);

  // On screen: the bottom table and parts list follow the 3D stages.
  useEffect(() => {
    useMitosis3D.setState({ active: true });
    return () => {
      useMitosis3D.setState({ active: false, playing: false });
    };
  }, []);

  // A part of the other cell type cannot stay selected.
  useEffect(() => {
    const sel = useMitosis3D.getState().selected;
    if (sel && !COMPONENTS[sel.component].cells.includes(cellType))
      useMitosis3D.setState({ selected: null });
  }, [cellType]);

  /** Renderer, camera and controls shared by the two effects below. */
  const rtRef = useRef<{
    request: () => void;
    /** Frames the camera from the default direction (new cell, view switch, "Đặt lại góc nhìn"). */
    frameCamera: (mode: CameraMode) => void;
    /** Close-up: keeps the learner's direction, re-centres and fits the chromosomes now. */
    follow: () => void;
    scene: MitosisScene | null;
    tl: Timeline | null;
    framedFor: Timeline | null;
  } | null>(null);

  // Renderer, camera and controls: one WebGL context per quality tier (not per cell type).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: RendererLike;
    try {
      renderer = createRenderer({ antialias: tier.antialias });
    } catch {
      useMitosis3D.setState({ webglFailed: true, playing: false });
      return;
    }
    const width = () => Math.max(1, host.clientWidth);
    const height = () => Math.max(1, host.clientHeight);
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pixelRatioCap));
    renderer.setSize(width(), height());
    renderer.domElement.className = 'mol-viewer__canvas';
    host.appendChild(renderer.domElement);

    // The stage strip and caption cover the bottom of the canvas: the picture is drawn a little
    // higher (camera.ts), so orbiting still turns around the target.
    const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    applyViewport(cam, width(), height());
    const controls = new OrbitControls(cam, renderer.domElement);
    // Orbit and zoom only: the target stays on the cell (or its chromosomes), so the zoom
    // limits below keep the camera outside the cell.
    controls.enablePan = false;

    /** Puts the camera at `dir` from the frame centre, at the distance that fits the frame. */
    const place = (mode: CameraMode, dir: Vec3) => {
      if (!rt.scene || !rt.tl) return;
      const p = placeCamera(rt.scene.frame(mode), rt.tl.cellType, width(), height(), dir);
      controls.minDistance = p.min;
      controls.maxDistance = p.max;
      controls.target.set(...p.target);
      cam.position.set(...p.position);
      cam.lookAt(controls.target);
      controls.update();
    };
    let frame = 0;
    const rt = {
      request: () => {
        if (!frame) frame = requestAnimationFrame(render);
      },
      frameCamera: (mode: CameraMode) => {
        place(mode, VIEW_DIR);
      },
      follow: () => {
        const d = cam.position.clone().sub(controls.target).normalize();
        place('closeup', [d.x, d.y, d.z]);
      },
      scene: null as MitosisScene | null,
      tl: null as Timeline | null,
      framedFor: null as Timeline | null,
    };
    const render = () => {
      frame = 0;
      if (rt.scene) renderer.render(rt.scene.scene, cam);
    };
    controls.addEventListener('change', rt.request);

    // Picking: a tap (not a drag, not a pinch) selects the part under the pointer.
    const ray = new THREE.Raycaster();
    ray.params.Line = { threshold: 0.12 };
    const ndc = new THREE.Vector2();
    const tap = createTapTracker();
    const onDown = (e: PointerEvent) => {
      tap.down(e);
    };
    const onCancel = (e: PointerEvent) => {
      tap.cancel(e);
    };
    const onUp = (e: PointerEvent) => {
      if (!tap.up(e) || !rt.scene) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
      );
      ray.setFromCamera(ndc, cam);
      const hit = rt.scene.pick(ray);
      const prev = useMitosis3D.getState().selected;
      // A second click on the same double chromosome drills down to the clicked sister.
      const next: Selection | null =
        hit?.component === 'doubleChromosome' &&
        prev?.component === 'doubleChromosome' &&
        prev.chromosome === hit.chromosome
          ? { ...hit, component: 'sisterChromatid' }
          : hit;
      useMitosis3D.setState({ selected: next });
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onCancel);

    // A lost GPU context (driver reset) never retries: the 2D view takes over.
    const onLost = (e: Event) => {
      e.preventDefault();
      useMitosis3D.setState({ webglFailed: true, playing: false });
    };
    renderer.domElement.addEventListener('webglcontextlost', onLost);

    const ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            renderer.setSize(width(), height());
            applyViewport(cam, width(), height());
            // The zoom-out limit depends on the canvas shape (a narrow canvas needs more room).
            if (rt.tl) {
              const target: Vec3 = [controls.target.x, controls.target.y, controls.target.z];
              const p = placeCamera(
                { center: target, points: [] },
                rt.tl.cellType,
                width(),
                height(),
              );
              controls.maxDistance = p.max;
            }
            rt.request();
          });
    ro?.observe(host);

    let hook: DebugHook | null = null;
    if (import.meta.env.DEV) {
      hook = {
        info: () => ({
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0,
          objects: rt.scene?.stats().objects ?? 0,
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
        }),
        stage: () => {
          const d = useDivisionStore.getState();
          return timelineFor(d.pairs, d.cellType).stageAt(useMitosis3D.getState().t).stage;
        },
        quality: () => {
          const perf = usePerfStore.getState();
          return { tier: effectiveTier(perf), degraded: perf.degraded };
        },
      };
      window.__simlabMitosis3d = hook;
    }
    rtRef.current = rt;

    return () => {
      rtRef.current = null;
      if (hook && window.__simlabMitosis3d === hook) delete window.__simlabMitosis3d;
      ro?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      controls.removeEventListener('change', rt.request);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onCancel);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    };
  }, [tier, createRenderer]);

  // Scene: rebuilt when the cell type, 2n, tier or theme change; the renderer stays.
  useEffect(() => {
    const rt = rtRef.current;
    if (!rt) return;
    const ms = buildMitosisScene(tl, readPalette(), { segments: tier.sphereSegments });
    rt.scene = ms;
    rt.tl = tl;
    const ui = useMitosis3D.getState();
    ms.update(stateFor(tl, ui.t));
    ms.setSelection(ui.selected);
    // A theme change keeps the learner's camera; a new cell or 2n is framed again.
    if (rt.framedFor !== tl) {
      rt.frameCamera(ui.camera);
      rt.framedFor = tl;
    }
    rt.request();
    const unsub = useMitosis3D.subscribe((s, prev) => {
      const reframe = s.camera !== prev.camera || s.viewNonce !== prev.viewNonce;
      if (s.t !== prev.t) {
        ms.update(stateFor(tl, s.t));
        // The close-up follows the chromosomes as they move and spread out.
        if (s.camera === 'closeup' && !reframe) rt.follow();
      }
      if (s.selected !== prev.selected) ms.setSelection(s.selected);
      if (reframe) rt.frameCamera(s.camera);
      rt.request();
    });
    return () => {
      unsub();
      if (rt.scene === ms) rt.scene = null;
      ms.dispose();
    };
    // createRenderer: a new renderer (tests) needs a new scene too.
  }, [tl, tier, theme, createRenderer]);

  // Playback loop (only while playing; frame times feed the overload ladder).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let prev = performance.now();
    const monitor = new FrameMonitor(1 / 30);
    const step = (now: number) => {
      const elapsed = Math.max(0, (now - prev) / 1000);
      prev = now;
      // The monitor gets the raw frame time (it skips pauses itself); hidden tabs are not frames.
      if (document.visibilityState === 'visible') {
        monitor.record(elapsed);
        if (monitor.overloaded) {
          reportOverload();
          monitor.resetOverload();
        }
      }
      // Playback moves at most 0.1 s per frame (no jump after a pause or a hidden tab).
      const dt = Math.min(0.1, elapsed);
      const next = useMitosis3D.getState().t + dt * speed;
      if (next >= tl.total) {
        useMitosis3D.setState({ t: tl.total, playing: false });
        return;
      }
      useMitosis3D.setState({ t: next });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [playing, speed, tl]);

  const fmtSpeed = (v: number) => `${formatNumber(locale, v)}×`;
  const play = () => {
    useMitosis3D.setState((s) => ({ playing: !s.playing, t: s.t >= tl.total ? 0 : s.t }));
  };

  return (
    <div className="bio-view m3d">
      <div
        ref={hostRef}
        className="m3d__gl"
        role="img"
        aria-label={`${Lz(STAGE3D_NAME[stage])}. ${Lz(stageNote(stage, cellType))}`}
      />
      {/* Controls over the picture, laid out on a grid so no two boxes ever overlap. */}
      <div className="m3d__hud">
        <div className="chem-overlay m3d__top">
          <IconButton
            icon={ChevronLeft}
            size="lg"
            label={Lz(L('Bước trước', 'Previous step'))}
            disabled={stageIndex === 0}
            onClick={() => {
              goToStage(tl, stageIndex - 1);
            }}
          />
          <IconButton
            icon={Play}
            altIcon={Pause}
            showAlt={playing}
            size="lg"
            variant="solid"
            label={playing ? Lz(L('Tạm dừng', 'Pause')) : Lz(L('Phát', 'Play'))}
            onClick={play}
          />
          <IconButton
            icon={ChevronRight}
            size="lg"
            label={Lz(L('Bước tiếp theo', 'Next step'))}
            disabled={stageIndex >= STAGES_3D.length - 1}
            onClick={() => {
              goToStage(tl, stageIndex + 1);
            }}
          />
          <IconButton
            icon={RotateCcw}
            size="lg"
            label={Lz(L('Phát lại từ đầu', 'Replay from the start'))}
            onClick={() => {
              // With reduced motion the replay waits for "Phát" instead of starting by itself.
              useMitosis3D.setState({ t: 0, playing: !prefersReducedMotion() });
            }}
          />
          <Segmented
            label={L('Tốc độ', 'Speed')}
            value={String(speed)}
            options={SPEEDS.map((v) => ({ id: String(v), label: L(fmtSpeed(v), fmtSpeed(v)) }))}
            onChange={(v) => {
              useDivisionStore.setState({ speed: Number(v) });
            }}
          />
          <span className="chem-chip">
            <strong>{Lz(STAGE3D_NAME[stage])}</strong>
          </span>
          <CountsChip tl={tl} stage={stage} />
          <span className="chem-chip bio-legend">
            {Lz(L('NST nguồn gốc', 'Chromosomes from'))}
            <span className="rx-swatch bio-swatch--m" /> {Lz(L('từ mẹ', 'the mother'))}
            <span className="rx-swatch bio-swatch--p" /> {Lz(L('từ bố', 'the father'))}
          </span>
        </div>
        <div className="m3d__side">
          <Segmented<CellType>
            label={L('Loại tế bào', 'Cell type')}
            value={cellType}
            options={[
              { id: 'animal', label: L('Động vật', 'Animal') },
              { id: 'plant', label: L('Thực vật', 'Plant') },
            ]}
            disabled={cellLocked}
            onChange={(v) => {
              if (!useMitosis3D.getState().cellLocked) useDivisionStore.setState({ cellType: v });
            }}
          />
          <Mitosis3DSwitch />
          <Segmented<CameraMode>
            label={L('Góc nhìn', 'View')}
            value={camera}
            options={[
              { id: 'overview', label: L('Toàn cảnh', 'Whole cell') },
              { id: 'closeup', label: L('Cận cảnh NST', 'Chromosomes close up') },
            ]}
            onChange={(v) => {
              useMitosis3D.setState((s) => ({ camera: v, viewNonce: s.viewNonce + 1 }));
            }}
          />
          <IconButton
            icon={Focus}
            size="lg"
            label={Lz(L('Đặt lại góc nhìn', 'Reset view'))}
            tooltipSide="left"
            onClick={() => {
              useMitosis3D.setState((s) => ({ viewNonce: s.viewNonce + 1 }));
            }}
          />
        </div>
        {selected && <PartInfo tl={tl} selected={selected} stage={stage} cellType={cellType} />}
        <div className="m3d__bottom">
          <StageStrip tl={tl} />
          <p className="m3d__caption">
            <strong>{Lz(STAGE3D_NAME[stage])}.</strong> {Lz(stageNote(stage, cellType))}{' '}
            <span className="muted">
              {Lz(CELL_TYPE_NAME[cellType])} ·{' '}
              {atEnd
                ? Lz(L('Hết — bấm Phát để xem lại.', 'Done — press Play to watch again.'))
                : Lz(
                    L(
                      'Kéo để xoay, cuộn để phóng to; bấm vào một bộ phận để xem tên và chức năng.',
                      'Drag to rotate, scroll to zoom; click a part to see its name and function.',
                    ),
                  )}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
