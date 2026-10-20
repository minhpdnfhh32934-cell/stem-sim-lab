import { describe, expect, it } from 'vitest';
import { fmtQty } from '@/physics/common/tex';
import { studioContextText } from './aiContext';
import { buildReport, renderMarkdown, reportBlocks } from './report';
import { physicsFreeFall as sc } from './scenarios/physicsFreeFall';
import {
  createSession,
  learnerText,
  withAiText,
  withEngine,
  withLearnerText,
  withPrediction,
  type EngineEvidence,
  type StudioSession,
} from './session';

const label = (vi: string, en: string) => ({ vi, en });

const engine: EngineEvidence = {
  id: 'engine:x',
  key: 'comparison',
  at: 10,
  step: 'interact',
  kind: 'engine',
  model: 'phys.projectile',
  title: label('Rơi tự do và ném thẳng đứng', 'Free fall and vertical throw'),
  conditions: [
    {
      id: 'A',
      inputs: [
        {
          id: 'h0',
          label: label('Độ cao', 'Height'),
          unit: 'm',
          condition: 'A',
          value: 45,
          check: null,
        },
      ],
    },
  ],
  quantities: [
    {
      id: 'time_of_flight',
      label: label('Thời gian chuyển động', 'Time of flight'),
      unit: 's',
      condition: 'A',
      value: 3.0289,
      check: 3.0289,
    },
    {
      id: 'time_of_flight.ratio',
      label: label('Tỉ số B/A', 'B/A ratio'),
      unit: '1',
      condition: 'B/A',
      value: 1.4142,
      check: 1.4,
    },
  ],
};

function fullSession(): StudioSession {
  let s = createSession(sc, 1);
  s = withPrediction(s, { choice: '1', label: 'Tăng √2 ≈ 1,41 lần', at: 2 });
  s = withEngine(s, engine, { correct: '1', correctLabel: 'Tăng √2 ≈ 1,41 lần', match: true });
  s = withLearnerText(s, 'explanation', 'Thời gian | tăng chậm\nhơn độ cao', 3);
  s = withLearnerText(s, 'conclusion', 'Gấp √2 lần', 4);
  return withAiText(s, 'gemma', 'AI nói thêm', 5);
}

describe('studio report builder', () => {
  it('separates engine numbers, learner words and AI text, in the UI locale', () => {
    const md = buildReport({
      scenario: sc,
      session: fullSession(),
      locale: 'vi',
      modelSources: [{ id: 'halliday', citation: 'Halliday, Fundamentals of Physics' }],
      generatedAt: 0,
    });
    expect(md).toContain('# Rơi tự do: thả từ độ cao gấp đôi');
    expect(md).toContain('chưa được kiểm duyệt');
    expect(md).toContain('Người học chọn: Tăng √2 ≈ 1,41 lần');
    // Vietnamese decimal comma, unit from the record, analytic check shown as matching.
    expect(md).toContain('| Thời gian chuyển động | A | 3,029 s | 3,029 s (khớp) |');
    expect(md).toContain('1,414');
    expect(md).toMatch(/lệch 1(,0)?\s?%/);
    expect(md).toContain('Điều kiện A: Độ cao = 45 m');
    expect(md).toContain('> Thời gian | tăng chậm\n> hơn độ cao');
    expect(md).toContain('## Văn bản do AI viết');
    expect(md).toContain('> [gemma] AI nói thêm');
    expect(md).toContain('Dự đoán khớp với kết quả mô phỏng.');
    expect(md).toContain('Halliday, Fundamentals of Physics');
    const engineAt = md.indexOf('## Số đo từ mô phỏng');
    const aiAt = md.indexOf('## Văn bản do AI viết');
    expect(md.slice(engineAt, aiAt)).not.toContain('AI nói thêm');
  });

  it('escapes table cells and works in English and plain text', () => {
    const blocks = reportBlocks({
      scenario: sc,
      session: fullSession(),
      locale: 'en',
      generatedAt: 0,
    });
    const table = blocks.find((b) => b.kind === 'table');
    expect(table?.kind === 'table' && table.rows[0]?.[2]).toBe('3.029 s');
    const text = buildReport(
      { scenario: sc, session: fullSession(), locale: 'en', generatedAt: 0 },
      'text',
    );
    expect(text).toContain('Measurements from the simulation');
    expect(text).not.toContain('| --- |');
    expect(renderMarkdown([{ kind: 'table', head: ['a|b'], rows: [['x\ny']] }])).toContain(
      '| a\\|b |\n| --- |\n| x y |',
    );
  });

  it('a record with library facts lists them and has no measurement table', () => {
    let s = createSession(sc, 1);
    s = withEngine(
      s,
      {
        ...engine,
        key: 'mix:x',
        model: 'reactions/agcl',
        title: label('Tạo kết tủa AgCl', 'Precipitation of AgCl'),
        conditions: [],
        quantities: [],
        facts: [
          {
            id: 'observation',
            label: label('Hiện tượng (thư viện)', 'Observation (library)'),
            text: label('Kết tủa trắng AgCl', 'White precipitate of AgCl'),
          },
        ],
      },
      null,
    );
    const md = buildReport({ scenario: sc, session: s, locale: 'vi', generatedAt: 0 });
    expect(md).toContain('## Kết quả từ thư viện dữ liệu của ứng dụng');
    expect(md).toContain('- Hiện tượng (thư viện): Kết tủa trắng AgCl');
    expect(md).toContain('reactions/agcl');
    expect(md).not.toContain('## Số đo từ mô phỏng');
    expect(md).not.toContain('| Đại lượng |');
  });

  it('shows the prediction and the computed choice in the language on screen now', () => {
    let s = createSession(sc, 1);
    const both = label('Tăng √2 ≈ 1,41 lần', 'Increases √2 ≈ 1.41 times');
    s = withPrediction(s, { choice: '1', label: both.vi, text: both, at: 2 });
    s = withEngine(s, engine, { correct: '1', correctText: both, match: true });
    const en = buildReport({
      scenario: sc,
      session: s,
      locale: 'en',
      modelSources: [],
      generatedAt: 0,
    });
    expect(en).toContain('Increases √2 ≈ 1.41 times');
    expect(en).not.toContain('Tăng √2');
    const ctx = studioContextText(sc, s, 'en');
    expect(ctx).toContain('Increases √2 ≈ 1.41 times');
    expect(ctx).not.toContain('Tăng √2');
  });

  it('a session saved before 0.7 still shows its stored labels', () => {
    const en = buildReport({
      scenario: sc,
      session: fullSession(),
      locale: 'en',
      modelSources: [],
      generatedAt: 0,
    });
    expect(en).toContain('Tăng √2 ≈ 1,41 lần');
  });

  it('an empty session says what is missing instead of inventing results', () => {
    const md = buildReport({
      scenario: sc,
      session: createSession(sc, 1),
      locale: 'vi',
      generatedAt: 0,
    });
    expect(md).toContain('Chưa có dự đoán.');
    expect(md).toContain('Chưa chạy thí nghiệm.');
    expect(md).toContain('Chưa có nguồn.');
    expect(md).not.toMatch(/\d,\d+ s/);
  });

  it('holds exactly the session evidence: every engine value, learner note and AI text once', () => {
    const s = fullSession();
    const blocks = reportBlocks({ scenario: sc, session: s, locale: 'vi', generatedAt: 0 });
    const rows = blocks.flatMap((b) => (b.kind === 'table' ? b.rows : []));
    expect(rows.map((r) => [r[0], r[1], r[2]])).toEqual(
      engine.quantities.map((q) => [q.label.vi, q.condition, fmtQty('vi', q.value, q.unit)]),
    );
    const conditions = blocks.flatMap((b) => (b.kind === 'list' ? b.items : []));
    expect(conditions).toContain(`Điều kiện A: Độ cao = ${fmtQty('vi', 45, 'm')}`);
    const quotes = blocks.flatMap((b) => (b.kind === 'quote' ? [b.text] : []));
    expect(quotes).toEqual([
      learnerText(s, 'explanation'),
      '[gemma] AI nói thêm',
      learnerText(s, 'conclusion'),
    ]);
    // The lesson text is still pending, so the report lists it as not yet reviewed.
    const md = renderMarkdown(blocks);
    expect(md).toContain('## Dữ liệu chưa được kiểm duyệt');
    expect(md).toContain('- Nội dung bài “Rơi tự do: thả từ độ cao gấp đôi”');
  });
});
