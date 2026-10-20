/**
 * The 3D view of "Di truyền Mendel": the two parents with one pair of homologous chromosomes per
 * gene, their gametes with exact probabilities, the Punnett board with one offspring per cell
 * coloured by phenotype class, the phenotype pedestals (bar height = exact probability) and,
 * after "Tạo ngẫu nhiên n con lai", the random offspring — the 2D table's counts for the same
 * seed. The scene comes from `scene.ts`, every value shown from the lesson's model (`binding.ts`,
 * `facts.ts`); the four steps (meiosis → gametes → fertilisation → offspring) are illustrative
 * motion. Renders on demand (frames only while a step plays; frame times feed the overload
 * ladder), one renderer per quality tier, the 2D page when WebGL is missing or lost; everything
 * is freed on unmount.
 */
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Focus,
  Pause,
  Play,
  RotateCcw,
  Tags,
  X,
} from 'lucide-react';
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
import { useCardHeadFit } from '../../division/mitosis3d/partCardHead';
import { perFigure } from '../../view3d/texts';
import { Segmented } from '../../ui';
import { CHI_VERDICT, drawLabel } from '../mendelCard';
import { InvalidGenotype } from '../MendelNotice';
import { mendelDraw, type MendelDraw } from '../mendelRun';
import { useMendel } from '../store';
import {
  MENDEL_STEPS,
  MENDEL_TOTAL,
  fieldCapFor,
  fieldOf,
  stepEnd,
  stepIndexAt,
  stepProgress,
  type Field3D,
  type MendelModel3D,
} from './binding';
import { FOV, VIEW_DIR, boxFrame, defaultInsets, mendelFrame, placeMendelCamera } from './camera';
import {
  CAMERA_NAME,
  COLOUR_NOTE,
  MENDEL_ILLUSTRATION,
  MENDEL_PARTS,
  STEP_NAME,
  STEP_NOTE,
  mendelCard3d,
  type MendelSelection,
} from './components';
import { pictureLabel, selectionCard, selectionValid, type Fmt } from './facts';
import { classLook } from './look';
import type { Vec3 } from './layout';
import { Mendel3DSwitch } from './Mendel3DSwitch';
import { buildMendelScene, type MendelScene } from './scene';
import { currentMendel, useMendel3D, type MendelCameraMode } from './store';
import '../../bio.css';

export type { RendererFactory };

/** Read-only hook for end-to-end tests (dev builds only), as `window.__simlab3d.mendel`. */
export interface Mendel3DDebug {
  info(): { geometries: number; textures: number; programs: number; calls: number };
  ratio(): string;
  step(): number;
  /** Figures of the offspring field drawn now. */
  field(): number;
  quality(): { tier: QualityTier; degraded: boolean };
  /** Page pixels of a picked thing's centre now (a cell, a gamete…), or null. */
  focus(sel: MendelSelection): { x: number; y: number } | null;
  /** A camera move (glide, damping) is still running. */
  moving(): boolean;
}

function tokenReader(): (name: string) => string {
  const css = getComputedStyle(document.documentElement);
  // Theme tokens only; the neutral fallback is for environments without the stylesheet.
  return (name) => css.getPropertyValue(name).trim() || 'gray';
}

/** The lesson's cross and the latest random draw, from the lesson's store. */
export function Mendel3DView({
  createRenderer = webglRenderer,
}: {
  createRenderer?: RendererFactory;
}) {
  const p1 = useMendel((s) => s.p1);
  const p2 = useMendel((s) => s.p2);
  const loci = useMendel((s) => s.loci);
  const dominance = useMendel((s) => s.dominance);
  const n = useMendel((s) => s.n);
  const seed = useMendel((s) => s.seed);
  const ran = useMendel((s) => s.ran);
  const read = useMemo(() => currentMendel({ p1, p2, loci, dominance }), [p1, p2, loci, dominance]);
  const draw = useMemo(
    () => mendelDraw({ p1, p2, loci, dominance, n, seed, ran }),
    [p1, p2, loci, dominance, n, seed, ran],
  );
  const card = useMemo(() => mendelCard3d(), []);
  usePublishCard(card);
  if (!read.ok) {
    // The 2D page's notice, and no scene.
    return (
      <div className="bio-scroll men3d-invalid" data-lesson="mendel">
        <div className="chem-toolbar">
          <Mendel3DSwitch />
        </div>
        <InvalidGenotype error={read.error} />
      </div>
    );
  }
  return <Mendel3DScene model={read.model} draw={draw} createRenderer={createRenderer} />;
}

/** The picked part's card: genotype, probability as a fraction and phenotype, from the model. */
function PartInfo({
  model,
  field,
  selected,
  fmt,
}: {
  model: MendelModel3D;
  field: Field3D | null;
  selected: MendelSelection;
  fmt: Fmt;
}) {
  const Lz = useLocalized();
  const info = selectionCard(model, selected, field, fmt);
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
                useMendel3D.setState({ selected: null });
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
                'Nguồn: SGK Sinh học 12; Campbell Biology · nội dung đang chờ giáo viên duyệt.',
                'Sources: Vietnamese Biology 12 textbook; Campbell Biology · awaiting teacher review.',
              ),
            )}
          </p>
        </div>
      </aside>
    </div>
  );
}

/** Four step buttons, filled up to the moment shown; a button shows its step complete. */
function StepStrip() {
  const Lz = useLocalized();
  const t = useMendel3D((s) => s.t);
  const current = stepIndexAt(t);
  return (
    <div
      className="m3d__stages"
      role="group"
      aria-label={Lz(L('Các bước', 'Steps'))}
      style={{ '--stage-count': MENDEL_STEPS.length } as CSSProperties}
    >
      {MENDEL_STEPS.map((id, k) => (
        <button
          key={id}
          type="button"
          className={cx('m3d__stage', k === current && 'is-current')}
          aria-current={k === current ? 'step' : undefined}
          style={{ '--fill': stepProgress(t, k) } as CSSProperties}
          onClick={() => {
            useMendel3D.setState({ t: stepEnd(k), playing: false });
          }}
        >
          {Lz(STEP_NAME[id])}
        </button>
      ))}
    </div>
  );
}

/** "Tạo ngẫu nhiên n con lai": the 2D page's draw (same store, same seed). */
function DrawButton({ fmt }: { fmt: Fmt }) {
  const Lz = useLocalized();
  const n = useMendel((s) => s.n);
  return (
    <button
      type="button"
      className="btn btn--accent"
      onClick={() => {
        useMendel.setState((s) => ({ ran: true, seed: s.seed + 1 }));
        useMendel3D.setState({ t: MENDEL_TOTAL, playing: false });
      }}
    >
      <Dices size={15} aria-hidden="true" /> {Lz(drawLabel(fmt.int(n)))}
    </button>
  );
}

/** What the draw gave: the 2D table's observed counts, χ² and verdict; the figure scale. */
function DrawChips({ draw, field, fmt }: { draw: MendelDraw; field: Field3D; fmt: Fmt }) {
  const Lz = useLocalized();
  return (
    <>
      <span className="chem-chip">
        {Lz(L('Quan sát O:', 'Observed O:'))}{' '}
        <strong className="mono">{draw.obs.map(fmt.int).join(' : ')}</strong>
      </span>
      <span className="chem-chip">
        χ² = {fmt.sig(Math.abs(draw.test.chi2) < 1e-12 ? 0 : draw.test.chi2, 4)} · p ={' '}
        {fmt.sig(draw.test.p, 3)}{' '}
        <span
          className={cx(
            'bio-verdict',
            draw.test.p >= 0.05 ? 'bio-verdict--ok' : 'bio-verdict--bad',
          )}
        >
          {Lz(draw.test.p >= 0.05 ? CHI_VERDICT.ok : CHI_VERDICT.bad)}
        </span>
      </span>
      {field.per > 1 && <span className="chem-chip">{Lz(perFigure(field.per, fmt.int))}</span>}
    </>
  );
}

/**
 * The reduced phenotype ratio (the 2D page's) and each class's colour, shape cue and key (the
 * pedestals' and the board's).
 */
function ClassLegend({ model }: { model: MendelModel3D }) {
  const Lz = useLocalized();
  return (
    <span className="chem-chip bio-legend men3d__legend">
      <span>
        {Lz(L('Tỉ lệ kiểu hình', 'Phenotype ratio'))}{' '}
        <strong className="mono">{model.ratioText}</strong>
      </span>
      {model.classes.map((cls) => (
        <span key={cls.key} className="men3d__key">
          <span
            className={`men3d__swatch men3d__swatch--${classLook(cls.index).shape}`}
            style={{ '--swatch': `var(${classLook(cls.index).token})` } as CSSProperties}
            aria-hidden="true"
          />
          <span className="mono">{cls.key}</span>
        </span>
      ))}
    </span>
  );
}

function Mendel3DScene({
  model,
  draw,
  createRenderer,
}: {
  model: MendelModel3D;
  draw: MendelDraw | null;
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
  const selected = useMendel3D((s) => s.selected);
  const camera = useMendel3D((s) => s.camera);
  const labelsChoice = useMendel3D((s) => s.labels);
  const playing = useMendel3D((s) => s.playing);
  const t = useMendel3D((s) => s.t);
  // "Hiện tên và chữ cái": on by default (the genotypes are the lesson's table).
  const labelsOn = labelsChoice ?? true;
  const stepIndex = stepIndexAt(t);
  const step = MENDEL_STEPS[stepIndex] ?? 'offspring';
  const quality = quality3d(tierName, tier);
  const field = useMemo(
    () => fieldOf(model, draw, fieldCapFor(quality.maxInstances)),
    [model, draw, quality.maxInstances],
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MendelScene | null>(null);
  const framedRef = useRef<ThreeHost | null>(null);
  /** The cross the camera was last framed for, and the draw the scene shows. */
  const framedModel = useRef<MendelModel3D | null>(null);
  const shownField = useRef<Field3D | null>(null);
  const fieldRef = useRef(field);
  const modelRef = useRef(model);
  useLayoutEffect(() => {
    fieldRef.current = field;
    modelRef.current = model;
  });

  // On screen.
  useEffect(() => {
    useMendel3D.setState({ active: true });
    return () => {
      useMendel3D.setState({ active: false, playing: false });
    };
  }, []);

  // A pick that no longer names a part of the cross (new inputs) is dropped.
  useEffect(() => {
    const sel = useMendel3D.getState().selected;
    if (sel && !selectionValid(model, sel)) useMendel3D.setState({ selected: null });
  }, [model]);

  const insetsOf = (host: HTMLElement) =>
    measureInsets(host, hudRef.current, defaultInsets(host.clientHeight), 1.1);
  const fieldShown = () => sceneRef.current?.fieldShown() ?? 0;
  const placement = (h: ThreeHost, mode: MendelCameraMode, dir: Vec3) => {
    const sc = sceneRef.current;
    if (!sc) return null;
    return placeMendelCamera(
      mendelFrame(mode, sc.dims, fieldShown()),
      mendelFrame('overview', sc.dims, fieldShown()),
      h.width(),
      h.height(),
      dir,
      h.currentInsets(),
    );
  };
  const frameCamera = (h: ThreeHost, mode: MendelCameraMode, animate = false) => {
    const p = placement(h, mode, VIEW_DIR);
    if (p) h.place(p, { animate });
  };

  const labelsRef = useRef<LabelLayer | null>(null);
  const tagsRef = useRef<TagLayer | null>(null);
  const labelsOnRef = useRef(labelsOn);
  const fmtRef = useRef(fmt);
  useLayoutEffect(() => {
    fmtRef.current = fmt;
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
    sc.tags(tags, fmtRef.current.int);
    tags.end();
    layer.update(
      sc.labelAnchors().map((a) => ({ id: a.id, text: Lz(MENDEL_PARTS[a.id]), point: a.point })),
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
    far: 800,
    canvasClass: 'mol-viewer__canvas',
    insets: () => (hostRef.current ? insetsOf(hostRef.current) : defaultInsets(1)),
    observe: () => hudRef.current?.querySelectorAll('[data-inset]') ?? [],
    onLayout: (h) => {
      const p = placement(h, useMendel3D.getState().camera, h.direction(VIEW_DIR));
      if (p) h.place(p);
    },
    onFail: () => {
      useMendel3D.setState({ webglFailed: true });
    },
    onFrame: (h) => {
      drawLabels(h);
    },
    onTap: (ray) => {
      const sc = sceneRef.current;
      if (!sc) return;
      useMendel3D.setState({ selected: sc.pick(ray) });
    },
    onDoubleTap: (ray) => {
      const sc = sceneRef.current;
      const h = hostRt.current;
      if (!sc || !h) return;
      const hit = sc.pick(ray);
      const at = hit ? sc.focusPoint(hit) : null;
      if (!at) return;
      const r = 1.8;
      const f = boxFrame([at[0] - r, at[1] - r, at[2] - r], [at[0] + r, at[1] + r, at[2] + r]);
      const p = placeMendelCamera(
        f,
        f,
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
      const hook: Mendel3DDebug = {
        info: () => {
          const i = h.info();
          return {
            geometries: i.geometries,
            textures: i.textures,
            programs: i.programs,
            calls: i.calls,
          };
        },
        ratio: () => modelRef.current.ratioText,
        step: () => stepIndexAt(useMendel3D.getState().t),
        field: () => sceneRef.current?.fieldShown() ?? 0,
        quality: () => ThreeHost.tierInEffect(),
        focus: (sel) => toPage(sceneRef.current?.focusPoint(sel) ?? null),
        moving: () => h.moving(),
      };
      return ThreeHost.registerDebug('mendel', hook);
    },
  });

  // Scene: rebuilt for a new cross, tier or theme; the renderer stays.
  useEffect(() => {
    const h = hostRt.current;
    if (!h) return;
    const sc = buildMendelScene(model, {
      tier: tierName,
      segments: tier.sphereSegments,
      maxInstances: quality.maxInstances,
      token: tokenReader(),
    });
    sceneRef.current = sc;
    h.setScene(sc.scene);
    const ui = useMendel3D.getState();
    sc.setField(fieldRef.current);
    shownField.current = fieldRef.current;
    sc.setTime(ui.t);
    sc.setSelection(ui.selected && selectionValid(model, ui.selected) ? ui.selected : null);
    if (framedRef.current !== h) {
      frameCamera(h, ui.camera);
      framedRef.current = h;
    } else if (framedModel.current !== model) {
      // Another cross: another board size — glide to its frame (a new theme keeps the view).
      frameCamera(h, ui.camera, true);
    }
    framedModel.current = model;
    h.request();
    const unsub = useMendel3D.subscribe((s, prev) => {
      if (s.t !== prev.t) sc.setTime(s.t);
      if (s.selected !== prev.selected)
        sc.setSelection(s.selected && selectionValid(model, s.selected) ? s.selected : null);
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
    // frameCamera and placement only read refs and the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, tier, tierName, theme, createRenderer]);

  // A new draw: the field changes (and with it the overview's frame).
  useEffect(() => {
    const sc = sceneRef.current;
    const h = hostRt.current;
    if (!sc || !h || shownField.current === field) return;
    sc.setField(field);
    shownField.current = field;
    const ui = useMendel3D.getState();
    if (ui.camera === 'overview') frameCamera(h, 'overview', true);
    h.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, hostRt]);

  usePlayback(useMendel3D, MENDEL_TOTAL, 1);

  useLayoutEffect(() => {
    hostRt.current?.relayout();
  }, [selected, field, hostRt]);

  // Name labels and tags: one pair of layers per renderer.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !hostRt.current) return;
    const tags = new TagLayer(host, 'men3d__tags');
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
    useMendel3D.setState((s) => ({ playing: !s.playing, t: s.t >= MENDEL_TOTAL ? 0 : s.t }));
  };
  const goTo = (k: number) => {
    useMendel3D.setState({ t: stepEnd(k), playing: false });
  };

  return (
    <div className="bio-view m3d men3d" data-lesson="mendel">
      <div
        ref={hostRef}
        className="m3d__gl"
        role="img"
        tabIndex={0}
        aria-label={Lz(pictureLabel(model, field, fmt))}
      />
      <div ref={hudRef} className="m3d__hud">
        <div className="chem-overlay m3d__top" data-inset="top">
          <IconButton
            icon={ChevronLeft}
            size="lg"
            label={Lz(L('Bước trước', 'Previous step'))}
            disabled={stepIndex === 0}
            onClick={() => {
              goTo(stepIndex - 1);
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
            disabled={stepIndex >= MENDEL_STEPS.length - 1 && t >= MENDEL_TOTAL}
            onClick={() => {
              goTo(t >= stepEnd(stepIndex) ? stepIndex + 1 : stepIndex);
            }}
          />
          <IconButton
            icon={RotateCcw}
            size="lg"
            label={Lz(L('Phát lại từ đầu', 'Replay from the start'))}
            onClick={() => {
              useMendel3D.setState({ t: 0, playing: !prefersReducedMotion() });
            }}
          />
          <ClassLegend model={model} />
        </div>
        <div className="m3d__side" data-inset="corner">
          <div className="m3d__side-row">
            <Mendel3DSwitch />
            <IconButton
              icon={Tags}
              size="lg"
              active={labelsOn}
              label={Lz(L('Hiện tên và chữ cái', 'Show names and letters'))}
              tooltipSide="left"
              onClick={() => {
                useMendel3D.setState({ labels: !labelsOn });
              }}
            />
            <IconButton
              icon={Focus}
              size="lg"
              label={Lz(L('Đặt lại góc nhìn', 'Reset view'))}
              tooltipSide="left"
              onClick={() => {
                useMendel3D.setState((s) => ({ viewNonce: s.viewNonce + 1 }));
              }}
            />
          </div>
          {!basic && (
            <div className="m3d__side-row">
              <Segmented<MendelCameraMode>
                label={L('Góc nhìn', 'View')}
                value={camera}
                options={[
                  { id: 'overview', label: CAMERA_NAME.overview },
                  { id: 'board', label: CAMERA_NAME.board },
                ]}
                onChange={(v) => {
                  useMendel3D.setState((s) => ({ camera: v, viewNonce: s.viewNonce + 1 }));
                }}
              />
            </div>
          )}
        </div>
        {selected && <PartInfo model={model} field={field} selected={selected} fmt={fmt} />}
        <div className="m3d__bottom" data-inset="bottom">
          <StepStrip />
          <div className="men3d__row">
            <DrawButton fmt={fmt} />
            {draw && field && <DrawChips draw={draw} field={field} fmt={fmt} />}
          </div>
          <p className="m3d__caption">
            <strong>{Lz(STEP_NAME[step])}.</strong> {Lz(STEP_NOTE[step])}{' '}
            <span className="muted">
              {Lz(COLOUR_NOTE)} {Lz(MENDEL_ILLUSTRATION)}{' '}
              {Lz(
                L(
                  'Bấm vào bố mẹ, một giao tử, một ô hay một cột để xem chi tiết. Kéo để xoay, cuộn để phóng to.',
                  'Click a parent, a gamete, a cell or a bar for details. Drag to rotate, scroll to zoom.',
                ),
              )}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
