/**
 * The 3D view of "Đột biến điểm": the normal and the mutated DNA as two double helices one above
 * the other, their mRNAs with codon brackets and the two protein chains side by side, with the
 * changed base pairs outlined. The scene comes from `scene.ts`, every value shown from the lesson's
 * model (`binding.ts`, `facts.ts`, `EFFECT`). Picking a base pair of the normal DNA moves the
 * mutation there (the panel's "Vị trí", saved and undoable). Renders on demand (a frame per
 * change; frames only while the outlines pulse after a change, never under reduced motion; frame
 * times feed the overload ladder), one renderer per quality tier, the 2D page when WebGL is
 * missing or lost; everything is freed on unmount.
 */
import { Focus, Tags, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { effectiveTier, usePerfStore, useTierConfig } from '@/perf/perfStore';
import { prefersReducedMotion } from '@/ui/three/availability';
import { measureInsets } from '@/ui/three/insets';
import { LabelLayer } from '@/ui/three/labelLayer';
import { LABEL_EDGE } from '@/ui/three/labels';
import { useFrameLoop } from '@/ui/three/loop';
import { quality3d } from '@/ui/three/quality3d';
import { webglRenderer, type RendererFactory } from '@/ui/three/renderer';
import { TagLayer } from '@/ui/three/tagLayer';
import { ThreeHost, useThreeHost, type QualityInEffect } from '@/ui/three/useThreeHost';
import { IconButton } from '@/ui/IconButton';
import { cx } from '@/ui/cx';
import { L, usePublishCard } from '../../common';
import { Segmented } from '../../ui';
import { useCardHeadFit } from '../../division/mitosis3d/partCardHead';
import { InvalidSequence } from '../DogmaViews';
import { useDogmaStore } from '../state';
import { proteinText, type HelixId, type MutationModel3D } from './binding';
import { FOV, VIEW_DIR, defaultInsets, mutationFrame, placeMutationCamera } from './camera';
import {
  CAMERA_NAME,
  MUTATION_ILLUSTRATION,
  MUTATION_PARTS,
  mutationCard3d,
  type MutationSelection,
} from './components';
import { changeChip, effectOf, pictureLabel, selectionCard } from './facts';
import type { Vec3 } from './layout';
import { Mutation3DSwitch } from './Mutation3DSwitch';
import { PULSE_PERIOD, buildMutationScene, type MutationScene } from './scene';
import {
  applyPick,
  currentMutation,
  mutation3dFor,
  useMutation3D,
  type MutationCameraMode,
} from './store';
import '../../bio.css';

export type { RendererFactory };

/** Read-only hook for end-to-end tests (dev builds only), as `window.__simlab3d.mutation`. */
export interface Mutation3DDebug {
  info(): { geometries: number; textures: number; programs: number; calls: number };
  effect(): string;
  window(): { from: number; to: number } | null;
  quality(): QualityInEffect;
  /** Page pixels of a base pair's coding half (0-based index), or null when not in view. */
  pairPoint(helix: HelixId, i: number): { x: number; y: number } | null;
  /** Page pixels of a picked thing's centre now (a bead, a codon…), or null. */
  focus(sel: MutationSelection): { x: number; y: number } | null;
  /** A camera move (glide, damping) is still running. */
  moving(): boolean;
}

/** Number of pulses of the outlines after the mutation changes. */
const PULSES = 4;

/** The two lanes of the picture (tags at their plates' corners). */
const LANE_NAME = {
  normal: L('Bình thường', 'Normal'),
  mutated: L('Đột biến', 'Mutated'),
} as const;

function tokenReader(): (name: string) => string {
  const css = getComputedStyle(document.documentElement);
  // Theme tokens only; the neutral fallback is for environments without the stylesheet.
  return (name) => css.getPropertyValue(name).trim() || 'gray';
}

/** What the view needs to read the lesson: the learner's DNA and the panel's mutation. */
export function Mutation3DView({
  createRenderer = webglRenderer,
}: {
  createRenderer?: RendererFactory;
}) {
  const Lz = useLocalized();
  const input = useDogmaStore((s) => s.input);
  const strand = useDogmaStore((s) => s.strand);
  const kind = useDogmaStore((s) => s.kind);
  const pos = useDogmaStore((s) => s.pos);
  const bases = useDogmaStore((s) => s.bases);
  const count = useDogmaStore((s) => s.count);
  const read = useMemo(
    () => currentMutation({ input, strand, kind, pos, bases, count }),
    [input, strand, kind, pos, bases, count],
  );
  const card = useMemo(() => mutationCard3d(), []);
  usePublishCard(card);
  if (!read.ok || !read.m) {
    // The 2D page's notice (or what is missing), and no scene.
    return (
      <div className="bio-scroll mut3d-invalid" data-lesson="pointMutation">
        <div className="chem-toolbar">
          <Mutation3DSwitch />
        </div>
        {!read.ok ? (
          <InvalidSequence error={read.error} />
        ) : (
          <p className="chem-note" role="status">
            {Lz(
              L(
                'Chưa có đột biến để so sánh: hãy nhập nuclêôtit mới ở bảng điều khiển.',
                'No mutation to compare yet: enter the new base(s) in the control panel.',
              ),
            )}
          </p>
        )}
      </div>
    );
  }
  return (
    <Mutation3DScene model={mutation3dFor(read.coding, read.m)} createRenderer={createRenderer} />
  );
}

/** The picked part's card: the model's facts about a base pair, a codon or an amino acid. */
function PartInfo({ model, selected }: { model: MutationModel3D; selected: MutationSelection }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
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
                useMutation3D.setState({ selected: null });
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

/** Both proteins as the 2D page writes them, one above the other. */
function Proteins({ model }: { model: MutationModel3D }) {
  const Lz = useLocalized();
  const rows: [HelixId, string][] = [
    ['normal', proteinText(model.normal.t)],
    ['mutated', proteinText(model.mutated.t)],
  ];
  return (
    <div className="mut3d__proteins">
      {rows.map(([h, text]) => (
        <p key={h} className="mut3d__protein">
          <span className="mut3d__protein-label">
            {Lz(h === 'normal' ? MUTATION_PARTS.normalProtein : MUTATION_PARTS.mutatedProtein)}
          </span>
          {text ? (
            <span className="seq">{text}</span>
          ) : (
            <span className="muted">
              {Lz(L('Không có bộ ba mở đầu AUG.', 'No AUG start codon.'))}
            </span>
          )}
        </p>
      ))}
    </div>
  );
}

function Mutation3DScene({
  model,
  createRenderer,
}: {
  model: MutationModel3D;
  createRenderer: RendererFactory;
}) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const uiMode = useSettingsStore((s) => s.uiMode);
  const tier = useTierConfig();
  const tierName = usePerfStore(effectiveTier);
  const theme = useResolvedTheme();
  const fmt = (v: number) => formatNumber(locale, v);
  const basic = uiMode === 'basic';
  const selected = useMutation3D((s) => s.selected);
  const camera = useMutation3D((s) => s.camera);
  const labelsChoice = useMutation3D((s) => s.labels);
  // "Hiện tên": on by default in Basic mode.
  const labelsOn = labelsChoice ?? basic;
  const effect = effectOf(model);
  const warn = model.effect !== 'silent' && model.effect !== 'outsideCds';
  const hostRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MutationScene | null>(null);
  const framedRef = useRef<ThreeHost | null>(null);
  const modelRef = useRef(model);
  useLayoutEffect(() => {
    modelRef.current = model;
  });

  // On screen.
  useEffect(() => {
    useMutation3D.setState({ active: true });
    return () => {
      useMutation3D.setState({ active: false });
    };
  }, []);

  const insetsOf = (host: HTMLElement) =>
    measureInsets(host, hudRef.current, defaultInsets(host.clientHeight), 1.1);
  const placement = (h: ThreeHost, mode: MutationCameraMode, dir: Vec3) => {
    const sc = sceneRef.current;
    if (!sc) return null;
    const win = sc.window();
    return placeMutationCamera(
      mutationFrame(mode, model, win),
      mutationFrame('overview', model, win),
      h.width(),
      h.height(),
      dir,
      h.currentInsets(),
    );
  };
  const frameCamera = (h: ThreeHost, mode: MutationCameraMode, animate = false) => {
    const p = placement(h, mode, VIEW_DIR);
    if (p) h.place(p, { animate });
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
    sc.tags(tags, h.camera.position, h.controls.target, w - i.left - i.right, fmt, {
      normal: Lz(LANE_NAME.normal),
      mutated: Lz(LANE_NAME.mutated),
    });
    tags.end();
    // Names never cover the helices, the mRNAs, the chains or the tags over them (strand ends,
    // lane names, positions, letters), and stay a few pixels inside the stage.
    layer.update(
      sc.labelAnchors().map((a) => ({ id: a.id, text: Lz(MUTATION_PARTS[a.id]), point: a.point })),
      h.camera,
      w,
      hh,
      safe,
      h.quality.labelCap,
      { ...sc.labelObstacles(), rects: tags.rects(), edge: LABEL_EDGE },
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
      const p = placement(h, useMutation3D.getState().camera, h.direction(VIEW_DIR));
      if (p) h.place(p);
    },
    onFail: () => {
      useMutation3D.setState({ webglFailed: true });
    },
    onFrame: (h) => {
      drawLabels(h);
    },
    onTap: (ray) => {
      const sc = sceneRef.current;
      if (!sc) return;
      applyPick(sc.pick(ray));
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
      const p = placeMutationCamera(
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
      const hook: Mutation3DDebug = {
        info: () => {
          const i = h.info();
          return {
            geometries: i.geometries,
            textures: i.textures,
            programs: i.programs,
            calls: i.calls,
          };
        },
        effect: () => modelRef.current.effect,
        window: () => sceneRef.current?.window() ?? null,
        quality: () => h.qualityInEffect(),
        pairPoint: (helix, i) => toPage(sceneRef.current?.pairPoint(helix, i) ?? null),
        focus: (sel) => toPage(sceneRef.current?.focusPoint(sel) ?? null),
        moving: () => h.moving(),
      };
      return ThreeHost.registerDebug('mutation', hook);
    },
  });
  // The outlines pulse a few times after each change of the mutation (never with reduced motion).
  const [pulsed, setPulsed] = useState<MutationModel3D | null>(null);
  const pulsing = pulsed !== model && !prefersReducedMotion();
  const pulse = useRef<{ model: MutationModel3D | null; t: number }>({ model: null, t: 0 });
  useFrameLoop(pulsing, (dt) => {
    const sc = sceneRef.current;
    const h = hostRt.current;
    const now = modelRef.current;
    if (pulse.current.model !== now) pulse.current = { model: now, t: 0 };
    pulse.current.t += dt;
    const end = pulse.current.t >= PULSES * PULSE_PERIOD;
    sc?.setPulse(end ? null : pulse.current.t);
    h?.request();
    if (end) {
      setPulsed(now);
      return false;
    }
    return true;
  });

  // Scene: rebuilt for a new mutation, tier or theme; the renderer stays.
  useEffect(() => {
    const h = hostRt.current;
    if (!h) return;
    const sc = buildMutationScene(model, {
      tier: tierName,
      segments: tier.sphereSegments,
      maxBasePairs: quality.maxInstances,
      token: tokenReader(),
      hdr: quality.bloom,
      accents: quality.accents,
    });
    const before = sceneRef.current;
    sceneRef.current = sc;
    h.setScene(sc.scene);
    const ui = useMutation3D.getState();
    sc.setSelection(ui.selected);
    sc.setPulse(null);
    if (framedRef.current !== h) {
      frameCamera(h, ui.camera);
      framedRef.current = h;
    } else if (before && ui.camera === 'site') {
      // The site moved: glide to it (at once while the learner holds the camera).
      frameCamera(h, 'site', !h.dragging());
    }
    h.request();
    const unsub = useMutation3D.subscribe((s, prev) => {
      if (s.selected !== prev.selected) sc.setSelection(s.selected);
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
    // frameCamera and placement only read refs and the model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, tier, tierName, theme, createRenderer]);

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

  return (
    <div className="bio-view m3d mut3d" data-lesson="pointMutation">
      <div
        ref={hostRef}
        className="m3d__gl"
        role="img"
        tabIndex={0}
        aria-label={Lz(pictureLabel(model, fmt))}
      />
      <div ref={hudRef} className="m3d__hud">
        <div className="chem-overlay m3d__top" data-inset="top">
          <span className={cx('chem-chip', warn && 'chem-chip--approx')}>
            <strong>{Lz(effect.name)}</strong>
          </span>
          <span className="chem-chip">{Lz(changeChip(model, fmt))}</span>
          {!basic && (
            <span className="chem-chip bio-legend dogma3d__legend">
              {(['A', 'T', 'U', 'G', 'C'] as const).map((b) => (
                <span key={b} className="dogma3d__key">
                  <span className={`rx-swatch dogma3d__swatch--${b}`} aria-hidden="true" />
                  {b}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className="m3d__side" data-inset="corner">
          <div className="m3d__side-row">
            <Mutation3DSwitch />
            <IconButton
              icon={Tags}
              size="lg"
              active={labelsOn}
              label={Lz(L('Hiện tên và chữ cái', 'Show names and letters'))}
              tooltipSide="left"
              onClick={() => {
                useMutation3D.setState({ labels: !labelsOn });
              }}
            />
            <IconButton
              icon={Focus}
              size="lg"
              label={Lz(L('Đặt lại góc nhìn', 'Reset view'))}
              tooltipSide="left"
              onClick={() => {
                useMutation3D.setState((s) => ({ viewNonce: s.viewNonce + 1 }));
              }}
            />
          </div>
          <div className="m3d__side-row">
            <Segmented<MutationCameraMode>
              label={L('Góc nhìn', 'View')}
              value={camera}
              options={[
                { id: 'overview', label: CAMERA_NAME.overview },
                { id: 'site', label: CAMERA_NAME.site },
              ]}
              onChange={(v) => {
                useMutation3D.setState((s) => ({ camera: v, viewNonce: s.viewNonce + 1 }));
              }}
            />
          </div>
        </div>
        {selected && <PartInfo model={model} selected={selected} />}
        <div className="m3d__bottom" data-inset="bottom">
          <Proteins model={model} />
          <p className="m3d__caption">
            {Lz(effect.desc)}{' '}
            <span className="muted">
              {Lz(MUTATION_ILLUSTRATION)}{' '}
              {Lz(
                L(
                  'Bấm vào một cặp nuclêôtit của ADN bình thường để đặt vị trí đột biến; bấm bộ ba hay axit amin để so sánh. Kéo để xoay, cuộn để phóng to.',
                  'Click a base pair of the normal DNA to put the mutation there; click a codon or an amino acid to compare. Drag to rotate, scroll to zoom.',
                ),
              )}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
