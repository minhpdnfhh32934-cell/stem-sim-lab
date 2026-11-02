import { describe, expect, it } from 'vitest';
import { tFor } from '@/app/i18n';
import { stageAnnouncement, type StageStatus } from './stageAnnouncement';

const base: StageStatus = {
  title: 'Ném xiên',
  playing: false,
  finished: false,
  replay: false,
  intervened: false,
  time: 0,
};
const say = (s: Partial<StageStatus>) => stageAnnouncement({ ...base, ...s }, tFor('vi'), 'vi');

describe('stageAnnouncement()', () => {
  it('names each state once, with the engine time in Vietnamese decimals', () => {
    expect(say({})).toBe('');
    expect(say({ playing: true, time: 0.42 })).toBe('Ném xiên: đang chạy.');
    expect(say({ time: 1.2345 })).toBe('Ném xiên: tạm dừng ở t = 1,235 s.');
    expect(say({ finished: true, time: 2.165 })).toBe('Ném xiên: đã chạy xong, t = 2,165 s.');
    expect(say({ replay: true, time: 0.5 })).toBe('Ném xiên: đang xem lại ở t = 0,500 s.');
  });

  it('adds the intervention notice to a state, never on its own', () => {
    expect(say({ time: 1, intervened: true })).toBe(
      'Ném xiên: tạm dừng ở t = 1,000 s. Đã có can thiệp — kết quả là mô phỏng số.',
    );
    expect(say({ intervened: true })).toBe('');
  });
});
