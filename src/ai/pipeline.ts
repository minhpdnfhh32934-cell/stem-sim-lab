import { loadScene, sceneIds } from '@/physics/registry';
import type { PhysicsScene } from '@/physics/types';
import type { z } from 'zod';
import { buildDraft, type Draft } from './draft';
import { classificationSystem, extractionSystem } from './prompts';
import {
  ClassificationSchema,
  ExtractionSchema,
  UNSUPPORTED,
  classificationJsonSchema,
  extractionJsonSchema,
  parseJson,
} from './spec';
import { newRequestId, type LlmTransport } from './transport';
import { AiError, type ChatMessage, type Provider } from './types';

export const MAX_PROBLEM_CHARS = 4000;
export const MAX_REPAIRS = 2;

export type Stage = 'classify' | 'extract' | 'validate';

export interface PipelineConfig {
  transport: LlmTransport;
  provider: Provider;
  model: string;
  timeoutSecs: number;
  defaultGravity: number;
  /** Topic titles for the classifier prompt (id → Vietnamese title). */
  topicTitles: Record<string, string>;
  signal?: AbortSignal;
  onStage?: (s: Stage) => void;
}

export type PipelineResult =
  | { kind: 'draft'; draft: Draft; scene: PhysicsScene; model: string }
  | { kind: 'unsupported'; reason: string; parts: string[] };

/** Calls the LLM for structured JSON, feeding validation errors back (≤ MAX_REPAIRS times). */
async function structured<T>(
  cfg: PipelineConfig,
  system: string,
  user: string,
  jsonSchema: unknown,
  schemaName: string,
  schema: z.ZodType<T>,
  check?: (v: T) => string | null,
): Promise<{ value: T; model: string }> {
  const messages: ChatMessage[] = [{ role: 'user', content: user }];
  let lastError = '';
  for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
    if (cfg.signal?.aborted) throw new AiError('cancelled', '');
    const resp = await cfg.transport.chat(
      {
        requestId: newRequestId(),
        provider: cfg.provider,
        model: cfg.model,
        system,
        messages,
        jsonSchema,
        schemaName,
        temperature: 0,
        maxTokens: 2048,
        timeoutSecs: cfg.timeoutSecs,
      },
      cfg.signal,
    );
    const parsed = parseJson(schema, resp.content);
    const extra = parsed.ok ? (check?.(parsed.value) ?? null) : null;
    if (parsed.ok && !extra) return { value: parsed.value, model: resp.model };
    lastError = parsed.ok ? (extra ?? '') : parsed.error;
    messages.push(
      { role: 'assistant', content: resp.content },
      {
        role: 'user',
        content: `JSON chưa hợp lệ: ${lastError}\nHãy trả lại DUY NHẤT một JSON đúng schema, không giải thích.`,
      },
    );
  }
  throw new AiError('invalidJson', lastError);
}

/**
 * Problem text → SceneSpec draft (MASTER_PROMPT §3.1 pipeline):
 * LLM classify → LLM extract (JSON schema) → Zod → code checks (numbers present in the
 * text, units, ranges, required values) → draft for the confirmation table.
 */
export async function analyzeProblem(text: string, cfg: PipelineConfig): Promise<PipelineResult> {
  const problem = text.trim();
  if (!problem) throw new AiError('badResponse', 'empty');
  if (problem.length > MAX_PROBLEM_CHARS) throw new AiError('badResponse', 'tooLong');
  const ids = sceneIds();

  cfg.onStage?.('classify');
  const cls = await structured(
    cfg,
    classificationSystem(ids.map((id) => ({ id, title: cfg.topicTitles[id] ?? id }))),
    `Đề bài:\n"""${problem}"""`,
    classificationJsonSchema(ids),
    'topic_classification',
    ClassificationSchema,
    (v) =>
      v.topic === UNSUPPORTED || ids.includes(v.topic)
        ? null
        : `topic "${v.topic}" is not in the list`,
  );
  if (cls.value.topic === UNSUPPORTED) {
    return { kind: 'unsupported', reason: cls.value.reason, parts: cls.value.unsupported_parts };
  }

  const scene = await loadScene(cls.value.topic);
  // Question ids come from the scene's own answers (deterministic list).
  const sample = scene.solve(scene.defaults, 'vi').answers;
  const questions = sample.map((a) => ({ id: a.id, label: a.label.vi }));

  cfg.onStage?.('extract');
  const ext = await structured(
    cfg,
    extractionSystem(scene, questions),
    `Đề bài:\n"""${problem}"""`,
    extractionJsonSchema(
      scene,
      questions.map((q) => q.id),
    ),
    'scene_spec',
    ExtractionSchema,
    (v) => {
      const keys = new Set(scene.params.map((d) => d.key));
      const bad = v.quantities.filter((q) => !keys.has(q.key)).map((q) => q.key);
      return bad.length ? `unknown keys: ${bad.join(', ')}` : null;
    },
  );

  cfg.onStage?.('validate');
  const draft = buildDraft(scene, ext.value, problem, cfg.defaultGravity);
  draft.unsupported = [...new Set([...cls.value.unsupported_parts, ...draft.unsupported])];
  return { kind: 'draft', draft, scene, model: ext.model };
}
