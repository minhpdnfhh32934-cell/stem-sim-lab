import { describe, expect, it } from 'vitest';
import { markdownToScript } from './fromMarkdown';
import { BOARD_W, COLUMNS, emptyLayout, overlaps, place, spanBox, type Measure } from './layout';
import { boardAnswerText, scriptFor, subtitleText } from './lesson';
import { compileFn, sample } from './plot';
import { checkNumbers, evaluate, toArithmetic } from './provenance';
import { circle, rng } from './rough';
import { ZONES, parseTeachScript, type BoardAction } from './teachscript';
import { forceAngle } from './diagram';

/** Test measure: 0.5 em per character, formulas 0.6 em per character. */
const measure: Measure = {
  text: (s, px) => s.length * px * 0.5,
  math: (tex, px) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
};

describe('TeachScript reader', () => {
  it('separates speech from board actions and anchors them in their sentence', () => {
    const r = parseTeachScript(
      'Ta có <write id="f1" zone="steps" math="true">a = \\frac{F}{m}</write> nhé. <circle target="f1"/>Đây là chỗ hay nhầm.',
    );
    expect(r.hasBoard).toBe(true);
    expect(r.sentences.map((s) => s.speech)).toEqual(['Ta có nhé.', 'Đây là chỗ hay nhầm.']);
    const [first, second] = r.sentences;
    expect(first?.actions[0]).toMatchObject({
      at: 6,
      action: { kind: 'write', id: 'f1', zone: 'steps', math: true, text: 'a = \\frac{F}{m}' },
    });
    expect(second?.actions[0]?.action).toEqual({ kind: 'mark', mark: 'circle', target: 'f1' });
  });

  it('never throws on broken markup and keeps every spoken word', () => {
    const soup = [
      'Câu một <write id="a1">chưa đóng',
      '<<<>>> a < b và <foo bar="x">chữ</foo> còn lại.',
      '<write id="BAD ID">x</write> <circle/> <draw id="d1" type="free_body" spec="{not json}"/>',
      '<write zone="nowhere" id="w2" role="weird">ok</write>',
      '\u0000\u0001 <pause ms="99999"/> hết.',
    ];
    for (const s of soup) {
      const r = parseTeachScript(s);
      expect(Array.isArray(r.sentences)).toBe(true);
    }
    const kept = parseTeachScript('a < b và <foo bar="x">chữ</foo> còn lại.');
    expect(kept.sentences.map((s) => s.speech).join(' ')).toBe('a < b và chữ còn lại.');
    expect(kept.diagnostics.some((d) => d.code === 'unknown_tag')).toBe(true);
    const fallback = parseTeachScript('<write zone="nowhere" id="w2" role="weird">ok</write>');
    expect(fallback.sentences[0]?.actions[0]?.action).toMatchObject({ zone: 'main', role: 'body' });
  });

  it('removes coordinates the AI might try to give', () => {
    const r = parseTeachScript(
      '<draw id="d1" type="free_body" x="10" spec=\'{"forces":["P"],"left":30}\'/>',
    );
    const action = r.sentences[0]?.actions[0]?.action;
    expect(action).toEqual({
      kind: 'draw',
      id: 'd1',
      zone: 'diagram',
      type: 'free_body',
      spec: { forces: ['P'] },
    });
    expect(r.diagnostics.filter((d) => d.code === 'coordinates_removed')).toHaveLength(2);
  });

  it('reads plots, corrections and new boards', () => {
    const r = parseTeachScript(
      '<plot id="p1" fn="x^2" domain="-2..2"/> Sửa: <correct target="f1">a = 5</correct> <newboard title="Phần 2"/>',
    );
    const kinds = r.sentences.flatMap((s) => s.actions.map((a) => a.action.kind));
    expect(kinds).toEqual(['plot', 'correct', 'newboard']);
  });
});

describe('markdown answers on the board', () => {
  it('lays out heading, given data, steps, formulas, keywords and a boxed result', () => {
    const md = [
      '## Định luật II Newton',
      'Cho: m = 2 kg, F = 10 N',
      '1. Áp dụng **định luật II**: $a = F/m$',
      '$$a = \\frac{10}{2} = 5\\ \\text{m/s}^2$$',
      'Đáp số: a = 5 m/s²',
      'Lưu ý: đổi đơn vị trước khi thay số.',
    ].join('\n');
    const r = markdownToScript(md);
    const actions = r.sentences.flatMap((s) => s.actions.map((a) => a.action));
    const writes = actions.filter(
      (a): a is Extract<BoardAction, { kind: 'write' }> => a.kind === 'write',
    );
    expect(writes.map((w) => [w.zone, w.role])).toEqual([
      ['title', 'heading'],
      ['side_notes', 'body'],
      ['steps', 'body'],
      ['main', 'body'],
      ['steps', 'result'],
      ['side_notes', 'note'],
    ]);
    expect(actions).toContainEqual({
      kind: 'mark',
      mark: 'underline',
      target: 's1',
      span: 'định luật II',
    });
    expect(actions).toContainEqual({ kind: 'mark', mark: 'box', target: 'r1' });
  });

  it('speaks long paragraphs instead of copying them onto the board', () => {
    const long = `Lực ma sát ${'xuất hiện khi hai bề mặt trượt lên nhau và '.repeat(5)}có công thức $F = \\mu N$.`;
    const r = markdownToScript(long);
    const writes = r.sentences.flatMap((s) => s.actions).map((a) => a.action);
    expect(writes).toEqual([
      {
        kind: 'write',
        id: 'm1',
        zone: 'main',
        role: 'body',
        math: true,
        text: 'F = \\mu N',
        speed: 'normal',
      },
    ]);
    expect(r.sentences[0]?.speech).toContain('Lực ma sát');
  });

  it('turns tables into a table drawing', () => {
    const r = markdownToScript('| Đại lượng | Đơn vị |\n|---|---|\n| Lực | N |');
    expect(r.sentences[0]?.actions[0]?.action).toMatchObject({
      kind: 'draw',
      type: 'table',
      spec: { header: ['Đại lượng', 'Đơn vị'], rows: [['Lực', 'N']] },
    });
  });

  it('uses TeachScript when the answer has tags, otherwise the markdown layout', () => {
    expect(scriptFor('<write id="a1">x</write>').sentences[0]?.actions).toHaveLength(1);
    expect(scriptFor('# Tiêu đề').hasBoard).toBe(true);
    expect(boardAnswerText('Ta có <write id="f1" math="true">a = 1</write>.')).toBe(
      'Ta có .\n$$a = 1$$',
    );
    expect(subtitleText('Ta có $a = \\frac{F}{m}$ nhé')).toBe('Ta có a = F/m nhé');
  });
});

describe('board layout (deterministic, never overlapping)', () => {
  it('places a long random lesson without any overlap and inside the board', () => {
    const r = rng(42);
    const layout = emptyLayout();
    const zones = ZONES;
    for (let i = 0; i < 400; i++) {
      const pick = r();
      let action: BoardAction;
      if (pick < 0.06)
        action = { kind: 'newboard', ...(r() < 0.5 ? { title: `Phần ${String(i)}` } : {}) };
      else if (pick < 0.16)
        action = {
          kind: 'draw',
          id: `d${String(i)}`,
          zone: 'diagram',
          type: r() < 0.5 ? 'table' : 'free_body',
          spec: { header: ['A', 'B'], rows: [['1', '2']], forces: ['P', 'N'] },
        };
      else {
        const words = Array.from(
          { length: 1 + Math.floor(r() * 30) },
          (_, k) => `từ${String(k)}`,
        ).join(' ');
        action = {
          kind: 'write',
          id: `w${String(i)}`,
          zone: zones[Math.floor(r() * zones.length)] ?? 'main',
          role: r() < 0.2 ? 'heading' : 'body',
          math: r() < 0.25,
          text: r() < 0.25 ? 'x'.repeat(1 + Math.floor(r() * 90)) : words,
          speed: 'normal',
          ...(r() < 0.2 && i > 0 ? { noteFor: `w${String(i - 1)}` } : {}),
        };
      }
      place(layout, action, measure);
    }
    const els = layout.elements;
    expect(els.length).toBeGreaterThan(300);
    for (const e of els) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x + e.w).toBeLessThanOrEqual(BOARD_W);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y + e.h).toBeLessThanOrEqual(layout.faces[e.face]?.height ?? 0);
      if (e.kind === 'text') expect(e.fontSize * e.scale).toBeGreaterThanOrEqual(25 * 0.6);
    }
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i];
        const b = els[j];
        if (a && b && a.face === b.face) expect(overlaps(a, b), `${a.id} / ${b.id}`).toBe(false);
      }
    }
  });

  it('puts notes next to what they explain and keeps ids unique', () => {
    const layout = emptyLayout();
    place(
      layout,
      {
        kind: 'write',
        id: 'f1',
        zone: 'steps',
        role: 'body',
        math: true,
        text: 'a = F/m',
        speed: 'normal',
      },
      measure,
    );
    const { element: note } = place(
      layout,
      {
        kind: 'write',
        id: 'f1',
        zone: 'side_notes',
        role: 'note',
        math: false,
        text: 'gia tốc',
        speed: 'normal',
        noteFor: 'f1',
      },
      measure,
    );
    expect(note?.id).toBe('f1_2');
    expect(note?.x).toBe(COLUMNS.side.x);
    expect(note?.y).toBe(layout.elements[0]?.y);
  });

  it('finds the exact words to underline', () => {
    const layout = emptyLayout();
    const { element } = place(
      layout,
      {
        kind: 'write',
        id: 's1',
        zone: 'steps',
        role: 'body',
        math: false,
        text: 'Áp dụng định luật II',
        speed: 'normal',
      },
      measure,
    );
    if (!element) throw new Error('not placed');
    const box = spanBox(element, 'định luật II', measure);
    expect(box.x).toBeGreaterThan(element.x);
    expect(box.w).toBeCloseTo('định luật II'.length * 30 * 0.5);
  });
});

describe('number provenance', () => {
  it('checks the arithmetic written on the board', () => {
    expect(evaluate('10/2')).toBe(5);
    expect(evaluate('(3+4)*2^2')).toBe(28);
    expect(evaluate('sqrt(2*9,8*20)')).toBeCloseTo(19.799, 2);
    expect(evaluate('F/m')).toBeNull();
    expect(toArithmetic('\\frac{72}{3{,}6}')).toBe('((72)/(3,6))');
    const ok = checkNumbers('v = \\frac{72}{3{,}6} = 20\\ \\text{m/s}', [72], []);
    expect(ok.status).toBe('checked');
    expect(ok.results).toContain(20);
  });

  it('flags a number that is neither given nor computed on the board', () => {
    const wrong = checkNumbers('v = 72/3,6 = 25 m/s', [72], []);
    expect(wrong.status).toBe('unverified');
    expect(wrong.numbers.find((n) => n.value === 25)?.status).toBe('unverified');
    expect(checkNumbers('m = 2 kg, F = 10 N', [2, 10], []).status).toBe('given');
    // A result proved earlier may be used later.
    expect(checkNumbers('s = 20 \\cdot 5', [], [20]).status).toBe('checked');
  });
});

describe('plots and drawings', () => {
  it('computes curves from the formula, never from typed points', () => {
    expect(compileFn('2x^2 - 3x + 1')?.(2)).toBe(3);
    expect(compileFn('sin(pi/2)')?.(0)).toBeCloseTo(1);
    expect(compileFn('alert(1)')).toBeNull();
    expect(compileFn('x;')).toBeNull();
    const s = sample('1/x', [-1, 1], 10);
    expect(s?.points.every(([, y]) => Number.isFinite(y))).toBe(true);
  });

  it('draws forces in their usual directions', () => {
    expect(forceAngle('P')).toBeCloseTo(Math.PI / 2);
    expect(forceAngle('N')).toBeCloseTo(-Math.PI / 2);
    expect(forceAngle('Fms')).toBeCloseTo(Math.PI);
    expect(forceAngle('F')).toBe(0);
    expect(forceAngle('phản lực')).toBeCloseTo(-Math.PI / 2);
  });

  it('draws the same hand-drawn circle for the same element', () => {
    const box = { x: 10, y: 10, w: 100, h: 30 };
    expect(circle(box, 7)).toBe(circle(box, 7));
    expect(circle(box, 7)).not.toBe(circle(box, 8));
  });
});
