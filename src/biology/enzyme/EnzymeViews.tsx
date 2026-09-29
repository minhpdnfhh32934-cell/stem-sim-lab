import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import type { ScienceCardData } from '@/science-card/types';
import { XYChart } from '@/ui/charts/XYChart';
import { BSRC, L, usePublishCard } from '../common';
import { useFmt } from '../fmt';
import { Range, Segmented } from '../ui';
import { apparent, rate, substrateAt, substrateNumeric, type Inhibition } from './enzyme';
import { useEnzyme, type EnzymeState } from './store';
import '../bio.css';

const KIND_NAME: Record<Inhibition, ReturnType<typeof L>> = {
  none: L('Không có chất ức chế', 'No inhibitor'),
  competitive: L('Ức chế cạnh tranh', 'Competitive'),
  noncompetitive: L('Ức chế không cạnh tranh', 'Non-competitive'),
  uncompetitive: L('Ức chế phi cạnh tranh (uncompetitive)', 'Uncompetitive'),
};

const ENZYME_CARD: ScienceCardData = {
  title: L('Động học enzyme Michaelis–Menten', 'Michaelis–Menten enzyme kinetics'),
  model: L(
    'Tốc độ phản ứng ban đầu theo phương trình Michaelis–Menten, ảnh hưởng của chất ức chế theo các dạng chuẩn. Tiến trình [S](t) dùng nghiệm chính xác qua hàm Lambert W và được đối chiếu với tích phân số DOPRI5.',
    'Initial rate from the Michaelis–Menten equation, with the standard inhibition forms. The time course [S](t) uses the exact Lambert W solution, cross-checked with DOPRI5.',
  ),
  equations: [
    { tex: 'v = \\dfrac{V_{\\max}[S]}{K_m + [S]}' },
    { tex: '\\dfrac{1}{v} = \\dfrac{K_m}{V_{\\max}}\\cdot\\dfrac{1}{[S]} + \\dfrac{1}{V_{\\max}}' },
    {
      tex: '\\alpha = 1 + \\dfrac{[I]}{K_i}',
      label: L('Hệ số ức chế', 'Inhibition factor'),
    },
    {
      tex: 'K_m^{app} = \\alpha K_m,\\quad V_{\\max}^{app} = V_{\\max}',
      label: L('Ức chế cạnh tranh', 'Competitive inhibition'),
    },
    {
      tex: 'K_m^{app} = K_m,\\quad V_{\\max}^{app} = V_{\\max}/\\alpha',
      label: L('Ức chế không cạnh tranh', 'Non-competitive inhibition'),
    },
    {
      tex: 'K_m^{app} = K_m/\\alpha,\\quad V_{\\max}^{app} = V_{\\max}/\\alpha',
      label: L('Ức chế phi cạnh tranh', 'Uncompetitive inhibition'),
    },
    { tex: '[S](t) = K_m\\,W\\!\\left(\\dfrac{[S]_0}{K_m}\\,e^{([S]_0 - V_{\\max}t)/K_m}\\right)' },
  ],
  assumptions: [
    L(
      'Trạng thái giả dừng: [E] ≪ [S]; phản ứng một chiều S → P; nhiệt độ và pH không đổi.',
      'Quasi-steady state: [E] ≪ [S]; irreversible S → P; constant temperature and pH.',
    ),
    L(
      'Chất ức chế thuận nghịch, dạng tuyến tính đơn giản (một hằng số Kᵢ).',
      'Reversible inhibitor, simple linear forms (one constant Kᵢ).',
    ),
  ],
  confidence: 'exact',
  confidenceNote: L(
    'Công thức chính xác. Test tự động: v = Vmax/2 tại [S] = Km; Km, Vmax biểu kiến; Lambert W khớp DOPRI5.',
    'Exact formulas. Automated tests: v = Vmax/2 at [S] = Km; apparent Km, Vmax; Lambert W matches DOPRI5.',
  ),
  userIntervened: false,
  sources: [BSRC.cornish, BSRC.schnell, BSRC.sgk10],
};

const paramsOf = (st: EnzymeState) => ({
  vmax: st.vmax,
  km: st.km,
  inhibitor: st.inhibitor,
  ki: st.ki,
  kind: st.kind,
});
const noInhibitor = (st: EnzymeState) => ({ ...paramsOf(st), kind: 'none' as const });

export function MichaelisMentenStage() {
  usePublishCard(ENZYME_CARD);
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useEnzyme();
  const app = apparent(paramsOf(st));
  const inhibited = st.kind !== 'none';

  const rateData = useMemo(() => {
    const top = Math.max(10 * st.km, 20);
    const x = Array.from({ length: 301 }, (_, i) => (i * top) / 300);
    return {
      x,
      base: x.map((s) => rate(noInhibitor(st), s)),
      inh: x.map((s) => rate(paramsOf(st), s)),
    };
  }, [st]);

  const timeData = useMemo(() => {
    const p = paramsOf(st);
    const a = apparent(p);
    // Long enough to consume most of the substrate: S0/Vmax (zero order) + a few Km/Vmax.
    const tEnd = (st.s0 + 5 * a.km) / a.vmax;
    const x = Array.from({ length: 201 }, (_, i) => (i * tEnd) / 200);
    const s = x.map((t) => substrateAt(p, st.s0, t));
    return { x, s, p: s.map((v) => st.s0 - v), tEnd };
  }, [st]);

  // Cross-check of the closed form against DOPRI5 at the half-way point.
  const check = useMemo(() => {
    const p = paramsOf(st);
    const t = timeData.tEnd / 2;
    const exact = substrateAt(p, st.s0, t);
    const num = substrateNumeric(p, st.s0, t);
    return Math.abs(exact - num) / Math.max(1e-12, Math.abs(exact));
  }, [st, timeData.tEnd]);

  return (
    <div className="bio-view">
      <div className="chem-overlay">
        <Segmented
          label={L('Đồ thị', 'Plot')}
          value={st.view}
          options={[
            { id: 'rate', label: L('v theo [S]', 'v vs [S]') },
            { id: 'time', label: L('[S] theo thời gian', '[S] over time') },
          ]}
          onChange={(view) => {
            useEnzyme.setState({ view });
          }}
        />
        <span className="chem-chip">
          <span>
            V<sub>max</sub>
            {inhibited ? Lz(L(' (biểu kiến)', ' (apparent)')) : ''} = {fmt(app.vmax)} mM/
            {Lz(L('phút', 'min'))}
          </span>
        </span>
        <span className="chem-chip">
          <span>
            K<sub>m</sub>
            {inhibited ? Lz(L(' (biểu kiến)', ' (apparent)')) : ''} = {fmt(app.km)} mM
          </span>
        </span>
        {st.view === 'time' && (
          <span className="chem-chip" title={Lz(L('Kiểm tra chéo', 'Cross-check'))}>
            {Lz(L('Lambert W so với DOPRI5: sai lệch ', 'Lambert W vs DOPRI5: difference '))}
            {fmt(check, 2)}
          </span>
        )}
      </div>
      <div className="bio-stage-chart">
        {st.view === 'rate' ? (
          <XYChart
            x={rateData.x}
            series={[
              ...(inhibited
                ? [
                    { label: Lz(L('Không ức chế', 'No inhibitor')), y: rateData.base, dash: true },
                    { label: Lz(KIND_NAME[st.kind]), y: rateData.inh, color: 3 },
                  ]
                : [
                    {
                      label: Lz(L('v = Vmax[S]/(Km + [S])', 'v = Vmax[S]/(Km + [S])')),
                      y: rateData.base,
                    },
                  ]),
              {
                label: 'Vmax',
                y: rateData.x.map(() => st.vmax),
                dash: true,
                color: 2,
              },
            ]}
            marker={app.km}
            xLabel="[S]"
            xUnit="mM"
            yLabel={Lz(L('Tốc độ v', 'Rate v'))}
            yUnit={`mM/${Lz(L('phút', 'min'))}`}
            yMin={0}
            yMax={st.vmax * 1.15}
          />
        ) : (
          <XYChart
            x={timeData.x}
            series={[
              { label: Lz(L('Cơ chất [S]', 'Substrate [S]')), y: timeData.s },
              { label: Lz(L('Sản phẩm [P]', 'Product [P]')), y: timeData.p, color: 3 },
            ]}
            xLabel={Lz(L('Thời gian', 'Time'))}
            xUnit={Lz(L('phút', 'min'))}
            yLabel={Lz(L('Nồng độ', 'Concentration'))}
            yUnit="mM"
            yMin={0}
          />
        )}
      </div>
      <p className="bio-caption">
        {Lz(
          st.view === 'rate'
            ? L(
                'Đường thẳng đứng đánh dấu Km (biểu kiến): tại đó v = Vmax/2.',
                'The vertical line marks (apparent) Km, where v = Vmax/2.',
              )
            : L(
                'Lúc đầu [S] lớn nên v ≈ Vmax (giảm gần tuyến tính); khi [S] < Km tốc độ giảm dần.',
                'At first [S] is large so v ≈ Vmax (almost linear); once [S] < Km the rate slows down.',
              ),
        )}
      </p>
    </div>
  );
}

export function MichaelisMentenPanel() {
  const Lz = useLocalized();
  const st = useEnzyme();
  const set = (patch: Partial<EnzymeState>) => {
    useEnzyme.setState(patch);
  };
  return (
    <div className="chem-form">
      <Range
        label={L('Vmax', 'Vmax')}
        unit={`mM/${Lz(L('phút', 'min'))}`}
        value={st.vmax}
        min={1}
        max={50}
        step={1}
        onChange={(vmax) => {
          set({ vmax });
        }}
      />
      <Range
        label={L('Km', 'Km')}
        unit="mM"
        value={st.km}
        min={0.1}
        max={20}
        step={0.1}
        onChange={(km) => {
          set({ km });
        }}
      />
      <label>
        <span>{Lz(L('Chất ức chế', 'Inhibitor'))}</span>
        <select
          value={st.kind}
          onChange={(e) => {
            set({ kind: e.target.value as Inhibition });
          }}
        >
          {(Object.keys(KIND_NAME) as Inhibition[]).map((k) => (
            <option key={k} value={k}>
              {Lz(KIND_NAME[k])}
            </option>
          ))}
        </select>
      </label>
      {st.kind !== 'none' && (
        <>
          <Range
            label={L('Nồng độ chất ức chế [I]', 'Inhibitor [I]')}
            unit="mM"
            value={st.inhibitor}
            min={0}
            max={20}
            step={0.1}
            onChange={(inhibitor) => {
              set({ inhibitor });
            }}
          />
          <Range
            label={L('Hằng số ức chế Kᵢ', 'Inhibition constant Kᵢ')}
            unit="mM"
            value={st.ki}
            min={0.1}
            max={20}
            step={0.1}
            onChange={(ki) => {
              set({ ki });
            }}
          />
        </>
      )}
      <Range
        label={L('[S]₀ cho đồ thị thời gian', '[S]₀ for the time course')}
        unit="mM"
        value={st.s0}
        min={0.5}
        max={100}
        step={0.5}
        onChange={(s0) => {
          set({ s0 });
        }}
      />
      <p className="small muted">
        {Lz(
          L(
            'Ức chế cạnh tranh: Km tăng, Vmax không đổi. Không cạnh tranh: Vmax giảm, Km không đổi. Phi cạnh tranh: cả hai giảm cùng tỉ lệ.',
            'Competitive: Km rises, Vmax unchanged. Non-competitive: Vmax falls, Km unchanged. Uncompetitive: both fall by the same factor.',
          ),
        )}
      </p>
    </div>
  );
}

/** Lineweaver–Burk (double-reciprocal) plot. */
export function MichaelisMentenBottom() {
  const Lz = useLocalized();
  const st = useEnzyme();
  const data = useMemo(() => {
    const a0 = apparent(noInhibitor(st));
    const a1 = apparent(paramsOf(st));
    // x from −1/Km (the x-intercept of the uninhibited line) to 1/(0.2 Km).
    const lo = -1.2 / Math.min(a0.km, a1.km);
    const hi = 2 / st.km;
    const x = Array.from({ length: 121 }, (_, i) => lo + ((hi - lo) * i) / 120);
    // Each line stops at its x-intercept −1/Km (1/v would turn negative, which is meaningless).
    const line = (a: { vmax: number; km: number }) =>
      x.map((u) => (u < -1 / a.km ? null : (a.km / a.vmax) * u + 1 / a.vmax));
    return { x, base: line(a0), inh: line(a1) };
  }, [st]);
  const inhibited = st.kind !== 'none';
  return (
    <div className="gas-bottom gas-bottom--single">
      <XYChart
        x={data.x}
        series={[
          { label: Lz(L('Không ức chế', 'No inhibitor')), y: data.base, dash: inhibited },
          ...(inhibited ? [{ label: Lz(KIND_NAME[st.kind]), y: data.inh, color: 3 }] : []),
        ]}
        marker={0}
        xLabel="1/[S]"
        xUnit="mM⁻¹"
        yLabel="1/v"
        yMin={0}
        yUnit={`${Lz(L('phút', 'min'))}/mM`}
      />
    </div>
  );
}
