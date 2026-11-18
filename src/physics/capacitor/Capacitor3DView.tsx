/**
 * The 3D view of "Tụ điện" (three.js side, loaded when the learner picks 3D): the same bank as
 * the canvas; the dots follow the charge the engine has reached (`sim.renderState`).
 */
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { L } from '../common/scene-helpers';
import { fmtQty } from '../common/tex';
import { MODE, bankInput, equivalent } from './model';
import { buildCapacitorScene } from './scene3d';

const CAPTION = L(
  'Mỗi tụ là hai bản. Chấm cùng màu bản dương là điện tích dương, chấm cùng màu bản âm là điện tích âm. Số chấm trên mỗi tụ tỉ lệ với điện tích q = CU của tụ khi đang tích điện (tụ có điện tích lớn nhất có 36 chấm mỗi bản). Kích thước bản và khoảng cách chỉ để minh họa.',
  'Each capacitor is two plates. Dots the colour of the + plate are positive charge, dots the colour of the − plate negative charge. The number of dots on a capacitor is proportional to its charge q = CU while it charges (the one with the largest charge has 36 dots per plate). Plate sizes and spacing are illustrations.',
);

const MODE_NAME = {
  [MODE.single]: L('Một tụ', 'One capacitor'),
  [MODE.series]: L('Ghép nối tiếp', 'In series'),
  [MODE.parallel]: L('Ghép song song', 'In parallel'),
} as const;

export default function Capacitor3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const params = useSimStore((s) => s.params);
  const scrub = useSimStore((s) => s.scrubTime);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const playing = useWorkspaceStore((s) => s.playing);
  const bank = bankInput(params);
  const names = bank.caps.map((C, i) => `C${'₁₂₃'[i] ?? ''} = ${fmtQty(locale, C, 'uF', 4)}`);
  const mode = Lz(MODE_NAME[bank.mode as keyof typeof MODE_NAME]);
  const C = fmtQty(locale, equivalent(bank), 'uF', 4);
  return (
    <Bio3DView
      // A new arrangement (chain ↔ side by side) starts from its own view direction.
      key={bank.mode}
      lesson="capacitor"
      className="phys3d"
      scene={{
        build: (kit: SceneKit) =>
          buildCapacitorScene(kit, { bank, names, read: () => sim.renderState }),
        buildKey: JSON.stringify([bank, locale]),
        label: Lz(L(`${mode}: điện dung của bộ tụ ${C}`, `${mode}: the bank's capacitance ${C}`)),
        time: scrub ?? simTime,
        running: playing,
        // A chain along x is seen from the front; capacitors side by side (along z) from a corner, so
        // both the gaps and the row show.
        viewDir: bank.mode === MODE.series ? [0.6, 0.55, 1] : [0.9, 0.7, 1],
      }}
      top={<span className="chem-chip mono">{`${mode}, C = ${C}`}</span>}
      caption={Lz(CAPTION)}
    />
  );
}
