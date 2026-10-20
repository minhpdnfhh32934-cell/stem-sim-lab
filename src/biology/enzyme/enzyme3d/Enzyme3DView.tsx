/**
 * The 3D view of "Động học enzyme": a glass reaction volume with a representative set of
 * enzymes, each free (E) or holding substrate (ES), inhibitor (EI) or both (ESI) in the model's
 * proportions, and the free substrate, product and inhibitor particles at a stated scale. The
 * 'rate' plot's view shows the steady state at an [S] cursor; the time course's view scrubs t.
 * The scene comes from `scene.ts`, every value shown from the lesson's model (`binding.ts`,
 * `facts.ts`); shapes, places and the particles' drift are illustration. Renders on demand
 * (frames only while playing or moving; frame times feed the overload ladder), one renderer per
 * quality tier, the 2D page when WebGL is missing or lost; everything is freed on unmount.
 */
import { Focus, Pause, Play, Tags, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import * as THREE from 'three';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { effectiveTier, usePerfStore, useTierConfig } from '@/perf/perfStore';
import { prefersReducedMotion } from '@/ui/three/availability';
import { measureInsets } from '@/ui/three/insets';
import { LabelLayer } from '@/ui/three/labelLayer';
import { useFrameLoop } from '@/ui/three/loop';
import { quality3d } from '@/ui/three/quality3d';
import { webglRenderer, type RendererFactory } from '@/ui/three/renderer';
import { TagLayer } from '@/ui/three/tagLayer';
import { ThreeHost, useThreeHost, type QualityInEffect } from '@/ui/three/useThreeHost';
import { IconButton } from '@/ui/IconButton';
import { L, usePublishCard } from '../../common';
import { useCardHeadFit } from '../../division/mitosis3d/partCardHead';
import { Segmented } from '../../ui';
import { ROLES, type BioRole } from '../../view3d/palette';
import { EnzymeChips } from '../chips';
import { useEnzyme } from '../store';
import {
  ENZYMES_DRAWN,
  PLAY_SECONDS,
  defaultCursor,
  formsOf,
  frameAt,
  type EnzymeCounts,
  type EnzymeForm,
  type EnzymeFrame,
  type EnzymeModel3D,
} from './binding';
import {
  CLOSE_DEFAULT,
  FOV,
  VIEW_DIR,
  aroundFrame,
  defaultInsets,
  enzymeFrame,
  placeEnzymeCamera,
} from './camera';
import {
  CAMERA_NAME,
  ENZYME_ILLUSTRATION,
  ENZYME_PARTS,
  ENZYME_SCALE_NOTE,
  FORM_SHORT,
  LOCK_KEY_SHORT,
  enzymeCard3d,
  type EnzymePart,
  type EnzymeSelection,
} from './components';
import { Enzyme3DSwitch } from './Enzyme3DSwitch';
import {
  countsText,
  pictureLabel,
  readout,
  scaleText,
  selectionCard,
  selectionValid,
  type Fmt,
} from './facts';
import type { Vec3 } from './layout';
import { buildEnzymeScene, type EnzymeScene } from './scene';
import { enzyme3dFor, useEnzyme3D, type EnzymeCameraMode } from './store';
import '../../bio.css';

export type { RendererFactory };

/** Read-only hook for end-to-end tests (dev builds only), as `window.__simlab3d.enzyme`. */
export interface Enzyme3DDebug {
  info(): { geometries: number; textures: number; programs: number; calls: number };
  /** Enzymes drawn in each form now. */
  counts(): EnzymeCounts;
  /** The form of each drawn enzyme now. */
  forms(): EnzymeForm[];
  /** Free particles drawn now. */
  particles(): { S: number; P: number; I: number };
  /** Particles standing for [S]₀ in the time view. */
  pool0(): number;
  quality(): QualityInEffect;
  /** Page pixels of a picked thing's centre now, or null. */
  focus(sel: EnzymeSelection): { x: number; y: number } | null;
  /** A camera move (glide, damping) is still running. */
  moving(): boolean;
}

function tokenReader(): (name: string) => string {
  const css = getComputedStyle(document.documentElement);
  // Theme tokens only; the neutral fallback is for environments without the stylesheet.
  return (name) => css.getPropertyValue(name).trim() || 'gray';
}

/** What the 'rate' and 'time' views show (the caption). */
const VIEW_NOTE = {
  rate: L(
    'Trạng thái dừng ở [S] đã chọn; số enzyme mỗi dạng theo tỉ lệ của mô hình.',
    'Steady state at the chosen [S]; the enzymes in each form follow the model’s shares.',
  ),
  time: L(
    '[S](t) chính xác (hàm Lambert W); hạt cơ chất dùng hết đổi thành hạt sản phẩm nên S + P không đổi.',
    'Exact [S](t) (Lambert W); each substrate particle used up turns into a product particle, so S + P stays the same.',
  ),
} as const;

const VIEW_NAME = {
  rate: L('Tốc độ theo [S]', 'Rate vs [S]'),
  time: L('Diễn biến theo thời gian', 'Over time'),
} as const;

/** The lesson's inputs, from its store. */
export function Enzyme3DView({
  createRenderer = webglRenderer,
}: {
  createRenderer?: RendererFactory;
}) {
  const vmax = useEnzyme((s) => s.vmax);
  const km = useEnzyme((s) => s.km);
  const kind = useEnzyme((s) => s.kind);
  const inhibitor = useEnzyme((s) => s.inhibitor);
  const ki = useEnzyme((s) => s.ki);
  const s0 = useEnzyme((s) => s.s0);
  const view = useEnzyme((s) => s.view);
  const model = useMemo(
    () => enzyme3dFor({ vmax, km, kind, inhibitor, ki, s0, view }),
    [vmax, km, kind, inhibitor, ki, s0, view],
  );
  const card = useMemo(() => enzymeCard3d(), []);
  usePublishCard(card);
  return <Enzyme3DScene model={model} createRenderer={createRenderer} />;
}

/** The picked part's card, from the model. */
function PartInfo({
  model,
  frame,
  forms,
  selected,
  fmt,
}: {
  model: EnzymeModel3D;
  frame: EnzymeFrame;
  forms: readonly EnzymeForm[];
  selected: EnzymeSelection;
  fmt: Fmt;
}) {
  const Lz = useLocalized();
  const info = selectionCard(model, frame, forms, selected, fmt);
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
                useEnzyme3D.setState({ selected: null });
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
                'Nguồn: Cornish-Bowden, Fundamentals of Enzyme Kinetics; SGK Sinh học 10 · nội dung đang chờ giáo viên duyệt.',
                'Sources: Cornish-Bowden, Fundamentals of Enzyme Kinetics; Vietnamese Biology 10 textbook · awaiting teacher review.',
              ),
            )}
          </p>
        </div>
      </aside>
    </div>
  );
}

/** Colour and shape cue of each role on the picture, and the particle scale. */
function Legend({ model, fmt }: { model: EnzymeModel3D; fmt: Fmt }) {
  const Lz = useLocalized();
  const roles: (BioRole & EnzymePart)[] = ['substrate'];
  if (model.view === 'time') roles.push('product');
  if (model.p.kind !== 'none') roles.push('inhibitor');
  return (
    <span className="chem-chip bio-legend enz3d__legend">
      {roles.map((role) => (
        <span key={role} className="enz3d__key">
          <span
            className={`bio3d-swatch bio3d-swatch--${ROLES[role].shape}`}
            style={{ '--swatch': `var(${ROLES[role].token})` } as CSSProperties}
            aria-hidden="true"
          />
          {Lz(ENZYME_PARTS[role])}
        </span>
      ))}
      <strong>{Lz(scaleText(model, fmt))}</strong>
    </span>
  );
}

function Enzyme3DScene({
  model,
  createRenderer,
}: {
  model: EnzymeModel3D;
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
  const selected = useEnzyme3D((s) => s.selected);
  const camera = useEnzyme3D((s) => s.camera);
  const labelsChoice = useEnzyme3D((s) => s.labels);
  const playing = useEnzyme3D((s) => s.playing);
  const t = useEnzyme3D((s) => s.t);
  const sCursor = useEnzyme3D((s) => s.s);
  // "Hiện tên": on by default (the forms over the enzymes are the model's counts).
  const labelsOn = labelsChoice ?? true;
  const x = model.view === 'time' ? t : (sCursor ?? defaultCursor(model));
  const frame = useMemo(() => frameAt(model, x), [model, x]);
  // The same order the scene uses: the card names the form of the enzyme picked.
  const forms = useMemo(() => formsOf(frame.counts), [frame]);
  const quality = quality3d(tierName, tier);
  const hostRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<EnzymeScene | null>(null);
  const framedRef = useRef<ThreeHost | null>(null);
  const frameRef = useRef(frame);
  const modelRef = useRef(model);
  const phaseRef = useRef(0);
  useLayoutEffect(() => {
    frameRef.current = frame;
    modelRef.current = model;
  });

  // On screen.
  useEffect(() => {
    useEnzyme3D.setState({ active: true });
    return () => {
      useEnzyme3D.setState({ active: false, playing: false });
    };
  }, []);

  // A pick that no longer names something drawn (a particle used up, new inputs) is dropped.
  useEffect(() => {
    const sel = useEnzyme3D.getState().selected;
    if (sel && !selectionValid(model, frame, sel)) useEnzyme3D.setState({ selected: null });
  }, [model, frame]);

  const insetsOf = (host: HTMLElement) =>
    measureInsets(host, hudRef.current, defaultInsets(host.clientHeight), 1.1);
  const closeEnzyme = () => {
    const sel = useEnzyme3D.getState().selected;
    return sel?.kind === 'enzyme' ? sel.index : CLOSE_DEFAULT;
  };
  const placement = (h: ThreeHost, mode: EnzymeCameraMode, dir: Vec3) =>
    placeEnzymeCamera(
      enzymeFrame(mode, closeEnzyme()),
      h.width(),
      h.height(),
      dir,
      h.currentInsets(),
    );
  const frameCamera = (h: ThreeHost, mode: EnzymeCameraMode, animate = false) => {
    h.place(placement(h, mode, VIEW_DIR), { animate });
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
    sc.tags(tags, (f) => Lz(FORM_SHORT[f]));
    tags.end();
    layer.update(
      sc.labelAnchors().map((a) => ({ id: a.id, text: Lz(ENZYME_PARTS[a.id]), point: a.point })),
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
      h.place(placement(h, useEnzyme3D.getState().camera, h.direction(VIEW_DIR)));
    },
    onFail: () => {
      useEnzyme3D.setState({ webglFailed: true });
    },
    onFrame: (h) => {
      drawLabels(h);
    },
    onTap: (ray) => {
      const sc = sceneRef.current;
      if (!sc) return;
      useEnzyme3D.setState({ selected: sc.pick(ray) });
    },
    onDoubleTap: (ray) => {
      const sc = sceneRef.current;
      const h = hostRt.current;
      if (!sc || !h) return;
      const hit = sc.pick(ray);
      const at = hit ? sc.focusPoint(hit) : null;
      if (!at) return;
      const p = placeEnzymeCamera(
        aroundFrame(at, 1.8),
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
      const hook: Enzyme3DDebug = {
        info: () => {
          const i = h.info();
          return {
            geometries: i.geometries,
            textures: i.textures,
            programs: i.programs,
            calls: i.calls,
          };
        },
        counts: () => ({ ...frameRef.current.counts }),
        forms: () => [...(sceneRef.current?.forms() ?? [])],
        particles: () => sceneRef.current?.drawn().particles ?? { S: 0, P: 0, I: 0 },
        pool0: () => modelRef.current.pool0,
        quality: () => h.qualityInEffect(),
        focus: (sel) => toPage(sceneRef.current?.focusPoint(sel) ?? null),
        moving: () => h.moving(),
      };
      return ThreeHost.registerDebug('enzyme', hook);
    },
  });

  // Scene: rebuilt for another inhibition type, tier or theme; the renderer stays.
  useEffect(() => {
    const h = hostRt.current;
    if (!h) return;
    const sc = buildEnzymeScene({
      tier: tierName,
      segments: tier.sphereSegments,
      kind: model.p.kind,
      token: tokenReader(),
    });
    sceneRef.current = sc;
    h.setScene(sc.scene);
    const ui = useEnzyme3D.getState();
    sc.setFrame(frameRef.current);
    sc.setPhase(phaseRef.current);
    sc.setSelection(
      ui.selected && selectionValid(modelRef.current, frameRef.current, ui.selected)
        ? ui.selected
        : null,
    );
    if (framedRef.current !== h) {
      frameCamera(h, ui.camera);
      framedRef.current = h;
    }
    h.request();
    const unsub = useEnzyme3D.subscribe((s, prev) => {
      if (s.selected !== prev.selected) {
        sc.setSelection(
          s.selected && selectionValid(modelRef.current, frameRef.current, s.selected)
            ? s.selected
            : null,
        );
        if (s.camera === 'close' && s.selected?.kind === 'enzyme') frameCamera(h, 'close', true);
      }
      if (s.camera !== prev.camera || s.viewNonce !== prev.viewNonce)
        frameCamera(h, s.camera, true);
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
  }, [model.p.kind, tier, tierName, theme, createRenderer]);

  // A new moment or new inputs: the forms and particles follow the model.
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    sc.setFrame(frame);
    hostRt.current?.request();
  }, [frame, hostRt]);

  // Play: the [S] cursor sweeps up to the top, or t runs to the end; free particles drift
  // (illustration, never with reduced motion). Frames only while playing.
  useFrameLoop(playing, (dt) => {
    const m = modelRef.current;
    const ui = useEnzyme3D.getState();
    if (!prefersReducedMotion()) {
      phaseRef.current += dt;
      sceneRef.current?.setPhase(phaseRef.current);
    }
    const top = m.view === 'time' ? m.tEnd : m.sTop;
    const now = m.view === 'time' ? ui.t : (ui.s ?? defaultCursor(m));
    const next = Math.min(top, now + (dt * top) / PLAY_SECONDS);
    const end = next >= top;
    if (m.view === 'time') useEnzyme3D.setState({ t: next, playing: !end });
    else useEnzyme3D.setState({ s: next, playing: !end });
    hostRt.current?.request();
    return !end;
  });

  useLayoutEffect(() => {
    hostRt.current?.relayout();
  }, [selected, hostRt]);

  // Name labels and tags: one pair of layers per renderer.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !hostRt.current) return;
    const tags = new TagLayer(host, 'enz3d__tags');
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

  const time = model.view === 'time';
  const top = time ? model.tEnd : model.sTop;
  const play = () => {
    useEnzyme3D.setState((s) => {
      if (s.playing) return { playing: false };
      // From the start again once the end is reached.
      if (time) return { playing: true, t: s.t >= model.tEnd ? 0 : s.t };
      const at = s.s ?? defaultCursor(model);
      return { playing: true, s: at >= model.sTop ? 0 : at };
    });
  };

  return (
    <div className="bio-view m3d enz3d" data-lesson="enzyme">
      <div
        ref={hostRef}
        className="m3d__gl"
        role="img"
        tabIndex={0}
        aria-label={Lz(pictureLabel(model, frame, fmt))}
      />
      <div ref={hudRef} className="m3d__hud">
        <div className="chem-overlay m3d__top" data-inset="top">
          <EnzymeChips />
        </div>
        <div className="m3d__side" data-inset="corner">
          <div className="m3d__side-row">
            <Enzyme3DSwitch />
            <IconButton
              icon={Tags}
              size="lg"
              active={labelsOn}
              label={Lz(L('Hiện tên và dạng enzyme', 'Show names and enzyme forms'))}
              tooltipSide="left"
              onClick={() => {
                useEnzyme3D.setState({ labels: !labelsOn });
              }}
            />
            <IconButton
              icon={Focus}
              size="lg"
              label={Lz(L('Đặt lại góc nhìn', 'Reset view'))}
              tooltipSide="left"
              onClick={() => {
                useEnzyme3D.setState((s) => ({ viewNonce: s.viewNonce + 1 }));
              }}
            />
          </div>
          {!basic && (
            <div className="m3d__side-row">
              <Segmented<EnzymeCameraMode>
                label={L('Góc nhìn', 'View')}
                value={camera}
                options={[
                  { id: 'overview', label: CAMERA_NAME.overview },
                  { id: 'close', label: CAMERA_NAME.close },
                ]}
                onChange={(v) => {
                  useEnzyme3D.setState((s) => ({ camera: v, viewNonce: s.viewNonce + 1 }));
                }}
              />
            </div>
          )}
        </div>
        {selected && (
          <PartInfo model={model} frame={frame} forms={forms} selected={selected} fmt={fmt} />
        )}
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
              aria-label={
                time
                  ? Lz(L('Thời gian', 'Time'))
                  : Lz(L('Nồng độ cơ chất [S]', 'Substrate concentration [S]'))
              }
              min={0}
              max={top}
              step={top / 400}
              value={frame.x}
              onChange={(e) => {
                const v = Number(e.target.value);
                useEnzyme3D.setState(time ? { t: v, playing: false } : { s: v, playing: false });
              }}
            />
            <output>{Lz(readout(frame, fmt))}</output>
          </div>
          <div className="enz3d__row">
            <span className="chem-chip">
              {Lz(
                L(
                  `Enzyme vẽ (${String(ENZYMES_DRAWN)}):`,
                  `Enzymes drawn (${String(ENZYMES_DRAWN)}):`,
                ),
              )}{' '}
              <strong className="mono enz3d__counts">{Lz(countsText(model, frame, fmt))}</strong>
            </span>
            <Legend model={model} fmt={fmt} />
          </div>
          <p className="m3d__caption">
            <strong>{Lz(VIEW_NAME[model.view])}.</strong> {Lz(VIEW_NOTE[model.view])}{' '}
            <span className="muted">
              {Lz(ENZYME_SCALE_NOTE)} {Lz(ENZYME_ILLUSTRATION)} {Lz(LOCK_KEY_SHORT)}{' '}
              {Lz(L('Bấm vào enzyme hay hạt để xem chi tiết.', 'Click an enzyme or a particle.'))}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
