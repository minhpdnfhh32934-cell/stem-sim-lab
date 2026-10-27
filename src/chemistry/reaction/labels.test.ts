import { describe, expect, it } from 'vitest';
import { L } from '../common';
import { FRAME_KIND, kindNote } from './labels';

describe('kindNote (UI-40: "Chất đầu (Chất đầu)")', () => {
  it('drops the step kind when the name already says it', () => {
    expect(kindNote(L('Chất đầu', 'Reactants'), 'reactants')).toBeNull();
    expect(kindNote(L('Trạng thái chuyển tiếp', 'Transition state'), 'ts')).toBeNull();
  });

  it('keeps it when the name says something else', () => {
    expect(kindNote(L('Cacbocation', 'Carbocation'), 'intermediate')).toEqual(
      FRAME_KIND.intermediate,
    );
  });
});
