import { Fragment, type ReactNode } from 'react';
import { Equation } from '@/science-card/Equation';
import { parseMessage } from './messageParse';

/** Bold around a formula ("**$\Sigma F$ (Tổng hợp lực):**"), formulas included whole. */
const BOLD_WITH_MATH = /(\*\*[^*\n]*\$[^$\n]+?\$[^*\n]*\*\*)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Bold around a formula first: split by the math below, its ** pair would fall in two pieces
  // and show as typed (machine B's sweep 19/11/2026, V2).
  const bold = text.split(BOLD_WITH_MATH);
  if (bold.length > 1) {
    return bold.flatMap((part, i) =>
      i % 2 === 1
        ? [
            <strong key={`${keyPrefix}-bm${i}`}>
              {renderInline(part.slice(2, -2), `${keyPrefix}-bm${i}`)}
            </strong>,
          ]
        : renderInline(part, `${keyPrefix}-bm${i}`),
    );
  }
  // Inline math first so its $ and * never become emphasis.
  const out: ReactNode[] = [];
  const mathSplit = text.split(/(\$[^$\n]+?\$)/g);
  let mathIndex = 0;
  for (const chunk of mathSplit) {
    if (chunk.startsWith('$') && chunk.endsWith('$') && chunk.length >= 3) {
      out.push(
        <Equation key={`${keyPrefix}-m${mathIndex++}`} tex={chunk.slice(1, -1)} display={false} />,
      );
      continue;
    }
    out.push(...renderSpans(chunk, `${keyPrefix}-t${mathIndex}`));
    mathIndex++;
  }
  return out;
}

/** "vi.wikipedia.org" for a link, so the learner sees where it would lead. */
function linkHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function renderSpans(text: string, keyPrefix: string): ReactNode[] {
  // `code` → **bold** → *italic* → [links](http…). React escapes the text itself.
  const out: ReactNode[] = [];
  const codeSplit = text.split(/(`[^`]+?`)/g);
  codeSplit.forEach((chunk, i) => {
    if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length >= 3) {
      out.push(<code key={`${keyPrefix}-c${i}`}>{chunk.slice(1, -1)}</code>);
      return;
    }
    const boldSplit = chunk.split(/(\*\*[^*]+?\*\*)/g);
    boldSplit.forEach((part, j) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 5) {
        out.push(
          <strong key={`${keyPrefix}-b${i}-${j}`}>
            {renderEmphasis(part.slice(2, -2), `${keyPrefix}-b${i}-${j}`)}
          </strong>,
        );
        return;
      }
      const linkSplit = part.split(/(\[[^\]]*?\]\(https?:\/\/[^)\s]+?\))/g);
      linkSplit.forEach((piece, k) => {
        const link = /^\[([^\]]*?)\]\((https?:\/\/[^)\s]+?)\)$/.exec(piece);
        if (link) {
          // An AI-written link is never clickable (audit SEC-03): text from Wikipedia or an
          // imported file could make the AI point anywhere. The learner sees where it leads and
          // can copy it; pages outside the app open only through KnownPageLink's fixed list.
          const url = link[2] ?? '';
          out.push(
            <span key={`${keyPrefix}-l${i}-${j}-${k}`} className="chat-message__link" title={url}>
              {renderEmphasis(link[1] ?? '', `${keyPrefix}-l${i}-${j}-${k}`)}{' '}
              <span className="chat-message__url">({linkHost(url)})</span>
            </span>,
          );
        } else {
          out.push(
            <Fragment key={`${keyPrefix}-x${i}-${j}-${k}`}>
              {renderEmphasis(piece, `${keyPrefix}-x${i}-${j}-${k}`)}
            </Fragment>,
          );
        }
      });
    });
  });
  return out;
}

function renderEmphasis(text: string, keyPrefix: string): ReactNode {
  const split = text.split(/(\*[^*\n]+?\*)/g);
  if (split.length === 1) return text;
  return split.map((part, i) =>
    part.startsWith('*') && part.endsWith('*') && part.length >= 3 ? (
      <em key={`${keyPrefix}-e${i}`}>{part.slice(1, -1)}</em>
    ) : (
      <Fragment key={`${keyPrefix}-e${i}`}>{part}</Fragment>
    ),
  );
}

function renderMdLines(lines: string[], keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // A numbered list keeps its numbers ("Bước 3" after a formula between the steps is still 3).
  let list: { start: number | null; items: string[] } | null = null;
  const flushList = () => {
    if (list) {
      const { start, items } = list;
      list = null;
      const Tag = start === null ? 'ul' : 'ol';
      out.push(
        <Tag
          key={`${keyPrefix}-ul${out.length}`}
          className="msg-list"
          {...(start !== null && start !== 1 ? { start } : {})}
        >
          {items.map((item, i) => (
            <li key={i}>{renderInline(item, `${keyPrefix}-li${out.length}-${i}`)}</li>
          ))}
        </Tag>,
      );
    }
  };
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushList();
      const level = heading[1]?.length ?? 3;
      const Tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
      out.push(
        <Tag key={`${keyPrefix}-h${i}`} className="msg-heading">
          {renderInline(heading[2] ?? '', `${keyPrefix}-h${i}`)}
        </Tag>,
      );
      return;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushList();
      out.push(<hr key={`${keyPrefix}-hr${i}`} className="msg-hr" />);
      return;
    }
    const dashItem = /^[-*]\s+(.*)$/.exec(trimmed)?.[1];
    const numbered = dashItem === undefined ? /^(\d+)[.)]\s+([\s\S]*)$/.exec(trimmed) : null;
    const itemText = dashItem ?? numbered?.[2] ?? null;
    if (itemText !== null) {
      const start = numbered ? Number(numbered[1]) : null;
      // A bullet after numbered steps (or the reverse) starts a list of its own.
      if (list && (list.start === null) !== (start === null)) flushList();
      (list ??= { start, items: [] }).items.push(itemText);
      return;
    }
    if (trimmed.startsWith('> ')) {
      flushList();
      out.push(
        <blockquote key={`${keyPrefix}-q${i}`} className="msg-quote">
          {renderInline(trimmed.slice(2), `${keyPrefix}-q${i}`)}
        </blockquote>,
      );
      return;
    }
    if (trimmed === '') {
      flushList();
      return;
    }
    flushList();
    out.push(
      <p key={`${keyPrefix}-p${i}`} className="msg-paragraph">
        {renderInline(trimmed, `${keyPrefix}-p${i}`)}
      </p>,
    );
  });
  flushList();
  return out;
}

/**
 * Renders an assistant answer the way learners expect from a chat app: headings,
 * lists, code frames and KaTeX formulas instead of raw markdown/TeX. Everything
 * comes from parsed parts (React escapes text; only KaTeX emits HTML for the
 * formula itself), so a hostile answer cannot inject markup.
 */
export function MessageBody({ content }: { content: string }) {
  const blocks = parseMessage(content);
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === 'code') {
          return (
            <figure key={i} className="msg-code">
              {block.lang && <figcaption className="msg-code__lang">{block.lang}</figcaption>}
              <pre className="msg-code__body">
                <code>{block.code}</code>
              </pre>
            </figure>
          );
        }
        if (block.kind === 'math') {
          return (
            <div key={i} className="msg-math">
              <Equation tex={block.tex} display />
            </div>
          );
        }
        return <Fragment key={i}>{renderMdLines(block.lines, `b${i}`)}</Fragment>;
      })}
    </>
  );
}
