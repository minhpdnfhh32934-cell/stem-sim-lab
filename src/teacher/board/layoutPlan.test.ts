import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { splitFormula } from './formulaSplit';
import {
  BOARD_W,
  COLUMN_TOP,
  GUTTER,
  REGION_ORDER,
  TEMPLATES,
  boardRules,
  emptyLayout,
  overlaps,
  place,
  planFaces,
  regionUsage,
  templateFor,
  type BoardElement,
  type Layout,
  type Measure,
  type RegionId,
  type TemplateId,
  type TextElement,
} from './layout';
import { checkNumbers } from './provenance';
import { rng } from './rough';
import { ZONES, type BoardAction } from './teachscript';

/**
 * Item 3, "the AI Teacher uses the whole board": each face is divided by what it will hold
 * (wide / side + main / main + right / three regions), a zone the plan lacks goes in a full-width
 * band, boxes are the true width of the ink, long equality chains are written on several lines,
 * and nothing placed ever moves.
 */
vi.mock('@/teacher/voice/speak', () => ({
  newVoiceSession: () => ({ skipped: null }),
  speak: () => Promise.resolve(),
  stopSpeaking: () => undefined,
  toSpokenText: (text: string) => text,
}));

const lesson = await import('./lesson');
const { useBoardStore } = await import('./boardStore');

/** Test measure: 0.5 em per character, formulas 0.6 em per character. */
const measure: Measure = {
  text: (s, px) => s.length * px * 0.5,
  math: (tex, px) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
};

const write = (
  id: string,
  zone: Extract<BoardAction, { kind: 'write' }>['zone'],
  text: string,
  extra: Partial<Extract<BoardAction, { kind: 'write' }>> = {},
): BoardAction => ({
  kind: 'write',
  id,
  zone,
  role: 'body',
  math: false,
  text,
  speed: 'normal',
  ...extra,
});

const table = (id: string, cols: number, cell = 'ô'): BoardAction => ({
  kind: 'draw',
  id,
  zone: 'diagram',
  type: 'table',
  spec: {
    header: Array.from({ length: cols }, (_, i) => `${cell}${String(i)}`),
    rows: [Array.from({ length: cols }, () => cell)],
  },
});

/** Plans the actions (as a lesson run does), then places them all; marks are not placed. */
function plan(actions: readonly BoardAction[], layout: Layout = emptyLayout()): Layout {
  planFaces(layout, actions);
  for (const a of actions) place(layout, a, measure);
  return layout;
}

const actionsOf = (content: string) =>
  lesson.scriptFor(content).sentences.flatMap((s) => s.actions.map((a) => a.action));

const texts = (layout: Layout) =>
  layout.elements.filter((e): e is TextElement => e.kind === 'text' && e.role !== 'title');

/** Every invariant of a placed board (true ink widths, margins, no overlap, sizes). */
function expectSound(layout: Layout): void {
  const els = layout.elements;
  for (const e of els) {
    expect(e.x, e.id).toBeGreaterThanOrEqual(40);
    expect(e.x + e.w, e.id).toBeLessThanOrEqual(BOARD_W - 40);
    expect(e.y + e.h, e.id).toBeLessThanOrEqual(layout.faces[e.face]?.height ?? 0);
    if (e.kind === 'text') {
      for (const line of e.lines) expect(line.w, e.id).toBeLessThanOrEqual(e.w);
      if (!e.squeezed) expect(e.fontSize * e.scale, e.id).toBeGreaterThanOrEqual(15);
    }
  }
  for (let i = 0; i < els.length; i++)
    for (let j = i + 1; j < els.length; j++) {
      const a = els[i];
      const b = els[j];
      if (a && b && a.face === b.face) expect(overlaps(a, b), `${a.id} / ${b.id}`).toBe(false);
    }
  for (const [i, f] of layout.faces.entries()) {
    const bottom = Math.max(0, ...els.filter((e) => e.face === i).map((e) => e.y + e.h));
    expect(f.height).toBeGreaterThanOrEqual(bottom + 60);
  }
}

describe('face templates', () => {
  it('picks the plan from the regions a face uses', () => {
    expect(templateFor(new Set())).toBe('wide');
    expect(templateFor(new Set<RegionId>(['center']))).toBe('wide');
    expect(templateFor(new Set<RegionId>(['side']))).toBe('sideMain');
    expect(templateFor(new Set<RegionId>(['side', 'center']))).toBe('sideMain');
    expect(templateFor(new Set<RegionId>(['right']))).toBe('mainRight');
    expect(templateFor(new Set<RegionId>(['side', 'right']))).toBe('three');
  });

  it('every template stays inside the margins, in order, with a gutter between regions', () => {
    for (const regions of Object.values(TEMPLATES)) {
      const spans = REGION_ORDER.flatMap((r) => regions[r] ?? []);
      expect(regions.center).toBeDefined();
      for (const s of spans) {
        expect(s.x).toBeGreaterThanOrEqual(40);
        expect(s.x + s.w).toBeLessThanOrEqual(BOARD_W - 40);
      }
      for (let i = 1; i < spans.length; i++) {
        const prev = spans[i - 1];
        const next = spans[i];
        if (prev && next) expect(next.x - (prev.x + prev.w)).toBeGreaterThanOrEqual(GUTTER);
      }
    }
    // Faces nobody planned keep the familiar three columns.
    expect(emptyLayout().faces[0]?.template).toBe('three');
  });

  it('reads the regions of each face from the actions, split at each new board', () => {
    const usage = regionUsage([
      write('a', 'title', 'T'),
      write('b', 'steps', 'x'),
      { kind: 'correct', target: 'b', text: 'y' },
      { kind: 'newboard', title: 'P2' },
      { kind: 'plot', id: 'p', zone: 'side_notes', fn: 'x', domain: [0, 1] },
      { kind: 'newboard' },
      { ...table('t', 2), zone: 'title' } as BoardAction,
      { kind: 'mark', mark: 'box', target: 'b' },
    ]);
    expect(usage.map((s) => [...s].sort())).toEqual([['center', 'side'], ['right'], ['right']]);
  });

  it('plans the current face only while nothing but its title is on it; new boards in order', () => {
    const layout = emptyLayout();
    place(layout, write('h', 'title', 'Tiêu đề'), measure);
    planFaces(layout, [
      write('a', 'steps', 'x'),
      { kind: 'newboard' },
      write('s', 'side_notes', 'g'),
      { kind: 'newboard' },
      table('t', 2),
      write('n', 'side_notes', 'y'),
    ]);
    expect(layout.faces[0]?.template).toBe('wide');
    expect(layout.upcoming).toEqual<TemplateId[]>(['sideMain', 'three']);
    place(layout, write('a', 'steps', 'x'), measure);
    // Written: a later plan does not touch it.
    planFaces(layout, [write('s2', 'side_notes', 'g')]);
    expect(layout.faces[0]?.template).toBe('wide');
    expect(layout.upcoming).toEqual([]);
    planFaces(layout, [{ kind: 'newboard' }, write('s', 'side_notes', 'g'), { kind: 'newboard' }]);
    place(layout, { kind: 'newboard' }, measure);
    place(layout, { kind: 'newboard' }, measure);
    place(layout, { kind: 'newboard' }, measure);
    expect(layout.faces.map((f) => f.template)).toEqual(['wide', 'sideMain', 'wide', 'three']);
  });
});

describe('placement on planned faces', () => {
  const LONG_STEPS = [
    '# Rơi tự do',
    '1. Chọn gốc tọa độ tại mặt đất, chiều dương hướng lên, gốc thời gian lúc thả vật 0 s.',
    '2. Vật được thả rơi từ độ cao 45 m so với mặt đất, bỏ qua sức cản của không khí nha.',
    '3. Gia tốc rơi tự do lấy g = 10 m/s², vận tốc ban đầu của vật bằng 0 m/s khi thả ra.',
    '4. Quãng đường vật rơi được sau thời gian t giây là s = 5t² mét, tính từ lúc thả 0 s.',
    '5. Vật chạm đất khi quãng đường rơi được bằng đúng độ cao ban đầu là 45 m, nên t = 3 s.',
    '$$s = \\frac{1}{2} g t^2$$',
    '$$t = \\sqrt{\\frac{2h}{g}} = \\sqrt{\\frac{2 \\cdot 45}{10}} = 3\\ \\text{s}$$',
  ].join('\n');

  it('steps alone use the whole width: no strip in the middle (regression)', () => {
    const actions = actionsOf(LONG_STEPS);
    const layout = plan(actions);
    expect(layout.faces[0]?.template).toBe('wide');
    const body = texts(layout);
    expect(body.length).toBeGreaterThanOrEqual(7);
    for (const e of body) expect(e.x).toBe(40);
    expect(Math.max(...body.map((e) => e.x + e.w))).toBeGreaterThanOrEqual(0.85 * BOARD_W);
    // The same step on an unplanned face (the old 480-wide middle column) takes more lines.
    const step = body.find((e) => !e.math);
    const old = emptyLayout();
    const { element } = place(
      old,
      write('s', 'steps', step?.source ?? '', {
        role: step && step.role !== 'title' ? step.role : 'body',
      }),
      measure,
    );
    expect(element?.kind === 'text' && step && step.lines.length < element.lines.length).toBe(true);
    expectSound(layout);
  });

  it('given data on the left: side region at the margin, the steps right of it', () => {
    const layout = plan([
      write('h', 'title', 'Bài toán'),
      write('g', 'side_notes', 'Cho: m = 2 kg, F = 10 N'),
      write('s1', 'steps', 'Áp dụng định luật II Newton cho vật'),
      write('s2', 'steps', 'a = F/m = 5 m/s²'),
    ]);
    expect(layout.faces[0]?.template).toBe('sideMain');
    const side = TEMPLATES.sideMain.side;
    const g = layout.elements.find((e) => e.id === 'g');
    expect(g?.x).toBe(40);
    for (const e of layout.elements.filter((x) => x.column === 'center'))
      expect(e.x).toBeGreaterThanOrEqual((side?.x ?? 0) + (side?.w ?? 0) + GUTTER);
    expectSound(layout);
  });

  it('a table and a plot on the right, after the steps, inside the board', () => {
    const layout = plan([
      write('s1', 'steps', 'Bảng số liệu đo được'),
      table('t1', 3),
      { kind: 'plot', id: 'p1', zone: 'diagram', fn: 'x^2', domain: [0, 2] },
    ]);
    expect(layout.faces[0]?.template).toBe('mainRight');
    const center = TEMPLATES.mainRight.center;
    for (const e of layout.elements.filter((x) => x.kind === 'draw')) {
      expect(e.column).toBe('right');
      expect(e.x).toBeGreaterThanOrEqual((center?.x ?? 0) + (center?.w ?? 0) + GUTTER);
      expect(e.x + e.w).toBeLessThanOrEqual(BOARD_W - 40);
    }
    expectSound(layout);
  });

  it('the title on top, everything else below it; a second title becomes a heading', () => {
    const layout = plan([
      write('h1', 'title', 'Định luật II'),
      write('s1', 'steps', 'Một bước'),
      write('h2', 'title', 'Tiêu đề thứ hai'),
      write('g1', 'side_notes', 'ghi chú'),
    ]);
    const title = layout.elements.find((e) => e.id === 'h1');
    expect(title?.y).toBe(30);
    const face = layout.faces[0];
    for (const e of layout.elements.filter((x) => x.id !== 'h1'))
      expect(e.y).toBeGreaterThanOrEqual((face?.titleBottom ?? 0) + 24);
    const second = layout.elements.find((e) => e.id === 'h2');
    expect(second?.kind === 'text' && second.role).toBe('heading');
    expect(second?.column).toBe('center');
    expectSound(layout);
  });

  it('a zone the plan lacks ("Viết tiếp") goes in a full-width band below everything', () => {
    const layout = plan([write('h', 'title', 'Bài'), write('s1', 'steps', 'bước một')]);
    expect(layout.faces[0]?.template).toBe('wide');
    // The continuation brings a side note and a table the face was not planned for.
    const rest: BoardAction[] = [
      write('n1', 'side_notes', 'Lưu ý đổi đơn vị'),
      write('s2', 'steps', 'bước hai'),
      table('t1', 2),
      write('s3', 'steps', 'bước ba'),
    ];
    const before = Math.max(...layout.elements.map((e) => e.y + e.h));
    plan(rest, layout);
    const byId = (id: string) => layout.elements.find((e) => e.id === id);
    const note = byId('n1');
    expect(note?.column).toBe('band');
    expect(note?.x).toBe(40);
    expect(note?.y).toBeGreaterThanOrEqual(before);
    expect(byId('s2')?.y).toBeGreaterThanOrEqual((note?.y ?? 0) + (note?.h ?? 0));
    expect(byId('t1')?.column).toBe('band');
    expect(byId('s3')?.y).toBeGreaterThan(byId('t1')?.y ?? Infinity);
    expectSound(layout);
  });

  it('a long face: 60 writes in every zone never overlap and the face grows', () => {
    const layout = emptyLayout();
    const actions = Array.from({ length: 60 }, (_, i) =>
      write(
        `w${String(i)}`,
        ZONES[i % ZONES.length] ?? 'main',
        `dòng số ${String(i)} `.repeat(1 + (i % 7)),
      ),
    );
    planFaces(layout, actions);
    const heights: number[] = [];
    let cursors = { ...layout.faces[0]?.cursors };
    for (const a of actions) {
      place(layout, a, measure);
      const f = layout.faces[0];
      heights.push(f?.height ?? 0);
      for (const r of REGION_ORDER)
        expect(f?.cursors[r] ?? 0).toBeGreaterThanOrEqual(cursors[r] ?? 0);
      cursors = { ...f?.cursors };
    }
    expect(heights.at(-1)).toBeGreaterThan(heights[0] ?? Infinity);
    expectSound(layout);
  });

  it('places random lessons planned face by face (and continued part way) without overlap', () => {
    const r = rng(7);
    const seen = new Set<TemplateId>();
    for (let lessonNo = 0; lessonNo < 40; lessonNo++) {
      const actions: BoardAction[] = [];
      const n = 10 + Math.floor(r() * 50);
      for (let i = 0; i < n; i++) {
        const pick = r();
        const id = `x${String(i)}`;
        if (pick < 0.06) actions.push({ kind: 'newboard', ...(r() < 0.5 ? { title: 'P' } : {}) });
        else if (pick < 0.14)
          actions.push(
            r() < 0.5
              ? table(id, 1 + Math.floor(r() * 9), 'ô'.repeat(1 + Math.floor(r() * 6)))
              : { kind: 'draw', id, zone: 'diagram', type: 'free_body', spec: { forces: ['P'] } },
          );
        else if (pick < 0.18)
          actions.push({ kind: 'correct', target: `x${String(i - 1)}`, text: 'sửa lại' });
        else {
          const math = r() < 0.3;
          const text = math
            ? Array.from(
                { length: 1 + Math.floor(r() * 6) },
                (_, k) => `a_${String(k)} + ${'b'.repeat(Math.floor(r() * 40))}`,
              ).join(' = ')
            : Array.from({ length: 1 + Math.floor(r() * 25) }, (_, k) => `từ${String(k)}`).join(
                ' ',
              );
          actions.push(
            write(id, ZONES[Math.floor(r() * ZONES.length)] ?? 'main', text, {
              math,
              role: r() < 0.15 ? 'heading' : r() < 0.2 ? 'note' : 'body',
              ...(r() < 0.2 && i > 0 ? { noteFor: `x${String(i - 1)}` } : {}),
            }),
          );
        }
      }
      // Taught in one go, or in two parts ("Viết tiếp"): the second part is planned on its own.
      const cut = r() < 0.5 ? actions.length : Math.floor(r() * actions.length);
      const layout = plan(actions.slice(0, cut));
      plan(actions.slice(cut), layout);
      for (const f of layout.faces) seen.add(f.template);
      expectSound(layout);
    }
    expect([...seen].sort()).toEqual(['mainRight', 'sideMain', 'three', 'wide']);
  });

  it('the same lesson is laid out the same way every time ("Giảng lại")', () => {
    const actions = actionsOf(LONG_STEPS);
    expect(plan(actions)).toEqual(plan(actions));
  });

  it('"Viết tiếp" never moves what is already written', () => {
    const actions = [
      write('h', 'title', 'Bài'),
      write('s1', 'steps', 'bước một có chữ dài dài dài'),
      write('n1', 'side_notes', 'ghi chú'),
      { kind: 'newboard', title: 'Phần 2' } as BoardAction,
      write('s2', 'steps', 'bước hai'),
      table('t1', 2),
      write('s3', 'steps', 'bước ba'),
    ];
    for (let cut = 1; cut < actions.length; cut++) {
      const layout = plan(actions.slice(0, cut));
      const boxes = structuredClone(layout.elements);
      plan(actions.slice(cut), layout);
      expect(layout.elements.slice(0, boxes.length)).toEqual(boxes);
      expectSound(layout);
    }
  });

  it('each face is planned from its own part of the lesson', () => {
    const layout = plan([
      write('h', 'title', 'Phần 1'),
      write('s1', 'steps', 'bước một'),
      { kind: 'newboard', title: 'Phần 2' },
      write('g', 'side_notes', 'Cho: h = 20 m'),
      write('s2', 'steps', 'bước hai'),
      table('t1', 2),
    ]);
    expect(layout.faces.map((f) => f.template)).toEqual(['wide', 'three']);
    const three = TEMPLATES.three;
    const on1 = (id: string) => layout.elements.find((e) => e.id === id);
    expect(on1('s1')?.x).toBe(40);
    expect(on1('g')?.x).toBe(three.side?.x);
    expect(on1('s2')?.x).toBe(three.center?.x);
    expect(on1('t1')?.x).toBe(three.right?.x);
  });
});

describe('long formulas and drawings', () => {
  const CHAIN = 'a = \\frac{F}{m} = \\frac{10}{2} = 5\\ \\text{m/s}^2';

  it('a long equality chain is written on several lines inside its region, the source whole', () => {
    const layout = emptyLayout(); // the 480-wide middle of an unplanned face
    const { element } = place(layout, write('f', 'main', CHAIN, { math: true }), measure);
    if (element?.kind !== 'text') throw new Error('not placed');
    expect(element.column).toBe('center');
    expect(element.lines.length).toBeGreaterThanOrEqual(2);
    for (const line of element.lines) expect(line.w).toBeLessThanOrEqual(480);
    expect(element.source).toBe(CHAIN);
    // One pen unit per piece; the pieces are the formula, nothing changed.
    const pieces = element.lines.flatMap((l) => l.tokens.map((t) => t.value));
    expect(pieces.join('')).toBe(CHAIN);
    expect(element.length).toBe(pieces.length);
    expect(element.scale).toBe(1);
    // The number check reads the source: the same as for the formula written whole.
    expect(checkNumbers(element.source, [10, 2], [])).toEqual(checkNumbers(CHAIN, [10, 2], []));
    // A continuation line starts indented, the way a teacher lines up the "=".
    expect(element.lines[1]?.tokens[0]?.space).toBeGreaterThan(0);
  });

  it('a list of givens is written one statement per line, never "name" over "= value"', () => {
    const GIVENS = 'v_0 = 0,\\quad a = 2\\ \\text{m/s}^2,\\quad t = 3\\ \\text{s},\\quad s = ?';
    for (const zone of ['main', 'side_notes'] as const) {
      const { element } = place(emptyLayout(), write('g', zone, GIVENS, { math: true }), measure);
      if (element?.kind !== 'text') throw new Error('not placed');
      expect(element.lines.length, zone).toBeGreaterThanOrEqual(2);
      // Every line starts with the name of what it gives, none with a relation.
      for (const line of element.lines)
        expect(line.tokens[0]?.value.trim(), zone).toMatch(/^[a-z]/i);
      expect(element.lines.flatMap((l) => l.tokens.map((t) => t.value)).join('')).toBe(GIVENS);
      expect(element.source).toBe(GIVENS);
      // A new statement is not indented like a chain's continuation.
      for (const line of element.lines) expect(line.tokens[0]?.space).toBe(0);
    }
  });

  it('a negated relation is written whole on its line', () => {
    const tex = 'a \\not= b \\not= c \\not= d \\not= e \\not= f \\not= g \\not= h \\not= i';
    const { element } = place(emptyLayout(), write('n', 'main', tex, { math: true }), measure);
    if (element?.kind !== 'text') throw new Error('not placed');
    expect(element.lines.length).toBeGreaterThanOrEqual(2);
    for (const line of element.lines) {
      const values = line.tokens.map((t) => t.value);
      expect(values.join('').trimEnd()).not.toMatch(/\\not$/);
      for (const v of values.slice(1)) expect(v.trimStart()).toMatch(/^\\not/);
    }
    expect(element.lines.flatMap((l) => l.tokens.map((t) => t.value)).join('')).toBe(tex);
  });

  it('a short formula, or one that fits, stays on one line', () => {
    const { element } = place(
      emptyLayout(),
      write('f', 'main', 's = \\frac{1}{2} g t^2', { math: true }),
      measure,
    );
    expect(element?.kind === 'text' && element.lines.length).toBe(1);
  });

  it('a tall formula takes its height; the next line starts below it', () => {
    const rows = (tex: string) => (tex.match(/\\\\/g)?.length ?? 0) + 1;
    const tall: Measure = {
      text: (s, px, heading) => measure.text(s, px, heading),
      math: (tex, px) => ({ w: 200, h: px * 1.3 * rows(tex) }),
    };
    const layout = emptyLayout();
    const tex = '\\begin{aligned} a &= b \\\\ &= c \\\\ &= d \\\\ &= e \\end{aligned}';
    const { element: f } = place(layout, write('f', 'main', tex, { math: true }), tall);
    const { element: next } = place(layout, write('n', 'steps', 'sau'), tall);
    if (!f || !next) throw new Error('not placed');
    expect(f.h).toBeGreaterThanOrEqual(30 * 1.3 * 4);
    expect(next.y).toBeGreaterThanOrEqual(f.y + f.h + 18);
  });

  it('an unsplittable formula too wide for its region moves to a band; too wide for the board, it is squeezed', () => {
    const layout = emptyLayout();
    // 50 characters × 18 = 900 units: over 480 at 60 % (540), under 1120.
    const wide = 'x'.repeat(50);
    const { element: band } = place(layout, write('w', 'main', wide, { math: true }), measure);
    expect(band?.column).toBe('band');
    expect(band?.x).toBe(40);
    expect(band?.kind === 'text' && !band.squeezed && band.scale).toBe(1);
    // 120 characters × 18 = 2160: over 1120 even at 60 % (1296).
    const huge = 'y'.repeat(120);
    const { element: squeezed } = place(layout, write('z', 'main', huge, { math: true }), measure);
    expect(squeezed?.kind === 'text' && squeezed.squeezed).toBe(true);
    expect(squeezed?.column).toBe('band');
    expectSound(layout);
    expect(splitFormula(huge)).toEqual([huge]);
  });

  it('tables: too wide for the right moves to the middle, then to a band, then is scaled', () => {
    const layout = emptyLayout();
    // 'three': right 300, middle 480. A column is as wide as its header "ôôôôô<n>":
    // 24·0.5·6 + 24 = 96.
    const middle = place(layout, table('t1', 4, 'ôôôôô'), measure).element; // 384
    expect(middle?.column).toBe('center');
    expect(middle?.kind === 'draw' && middle.scale).toBe(1);
    const band = place(layout, table('t2', 8, 'ôôôôô'), measure).element; // 768
    expect(band?.column).toBe('band');
    expect(band?.kind === 'draw' && band.scale).toBe(1);
    // 16 columns: 10 headers of 6 characters (96) and 6 of 7 (108) = 1608.
    const scaled = place(layout, table('t3', 16, 'ôôôôô'), measure).element;
    if (scaled?.kind !== 'draw') throw new Error('not placed');
    expect(scaled.scale).toBeLessThan(1);
    expect(scaled.w).toBeCloseTo(1608 * scaled.scale);
    expect(scaled.w).toBeLessThanOrEqual(BOARD_W - 80);
    expectSound(layout);
  });
});

describe('dashed rules between regions', () => {
  it('none on a face written across its width, nor on an empty board', () => {
    expect(boardRules(emptyLayout(), 0)).toEqual([]);
    const wide = plan([write('h', 'title', 'T'), write('s', 'steps', 'bước')]);
    expect(boardRules(wide, 0)).toEqual([]);
  });

  it('one rule in the gutter between two regions that both hold something', () => {
    const layout = plan([write('g', 'side_notes', 'Cho: m = 2 kg'), write('s', 'steps', 'bước')]);
    const rules = boardRules(layout, 0);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.x).toBe(360);
    expect(rules[0]?.y1).toBeGreaterThanOrEqual(COLUMN_TOP - 8);
  });

  it('a rule is broken around a full-width band', () => {
    const layout = plan([write('g', 'side_notes', 'Cho'), write('s', 'steps', 'bước')]);
    plan(
      [
        write('t', 'diagram', 'x'.repeat(10)),
        write('g2', 'side_notes', 'b'),
        write('s2', 'steps', 'c'),
      ],
      layout,
    );
    const band = layout.elements.find((e) => e.column === 'band');
    if (!band) throw new Error('no band');
    const rules = boardRules(layout, 0);
    expect(rules).toHaveLength(2);
    for (const r of rules) expect(r.y2 <= band.y || r.y1 >= band.y + band.h).toBe(true);
  });

  it('a band written last keeps the rule between the regions above it', () => {
    const layout = plan([
      write('g', 'side_notes', 'Cho: m = 2 kg'),
      write('s', 'steps', 'bước một'),
      write('s2', 'steps', 'bước hai'),
    ]);
    expect(layout.faces[0]?.template).toBe('sideMain');
    const before = boardRules(layout, 0);
    expect(before).toHaveLength(1);
    // Something the plan has no region for, written at the end ("Viết tiếp"): a band below.
    plan([write('w', 'diagram', 'x'.repeat(40))], layout);
    const band = layout.elements.find((e) => e.column === 'band');
    if (!band) throw new Error('no band');
    const rules = boardRules(layout, 0);
    expect(rules).toEqual(before);
    const held = layout.elements.filter((e) => e.column === 'side' || e.column === 'center');
    expect(rules[0]?.y2).toBe(Math.max(...held.map((e) => e.y + e.h)) + 12);
    expect(rules[0]?.y2).toBeLessThanOrEqual(band.y);
  });
});

describe('lessons on the board are planned (lesson.ts)', () => {
  beforeEach(() => {
    useVoiceStore.setState({ enabled: false, speaking: false });
  });
  afterEach(() => {
    lesson.stopLesson();
  });

  const run = async (content: string, id = 'plan') => {
    const done = lesson.playLesson({ id, content, question: '' }, measure);
    lesson.finishNow();
    await done;
    return useBoardStore.getState().layout;
  };

  it('a markdown lesson of steps is written across the whole width', async () => {
    const layout = await run(
      '# Rơi tự do\n1. Chọn chiều dương hướng xuống.\n2. Thay số đã cho trong đề.',
    );
    expect(layout.faces[0]?.template).toBe('wide');
    for (const e of texts(layout)) expect(e.x).toBe(40);
  });

  it('"Viết tiếp" keeps every box of the part already written', async () => {
    const part = '# Rơi tự do\n1. Chọn chiều dương hướng xuống.\n2. Thay số đã cho';
    const full = `${part} trong đề.\nLưu ý: đổi đơn vị trước khi thay số.\n3. Vật rơi 20 m.`;
    const first = await run(part, 'grow');
    const boxes = new Map<string, BoardElement>(
      structuredClone(first.elements).map((e) => [e.id, e]),
    );
    const rest = lesson.continueLesson({ id: 'grow', content: full, question: '' }, measure);
    lesson.finishNow();
    await rest;
    const after = useBoardStore.getState().layout;
    expect(after.faces[0]?.template).toBe('wide');
    for (const e of after.elements) {
      const before = boxes.get(e.id);
      if (before)
        expect({ x: e.x, y: e.y, w: e.w, h: e.h }).toEqual({
          x: before.x,
          y: before.y,
          w: before.w,
          h: before.h,
        });
    }
    // The note the plan did not foresee is written in a band, below what was there.
    const note = after.elements.find((e) => e.kind === 'text' && e.source.includes('đổi đơn vị'));
    expect(note?.column).toBe('band');
    expectSound(after);
  });
});
