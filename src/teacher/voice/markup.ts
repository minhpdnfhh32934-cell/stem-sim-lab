/**
 * The tags the teacher's voice removes before reading: TeachScript (the board's own tags,
 * docs/TEACHSCRIPT.md), the speech tags a model sometimes writes (SSML), and a short list of HTML.
 * Only these: anything else between "<" and ">" is text, such as a comparison written without
 * spaces ("x<y khi y>0", "a<b and c>d"), and is read. An attribute always has a value
 * (`id="t1"`; a ">" inside a quoted value does not end the tag), so "<b and c>" is not a tag.
 */
import { TEACHSCRIPT_TAGS } from '@/teacher/board/teachscript';

/** SSML a model may add to a reply. */
const SPEECH_TAGS = ['speak', 'break', 'emphasis', 'say-as', 'phoneme', 'voice', 'audio', 's', 'p'];

/** HTML that separates words (a line, a cell, a block): replaced by a space. */
const BLOCK_HTML = [
  'br',
  'hr',
  'p',
  'div',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
  'blockquote',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'img',
  'section',
  'figure',
  'figcaption',
  'details',
  'summary',
];

/** HTML inside a word or a formula ("H<sub>2</sub>O", "<b>gia</b> tốc"): removed outright. */
const INLINE_HTML = [
  'b',
  'i',
  'u',
  's',
  'em',
  'strong',
  'sub',
  'sup',
  'span',
  'small',
  'mark',
  'code',
  'del',
  'ins',
  'kbd',
  'abbr',
  'cite',
  'q',
  'a',
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Attributes, each with a value: `id="t1"`, `spec='{"a":"x > y"}'`, `zone=main`. */
const ATTRIBUTES = String.raw`(?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))*`;

function tagPattern(names: readonly string[]): RegExp {
  const alternatives = [...new Set(names)]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|');
  return new RegExp(String.raw`<\/?(?:${alternatives})(?![\w-])${ATTRIBUTES}\s*\/?>`, 'gi');
}

const SPACED = tagPattern([...TEACHSCRIPT_TAGS, ...SPEECH_TAGS, ...BLOCK_HTML]);
const INLINE = tagPattern(INLINE_HTML.filter((t) => !SPEECH_TAGS.includes(t)));

/** Removes the known tags, keeping the words between them. */
export function stripTags(text: string): string {
  return text.replace(SPACED, ' ').replace(INLINE, '');
}
