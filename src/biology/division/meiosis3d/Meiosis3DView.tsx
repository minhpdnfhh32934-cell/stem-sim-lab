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
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { effectiveTier, usePerfStore, useTierConfig } from '@/perf/perfStore';
import { openTeacherWithQuestion } from '@/teacher/teacherStore';
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
import { useCardHeadFit } from '../mitosis3d/partCardHead';
import { SPEEDS, useDivisionStore } from '../state';
import {
  FOV,
  VIEW_DIR,
  defaultInsets,
  placeMeiosisCamera,
  spherePoints,
  type Insets,
} from './camera';
import {
  MEIOSIS_ILLUSTRATION,
  MEIOSIS_PARTS,
  MEIOSIS_STAGE_NAME,
  MEIOSIS_STAGE_NOTE,
  MEIOSIS_STAGE_SHORT,
  drillSelection,
  meiosisCard3d,
  meiosisPartVisible,
  type MeiosisCameraMode,
  type MeiosisComponentId,
  type MeiosisSelection,
} from './components';
import { countsChipText, selectionFacts } from './facts';
import { Meiosis3DSwitch } from './Meiosis3DSwitch';
import { buildMeiosisScene, type MeiosisPalette, type MeiosisScene } from './scene';
import { meiosisStateFor, meiosisTimelineFor, useMeiosis3D } from './store';
import {
  MEIOSIS_STAGES_3D,
  divisionOf,
  type MeiosisStage3D,
  type MeiosisTimeline,
  type Vec3,
} from './timeline';
import '../../bio.css';

export type { RendererFactory, RendererLike };

/** Read-only hook for end-to-end tests (dev builds only), as `window.__simlab3d.meiosis`. */
export interface Meiosis3DDebug {
  info(): { geometries: number; textures: number; programs: number; calls: number };
  stage(): MeiosisStage3D;
  quality(): QualityInEffect;
  /** Page pixels of a part's name-label anchor at this moment (null when it cannot be seen). */
  anchor(id: MeiosisComponentId): { x: number; y: number } | null;
}

function readPalette(): {
  palette: MeiosisPalette;
  membraneOpacity: number;
  rimStrength: number;
} {
  const css = getComputedStyle(document.documentElement);
  // Theme tokens only; the neutral fallback is for environments without the stylesheet.
  const token = (name: string) => css.getPropertyValue(name).trim() || 'gray';
  const number = (name: string, fallback: number) => {
    const v = Number.parseFloat(css.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    palette: {
      maternal: token('--chart-4'),
      paternal: token('--chart-1'),
      centromere: token('--text'),
      // Unlike both chromosome colours, so the X between them reads.
      chiasma: token('--chart-3'),
      membrane: token('--subject-biology'),
      envelope: token('--chart-6'),
      nucleolus: token('--m3d-nucleolus'),
      spindle: token('--text-muted'),
      centrosome: token('--chart-5'),
      ring: token('--chart-7'),
      highlight: token('--m3d-highlight'),
      backdrop: token('--bg-panel'),
    },
    membraneOpacity: number('--m3d-membrane-opacity', 0.16),
    rimStrength: number('--m3d-rim', 0.7),
  };
}

/** Width / height of what the overview frames (the four final cells are about 1.3 : 1). */
const FRAME_ASPECT = 1.3;
const insetsOf = (host: HTMLElement, hud: HTMLElement | null): Insets =>
  measureInsets(host, hud, defaultInsets(host.clientHeight), FRAME_ASPECT);

/** The lesson's timeline: the same run as the 2D picture (2n, crossing over, seed). */
function useTimeline(): MeiosisTimeline {
  const pairs = useDivisionStore((s) => s.pairs);
  const crossover = useDivisionStore((s) => s.crossover);
  const seed = useDivisionStore((s) => s.seed);
  return meiosisTimelineFor(pairs, crossover, seed);
}

function goToStage(tl: MeiosisTimeline, index: number) {
  const stage = MEIOSIS_STAGES_3D[Math.max(0, Math.min(MEIOSIS_STAGES_3D.length - 1, index))];
  if (stage) useMeiosis3D.setState({ t: tl.keyTime(stage), playing: false });
}

/**
 * Stage strip: twelve buttons, filled up to the current time. The accessible name is the visible
 * (short) text; the full stage name is the tooltip.
 */
function StageStrip({ tl }: { tl: MeiosisTimeline }) {
  const Lz = useLocalized();
  const t = useMeiosis3D((s) => s.t);
  const current = tl.stageAt(t).index;
  return (
    <div
      className="m3d__stages"
      role="group"
      aria-label={Lz(L('Các kì', 'Stages'))}
      style={{ '--stage-count': tl.stages.length } as CSSProperties}
    >
      {tl.stages.map((w, k) => {
        const fill = Math.min(1, Math.max(0, (t - w.start) / (w.end - w.start)));
        const full = Lz(MEIOSIS_STAGE_NAME[w.id]);
        const short = Lz(MEIOSIS_STAGE_SHORT[w.id]);
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
 * Name, function and model facts of the picked part, and "Hỏi thầy": AI Teacher opens with a
 * question written from this module's own texts (part, stage), never an AI's; the learner sends
 * it (no picture goes with it).
 */
function PartInfo({
  tl,
  selected,
  stage,
}: {
  tl: MeiosisTimeline;
  selected: MeiosisSelection;
  stage: MeiosisStage3D;
}) {
  const Lz = useLocalized();
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const visible = useMeiosis3D((s) =>
    meiosisPartVisible(selected.component, meiosisStateFor(tl, s.t)),
  );
  // Facts change only at a few moments (crossing over, the splits): re-read as text.
  const facts = useMeiosis3D((s) =>
    selectionFacts(tl, meiosisStateFor(tl, s.t), selected, (v) =>
      formatNumber(locale, v, { maximumFractionDigits: 2 }),
    )
      .map((x) => Lz(x))
      .join('\n'),
  );
  const info = MEIOSIS_PARTS[selected.component];
  const slotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useCardHeadFit(slotRef, cardRef, headRef);
  const askTeacher = () => {
    openTeacherWithQuestion(
      t(visible ? 'teacher.askMeiosisPartQuestion' : 'teacher.askMeiosisPartHiddenQuestion', {
        part: Lz(info.name),
        stage: Lz(MEIOSIS_STAGE_NAME[stage]),
      }),
    );
  };
  return (
    <div ref={slotRef} className="m3d__info-slot">
      <aside ref={cardRef} className="m3d__info" aria-live="polite" data-inset="right">
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
                useMeiosis3D.setState({ selected: null });
              }}
            />
          </div>
        </div>
        <div className="m3d__info-body">
          <p>{Lz(info.role)}</p>
          {facts !== '' &&
            facts.split('\n').map((line) => (
              <p key={line} className="small">
                {line}
              </p>
            ))}
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

function CountsChip({ tl, stage }: { tl: MeiosisTimeline; stage: MeiosisStage3D }) {
  const Lz = useLocalized();
  // Telophase nuclei count once their envelope has formed (≥ 0.5, as in the counts table).
  const formed = useMeiosis3D((s) => {
    if (stage !== 'telophase1' && stage !== 'telophase2') return 0;
    const st = meiosisStateFor(tl, s.t);
    return st.nuclei.filter((n) => n.envelope >= 0.5).length / Math.max(1, st.cells.length);
  });
  return <span className="chem-chip">{Lz(countsChipText(tl, stage, formed))}</span>;
}

export function Meiosis3DView({
  createRenderer = webglRenderer,
}: {
  createRenderer?: RendererFactory;
}) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const uiMode = useSettingsStore((s) => s.uiMode);
  const speed = useDivisionStore((s) => s.speed);
  const tier = useTierConfig();
  const tierName = usePerfStore(effectiveTier);
  const theme = useResolvedTheme();
  const tl = useTimeline();
  const card = useMemo(() => meiosisCard3d(), []);
  usePublishCard(card);
  const stageIndex = useMeiosis3D((s) => tl.stageAt(s.t).index);
  const playing = useMeiosis3D((s) => s.playing);
  const atEnd = useMeiosis3D((s) => s.t >= tl.total);
  const selected = useMeiosis3D((s) => s.selected);
  const camera = useMeiosis3D((s) => s.camera);
  const labelsChoice = useMeiosis3D((s) => s.labels);
  const basic = uiMode === 'basic';
  // "Hiện tên": on by default in Basic mode.
  const labelsOn = labelsChoice ?? basic;
  const stage = MEIOSIS_STAGES_3D[stageIndex] ?? 'g1';
  const hostRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);

  // On screen: the bottom table and parts list follow the 3D stages.
  useEffect(() => {
    useMeiosis3D.setState({ active: true });
    return () => {
      useMeiosis3D.setState({ active: false, playing: false });
    };
  }, []);
  // Basic mode has no camera choice: always the whole set of cells.
  useEffect(() => {
    if (basic && useMeiosis3D.getState().camera !== 'overview')
      useMeiosis3D.setState((s) => ({ camera: 'overview', viewNonce: s.viewNonce + 1 }));
  }, [basic]);

  const sceneRef = useRef<{ scene: MeiosisScene; tl: MeiosisTimeline } | null>(null);
  const framedRef = useRef<{ host: ThreeHost | null; tl: MeiosisTimeline | null }>({
    host: null,
    tl: null,
  });
  const placementFor = (h: ThreeHost, mode: MeiosisCameraMode, dir: Vec3) => {
    const cur = sceneRef.current;
    if (!cur) return null;
    return placeMeiosisCamera(cur.scene.frame(mode), h.width(), h.height(), dir, h.currentInsets());
  };
  const frameCamera = (h: ThreeHost, mode: MeiosisCameraMode, animate = false) => {
    const p = placementFor(h, mode, VIEW_DIR);
    if (p) h.place(p, { animate });
  };
  const refit = (h: ThreeHost, mode: MeiosisCameraMode) => {
    const p = placementFor(h, mode, h.direction(VIEW_DIR));
    if (p) h.place(p);
  };
  const labelsRef = useRef<LabelLayer | null>(null);
  const labelsOnRef = useRef(labelsOn);
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
        text: Lz(MEIOSIS_PARTS[a.id].name),
        point: a.point,
      })),
      h.camera,
      w,
      hh,
      { left: i.left, top: i.top, right: w - i.right, bottom: hh - i.bottom },
      h.quality.labelCap,
    );
  };

  const quality = quality3d(tierName, tier);
  const hostRt = useThreeHost(hostRef, {
    createRenderer,
    quality,
    fov: FOV,
    near: 0.1,
    far: 400,
    canvasClass: 'mol-viewer__canvas',
    insets: () => (hostRef.current ? insetsOf(hostRef.current, hudRef.current) : defaultInsets(1)),
    observe: () => hudRef.current?.querySelectorAll('[data-inset]') ?? [],
    onLayout: (h, insetsChanged) => {
      const cur = sceneRef.current;
      if (!cur) return;
      if (insetsChanged) {
        refit(h, useMeiosis3D.getState().camera);
      } else {
        const t = h.controls.target;
        const p = placeMeiosisCamera(
          { center: [t.x, t.y, t.z], points: [] },
          h.width(),
          h.height(),
          VIEW_DIR,
          h.currentInsets(),
        );
        h.controls.maxDistance = p.max;
      }
    },
    onFail: () => {
      useMeiosis3D.setState({ webglFailed: true, playing: false });
    },
    onFrame: (h) => {
      drawLabels(h);
    },
    onDoubleTap: (ray) => {
      const cur = sceneRef.current;
      const h = hostRt.current;
      if (!cur || !h) return;
      const hit = cur.scene.pick(ray);
      const center = cur.scene.pickedPoint();
      if (!hit || !center) return;
      const p = placeMeiosisCamera(
        { center, points: spherePoints([0, 0, 0], 1.2) },
        h.width(),
        h.height(),
        h.direction(VIEW_DIR),
        h.currentInsets(),
      );
      h.place(p, { animate: true });
    },
    onTap: (ray) => {
      const cur = sceneRef.current;
      if (!cur) return;
      const hit = cur.scene.pick(ray);
      useMeiosis3D.setState({ selected: drillSelection(useMeiosis3D.getState().selected, hit) });
    },
    debug: (h) => {
      const host = hostRef.current;
      const hook: Meiosis3DDebug = {
        info: () => {
          const i = h.info();
          return {
            geometries: i.geometries,
            textures: i.textures,
            programs: i.programs,
            calls: i.calls,
          };
        },
        stage: () => {
          const d = useDivisionStore.getState();
          return meiosisTimelineFor(d.pairs, d.crossover, d.seed).stageAt(useMeiosis3D.getState().t)
            .stage;
        },
        quality: () => h.qualityInEffect(),
        anchor: (id) => {
          const cur = sceneRef.current;
          if (!cur || !host) return null;
          const a = cur.scene.labelAnchors().find((x) => x.id === id);
          if (!a) return null;
          const box = host.getBoundingClientRect();
          h.camera.updateMatrixWorld();
          const v = new THREE.Vector3(...a.point).project(h.camera);
          return {
            x: box.left + ((v.x + 1) / 2) * box.width,
            y: box.top + ((1 - v.y) / 2) * box.height,
          };
        },
      };
      return ThreeHost.registerDebug('meiosis', hook);
    },
  });

  // Scene: rebuilt for a new run (2n, crossing over, seed), tier or theme; the renderer stays.
  useEffect(() => {
    const h = hostRt.current;
    if (!h) return;
    const look = readPalette();
    const ms = buildMeiosisScene(tl, look.palette, {
      segments: tier.sphereSegments,
      tier: tierName,
      membraneOpacity: look.membraneOpacity,
      rimStrength: look.rimStrength,
    });
    sceneRef.current = { scene: ms, tl };
    h.setScene(ms.scene);
    const ui = useMeiosis3D.getState();
    ms.update(meiosisStateFor(tl, Math.min(ui.t, tl.total)));
    ms.setSelection(ui.selected);
    const framed = framedRef.current;
    if (framed.host !== h || framed.tl !== tl) {
      frameCamera(h, ui.camera);
      framedRef.current = { host: h, tl };
    }
    h.request();
    const unsub = useMeiosis3D.subscribe((s, prev) => {
      const reframe = s.camera !== prev.camera || s.viewNonce !== prev.viewNonce;
      if (s.t !== prev.t) {
        ms.update(meiosisStateFor(tl, s.t));
        if (s.camera === 'closeup' && !reframe) refit(h, 'closeup');
        // The overview holds still within a division and glides once to the other division's
        // cells (the learner's direction is kept).
        const division = divisionOf(tl.stageAt(s.t).stage);
        if (
          s.camera === 'overview' &&
          !reframe &&
          division !== divisionOf(tl.stageAt(prev.t).stage)
        ) {
          const p = placementFor(h, 'overview', h.direction(VIEW_DIR));
          if (p) h.place(p, { animate: true });
        }
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

  useLayoutEffect(() => {
    hostRt.current?.relayout();
  }, [selected, hostRt]);

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

  usePlayback(useMeiosis3D, tl.total, speed);

  const fmtSpeed = (v: number) => `${formatNumber(locale, v)}×`;
  const play = () => {
    useMeiosis3D.setState((s) => ({ playing: !s.playing, t: s.t >= tl.total ? 0 : s.t }));
  };

  return (
    <div className="bio-view m3d mei3d" data-lesson="meiosis">
      <div
        ref={hostRef}
        className="m3d__gl"
        role="img"
        tabIndex={0}
        aria-label={`${Lz(MEIOSIS_STAGE_NAME[stage])}. ${Lz(MEIOSIS_STAGE_NOTE[stage])}`}
      />
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
            disabled={stageIndex >= MEIOSIS_STAGES_3D.length - 1}
            onClick={() => {
              goToStage(tl, stageIndex + 1);
            }}
          />
          <IconButton
            icon={RotateCcw}
            size="lg"
            label={Lz(L('Phát lại từ đầu', 'Replay from the start'))}
            onClick={() => {
              useMeiosis3D.setState({ t: 0, playing: !prefersReducedMotion() });
            }}
          />
          {!basic && (
            <Segmented
              label={L('Tốc độ', 'Speed')}
              value={String(speed)}
              options={SPEEDS.map((v) => ({ id: String(v), label: L(fmtSpeed(v), fmtSpeed(v)) }))}
              onChange={(v) => {
                useDivisionStore.setState({ speed: Number(v) });
              }}
            />
          )}
          <span className="chem-chip">
            <strong>{Lz(MEIOSIS_STAGE_NAME[stage])}</strong>
          </span>
          <CountsChip tl={tl} stage={stage} />
          <span className="chem-chip bio-legend">
            {Lz(L('NST nguồn gốc', 'Chromosomes from'))}
            <span className="rx-swatch bio-swatch--m" /> {Lz(L('từ mẹ', 'the mother'))}
            <span className="rx-swatch bio-swatch--p" /> {Lz(L('từ bố', 'the father'))}
          </span>
        </div>
        <div className="m3d__side" data-inset="corner">
          <div className="m3d__side-row">
            <Meiosis3DSwitch />
            <IconButton
              icon={Tags}
              size="lg"
              active={labelsOn}
              label={Lz(L('Hiện tên các bộ phận', 'Show part names'))}
              tooltipSide="left"
              onClick={() => {
                useMeiosis3D.setState({ labels: !labelsOn });
              }}
            />
            <IconButton
              icon={Focus}
              size="lg"
              label={Lz(L('Đặt lại góc nhìn', 'Reset view'))}
              tooltipSide="left"
              onClick={() => {
                useMeiosis3D.setState((s) => ({ viewNonce: s.viewNonce + 1 }));
              }}
            />
          </div>
          {!basic && (
            <div className="m3d__side-row">
              <Segmented<MeiosisCameraMode>
                label={L('Góc nhìn', 'View')}
                value={camera}
                options={[
                  { id: 'overview', label: L('Toàn cảnh', 'All cells') },
                  { id: 'closeup', label: L('Cận cảnh NST', 'Chromosomes close up') },
                ]}
                onChange={(v) => {
                  useMeiosis3D.setState((s) => ({ camera: v, viewNonce: s.viewNonce + 1 }));
                }}
              />
            </div>
          )}
        </div>
        {selected && <PartInfo tl={tl} selected={selected} stage={stage} />}
        <div className="m3d__bottom" data-inset="bottom">
          <StageStrip tl={tl} />
          <p className="m3d__caption">
            <strong>{Lz(MEIOSIS_STAGE_NAME[stage])}.</strong> {Lz(MEIOSIS_STAGE_NOTE[stage])}{' '}
            <span className="muted">
              {Lz(MEIOSIS_ILLUSTRATION)}{' '}
              {atEnd
                ? Lz(L('Hết — bấm Phát để xem lại.', 'Done — press Play to watch again.'))
                : Lz(
                    L(
                      'Kéo để xoay, cuộn để phóng to; bấm vào một bộ phận để xem tên và chức năng (bấm lần nữa vào NST để xem từng crômatit).',
                      'Drag to rotate, scroll to zoom; click a part to see its name and function (click a chromosome again to see one chromatid).',
                    ),
                  )}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
