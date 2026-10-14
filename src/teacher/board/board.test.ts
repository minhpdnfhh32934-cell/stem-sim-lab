import { describe, expect, it } from 'vitest';
import { markdownToScript } from './fromMarkdown';
import {
  BOARD_W,
  COLUMNS,
  FONT,
  emptyLayout,
  overlaps,
  place,
  spanBox,
  type Measure,
  type TextElement,
} from './layout';
import { splitFormula } from './formulaSplit';
import { boardAnswerText, scriptFor, subtitleText } from './lesson';
import { rescaleScroll, scrollForRow, visibleBand } from './minimap';
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

/**
 * The widest piece of an element at its smallest normal size (formulas at 60 %, a formula chain
 * by its pieces; words as they are), at the largest font its role may have.
 */
function widestAtSmallest(e: TextElement): number {
  const px = e.role === 'title' ? FONT.title : FONT[e.role];
  if (e.math) return Math.max(...splitFormula(e.source).map((p) => measure.math(p, px).w * 0.6));
  return Math.max(...e.source.split(/\s+/).map((word) => measure.text(word, px, false)));
}

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

  it('drops hidden reasoning whole: none of it is spoken or written (unlike other unknown tags)', () => {
    const everything = (input: string) => {
      const r = parseTeachScript(input);
      return {
        r,
        text: r.sentences
          .flatMap((s) => [s.speech, s.spoken, ...s.actions.map((a) => JSON.stringify(a.action))])
          .join(' '),
        ids: r.sentences.flatMap((s) =>
          s.actions.flatMap((a) => (a.action.kind === 'write' ? [a.action.id] : [])),
        ),
      };
    };
    const closed = everything(
      '<think>tính nháp</think> Ta có <write id="f1" math="true">a=1</write>.',
    );
    expect(closed.text).not.toContain('tính nháp');
    expect(closed.ids).toEqual(['f1']);
    expect(closed.r.diagnostics).toContainEqual({ code: 'reasoning_removed' });
    for (const input of [
      // Cut at the output limit inside the reasoning.
      'Ta có <write id="f1" zone="steps">a = 1</write>. <think>còn nháp <write id="x1">b = 2</write>',
      // The chat template pre-filled the opening tag.
      'nháp <write id="x1">b = 2</write> hết</think>Ta có <write id="f1" zone="steps">a = 1</write>.',
      // Other names, any case.
      '<REASONING>nháp</REASONING><reflection>b = 2</reflection>Ta có <write id="f1" zone="steps">a = 1</write>.',
    ]) {
      const { text, ids } = everything(input);
      expect(text).not.toMatch(/nháp|b = 2|hết/u);
      expect(ids).toEqual(['f1']);
    }
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

describe('answers are cleaned before the board and the chat copy', () => {
  const written = (content: string, reviewed = false) =>
    scriptFor(content, { reviewed }).sentences.flatMap((s) =>
      s.actions.flatMap((a) => (a.action.kind === 'write' ? [a.action.text] : [])),
    );
  const said = (content: string, reviewed = false) =>
    scriptFor(content, { reviewed })
      .sentences.map((s) => s.spoken)
      .join(' ');

  it('an answer saved with hidden reasoning and an echoed label shows neither', () => {
    const content =
      '<think>thử m = 7 kg</think>**GHI CHÚ:**\n# Định luật II\n1. Cho m = 2 kg, F = 10 N\n2. Vậy a = 5 m/s²';
    const all = [...written(content), said(content), boardAnswerText(content)].join(' ');
    expect(all).not.toMatch(/think|thử|7 kg|GHI CHÚ/u);
    expect(written(content)[0]).toBe('Định luật II');
    expect(written(content).join(' ')).toContain('Vậy a = 5 m/s²');
    // TeachScript answers too.
    const script = 'Ta có <write id="f1" zone="steps">a = 1</write>.<think>nháp</think>';
    expect(boardAnswerText(script)).not.toContain('nháp');
  });

  it('a Think answer saved with the reviewer notes teaches only the lesson', () => {
    const content =
      'Nhận xét về bản nháp: đúng hướng.\n\nBản đã sửa:\n# Rơi tự do\n1. Vật chỉ chịu trọng lực.';
    expect(written(content, true)[0]).toBe('Rơi tự do');
    const all = [...written(content, true), said(content, true)].join(' ');
    expect(all).not.toMatch(/bản nháp|Bản đã sửa/u);
    expect(boardAnswerText(content, { reviewed: true })).toBe(
      '# Rơi tự do\n1. Vật chỉ chịu trọng lực.',
    );
  });
});

describe('Think answers on the board (review round 1)', () => {
  const written = (content: string, question = '') =>
    scriptFor(content, { reviewed: true, question }).sentences.flatMap((s) =>
      s.actions.flatMap((a) => (a.action.kind === 'write' ? [a.action.text] : [])),
    );
  const said = (content: string, question = '') =>
    scriptFor(content, { reviewed: true, question })
      .sentences.map((s) => s.spoken)
      .join(' ');

  it('a one-paragraph TeachScript lesson with a remark in front keeps every write', () => {
    for (const remark of ['Bản nháp đã đúng.', 'The draft is correct.']) {
      const content = `${remark} Hôm nay mình xét bài <write id="t1" zone="title" role="heading">Rơi tự do</write>. Ta có <write id="s1" zone="steps">h = 20 m</write>, nên <write id="r1" zone="steps" role="result">v = 20 m/s</write>.`;
      expect(written(content)).toEqual(['Rơi tự do', 'h = 20 m', 'v = 20 m/s']);
      expect(said(content)).not.toMatch(/nháp|draft/iu);
      expect(boardAnswerText(content, { reviewed: true })).toContain('v = 20 m/s');
    }
  });

  it('a remark in the middle of the lesson is not cut, nor anything around it', () => {
    const content =
      'Hôm nay mình xét bài <write id="t1" zone="title" role="heading">Rơi tự do</write>. Bản nháp dùng g = 10, mình sửa thành <write id="s1" zone="steps">g = 9,8 m/s²</write>.';
    expect(written(content)).toEqual(['Rơi tự do', 'g = 9,8 m/s²']);
  });

  it("the learner's own draft: the feedback stays when the question asks about it", () => {
    const content =
      'Bản nháp đúng hướng nhưng thiếu đơn vị.\n\n# Rơi tự do\n1. Vật chỉ chịu trọng lực.';
    expect(said(content)).not.toContain('Bản nháp');
    expect(said(content, 'Xem giúp em bản nháp này')).toContain('Bản nháp đúng hướng');
    expect(boardAnswerText(content, { reviewed: true, question: 'check my draft' })).toBe(content);
  });

  it('a reasoning tag between backticks is code; a bare literal one is reasoning (pinned)', () => {
    const coded = parseTeachScript(
      'Thẻ `<think>` là mã. Ta viết <write id="s1" zone="steps">a = 2</write>.',
    );
    expect(coded.diagnostics.map((d) => d.code)).not.toContain('reasoning_removed');
    expect(coded.sentences.flatMap((s) => s.actions.map((a) => a.action.kind))).toEqual(['write']);
    // Without backticks "<think>" opens hidden reasoning, cut to the end when unclosed: the
    // shared rule (src/ai/reasoning.ts) cannot tell it from a model stopped mid-reasoning.
    const bare = parseTeachScript(
      'Ta viết <write id="s1">so sánh <think> trong code</write> và tiếp tục.',
    );
    expect(bare.diagnostics.map((d) => d.code)).toContain('reasoning_removed');
    expect(bare.sentences.map((s) => s.spoken).join(' ')).not.toContain('tiếp tục');
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
      // The box is the true width of the ink (item 3: no clamping), inside the margins.
      expect(e.x + e.w).toBeLessThanOrEqual(BOARD_W - 40);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y + e.h).toBeLessThanOrEqual(layout.faces[e.face]?.height ?? 0);
      if (e.kind !== 'text') continue;
      for (const line of e.lines) expect(line.w).toBeLessThanOrEqual(e.w);
      // Written smaller than usual only when even the whole board is too narrow for it.
      if (e.squeezed) expect(widestAtSmallest(e)).toBeGreaterThan(BOARD_W - 80);
      else expect(e.fontSize * e.scale).toBeGreaterThanOrEqual(25 * 0.6);
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

describe('board minimap geometry', () => {
  it('maps the scroll position to board units and back', () => {
    expect(visibleBand(300, 400, 0.5)).toEqual({ top: 600, height: 800 });
    // Row 1000 at scale 0.5 is 500 px down; centred in a 400 px viewport → 300.
    expect(scrollForRow(1000, 0.5, 400, 2000)).toBe(300);
    // Clamped at both ends.
    expect(scrollForRow(0, 0.5, 400, 2000)).toBe(0);
    expect(scrollForRow(5000, 0.5, 400, 2000)).toBe(1600);
  });

  it('a new scale keeps the board row in the middle of the view (resize, zoom), clamped', () => {
    const height = 4000; // board units
    const middle = (top: number, client: number, scale: number) => (top + client / 2) / scale;
    for (const start of [0, 350, 900, 1700]) {
      const row = middle(start, 400, 0.6);
      const bigger = rescaleScroll(start, 400, 0.6, 0.9, height * 0.9, 400);
      // Clamped at the top when the row is too close to it.
      if (row * 0.9 >= 200) expect(Math.abs(middle(bigger, 400, 0.9) - row) * 0.9).toBeLessThan(1);
      else expect(bigger).toBe(0);
      const back = rescaleScroll(bigger, 400, 0.9, 0.6, height * 0.6, 400);
      expect(Math.abs(back - start)).toBeLessThan(1);
    }
    // A taller view after the resize keeps the same row in its middle.
    const taller = rescaleScroll(900, 400, 0.6, 0.6, height * 0.6, 600);
    expect(middle(taller, 600, 0.6)).toBeCloseTo(middle(900, 400, 0.6));
    // Never past the end of the board, never above its top.
    expect(rescaleScroll(2000, 400, 0.6, 0.3, height * 0.3, 400)).toBe(height * 0.3 - 400);
    expect(rescaleScroll(10, 400, 0.9, 0.3, height * 0.3, 400)).toBe(0);
    // Sideways when zoomed: the same rule on the other axis.
    expect(rescaleScroll(0, 700, 0.6, 0.75, 1200 * 0.75, 700)).toBeCloseTo(
      (350 / 0.6) * 0.75 - 350,
    );
  });
});
