import { ChevronLeft, ChevronRight, Focus, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useLocalized } from '@/app/i18n/localized';
import { formatNumber } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { FrameMonitor } from '@/perf/frameMonitor';
import { reportOverload, useTierConfig } from '@/perf/perfStore';
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
import { buildMitosisScene, type CameraFrame, type MitosisScene, type ScenePalette } from './scene';
import { timelineFor, useMitosis3D } from './store';
import { STAGES_3D, type CellType, type Stage3D, type Timeline } from './timeline';
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
    render: { calls: number };
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
  info(): { geometries: number; textures: number; programs: number; objects: number };
  stage(): Stage3D;
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
    wall: token('--chart-2'),
    spindle: token('--text-muted'),
    centrosome: token('--chart-5'),
    plate: token('--chart-2'),
    ring: token('--chart-7'),
    highlight: token('--accent'),
  };
}

// Slightly from the side and above: the equatorial plate shows as a plane, not a line.
const VIEW_DIR = new THREE.Vector3(0.55, 0.4, 1).normalize();

const VIEW_RIGHT = new THREE.Vector3()
  .crossVectors(new THREE.Vector3(0, 1, 0), VIEW_DIR)
  .normalize();
const VIEW_UP = new THREE.Vector3().crossVectors(VIEW_DIR, VIEW_RIGHT);

/** Camera distance (along VIEW_DIR) at which every point of the frame is inside the view. */
function fitDistance(f: CameraFrame, tanH: number, tanV: number): number {
  let dist = 1;
  const p = new THREE.Vector3();
  for (const q of f.points) {
    p.set(q[0], q[1], q[2]);
    const need =
      p.dot(VIEW_DIR) +
      Math.max(Math.abs(p.dot(VIEW_RIGHT)) / tanH, Math.abs(p.dot(VIEW_UP)) / tanV);
    dist = Math.max(dist, need);
  }
  // Margin for the controls drawn over the edges of the canvas.
  return dist * 1.22;
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

/** Stage strip: one button per stage, filled up to the current time. */
function StageStrip({ tl }: { tl: Timeline }) {
  const Lz = useLocalized();
  const t = useMitosis3D((s) => s.t);
  const current = tl.stageAt(t).index;
  return (
    <div className="m3d__stages" role="group" aria-label={Lz(L('Các kì', 'Stages'))}>
      {tl.stages.map((w, k) => {
        const fill = Math.min(1, Math.max(0, (t - w.start) / (w.end - w.start)));
        return (
          <button
            key={w.id}
            type="button"
            className={cx('m3d__stage', k === current && 'is-current')}
            aria-current={k === current ? 'step' : undefined}
            aria-label={Lz(STAGE3D_NAME[w.id])}
            style={{ '--fill': fill } as CSSProperties}
            onClick={() => {
              goToStage(tl, k);
            }}
          >
            {Lz(SHORT[w.id])}
          </button>
        );
      })}
    </div>
  );
}

/** Name + function of the picked part (and whether it can be seen at this moment). */
function PartInfo({ tl, selected }: { tl: Timeline; selected: Selection }) {
  const Lz = useLocalized();
  const visible = useMitosis3D((s) => componentVisible(selected.component, tl.stateAt(s.t)));
  const info = COMPONENTS[selected.component];
  return (
    <aside className="m3d__info" aria-live="polite">
      <div className="m3d__info-head">
        <strong>{Lz(info.name)}</strong>
        <IconButton
          icon={X}
          size="sm"
          label={Lz(L('Bỏ chọn', 'Clear selection'))}
          onClick={() => {
            useMitosis3D.setState({ selected: null });
          }}
        />
      </div>
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
    </aside>
  );
}

function CountsChip({ tl, stage }: { tl: Timeline; stage: Stage3D }) {
  const Lz = useLocalized();
  const c = tl.counts(stage);
  const kind = (n: number) =>
    Lz(
      L(
        c.state === 'double' ? `${n} NST kép` : `${n} NST đơn`,
        c.state === 'double' ? `${n} double chromosomes` : `${n} single chromosomes`,
      ),
    );
  let text: string;
  if (stage === 'telophase') {
    text = Lz(
      L(
        `1 tế bào · 2 nhân · mỗi nhân ${kind(c.perNucleus ?? 0)}`,
        `1 cell · 2 nuclei · ${kind(c.perNucleus ?? 0)} per nucleus`,
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
    frameCamera: (mode: CameraMode) => void;
    scene: MitosisScene | null;
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

    const cam = new THREE.PerspectiveCamera(38, width() / height(), 0.1, 400);
    // The stage strip and caption cover the bottom of the canvas: draw the picture a little
    // higher (a taller virtual image, cropped), so orbiting still turns around the cell centre.
    const lift = () => Math.round(height() * 0.07);
    const fitView = () => {
      const w = width();
      const h = height();
      const d = lift();
      cam.aspect = w / (h + 2 * d);
      cam.setViewOffset(w, h + 2 * d, 0, 2 * d, w, h);
      cam.updateProjectionMatrix();
    };
    fitView();
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.minDistance = 4;
    controls.maxDistance = 80;

    let frame = 0;
    const rt = {
      request: () => {
        if (!frame) frame = requestAnimationFrame(render);
      },
      frameCamera: (mode: CameraMode) => {
        if (!rt.scene) return;
        const f = rt.scene.frame(mode);
        // Visible half-angles of the cropped view.
        const h = height();
        const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (h / (h + 2 * lift()));
        const tanH = (tanV * width()) / h;
        const dist = fitDistance(f, tanH, tanV);
        const [cx, cy, cz] = f.center;
        controls.target.set(cx, cy, cz);
        cam.position.set(cx + VIEW_DIR.x * dist, cy + VIEW_DIR.y * dist, cz + VIEW_DIR.z * dist);
        cam.lookAt(controls.target);
        controls.update();
      },
      scene: null as MitosisScene | null,
      framedFor: null as Timeline | null,
    };
    const render = () => {
      frame = 0;
      if (rt.scene) renderer.render(rt.scene.scene, cam);
    };
    controls.addEventListener('change', rt.request);

    // Picking: a click without a drag selects the part under the pointer.
    const ray = new THREE.Raycaster();
    ray.params.Line = { threshold: 0.12 };
    const ndc = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      down = null;
      if (!rt.scene) return;
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
            fitView();
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
        }),
        stage: () => {
          const d = useDivisionStore.getState();
          return timelineFor(d.pairs, d.cellType).stageAt(useMitosis3D.getState().t).stage;
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
    const ui = useMitosis3D.getState();
    ms.update(tl.stateAt(ui.t));
    ms.setSelection(ui.selected);
    // A theme change keeps the learner's camera; a new cell or 2n is framed again.
    if (rt.framedFor !== tl) {
      rt.frameCamera(ui.camera);
      rt.framedFor = tl;
    }
    rt.request();
    const unsub = useMitosis3D.subscribe((s, prev) => {
      if (s.t !== prev.t) ms.update(tl.stateAt(s.t));
      if (s.selected !== prev.selected) ms.setSelection(s.selected);
      if (s.camera !== prev.camera || s.viewNonce !== prev.viewNonce) rt.frameCamera(s.camera);
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
      const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000));
      prev = now;
      monitor.record(dt);
      if (monitor.overloaded) {
        reportOverload();
        monitor.resetOverload();
      }
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
      <div className="chem-overlay m3d__top">
        <IconButton
          icon={ChevronLeft}
          size="lg"
          label={Lz(L('Kì trước', 'Previous stage'))}
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
          label={Lz(L('Kì tiếp theo', 'Next stage'))}
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
            useMitosis3D.setState({ t: 0, playing: true });
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
          <span className="rx-swatch bio-swatch--m" /> {Lz(L('từ mẹ', 'maternal'))}
          <span className="rx-swatch bio-swatch--p" /> {Lz(L('từ bố', 'paternal'))}
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
          onChange={(v) => {
            useDivisionStore.setState({ cellType: v });
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
      {selected && <PartInfo tl={tl} selected={selected} />}
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
  );
}
