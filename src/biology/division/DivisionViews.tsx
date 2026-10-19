import { ChevronLeft, ChevronRight, Pause, Play, Shuffle } from 'lucide-react';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useCanvas, type DrawContext } from '@/ui/canvas/useCanvas';
import { IconButton } from '@/ui/IconButton';
import { cx } from '@/ui/cx';
import { L, usePublishCard } from '../common';
import { rng } from '../genetics/stats';
import {
  PAIR_CHOICES,
  STAGE_NAME,
  STAGE_NOTE,
  cardFor,
  useDivisionStore,
  useStages,
} from './state';
import { claimStageIndex, setDivisionState } from './stageIndex';
import {
  STAGES,
  countsOf,
  type Chromatid,
  type Chromosome,
  type Division,
  type StageState,
} from './division';
import { scatterLayout } from './layout2d';
import '../bio.css';

const CHROMO_LEN = [0.36, 0.28, 0.22, 0.18];

function drawChromatid(
  d: DrawContext,
  c: Chromatid,
  x: number,
  y: number,
  len: number,
  w: number,
  colors: Record<string, string>,
) {
  const { ctx } = d;
  for (const s of c) {
    ctx.fillStyle = colors[s.origin] ?? '#888';
    const y0 = y - len / 2 + s.from * len;
    const h = (s.to - s.from) * len;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y0, w, h, w / 2);
    ctx.fill();
  }
}

/** Draws one chromosome (single or double) centred at (x, y). */
function drawChromosome(
  d: DrawContext,
  c: Chromosome,
  x: number,
  y: number,
  scale: number,
  colors: Record<string, string>,
  spread = 1,
) {
  const len = (CHROMO_LEN[c.pair % CHROMO_LEN.length] ?? 0.2) * scale;
  const w = Math.max(4, scale * 0.045);
  if (c.chromatids.length === 2) {
    drawChromatid(d, c.chromatids[0] ?? [], x - w * 0.55 * spread, y, len, w, colors);
    drawChromatid(d, c.chromatids[1] ?? [], x + w * 0.55 * spread, y, len, w, colors);
    d.ctx.fillStyle = colors.centromere ?? '#333';
    d.ctx.beginPath();
    d.ctx.arc(x, y, w * 0.45, 0, 2 * Math.PI);
    d.ctx.fill();
  } else {
    drawChromatid(d, c.chromatids[0] ?? [], x, y, len, w, colors);
  }
}

function drawStage(d: DrawContext, s: StageState) {
  const { ctx, width, height, css } = d;
  const colors = { M: css('--chart-4'), P: css('--chart-1'), centromere: css('--text') };
  const nCells = s.cells.length;
  const cols = nCells;
  const cw = (width - 40) / cols;
  const ch = height - 110;
  const scale = Math.min(cw, ch) * 0.9;
  const condensed = s.stage !== 'g1' && s.stage !== 'g2';
  s.cells.forEach((cell, k) => {
    const cx = 20 + cw * (k + 0.5);
    const cy = 70 + ch / 2;
    const rx = Math.min(cw * 0.46, ch * 0.62);
    const ry = Math.min(ch * 0.46, rx * 0.8);
    ctx.strokeStyle = css('--border-strong');
    ctx.fillStyle = css('--bg-panel-2');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    const poles = s.poles?.[k];
    const isMeta = s.stage.startsWith('metaphase');
    if (isMeta || poles) {
      // Spindle
      ctx.strokeStyle = css('--text-faint');
      ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - rx * 0.92, cy);
        ctx.quadraticCurveTo(cx, cy + i * ry * 0.22, cx + rx * 0.92, cy);
        ctx.stroke();
      }
    }
    if (!condensed) {
      // Decondensed chromatin: thin wavy threads (illustrative).
      const rand = rng(7 + k);
      ctx.lineWidth = 1.6;
      for (const c of cell.chromosomes) {
        for (let t = 0; t < c.chromatids.length; t++) {
          ctx.strokeStyle = colors[c.origin];
          ctx.beginPath();
          let x = cx + (rand() - 0.5) * rx * 1.1;
          let y = cy + (rand() - 0.5) * ry * 1.1;
          ctx.moveTo(x, y);
          for (let j = 0; j < 7; j++) {
            x += (rand() - 0.5) * rx * 0.25;
            y += (rand() - 0.5) * ry * 0.25;
            ctx.lineTo(
              Math.max(cx - rx * 0.75, Math.min(cx + rx * 0.75, x)),
              Math.max(cy - ry * 0.75, Math.min(cy + ry * 0.75, y)),
            );
          }
          ctx.stroke();
        }
      }
      return;
    }
    if (poles) {
      const [a, b] = poles;
      const place = (list: Chromosome[], side: -1 | 1) => {
        list.forEach((c, i) => {
          const y = cy + ((i - (list.length - 1) / 2) * (ry * 1.5)) / Math.max(1, list.length);
          drawChromosome(d, c, cx + side * rx * 0.5, y, scale * 0.8, colors, 1);
        });
      };
      place(a, -1);
      place(b, 1);
      return;
    }
    if (s.stage === 'metaphase1' || s.stage === 'prophase1') {
      // Homologous pairs side by side (tetrads); on the equator in metaphase I.
      const pairs = [...new Set(cell.chromosomes.map((c) => c.pair))];
      pairs.forEach((p, i) => {
        const m = cell.chromosomes.find((c) => c.pair === p && c.origin === 'M');
        const pa = cell.chromosomes.find((c) => c.pair === p && c.origin === 'P');
        const y =
          s.stage === 'metaphase1'
            ? cy + ((i - (pairs.length - 1) / 2) * (ry * 1.5)) / Math.max(1, pairs.length)
            : cy + ((i - (pairs.length - 1) / 2) * (ry * 1.3)) / Math.max(1, pairs.length);
        const x = s.stage === 'metaphase1' ? cx : cx + ((i % 2) - 0.5) * rx * 0.5;
        const gap = scale * 0.07;
        // Orientation is random in metaphase I: the first-pole homologue is drawn on the left.
        const leftFirst = s.stage === 'metaphase1' ? (s.orientation?.[p] ?? true) : true;
        if (m) drawChromosome(d, m, x + (leftFirst ? -gap : gap), y, scale * 0.8, colors);
        if (pa) drawChromosome(d, pa, x + (leftFirst ? gap : -gap), y, scale * 0.8, colors);
      });
      return;
    }
    const n = cell.chromosomes.length;
    if (s.stage === 'metaphase' || s.stage === 'metaphase2') {
      cell.chromosomes.forEach((c, i) => {
        const y = cy + ((i - (n - 1) / 2) * (ry * 1.5)) / Math.max(1, n);
        drawChromosome(d, c, cx, y, scale * 0.7, colors);
      });
      return;
    }
    // Prophase, telophase: one slot each inside the cell, so no two chromosomes overlap.
    const sc = scale * 0.8;
    const itemH = Math.max(
      ...cell.chromosomes.map((c) => (CHROMO_LEN[c.pair % CHROMO_LEN.length] ?? 0.2) * sc),
    );
    const width = Math.max(4, sc * 0.045);
    const double = cell.chromosomes.some((c) => c.chromatids.length === 2);
    // A double chromosome is two chromatids side by side (drawChromosome), plus a gap.
    const itemW = (double ? 2.1 : 1) * width * 1.6;
    const lay = scatterLayout(
      n,
      cx,
      cy,
      rx * 0.62,
      ry * 0.62,
      itemW,
      itemH * 1.1,
      rng(31 + k * 17),
    );
    cell.chromosomes.forEach((c, i) => {
      const p = lay.slots[i];
      if (p) drawChromosome(d, c, p.x, p.y, sc * lay.fit, colors);
    });
  });
}

export function DivisionStage({
  kind,
  toolbar,
  notice,
}: {
  kind: Division;
  /** Extra controls at the end of the toolbar (the mitosis 3D / 2D switch). */
  toolbar?: ReactNode;
  /** Why this 2D picture is shown instead of the 3D one, when it is not the learner's choice. */
  notice?: string | undefined;
}) {
  const Lz = useLocalized();
  const card = useMemo(() => cardFor(kind), [kind]);
  usePublishCard(card);
  const stages = useStages(kind);
  const { index, playing } = useDivisionStore();
  const i = Math.min(index, stages.length - 1);
  const s = stages[i];

  useEffect(() => {
    // Keeps the stage when it is this division's (back from the 3D view, a restored file);
    // an index written for the other division starts again at the first stage.
    claimStageIndex(kind);
    useDivisionStore.setState({ playing: false });
  }, [kind]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const st = useDivisionStore.getState();
      if (st.index >= stages.length - 1) useDivisionStore.setState({ playing: false });
      else setDivisionState(kind, { index: st.index + 1 });
    }, 1600);
    return () => {
      window.clearInterval(id);
    };
  }, [playing, stages.length, kind]);

  const canvasRef = useCanvas(
    (d) => {
      if (s) drawStage(d, s);
    },
    false,
    [s, kind],
  );
  if (!s) return null;
  const c = countsOf(s);
  return (
    <div className="bio-view">
      <canvas ref={canvasRef} className="chem-canvas" aria-label={Lz(STAGE_NAME[s.stage])} />
      <div className="chem-overlay">
        <IconButton
          icon={ChevronLeft}
          label={Lz(L('Bước trước', 'Previous step'))}
          disabled={i === 0}
          onClick={() => {
            setDivisionState(kind, { index: Math.max(0, i - 1), playing: false });
          }}
        />
        <IconButton
          icon={playing ? Pause : Play}
          label={playing ? Lz(L('Tạm dừng', 'Pause')) : Lz(L('Phát', 'Play'))}
          variant="solid"
          onClick={() => {
            const x = useDivisionStore.getState();
            setDivisionState(kind, {
              playing: !x.playing,
              index: x.index >= stages.length - 1 ? 0 : x.index,
            });
          }}
        />
        <IconButton
          icon={ChevronRight}
          label={Lz(L('Bước tiếp theo', 'Next step'))}
          disabled={i >= stages.length - 1}
          onClick={() => {
            setDivisionState(kind, { index: Math.min(stages.length - 1, i + 1), playing: false });
          }}
        />
        <span className="chem-chip">
          <strong>{Lz(STAGE_NAME[s.stage])}</strong>
        </span>
        <span className="chem-chip">
          {c.cells} {Lz(L('tế bào', c.cells > 1 ? 'cells' : 'cell'))} · {c.chromosomes}{' '}
          {Lz(
            L(
              c.state === 'double' ? 'NST kép' : 'NST đơn',
              c.state === 'double' ? 'double chromosomes' : 'single chromosomes',
            ),
          )}
          {Lz(L(' / tế bào', ' / cell'))}
        </span>
        <span className="chem-chip bio-legend">
          {Lz(L('NST nguồn gốc', 'Chromosomes from'))}
          <span className="rx-swatch bio-swatch--m" /> {Lz(L('từ mẹ', 'the mother'))}
          <span className="rx-swatch bio-swatch--p" /> {Lz(L('từ bố', 'the father'))}
        </span>
        {toolbar}
        {notice && <span className="chem-chip chem-chip--qual">{notice}</span>}
      </div>
      <p className="bio-caption">{Lz(STAGE_NOTE[s.stage])}</p>
    </div>
  );
}

export function DivisionPanel({ kind }: { kind: Division }) {
  const Lz = useLocalized();
  const { pairs, crossover } = useDivisionStore();
  return (
    <div className="chem-form">
      <label>
        <span>{Lz(L('Bộ NST lưỡng bội 2n', 'Diploid number 2n'))}</span>
        <select
          value={pairs}
          onChange={(e) => {
            setDivisionState(kind, { pairs: Number(e.target.value), index: 0 });
          }}
        >
          {PAIR_CHOICES.map((n) => (
            <option key={n} value={n}>
              2n = {2 * n}
            </option>
          ))}
        </select>
      </label>
      {kind === 'meiosis' && (
        <>
          <label>
            <input
              type="checkbox"
              checked={crossover}
              onChange={(e) => {
                useDivisionStore.setState({ crossover: e.target.checked });
              }}
            />
            <span>{Lz(L('Có trao đổi chéo (cặp số 1)', 'Crossing over (pair 1)'))}</span>
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              useDivisionStore.setState((s) => ({ seed: s.seed + 1 }));
            }}
          >
            <Shuffle size={14} aria-hidden="true" />{' '}
            {Lz(L('Sắp xếp ngẫu nhiên lại ở kì giữa I', 'Re-randomise metaphase I'))}
          </button>
          <p className="small muted">
            {Lz(
              L(
                `Với n = ${pairs} cặp và không trao đổi chéo, có 2ⁿ = ${2 ** pairs} loại giao tử.`,
                `With n = ${pairs} pairs and no crossing over there are 2ⁿ = ${2 ** pairs} gamete types.`,
              ),
            )}
          </p>
        </>
      )}
      <p className="small muted">
        {Lz(
          L(
            'Bảng dưới liệt kê số lượng ở mọi kì — dùng để kiểm tra bài tập (với 2n bất kì, thay n tương ứng).',
            'The table below lists the counts at every stage — use it to check exercises.',
          ),
        )}
      </p>
    </div>
  );
}

export function DivisionBottom({ kind }: { kind: Division }) {
  const Lz = useLocalized();
  const stages = useStages(kind);
  const { index } = useDivisionStore();
  return (
    <div className="chem-block">
      <table className="chem-table">
        <thead>
          <tr>
            <th scope="col">{Lz(L('Kì', 'Stage'))}</th>
            <th scope="col" className="num">
              {Lz(L('Số tế bào', 'Cells'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Số NST / tế bào', 'Chromosomes / cell'))}
            </th>
            <th scope="col">{Lz(L('Trạng thái', 'State'))}</th>
            <th scope="col" className="num">
              {Lz(L('Cromatit', 'Chromatids'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Tâm động', 'Centromeres'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Phân tử ADN', 'DNA molecules'))}
            </th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s, k) => {
            const c = countsOf(s);
            return (
              <tr
                key={s.stage}
                className={cx(k === index && 'is-active')}
                onClick={() => {
                  setDivisionState(kind, { index: k, playing: false });
                }}
              >
                <th scope="row">
                  {/* Keyboard access to the row: its click bubbles up to the row's handler. */}
                  <button
                    type="button"
                    className="bio-row-btn"
                    aria-current={k === index ? 'step' : undefined}
                  >
                    {Lz(STAGE_NAME[s.stage])}
                  </button>
                </th>
                <td className="num">{c.cells}</td>
                <td className="num">{c.chromosomes}</td>
                <td>{Lz(c.state === 'double' ? L('kép', 'double') : L('đơn', 'single'))}</td>
                <td className="num">{c.chromatids}</td>
                <td className="num">{c.centromeres}</td>
                <td className="num">{c.dnaMolecules}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small muted">
        {STAGES[kind].length} {Lz(L('giai đoạn', 'stages'))}
      </p>
    </div>
  );
}
