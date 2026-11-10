import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { MainActionSlot, ModuleEdge } from '@/app/bench/DriverGrid';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { IconButton } from '@/ui/IconButton';
import { L } from '../common';
import { addedVolume, maxVolume, setTitration, useTitrationStore } from './store';

/** The drop sizes the learner chooses from (§9.10 "0,1 mL | 1 mL"). */
const DROPS = [0.1, 1] as const;

/**
 * The titration's bench edge (docs/BENCH_DESIGN.md §9.10): D0 "Nhỏ thêm", D1 "Rút bớt", D3
 * "Đặt lại", the readout "V(NaOH) = … mL", the volume scrubber (step: burette range / 2000) and
 * the drop size "0,1 mL | 1 mL" in the speed slot.
 */
export function TitrationDriver() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const st = useTitrationStore();
  const vMax = maxVolume(st);
  const vb = addedVolume(st);
  const step = vMax / 2000;
  const [nudge, setNudge] = useState<number>(DROPS[0]);
  const digits = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  const vol = (v: number) =>
    formatNumber(locale, v, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sig = (v: number) => formatNumber(locale, v, { maximumSignificantDigits: 3 });
  const played = { '--pct': `${vMax > 0 ? (100 * vb) / vMax : 0}%` } as CSSProperties;
  return (
    <ModuleEdge label={Lz(L('Điều khiển buret', 'Burette controls'))}>
      <MainActionSlot>
        <button
          type="button"
          className="bench-play"
          disabled={vb >= vMax}
          aria-label={Lz(
            L(`Nhỏ thêm ${sig(nudge)} mL NaOH`, `Add drops: ${sig(nudge)} mL of NaOH`),
          )}
          data-tip={Lz(L(`Nhỏ thêm ${sig(nudge)} mL NaOH`, `Add drops: ${sig(nudge)} mL of NaOH`))}
          data-tip-side="top"
          onClick={() => {
            setTitration({ vb: Math.min(vMax, vb + nudge) });
          }}
        >
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          <span className="bench-play__label" aria-hidden="true">
            {Lz(L('Nhỏ thêm', 'Add drops'))}
          </span>
        </button>
      </MainActionSlot>
      <IconButton
        className="bench-edge__d1"
        icon={Minus}
        label={Lz(L(`Rút bớt ${sig(nudge)} mL NaOH`, `Draw back ${sig(nudge)} mL of NaOH`))}
        tooltipSide="top"
        disabled={vb <= 0}
        onClick={() => {
          setTitration({ vb: Math.max(0, vb - nudge) });
        }}
      />
      <IconButton
        className="bench-edge__d3"
        icon={RotateCcw}
        label={Lz(L('Đặt lại', 'Reset'))}
        tooltipSide="top"
        animation="spin"
        disabled={vb <= 0}
        onClick={() => {
          setTitration({ vb: 0 });
        }}
      />
      <span className="bench-edge__readout" aria-hidden="true">
        V = {vol(vb)} mL
      </span>
      <input
        type="range"
        className="bench-edge__scrubber"
        style={played}
        min={0}
        max={vMax}
        step={step}
        value={vb}
        aria-label={Lz(L('Thể tích NaOH đã thêm', 'NaOH added'))}
        aria-valuetext={`${vol(vb)} mL`}
        onChange={(e) => {
          setTitration({ vb: Number(e.target.value) });
        }}
      />
      <fieldset className="bench-speed">
        <legend className="sr-only">{Lz(L('Mỗi lần nhỏ', 'Each drop'))}</legend>
        {DROPS.map((d) => (
          <label key={d}>
            <input
              type="radio"
              name="titration-drop"
              checked={nudge === d}
              onChange={() => {
                setNudge(d);
              }}
            />
            <span>{`${formatNumber(locale, d)} mL`}</span>
          </label>
        ))}
      </fieldset>
    </ModuleEdge>
  );
}
