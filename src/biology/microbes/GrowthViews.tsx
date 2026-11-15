import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { XYChart } from '@/ui/charts/XYChart';
import { cx } from '@/ui/cx';
import { L, usePublishCard } from '../common';
import { Range, Segmented } from '../ui';
import { GROWTH_CARD, PHASES_CARD } from './card';
import { drawPhases } from './drawPhases';
import { formatCells, formatGenerations } from './format';
import { EXAMPLES, cellsAt, generations, growthCurve } from './growth';
import { PHASES, PHASE_TEXT, type PhaseId } from './phases';
import { LIMITS, useGrowth, type GrowthScale, type GrowthView } from './store';
import '../bio.css';
import '../sh10.css';

const VIEWS: { id: GrowthView; label: ReturnType<typeof L> }[] = [
  { id: 'formula', label: L('Công thức', 'Formula') },
  { id: 'phases', label: L('Bốn pha (minh họa)', 'Four phases (illustration)') },
];

function ViewSwitch() {
  const view = useGrowth((s) => s.view);
  return (
    <Segmented<GrowthView>
      label={L('Nội dung', 'Content')}
      value={view}
      options={VIEWS}
      onChange={(v) => {
        useGrowth.setState({ view: v });
      }}
    />
  );
}

/** "Sinh trưởng của quần thể vi khuẩn": the formula's curve, or the four-phase illustration. */
export function GrowthStage() {
  const view = useGrowth((s) => s.view);
  usePublishCard(view === 'formula' ? GROWTH_CARD : PHASES_CARD);
  return view === 'formula' ? <FormulaView /> : <PhasesView />;
}

function FormulaView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { n0, g, t, scale } = useGrowth();
  const curve = useMemo(() => growthCurve(n0, g, Math.max(t, g)), [n0, g, t]);
  const n = generations(t, g);
  const nt = cellsAt(n0, t, g);
  const log = scale === 'log2';
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        <ViewSwitch />
        <Segmented<GrowthScale>
          label={L('Trục tung', 'Vertical axis')}
          value={scale}
          options={[
            { id: 'linear', label: L('N', 'N') },
            { id: 'log2', label: L('log₂N', 'log₂N') },
          ]}
          onChange={(v) => {
            useGrowth.setState({ scale: v });
          }}
        />
        <span className="chem-chip" data-testid="mg-n">
          n = t/g = {formatNumber(locale, t)}/{formatNumber(locale, g)} ={' '}
          {formatGenerations(locale, n)}
        </span>
        <span className="chem-chip" data-testid="mg-nt">
          Nₜ = {formatNumber(locale, n0)} × 2<sup>{formatGenerations(locale, n)}</sup> ={' '}
          {formatCells(locale, nt)} {Lz(L('tế bào', 'cells'))}
        </span>
      </div>
      <div className="bio-stage-chart">
        <XYChart
          x={curve.t}
          series={[
            {
              label: log ? 'log₂N' : Lz(L('Số tế bào N', 'Number of cells N')),
              y: log ? curve.log2n : curve.n,
            },
          ]}
          marker={t}
          xLabel={Lz(L('Thời gian t', 'Time t'))}
          xUnit={Lz(L('phút', 'min'))}
          yLabel={log ? 'log₂N' : Lz(L('Số tế bào N', 'Number of cells N'))}
          yMin={0}
          csvName={Lz(L('sinh-truong-vi-khuan', 'bacterial-growth'))}
        />
      </div>
      <p className="bio-caption">
        {Lz(
          L(
            'Điều kiện lí tưởng: công thức chỉ đúng trong pha lũy thừa (xem "Bốn pha").',
            'Ideal conditions: the formula holds only in the exponential phase (see "Four phases").',
          ),
        )}
      </p>
    </div>
  );
}

function PhasesView() {
  const Lz = useLocalized();
  const phase = useGrowth((s) => s.phase);
  const names = useMemo(
    () =>
      Object.fromEntries(PHASES.map((p) => [p, Lz(PHASE_TEXT[p].name)])) as Record<PhaseId, string>,
    [Lz],
  );
  const axes = useMemo(
    () => ({
      x: Lz(L('Thời gian', 'Time')),
      y: Lz(L('Số lượng tế bào trong quần thể', 'Number of cells in the population')),
    }),
    [Lz],
  );
  const ref = useCanvas(
    (d) => {
      drawPhases(d, names, axes, phase);
    },
    false,
    [names, axes, phase],
  );
  const label = Lz(
    L(
      'Hình minh họa đường cong sinh trưởng của vi khuẩn trong nuôi cấy không liên tục',
      'Illustration of the growth curve of bacteria in a batch culture',
    ),
  );
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        <ViewSwitch />
        <span className="chem-chip chem-chip--qual">{Lz(L('Định tính', 'Qualitative'))}</span>
      </div>
      <canvas ref={ref} className="chem-canvas mg-phases__canvas" role="img" aria-label={label} />
      <div className="mg-phases">
        <div className="m3d-parts__list" role="group" aria-label={Lz(L('Các pha', 'Phases'))}>
          {PHASES.map((p) => (
            <button
              key={p}
              type="button"
              className={cx('m3d-parts__item', p === phase && 'is-active')}
              aria-pressed={p === phase}
              onClick={() => {
                useGrowth.setState({ phase: p });
              }}
            >
              {names[p]}
            </button>
          ))}
        </div>
        <p aria-live="polite">{Lz(PHASE_TEXT[phase].text)}</p>
        <p className="small muted">
          {Lz(
            L(
              'Hình minh họa theo H 21.4 SGK: độ dài các pha và độ cao đường cong không phải số liệu.',
              'Illustration after textbook figure 21.4: the phase lengths and the curve’s height are not data.',
            ),
          )}
        </p>
      </div>
    </div>
  );
}

/** Inspector: N₀, g and t, and the textbook's two generation times. */
export function GrowthPanel() {
  const Lz = useLocalized();
  const { n0, g, t } = useGrowth();
  return (
    <div className="chem-form">
      <Range
        label={L('Số tế bào ban đầu N₀', 'Initial cells N₀')}
        value={n0}
        min={LIMITS.n0[0]}
        max={LIMITS.n0[1]}
        step={LIMITS.n0[2]}
        onChange={(v) => {
          useGrowth.setState({ n0: v });
        }}
      />
      <Range
        label={L('Thời gian thế hệ g', 'Generation time g')}
        value={g}
        min={LIMITS.g[0]}
        max={LIMITS.g[1]}
        step={LIMITS.g[2]}
        unit={Lz(L('phút', 'min'))}
        onChange={(v) => {
          useGrowth.setState({ g: v });
        }}
      />
      <Range
        label={L('Thời gian nuôi t', 'Culture time t')}
        value={t}
        min={LIMITS.t[0]}
        max={LIMITS.t[1]}
        step={LIMITS.t[2]}
        unit={Lz(L('phút', 'min'))}
        onChange={(v) => {
          useGrowth.setState({ t: v });
        }}
      />
      <h4 className="m3d-parts__title">
        {Lz(L('Ví dụ trong sách giáo khoa', 'Textbook examples'))}
      </h4>
      <div className="m3d-parts__list">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            type="button"
            className={cx('m3d-parts__item', g === ex.g && 'is-active')}
            aria-pressed={g === ex.g}
            onClick={() => {
              useGrowth.setState({ g: ex.g });
            }}
          >
            {Lz(ex.name)}: {Lz(ex.printed)}
          </button>
        ))}
      </div>
      <p className="small muted">
        {Lz(
          L(
            'Nguồn: SGK Sinh học 10 KNTT, tr. 124 · chờ giáo viên duyệt',
            'Source: SGK Sinh học 10 KNTT, p. 124 · awaiting teacher review',
          ),
        )}
      </p>
    </div>
  );
}
