import { describe, expect, it } from 'vitest';
import { operon } from './model';

describe('the lac operon (SH12 Bài 3)', () => {
  it('Monod and Jacob: without lactose the genes are off, with lactose on (tr. 18–19)', () => {
    expect(operon({ lactose: false, lacI: 'normal', operator: 'normal' })).toMatchObject({
      repressorOnOperator: true,
      transcribed: false,
      reason: 'repressed',
    });
    expect(operon({ lactose: true, lacI: 'normal', operator: 'normal' })).toMatchObject({
      repressorOnOperator: false,
      allolactoseOnRepressor: true,
      transcribed: true,
      reason: 'lactose',
    });
  });

  it('question 2 (tr. 21): working without lactose means a damaged lacI or operator', () => {
    const working = (['normal', 'broken'] as const).flatMap((lacI) =>
      (['normal', 'broken'] as const).flatMap((operator) =>
        operon({ lactose: false, lacI, operator }).transcribed ? [`${lacI}-${operator}`] : [],
      ),
    );
    expect(working).toEqual(['normal-broken', 'broken-normal', 'broken-broken']);
    expect(operon({ lactose: false, lacI: 'broken', operator: 'normal' }).reason).toBe(
      'lacIBroken',
    );
    expect(operon({ lactose: false, lacI: 'normal', operator: 'broken' }).reason).toBe(
      'operatorBroken',
    );
  });
});
