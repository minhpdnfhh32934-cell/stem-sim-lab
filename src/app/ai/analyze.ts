import { create } from 'zustand';
import { getDictionary } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useAiStore } from '@/ai/aiStore';
import { manualDraft, type Draft } from '@/ai/draft';
import { analyzeProblem, type Stage } from '@/ai/pipeline';
import { getTransport } from '@/ai/transport';
import { AiError, toAiError, type AiErrorCode, type Provider } from '@/ai/types';
import { loadScene } from '@/physics/registry';
import type { ParamSource, Params, PhysicsScene } from '@/physics/types';

export type AnalyzePhase = 'idle' | 'running' | 'review' | 'unsupported' | 'error';
/** Error codes shown to the user: the transport's plus UI-side ones. */
export type AnalyzeErrorCode = AiErrorCode | 'noModel' | 'empty' | 'tooLong';

export interface AnalyzeState {
  phase: AnalyzePhase;
  mode: 'ai' | 'manual';
  stage: Stage | null;
  draft: Draft | null;
  scene: PhysicsScene | null;
  model: string | null;
  unsupported: { reason: string; parts: string[] } | null;
  error: { code: AnalyzeErrorCode; detail: string } | null;
}

export const useAnalyzeStore = create<AnalyzeState>()(() => ({
  phase: 'idle',
  mode: 'ai',
  stage: null,
  draft: null,
  scene: null,
  model: null,
  unsupported: null,
  error: null,
}));

export interface ResolvedAi {
  provider: Provider;
  model: string;
  baseUrl?: string;
  timeoutSecs: number;
}

/**
 * The provider and model to use now. For LM Studio without a chosen model, the model
 * currently loaded in LM Studio is used (asked from the server when not known yet).
 */
export async function resolveAi(): Promise<ResolvedAi> {
  const ai = useAiStore.getState();
  if (ai.provider === 'off') throw new AiError('unavailable', 'off');
  const provider = ai.provider;
  let model = ai.models[provider].trim();
  if (provider === 'lmstudio' && !model) {
    const available = ai.availableModels.length
      ? ai.availableModels
      : await getTransport().models('lmstudio', ai.baseUrl);
    if (available.length) useAiStore.setState({ availableModels: available, status: 'ok' });
    model = available.find((m) => !/embed/i.test(m)) ?? '';
    if (!model) throw new AiError('unavailable', 'noModel');
  }
  return {
    provider,
    model,
    ...(provider === 'lmstudio' ? { baseUrl: ai.baseUrl } : {}),
    timeoutSecs: ai.timeoutSecs,
  };
}

let controller: AbortController | null = null;
let runSeq = 0;

function errorOf(e: unknown): { code: AnalyzeErrorCode; detail: string } {
  const err = toAiError(e);
  if (err.code === 'unavailable' && err.message === 'noModel')
    return { code: 'noModel', detail: '' };
  if (err.code === 'badResponse' && (err.message === 'empty' || err.message === 'tooLong')) {
    return { code: err.message, detail: '' };
  }
  return { code: err.code, detail: err.message };
}

/** Runs the AI pipeline on the problem text and opens the confirmation dialog. */
export async function analyze(text: string): Promise<void> {
  cancelAnalyze();
  const seq = ++runSeq;
  const ctrl = new AbortController();
  controller = ctrl;
  useAnalyzeStore.setState({
    phase: 'running',
    mode: 'ai',
    stage: 'classify',
    draft: null,
    scene: null,
    model: null,
    unsupported: null,
    error: null,
  });
  try {
    const ai = await resolveAi();
    const topics = getDictionary('vi').topics as Record<string, string>;
    const result = await analyzeProblem(text, {
      transport: getTransport(),
      ...ai,
      defaultGravity: useSettingsStore.getState().defaultGravity,
      topicTitles: topics,
      signal: ctrl.signal,
      onStage: (stage) => {
        if (seq === runSeq) useAnalyzeStore.setState({ stage });
      },
    });
    if (seq !== runSeq) return;
    if (result.kind === 'unsupported') {
      useAnalyzeStore.setState({
        phase: 'unsupported',
        stage: null,
        unsupported: { reason: result.reason, parts: result.parts },
      });
    } else {
      useAnalyzeStore.setState({
        phase: 'review',
        stage: null,
        draft: result.draft,
        scene: result.scene,
        model: result.model,
      });
    }
  } catch (e) {
    if (seq !== runSeq) return;
    const error = errorOf(e);
    if (error.code === 'cancelled') {
      useAnalyzeStore.setState({ phase: 'idle', stage: null });
      return;
    }
    useAnalyzeStore.setState({ phase: 'error', stage: null, error });
  } finally {
    if (controller === ctrl) controller = null;
  }
}

/** Cancels a running analysis (the Rust side aborts the HTTP request). */
export function cancelAnalyze(): void {
  if (controller) {
    controller.abort();
    controller = null;
  }
  runSeq++;
  if (useAnalyzeStore.getState().phase === 'running') {
    useAnalyzeStore.setState({ phase: 'idle', stage: null });
  }
}

/** "Tự dựng cảnh": opens the confirmation dialog with defaults only, no AI involved. */
export async function openManual(topicId?: string): Promise<void> {
  cancelAnalyze();
  const id = topicId ?? sim.scene?.id ?? 'uniformAcceleration';
  const scene = await loadScene(id);
  useAnalyzeStore.setState({
    phase: 'review',
    mode: 'manual',
    stage: null,
    draft: manualDraft(scene, useSettingsStore.getState().defaultGravity),
    scene,
    model: null,
    unsupported: null,
    error: null,
  });
}

export function closeAnalyze(): void {
  cancelAnalyze();
  useAnalyzeStore.setState({
    phase: 'idle',
    draft: null,
    scene: null,
    unsupported: null,
    error: null,
  });
}

/** The user confirmed the table: open the simulation with exactly these values and origins. */
export async function confirmDraft(
  draft: Draft,
  params: Params,
  sources: Record<string, ParamSource>,
): Promise<void> {
  const mode = useAnalyzeStore.getState().mode;
  closeAnalyze();
  useWorkspaceStore.setState({ subject: 'physics' });
  await sim.open(draft.topic, {
    params,
    sources,
    ...(mode === 'ai' ? { problem: { text: draft.problemText, questions: draft.questions } } : {}),
  });
}
