import {
  ArrowLeft,
  ArrowRight,
  Equal,
  Flame,
  Minimize2,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Snowflake,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { XYChart } from '@/ui/charts/XYChart';
import { IconButton } from '@/ui/IconButton';
import { CSRC, L, usePublishCard } from '../common';
import { SYSTEMS, equationOf, shiftDirection, speciesOf } from './equilibrium';
import { currentQK, disturb, resetEq, stepEq, systemOf, useEqStore } from './eqStore';
import '../chem.css';

const CARD: ScienceCardData = {
  title: L('Cân bằng hóa học & nguyên lí Le Chatelier', 'Chemical equilibrium & Le Chatelier'),
  model: L(
    'Phản ứng thuận nghịch sơ cấp, tốc độ theo định luật tác dụng khối lượng; nồng độ tính bằng tích phân phương trình vi phân. Hằng số tốc độ phụ thuộc nhiệt độ theo Arrhenius.',
    'Elementary reversible reaction with mass-action rates; concentrations from integrating the rate equations. Rate constants follow Arrhenius.',
  ),
  equations: [
    { tex: 'v_t = k_t \\prod [R]^{\\nu},\\quad v_n = k_n \\prod [P]^{\\nu}' },
    {
      tex: 'K_C = \\dfrac{k_t}{k_n} = \\dfrac{\\prod [P]^{\\nu}}{\\prod [R]^{\\nu}}\\ \\text{(khi cân bằng)}',
    },
    {
      tex: '\\ln\\dfrac{K_2}{K_1} = -\\dfrac{\\Delta H}{R}\\left(\\dfrac{1}{T_2}-\\dfrac{1}{T_1}\\right),\\ \\Delta H = E_{a,t}-E_{a,n}',
    },
  ],
  assumptions: [
    L(
      'Chất A, B, C, D là minh họa; các hằng số tốc độ do người dùng chọn, không phải số liệu của chất thật.',
      'A, B, C, D are illustrative; rate constants are chosen by the user, not data for real substances.',
    ),
    L(
      'Nén/giãn: coi mọi chất là khí lí tưởng (hoặc chất tan), mọi nồng độ tăng/giảm cùng tỉ lệ.',
      'Compress/expand: all species treated as ideal gases (or solutes); every concentration scales equally.',
    ),
    L(
      'Nhiệt độ thay đổi tức thời; bỏ qua nhiệt của phản ứng làm đổi T.',
      'Temperature changes instantly; reaction heat does not change T.',
    ),
  ],
  confidence: 'exact',
  confidenceNote: L(
    'Test tự động: khớp nghiệm giải tích A ⇌ B, nghiệm bậc hai của A + B ⇌ C, Q = K khi cân bằng, định luật van ’t Hoff.',
    'Automated tests: analytic A ⇌ B, quadratic A + B ⇌ C, Q = K at equilibrium, van ’t Hoff law.',
  ),
  userIntervened: false,
  method: L('Dormand–Prince 5(4), rtol 10⁻⁹', 'Dormand–Prince 5(4), rtol 10⁻⁹'),
  sources: [CSRC.sgk11, CSRC.atkins],
};

const DIRECTION: Record<'forward' | 'backward' | 'none', LocalizedText> = {
  forward: L(
    'Q < K → phản ứng dịch chuyển theo chiều THUẬN',
    'Q < K → the reaction shifts FORWARD',
  ),
  backward: L(
    'Q > K → phản ứng dịch chuyển theo chiều NGHỊCH',
    'Q > K → the reaction shifts BACKWARD',
  ),
  none: L('Q = K → hệ đang cân bằng', 'Q = K → the system is at equilibrium'),
};

export function EquilibriumStage() {
  usePublishCard(CARD);
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const st = useEqStore();
  const s = systemOf(st.systemId);
  const species = speciesOf(s);

  useEffect(() => {
    if (!st.running) return;
    let raf = 0;
    let prev = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      acc += Math.min(0.1, (now - prev) / 1000);
      prev = now;
      // 1 simulated second per 0.5 real second, updated at ~15 Hz.
      if (acc > 1 / 15 && document.visibilityState === 'visible') {
        stepEq(acc * 2);
        acc = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [st.running]);

  const { Q, K } = currentQK();
  const dir = shiftDirection(Q, K, 2e-3);
  const f = (v: number, d = 3) =>
    Number.isFinite(v) ? formatNumber(locale, v, { maximumSignificantDigits: d }) : '∞';
  const maxC = Math.max(1, ...species.map((sp) => st.c[sp] ?? 0));
  const DirIcon = dir === 'forward' ? ArrowRight : dir === 'backward' ? ArrowLeft : Equal;

  return (
    <div className="chem-view">
      <div className="chem-toolbar">
        <span className="rx-eq rx-eq--chip">{equationOf(s)}</span>
        <IconButton
          icon={st.running ? Pause : Play}
          label={st.running ? Lz(L('Tạm dừng', 'Pause')) : Lz(L('Chạy', 'Run'))}
          variant="solid"
          onClick={() => {
            useEqStore.setState((x) => ({ running: !x.running }));
          }}
        />
        <IconButton
          icon={RotateCcw}
          label={Lz(L('Làm lại', 'Restart'))}
          onClick={() => {
            resetEq();
          }}
        />
        <span className="chem-chip">
          t = {f(st.t, 4)} s · T = {f(st.T, 4)} K
        </span>
      </div>

      <div className="eq-bars" role="img" aria-label={Lz(L('Nồng độ các chất', 'Concentrations'))}>
        {species.map((sp, i) => (
          <div key={sp} className="eq-bar">
            <div className="eq-bar__track">
              <div
                className="eq-bar__fill"
                style={{
                  height: `${((st.c[sp] ?? 0) / maxC) * 100}%`,
                  background: `var(--chart-${String(i + 1)})`,
                }}
              />
            </div>
            <span className="eq-bar__label">[{sp}]</span>
            <span className="mono small">{f(st.c[sp] ?? 0, 4)} M</span>
          </div>
        ))}
        <div className="eq-qk">
          <p>
            Q = <strong className="mono">{f(Q, 4)}</strong>
          </p>
          <p>
            K = <strong className="mono">{f(K, 4)}</strong>
          </p>
          <p className={`eq-dir eq-dir--${dir}`}>
            <DirIcon size={16} strokeWidth={2} aria-hidden="true" /> {Lz(DIRECTION[dir])}
          </p>
        </div>
      </div>

      <p className="econf__label">{Lz(L('Tác động lên hệ cân bằng', 'Disturb the equilibrium'))}</p>
      <div className="eq-actions">
        {species.map((sp) => (
          <span key={sp} className="eq-actions__group">
            <button
              type="button"
              className="btn"
              onClick={() => {
                disturb('add', sp);
              }}
            >
              <Plus size={14} aria-hidden="true" /> {sp}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                disturb('remove', sp);
              }}
            >
              <Minus size={14} aria-hidden="true" /> ½ {sp}
            </button>
          </span>
        ))}
        <button
          type="button"
          className="btn"
          onClick={() => {
            disturb('heat');
          }}
        >
          <Flame size={14} aria-hidden="true" /> {Lz(L('Tăng T 25 K', 'Heat +25 K'))}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            disturb('cool');
          }}
        >
          <Snowflake size={14} aria-hidden="true" /> {Lz(L('Giảm T 25 K', 'Cool −25 K'))}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            disturb('compress');
          }}
        >
          <Minimize2 size={14} aria-hidden="true" /> {Lz(L('Nén (P×2)', 'Compress (P×2)'))}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            disturb('expand');
          }}
        >
          <Maximize2 size={14} aria-hidden="true" /> {Lz(L('Giãn (P÷2)', 'Expand (P÷2)'))}
        </button>
      </div>
      <p className="small muted">
        {Lz(
          L(
            `ΔH = Eₐ,t − Eₐ,n = ${f((st.kinetics.eaf - st.kinetics.ear) / 1000, 3)} kJ/mol: ${st.kinetics.eaf < st.kinetics.ear ? 'phản ứng thuận tỏa nhiệt → tăng nhiệt độ làm K giảm' : st.kinetics.eaf > st.kinetics.ear ? 'phản ứng thuận thu nhiệt → tăng nhiệt độ làm K tăng' : 'ΔH = 0 → K không đổi theo nhiệt độ'}.`,
            `ΔH = Eₐ,f − Eₐ,r = ${f((st.kinetics.eaf - st.kinetics.ear) / 1000, 3)} kJ/mol: ${st.kinetics.eaf < st.kinetics.ear ? 'exothermic forward → heating lowers K' : st.kinetics.eaf > st.kinetics.ear ? 'endothermic forward → heating raises K' : 'ΔH = 0 → K does not depend on T'}.`,
          ),
        )}
      </p>
    </div>
  );
}

export function EquilibriumPanel() {
  const Lz = useLocalized();
  const st = useEqStore();
  const s = systemOf(st.systemId);
  const num = (label: LocalizedText, value: number, onChange: (v: number) => void, step = 0.1) => (
    <label>
      <span>{Lz(label)}</span>
      <input
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= 0) onChange(v);
        }}
      />
    </label>
  );
  return (
    <div className="chem-form">
      <label>
        <span>{Lz(L('Phản ứng', 'Reaction'))}</span>
        <select
          value={st.systemId}
          onChange={(e) => {
            resetEq({ systemId: e.target.value });
          }}
        >
          {SYSTEMS.map((x) => (
            <option key={x.id} value={x.id}>
              {equationOf(x)}
            </option>
          ))}
        </select>
      </label>
      {num(L('k thuận (298 K)', 'k forward (298 K)'), st.kinetics.kf0, (v) => {
        resetEq({ kinetics: { ...st.kinetics, kf0: v } });
      })}
      {num(L('k nghịch (298 K)', 'k reverse (298 K)'), st.kinetics.kr0, (v) => {
        resetEq({ kinetics: { ...st.kinetics, kr0: Math.max(1e-6, v) } });
      })}
      {num(
        L('Eₐ thuận (kJ/mol)', 'Eₐ forward (kJ/mol)'),
        st.kinetics.eaf / 1000,
        (v) => {
          resetEq({ kinetics: { ...st.kinetics, eaf: v * 1000 } });
        },
        5,
      )}
      {num(
        L('Eₐ nghịch (kJ/mol)', 'Eₐ reverse (kJ/mol)'),
        st.kinetics.ear / 1000,
        (v) => {
          resetEq({ kinetics: { ...st.kinetics, ear: v * 1000 } });
        },
        5,
      )}
      {speciesOf(s).map((sp) => (
        <span key={sp}>
          {num(L(`[${sp}] ban đầu (M)`, `Initial [${sp}] (M)`), st.initial[sp] ?? 0, (v) => {
            resetEq({ initial: { ...st.initial, [sp]: v } });
          })}
        </span>
      ))}
      <p className="small muted">
        {Lz(
          L(
            'Đổi thông số sẽ chạy lại từ đầu. Đơn vị của k tùy bậc phản ứng (M⁻ⁿ·s⁻¹).',
            'Changing a parameter restarts the run. Units of k depend on the order (M⁻ⁿ·s⁻¹).',
          ),
        )}
      </p>
    </div>
  );
}

export function EquilibriumBottom() {
  const Lz = useLocalized();
  const { version, systemId, history, events } = useEqStore();
  const s = systemOf(systemId);
  const species = speciesOf(s);
  const data = useMemo(
    () => ({
      x: [...history.t],
      series: species.map((sp) => ({ label: `[${sp}]`, y: [...(history.c[sp] ?? [])] })),
    }),
    // history is mutated in place; version signals changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, systemId],
  );
  const lastEvent = events.at(-1);
  return (
    <div className="gas-bottom gas-bottom--single">
      <XYChart
        x={data.x}
        series={data.series}
        xLabel={Lz(L('Thời gian t (s)', 'Time t (s)'))}
        yLabel={Lz(L('Nồng độ (M)', 'Concentration (M)'))}
        marker={lastEvent?.t ?? null}
        version={version}
      />
    </div>
  );
}
