/**
 * The 3D view of "ADN → mARN → Protein": the learner's DNA as a double helix, transcription by
 * RNA polymerase, then translation on a ribosome — one clock, played, stepped or scrubbed. The
 * scene comes from `scene.ts`, every value shown from the lesson's model (`binding.ts`,
 * `facts.ts`). Renders on demand (a frame per change, every frame only while playing; frame
 * times feed the overload ladder), one renderer per quality tier, the 2D page when WebGL is
 * missing or lost; everything is freed on unmount.
 */
import { ChevronLeft, ChevronRight, Focus, Pause, Play, RotateCcw, Tags, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import * as THREE from 'three';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { effectiveTier, usePerfStore, useTierConfig } from '@/perf/perfStore';
import type { QualityTier } from '@/perf/tiers';
import { prefersReducedMotion } from '@/ui/three/availability';
import { measureInsets } from '@/ui/three/insets';
import { LabelLayer } from '@/ui/three/labelLayer';
import { usePlayback } from '@/ui/three/loop';
import { quality3d } from '@/ui/three/quality3d';
import { webglRenderer, type RendererFactory } from '@/ui/three/renderer';
import { TagLayer } from '@/ui/three/tagLayer';
import { ThreeHost, useThreeHost } from '@/ui/three/useThreeHost';
import { IconButton } from '@/ui/IconButton';
import { cx } from '@/ui/cx';
import { L, usePublishCard } from '../../common';
import { Segmented } from '../../ui';
import { useCardHeadFit } from '../../division/mitosis3d/partCardHead';
import { InvalidSequence } from '../DogmaViews';
import { parseInput, useDogmaStore } from '../state';
import {
  momentAt,
  stepAt,
  stepMoments,
  syncedTime,
  type DogmaClock,
  type DogmaModel3D,
} from './binding';
import {
  FOV,
  VIEW_DIR,
  defaultInsets,
  dogmaFrame,
  placeDogmaCamera,
  type DogmaCameraMode,
} from './camera';
import {
  DOGMA_ILLUSTRATION,
  DOGMA_PARTS,
  PHASE_NAME,
  dogmaCard3d,
  type DogmaSelection,
} from './components';
import { Dogma3DSwitch } from './Dogma3DSwitch';
import { countsChip, momentCaption, phaseOf, pictureLabel, selectionCard } from './facts';
import type { Vec3 } from './layout';
import { buildDogmaScene, type DogmaScene } from './scene';
import { DOGMA_SPEEDS, dogma3dFor, useDogma3D } from './store';
import '../../bio.css';

export type { RendererFactory };

/** Read-only hook for end-to-end tests (dev builds only), as `window.__simlab3d.dogma`. */
export interface Dogma3DDebug {
  info(): { geometries: number; textures: number; programs: number; calls: number };
  phase(): string;
  step(): number;
  window(): { from: number; to: number } | null;
  quality(): { tier: QualityTier; degraded: boolean };
  /** Page pixels of a base (0-based index) now, or null when it is not drawn / not in view. */
  basePoint(strand: 'coding' | 'template' | 'mrna', i: number): { x: number; y: number } | null;
  /** Page pixels of a picked thing's centre now (a bead, a codon…), or null. */
  focus(sel: DogmaSelection): { x: number; y: number } | null;
  /** A camera move (glide, damping) is still running. */
  moving(): boolean;
}

/** Width / height of what the follow camera frames. */
const FRAME_ASPECT = 1.1;
/** Two moments closer than this (s) are the same step. */
const EPS = 0.05;

function tokenReader(): (name: string) => string {
  const css = getComputedStyle(document.documentElement);
  // Theme tokens only; the neutral fallback is for environments without the stylesheet.
  return (name) => css.getPropertyValue(name).trim() || 'gray';
}

/** What the view needs to read the lesson: the 3D model and clock of the learner's DNA. */
export function Dogma3DView({
  createRenderer = webglRenderer,
}: {
  createRenderer?: RendererFactory;
}) {
  const input = useDogmaStore((s) => s.input);
  const strand = useDogmaStore((s) => s.strand);
  const parsed = useMemo(() => parseInput(input, strand), [input, strand]);
  const card = useMemo(() => dogmaCard3d(), []);
  usePublishCard(card);
  if (!parsed.ok) {
    // The 2D page's notice, and no scene.
    return (
      <div className="bio-scroll dogma3d-invalid" data-lesson="centralDogma">
        <div className="chem-toolbar">
          <Dogma3DSwitch />
        </div>
        <InvalidSequence error={parsed.error} />
      </div>
    );
  }
  return <Dogma3DScene coding={parsed.coding} createRenderer={createRenderer} />;
}

function goTo(t: number) {
  useDogma3D.setState({ t, playing: false });
}

/** Transcription and translation, each filled as far as the clock has gone. */
function PhaseStrip({ clock }: { clock: DogmaClock }) {
  const Lz = useLocalized();
  const t = useDogma3D((s) => s.t);
  const phases = [
    { id: 'transcription' as const, start: 0, end: clock.tlStart },
    ...(clock.steps > 0
      ? [{ id: 'translation' as const, start: clock.tlStart, end: clock.total }]
      : []),
  ];
  const current = t >= clock.tlStart && clock.steps > 0 ? 'translation' : 'transcription';
  return (
    <div
      className="m3d__stages"
      role="group"
      aria-label={Lz(L('Các giai đoạn', 'Stages'))}
      style={{ '--stage-count': phases.length } as CSSProperties}
    >
      {phases.map((p) => {
        const fill = Math.min(1, Math.max(0, (t - p.start) / Math.max(1e-9, p.end - p.start)));
        return (
          <button
            key={p.id}
            type="button"
            className={cx('m3d__stage', p.id === current && 'is-current')}
            aria-current={p.id === current ? 'step' : undefined}
            style={{ '--fill': fill } as CSSProperties}
            onClick={() => {
              goTo(p.start);
            }}
          >
            {Lz(PHASE_NAME[p.id])}
          </button>
        );
      })}
    </div>
  );
}

/** The time slider (the clock is illustrative; the readout is the model's position). */
function Scrubber({ clock, model }: { clock: DogmaClock; model: DogmaModel3D }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const t = useDogma3D((s) => s.t);
  const fmt = (v: number) => formatNumber(locale, v);
  return (
    <input
      type="range"
      className="dogma3d__scrub"
      aria-label={Lz(L('Thời điểm (kéo để tua)', 'Moment (drag to scrub)'))}
      aria-valuetext={Lz(countsChip(model, momentAt(clock, t), fmt))}
      min={0}
      max={clock.total}
      step={clock.total / 1000}
      value={t}
      onChange={(e) => {
        goTo(Number(e.target.value));
      }}
    />
  );
}

/** The picked part's card: name and function, or the model's facts about a base or a codon. */
function PartInfo({
  model,
  selected,
  visible,
}: {
  model: DogmaModel3D;
  selected: DogmaSelection;
  visible: (sel: DogmaSelection) => boolean;
}) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  // Re-read on every moment (a residue may not exist yet when the slider goes back).
  const shown = useDogma3D(() => visible(selected));
  const info = selectionCard(model, selected, (v) => formatNumber(locale, v));
  const slotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useCardHeadFit(slotRef, cardRef, headRef);
  if (!info) return null;
  return (
    <div ref={slotRef} className="m3d__info-slot">
      <aside ref={cardRef} className="m3d__info" aria-live="polite" data-inset="right">
        <div ref={headRef} className="m3d__info-head">
          <strong>{Lz(info.title)}</strong>
          <div className="m3d__info-actions">
            <IconButton
              icon={X}
              size="lg"
              label={Lz(L('Bỏ chọn', 'Clear selection'))}
              onClick={() => {
                useDogma3D.setState({ selected: null });
              }}
            />
          </div>
        </div>
        <div className="m3d__info-body">
          {info.lines.map((line) => (
            <p key={line.vi} className={selected.kind === 'part' ? undefined : 'small'}>
              {Lz(line)}
            </p>
          ))}
          {!shown && (
            <p className="small muted">
              {Lz(
                L('Lúc này phần này không có trên hình.', 'This part is not in the picture now.'),
              )}
            </p>
          )}
          <p className="small muted m3d__sources">
            {Lz(
              L(
                'Nguồn: SGK Sinh học 10, 12; Campbell Biology; bảng mã di truyền chuẩn NCBI · nội dung đang chờ giáo viên duyệt.',
                'Sources: Vietnamese Biology 10 and 12 textbooks; Campbell Biology; NCBI standard genetic code · awaiting teacher review.',
              ),
            )}
          </p>
        </div>
      </aside>
    </div>
  );
}

function Dogma3DScene({
  coding,
  createRenderer,
}: {
  coding: string;
  createRenderer: RendererFactory;
}) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const uiMode = useSettingsStore((s) => s.uiMode);
  const tier = useTierConfig();
  const tierName = usePerfStore(effectiveTier);
  const theme = useResolvedTheme();
  const { model, clock } = useMemo(() => dogma3dFor(coding), [coding]);
  const fmt = (v: number) => formatNumber(locale, v);
  const basic = uiMode === 'basic';
  const playing = useDogma3D((s) => s.playing);
  const atEnd = useDogma3D((s) => s.t >= clock.total);
  const selected = useDogma3D((s) => s.selected);
  const camera = useDogma3D((s) => s.camera);
  const speed = useDogma3D((s) => s.speed);
  const labelsChoice = useDogma3D((s) => s.labels);
  // "Hiện tên": on by default in Basic mode.
  const labelsOn = labelsChoice ?? basic;
  const caption = useDogma3D((s) => Lz(momentCaption(model, momentAt(clock, s.t), fmt)));
  const counts = useDogma3D((s) => Lz(countsChip(model, momentAt(clock, s.t), fmt)));
  const label = useDogma3D((s) => Lz(pictureLabel(model, momentAt(clock, s.t), fmt)));
  const phase = useDogma3D((s) => phaseOf(momentAt(clock, s.t)));
  const moments = useMemo(() => stepMoments(clock), [clock]);
  const hostRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DogmaScene | null>(null);
  const framedRef = useRef<{ host: ThreeHost | null; model: DogmaModel3D | null }>({
    host: null,
    model: null,
  });

  // On screen: the parts list follows it. The clock opens on the 2D page's codon.
  useEffect(() => {
    useDogma3D.setState((s) => ({
      active: true,
      t: syncedTime(clock, s.t, useDogmaStore.getState().step),
    }));
    return () => {
      useDogma3D.setState({ active: false, playing: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A new sequence starts from the beginning.
  const codingRef = useRef(coding);
  useEffect(() => {
    if (codingRef.current === coding) return;
    codingRef.current = coding;
    useDogma3D.setState({ t: 0, playing: false, selected: null });
  }, [coding]);
  // The 2D page reads the same codon: the clock writes the step while it plays.
  useEffect(
    () =>
      useDogma3D.subscribe((s, prev) => {
        if (s.t === prev.t) return;
        const step = stepAt(clock, s.t);
        if (useDogmaStore.getState().step !== step) useDogmaStore.setState({ step });
      }),
    [clock],
  );

  const insetsOf = (host: HTMLElement) =>
    measureInsets(host, hudRef.current, defaultInsets(host.clientHeight), FRAME_ASPECT);
  const placement = (h: ThreeHost, mode: DogmaCameraMode, dir: Vec3) => {
    const sc = sceneRef.current;
    if (!sc) return null;
    const mo = momentAt(clock, useDogma3D.getState().t);
    const win = sc.window();
    return placeDogmaCamera(
      dogmaFrame(mode, model, mo, win),
      dogmaFrame('overview', model, mo, win),
      h.width(),
      h.height(),
      dir,
      h.currentInsets(),
    );
  };
  const frameCamera = (h: ThreeHost, mode: DogmaCameraMode, animate = false) => {
    const p = placement(h, mode, VIEW_DIR);
    if (p) h.place(p, { animate });
  };
  /** "Theo dõi": the camera moves with the machine, keeping the learner's angle and zoom. */
  const follow = (h: ThreeHost) => {
    const sc = sceneRef.current;
    if (!sc || h.moving()) return;
    const mo = momentAt(clock, useDogma3D.getState().t);
    const f = dogmaFrame('follow', model, mo, sc.window());
    const t = h.controls.target;
    const dx = f.center[0] - t.x;
    const dy = f.center[1] - t.y;
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return;
    const p = h.pose();
    h.place({
      target: f.center,
      position: [p.position[0] + dx, p.position[1] + dy, p.position[2]],
      min: h.controls.minDistance,
      max: h.controls.maxDistance,
    });
  };

  const labelsRef = useRef<LabelLayer | null>(null);
  const tagsRef = useRef<TagLayer | null>(null);
  const labelsOnRef = useRef(labelsOn);
  const drawLabels = (h: ThreeHost) => {
    const layer = labelsRef.current;
    const tags = tagsRef.current;
    const sc = sceneRef.current;
    if (!layer || !tags || !sc) return;
    if (!labelsOnRef.current) {
      layer.clear();
      tags.clear();
      return;
    }
    const i = h.currentInsets();
    const w = h.width();
    const hh = h.height();
    const safe = { left: i.left, top: i.top, right: w - i.right, bottom: hh - i.bottom };
    tags.begin(h.camera, w, hh, safe);
    sc.tags(tags, h.camera.position, h.controls.target, w - i.left - i.right, fmt);
    tags.end();
    layer.update(
      sc
        .labelAnchors()
        .map((a) => ({ id: a.id, text: Lz(DOGMA_PARTS[a.id].name), point: a.point })),
      h.camera,
      w,
      hh,
      safe,
      h.quality.labelCap,
    );
  };

  const quality = quality3d(tierName, tier);
  const hostRt = useThreeHost(hostRef, {
    createRenderer,
    quality,
    fov: FOV,
    near: 0.05,
    far: 600,
    canvasClass: 'mol-viewer__canvas',
    insets: () => (hostRef.current ? insetsOf(hostRef.current) : defaultInsets(1)),
    observe: () => hudRef.current?.querySelectorAll('[data-inset]') ?? [],
    onLayout: (h) => {
      const p = placement(h, useDogma3D.getState().camera, h.direction(VIEW_DIR));
      if (p) h.place(p);
    },
    onFail: () => {
      useDogma3D.setState({ webglFailed: true, playing: false });
    },
    onFrame: (h) => {
      drawLabels(h);
    },
    onTap: (ray) => {
      const sc = sceneRef.current;
      if (!sc) return;
      useDogma3D.setState({ selected: sc.pick(ray) });
    },
    onDoubleTap: (ray) => {
      const sc = sceneRef.current;
      const h = hostRt.current;
      if (!sc || !h) return;
      const hit = sc.pick(ray);
      const at = hit ? sc.focusPoint(hit) : null;
      if (!at) return;
      const pts: Vec3[] = [];
      for (const x of [-1.6, 1.6]) for (const y of [-1.6, 1.6]) pts.push([x, y, 0]);
      const p = placeDogmaCamera(
        { center: at, points: pts },
        { center: at, points: pts },
        h.width(),
        h.height(),
        h.direction(VIEW_DIR),
        h.currentInsets(),
      );
      h.place({ ...p, max: Math.max(p.max, h.controls.maxDistance) }, { animate: true });
    },
    debug: (h) => {
      const host = hostRef.current;
      const toPage = (pt: Vec3 | null) => {
        if (!pt || !host) return null;
        const box = host.getBoundingClientRect();
        h.camera.updateMatrixWorld();
        const v = new THREE.Vector3(...pt).project(h.camera);
        if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return null;
        return {
          x: box.left + ((v.x + 1) / 2) * box.width,
          y: box.top + ((1 - v.y) / 2) * box.height,
        };
      };
      const hook: Dogma3DDebug = {
        info: () => {
          const i = h.info();
          return {
            geometries: i.geometries,
            textures: i.textures,
            programs: i.programs,
            calls: i.calls,
          };
        },
        phase: () => momentAt(clock, useDogma3D.getState().t).phase,
        step: () => useDogmaStore.getState().step,
        window: () => sceneRef.current?.window() ?? null,
        quality: () => ThreeHost.tierInEffect(),
        basePoint: (s, i) => toPage(sceneRef.current?.basePoint(s, i) ?? null),
        focus: (sel) => toPage(sceneRef.current?.focusPoint(sel) ?? null),
        moving: () => h.moving(),
      };
      return ThreeHost.registerDebug('dogma', hook);
    },
  });

  // Scene: rebuilt for a new sequence, tier or theme; the renderer stays.
  useEffect(() => {
    const h = hostRt.current;
    if (!h) return;
    const sc = buildDogmaScene(model, {
      tier: tierName,
      segments: tier.sphereSegments,
      maxBasePairs: quality.maxInstances,
      token: tokenReader(),
    });
    sceneRef.current = sc;
    h.setScene(sc.scene);
    const ui = useDogma3D.getState();
    sc.update(momentAt(clock, ui.t));
    sc.setSelection(ui.selected);
    const framed = framedRef.current;
    if (framed.host !== h || framed.model !== model) {
      frameCamera(h, ui.camera);
      framedRef.current = { host: h, model };
    }
    h.request();
    let lastWin = sc.window();
    let lastPhase = phaseOf(momentAt(clock, ui.t));
    const unsub = useDogma3D.subscribe((s, prev) => {
      const reframe = s.camera !== prev.camera || s.viewNonce !== prev.viewNonce;
      if (s.t !== prev.t) {
        const mo = momentAt(clock, s.t);
        sc.update(mo);
        const win = sc.window();
        const ph = phaseOf(mo);
        const moved = win.from !== lastWin.from || win.to !== lastWin.to;
        if (!reframe) {
          // A new phase (follow) or a new stretch of a long sequence (overview): glide there.
          if ((s.camera === 'follow' && ph !== lastPhase) || (s.camera === 'overview' && moved)) {
            const p = placement(h, s.camera, h.direction(VIEW_DIR));
            if (p) h.place(p, { animate: true });
          } else if (s.camera === 'follow') follow(h);
        }
        lastWin = win;
        lastPhase = ph;
      }
      if (s.selected !== prev.selected) sc.setSelection(s.selected);
      if (reframe) frameCamera(h, s.camera, true);
      h.request();
    });
    return () => {
      unsub();
      if (sceneRef.current === sc) {
        sceneRef.current = null;
        h.setScene(null);
      }
      sc.dispose();
    };
    // frameCamera, placement and follow only read refs and the model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, clock, tier, tierName, theme, createRenderer]);

  useLayoutEffect(() => {
    hostRt.current?.relayout();
  }, [selected, hostRt]);

  // Name labels and letters: one pair of layers per renderer.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !hostRt.current) return;
    const tags = new TagLayer(host, 'dogma3d__tags');
    const layer = new LabelLayer(host, 'm3d__labels');
    labelsRef.current = layer;
    tagsRef.current = tags;
    hostRt.current.request();
    return () => {
      if (labelsRef.current === layer) labelsRef.current = null;
      if (tagsRef.current === tags) tagsRef.current = null;
      layer.dispose();
      tags.dispose();
    };
  }, [hostRt, tierName, createRenderer]);
  useEffect(() => {
    labelsOnRef.current = labelsOn;
    hostRt.current?.request();
  }, [labelsOn, Lz, hostRt]);

  usePlayback(useDogma3D, clock.total, speed);

  const fmtSpeed = (v: number) => `${formatNumber(locale, v)}×`;
  const play = () => {
    useDogma3D.setState((s) => ({ playing: !s.playing, t: s.t >= clock.total ? 0 : s.t }));
  };
  const step = (dir: -1 | 1) => {
    const t = useDogma3D.getState().t;
    if (dir > 0) {
      const next = moments.find((x) => x > t + EPS);
      goTo(next ?? clock.total);
    } else {
      const before = moments.filter((x) => x < t - EPS);
      goTo(before.at(-1) ?? 0);
    }
  };
  const visible = (sel: DogmaSelection) => {
    const sc = sceneRef.current;
    if (!sc) return true;
    return sel.kind === 'part' ? sc.partVisible(sel.part) : sc.focusPoint(sel) !== null;
  };
  const atStart = useDogma3D((s) => s.t <= 0);

  return (
    <div className="bio-view m3d dogma3d" data-lesson="centralDogma">
      <div ref={hostRef} className="m3d__gl" role="img" tabIndex={0} aria-label={label} />
      <div ref={hudRef} className="m3d__hud">
        <div className="chem-overlay m3d__top" data-inset="top">
          <IconButton
            icon={ChevronLeft}
            size="lg"
            label={Lz(L('Bước trước', 'Previous step'))}
            disabled={atStart}
            onClick={() => {
              step(-1);
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
            disabled={atEnd}
            onClick={() => {
              step(1);
            }}
          />
          <IconButton
            icon={RotateCcw}
            size="lg"
            label={Lz(L('Phát lại từ đầu', 'Replay from the start'))}
            onClick={() => {
              useDogma3D.setState({ t: 0, playing: !prefersReducedMotion() });
            }}
          />
          {!basic && (
            <Segmented
              label={L('Tốc độ', 'Speed')}
              value={String(speed)}
              options={DOGMA_SPEEDS.map((v) => ({
                id: String(v),
                label: L(fmtSpeed(v), fmtSpeed(v)),
              }))}
              onChange={(v) => {
                useDogma3D.setState({ speed: Number(v) });
              }}
            />
          )}
          <span className="chem-chip">
            <strong>{Lz(PHASE_NAME[phase])}</strong>
          </span>
          <span className="chem-chip">{counts}</span>
          <span className="chem-chip bio-legend dogma3d__legend">
            {(['A', 'T', 'U', 'G', 'C'] as const).map((b) => (
              <span key={b} className="dogma3d__key">
                <span className={`rx-swatch dogma3d__swatch--${b}`} aria-hidden="true" />
                {b}
              </span>
            ))}
          </span>
        </div>
        <div className="m3d__side" data-inset="corner">
          <div className="m3d__side-row">
            <Dogma3DSwitch />
            <IconButton
              icon={Tags}
              size="lg"
              active={labelsOn}
              label={Lz(L('Hiện tên và chữ cái', 'Show names and letters'))}
              tooltipSide="left"
              onClick={() => {
                useDogma3D.setState({ labels: !labelsOn });
              }}
            />
            <IconButton
              icon={Focus}
              size="lg"
              label={Lz(L('Đặt lại góc nhìn', 'Reset view'))}
              tooltipSide="left"
              onClick={() => {
                useDogma3D.setState((s) => ({ viewNonce: s.viewNonce + 1 }));
              }}
            />
          </div>
          <div className="m3d__side-row">
            <Segmented<DogmaCameraMode>
              label={L('Góc nhìn', 'View')}
              value={camera}
              options={[
                { id: 'follow', label: L('Theo dõi', 'Follow') },
                { id: 'overview', label: L('Toàn cảnh', 'Whole DNA') },
              ]}
              onChange={(v) => {
                useDogma3D.setState((s) => ({ camera: v, viewNonce: s.viewNonce + 1 }));
              }}
            />
          </div>
        </div>
        {selected && <PartInfo model={model} selected={selected} visible={visible} />}
        <div className="m3d__bottom" data-inset="bottom">
          <div className="dogma3d__timeline">
            <PhaseStrip clock={clock} />
            <Scrubber clock={clock} model={model} />
          </div>
          <p className="m3d__caption">
            {caption}{' '}
            <span className="muted">
              {Lz(DOGMA_ILLUSTRATION)}{' '}
              {atEnd
                ? Lz(L('Hết — bấm Phát để xem lại.', 'Done — press Play to watch again.'))
                : Lz(
                    L(
                      'Kéo để xoay, cuộn để phóng to (phóng gần để đọc chữ cái); bấm vào một bazơ, bộ ba, tARN hay axit amin để xem chi tiết.',
                      'Drag to rotate, scroll to zoom (zoom in to read the letters); click a base, codon, tRNA or amino acid for details.',
                    ),
                  )}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
