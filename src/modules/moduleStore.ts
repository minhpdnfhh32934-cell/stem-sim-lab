import { create } from 'zustand';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { usePerfStore } from '@/perf/perfStore';
import { loadModule } from './registry';
import type { ModuleView } from './types';

export interface ModuleState {
  active: { id: string; view: ModuleView } | null;
  /** The topic last asked for: the one loading, failed or open (null once closed). */
  requested: string | null;
  loading: boolean;
  error: string | null;
}

export const useModuleStore = create<ModuleState>()(() => ({
  active: null,
  requested: null,
  loading: false,
  error: null,
}));

let seq = 0;

export async function openModule(id: string): Promise<void> {
  const mine = ++seq;
  useModuleStore.setState({ loading: true, error: null, requested: id });
  usePerfStore.setState({ degraded: false });
  try {
    const view = await loadModule(id);
    if (mine !== seq) return;
    useModuleStore.setState({ active: { id, view }, loading: false });
  } catch (e) {
    if (mine !== seq) return;
    console.error(e);
    useModuleStore.setState({ loading: false, error: e instanceof Error ? e.message : String(e) });
  }
}

export function closeModule(): void {
  seq++;
  if (useModuleStore.getState().active || useModuleStore.getState().loading) {
    useModuleStore.setState({ active: null, requested: null, loading: false, error: null });
    useWorkspaceStore.setState({ scienceCard: null });
  }
}
