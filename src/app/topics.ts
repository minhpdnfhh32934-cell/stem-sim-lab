import { hasScene } from '@/physics/registry';
import { sim } from './sim/runtime';
import { useSimStore } from './sim/simStore';
import { useWorkspaceStore, type Subject } from './workspaceStore';
import { CATALOG } from './catalog';

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
  const subject = subjectOf(topicId);
  if (subject) useWorkspaceStore.setState({ subject });
  if (hasScene(topicId)) await sim.open(topicId);
}

export function useActiveTopic(): string | null {
  return useSimStore((s) => s.scene?.id ?? null);
}
