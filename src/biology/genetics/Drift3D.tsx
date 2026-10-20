/**
 * Genetic drift in 3D: every Wright–Fisher run (the lesson's own runs, same seed) is a ribbon over
 * the generations, the runs side by side, coloured by the fate of A; the playback moves a plane
 * through the generations with a bead at each run's frequency of A.
 */
import { useLocalized } from '@/app/i18n/localized';
import { useTierConfig } from '@/perf/perfStore';
import { L } from '../common';
import { useFmt } from '../fmt';
import { Bio3DView, type SceneSpec } from '../view3d/Bio3DView';
import { usePlayback } from '../view3d/playback';
import { Player } from '../view3d/player';
import { ILLUSTRATION } from '../view3d/texts';
import { DriftChips } from './driftChips';
import { useDriftRuns } from './driftData';
import { driftAt } from './genetics3d';
import { buildDriftScene } from './scenes3d';
import { useDrift } from './store';

export function Drift3D() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useDrift();
  const runs = useDriftRuns();
  const tier = useTierConfig();
  const playback = usePlayback(st.generations, { start: 0, autoplay: true, seconds: 10 });
  const g = Math.round(playback.t);
  const now = driftAt(runs, g);
  // Gene copies per bead: one, unless the runs hold more beads than the tier draws.
  const copies = 2 * st.N;
  const per = Math.max(1, Math.ceil((copies * runs.length) / Math.min(6000, tier.maxParticles)));
  const texts = { tube: (k: number) => String(k + 1) };
  const readout = Lz(
    L(
      `Thế hệ ${String(g)} · đã cố định A: ${String(now.fixed)} · đã mất A: ${String(now.lost)}`,
      `Generation ${String(g)} · A fixed: ${String(now.fixed)} · A lost: ${String(now.lost)}`,
    ),
  );
  const scene: SceneSpec = {
    build: (kit) => buildDriftScene(kit, { runs, copies, per, texts }),
    buildKey: JSON.stringify([st.N, st.p0, st.generations, st.runs, st.seed, per]),
    label: Lz(
      L(
        `${String(runs.length)} quần thể, N = ${String(st.N)}: tần số alen A qua ${String(st.generations)} thế hệ. ${readout}.`,
        `${String(runs.length)} populations, N = ${String(st.N)}: frequency of A over ${String(st.generations)} generations. ${readout}.`,
      ),
    ),
    time: g,
    viewDir: [0.2, 0.55, 1],
    aspect: 2,
  };
  return (
    <Bio3DView
      lesson="drift"
      scene={scene}
      top={
        <>
          <DriftChips />
          <span className="chem-chip bio-legend">
            {Lz(L('Bản sao gen', 'Gene copies'))}
            <span className="rx-swatch bio-swatch--allele-A" /> A
            <span className="rx-swatch bio-swatch--allele-a" /> a
          </span>
        </>
      }
      bottom={
        <Player
          playback={playback}
          duration={st.generations}
          label={Lz(L('Thế hệ', 'Generation'))}
          readout={readout}
        />
      }
      caption={`${Lz(
        L(
          `Mỗi ống là một quần thể (một lần chạy Wright–Fisher của bài) với 2N = ${fmt(copies, 6)} bản sao gen; mức hạt A (từ đáy lên) là tần số alen A ở thế hệ đang xem.`,
          `Each tube is one population (one Wright–Fisher run of the lesson) with 2N = ${fmt(copies, 6)} gene copies; the level of A beads (from the bottom) is the frequency of A at the generation shown.`,
        ),
      )} ${
        per > 1
          ? Lz(
              L(
                `Mỗi hạt ≈ ${fmt(per, 6)} bản sao (làm tròn).`,
                `Each bead ≈ ${fmt(per, 6)} copies (rounded).`,
              ),
            )
          : Lz(L('Mỗi hạt là 1 bản sao gen.', 'Each bead is 1 gene copy.'))
      } ${Lz(ILLUSTRATION)}`}
    />
  );
}
