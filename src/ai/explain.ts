import { fromSI, unitLabel } from '@/core/units';
import type { Answer, Solution } from '@/physics/types';
import { outputIsSafe } from '@/safety/moderation';
import { numbersIn, numberTokens } from './numbers';
import { SAFETY_RULES } from './prompts';
import { newRequestId, type LlmTransport } from './transport';
import type { Provider } from './types';

export interface ExplainConfig {
  transport: LlmTransport;
  provider: Provider;
  model: string;
  timeoutSecs: number;
  signal?: AbortSignal;
}

export interface Explanation {
  text: string;
  /** False when the AI wrote a number that the engine did not produce. */
  verified: boolean;
  unknownNumbers: number[];
  /** False when the output filter found unsuitable content (the text is then not shown). */
  safe: boolean;
  /** Model that wrote it, and whether it was the fallback provider. */
  model: string;
  fallback: boolean;
}

/** An answer value as the prompt writes it (4 significant digits, display unit). */
function shownValue(a: Answer): number {
  return Number(fromSI(a.value, a.unit).toPrecision(4));
}

/**
 * Numbers the explanation may mention: engine answers (exact and as the prompt shows them),
 * numbers in the answer labels ("tại t = 8 s"), in the steps and in the problem.
 */
export function allowedNumbers(solution: Solution, problemText: string): number[] {
  const nums: number[] = [];
  for (const a of solution.answers) {
    nums.push(Math.abs(fromSI(a.value, a.unit)), Math.abs(shownValue(a)));
    if (a.check !== undefined) nums.push(Math.abs(fromSI(a.check, a.unit)));
    nums.push(...numbersIn(a.label.vi), ...numbersIn(a.label.en));
  }
  for (const s of solution.steps) {
    nums.push(...numbersIn(s.text.vi), ...numbersIn(s.tex ?? ''));
  }
  nums.push(...numbersIn(problemText));
  return nums;
}

/**
 * Returns the numbers written in `text` that match none of `allowed` (1 % relative tolerance for
 * rounding). A written token is known when any of its readings matches ("2,5" may be 2.5 or 25);
 * an unknown token is reported by its first reading.
 */
export function unknownNumbers(text: string, allowed: number[]): number[] {
  const small = (n: number) => Number.isInteger(n) && n <= 4; // "2 vật", "bước 1"…
  const known = (n: number) =>
    small(n) || allowed.some((a) => Math.abs(a - n) <= 0.01 * Math.max(Math.abs(a), 1e-9));
  const unknown: number[] = [];
  for (const readings of numberTokens(text)) {
    const first = readings[0];
    if (first !== undefined && !readings.some(known)) unknown.push(first);
  }
  return unknown;
}

/**
 * Asks the LLM to explain, in words, results the engine already computed (§2.1 b).
 * The reply is checked: any number not produced by the engine makes it "unverified".
 */
export async function explainSolution(
  title: string,
  problemText: string,
  solution: Solution,
  cfg: ExplainConfig,
): Promise<Explanation> {
  const lines = solution.answers.map(
    (a) => `- ${a.label.vi} = ${shownValue(a)} ${unitLabel(a.unit)}`,
  );
  const steps = solution.steps.map((s, i) => `${i + 1}. ${s.text.vi}${s.tex ? ` [${s.tex}]` : ''}`);
  const system = `Bạn là trợ giảng Vật lí. Chương trình mô phỏng ĐÃ TÍNH xong các kết quả dưới đây.
Hãy DIỄN GIẢI bằng lời, ngắn gọn (tối đa 150 từ), dễ hiểu cho học sinh THPT: vì sao ra kết quả đó, ý nghĩa vật lí.
QUY TẮC: chỉ dùng đúng các con số có trong kết quả; KHÔNG tính thêm, KHÔNG đưa ra con số mới, KHÔNG sửa kết quả.${SAFETY_RULES}`;
  const user = `Chủ đề: ${title}
${problemText ? `Đề bài: """${problemText}"""\n` : ''}Kết quả do chương trình tính:
${lines.join('\n')}
Các bước giải:
${steps.join('\n')}`;
  const resp = await cfg.transport.chat(
    {
      requestId: newRequestId(),
      provider: cfg.provider,
      model: cfg.model,
      system,
      messages: [{ role: 'user', content: user }],
      temperature: 0.2,
      maxTokens: 600,
      timeoutSecs: cfg.timeoutSecs,
    },
    cfg.signal,
  );
  const unknown = unknownNumbers(resp.content, allowedNumbers(solution, problemText));
  const text = resp.content.trim();
  return {
    text,
    verified: unknown.length === 0,
    unknownNumbers: unknown,
    safe: outputIsSafe(text),
    model: resp.model,
    fallback: resp.fallback ?? false,
  };
}
