/**
 * Predator–prey in 3D: prey and predators share one habitat; their numbers at each moment are
 * the computed trajectory's (the nearest computed point, never interpolated). The two columns
 * rise to each population's share of its peak in this run.
 */
import { useLocalized } from '@/app/i18n/localized';
import { useTierConfig } from '@/perf/perfStore';
import { L } from '../common';
import { useFmt } from '../fmt';
import { Bio3DView, type SceneSpec } from '../view3d/Bio3DView';
import { usePlayback } from '../view3d/playback';
import { Player } from '../view3d/player';
import { ILLUSTRATION, perFigure } from '../view3d/texts';
import { LvChips } from './chips';
import { useLvData } from './data';
import { figuresFor, lvMoment, lvPeaks, lvSampleAt } from './eco3d';
import { buildLvScene } from './scenes3d';
import { useLv } from './store';

export function LotkaVolterra3D() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useLv();
  const tier = useTierConfig();
  const { traj } = useLvData();
  const peak = lvPeaks(traj);
  // The tier's figure budget is shared between the two species.
  const prey = figuresFor(peak.prey, Math.floor(tier.maxParticles * 0.6));
  const predators = figuresFor(peak.predators, Math.floor(tier.maxParticles * 0.4));
  const per = { prey: prey.per, predators: predators.per };
  const playback = usePlayback(st.tEnd, { start: 0, autoplay: true, seconds: 12 });
  const k = lvSampleAt(traj, playback.t);
  const now = lvMoment(traj, k, per);
  const texts = {
    prey: Lz(L('Con mồi x', 'Prey x')),
    predators: Lz(L('Vật ăn thịt y', 'Predators y')),
    peakPrey: `max = ${fmt(peak.prey, 4)}`,
    peakPredators: `max = ${fmt(peak.predators, 4)}`,
  };
  const readout = `t = ${fmt(now.t, 3)} · x = ${fmt(now.prey.value, 4)} · y = ${fmt(now.predators.value, 4)}`;
  const scene: SceneSpec = {
    build: (kit) =>
      buildLvScene(kit, {
        traj,
        per,
        capacity: { prey: prey.capacity, predators: predators.capacity },
        peak,
        texts,
      }),
    buildKey: JSON.stringify([
      st.alpha,
      st.beta,
      st.delta,
      st.gamma,
      st.x0,
      st.y0,
      st.tEnd,
      per,
      prey.capacity,
      predators.capacity,
      texts,
    ]),
    label: Lz(L(`Con mồi và vật ăn thịt: ${readout}.`, `Prey and predators: ${readout}.`)),
    time: playback.t,
    viewDir: [0.3, 0.62, 1],
  };
  const figures =
    per.prey === per.predators
      ? Lz(perFigure(per.prey, (v) => fmt(v, 6)))
      : `${texts.prey}: ${Lz(perFigure(per.prey, (v) => fmt(v, 6)))} ${texts.predators}: ${Lz(perFigure(per.predators, (v) => fmt(v, 6)))}`;
  return (
    <Bio3DView
      lesson="lotkaVolterra"
      scene={scene}
      top={<LvChips />}
      bottom={
        <Player
          playback={playback}
          duration={st.tEnd}
          label={Lz(L('Thời gian t', 'Time t'))}
          readout={readout}
        />
      }
      caption={`${figures} ${Lz(ILLUSTRATION)}`}
    />
  );
}
