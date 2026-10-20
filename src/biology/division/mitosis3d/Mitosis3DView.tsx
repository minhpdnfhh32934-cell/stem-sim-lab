import {
  ChevronLeft,
  ChevronRight,
  Focus,
  GraduationCap,
  Pause,
  Play,
  RotateCcw,
  Tags,
  X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import * as THREE from 'three';
import { useLocalized } from '@/app/i18n/localized';
import { formatNumber, useT } from '@/app/i18n';
import { openTeacherWithQuestion } from '@/teacher/teacherStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { effectiveTier, usePerfStore, useTierConfig } from '@/perf/perfStore';
import { prefersReducedMotion } from '@/ui/three/availability';
import { measureInsets } from '@/ui/three/insets';
import { LabelLayer } from '@/ui/three/labelLayer';
import { usePlayback } from '@/ui/three/loop';
import { quality3d } from '@/ui/three/quality3d';
import { webglRenderer, type RendererFactory, type RendererLike } from '@/ui/three/renderer';
import { ThreeHost, useThreeHost, type QualityInEffect } from '@/ui/three/useThreeHost';
import { IconButton } from '@/ui/IconButton';
import { cx } from '@/ui/cx';
import { L, usePublishCard } from '../../common';
import { Segmented } from '../../ui';
import { divisionPalette } from '../division3d/palette';
import { SPEEDS, useDivisionStore } from '../state';
import {
  CELL_TYPE_NAME,
  COMPONENTS,
  STAGE3D_NAME,
  card3d,
  componentVisible,
  labelName,
  stageNote,
  type CameraMode,
  type Selection,
} from './components';
import { FOV, VIEW_DIR, defaultInsets, placeCamera, spherePoints, type Insets } from './camera';
import { buildMitosisScene, type MitosisScene, type ScenePalette } from './scene';
import { useCardHeadFit } from './partCardHead';
import { stateFor, timelineFor, useMitosis3D } from './store';
import { STAGES_3D, type CellType, type Stage3D, type Timeline, type Vec3 } from './timeline';
import { Mitosis3DSwitch } from './Mitosis3DSwitch';
import '../../bio.css';

export type { RendererFactory, RendererLike };

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
  quality(): QualityInEffect;
  /**
   * Where the whole cell (the overview frame, both daughters included) is drawn now, in page
   * pixels: tests check it stays clear of the controls and the picked part's card.
   */
  cellRect(): { left: number; top: number; right: number; bottom: number } | null;
}
declare global {
  interface Window {
    __simlabMitosis3d?: DebugHook;
  }
}

function readPalette(): {
  palette: ScenePalette;
  membraneOpacity: number;
  rimStrength: number;
  edgeShade: number;
  shellInk: number;
} {
  const css = getComputedStyle(document.documentElement);
  // Theme tokens only; the neutral fallback is for environments without the stylesheet.
  const token = (name: string) => css.getPropertyValue(name).trim() || 'gray';
  const number = (name: string, fallback: number) => {
    const v = Number.parseFloat(css.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    palette: divisionPalette(token),

    membraneOpacity: number('--m3d-membrane-opacity', 0.16),
    rimStrength: number('--m3d-rim', 0.7),
    edgeShade: number('--m3d-edge-shade', 0),
    shellInk: number('--m3d-shell-ink', 0),
  };
}

/** Width / height of what the overview frames (the cell and, at the end, both daughters). */
const FRAME_ASPECT = 1.6;

/** Controls over the canvas (`@/ui/three/insets.ts`); before they are laid out, the default. */
const insetsOf = (host: HTMLElement, hud: HTMLElement | null): Insets =>
  measureInsets(host, hud, defaultInsets(host.clientHeight), FRAME_ASPECT);

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
  const slotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useCardHeadFit(slotRef, cardRef, headRef);
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
    <div ref={slotRef} className="m3d__info-slot">
      <aside ref={cardRef} className="m3d__info" aria-live="polite" data-inset="right">
        {/* Name and actions: in the head row (no extra height); the card scrolls as one. */}
        <div ref={headRef} className="m3d__info-head">
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
          <ChromosomeFacts tl={tl} selected={selected} />
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
          <p className="small muted m3d__sources">
            {Lz(
              L(
                'Nguồn: SGK Sinh học 10; Campbell Biology · nội dung đang chờ giáo viên duyệt.',
                'Sources: Vietnamese Biology 10 textbook; Campbell Biology · awaiting teacher review.',
              ),
            )}
          </p>
        </div>
      </aside>
    </div>
  );
}

/**
 * What the model says about the picked chromosome now: its pair, where it came from (mother or
 * father) and how many chromatids (DNA molecules) it has at this moment.
 */
function ChromosomeFacts({ tl, selected }: { tl: Timeline; selected: Selection }) {
  const Lz = useLocalized();
  const facts = useMitosis3D((s) => {
    if (selected.chromosome === undefined) return null;
    const st = stateFor(tl, s.t);
    const mine = st.chromatids.filter(
      (c) =>
        c.present &&
        c.chromosome === selected.chromosome &&
        (c.joined || selected.sister === undefined || c.sister === selected.sister),
    );
    const info = tl.chromatids.find((c) => c.chromosome === selected.chromosome);
    if (!info || mine.length === 0) return null;
    return `${String(info.pair + 1)}|${info.origin}|${String(mine.length)}`;
  });
  if (!facts) return null;
  const [pair, origin, count] = facts.split('|');
  const from = origin === 'M' ? L('từ mẹ', 'the mother') : L('từ bố', 'the father');
  return (
    <p className="small">
      {Lz(
        L(
          `Theo mô hình: cặp NST số ${pair ?? ''}, nguồn gốc ${from.vi}; lúc này có ${count ?? ''} crômatit (${count ?? ''} phân tử ADN).`,
          `From the model: chromosome pair ${pair ?? ''}, from ${from.en}; it has ${count ?? ''} chromatid(s) (${count ?? ''} DNA molecule(s)) now.`,
        ),
      )}
    </p>
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
  const tierName = usePerfStore(effectiveTier);
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
  const uiMode = useSettingsStore((s) => s.uiMode);
  const labelsChoice = useMitosis3D((s) => s.labels);
  // "Hiện tên": on by default in Basic mode, off while a lesson holds the model (it may ask the
  // learner to find a part by its function).
  const labelsOn = labelsChoice ?? (uiMode === 'basic' && !cellLocked);
  const stage = STAGES_3D[stageIndex] ?? 'g1';
  const hostRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);

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

  /** The scene drawn now and the timeline it shows. */
  const sceneRef = useRef<{ scene: MitosisScene; tl: Timeline } | null>(null);
  /** The host and timeline the camera was framed for (a new cell, 2n or renderer: frame again). */
  const framedRef = useRef<{ host: ThreeHost | null; tl: Timeline | null }>({
    host: null,
    tl: null,
  });

  /** Where the camera goes to show `mode` from `dir` (null before a scene exists). */
  const placementFor = (h: ThreeHost, mode: CameraMode, dir: Vec3) => {
    const cur = sceneRef.current;
    if (!cur) return null;
    return placeCamera(
      cur.scene.frame(mode),
      cur.tl.cellType,
      h.width(),
      h.height(),
      dir,
      h.currentInsets(),
    );
  };
  /**
   * Frames the camera from the default direction (new cell, view switch, "Đặt lại góc nhìn"):
   * a smooth move when asked (at once with reduced motion, and for the first frame).
   */
  const frameCamera = (h: ThreeHost, mode: CameraMode, animate = false) => {
    const p = placementFor(h, mode, VIEW_DIR);
    if (p) h.place(p, { animate });
  };
  /** Name labels of the parts that can be seen now, drawn after each frame. */
  const labelsRef = useRef<LabelLayer | null>(null);
  const drawLabels = (h: ThreeHost) => {
    const layer = labelsRef.current;
    const cur = sceneRef.current;
    if (!layer || !cur) return;
    if (!labelsOnRef.current) {
      layer.clear();
      return;
    }
    const i = h.currentInsets();
    const w = h.width();
    const hh = h.height();
    layer.update(
      cur.scene.labelAnchors().map((a) => ({
        id: a.id,
        text: Lz(labelName(a.id)),
        color: a.color,
        point: a.point,
      })),
      h.camera,
      w,
      hh,
      { left: i.left, top: i.top, right: w - i.right, bottom: hh - i.bottom },
      h.quality.labelCap,
      cur.scene.labelObstacles(),
    );
  };
  const labelsOnRef = useRef(labelsOn);
  /** Keeps the learner's direction; re-centres and fits `mode` (the close-up follows). */
  const refit = (h: ThreeHost, mode: CameraMode) => {
    const p = placementFor(h, mode, h.direction(VIEW_DIR));
    if (p) h.place(p);
  };

  // Renderer, camera and controls: one WebGL context per quality tier (not per cell type).
  const quality = quality3d(tierName, tier);
  const hostRt = useThreeHost(hostRef, {
    createRenderer,
    quality,
    fov: FOV,
    near: 0.1,
    far: 400,
    canvasClass: 'mol-viewer__canvas',
    // Controls cover the canvas edges (chips, stage strip and caption, a picked part's card):
    // the picture is centred in the rest (camera.ts), so orbiting still turns around the target.
    insets: () => (hostRef.current ? insetsOf(hostRef.current, hudRef.current) : defaultInsets(1)),
    // The controls over the canvas change size when they wrap (narrow window, long text).
    observe: () => hudRef.current?.querySelectorAll('[data-inset]') ?? [],
    onLayout: (h, insetsChanged) => {
      const cur = sceneRef.current;
      if (!cur) return;
      if (insetsChanged) {
        // Controls moved (wrapped onto another line, the window changed, a card opened): the
        // learner's direction is kept, the distance fits the new safe area.
        refit(h, useMitosis3D.getState().camera);
      } else {
        // The zoom-out limit depends on the canvas shape (a narrow canvas needs more room).
        const t = h.controls.target;
        const p = placeCamera(
          { center: [t.x, t.y, t.z], points: [] },
          cur.tl.cellType,
          h.width(),
          h.height(),
          VIEW_DIR,
          h.currentInsets(),
        );
        h.controls.maxDistance = p.max;
      }
    },
    onFail: () => {
      useMitosis3D.setState({ webglFailed: true, playing: false });
    },
    onFrame: (h) => {
      // A big chromosome set spreads its shape updates over frames: finish them.
      const cur = sceneRef.current;
      if (cur?.scene.pending()) {
        cur.scene.update(stateFor(cur.tl, useMitosis3D.getState().t));
        h.request();
      }
      drawLabels(h);
    },
    // Double click (or double tap) on a part: the camera turns to it (closest allowed view).
    onDoubleTap: (ray) => {
      const cur = sceneRef.current;
      const h = hostRt.current;
      if (!cur || !h) return;
      const hit = cur.scene.pick(ray);
      const center = cur.scene.pickedPoint();
      if (!hit || !center) return;
      const p = placeCamera(
        { center, points: spherePoints([0, 0, 0], 1.2) },
        cur.tl.cellType,
        h.width(),
        h.height(),
        h.direction(VIEW_DIR),
        h.currentInsets(),
      );
      h.place(p, { animate: true });
    },
    // Picking: a tap (not a drag, not a pinch) selects the part under the pointer.
    onTap: (ray) => {
      const cur = sceneRef.current;
      if (!cur) return;
      const hit = cur.scene.pick(ray);
      const prev = useMitosis3D.getState().selected;
      // A second click on the same double chromosome drills down to the clicked sister.
      const next: Selection | null =
        hit?.component === 'doubleChromosome' &&
        prev?.component === 'doubleChromosome' &&
        prev.chromosome === hit.chromosome
          ? { ...hit, component: 'sisterChromatid' }
          : hit;
      useMitosis3D.setState({ selected: next });
    },
    debug: (h) => {
      const host = hostRef.current;
      const hook: DebugHook = {
        info: () => {
          const i = h.info();
          return {
            geometries: i.geometries,
            textures: i.textures,
            programs: i.programs,
            objects: sceneRef.current?.scene.stats().objects ?? 0,
            calls: i.calls,
            triangles: i.triangles,
          };
        },
        stage: () => {
          const d = useDivisionStore.getState();
          return timelineFor(d.pairs, d.cellType).stageAt(useMitosis3D.getState().t).stage;
        },
        quality: () => h.qualityInEffect(),
        cellRect: () => {
          const cur = sceneRef.current;
          if (!cur || !host) return null;
          const f = cur.scene.frame('overview');
          const box = host.getBoundingClientRect();
          const v = new THREE.Vector3();
          const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
          h.camera.updateMatrixWorld();
          for (const p of f.points) {
            v.set(f.center[0] + p[0], f.center[1] + p[1], f.center[2] + p[2]).project(h.camera);
            const x = box.left + ((v.x + 1) / 2) * box.width;
            const y = box.top + ((1 - v.y) / 2) * box.height;
            r.left = Math.min(r.left, x);
            r.right = Math.max(r.right, x);
            r.top = Math.min(r.top, y);
            r.bottom = Math.max(r.bottom, y);
          }
          return r;
        },
      };
      // `__simlabMitosis3d` is kept as an alias for the existing end-to-end tests.
      window.__simlabMitosis3d = hook;
      const unregister = ThreeHost.registerDebug('mitosis', hook);
      return () => {
        unregister();
        if (window.__simlabMitosis3d === hook) delete window.__simlabMitosis3d;
      };
    },
  });

  // Scene: rebuilt when the cell type, 2n, tier or theme change; the renderer stays.
  useEffect(() => {
    const h = hostRt.current;
    if (!h) return;
    const look = readPalette();
    const ms = buildMitosisScene(tl, look.palette, {
      segments: tier.sphereSegments,
      tier: tierName,
      membraneOpacity: look.membraneOpacity,
      rimStrength: look.rimStrength,
      edgeShade: look.edgeShade,
      shellInk: look.shellInk,
      hdr: quality.bloom,
    });
    sceneRef.current = { scene: ms, tl };
    h.setScene(ms.scene);
    const ui = useMitosis3D.getState();
    ms.update(stateFor(tl, ui.t));
    ms.setSelection(ui.selected);
    // A theme change keeps the learner's camera; a new cell, 2n or renderer is framed again.
    const framed = framedRef.current;
    if (framed.host !== h || framed.tl !== tl) {
      frameCamera(h, ui.camera);
      framedRef.current = { host: h, tl };
    }
    h.request();
    const unsub = useMitosis3D.subscribe((s, prev) => {
      const reframe = s.camera !== prev.camera || s.viewNonce !== prev.viewNonce;
      if (s.t !== prev.t) {
        ms.update(stateFor(tl, s.t));
        // The close-up follows the chromosomes as they move and spread out.
        if (s.camera === 'closeup' && !reframe) refit(h, 'closeup');
      }
      if (s.selected !== prev.selected) ms.setSelection(s.selected);
      if (reframe) frameCamera(h, s.camera, true);
      h.request();
    });
    return () => {
      unsub();
      if (sceneRef.current?.scene === ms) {
        sceneRef.current = null;
        h.setScene(null);
      }
      ms.dispose();
    };
    // createRenderer: a new renderer (tests) needs a new scene too. frameCamera and refit only
    // read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl, tier, tierName, theme, createRenderer]);

  // A picked part's card opens or closes over the canvas: the cell moves into the space left.
  useLayoutEffect(() => {
    hostRt.current?.relayout();
  }, [selected, hostRt]);

  // Name labels: one page-drawn layer per renderer, redrawn with every frame.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !hostRt.current) return;
    const layer = new LabelLayer(host, 'm3d__labels');
    labelsRef.current = layer;
    hostRt.current.request();
    return () => {
      if (labelsRef.current === layer) labelsRef.current = null;
      layer.dispose();
    };
  }, [hostRt, tierName, createRenderer]);
  useEffect(() => {
    labelsOnRef.current = labelsOn;
    hostRt.current?.request();
  }, [labelsOn, Lz, hostRt]);

  // Playback (only while playing; frame times feed the overload ladder).
  usePlayback(useMitosis3D, tl.total, speed);

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
        // Keyboard users turn the cell with the arrow keys.
        tabIndex={0}
        aria-label={`${Lz(STAGE3D_NAME[stage])}. ${Lz(stageNote(stage, cellType))}`}
      />
      {/* Controls over the picture, laid out on a grid so no two boxes ever overlap. */}
      <div ref={hudRef} className="m3d__hud">
        <div className="chem-overlay m3d__top" data-inset="top">
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
        {/* Two short rows (what is shown; how it is looked at): a stack of four would take the
            height the picked part's card needs. */}
        <div className="m3d__side" data-inset="corner">
          <div className="m3d__side-row">
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
          </div>
          <div className="m3d__side-row">
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
              icon={Tags}
              size="lg"
              active={labelsOn}
              label={Lz(L('Hiện tên các bộ phận', 'Show part names'))}
              tooltipSide="left"
              onClick={() => {
                useMitosis3D.setState({ labels: !labelsOn });
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
        </div>
        {selected && <PartInfo tl={tl} selected={selected} stage={stage} cellType={cellType} />}
        <div className="m3d__bottom" data-inset="bottom">
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
