/**
 * Logistic growth in 3D: the population fills its habitat as N(t) (exact solution) grows; the
 * column beside it rises to N(t) under the marks K and K/2. Plays the lesson's time span.
 */
import { useLocalized } from '@/app/i18n/localized';
import { useTierConfig } from '@/perf/perfStore';
import { L } from '../common';
import { useFmt } from '../fmt';
import { Bio3DView, type SceneSpec } from '../view3d/Bio3DView';
import { usePlayback } from '../view3d/playback';
import { Player } from '../view3d/player';
import { ILLUSTRATION, perFigure } from '../view3d/texts';
import { LogisticChips } from './chips';
import { figuresFor, logisticMoment, logisticPeak } from './eco3d';
import { buildLogisticScene } from './scenes3d';
import { useLogistic } from './store';

export function Logistic3D() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useLogistic();
  const tier = useTierConfig();
  const { per, capacity } = figuresFor(logisticPeak(st), tier.maxParticles);
  const playback = usePlayback(st.tEnd, { start: 0, autoplay: true });
  const now = logisticMoment(st, playback.t, per);
  const texts = {
    k: `K = ${fmt(st.K, 4)}`,
    half: 'K/2',
    title: Lz(L('Số cá thể N(t)', 'Population N(t)')),
  };
  const readout = `t = ${fmt(playback.t, 3)} · N = ${fmt(now.value, 4)}`;
  const scene: SceneSpec = {
    build: (kit) => buildLogisticScene(kit, { st: { ...st }, per, capacity, texts }),
    buildKey: JSON.stringify([st.N0, st.r, st.K, st.tEnd, per, capacity, texts]),
    label: Lz(
      L(
        `Quần thể tăng trưởng logistic: ${readout}, sức chứa ${texts.k}.`,
        `Logistic population growth: ${readout}, carrying capacity ${texts.k}.`,
      ),
    ),
    time: playback.t,
    viewDir: [0.3, 0.62, 1],
  };
  return (
    <Bio3DView
      lesson="logistic"
      scene={scene}
      top={<LogisticChips />}
      bottom={
        <Player
          playback={playback}
          duration={st.tEnd}
          label={Lz(L('Thời gian t', 'Time t'))}
          readout={readout}
        />
      }
      caption={`${Lz(perFigure(per, (v) => fmt(v, 6)))} ${Lz(ILLUSTRATION)}`}
    />
  );
}
