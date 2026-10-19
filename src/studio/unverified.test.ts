import { describe, expect, it } from 'vitest';
import { card3d } from '@/biology/division/mitosis3d/components';
import { buildTimeline } from '@/biology/division/mitosis3d/timeline';
import { reactionById } from '@/chemistry/data/reactions';
import { studioContextText } from './aiContext';
import { matchEvidence, stageEvidence } from './biology/evidence';
import { biologyOf, taskParts } from './biology/model';
import { mixEvidence } from './chemistry/evidence';
import { mixOutcome } from './chemistry/library';
import { buildReport } from './report';
import { biologyMitosisMetaphase as bio } from './scenarios/biologyMitosisMetaphase';
import { chemistryChlorideTest as chem } from './scenarios/chemistryChlorideTest';
import { physicsFreeFall as phys } from './scenarios/physicsFreeFall';
import { createSession, EvidenceSchema, withEngine, type EngineEvidence } from './session';
import { unverifiedItems, unverifiedLabel } from './unverified';

const physicsRun: EngineEvidence = {
  id: 'comparison',
  key: 'comparison',
  at: 1,
  step: 'interact',
  kind: 'engine',
  model: 'phys.projectile',
  title: { vi: 'Rơi tự do', en: 'Free fall' },
  conditions: [],
  quantities: [
    {
      id: 't',
      label: { vi: 't', en: 't' },
      unit: 's',
      condition: 'A',
      value: 1,
      check: 1,
    },
  ],
};

describe('unverified data, the same rule in the three studios', () => {
  it('chemistry: a library mix carries its record status; a mix with no record carries none', () => {
    const rec = mixEvidence(['NaCl', 'AgNO3'], mixOutcome(['NaCl', 'AgNO3']), 1);
    expect(rec.review_status).toBe(reactionById('agcl')?.review_status);
    expect(EvidenceSchema.safeParse(rec).success).toBe(true);
    const none = mixEvidence(['NaCl', 'BaCl2'], mixOutcome(['NaCl', 'BaCl2']), 2);
    expect(none.review_status).toBeUndefined();

    const s = withEngine(withEngine(createSession(chem, 0), rec, null), none, null);
    const keys = unverifiedItems(chem, s).map((i) => (i.kind === 'record' ? i.key : i.kind));
    expect(keys).toEqual([
      ...(chem.review_status === 'pending' ? ['scenario'] : []),
      ...(rec.review_status === 'pending' ? [rec.key] : []),
    ]);
  });

  it('biology: stage and answer-sheet records carry the 3D model data status', () => {
    const b = biologyOf(bio);
    if (!b) throw new Error('biology scenario expected');
    const status = card3d(b.cellType).reviewStatus;
    const stage = stageEvidence(buildTimeline(b.pairs, b.cellType), 'metaphase', b.cellType, 1);
    const sheet = matchEvidence(taskParts(b), {}, 2);
    expect(stage.review_status).toBe(status);
    expect(sheet.review_status).toBe(status);
    const s = withEngine(withEngine(createSession(bio, 0), stage, null), sheet, null);
    expect(unverifiedItems(bio, s).filter((i) => i.kind === 'record')).toHaveLength(
      status === 'pending' ? 2 : 0,
    );
  });

  it('physics: numbers computed by the engine are never listed, the lesson text is', () => {
    const s = withEngine(createSession(phys, 0), physicsRun, null);
    expect(unverifiedItems(phys, s)).toEqual(
      phys.review_status === 'pending'
        ? [{ kind: 'scenario', title: phys.title, teacher: false }]
        : [],
    );
  });

  it('the report and the AI Teacher context list the same items with the same words', () => {
    const rec = mixEvidence(['NaCl', 'AgNO3'], mixOutcome(['NaCl', 'AgNO3']), 1);
    const s = withEngine(createSession(chem, 0), { ...rec, review_status: 'pending' }, null);
    const labels = unverifiedItems(chem, s).map((i) => unverifiedLabel(i, 'vi'));
    expect(labels.length).toBeGreaterThan(0);
    const report = buildReport({ scenario: chem, session: s, locale: 'vi', generatedAt: 0 });
    const context = studioContextText(chem, s, 'vi');
    expect(report).toContain('## Dữ liệu chưa được kiểm duyệt');
    for (const l of labels) {
      expect(report).toContain(`- ${l}`);
      expect(context).toContain(`- ${l}`);
    }
  });
});
