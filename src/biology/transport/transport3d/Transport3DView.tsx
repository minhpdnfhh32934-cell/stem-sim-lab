/**
 * The 3D view of "Khuếch tán & thẩm thấu". Diffusion: a box split into two compartments (widths
 * V₁ : V₂) by a membrane with pores; the particles on each side are Fick's law at every t, each
 * crossing through a pore. Osmosis: a U-tube whose columns are the model's heights on one cm
 * scale, the solute sample spreading as the solution rises, water molecules crossing the
 * semipermeable membrane (illustration). The scenes come from `diffusionScene.ts` and
 * `osmosisScene.ts`, every value shown from the lesson's model (`diffusion.ts`, `osmosis.ts`,
 * `facts.ts`). Renders on demand (frames only while playing or moving; frame times feed the
 * overload ladder), one renderer per quality tier, the 2D pictures when WebGL is missing or
 * lost; everything is freed on unmount.
 */
import { Focus, Pause, Play, Tags, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import * as THREE from 'three';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import type { LocalizedText } from '@/core/data/dataset';
import { effectiveTier, usePerfStore, useTierConfig } from '@/perf/perfStore';
import { IconButton } from '@/ui/IconButton';
import { prefersReducedMotion } from '@/ui/three/availability';
import { measureInsets } from '@/ui/three/insets';
import { LabelLayer } from '@/ui/three/labelLayer';
import { useFrameLoop } from '@/ui/three/loop';
import { quality3d } from '@/ui/three/quality3d';
import { webglRenderer, type RendererFactory } from '@/ui/three/renderer';
import { TagLayer } from '@/ui/three/tagLayer';
import { ThreeHost, useThreeHost, type QualityInEffect } from '@/ui/three/useThreeHost';
import { L, usePublishCard } from '../../common';
import { useCardHeadFit } from '../../division/mitosis3d/partCardHead';
import { ROLES, type BioRole } from '../../view3d/palette';
import { TransportChips } from '../chips';
import { useOsmosis } from '../osmosisData';
import { useTransport } from '../store';
import {
  FOV,
  VIEW_DIR,
  aroundFrame,
  defaultInsets,
  placeTransportCamera,
  pointsFrame,
} from './camera';
import {
  BLOCKED_NOTE,
  DIFFUSION_ILLUSTRATION,
  OSMOSIS_SCALE_NOTE,
  PART_NAMES,
  SCALE_NOTE,
  VOLUME_NOTE,
  WATER_NOTE,
  diffusionCard3d,
  osmosisCard3d,
  type TransportSelection,
} from './components';
import { diffusionFrameAt, type DiffusionModel3D } from './diffusion';
import { buildDiffusionScene, type DiffusionScene, type TagText } from './diffusionScene';
import {
  diffusionCounts,
  diffusionPicture,
  diffusionReadout,
  osmosisPicture,
  osmosisReadout,
  particleScale,
  selectionCard,
  selectionValid,
  type Fmt,
  type TransportView3D,
} from './facts';
import {
  SOLUTE_DRAWN,
  osmosisFrameAt,
  osmosisModel3d,
  type OsmosisModel3D,
  type Vec3,
} from './osmosis';
import { buildOsmosisScene, type OsmosisScene } from './osmosisScene';
import { diffusion3dFor, useTransport3D } from './store';
import { Transport3DSwitch } from './Transport3DSwitch';
import '../../bio.css';

export type { RendererFactory };

/** Seconds a whole time range takes to play. */
export const PLAY_SECONDS = 12;

type TransportScene = DiffusionScene | OsmosisScene;

/** Read-only hook for end-to-end tests (dev builds only), as `window.__simlab3d.transport`. */
export interface Transport3DDebug {
  info(): { geometries: number; textures: number; programs: number; calls: number };
  mode(): 'diffusion' | 'osmosis';
  /** Diffusion: the model's counts and the particles drawn left/right of the membrane. */
  counts(): { n1: number; n2: number; left: number; right: number } | null;
  /** Osmosis: the model's heights (m) and the drawn surfaces converted back to metres. */
  heights(): {
    hL: number;
    hR: number;
    drawnL: number;
    drawnR: number;
    /** Scene height of the solution's surface. */
    sceneL: number;
  } | null;
  quality(): QualityInEffect;
  /** Page pixels of a picked thing's centre now, or null. */
  focus(sel: TransportSelection): { x: number; y: number } | null;
  /** Page pixels of a scene point now, or null when it is off screen. */
  point(p: Vec3): { x: number; y: number } | null;
  /** A camera move (glide, damping) is still running. */
  moving(): boolean;
}

function tokenReader(): (name: string) => string {
  const css = getComputedStyle(document.documentElement);
  // Theme tokens only; the neutral fallback is for environments without the stylesheet.
  return (name) => css.getPropertyValue(name).trim() || 'gray';
}

/** The lesson's inputs, from its store. */
export function Transport3DView({
  createRenderer = webglRenderer,
}: {
  createRenderer?: RendererFactory;
}) {
  const mode = useTransport((s) => s.mode);
  const particles = useTransport((s) => s.particles);
  const pores = useTransport((s) => s.pores);
  const c1 = useTransport((s) => s.c1);
  const c2 = useTransport((s) => s.c2);
  const v1 = useTransport((s) => s.v1);
  const v2 = useTransport((s) => s.v2);
  const pa = useTransport((s) => s.pa);
  const run = useTransport((s) => s.run);
  const osm = useOsmosis();
  const diffusion = useMemo(
    () => diffusion3dFor({ particles, pores, c1, c2, v1, v2, pa, run }),
    [particles, pores, c1, c2, v1, v2, pa, run],
  );
  const osmosis = useMemo(() => osmosisModel3d(osm), [osm]);
  const card = useMemo(() => (mode === 'diffusion' ? diffusionCard3d() : osmosisCard3d()), [mode]);
  usePublishCard(card);
  return (
    <Transport3DScene
      mode={mode}
      diffusion={diffusion}
      osmosis={osmosis}
      createRenderer={createRenderer}
    />
  );
}

/** The picked part's card, from the model. */
function PartInfo({
  view,
  selected,
  fmt,
}: {
  view: TransportView3D;
  selected: TransportSelection;
  fmt: Fmt;
}) {
  const Lz = useLocalized();
  const info = selectionCard(view, selected, fmt);
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
                useTransport3D.setState({ selected: null });
              }}
            />
          </div>
        </div>
        <div className="m3d__info-body">
          {info.lines.map((line) => (
            <p key={line.vi} className="small">
              {Lz(line)}
            </p>
          ))}
          <p className="small muted m3d__sources">
            {Lz(
              L(
                "Nguồn: SGK Sinh học 10; Campbell Biology; Atkins' Physical Chemistry · nội dung đang chờ giáo viên duyệt.",
                "Sources: Vietnamese Biology 10 textbook; Campbell Biology; Atkins' Physical Chemistry · awaiting teacher review.",
              ),
            )}
          </p>
        </div>
      </aside>
    </div>
  );
}

/** Colour and shape cue of each role on the picture. */
function Legend({ roles }: { roles: { role: BioRole; name: LocalizedText }[] }) {
  const Lz = useLocalized();
  return (
    <span className="chem-chip bio-legend tr3d__legend">
      {roles.map(({ role, name }) => (
        <span key={role} className="tr3d__key">
          <span
            className={`bio3d-swatch bio3d-swatch--${ROLES[role].shape}`}
            style={{ '--swatch': `var(${ROLES[role].token})` } as CSSProperties}
            aria-hidden="true"
          />
          {Lz(name)}
        </span>
      ))}
    </span>
  );
}

function Transport3DScene({
  mode,
  diffusion,
  osmosis,
  createRenderer,
}: {
  mode: 'diffusion' | 'osmosis';
  diffusion: DiffusionModel3D;
  osmosis: OsmosisModel3D;
  createRenderer: RendererFactory;
}) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const uiMode = useSettingsStore((s) => s.uiMode);
  const tier = useTierConfig();
  const tierName = usePerfStore(effectiveTier);
  const theme = useResolvedTheme();
  const fmt: Fmt = {
    int: (v) => formatNumber(locale, v),
    sig: (v, d) => formatNumber(locale, v, { maximumSignificantDigits: d }),
  };
  const basic = uiMode === 'basic';
  const selected = useTransport3D((s) => s.selected);
  const labelsChoice = useTransport3D((s) => s.labels);
  const playing = useTransport3D((s) => s.playing);
  const t = useTransport3D((s) => s.t);
  // "Hiện tên": on by default (the names and counts on the picture are the model's).
  const labelsOn = labelsChoice ?? true;
  const top = mode === 'diffusion' ? diffusion.tEnd : osmosis.tEnd;
  const x = Math.min(Math.max(0, t), top);
  const view: TransportView3D = useMemo(
    () =>
      mode === 'diffusion'
        ? { mode, model: diffusion, frame: diffusionFrameAt(diffusion, x) }
        : { mode, model: osmosis, frame: osmosisFrameAt(osmosis, x) },
    [mode, diffusion, osmosis, x],
  );
  const quality = quality3d(tierName, tier);
  const hostRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TransportScene | null>(null);
  const framedRef = useRef<{ host: ThreeHost; mode: string } | null>(null);
  const viewRef = useRef(view);
  const phaseRef = useRef(0);
  useLayoutEffect(() => {
    viewRef.current = view;
  });

  // On screen.
  useEffect(() => {
    useTransport3D.setState({ active: true });
    return () => {
      useTransport3D.setState({ active: false, playing: false });
    };
  }, []);

  // Another process starts from t = 0; "Chạy lại" plays from t = 0 again.
  useEffect(
    () =>
      useTransport.subscribe((s, prev) => {
        if (s.mode !== prev.mode) useTransport3D.setState({ t: 0, playing: false, selected: null });
        else if (s.run !== prev.run) useTransport3D.setState({ t: 0, playing: true });
      }),
    [],
  );

  // A pick that no longer names something drawn (new inputs, the other process) is dropped.
  useEffect(() => {
    const sel = useTransport3D.getState().selected;
    if (sel && !selectionValid(view, sel)) useTransport3D.setState({ selected: null });
  }, [view]);

  const insetsOf = (host: HTMLElement) =>
    measureInsets(host, hudRef.current, defaultInsets(host.clientHeight), 1.1);
  const placement = (h: ThreeHost, d: Vec3) => {
    const pts = sceneRef.current?.framePoints() ?? [];
    const frame = pointsFrame(pts, d);
    return placeTransportCamera(frame, frame, h.width(), h.height(), d, h.currentInsets());
  };
  const frameCamera = (h: ThreeHost, animate = false) => {
    const d = VIEW_DIR[viewRef.current.mode];
    h.place(placement(h, d), { animate });
  };

  const labelsRef = useRef<LabelLayer | null>(null);
  const tagsRef = useRef<TagLayer | null>(null);
  const labelsOnRef = useRef(labelsOn);
  const tagText: TagText = {
    count: (n) => Lz(L(`${fmt.int(n)} hạt`, `${fmt.int(n)} particles`)),
    dh: (v) => `Δh = ${fmt.sig(v, 3)} cm`,
    tick: (v) => `${fmt.sig(v, 4)} cm`,
  };
  const tagTextRef = useRef(tagText);
  useLayoutEffect(() => {
    tagTextRef.current = tagText;
  });
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
    sc.tags(tags, tagTextRef.current);
    tags.end();
    layer.update(
      sc.labelAnchors().map((a) => ({ id: a.id, text: Lz(PART_NAMES[a.id]), point: a.point })),
      h.camera,
      w,
      hh,
      safe,
      h.quality.labelCap,
    );
  };

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
      h.place(placement(h, h.direction(VIEW_DIR[viewRef.current.mode])));
    },
    onFail: () => {
      useTransport3D.setState({ webglFailed: true });
    },
    onFrame: (h) => {
      drawLabels(h);
    },
    onTap: (ray) => {
      const sc = sceneRef.current;
      if (!sc) return;
      useTransport3D.setState({ selected: sc.pick(ray) });
    },
    onDoubleTap: (ray) => {
      const sc = sceneRef.current;
      const h = hostRt.current;
      if (!sc || !h) return;
      const hit = sc.pick(ray);
      const at = hit ? sc.focusPoint(hit) : null;
      if (!at) return;
      const d = h.direction(VIEW_DIR[viewRef.current.mode]);
      const all = pointsFrame(sc.framePoints(), d);
      const p = placeTransportCamera(
        aroundFrame(at, 1.4, d),
        all,
        h.width(),
        h.height(),
        d,
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
      const hook: Transport3DDebug = {
        info: () => {
          const i = h.info();
          return {
            geometries: i.geometries,
            textures: i.textures,
            programs: i.programs,
            calls: i.calls,
          };
        },
        mode: () => viewRef.current.mode,
        counts: () => {
          const v = viewRef.current;
          const sc = sceneRef.current;
          if (v.mode !== 'diffusion' || sc?.mode !== 'diffusion') return null;
          return { n1: v.frame.n1, n2: v.frame.n2, ...sc.sides() };
        },
        heights: () => {
          const v = viewRef.current;
          const sc = sceneRef.current;
          if (v.mode !== 'osmosis' || sc?.mode !== 'osmosis') return null;
          const lv = sc.levels();
          return {
            hL: v.frame.hL,
            hR: v.frame.hR,
            drawnL: lv.left / v.model.perMetre,
            drawnR: lv.right / v.model.perMetre,
            sceneL: lv.left,
          };
        },
        quality: () => h.qualityInEffect(),
        focus: (sel) => toPage(sceneRef.current?.focusPoint(sel) ?? null),
        point: (p) => toPage(p),
        moving: () => h.moving(),
      };
      return ThreeHost.registerDebug('transport', hook);
    },
  });

  // Scene: rebuilt for the other process, new inputs, tier or theme; the renderer stays.
  const model = mode === 'diffusion' ? diffusion : osmosis;
  useEffect(() => {
    const h = hostRt.current;
    if (!h) return;
    const opts = { tier: tierName, segments: tier.sphereSegments, token: tokenReader() };
    const sc: TransportScene =
      mode === 'diffusion'
        ? buildDiffusionScene(diffusion, opts)
        : buildOsmosisScene(osmosis, opts);
    sceneRef.current = sc;
    h.setScene(sc.scene);
    applyFrame(sc, viewRef.current);
    if (sc.mode === 'osmosis') sc.setPhase(phaseRef.current);
    const ui = useTransport3D.getState();
    sc.setSelection(
      ui.selected && selectionValid(viewRef.current, ui.selected) ? ui.selected : null,
    );
    if (framedRef.current?.host !== h || framedRef.current.mode !== mode) {
      frameCamera(h);
      framedRef.current = { host: h, mode };
    }
    h.request();
    const unsub = useTransport3D.subscribe((s, prev) => {
      if (s.selected !== prev.selected)
        sc.setSelection(
          s.selected && selectionValid(viewRef.current, s.selected) ? s.selected : null,
        );
      if (s.viewNonce !== prev.viewNonce) frameCamera(h, true);
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
    // frameCamera and placement only read refs and the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, model, tier, tierName, theme, createRenderer]);

  // A new moment or new inputs: the scene follows the model.
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    applyFrame(sc, view);
    hostRt.current?.request();
  }, [view, hostRt]);

  // Play: t runs to the end of the range; molecules wobble (illustration, never with reduced
  // motion). Frames only while playing.
  useFrameLoop(playing, (dt) => {
    const v = viewRef.current;
    const end = v.model.tEnd;
    if (!prefersReducedMotion()) {
      phaseRef.current += dt;
      const sc = sceneRef.current;
      if (sc?.mode === 'osmosis') sc.setPhase(phaseRef.current);
    }
    const now = Math.min(useTransport3D.getState().t, end);
    const next = Math.min(end, now + (dt * end) / PLAY_SECONDS);
    const done = next >= end;
    useTransport3D.setState({ t: next, playing: !done });
    hostRt.current?.request();
    return !done;
  });

  useLayoutEffect(() => {
    hostRt.current?.relayout();
  }, [selected, mode, hostRt]);

  // Name labels and tags: one pair of layers per renderer.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !hostRt.current) return;
    const tags = new TagLayer(host, 'tr3d__tags');
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
  }, [labelsOn, Lz, locale, hostRt]);

  const play = () => {
    useTransport3D.setState((s) => {
      if (s.playing) return { playing: false };
      // From the start again once the end is reached.
      return { playing: true, t: s.t >= top ? 0 : Math.min(s.t, top) };
    });
  };

  const isDiffusion = view.mode === 'diffusion';
  const readout = isDiffusion ? diffusionReadout(view.frame, fmt) : osmosisReadout(view.frame, fmt);
  const picture = isDiffusion
    ? diffusionPicture(view.model, view.frame, fmt)
    : osmosisPicture(view.frame, fmt);
  // Osmosis samples the trajectory: the slider steps from one sample to the next.
  const step = isDiffusion ? top / 400 : top / Math.max(1, view.model.traj.t.length - 1);

  return (
    <div className="bio-view m3d tr3d" data-lesson="transport" data-mode={mode}>
      <div ref={hostRef} className="m3d__gl" role="img" tabIndex={0} aria-label={Lz(picture)} />
      <div ref={hudRef} className="m3d__hud">
        <div className="chem-overlay m3d__top" data-inset="top">
          <TransportChips />
        </div>
        <div className="m3d__side" data-inset="corner">
          <div className="m3d__side-row">
            <Transport3DSwitch />
            <IconButton
              icon={Tags}
              size="lg"
              active={labelsOn}
              label={Lz(L('Hiện tên', 'Show names'))}
              tooltipSide="left"
              onClick={() => {
                useTransport3D.setState({ labels: !labelsOn });
              }}
            />
            <IconButton
              icon={Focus}
              size="lg"
              label={Lz(L('Đặt lại góc nhìn', 'Reset view'))}
              tooltipSide="left"
              onClick={() => {
                useTransport3D.setState((s) => ({ viewNonce: s.viewNonce + 1 }));
              }}
            />
          </div>
        </div>
        {selected && <PartInfo view={view} selected={selected} fmt={fmt} />}
        <div className="m3d__bottom" data-inset="bottom">
          <div className="bio3d__player">
            <IconButton
              icon={Play}
              altIcon={Pause}
              showAlt={playing}
              size="lg"
              variant="solid"
              label={playing ? Lz(L('Tạm dừng', 'Pause')) : Lz(L('Phát', 'Play'))}
              onClick={play}
            />
            <input
              type="range"
              aria-label={Lz(L('Thời gian', 'Time'))}
              min={0}
              max={top}
              step={step}
              value={view.frame.t}
              onChange={(e) => {
                useTransport3D.setState({ t: Number(e.target.value), playing: false });
              }}
            />
            <output>{Lz(readout)}</output>
          </div>
          <div className="tr3d__row">
            {isDiffusion ? (
              <>
                <span className="chem-chip">
                  <strong className="mono tr3d__counts">
                    {Lz(diffusionCounts(view.frame, fmt))}
                  </strong>
                </span>
                <Legend roles={[{ role: 'solute', name: PART_NAMES.particle }]} />
                {!basic && view.model.total > 0 && (
                  <span className="chem-chip">{Lz(particleScale(view.model, fmt))}</span>
                )}
                {view.model.blocked && view.model.total > 0 && (
                  <span className="chem-chip chem-chip--qual" role="status">
                    {Lz(BLOCKED_NOTE)}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="chem-chip">
                  {Lz(
                    L(
                      `Chất tan: ${fmt.int(SOLUTE_DRAWN)} hạt (không đổi) · C = ${fmt.sig(view.frame.c, 3)} mM`,
                      `Solute: ${fmt.int(SOLUTE_DRAWN)} particles (constant) · C = ${fmt.sig(view.frame.c, 3)} mM`,
                    ),
                  )}
                </span>
                <Legend
                  roles={[
                    { role: 'solute', name: PART_NAMES.solute },
                    { role: 'water', name: PART_NAMES.waterMolecule },
                  ]}
                />
              </>
            )}
          </div>
          <p className="m3d__caption">
            {isDiffusion ? (
              <>
                <strong>{Lz(L('Khuếch tán.', 'Diffusion.'))}</strong> {Lz(DIFFUSION_ILLUSTRATION)}{' '}
                <span className="muted">
                  {Lz(VOLUME_NOTE)} {Lz(SCALE_NOTE)}{' '}
                  {Lz(
                    L(
                      'Bấm vào màng, lỗ, hạt hay một ngăn để xem chi tiết.',
                      'Click the membrane, a pore, a particle or a side.',
                    ),
                  )}
                </span>
              </>
            ) : (
              <>
                <strong>{Lz(L('Thẩm thấu.', 'Osmosis.'))}</strong> {Lz(OSMOSIS_SCALE_NOTE)}{' '}
                <span className="muted">
                  {Lz(WATER_NOTE)}{' '}
                  {Lz(
                    L(
                      'Bấm vào một cột, màng hay một hạt để xem chi tiết.',
                      'Click a column, the membrane or a particle.',
                    ),
                  )}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Shows the view's moment on its scene (the two must be of the same process). */
function applyFrame(sc: TransportScene, v: TransportView3D): void {
  if (sc.mode === 'diffusion' && v.mode === 'diffusion')
    sc.setFrame(v.frame, !prefersReducedMotion());
  else if (sc.mode === 'osmosis' && v.mode === 'osmosis') sc.setFrame(v.frame);
}
