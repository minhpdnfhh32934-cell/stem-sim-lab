/**
 * Enzyme kinetics in 3D: a beaker of enzyme molecules shared between their forms in the model's
 * proportions. "v theo [S]": the learner picks [S] (the rate plot's range); "[S] theo thời
 * gian": the exact time course [S](t) plays, product appears as substrate is used up.
 */
import { useState } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { L } from '../common';
import { useFmt } from '../fmt';
import { Bio3DView, type SceneSpec } from '../view3d/Bio3DView';
import { usePlayback } from '../view3d/playback';
import { Player } from '../view3d/player';
import { ILLUSTRATION } from '../view3d/texts';
import { EnzymeChips } from './chips';
import { KIND_NAME, paramsOf, sTopOf, useEnzymeData } from './data';
import { apparent, rate, substrateAt } from './enzyme';
import { ENZYMES_DRAWN, enzymeShares, perMolecule, splitCount } from './enzymeShares';
import { buildEnzymeScene } from './scene3d';
import { useEnzyme } from './store';

export function Enzyme3D() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useEnzyme();
  const p = paramsOf(st);
  const app = apparent(p);
  const { timeData } = useEnzymeData();
  const sTop = sTopOf(st);
  // Rate plot: the learner's [S] (starts at the apparent Km, where v = Vmax/2 of that curve).
  const [sPick, setS] = useState(() => Math.min(sTop, app.km));
  const S = Math.min(sTop, sPick);
  const playback = usePlayback(timeData.tEnd, { start: 0, autoplay: st.view === 'time' });
  const time = st.view === 'time';
  const per = perMolecule(time ? st.s0 : sTop, st.kind === 'none' ? 0 : st.inhibitor);
  const at = (x: number) => {
    const s = time ? substrateAt(p, st.s0, x) : x;
    return { S: s, P: time ? st.s0 - s : 0, shares: enzymeShares(p, s) };
  };
  const now = at(time ? playback.t : S);
  const counts = splitCount(now.shares, ENZYMES_DRAWN);
  const v = rate(p, now.S);
  const unit = `mM/${Lz(L('phút', 'min'))}`;
  const readout = time
    ? `t = ${fmt(playback.t, 3)} ${Lz(L('phút', 'min'))} · [S] = ${fmt(now.S)} mM · [P] = ${fmt(now.P)} mM`
    : `[S] = ${fmt(S)} mM · v = ${fmt(v)} ${unit}`;
  const scene: SceneSpec = {
    build: (kit) => buildEnzymeScene(kit, { kind: st.kind, per, inhibitor: st.inhibitor, at }),
    buildKey: JSON.stringify([st.vmax, st.km, st.kind, st.inhibitor, st.ki, st.s0, st.view, per]),
    label: Lz(
      L(
        `Cốc phản ứng: ${String(counts.ES + counts.ESI)}/${String(ENZYMES_DRAWN)} enzyme đang gắn cơ chất; ${readout}.`,
        `Reaction beaker: ${String(counts.ES + counts.ESI)}/${String(ENZYMES_DRAWN)} enzymes hold substrate; ${readout}.`,
      ),
    ),
    time: time ? playback.t : S,
    viewDir: [0.4, 0.55, 1],
  };
  const forms =
    st.kind === 'none'
      ? Lz(
          L(
            `${String(counts.ES)} enzyme gắn cơ chất (ES), ${String(counts.E)} enzyme tự do.`,
            `${String(counts.ES)} enzymes with substrate (ES), ${String(counts.E)} free.`,
          ),
        )
      : Lz(
          L(
            `${Lz(KIND_NAME[st.kind])}: ${String(counts.ES)} ES, ${String(counts.EI)} EI, ${String(counts.ESI)} ESI, ${String(counts.E)} tự do.`,
            `${Lz(KIND_NAME[st.kind])}: ${String(counts.ES)} ES, ${String(counts.EI)} EI, ${String(counts.ESI)} ESI, ${String(counts.E)} free.`,
          ),
        );
  return (
    <Bio3DView
      lesson="enzyme"
      scene={scene}
      top={<EnzymeChips />}
      bottom={
        time ? (
          <Player
            playback={playback}
            duration={timeData.tEnd}
            label={Lz(L('Thời gian', 'Time'))}
            readout={readout}
          />
        ) : (
          <div className="bio3d__player">
            <input
              type="range"
              aria-label={Lz(L('Nồng độ cơ chất [S]', 'Substrate concentration [S]'))}
              min={0}
              max={sTop}
              step={sTop / 400}
              value={S}
              onChange={(e) => {
                setS(Number(e.target.value));
              }}
            />
            <output>{readout}</output>
          </div>
        )
      }
      caption={`${forms} ${Lz(
        L(
          `Vẽ ${String(ENZYMES_DRAWN)} phân tử enzyme; tỉ lệ các dạng theo mô hình cân bằng nhanh (v = Vmax·[ES]/[E]tổng), làm tròn. Mỗi hạt tự do ≈ ${fmt(per)} mM.`,
          `${String(ENZYMES_DRAWN)} enzyme molecules drawn; the forms' shares follow the rapid-equilibrium model (v = Vmax·[ES]/[E]total), rounded. Each free particle ≈ ${fmt(per)} mM.`,
        ),
      )} ${Lz(ILLUSTRATION)}`}
    />
  );
}
