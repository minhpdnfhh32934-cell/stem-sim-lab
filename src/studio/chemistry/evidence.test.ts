import { describe, expect, it } from 'vitest';
import { reactionById } from '@/chemistry/data/reactions';
import { chemistryChlorideTest as sc } from '../scenarios/chemistryChlorideTest';
import { createSession, EvidenceSchema, withEngine, withPrediction } from '../session';
import { withBenchAction } from './benchSession';
import { chemistrySources } from './plugin';
import {
  chemistryOf,
  chemVerdict,
  correctChoice,
  followsProcedure,
  isTargetMix,
  mixEvidence,
} from './evidence';
import { mixOutcome } from './library';

const b = (() => {
  const binding = chemistryOf(sc);
  if (!binding) throw new Error('chemistry scenario expected');
  return binding;
})();
const label = (c: string) => `label:${c}`;

describe('bench evidence', () => {
  it('copies the library record verbatim and holds no quantity', () => {
    const r = reactionById('agcl');
    const ev = mixEvidence(['NaCl', 'AgNO3'], mixOutcome(['NaCl', 'AgNO3']), 5);
    expect(EvidenceSchema.safeParse(ev).success).toBe(true);
    expect(ev.quantities).toEqual([]);
    expect(ev.model).toBe('reactions/agcl');
    expect(ev.title).toEqual(r?.name);
    const fact = (id: string) => ev.facts?.find((f) => f.id === id)?.text;
    expect(fact('observation')).toEqual(r?.observation);
    expect(fact('conditions')).toEqual(r?.conditions);
    expect(fact('equation')?.vi).toBe('AgNO₃ + NaCl → AgCl + NaNO₃');
    expect(fact('balance')?.vi).toMatch(/Bảo toàn nguyên tố và điện tích: đúng/);
    expect(fact('review')?.vi).toBe('Bản ghi thư viện chưa được kiểm duyệt.');
    expect(fact('order')?.vi).toBe('Cho lần lượt: NaCl → AgNO₃');
  });

  it('an unknown pair says "chưa có trong cơ sở dữ liệu đã kiểm chứng" and nothing else', () => {
    const ev = mixEvidence(['AgNO3', 'BaCl2'], mixOutcome(['AgNO3', 'BaCl2']), 5);
    expect(ev.model).toBe('reactions');
    expect(ev.facts?.map((f) => f.id)).toEqual(['order', 'result']);
    expect(ev.facts?.[1]?.text.vi).toMatch(/chưa có trong cơ sở dữ liệu đã kiểm chứng/);
  });

  it('the same pair in either order replaces the earlier record', () => {
    const s0 = createSession(sc, 0);
    const a = mixEvidence(['NaCl', 'AgNO3'], mixOutcome(['NaCl', 'AgNO3']), 1);
    const c = mixEvidence(['AgNO3', 'NaCl'], mixOutcome(['AgNO3', 'NaCl']), 2);
    const s = withEngine(withEngine(s0, a, null), c, null);
    expect(s.evidence).toHaveLength(1);
    expect(a.key).toBe(c.key);
  });
});

describe('verdict', () => {
  it('only a precipitation record confirms "precipitate"; unknown pairs give no verdict', () => {
    const agcl = mixOutcome(['NaCl', 'AgNO3']);
    expect(correctChoice(agcl)).toBe('precipitate');
    expect(correctChoice(mixOutcome(['AgNO3', 'BaCl2']))).toBeNull();
    expect(correctChoice(mixOutcome(['HCl', 'NaOH']))).toBeNull();
    const yes = { choice: 'precipitate', label: 'x', at: 1 };
    const no = { choice: 'noPrecipitate', label: 'y', at: 1 };
    expect(chemVerdict(agcl, yes, label)).toEqual({
      correct: 'precipitate',
      correctLabel: 'label:precipitate',
      match: true,
    });
    expect(chemVerdict(agcl, no, label).match).toBe(false);
    expect(chemVerdict(mixOutcome(['NaCl', 'BaCl2']), yes, label)).toEqual({
      correct: null,
      correctLabel: null,
      match: null,
    });
  });

  it('knows the question pair in any order and whether the procedure order was kept', () => {
    expect(isTargetMix(b, ['AgNO3', 'NaCl'])).toBe(true);
    expect(isTargetMix(b, ['AgNO3', 'BaCl2'])).toBe(false);
    expect(followsProcedure(b, ['NaCl', 'AgNO3'])).toBe(true);
    expect(followsProcedure(b, ['AgNO3', 'NaCl'])).toBe(false);
  });
});

describe('bench session reducer', () => {
  it('stores valid actions, ignores invalid ones and sets the verdict only for the question pair', () => {
    let s = withPrediction(createSession(sc, 0), { choice: 'precipitate', label: 'x', at: 1 });
    const step = (op: Parameters<typeof withBenchAction>[2], at: number) => {
      s = withBenchAction(s, b, op, at, label);
    };
    const before = s;
    step({ op: 'mix' }, 2);
    expect(s).toBe(before);
    step({ op: 'add', reagent: 'AgNO3' }, 3);
    step({ op: 'add', reagent: 'BaCl2' }, 4);
    step({ op: 'mix' }, 5);
    expect(s.verdict).toBeNull();
    expect(s.predictionLocked).toBe(true);
    step({ op: 'empty' }, 6);
    expect(s.actions).toEqual([]);
    step({ op: 'add', reagent: 'NaCl' }, 7);
    step({ op: 'add', reagent: 'AgNO3' }, 8);
    step({ op: 'mix' }, 9);
    expect(s.verdict?.match).toBe(true);
    expect(s.evidence.filter((e) => e.kind === 'engine')).toHaveLength(2);
    step({ op: 'empty' }, 10);
    step({ op: 'add', reagent: 'BaCl2' }, 11);
    step({ op: 'add', reagent: 'H2SO4' }, 12);
    step({ op: 'mix' }, 13);
    expect(s.verdict?.match).toBe(true);
  });
});

describe('report sources', () => {
  it('lists the sources of every library record behind the mixes, without duplicates', () => {
    let s = createSession(sc, 0);
    s = withEngine(s, mixEvidence(['BaCl2', 'H2SO4'], mixOutcome(['BaCl2', 'H2SO4']), 1), null);
    s = withEngine(s, mixEvidence(['AgNO3', 'BaCl2'], mixOutcome(['AgNO3', 'BaCl2']), 2), null);
    const ids = chemistrySources(sc, s).map((x) => x.id);
    expect(ids).toEqual(['sgk-hh10', 'curated']);
  });
});
