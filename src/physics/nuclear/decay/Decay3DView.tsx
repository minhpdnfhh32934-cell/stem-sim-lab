/**
 * The 3D view of the "Định luật" and "Ngẫu nhiên" parts of "Hiện tượng phóng xạ" (three.js side,
 * loaded when shown): a sample of 200 nuclei; how many are left is the law's (at the chosen t) or
 * the 2D picture's random run (same seed), stepped through over and over.
 */
import type { ReactNode } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { prefersReducedMotion } from '@/ui/three/availability';
import { SAMPLE, STEPS, lawLeft, randomRun } from '../nuclear3d';
import { buildDecayScene } from '../scene3d';
import { L } from './card';
import { useDecayStore } from './store';

const CAPTION = {
  law: L(
    'Mẫu 200 hạt nhân: số hạt nhân chưa phân rã (đỏ cam) là 200·2^(−t/T) làm tròn, tại thời điểm t đang chọn. Hạt nhân nào đã phân rã (xám) chỉ để minh họa.',
    'A sample of 200 nuclei: the ones not yet decayed (orange) are 200·2^(−t/T), rounded, at the chosen time t. Which ones have decayed (grey) is an illustration.',
  ),
  random: L(
    'Cùng lần thử ngẫu nhiên với hình 2D (200 hạt nhân, 5 chu kì bán rã), chạy lặp lại: không đoán trước được hạt nhân nào sẽ phân rã, chỉ biết trung bình cứ sau một chu kì còn khoảng một nửa.',
    'The same random run as the 2D picture (200 nuclei, 5 half-lives), played over and over: no one can tell which nucleus decays next, only that on average about half are left after each half-life.',
  ),
};

export function Decay3DView({ top, tab }: { top: ReactNode; tab: 'law' | 'random' }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { T, t, seed } = useDecayStore();
  const n = (v: number, d = 3) => formatNumber(locale, v, { maximumSignificantDigits: d });
  const left = tab === 'law' ? lawLeft(t, T) : randomRun(T, seed);
  const still = prefersReducedMotion();
  const text = (k: number, step: number | null) =>
    Lz(
      step === null
        ? L(
            `Còn ${String(k)}/${String(SAMPLE)} hạt nhân`,
            `${String(k)}/${String(SAMPLE)} nuclei left`,
          )
        : L(
            `t = ${n((5 * step) / STEPS)} T: còn ${String(k)}/${String(SAMPLE)} hạt nhân`,
            `t = ${n((5 * step) / STEPS)} T: ${String(k)}/${String(SAMPLE)} nuclei left`,
          ),
    );
  return (
    <Bio3DView
      // Law ↔ random: a different picture, started afresh.
      key={tab}
      lesson="radioactivity"
      scene={{
        build: (kit: SceneKit) => buildDecayScene(kit, { seed, left, text, still }),
        buildKey: JSON.stringify([tab, T, t, seed, locale]),
        label: Lz(L('Mẫu 200 hạt nhân phóng xạ', 'A sample of 200 radioactive nuclei')),
        running: tab === 'random' && !still,
        viewDir: [0.6, 0.5, 1],
      }}
      top={top}
      caption={Lz(CAPTION[tab])}
    />
  );
}
