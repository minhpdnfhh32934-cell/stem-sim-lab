/**
 * Turns one AI Teacher answer into a lesson for the board: a title and numbered steps.
 *
 * Nothing new is generated here — the board shows exactly the answer's text, split along its
 * own structure (heading, list items, paragraphs; a formula or code block stays with the
 * sentence that introduces it). Each step stays markdown and is drawn with `MessageBody`.
 */
import { parseMessage } from '@/teacher/chat/MessageBody';

export interface Lesson {
  title: string;
  /** Markdown of each step, in order. */
  steps: string[];
}

/** Longest title taken from the learner's question when the answer has no heading. */
const TITLE_CHARS = 90;

interface OpenStep {
  text: string;
  /** Opened by a heading: collects everything until the next heading. */
  heading: boolean;
  /** Ends with a formula or code block: the next sentence starts a new paragraph. */
  afterBlock: boolean;
}

export function toLesson(content: string, fallbackTitle: string): Lesson {
  let title = '';
  const steps: string[] = [];
  /** The step being written (an object, so the helpers below can replace it). */
  const open: { step: OpenStep | null } = { step: null };
  const close = () => {
    const text = open.step?.text.trim();
    if (text) steps.push(text);
    open.step = null;
  };
  const start = (text: string, heading: boolean) => {
    close();
    open.step = { text, heading, afterBlock: false };
  };
  const appendBlock = (markdown: string) => {
    if (open.step) {
      open.step.text = `${open.step.text}\n\n${markdown}`;
      open.step.afterBlock = true;
    } else {
      open.step = { text: markdown, heading: false, afterBlock: true };
    }
  };

  for (const block of parseMessage(content)) {
    if (block.kind === 'math') {
      appendBlock(`$$${block.tex}$$`);
      continue;
    }
    if (block.kind === 'code') {
      appendBlock(`\`\`\`${block.lang}\n${block.code}\n\`\`\``);
      continue;
    }
    for (const raw of block.lines) {
      const line = raw.trim();
      const heading = /^#{1,4}\s+(.*)$/.exec(line)?.[1]?.replace(/\*\*/g, '').trim();
      if (heading !== undefined) {
        if (!title && steps.length === 0 && !open.step) title = heading;
        else start(`**${heading}**`, true);
        continue;
      }
      const item = /^(?:[-*]|\d+[.)])\s+(.*)$/.exec(line)?.[1];
      const step = open.step;
      if (item !== undefined) {
        // A list item is its own step, unless it sits under a heading step.
        if (step?.heading) {
          step.text = `${step.text}\n- ${item}`;
          step.afterBlock = false;
        } else start(item, false);
        continue;
      }
      if (line === '' || /^(-{3,}|\*{3,})$/.test(line)) {
        if (!step?.heading) close();
        continue;
      }
      if (!step) start(line, false);
      else {
        step.text = `${step.text}${step.heading || step.afterBlock ? '\n\n' : ' '}${line}`;
        step.afterBlock = false;
      }
    }
  }
  close();

  const fallback = fallbackTitle.trim().replace(/\s+/g, ' ');
  return {
    title:
      title ||
      (fallback.length > TITLE_CHARS ? `${fallback.slice(0, TITLE_CHARS - 1)}…` : fallback),
    steps,
  };
}
