import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import fixtures from './boardFixtures.json';
import type { Measure } from './layout';

/**
 * "Viết tiếp" (item 1, fix round 1): an answer cut at the output limit and then continued leaves
 * the board exactly as if the whole answer had been taught at once: no stump of a line cut
 * mid-word, inside "**", in a line that grew past the board's length, that became a label, or
 * that was the final check before the answer went on. Lessons run instantly ("Viết nhanh").
 */
vi.mock('@/teacher/voice/speak', () => ({
  newVoiceSession: () => ({ skipped: null }),
  speak: () => Promise.resolve(),
  stopSpeaking: () => undefined,
  toSpokenText: (text: string) => text,
}));

const lesson = await import('./lesson');
const { useBoardStore } = await import('./boardStore');

const measure: Measure = {
  text: (s, px) => s.length * px * 0.5,
  math: (tex, px) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
};

/** What the learner sees: the texts not erased, in board order, and the marks by kind. */
function seen(): { texts: string[]; marks: string[] } {
  const { layout, erased, marks } = useBoardStore.getState();
  return {
    texts: layout.elements.flatMap((e) =>
      e.kind === 'text' && !erased[e.id] ? [`${e.role}|${e.source}`] : [],
    ),
    marks: marks.map((m) => m.kind).sort(),
  };
}

async function fresh(content: string) {
  const done = lesson.playLesson({ id: 'fresh', content, question: '' }, measure);
  lesson.finishNow();
  await done;
  return seen();
}

async function continued(part: string, full: string) {
  const first = lesson.playLesson({ id: 'cut', content: part, question: '' }, measure);
  lesson.finishNow();
  await first;
  const rest = lesson.continueLesson({ id: 'cut', content: full, question: '' }, measure);
  lesson.finishNow();
  await rest;
  return seen();
}

beforeEach(() => {
  useVoiceStore.setState({ enabled: false, speaking: false });
});
afterEach(() => {
  lesson.stopLesson();
  useBoardStore.getState().set({ speed: 1 });
});

describe('"Viết tiếp" equals teaching the whole answer at once', () => {
  it.each([
    [
      'a markdown line cut mid-word',
      '# Rơi tự do\n1. Vật rơi từ độ',
      '# Rơi tự do\n1. Vật rơi từ độ cao 20 m.\n2. Thời gian rơi là 2 s.',
    ],
    [
      'a cut inside "**"',
      '# Nguyên phân\nVậy, tế bào sẽ tạo ra **3 tế bào*',
      '# Nguyên phân\nVậy, tế bào sẽ tạo ra **3 tế bào** con.\n\nĐó là kết quả.',
    ],
    [
      'a line that grows past the board length',
      '# Lực\nDữ liệu cho thấy tốc độ này liên',
      `# Lực\nDữ liệu cho thấy tốc độ này liên tục tăng ${'khi lực kéo tác dụng lên vật lớn dần theo thời gian và '.repeat(2)}ta có a = F/m = 10/2 = 5 m/s².\n\nXong.`,
    ],
    [
      'a stump that becomes a label',
      '# Gia tốc\n**Tí',
      '# Gia tốc\n**Tính toán:**\n\na = F/m = 10/2 = 5 m/s².',
    ],
    [
      'a final check that is a step once the answer goes on',
      '# Bài toán\nMột ô tô chạy 72 km/h. Tính quãng đường?',
      '# Bài toán\nMột ô tô chạy 72 km/h. Tính quãng đường?\n1. Đổi 72 km/h = 20 m/s.',
    ],
    [
      'a final check followed by words only, then by more steps',
      '# Quang hợp\n1. Tại sao cây xanh cần ánh sáng?\n\nChúng ta hãy cùng tìm hiểu nhé.',
      '# Quang hợp\n1. Tại sao cây xanh cần ánh sáng?\n\nChúng ta hãy cùng tìm hiểu nhé.\n\nTuy nhiên, cây cần cả nước.',
    ],
    [
      'a symbol cut before its subscript',
      '# Pha loãng\n- V',
      '# Pha loãng\n- V₁ là thể tích dung dịch.\n- C₁ = 2 mol/L.',
    ],
    [
      'a TeachScript write cut inside its text',
      'Ta có <write id="s1" zone="steps">v = g',
      'Ta có <write id="s1" zone="steps">v = gt = 20 m/s</write>.<box target="s1"/> Xong.',
    ],
    [
      'a result whose box comes after the cut',
      'Vậy <write id="r1" zone="steps" role="result">a = 5',
      'Vậy <write id="r1" zone="steps" role="result">a = 5 m/s²</write>.<box target="r1"/> Hết.',
    ],
    [
      // Fix round 2: the stump held the face's only title slot, so the whole title became a
      // heading among the steps.
      'a TeachScript title cut inside its text',
      'Hôm nay <write id="h1" zone="title" role="heading">Chuyển động thẳng',
      'Hôm nay <write id="h1" zone="title" role="heading">Chuyển động thẳng biến đổi đều</write>. Ta có <write id="s1" zone="steps">v = v₀ + at</write>.',
    ],
  ])('%s', async (_name, part, full) => {
    expect(full.startsWith(part)).toBe(true);
    const whole = await fresh(full);
    expect(await continued(part, full)).toEqual(whole);
  });

  const answers = [...fixtures.answers, ...fixtures.synthetic].map((f) => f.answer);
  it.each(answers.flatMap((answer, i) => [0.35, 0.6, 0.85].map((at) => [i, at, answer] as const)))(
    'fixture %i cut at %f',
    async (_i, at, answer) => {
      const part = answer.slice(0, Math.floor(answer.length * at));
      const whole = await fresh(answer);
      expect(await continued(part, answer)).toEqual(whole);
    },
  );
});

/**
 * What the learner sees, face by face: each text with its face and role, in the order it was
 * placed, and each mark with the text it stands on (an arrow: both ends). `misordered`: the
 * columns whose texts, top to bottom, are not in the order they were placed (a line placed again
 * below a later line that stayed). Positions may differ (an erased stump leaves a gap, and a face
 * already written keeps its plan, so a note may stand in a band instead of a side column); what is
 * written, on which face, in which order, and what is marked may not.
 */
function seenOnFaces(): { texts: string[]; misordered: string[][]; marks: string[] } {
  const { layout, erased, marks } = useBoardStore.getState();
  const shown = layout.elements.filter((e) => !erased[e.id]);
  const label = (e: (typeof shown)[number]) =>
    e.kind === 'text' ? `${String(e.face)}|${e.role}|${e.source}` : `${String(e.face)}|draw`;
  const columns = new Map<string, typeof shown>();
  for (const e of shown) {
    const key = `${String(e.face)}|${e.column}`;
    columns.set(key, [...(columns.get(key) ?? []), e]);
  }
  const misordered = [...columns.values()].flatMap((placed) => {
    const top = [...placed].sort((a, b) => a.y - b.y || a.x - b.x);
    return top.every((e, i) => e === placed[i]) ? [] : [top.map(label)];
  });
  const on = (face: number, b: { x: number; y: number; w: number; h: number }): string => {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const e = shown.find(
      (x) => x.face === face && cx >= x.x && cx <= x.x + x.w && cy >= x.y && cy <= x.y + x.h,
    );
    return e ? (e.kind === 'text' ? e.source : `draw:${e.type}`) : '?';
  };
  return {
    texts: shown.map(label),
    misordered,
    marks: marks
      .map(
        (m) =>
          `${String(m.face)}|${m.kind}|${on(m.face, m.box)}${m.to ? `→${on(m.face, m.to)}` : ''}`,
      )
      .sort(),
  };
}

describe('"Viết tiếp" equals teaching at once, wherever a TeachScript answer is cut', () => {
  const answers = [
    'Hôm nay <write id="h1" zone="title" role="heading">Rơi tự do</write>. Đề cho <write id="g1" zone="side_notes" role="note">h = 20 m</write>. Ta có <write id="f1" zone="steps">h = ½gt²</write><underline target="f1"/>, nên <write id="r1" zone="steps" role="result">t = 2 s</write>.<box target="r1"/><arrow from="f1" to="r1"/> Hết.',
    'Bài một <write id="t1" zone="title" role="heading">Lực ma sát</write>. <write id="s1" zone="steps">F = μmg</write><circle target="s1" span="μ"/>. <newboard title="Ví dụ"/>Với <write id="s2" zone="steps">μ = 0,2</write> thì <write id="r2" zone="steps" role="result">F = 4 N</write>.<box target="r2"/>',
    '<write id="h1" zone="title" role="heading">Động lượng</write> <write id="k1" zone="steps">Kết luận:</write> Ta có <write id="s1" zone="steps">p = mv = 2·3 = 6 kg·m/s</write>.<highlight target="s1" span="6 kg·m/s"/> À nhầm, <correct target="s1">p = 2·3 = 6 kg·m/s</correct>. <point target="s1"/>Ở câu b, <write id="s2" zone="steps">p = mv = 2·3 = 6 kg·m/s</write>. <write id="q1" zone="steps">Nếu m tăng gấp đôi thì p thế nào?</write>',
  ];
  it.each(answers.map((answer, i) => [i, answer] as const))(
    'answer %i, cut every 4 characters',
    async (_i, answer) => {
      const whole = await (async () => {
        await fresh(answer);
        return seenOnFaces();
      })();
      for (let at = 4; at < answer.length; at += 4) {
        const part = answer.slice(0, at);
        await continued(part, answer);
        expect(seenOnFaces(), `cut at ${String(at)}: ${part}`).toEqual(whole);
      }
    },
    60000,
  );
});

/**
 * Fix round 3 (A3 review): the reviewer's oracle, kept as a table. Each answer is cut at every
 * character; "Viết tiếp" (the part, then the whole answer) must leave the board as teaching the
 * whole answer at once: each text with its face and role, each mark with the text it stands on.
 * Markdown, TeachScript and real eval answers (copies in boardFixtures.json).
 */
describe('"Viết tiếp" oracle: cut at every character (fix round 3)', () => {
  const evalAnswer = (id: string): string => {
    const found = fixtures.answers.find((f) => f.id === id);
    if (!found) throw new Error(`no fixture ${id}`);
    return found.answer;
  };
  const table: [string, string][] = [
    // A bare tag closed later reads as markup only once its closing tag arrives.
    [
      'markdown: <step>…</step> around the steps',
      '# Bài\n<step>\n1. Đổi 72 km/h = 20 m/s\n2. a = v/t = 2 m/s²\n</step>\n\nXong rồi.',
    ],
    [
      'markdown: a <note> closed three lines later',
      '<note>Lưu ý:\nĐơn vị phải đổi về SI.\nKhông được quên.</note>\n\nv = 20 m/s',
    ],
    [
      'markdown: a sentence with an inline link',
      'Lực hấp dẫn là lực hút giữa hai vật (https://vi.wikipedia.org/wiki/Lực_hấp_dẫn).\n\nGia tốc rơi tự do không phụ thuộc khối lượng.',
    ],
    [
      'markdown: a final check that starts with "Vậy"',
      '1. a = F/m = 2 m/s²\n2. v = at = 10 m/s\n\nVậy nếu khối lượng tăng gấp đôi thì gia tốc thay đổi thế nào?',
    ],
    [
      'markdown: powers after a decimal comma, a citation superscript',
      'Điện tích electron là 1,6.10<sup>-19</sup> C.\n\nNăm 1687<sup>[1]</sup> Newton công bố ba định luật.',
    ],
    [
      'markdown: averages <p> and <b>, a verdict, an assumption, a source in brackets',
      'Trong cơ học lượng tử, <p> = 0 và <x> = 0.\n\nVâng.\n\nMình hiểu ý bạn là vật trượt không ma sát.\n\nLực hấp dẫn là lực hút (theo Wikipedia: https://vi.wikipedia.org/wiki/Lực).',
    ],
    [
      'TeachScript: a link in the spoken sentence',
      'Theo Wikipedia (https://vi.wikipedia.org/wiki/Lực), lực là đại lượng vectơ. <write id="s1" zone="steps">F = ma</write>.',
    ],
    [
      'TeachScript: F and f in two sentences',
      'Vì vật đứng yên nên hợp lực <write id="a" zone="main">F = 0</write>. Không có lực kéo nên lực ma sát nghỉ <write id="b" zone="main">f = 0</write>.',
    ],
    [
      'TeachScript: the same value twice with words between',
      'Vật A có <write id="a" zone="main">a = 2 m/s²</write> và vật B cũng có <write id="b" zone="main">a = 2 m/s²</write>.',
    ],
    [
      'TeachScript: the same result in case 1 and case 2',
      'Trường hợp 1: vật đứng yên, <write id="r1" zone="main" role="result">F = 0</write>.<box target="r1"/> Trường hợp 2: vật chuyển động thẳng đều, <write id="r2" zone="main" role="result">F = 0</write>.<box target="r2"/>',
    ],
    [
      'TeachScript: a power inside a math write',
      'Ta có <write id="m" zone="main" math="true">N_A = 6,02 \\cdot 10<sup>23</sup></write>.',
    ],
    [
      'TeachScript: erased, then written again',
      '<write id="s1" zone="steps">v = 20 m/s</write>. <erase target="s1"/><write id="s2" zone="steps">v = 20 m/s</write>.',
    ],
    [
      'markdown: short sentences ending with a link, a source name or a year',
      'Quang hợp diễn ra ở lục lạp [Wikipedia](https://vi.wikipedia.org/wiki/Quang_hợp).\n\nGravity pulls objects toward Earth (https://en.wikipedia.org/wiki/Gravity).\n\nNăm 1687, Newton công bố ba định luật (https://vi.wikipedia.org/wiki/Isaac_Newton).\n\nVận tốc là đại lượng vectơ (nguồn: https://vi.wikipedia.org/wiki/Vận_tốc).',
    ],
    [
      'TeachScript: T/t and V/v, symbols that differ only in case',
      'Chu kỳ quay là <write id="a" zone="main">T = 2 s</write>. Thời gian rơi là <write id="b" zone="main">t = 2 s</write>. <write id="c" zone="main">V = 2,0</write>. Và <write id="d" zone="main">v = 2,0</write>.',
    ],
    [
      'TeachScript: the same formula twice with words between',
      'Vật A có <write id="a" zone="main" math="true">a = 2</write> và vật B cũng có <write id="b" zone="main" math="true">a = 2</write>.',
    ],
    [
      'markdown: a final check that starts with "=>", thanks to a thing',
      'Cảm ơn lực ma sát, xe mới dừng được.\n\n1. a = F/m = 2 m/s²\n\n=> Nếu F tăng gấp đôi thì a bằng bao nhiêu?',
    ],
    [
      'markdown: superscripts inside inline and display formulas, a mantissa with a dot',
      'Ta có $N_A = 6,02 \\cdot 10<sup>23</sup>$ hạt.\n\n$$m_e = 9,1 \\cdot 10<sup>-31</sup>\\ \\text{kg}$$\n\nKhối lượng 9,1.10<sup>-31</sup> kg.',
    ],
    [
      'TeachScript and markdown: an average <p> or <b> before "="',
      'Vậy <write id="s2" zone="steps"><p> = 0</write>. Ta có giá trị trung bình <b> = 2 cm.',
    ],
    [
      'markdown: a list joined by "và" written as text',
      '$$v_0 = 0\\ \\text{và}\\ a = 2\\ \\text{m/s}^2\\ \\text{và}\\ t = 3\\ \\text{s}$$\n\n$$m = 4\\ \\text{kg} \\ \\text{và} \\ F = 20\\ \\text{N}$$',
    ],
    // Fix round 1 of step F1a: an opening tag on the same line as content ("<step>Bước 1: …")
    // makes "Viết tiếp" read the first line again; it must stay above the lines after it.
    [
      'markdown: <step> on the line of the first step',
      '<step>Bước 1: m = 2 kg\nBước 2: F = 10 N\nBước 3: a = F/m = 5 m/s²</step>',
    ],
    [
      'markdown: a heading, then <step> on the line of the first step',
      '# Bài\n<step>1. Đổi 72 km/h = 20 m/s\n2. a = v/t = 2 m/s²</step>\n\nXong rồi.',
    ],
    [
      'markdown: <note> on the line of its label',
      '<note>Lưu ý: đổi đơn vị về SI.\nKhông được quên đơn vị.\nVí dụ 72 km/h = 20 m/s.</note>\n\nv = 20 m/s',
    ],
    [
      'markdown: an average <p>, then a paragraph <p>…</p>',
      'Ta có <p> = 0.\n\n<p>Lực là vectơ.</p>',
    ],
    [
      'markdown: an average <b>, then a bold label',
      'Ta có giá trị trung bình <b> = 2 cm.\n\n<b>Lưu ý:</b> đổi đơn vị.',
    ],
    [
      'markdown and TeachScript: sentences that open like a source line',
      'Nguồn điện tạo ra hiệu điện thế giữa hai cực (https://vi.wikipedia.org/wiki/Nguồn_điện).\n\nLiên kết ion hình thành giữa kim loại và phi kim (https://vi.wikipedia.org/wiki/Liên_kết_ion).\n\nU = 12 V.',
    ],
    [
      'TeachScript: a link inside a sentence that opens with "Nguồn"',
      'Nguồn điện (https://vi.wikipedia.org/wiki/Nguồn_điện) tạo ra hiệu điện thế. <write id="s1" zone="steps">U = 12 V</write>.',
    ],
    ['eval P14 (a "Vậy …?" question line)', evalAnswer('P14')],
    ['eval B5 (2<sup>3</sup>, a list of sources)', evalAnswer('B5')],
    ['eval B7 (2<sup>10</sup>)', evalAnswer('B7')],
  ];
  it.each(table)(
    '%s',
    async (_name, answer) => {
      await fresh(answer);
      const whole = seenOnFaces();
      const wrong: number[] = [];
      for (let at = 1; at < answer.length; at++) {
        await continued(answer.slice(0, at), answer);
        if (JSON.stringify(seenOnFaces()) !== JSON.stringify(whole)) wrong.push(at);
      }
      const first = wrong[0];
      if (first !== undefined) {
        await continued(answer.slice(0, first), answer);
        expect(
          seenOnFaces(),
          `${String(wrong.length)} wrong cuts, first at ${String(first)}`,
        ).toEqual(whole);
      }
      expect(wrong).toEqual([]);
    },
    120000,
  );
});

describe('"Viết tiếp" after a lesson that was stopped part way', () => {
  it('teaches what the stopped run never reached, once', async () => {
    useBoardStore.getState().set({ speed: 2 });
    const part =
      '# Rơi tự do\n1. Chọn chiều dương hướng xuống.\n2. Gốc thời gian lúc thả vật.\n3. Vật rơi từ độ cao';
    const full = `${part} 20 m.\n4. Thời gian rơi là 2 s.`;
    const whole = await fresh(full);
    const first = lesson.playLesson({ id: 'stopped', content: part, question: '' }, measure);
    // Stopped while the first step is being written (the voice is off: the pen is slow).
    const end = Date.now() + 5000;
    while ((useBoardStore.getState().progress.s1 ?? 0) === 0 && Date.now() < end)
      await new Promise((r) => setTimeout(r, 5));
    lesson.stopLesson();
    await first;
    const rest = lesson.continueLesson({ id: 'stopped', content: full, question: '' }, measure);
    lesson.finishNow();
    await rest;
    expect(seen()).toEqual(whole);
  });
});
