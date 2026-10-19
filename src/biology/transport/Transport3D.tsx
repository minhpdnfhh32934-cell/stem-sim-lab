/**
 * "Khuếch tán & thẩm thấu" in 3D: the diffusion chamber with its illustrative particles, or the
 * osmosis U-tube whose liquid heights follow the model. Chips and controls are the 2D view's.
 */
import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { IconButton } from '@/ui/IconButton';
import { L } from '../common';
import { useFmt } from '../fmt';
import { Bio3DView, type SceneSpec } from '../view3d/Bio3DView';
import { usePlayback } from '../view3d/playback';
import { Player } from '../view3d/player';
import { prefersReducedMotion } from '../view3d/support';
import { ILLUSTRATION } from '../view3d/texts';
import { buildDiffusionScene, buildOsmosisScene } from './scene3d';
import { TransportChips } from './chips';
import { useOsmosis } from './osmosisData';
import { useTransport } from './store';

function Diffusion3D() {
  const Lz = useLocalized();
  const st = useTransport();
  const [running, setRunning] = useState(() => !prefersReducedMotion());
  const side = (s: 1 | 2, n: number) =>
    `${Lz(s === 1 ? L('Ngăn 1', 'Side 1') : L('Ngăn 2', 'Side 2'))}: ${String(n)}`;
  const scene: SceneSpec = {
    build: (kit) =>
      buildDiffusionScene(kit, {
        particles: st.particles,
        pores: st.pores,
        run: st.run,
        sideText: side,
      }),
    buildKey: JSON.stringify([st.particles, st.pores, st.run, side(1, 0)]),
    label: Lz(
      L(
        `Hai ngăn ngăn bởi màng có ${String(st.pores)} lỗ; ${String(st.particles)} hạt chuyển động Brown (minh họa).`,
        `Two sides split by a membrane with ${String(st.pores)} pores; ${String(st.particles)} particles in Brownian motion (illustration).`,
      ),
    ),
    running,
  };
  return (
    <Bio3DView
      lesson="transport"
      scene={scene}
      top={<TransportChips />}
      bottom={
        <div className="bio3d__player">
          <IconButton
            icon={Play}
            altIcon={Pause}
            showAlt={running}
            size="lg"
            variant="solid"
            label={running ? Lz(L('Tạm dừng', 'Pause')) : Lz(L('Phát', 'Play'))}
            onClick={() => {
              setRunning((r) => !r);
            }}
          />
          <output>{Lz(L('Minh họa chuyển động Brown', 'Brownian motion (illustration)'))}</output>
        </div>
      }
      caption={Lz(
        L(
          'Các hạt chỉ minh họa cơ chế ngẫu nhiên; đồ thị bên dưới dùng định luật Fick. Màng có lỗ dạng khe xuyên suốt chiều sâu.',
          'The particles only illustrate the random mechanism; the chart below uses Fick’s law. The pores are slots through the whole depth.',
        ),
      )}
    />
  );
}

function Osmosis3D() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useTransport();
  const { p, eq, tEnd, traj } = useOsmosis();
  const playback = usePlayback(tEnd, { start: 0, autoplay: true, seconds: 8 });
  const { replay } = playback;
  // "Chạy lại" plays the rise again.
  useEffect(() => {
    if (st.run) replay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.run]);
  const texts = {
    solution: Lz(L('Dung dịch', 'Solution')),
    water: Lz(L('Nước cất', 'Pure water')),
    membrane: Lz(L('Màng bán thấm', 'Semipermeable membrane')),
    dh: (cm: number) => `Δh = ${fmt(cm)} cm`,
  };
  const scene: SceneSpec = {
    build: (kit) => buildOsmosisScene(kit, { h0: p.h0, hEq: eq.hL, traj, tEnd, texts }),
    buildKey: JSON.stringify([p, eq.hL, tEnd, texts.solution, texts.dh(1)]),
    label: Lz(
      L(
        `Ống chữ U: dung dịch bên trái, nước cất bên phải; t = ${fmt(playback.t, 3)} s.`,
        `U-tube: solution on the left, pure water on the right; t = ${fmt(playback.t, 3)} s.`,
      ),
    ),
    time: playback.t,
    viewDir: [0.35, 0.3, 1],
  };
  return (
    <Bio3DView
      lesson="transport"
      scene={scene}
      top={<TransportChips />}
      bottom={
        <Player
          playback={playback}
          duration={tEnd}
          label={Lz(L('Thời gian t', 'Time t'))}
          readout={`t = ${fmt(playback.t, 3)} s`}
        />
      }
      caption={Lz(ILLUSTRATION)}
    />
  );
}

export function Transport3D() {
  const mode = useTransport((s) => s.mode);
  return mode === 'diffusion' ? <Diffusion3D /> : <Osmosis3D />;
}
