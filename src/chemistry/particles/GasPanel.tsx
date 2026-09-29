import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useTierConfig } from '@/perf/perfStore';
import { L } from '../common';
import { formatFormula } from '../formula';
import { eaReduced, GASES, resetGas, useGasStore, type GasId } from './gasStore';

/** Controls for the particle modules; every change restarts the run (clear cause → effect). */
export function GasPanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const tier = useTierConfig();
  const st = useGasStore();
  const maxN = Math.min(800, Math.max(200, Math.floor(tier.maxParticles / 5)));
  const set = (patch: Partial<typeof st>) => {
    useGasStore.setState(patch);
    resetGas();
  };
  const f = (v: number, d = 3) => formatNumber(locale, v, { maximumSignificantDigits: d });
  return (
    <div className="chem-form">
      {st.mode === 'maxwell' && (
        <label>
          <span>{Lz(L('Chất khí', 'Gas'))}</span>
          <select
            value={st.gas}
            onChange={(e) => {
              set({ gas: e.target.value as GasId });
            }}
          >
            {GASES.map((g) => (
              <option key={g} value={g}>
                {formatFormula(g)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span>
          {Lz(L('Nhiệt độ T', 'Temperature T'))} ({f(st.T, 4)} K)
        </span>
        <input
          type="range"
          min={100}
          max={1500}
          step={10}
          value={st.T}
          onChange={(e) => {
            set({ T: Number(e.target.value) });
          }}
        />
      </label>
      <label>
        <span>
          {Lz(L('Số hạt', 'Particles'))} ({st.n})
        </span>
        <input
          type="range"
          min={50}
          max={maxN}
          step={10}
          value={Math.min(st.n, maxN)}
          onChange={(e) => {
            set({ n: Number(e.target.value) });
          }}
        />
      </label>
      {st.mode === 'maxwell' && (
        <div
          className="segmented"
          role="radiogroup"
          aria-label={Lz(L('Trạng thái đầu', 'Initial state'))}
        >
          {(
            [
              ['equal', L('Tốc độ bằng nhau', 'Equal speeds')],
              ['maxwell', L('Đã cân bằng', 'Equilibrated')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={st.start === id}
              className="segmented__item"
              onClick={() => {
                set({ start: id });
              }}
            >
              {Lz(label)}
            </button>
          ))}
        </div>
      )}
      {st.mode === 'collision' && (
        <>
          <label>
            <span>
              {Lz(L('Năng lượng hoạt hóa Eₐ', 'Activation energy Eₐ'))} ({f(st.eaKJ)} kJ/mol)
            </span>
            <input
              type="range"
              min={0}
              max={30}
              step={0.5}
              value={st.eaKJ}
              onChange={(e) => {
                set({ eaKJ: Number(e.target.value) });
              }}
            />
          </label>
          <p className="small muted">
            Eₐ/RT = {f(eaReduced(st.eaKJ, st.T))} ·{' '}
            {Lz(L('tỉ lệ va chạm hiệu quả lý thuyết', 'theoretical energetic fraction'))} e^(−Eₐ/RT)
            = {f(Math.exp(-eaReduced(st.eaKJ, st.T)))}
          </p>
          <label>
            <input
              type="checkbox"
              checked={st.reversible}
              onChange={(e) => {
                set({ reversible: e.target.checked });
              }}
            />
            <span>
              {Lz(L('Phản ứng thuận nghịch (C + D → A + B)', 'Reversible (C + D → A + B)'))}
            </span>
          </label>
        </>
      )}
    </div>
  );
}
