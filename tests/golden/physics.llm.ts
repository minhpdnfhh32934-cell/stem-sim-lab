import { expect, it } from 'vitest';
import { DEFAULT_MODELS } from '@/ai/aiStore';
import { analyzeProblem } from '@/ai/pipeline';
import { getTransport } from '@/ai/transport';
import vi from '@/app/i18n/locales/vi';
import golden from './physics.json';

// Node globals without pulling Node types into the app tsconfig.
declare const process: { env: Record<string, string | undefined> };

interface GoldenItem {
  id: string;
  text: string;
  topic: string;
  quantities: { key: string; value: number; unit: string }[];
  answers: Record<string, number>;
}

/**
 * Measures how well a real model reads the golden problems (PROMPT_PHAN_2 A6: Gemini and
 * Claude). Code-side guarantees (no invented numbers, defaults marked) hold whatever the model
 * does; this report shows how often the model picks the right topic and extracts the right
 * values.
 *
 *   GEMINI_API_KEY=… npm run golden:llm                         (Gemini, default)
 *   LLM_PROVIDER=claude ANTHROPIC_API_KEY=… npm run golden:llm   (Claude; paid API)
 */
it('golden set with a real model', async () => {
  const provider = process.env.LLM_PROVIDER === 'claude' ? 'claude' : 'gemini';
  // The key stays in this Node process (it is never part of the app's web page).
  if (provider === 'claude') {
    globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = process.env.ANTHROPIC_API_KEY;
    expect(process.env.ANTHROPIC_API_KEY, 'set ANTHROPIC_API_KEY').toBeTruthy();
  } else {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = process.env.GEMINI_API_KEY;
    expect(process.env.GEMINI_API_KEY, 'set GEMINI_API_KEY').toBeTruthy();
  }
  const transport = getTransport();
  const model =
    (provider === 'claude' ? process.env.CLAUDE_MODEL : process.env.GEMINI_MODEL) ??
    DEFAULT_MODELS[provider];
  const items = (golden as { items: GoldenItem[] }).items;
  const rows: Record<string, unknown>[] = [];
  for (const item of items) {
    const started = Date.now();
    let row: Record<string, unknown> = { id: item.id, expected: item.topic };
    try {
      const r = await analyzeProblem(item.text, {
        transport,
        provider,
        model,
        timeoutSecs: 180,
        defaultGravity: 9.81,
        topicTitles: vi.topics,
      });
      if (r.kind === 'unsupported') {
        row = { ...row, got: 'unsupported', topicOk: item.topic === 'unsupported' };
      } else {
        const wrong = item.quantities.filter(
          (q) =>
            r.draft.written[q.key]?.value !== q.value || r.draft.written[q.key]?.unit !== q.unit,
        );
        const sol = r.scene.solve(r.draft.params, 'vi');
        const answersOk = Object.entries(item.answers).every(([id, v]) => {
          const a = sol.answers.find((x) => x.id === id);
          return a !== undefined && Math.abs(a.value - v) <= 1e-6 * Math.max(1, Math.abs(v));
        });
        row = {
          ...row,
          got: r.scene.id,
          topicOk: r.scene.id === item.topic,
          valuesOk: wrong.length === 0,
          wrongKeys: wrong.map((q) => q.key),
          answersOk,
          rejected: r.draft.issues.filter((i) => i.blocking).length,
        };
      }
    } catch (e) {
      row = { ...row, error: e instanceof Error ? e.message : String(e), topicOk: false };
    }
    rows.push({ ...row, ms: Date.now() - started });
    // eslint-disable-next-line no-console -- this runner's output is its report
    console.log(JSON.stringify(rows.at(-1)));
  }
  // Values/answers are only scored for problems the model sent to a simulation.
  const pct = (k: string) => {
    const scored = rows.filter((r) => k === 'topicOk' || k in r);
    const ok = scored.filter((r) => r[k] === true).length;
    return `${ok}/${scored.length}`;
  };
  const summary = {
    model,
    n: rows.length,
    topic: pct('topicOk'),
    values: pct('valuesOk'),
    answers: pct('answersOk'),
  };
  // eslint-disable-next-line no-console -- this runner's output is its report
  console.log('SUMMARY', JSON.stringify(summary), '\nREPORT', JSON.stringify(rows));
});
