import { fromSI, unitLabel } from '@/core/units';
import type { Solution } from '@/physics/types';
import { numbersIn } from './numbers';
import { newRequestId, type LlmTransport } from './transport';
import type { Provider } from './types';

export interface ExplainConfig {
  transport: LlmTransport;
  provider: Provider;
  model: string;
  baseUrl?: string;
  timeoutSecs: number;
  signal?: AbortSignal;
}

export interface Explanation {
  text: string;
  /** False when the AI wrote a number that the engine did not produce. */
  verified: boolean;
  unknownNumbers: number[];
}

/** Numbers the explanation may mention: engine answers, numbers in the steps and the problem. */
export function allowedNumbers(solution: Solution, problemText: string): number[] {
  const nums: number[] = [];
  for (const a of solution.answers) {
    nums.push(Math.abs(fromSI(a.value, a.unit)));
    if (a.check !== undefined) nums.push(Math.abs(fromSI(a.check, a.unit)));
  }
  for (const s of solution.steps) {
    nums.push(...numbersIn(s.text.vi), ...numbersIn(s.tex ?? ''));
  }
  nums.push(...numbersIn(problemText));
  return nums;
}

/** Returns the numbers in `text` that match none of `allowed` (1 % relative tolerance for rounding). */
export function unknownNumbers(text: string, allowed: number[]): number[] {
  const small = (n: number) => Number.isInteger(n) && n <= 4; // "2 vật", "bước 1"…
  return numbersIn(text).filter(
    (n) => !small(n) && !allowed.some((a) => Math.abs(a - n) <= 0.01 * Math.max(Math.abs(a), 1e-9)),
  );
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
    (a) =>
      `- ${a.label.vi} = ${Number(fromSI(a.value, a.unit).toPrecision(4))} ${unitLabel(a.unit)}`,
  );
  const steps = solution.steps.map((s, i) => `${i + 1}. ${s.text.vi}${s.tex ? ` [${s.tex}]` : ''}`);
  const system = `Bạn là trợ giảng Vật lí. Chương trình mô phỏng ĐÃ TÍNH xong các kết quả dưới đây.
Hãy DIỄN GIẢI bằng lời, ngắn gọn (tối đa 150 từ), dễ hiểu cho học sinh THPT: vì sao ra kết quả đó, ý nghĩa vật lí.
QUY TẮC: chỉ dùng đúng các con số có trong kết quả; KHÔNG tính thêm, KHÔNG đưa ra con số mới, KHÔNG sửa kết quả.`;
  const user = `Chủ đề: ${title}
${problemText ? `Đề bài: """${problemText}"""\n` : ''}Kết quả do chương trình tính:
${lines.join('\n')}
Các bước giải:
${steps.join('\n')}`;
  const resp = await cfg.transport.chat(
    {
      requestId: newRequestId(),
      provider: cfg.provider,
      ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
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
  return { text: resp.content.trim(), verified: unknown.length === 0, unknownNumbers: unknown };
}
