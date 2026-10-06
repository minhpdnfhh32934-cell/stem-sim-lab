import { closeModule, openModule, useModuleStore } from '@/modules/moduleStore';
import { hasModule } from '@/modules/registry';
import { hasScene } from '@/physics/registry';
import { sim } from './sim/runtime';
import { useSimStore } from './sim/simStore';
import { useWorkspaceStore, type Subject } from './workspaceStore';
import { CATALOG } from './catalog';
import { useProfileStore } from './learner/profileStore';
import { useProgressStore } from '@/learn/progressStore';
import { closeTeacher, useTeacherStore } from '@/teacher/teacherStore';

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

/** Opens any available topic (physics scenes for now; chemistry/biology modules later). */
export async function openTopic(topicId: string): Promise<void> {
  closeTeacher();
  const subject = subjectOf(topicId);
  if (subject) useWorkspaceStore.setState({ subject });
  if (hasModule(topicId)) {
    sim.shutdown();
    await openModule(topicId);
  } else if (hasScene(topicId)) {
    closeModule();
    await sim.open(topicId);
  } else {
    return;
  }
  useProfileStore.getState().setLastTopic(topicId);
  useProgressStore.getState().markVisited(topicId);
}

/** Closes the open topic and shows the home screen ("Hôm nay học gì?"). */
export function goHome(): void {
  closeTeacher();
  sim.shutdown();
  closeModule();
}

/** True while the "Dạy học bằng AI" screen replaces the workspace. */
export function useIsTeacher(): boolean {
  return useTeacherStore((s) => s.open);
}

/** True when nothing is open or opening: the home screen takes the centre. */
export function useIsHome(): boolean {
  const sim = useSimStore((s) => s.scene === null && !s.loading && s.error === null);
  const mod = useModuleStore((s) => s.active === null && !s.loading && s.error === null);
  return sim && mod;
}

export function useActiveTopic(): string | null {
  const scene = useSimStore((s) => s.scene?.id ?? null);
  const mod = useModuleStore((s) => s.active?.id ?? null);
  return mod ?? scene;
}
