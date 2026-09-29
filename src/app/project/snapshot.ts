import { z } from 'zod';
import { subjectOf } from '@/app/topics';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { closeModule, openModule, useModuleStore } from '@/modules/moduleStore';
import { hasModule } from '@/modules/registry';
import { hasScene } from '@/physics/registry';

/**
 * `.stemsim` project file: which topic is open and the user's inputs (physics parameters
 * with their sources, or a module's inputs). Results are never stored — they are
 * recomputed by the engine when the file is opened.
 */
export const STEMSIM_FORMAT = 'stemsim';
export const STEMSIM_VERSION = 1;

const ParamSourceSchema = z.enum(['problem', 'default', 'user']);

export const SnapshotSchema = z.object({
  format: z.literal(STEMSIM_FORMAT),
  version: z.literal(STEMSIM_VERSION),
  app: z.string(),
  savedAt: z.string(),
  topicId: z.string().min(1),
  physics: z
    .object({
      params: z.record(z.string(), z.number()),
      sources: z.record(z.string(), ParamSourceSchema),
      problem: z.object({ text: z.string(), questions: z.array(z.string()) }).nullable(),
    })
    .optional(),
  module: z.object({ state: z.record(z.string(), z.unknown()) }).optional(),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

/** Id of the open topic (module or physics scene), or null. */
export function activeTopicId(): string | null {
  return useModuleStore.getState().active?.id ?? useSimStore.getState().scene?.id ?? null;
}

export function takeSnapshot(): Snapshot | null {
  const base = {
    format: STEMSIM_FORMAT,
    version: STEMSIM_VERSION,
    app: `STEM Sim Lab ${__APP_VERSION__}`,
    savedAt: new Date().toISOString(),
  } as const;
  const mod = useModuleStore.getState().active;
  if (mod) {
    return { ...base, topicId: mod.id, module: { state: mod.view.state?.get() ?? {} } };
  }
  const s = useSimStore.getState();
  if (!s.scene) return null;
  return {
    ...base,
    topicId: s.scene.id,
    physics: { params: { ...s.params }, sources: { ...s.sources }, problem: s.problem },
  };
}

export type ParseResult =
  { ok: true; snapshot: Snapshot } | { ok: false; error: 'json' | 'format' | 'topic' };

export function parseSnapshot(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'json' };
  }
  const r = SnapshotSchema.safeParse(raw);
  if (!r.success) return { ok: false, error: 'format' };
  const id = r.data.topicId;
  if (!hasModule(id) && !hasScene(id)) return { ok: false, error: 'topic' };
  return { ok: true, snapshot: r.data };
}

export function serializeSnapshot(s: Snapshot): string {
  return `${JSON.stringify(s, null, 2)}\n`;
}

const nextRender = () =>
  new Promise<void>((resolve) => {
    // Let the stage mount (its effects may set topic defaults) before restoring inputs.
    setTimeout(resolve, 60);
  });

/** Opens the topic of a snapshot and restores its inputs. */
export async function restoreSnapshot(s: Snapshot): Promise<void> {
  const subject = subjectOf(s.topicId);
  if (subject) useWorkspaceStore.setState({ subject });
  if (hasModule(s.topicId)) {
    sim.shutdown();
    await openModule(s.topicId);
    await nextRender();
    const view = useModuleStore.getState().active?.view;
    if (s.module && view?.state) view.state.set(s.module.state);
    return;
  }
  closeModule();
  await sim.open(s.topicId, {
    ...(s.physics
      ? {
          params: s.physics.params,
          sources: s.physics.sources,
          ...(s.physics.problem ? { problem: s.physics.problem } : {}),
        }
      : {}),
  });
}
