import { describe, expect, it } from 'vitest';
import { buildDraft } from '@/ai/draft';
import { analyzeProblem } from '@/ai/pipeline';
import { normalizeProblem } from '@/ai/cache';
import type { LlmTransport } from '@/ai/transport';
import type { ChatRequest } from '@/ai/types';
import { loadScene } from '@/physics/registry';
import golden from './physics.json';

interface GoldenItem {
  id: string;
  text: string;
  topic: string;
  quantities: { key: string; value: number; unit: string; quote: string }[];
  missing: string[];
  answers: Record<string, number>;
  expectUnsupportedParts: boolean;
}

const items = (golden as { items: GoldenItem[] }).items;
const supported = items.filter((i) => i.topic !== 'unsupported');

describe('golden set (physics): expected extraction → engine answers', () => {
  it('has at least 30 problems', () => {
    expect(items.length).toBeGreaterThanOrEqual(30);
  });

  it.each(supported.map((i) => [i.id, i] as const))('%s', async (_id, item) => {
    const scene = await loadScene(item.topic);
    const draft = buildDraft(
      scene,
      {
        quantities: item.quantities,
        questions: [],
        assumptions: [],
        unsupported_parts: [],
        clarifications: [],
      },
      item.text,
      9.81,
    );
    // Every expected value passes the "must be in the problem" check.
    expect(draft.issues.filter((x) => x.blocking)).toEqual([]);
    expect(draft.missing.sort()).toEqual([...item.missing].sort());
    if (Object.keys(item.answers).length === 0) return;
    const sol = scene.solve(draft.params, 'vi');
    for (const [id, expected] of Object.entries(item.answers)) {
      const got = sol.answers.find((a) => a.id === id);
      expect(got, `${item.id}: answer ${id}`).toBeDefined();
      const tol = 1e-6 * Math.max(1, Math.abs(expected));
      expect(Math.abs(got!.value - expected), `${item.id}: ${id}`).toBeLessThan(tol);
    }
  });
});

describe('extraction guard: invented numbers are rejected', () => {
  it('drops a value that is not in the problem (converted 72 km/h → 20 m/s)', async () => {
    const scene = await loadScene('uniformAcceleration');
    const text = items.find((i) => i.id === 'bd-01')!.text;
    const d = buildDraft(
      scene,
      {
        quantities: [
          { key: 'vA', value: 20, unit: 'm/s', quote: 'vận tốc 72 km/h' },
          { key: 'aA', value: -2, unit: 'm/s^2', quote: '2 m/s²' },
        ],
        questions: [],
        assumptions: [],
        unsupported_parts: [],
        clarifications: [],
      },
      text,
      9.81,
    );
    expect(d.issues.some((x) => x.kind === 'notInText' && x.key === 'vA')).toBe(true);
    expect(d.missing).toContain('vA');
    expect(d.sources.vA).toBe('default');
  });

  it('accepts zero only when stated in words with a real quote', async () => {
    const scene = await loadScene('freeFall');
    const text = 'Thả rơi tự do một vật từ độ cao 80 m.';
    const ok = buildDraft(
      scene,
      {
        quantities: [
          { key: 'v0', value: 0, unit: 'm/s', quote: 'Thả rơi tự do' },
          { key: 'h0', value: 80, unit: 'm', quote: 'độ cao 80 m' },
        ],
        questions: [],
        assumptions: [],
        unsupported_parts: [],
        clarifications: [],
      },
      text,
      9.81,
    );
    expect(ok.sources.v0).toBe('problem');
    const bad = buildDraft(
      scene,
      {
        quantities: [{ key: 'v0', value: 0, unit: 'm/s', quote: 'vật đứng yên' }],
        questions: [],
        assumptions: [],
        unsupported_parts: [],
        clarifications: [],
      },
      text,
      9.81,
    );
    expect(bad.issues.some((x) => x.kind === 'notInText')).toBe(true);
  });

  it('marks g as a default when the problem does not give it', async () => {
    const scene = await loadScene('obliqueProjectile');
    const d = buildDraft(
      scene,
      { quantities: [], questions: [], assumptions: [], unsupported_parts: [], clarifications: [] },
      'x',
      9.8,
    );
    expect(d.params.g).toBe(9.8);
    expect(d.sources.g).toBe('default');
  });
});

/** Scripted fake LLM: returns canned JSON per schema name, optionally broken first. */
function fakeTransport(replies: Record<string, string[]>): LlmTransport & { calls: ChatRequest[] } {
  const calls: ChatRequest[] = [];
  const queues = Object.fromEntries(Object.entries(replies).map(([k, v]) => [k, [...v]]));
  return {
    calls,
    chat: (req) => {
      calls.push(req);
      const q = queues[req.schemaName ?? ''] ?? [];
      const content = q.length > 1 ? (q.shift() ?? '') : (q[0] ?? '');
      return Promise.resolve({ content, model: 'fake', durationMs: 1 });
    },
    models: () => Promise.resolve(['fake']),
    setKey: () => Promise.resolve(),
    hasKey: () => Promise.resolve(false),
    deleteKey: () => Promise.resolve(),
  };
}

const baseCfg = {
  provider: 'gemini' as 'gemini' | 'claude',
  model: 'fake',
  timeoutSecs: 5,
  defaultGravity: 9.81,
  topicTitles: {},
};

describe('AI pipeline with a fake LLM', () => {
  const item = items.find((i) => i.id === 'nn-01')!;

  it('classify → extract → validated draft', async () => {
    const t = fakeTransport({
      topic_classification: [
        JSON.stringify({
          topic: 'horizontalProjectile',
          reason: 'ném ngang',
          unsupported_parts: [],
        }),
      ],
      scene_spec: [
        JSON.stringify({
          quantities: item.quantities,
          questions: ['time_of_flight', 'range'],
          assumptions: [],
          unsupported_parts: [],
          clarifications: [],
        }),
      ],
    });
    const r = await analyzeProblem(item.text, { ...baseCfg, transport: t });
    expect(r.kind).toBe('draft');
    if (r.kind !== 'draft') return;
    expect(r.draft.params.v0).toBe(15);
    expect(r.draft.sources.h0).toBe('problem');
    expect(r.draft.questions).toEqual(['time_of_flight', 'range']);
    // Structured output was requested with a JSON schema.
    expect(t.calls[1]!.jsonSchema).toBeDefined();
    expect(r.cached).toBe(false);

    // A confirmed reading is reused without calling the AI, and the code checks run again.
    const again = fakeTransport({});
    const r2 = await analyzeProblem(`  ${item.text}\n`, {
      ...baseCfg,
      transport: again,
      cachedReading: (p) =>
        normalizeProblem(p) === normalizeProblem(item.text) ? r.reading : null,
    });
    expect(again.calls).toHaveLength(0);
    expect(r2.kind === 'draft' && r2.cached).toBe(true);
    if (r2.kind !== 'draft') return;
    expect(r2.draft.params).toEqual(r.draft.params);
    expect(r2.draft.sources).toEqual(r.draft.sources);
  });

  it('works the same with the Claude provider', async () => {
    const t = fakeTransport({
      topic_classification: [
        JSON.stringify({ topic: 'horizontalProjectile', reason: '', unsupported_parts: [] }),
      ],
      scene_spec: [
        JSON.stringify({
          quantities: item.quantities,
          questions: [],
          assumptions: [],
          unsupported_parts: [],
          clarifications: [],
        }),
      ],
    });
    const r = await analyzeProblem(item.text, {
      ...baseCfg,
      provider: 'claude',
      model: 'claude-test',
      transport: t,
    });
    expect(r.kind).toBe('draft');
    expect(t.calls.every((c) => c.provider === 'claude' && c.model === 'claude-test')).toBe(true);
  });

  it('repairs invalid JSON by sending the error back (≤ 2 retries)', async () => {
    const t = fakeTransport({
      topic_classification: [
        'not json',
        JSON.stringify({ topic: 'horizontalProjectile', reason: '', unsupported_parts: [] }),
      ],
      scene_spec: [
        JSON.stringify({
          quantities: [],
          questions: [],
          assumptions: [],
          unsupported_parts: [],
          clarifications: [],
        }),
      ],
    });
    const r = await analyzeProblem(item.text, { ...baseCfg, transport: t });
    expect(r.kind).toBe('draft');
    expect(t.calls[1]!.messages.at(-1)!.content).toMatch(/JSON chưa hợp lệ/);
  });

  it('gives up with invalidJson after the retries are exhausted', async () => {
    const t = fakeTransport({ topic_classification: ['nope'] });
    await expect(analyzeProblem(item.text, { ...baseCfg, transport: t })).rejects.toMatchObject({
      code: 'invalidJson',
    });
    expect(t.calls).toHaveLength(3);
  });

  it('reports unsupported problems honestly', async () => {
    const t = fakeTransport({
      topic_classification: [
        JSON.stringify({
          topic: 'unsupported',
          reason: 'mạch điện',
          unsupported_parts: ['dòng điện'],
        }),
      ],
    });
    const r = await analyzeProblem(items.find((i) => i.id === 'ng-01')!.text, {
      ...baseCfg,
      transport: t,
    });
    expect(r.kind).toBe('unsupported');
  });
});
