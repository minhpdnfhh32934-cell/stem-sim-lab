import { create } from 'zustand';
import type { LocalizedText } from '@/core/data/dataset';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { sim } from '@/app/sim/runtime';
import { openTopic } from '@/app/topics';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { hasScene } from '@/physics/registry';

const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export interface ShowcaseScene {
  topic: string;
  /** One sentence about what is on screen (words only: no new numbers). */
  caption: LocalizedText;
  seconds: number;
}

/**
 * "Chế độ trưng bày" (#54 item 13): the scenes a booth plays in turn, each 35–50 s, in
 * presentation mode. Only topics the app already has, with their default values; no AI, no
 * network.
 */
export const SHOWCASE: readonly ShowcaseScene[] = [
  {
    topic: 'obliqueProjectile',
    caption: L(
      'Ném xiên: vật bay theo đường parabol, vận tốc đổi hướng, gia tốc trọng trường luôn hướng xuống.',
      'Oblique projectile: a parabolic path, the velocity turns, gravity always points down.',
    ),
    seconds: 40,
  },
  {
    topic: 'springPendulum',
    caption: L(
      'Con lắc lò xo: vật dao động quanh vị trí cân bằng, động năng và thế năng đổi cho nhau.',
      'Spring pendulum: the mass oscillates about equilibrium, kinetic and potential energy swap.',
    ),
    seconds: 40,
  },
  {
    topic: 'standingWave',
    caption: L(
      'Sóng dừng trên dây: các nút đứng yên, các bụng dao động mạnh nhất.',
      'Standing wave on a string: the nodes stay still, the antinodes swing the most.',
    ),
    seconds: 40,
  },
  {
    topic: 'uniformCircularMotion',
    caption: L(
      'Chuyển động tròn đều: tốc độ không đổi, gia tốc hướng tâm luôn chỉ vào tâm.',
      'Uniform circular motion: constant speed, the centripetal acceleration always points inward.',
    ),
    seconds: 35,
  },
  {
    topic: 'electricField',
    caption: L(
      'Điện trường của điện tích điểm: đường sức đi ra từ điện tích dương, đi vào điện tích âm.',
      'Electric field of point charges: field lines leave positive charges and end on negative ones.',
    ),
    seconds: 35,
  },
  {
    topic: 'molecule3d',
    caption: L(
      'Phân tử 3D: hình dạng phân tử tính bằng RDKit, xoay bằng chuột để xem từ mọi phía.',
      '3D molecules: shapes computed with RDKit; turn them with the mouse.',
    ),
    seconds: 40,
  },
  {
    topic: 'mitosis',
    caption: L(
      'Nguyên phân: một tế bào chia thành hai tế bào con có bộ nhiễm sắc thể giống hệt.',
      'Mitosis: one cell divides into two daughter cells with identical chromosome sets.',
    ),
    seconds: 50,
  },
  {
    topic: 'logisticGrowth',
    caption: L(
      'Tăng trưởng logistic: quần thể tăng nhanh rồi chậm dần khi gần sức chứa của môi trường.',
      'Logistic growth: the population grows fast, then slows near the carrying capacity.',
    ),
    seconds: 45,
  },
];

/** Index of the scene on screen, or null when the showcase is not running. */
export const useShowcase = create<{ index: number | null }>(() => ({ index: null }));

let timer: ReturnType<typeof setTimeout> | null = null;

async function show(i: number): Promise<void> {
  const scene = SHOWCASE[i];
  if (!scene || useShowcase.getState().index === null) return;
  useShowcase.setState({ index: i });
  await openTopic(scene.topic);
  // Stopped while the topic loaded: leave it as it is.
  if (useShowcase.getState().index !== i) return;
  if (hasScene(scene.topic) && !useWorkspaceStore.getState().playing) sim.togglePlay();
  timer = setTimeout(() => {
    void show((i + 1) % SHOWCASE.length);
  }, scene.seconds * 1000);
}

/** Starts the showcase in presentation mode, from the first scene. */
export function startShowcase(): void {
  if (timer) clearTimeout(timer);
  useShowcase.setState({ index: 0 });
  useLayoutStore.getState().setPresentation(true);
  void show(0);
}

/** Stops it (any press or key); the scene on screen stays open. */
export function stopShowcase(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (useShowcase.getState().index === null) return;
  useShowcase.setState({ index: null });
  useLayoutStore.getState().setPresentation(false);
}
