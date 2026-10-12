/**
 * Splits an AI Teacher message into fenced code, display math and markdown runs. Kept apart from
 * MessageBody.tsx so that file only exports components (React fast refresh).
 */
export type MessageBlock =
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'math'; tex: string }
  | { kind: 'md'; lines: string[] };

const FENCE = '```';
const TOKEN = '\uE000';

function extractFences(input: string): { text: string; codes: { lang: string; code: string }[] } {
  const codes: { lang: string; code: string }[] = [];
  let text = input;
  for (;;) {
    const start = text.indexOf(FENCE);
    if (start < 0) break;
    const langEnd = text.indexOf('\n', start + FENCE.length);
    if (langEnd < 0) break;
    const end = text.indexOf(FENCE, langEnd + 1);
    if (end < 0) break;
    codes.push({
      lang: text
        .slice(start + FENCE.length, langEnd)
        .trim()
        .slice(0, 20),
      code: text.slice(langEnd + 1, end).replace(/\n$/, ''),
    });
    text = `${text.slice(0, start)}${TOKEN}${codes.length - 1}${TOKEN}${text.slice(end + FENCE.length)}`;
  }
  return { text, codes };
}

/** Returns the fenced code block when the whole line is a placeholder. */
function matchFence(
  line: string,
  codes: { lang: string; code: string }[],
): { lang: string; code: string } | null {
  const prefix = TOKEN;
  if (!line.startsWith(prefix) || !line.endsWith(prefix)) return null;
  const index = Number(line.slice(prefix.length, line.length - prefix.length));
  if (!Number.isInteger(index)) return null;
  return codes[index] ?? null;
}

/** Splits a message into code frames, display-math blocks and markdown runs. */
export function parseMessage(content: string): MessageBlock[] {
  const { text, codes } = extractFences(content);
  const blocks: MessageBlock[] = [];
  const flushMd = (lines: string[]) => {
    while (lines.length > 0 && lines[0]?.trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') lines.pop();
    if (lines.length > 0) blocks.push({ kind: 'md', lines });
  };
  let md: string[] = [];
  // Display math $$...$$ may span lines: scan the whole text, not line by line.
  const parts = text.split(/(\$\$[\s\S]*?\$\$)/g);
  for (const part of parts) {
    if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 5) {
      flushMd(md);
      md = [];
      blocks.push({ kind: 'math', tex: part.slice(2, -2).trim() });
      continue;
    }
    for (const line of part.split('\n')) {
      const code = matchFence(line, codes);
      if (!code) {
        md.push(line);
        continue;
      }
      flushMd(md);
      md = [];
      blocks.push({ kind: 'code', lang: code.lang, code: code.code });
    }
  }
  flushMd(md);
  return blocks;
}
