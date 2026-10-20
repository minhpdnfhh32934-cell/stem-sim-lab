import { describe, expect, it } from 'vitest';
import { fmtQty } from '@/physics/common/tex';
import { buildStudioContext, STUDIO_CONTEXT_MAX, studioContextText } from './aiContext';
import { physicsFreeFall as sc } from './scenarios/physicsFreeFall';
import {
  createSession,
  engineEvidence,
  MAX_NOTE,
  withAiText,
  withEngine,
  withLearnerText,
  withPrediction,
  type EngineEvidence,
  type StudioSession,
} from './session';

const label = (vi: string, en: string) => ({ vi, en });

const run: EngineEvidence = {
  id: 'comparison',
  key: 'comparison',
  at: 10,
  step: 'interact',
  kind: 'engine',
  model: 'phys.projectile',
  title: label('Rơi tự do', 'Free fall'),
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
  ],
};

/** A record copied from curated data that is still pending (as a chemistry library mix). */
const libraryRecord: EngineEvidence = {
  id: 'mix:x',
  key: 'mix:x',
  at: 11,
  step: 'interact',
  kind: 'engine',
  model: 'reactions/agcl',
  title: label('Bạc nitrat + natri clorua', 'Silver nitrate + sodium chloride'),
  conditions: [],
  quantities: [],
  facts: [
    {
      id: 'observation',
      label: label('Hiện tượng', 'Observation'),
      text: label('Kết tủa trắng', 'White precipitate'),
    },
  ],
  review_status: 'pending',
};

function session(): StudioSession {
  let s = createSession(sc, 1);
  s = withPrediction(s, { choice: '1', label: 'Tăng √2 lần', at: 2 });
  s = withEngine(s, run, { correct: '1', correctLabel: 'Tăng √2 lần', match: true });
  s = withEngine(s, libraryRecord, s.verdict);
  s = withLearnerText(s, 'explanation', 'Thời gian tăng chậm hơn độ cao', 3);
  s = withLearnerText(s, 'conclusion', 'Gấp √2 lần', 4);
  return withAiText(s, 'gemma', 'Văn bản AI trước đó', 5);
}

describe('Science Studio context for AI Teacher', () => {
  it('keeps engine facts, learner notes and AI text in separate, labelled sections', () => {
    const s = session();
    const text = studioContextText(sc, s, 'vi');
    const at = (needle: string) => {
      const i = text.indexOf(needle);
      expect(i, needle).toBeGreaterThanOrEqual(0);
      return i;
    };
    // Lesson and step come first; then engine facts, pending data, learner notes, AI text.
    const head = at('[Science Studio');
    at('Bài học: Rơi tự do: thả từ độ cao gấp đôi');
    at('Học sinh đang ở bước 1/');
    const pending = at('DỮ LIỆU CHƯA ĐƯỢC KIỂM DUYỆT:');
    const engine = at('DỮ KIỆN DO MÔ PHỎNG TÍNH (hoặc');
    const learner = at('GHI CHÚ CỦA HỌC SINH (không phải dữ kiện):');
    const ai = at('VĂN BẢN AI ĐÃ VIẾT TRƯỚC ĐÓ');
    expect(head < engine && engine < pending && pending < learner && learner < ai).toBe(true);

    // Every number is the engine's, formatted as in the report; the facts are the record's.
    const engineText = text.slice(engine, pending);
    expect(engineText).toContain(`Thời gian chuyển động [A] = ${fmtQty('vi', 3.0289, 's')}`);
    expect(engineText).toContain(`Độ cao = ${fmtQty('vi', 45, 'm')}`);
    expect(engineText).toContain('Hiện tượng: Kết tủa trắng');
    expect(engineText).toContain('Kết quả mô phỏng: Tăng √2 lần');
    // Learner words only in their section, AI text only in its own.
    expect(engineText).not.toContain('Thời gian tăng chậm hơn độ cao');
    expect(text.slice(learner, ai)).toContain('Giải thích: “Thời gian tăng chậm hơn độ cao”');
    expect(text.slice(learner, ai)).toContain('Dự đoán đã chọn: Tăng √2 lần');
    expect(text.slice(ai)).toContain('[gemma] Văn bản AI trước đó');

    // Pending data is flagged: the lesson text and the copied library record, not the engine run.
    const pendingText = text.slice(pending, learner);
    expect(pendingText).toContain('Nội dung bài “Rơi tự do: thả từ độ cao gấp đôi”');
    expect(pendingText).toContain('Dữ liệu “Bạc nitrat + natri clorua” (reactions/agcl)');
    expect(pendingText).not.toContain('phys.projectile');
  });

  it('builds from the session without changing it (AI never writes into it)', () => {
    const s = session();
    const before = JSON.stringify(s);
    buildStudioContext(sc, s, 'en');
    expect(JSON.stringify(s)).toBe(before);
    // AI text is kept apart: it never adds or changes engine evidence or the verdict.
    const after = withAiText(s, 'gemma', 'h = 99 m, t = 7 s', 9);
    expect(engineEvidence(after)).toEqual(engineEvidence(s));
    expect(after.verdict).toEqual(s.verdict);
    expect(after.inputs).toEqual(s.inputs);
  });

  it('says what is missing before the first run', () => {
    const text = studioContextText(sc, createSession(sc, 1), 'en');
    expect(text).toContain('None yet: the learner has not run the experiment.');
    expect(text).toContain('Prediction: not chosen yet.');
    expect(text).not.toContain('TEXT AN AI WROTE EARLIER');
  });

  it('stays within its size cap and keeps every section when the session is large', () => {
    let s = session();
    for (let i = 0; i < 40; i++) {
      s = withEngine(
        s,
        {
          ...libraryRecord,
          id: `mix:${String(i)}`,
          key: `mix:${String(i)}`,
          at: 20 + i,
          facts: [
            {
              id: 'n',
              label: label('Ghi chú', 'Note'),
              text: label('x'.repeat(300), 'x'.repeat(300)),
            },
          ],
        },
        s.verdict,
      );
    }
    s = withLearnerText(s, 'explanation', 'e'.repeat(MAX_NOTE), 30);
    s = withLearnerText(s, 'conclusion', 'c'.repeat(MAX_NOTE), 31);
    s = withAiText(s, 'gemma', 'a'.repeat(MAX_NOTE * 4), 32);
    const text = studioContextText(sc, s, 'vi');
    expect(text.length).toBeLessThanOrEqual(STUDIO_CONTEXT_MAX);
    expect(text).toContain('(…đã rút gọn)');
    for (const header of [
      '[Science Studio',
      'DỮ KIỆN DO MÔ PHỎNG TÍNH',
      'GHI CHÚ CỦA HỌC SINH',
      'VĂN BẢN AI ĐÃ VIẾT TRƯỚC ĐÓ',
    ]) {
      expect(text).toContain(header);
    }
    // A long note is quoted only in part.
    expect(text).not.toContain('e'.repeat(300));
  });

  it('keeps the engine facts within a small screen budget (Gemma on an integrated card)', () => {
    // The chat's 'tight' screen budget: what is past it is cut from the end.
    const tight = 1200;
    let s = withLearnerText(session(), 'explanation', 'e'.repeat(MAX_NOTE), 30);
    s = withAiText(s, 'gemma', 'a'.repeat(MAX_NOTE), 31);
    expect(studioContextText(sc, s, 'vi').length).toBeGreaterThan(tight);
    const text = studioContextText(sc, s, 'vi', tight);
    expect(text.length).toBeLessThanOrEqual(tight);
    expect(text).toContain('[Science Studio');
    expect(text).toContain('DỮ KIỆN DO MÔ PHỎNG TÍNH');
    expect(text).toContain(`Thời gian chuyển động [A] = ${fmtQty('vi', 3.0289, 's')}`);
    expect(text).toContain('Kết quả mô phỏng: Tăng √2 lần');
    // The rest is trimmed after the engine facts, and the cut is marked.
    expect(text).toContain('(…đã rút gọn)');
    expect(text.indexOf('DỮ KIỆN DO MÔ PHỎNG TÍNH')).toBeLessThan(text.indexOf('(…đã rút gọn)'));
  });
});
