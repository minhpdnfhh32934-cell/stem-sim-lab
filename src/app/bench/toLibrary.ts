import { openLab } from '@/app/topics';
import { sim } from '@/app/sim/runtime';
import { useWorkspaceStore, type Subject } from '@/app/workspaceStore';
import { closeModule } from '@/modules/moduleStore';

/** Back to the lab's library (Kệ bài), optionally showing one subject. */
export function toLibrary(subject?: Subject) {
  sim.shutdown();
  closeModule();
  if (subject) useWorkspaceStore.getState().setSubject(subject);
  openLab();
}
