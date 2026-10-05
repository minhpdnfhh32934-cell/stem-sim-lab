import { create } from 'zustand';
import { getDictionary } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { DEFAULT_MODELS, useAiStore } from '@/ai/aiStore';
import { getReading, putReading, type Reading } from '@/ai/cache';
import { manualDraft, type Draft } from '@/ai/draft';
import { analyzeProblem, type Stage } from '@/ai/pipeline';
import { getTransport } from '@/ai/transport';
import { AiError, toAiError, type AiErrorCode, type Provider } from '@/ai/types';
import { CATALOG } from '@/app/catalog';
import { openTopic } from '@/app/topics';
import { useModuleStore } from '@/modules/moduleStore';
import { checkInput, outputIsSafe, type InputCheck } from '@/safety/moderation';
import { currentSafety, logIncident } from '@/safety/safetyStore';
import type { IncidentKind } from '@/safety/safety';
import { hasModule } from '@/modules/registry';
import { hasScene, loadScene } from '@/physics/registry';
import type { ParamSource, Params, PhysicsScene } from '@/physics/types';

export type AnalyzePhase = 'idle' | 'running' | 'review' | 'unsupported' | 'error';
/** Error codes shown to the user: the transport's plus UI-side ones. */
export type AnalyzeErrorCode =
  | AiErrorCode
  | 'quota'
  | 'badKey'
  | 'badModel'
  | 'empty'
  | 'tooLong'
  /** Safety checks (src/safety/moderation.ts): the problem was not sent to the AI. */
  | 'personalData'
  | 'unsafe'
  | 'crisis'
  /** The AI answer was hidden by the output filter. */
  | 'outputUnsafe';

const BLOCK_INCIDENT: Record<Exclude<InputCheck, { ok: true }>['reason'], IncidentKind> = {
  personalData: 'inputPersonalData',
  unsafe: 'inputUnsafe',
  crisis: 'inputCrisis',
};

/**
 * Safety before the AI (PROMPT_PHAN_2 A3): the gates must be open, and the problem must not
 * contain personal data, unsuitable content or signs of a crisis. Returns the error to show, or
 * null. A blocked problem is logged as kind + time only and is never sent.
 */
export async function safetyBlock(
  text: string,
): Promise<{ code: AnalyzeErrorCode; detail: string } | null> {
  const status = await currentSafety().catch(() => null);
  if (!status?.aiAllowed) return { code: 'notAllowed', detail: '' };
  const check = checkInput(text);
  if (check.ok) return null;
  logIncident(BLOCK_INCIDENT[check.reason]);
  return {
    code: check.reason,
    detail: check.reason === 'personalData' ? check.found.join(',') : '',
  };
}

export interface AnalyzeState {
  phase: AnalyzePhase;
  mode: 'ai' | 'manual';
  stage: Stage | null;
  draft: Draft | null;
  scene: PhysicsScene | null;
  /** Manual mode on a chemistry/biology topic: its inputs are the module's own panel. */
  moduleId: string | null;
  model: string | null;
  /** The AI's reading of the problem (stored in the cache when the user confirms). */
  reading: Reading | null;
  /** The reading came from the cache of confirmed readings (no AI call was made). */
  cached: boolean;
  /** The fallback provider answered (the chosen one was out of quota/credit). */
  fallback: boolean;
  unsupported: { reason: string; parts: string[] } | null;
  error: { code: AnalyzeErrorCode; detail: string } | null;
}

export const useAnalyzeStore = create<AnalyzeState>()(() => ({
  phase: 'idle',
  mode: 'ai',
  stage: null,
  draft: null,
  scene: null,
  moduleId: null,
  model: null,
  reading: null,
  cached: false,
  fallback: false,
  unsupported: null,
  error: null,
}));

export interface ResolvedAi {
  provider: Provider;
  model: string;
  timeoutSecs: number;
}

/** The provider and model to use now (an empty model field means the default model). */
export function resolveAi(): Promise<ResolvedAi> {
  const ai = useAiStore.getState();
  if (ai.provider === 'off') return Promise.reject(new AiError('unavailable', 'off'));
  const provider = ai.provider;
  const model = ai.models[provider].trim() || DEFAULT_MODELS[provider];
  return Promise.resolve({ provider, model, timeoutSecs: ai.timeoutSecs });
}

/**
 * Turns an HTTP error from the provider into a code the dialog can explain in simple words
 * (the Rust gateway reports "429 Too Many Requests: …", the browser transport "429").
 */
export function httpErrorCode(message: string): AnalyzeErrorCode {
  const status = /^\s*(\d{3})\b/.exec(message)?.[1];
  if (status === '429' || /RESOURCE_EXHAUSTED|quota/i.test(message)) return 'quota';
  if (status === '401' || status === '403' || /API_KEY_INVALID|API key not valid/i.test(message))
    return 'badKey';
  if (status === '404') return 'badModel';
  return 'http';
}

let controller: AbortController | null = null;
let runSeq = 0;

function errorOf(e: unknown): { code: AnalyzeErrorCode; detail: string } {
  const err = toAiError(e);
  if (err.code === 'http') return { code: httpErrorCode(err.message), detail: err.message };
  if (err.code === 'badResponse' && (err.message === 'empty' || err.message === 'tooLong')) {
    return { code: err.message, detail: '' };
  }
  return { code: err.code, detail: err.message };
}

/**
 * Runs the AI pipeline on the problem text and opens the confirmation dialog. A problem
 * whose reading the user already confirmed is read from the cache (no AI call) unless
 * `fresh` is set ("Đọc lại bằng AI").
 */
export async function analyze(text: string, opts: { fresh?: boolean } = {}): Promise<void> {
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
    reading: null,
    cached: false,
    fallback: false,
    unsupported: null,
    error: null,
  });
  try {
    const blocked = await safetyBlock(text);
    if (seq !== runSeq) return;
    if (blocked) {
      useAnalyzeStore.setState({ phase: 'error', stage: null, error: blocked });
      return;
    }
    const ai = await resolveAi();
    const topics = getDictionary('vi').topics as Record<string, string>;
    const result = await analyzeProblem(text, {
      transport: getTransport(),
      ...ai,
      defaultGravity: useSettingsStore.getState().defaultGravity,
      topicTitles: topics,
      signal: ctrl.signal,
      ...(opts.fresh ? {} : { cachedReading: getReading }),
      onStage: (stage) => {
        if (seq === runSeq) useAnalyzeStore.setState({ stage });
      },
    });
    if (seq !== runSeq) return;
    // Output filter: text written by the AI is shown only when it passes.
    const aiText =
      result.kind === 'unsupported'
        ? [result.reason, ...result.parts].join('\n')
        : JSON.stringify(result.reading);
    if (!outputIsSafe(aiText)) {
      logIncident('outputUnsafe');
      useAnalyzeStore.setState({
        phase: 'error',
        stage: null,
        error: { code: 'outputUnsafe', detail: '' },
      });
      return;
    }
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
        reading: result.reading,
        cached: result.cached,
        fallback: result.fallback,
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

/**
 * A problem showing signs of a crisis gets the support card at once, even when no key is set
 * (the "Phân tích đề" button would otherwise open Settings). Returns true when it was shown.
 */
export function showCrisisIfNeeded(text: string): boolean {
  const check = checkInput(text);
  if (check.ok || check.reason !== 'crisis') return false;
  cancelAnalyze();
  logIncident('inputCrisis');
  useAnalyzeStore.setState({
    phase: 'error',
    mode: 'ai',
    stage: null,
    error: { code: 'crisis', detail: '' },
  });
  return true;
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
/** First available topic of the current subject (manual mode with nothing open). */
function defaultTopic(): string {
  const subject = useWorkspaceStore.getState().subject;
  for (const chapter of CATALOG[subject]) {
    for (const topic of chapter.topics) {
      if (hasScene(topic.id) || hasModule(topic.id)) return topic.id;
    }
  }
  return 'uniformAcceleration';
}

/**
 * Manual mode ("Tự dựng cảnh"): any topic of the three subjects. Physics topics get the
 * parameter table; chemistry/biology topics open right away and show their own inputs.
 */
export async function openManual(topicId?: string): Promise<void> {
  cancelAnalyze();
  const id = topicId ?? useModuleStore.getState().active?.id ?? sim.scene?.id ?? defaultTopic();
  const base = {
    phase: 'review',
    mode: 'manual',
    stage: null,
    model: null,
    reading: null,
    cached: false,
    fallback: false,
    unsupported: null,
    error: null,
  } as const;
  if (hasModule(id)) {
    // Show the choice at once; the panel appears when the module has loaded.
    useAnalyzeStore.setState({ ...base, draft: null, scene: null, moduleId: id });
    await openTopic(id);
    return;
  }
  const scene = await loadScene(id);
  useAnalyzeStore.setState({
    ...base,
    draft: manualDraft(scene, useSettingsStore.getState().defaultGravity),
    scene,
    moduleId: null,
  });
}

export function closeAnalyze(): void {
  cancelAnalyze();
  useAnalyzeStore.setState({
    phase: 'idle',
    draft: null,
    scene: null,
    moduleId: null,
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
  const { mode, reading } = useAnalyzeStore.getState();
  // Confirmed: the same problem will not need the AI again (PROMPT_PHAN_2 A2).
  if (mode === 'ai' && reading) putReading(draft.problemText, reading);
  closeAnalyze();
  useWorkspaceStore.setState({ subject: 'physics' });
  await sim.open(draft.topic, {
    params,
    sources,
    ...(mode === 'ai' ? { problem: { text: draft.problemText, questions: draft.questions } } : {}),
  });
}
