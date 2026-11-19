import { closeModule, openModule, useModuleStore } from '@/modules/moduleStore';
import { hasModule } from '@/modules/registry';
import { hasScene } from '@/physics/registry';
import { sim, type OpenOptions } from './sim/runtime';
import { useSimStore } from './sim/simStore';
import { useWorkspaceStore, type Subject } from './workspaceStore';
import { CATALOG } from './catalog';
import { useProfileStore } from './learner/profileStore';
import { useProgressStore } from '@/learn/progressStore';
import { closeTeacher, useTeacherStore } from '@/teacher/teacherStore';
import { useNavigationStore } from './navigationStore';

/** Subject that contains a topic id (for switching the subject when opening). */
export function subjectOf(topicId: string): Subject | undefined {
  for (const [subject, chapters] of Object.entries(CATALOG) as [
    Subject,
    (typeof CATALOG)[Subject],
  ][]) {
    if (chapters.some((c) => c.topics.some((t) => t.id === topicId))) return subject;
  }
  return undefined;
}

/**
 * Opens any available topic. `opts` (physics scenes only) starts the scene from given inputs,
 * e.g. a Science Studio condition.
 */
export async function openTopic(topicId: string, opts?: OpenOptions): Promise<void> {
  closeTeacher();
  useNavigationStore.getState().setScreen('lab');
  const subject = subjectOf(topicId);
  if (subject) useWorkspaceStore.setState({ subject });
  const isModule = hasModule(topicId);
  if (!isModule && !hasScene(topicId)) return;
  // Remembered right away: going home while the engine is still loading must not lose
  // "Tiếp tục bài đang học".
  useProfileStore.getState().setLastTopic(topicId);
  if (isModule) {
    sim.shutdown();
    await openModule(topicId);
  } else {
    closeModule();
    await sim.open(topicId, opts);
  }
  useProgressStore.getState().markVisited(topicId);
}

/** Closes the open topic and shows the home screen ("Hôm nay học gì?"). */
export function goHome(): void {
  closeTeacher();
  sim.shutdown();
  closeModule();
  useNavigationStore.getState().setScreen('home');
}

/** Opens the existing topic browser and simulation workspace from the new landing page. */
export function openLab(): void {
  closeTeacher();
  // Nothing open in the lab: no Science Card may linger from another screen's model.
  if (!useSimStore.getState().scene && !useModuleStore.getState().active) {
    useWorkspaceStore.setState({ scienceCard: null });
  }
  useNavigationStore.getState().setScreen('lab');
}

/**
 * Opens Science Studio (guided Predict–Observe–Explain lessons) inside the lab: the topic library
 * stays beside it. `screen === 'studio'` keeps its meaning for every older caller.
 */
export function openStudio(): void {
  closeTeacher();
  sim.shutdown();
  closeModule();
  useNavigationStore.getState().setScreen('studio');
}

export function useIsStudio(): boolean {
  return useNavigationStore((s) => s.screen === 'studio');
}

/** True while the "Dạy học bằng AI" screen replaces the workspace. */
export function useIsTeacher(): boolean {
  const nav = useNavigationStore((s) => s.screen === 'teacher');
  const legacy = useTeacherStore((s) => s.open);
  return nav || legacy;
}

export function useIsLanding(): boolean {
  return useNavigationStore((s) => s.screen === 'home');
}

/** True when nothing is open or opening: the home screen takes the centre. */
export function useIsHome(): boolean {
  const inLab = useNavigationStore((s) => s.screen === 'lab');
  const sim = useSimStore((s) => s.scene === null && !s.loading && s.error === null);
  const mod = useModuleStore((s) => s.active === null && !s.loading && s.error === null);
  return inLab && sim && mod;
}

export function useActiveTopic(): string | null {
  const scene = useSimStore((s) => s.scene?.id ?? null);
  const mod = useModuleStore((s) => s.active?.id ?? null);
  return mod ?? scene;
}
