import { describe, expect, it } from 'vitest';
import { parseTeachScript, type BoardAction } from './teachscript';

/**
 * Item 1: the TeachScript reader never loses lesson text (docs/TEACHSCRIPT.md §6). A `<write>`
 * with a broken or missing id is repaired, an unclosed one ends with its sentence, a comparison
 * is never read as a tag, and a tag cut at the end of an answer is never spoken.
 */

type Write = Extract<BoardAction, { kind: 'write' }>;

const read = (input: string) => {
  const r = parseTeachScript(input);
  return {
    r,
    writes: r.sentences.flatMap((s) =>
      s.actions.flatMap((a): Write[] => (a.action.kind === 'write' ? [a.action] : [])),
    ),
    said: r.sentences.map((s) => s.spoken).join(' '),
    speech: r.sentences.map((s) => s.speech).join(' '),
  };
};

describe('a <write> with a broken or missing id keeps its text', () => {
  it('repairs the id: lower case, "-" → "_"', () => {
    const { writes, r } = read(
      'Ta có <write id="S1" zone="steps">a = 2</write>, rồi <write id="step-2" zone="steps">b = 3</write>.',
    );
    expect(writes.map((w) => [w.id, w.text])).toEqual([
      ['s1', 'a = 2'],
      ['step_2', 'b = 3'],
    ]);
    expect(r.diagnostics.filter((d) => d.code === 'id_repaired')).toHaveLength(2);
  });

  it('gives an automatic id that no other write of the answer uses', () => {
    const { writes } = read(
      '<write zone="steps">a = F/m</write>. Rồi <write id="auto1" zone="steps">F = 10 N</write> và <write id="1x">m = 2 kg</write>.',
    );
    expect(writes.map((w) => w.text)).toEqual(['a = F/m', 'F = 10 N', 'm = 2 kg']);
    const ids = writes.map((w) => w.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[1]).toBe('auto1');
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('a <correct> with nothing to correct is said instead', () => {
    const { r, said } = read('Sửa lại: <correct>a = 5 m/s²</correct>.');
    expect(r.sentences.flatMap((s) => s.actions)).toEqual([]);
    expect(said).toContain('a = 5 m/s²');
  });
});

describe('an unclosed <write> ends with its sentence', () => {
  it('at the end of the answer', () => {
    const { writes, speech } = read(
      'Ta có <write id="s1" zone="steps">a = 2 m/s². Tiếp theo ta tính quãng đường đi được.',
    );
    expect(writes.map((w) => w.text)).toEqual(['a = 2 m/s².']);
    expect(speech).toContain('Tiếp theo ta tính quãng đường đi được.');
  });

  it('when the next write opens, and at a line break', () => {
    const { writes, speech } = read(
      'Ta có <write id="s1" zone="steps">a = 2\nrồi nói tiếp <write id="s2" zone="steps">b = 3</write>.',
    );
    expect(writes.map((w) => w.text)).toEqual(['a = 2', 'b = 3']);
    expect(speech).toContain('rồi nói tiếp');
  });

  it('a step number does not end it', () => {
    const { writes } = read('<write id="s1" zone="steps">1. Cho m = 2 kg');
    expect(writes.map((w) => w.text)).toEqual(['1. Cho m = 2 kg']);
  });
});

describe('"<" starts a tag only where a tag can stand', () => {
  it('"$x<y$ và $y>z$" keeps every character', () => {
    const { writes, speech, r } = read(
      'Vì $x<y$ và $y>z$ nên ta viết <write id="s1" zone="steps">x<y, y>z</write>.',
    );
    expect(speech).toContain('$x<y$ và $y>z$');
    expect(writes.map((w) => w.text)).toEqual(['x<y, y>z']);
    expect(r.diagnostics.map((d) => d.code)).not.toContain('bad_attribute');
  });

  it('an unknown tag that reads as one is still dropped, its words kept', () => {
    const { speech, r } = read('Nước là H<sub>2</sub>O và <foo bar="x">chữ</foo> còn lại.');
    expect(speech).toBe('Nước là H2O và chữ còn lại.');
    expect(r.diagnostics.map((d) => d.code)).toContain('unknown_tag');
  });

  it('a TeachScript tag with malformed attributes is dropped (§6)', () => {
    const { writes, r } = read('Ta có <write id=s1>a = 2</write>.');
    expect(writes).toEqual([]);
    expect(r.diagnostics).toContainEqual({ code: 'bad_attribute', tag: 'write' });
  });
});

describe('a tag cut at the end of an answer (output limit) is never said', () => {
  it.each([
    'Câu hai <write id="b1" zone="ste',
    'Câu hai <write',
    'Câu hai <wri',
    'Câu hai </wri',
    'Câu hai <box target="b',
  ])('%s', (input) => {
    const { said, r } = read(input);
    expect(said).toBe('Câu hai');
    expect(r.diagnostics.map((d) => d.code)).toContain('unclosed_tag');
  });

  it('a comparison at the end is text', () => {
    expect(read('Vì x<y').said).toBe('Vì x<y');
  });
});

describe('sentences know where they stand in the source', () => {
  it('from their first word or tag to just after their last', () => {
    const input =
      'Câu một. Câu hai <write id="a1" zone="steps">x = 1</write>. <pause ms="300"/>Ba &lt; bốn.';
    const r = parseTeachScript(input);
    const ranges = r.sentences.map((s) => [s.start, s.end]);
    expect(ranges).toEqual([
      [0, 8],
      [9, input.indexOf('</write>.') + '</write>.'.length],
      [input.indexOf('Ba'), input.length],
    ]);
  });
});
