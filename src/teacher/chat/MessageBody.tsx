import { Fragment, type ReactNode } from 'react';
import { Equation } from '@/science-card/Equation';
import { parseMessage } from './messageParse';

function renderInline(text: string, keyPrefix: string): ReactNode[] {
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
          out.push(
            <a key={`${keyPrefix}-l${i}-${j}-${k}`} href={link[2]} target="_blank" rel="noreferrer">
              {renderEmphasis(link[1] ?? '', `${keyPrefix}-l${i}-${j}-${k}`)}
            </a>,
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
  let list: string[] | null = null;
  const flushList = () => {
    if (list) {
      const items = list;
      list = null;
      out.push(
        <ul key={`${keyPrefix}-ul${out.length}`} className="msg-list">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item, `${keyPrefix}-li${out.length}-${i}`)}</li>
          ))}
        </ul>,
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
    const numberedItem = /^(\d+)[.)]\s+([\s\S]*)$/.exec(trimmed)?.[2];
    const itemText = dashItem ?? numberedItem ?? null;
    if (itemText !== null) {
      (list ??= []).push(itemText);
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
