import { Square, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { openTopic } from '@/app/topics';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { SumPlayer } from './audio';
import { fourierCard, L, TITLE } from './card';
import { coefficient, harmonics, ideal, overshoot, partialSum, WAVES, type Wave } from './model';
import { F1_RANGE, N_MAX, setFourier, useFourierStore } from './store';
import './fourier.css';

const WAVE_NAME: Record<Wave, ReturnType<typeof L>> = {
  square: L('Sóng vuông', 'Square wave'),
  sawtooth: L('Sóng răng cưa', 'Sawtooth wave'),
};

export function FourierStage() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { wave, N, f1, showHarmonics } = useFourierStore();
  const card = useMemo(() => fourierCard(), []);
  usePublishCard(card);
  const over = useMemo(() => overshoot(wave, N), [wave, N]);
  const coeffs = useMemo(
    () => Array.from({ length: N }, (_, i) => coefficient(wave, i + 1)),
    [wave, N],
  );

  // "Nghe": one player per visit; it stops when the lesson closes or the tab is hidden.
  const player = useRef<SumPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [noAudio, setNoAudio] = useState(false);
  useEffect(() => {
    const p = new SumPlayer();
    player.current = p;
    const hidden = () => {
      if (!document.hidden) return;
      p.stop();
      setPlaying(false);
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      p.dispose();
      player.current = null;
    };
  }, []);
  // While playing, the sound follows the drawn sum.
  useEffect(() => {
    if (playing) player.current?.play(f1, coeffs);
  }, [playing, f1, coeffs]);
  const toggle = () => {
    const p = player.current;
    if (!p) return;
    if (p.playing) {
      p.stop();
      setPlaying(false);
    } else if (p.play(f1, coeffs)) setPlaying(true);
    else setNoAudio(true);
  };

  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const pad = { l: 44, r: 16, t: 56, b: 56 };
      const w = width - pad.l - pad.r;
      const h = height - pad.t - pad.b;
      const X = (u: number) => pad.l + (u / 2) * w;
      const Y = (y: number) => pad.t + h / 2 - (y / 1.45) * (h / 2);
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = css('--border');
      ctx.beginPath();
      ctx.moveTo(pad.l, Y(0));
      ctx.lineTo(pad.l + w, Y(0));
      ctx.moveTo(pad.l, pad.t);
      ctx.lineTo(pad.l, pad.t + h);
      ctx.stroke();
      ctx.fillStyle = css('--text-muted');
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const u of [0, 0.5, 1, 1.5, 2])
        ctx.fillText(u === 0 ? '0' : `${formatNumber(locale, u)}T`, X(u), pad.t + h + 18);
      ctx.textAlign = 'right';
      for (const y of [-1, 1]) ctx.fillText(String(y), pad.l - 6, Y(y) + 4);
      const curve = (f: (u: number) => number, colour: string, lw: number, dash: number[] = []) => {
        const n = Math.max(400, Math.round(w * 2));
        ctx.strokeStyle = colour;
        ctx.lineWidth = lw;
        ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const u = (2 * i) / n;
          if (i === 0) ctx.moveTo(X(u), Y(f(u)));
          else ctx.lineTo(X(u), Y(f(u)));
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };
      if (showHarmonics)
        for (const hm of harmonics(wave, N))
          curve((u) => hm.b * Math.sin(2 * Math.PI * hm.n * u), css('--text-faint'), 1);
      curve((u) => ideal(wave, u), css('--text-muted'), 1.5, [6, 5]);
      curve((u) => partialSum(wave, N, u), css('--chart-1'), 2.25);
    },
    false,
    [wave, N, showHarmonics, locale],
  );

  const pct = formatNumber(locale, over * 100, { maximumFractionDigits: 1 });
  return (
    <div className="chem-view fourier">
      <canvas
        ref={ref}
        className="chem-canvas"
        role="img"
        aria-label={`${Lz(WAVE_NAME[wave])}: ${Lz(L(`tổng ${String(N)} hoạ âm`, `sum of ${String(N)} harmonics`))}`}
      />
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(TITLE)}</strong>
        </span>
        <button type="button" className="btn" aria-pressed={playing} onClick={toggle}>
          {playing ? (
            <Square size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Volume2 size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
          {playing ? Lz(L('Dừng nghe', 'Stop')) : Lz(L('Nghe', 'Listen'))}
        </button>
        <span className="chem-chip mono">f₁ = {formatNumber(locale, f1)} Hz</span>
        <span className="chem-chip">
          {Lz(
            L(
              `Đỉnh của tổng vượt sóng ${pct} % gần chỗ nhảy`,
              `The sum overshoots the wave by ${pct} % near the jump`,
            ),
          )}
        </span>
        {noAudio && (
          <span className="chem-chip chem-chip--approx" role="status">
            {Lz(L('Máy này chưa phát được âm thanh.', 'This computer cannot play sound.'))}
          </span>
        )}
      </div>
      <p className="fourier__legend small muted">
        <span className="fourier__swatch fourier__swatch--sum" aria-hidden="true" />
        {Lz(L(`Tổng S_${String(N)}`, `Sum S_${String(N)}`))}
        <span className="fourier__swatch fourier__swatch--ideal" aria-hidden="true" />
        {Lz(WAVE_NAME[wave])}
      </p>
    </div>
  );
}

export function FourierPanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { wave, N, f1, showHarmonics } = useFourierStore();
  return (
    <div className="chem-form fourier-panel">
      <div className="segmented" role="radiogroup" aria-label={Lz(L('Dạng sóng', 'Waveform'))}>
        {WAVES.map((w) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={wave === w}
            className="segmented__item"
            onClick={() => {
              setFourier({ wave: w });
            }}
          >
            {Lz(WAVE_NAME[w])}
          </button>
        ))}
      </div>
      <label>
        <span>
          {Lz(L('Số hoạ âm N', 'Harmonics N'))}: <strong className="mono">{N}</strong>
        </span>
        <input
          type="range"
          min={1}
          max={N_MAX}
          step={1}
          value={N}
          onChange={(e) => {
            setFourier({ N: Number(e.target.value) });
          }}
        />
      </label>
      <label>
        <span>
          {Lz(L('Tần số cơ bản f₁', 'Fundamental f₁'))}:{' '}
          <strong className="mono">{formatNumber(locale, f1)} Hz</strong>
        </span>
        <input
          type="range"
          min={F1_RANGE.min}
          max={F1_RANGE.max}
          step={1}
          value={f1}
          onChange={(e) => {
            setFourier({ f1: Number(e.target.value) });
          }}
        />
      </label>
      <label className="fourier-panel__check">
        <input
          type="checkbox"
          checked={showHarmonics}
          onChange={(e) => {
            setFourier({ showHarmonics: e.target.checked });
          }}
        />
        <span>{Lz(L('Hiện từng hoạ âm', 'Show each harmonic'))}</span>
      </label>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => {
          void openTopic('standingWave');
        }}
      >
        {Lz(
          L(
            'Hoạ âm của dây đàn: mở bài Sóng dừng trên dây',
            'Harmonics of a string: open Standing waves',
          ),
        )}
      </button>
    </div>
  );
}

export function FourierBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { wave, N, f1 } = useFourierStore();
  const rows = harmonics(wave, N);
  const first = Math.abs(rows[0]?.b ?? 1);
  return (
    <table className="fourier-table">
      <caption className="sr-only">{Lz(L('Các hoạ âm của tổng', 'Harmonics of the sum'))}</caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Bậc n', 'Order n'))}</th>
          <th scope="col">{Lz(L('Tần số nf₁', 'Frequency nf₁'))}</th>
          <th scope="col">{Lz(L('Hệ số bₙ', 'Coefficient bₙ'))}</th>
          <th scope="col">{Lz(L('So với bậc 1', 'Relative to n = 1'))}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.n}>
            <td className="mono">{r.n}</td>
            <td className="mono">{formatNumber(locale, r.n * f1)} Hz</td>
            <td className="mono">{formatNumber(locale, r.b, { maximumSignificantDigits: 4 })}</td>
            <td className="mono">
              {formatNumber(locale, Math.abs(r.b) / first, { maximumSignificantDigits: 3 })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
