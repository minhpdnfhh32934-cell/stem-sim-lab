import { describe, expect, it } from 'vitest';
import { STAGE3D_NAME } from '@/biology/division/mitosis3d/components';
import {
  MODEL_STAGE,
  STAGES_3D,
  buildTimeline,
  heldOnPlate,
} from '@/biology/division/mitosis3d/timeline';
import { countsOf, runDivision } from '@/biology/division/division';
import { validateScenario, type StudioScenario } from '../scenario';
import { biologyMitosisMetaphase } from '../scenarios/biologyMitosisMetaphase';
import {
  answerStage,
  arrangementAt,
  bindingProblems,
  biologyOf,
  bioVerdict,
  stagesWhere,
} from './model';

const CELLS = ['animal', 'plant'] as const;
const label = (s: keyof typeof STAGE3D_NAME) => STAGE3D_NAME[s].vi;

describe('stage prediction checked against the 3D model', () => {
  it('the model singles out exactly one stage for "double chromosomes in one row at the equator"', () => {
    for (const cell of CELLS) {
      for (const pairs of [1, 2, 3, 4]) {
        const tl = buildTimeline(pairs, cell);
        const found = stagesWhere(tl, 'equatorRow');
        expect(found, `${cell}, 2n = ${String(2 * pairs)}`).toHaveLength(1);
        const stage = found[0]!;
        const a = arrangementAt(tl, stage);
        // Every chromosome of that stage is double and has its centromere on the plane.
        expect(a.chromosomes).toBe(2 * pairs);
        expect(a.double).toBe(a.chromosomes);
        expect(a.onPlane).toBe(a.chromosomes);
        // The stage the model finds is the one whose stage data says "line up at the
        // equatorial plate" (the model's stage note), not a hand-written answer.
        expect(MODEL_STAGE[stage]).toBe('metaphase');
      }
    }
  });

  it('the plate count follows the stage meaning in the model, never the drawn positions', () => {
    for (const cell of CELLS) {
      for (const pairs of [1, 2, 3, 4]) {
        const tl = buildTimeline(pairs, cell);
        for (const stage of STAGES_3D) {
          const time = tl.keyTime(stage);
          const held = heldOnPlate(stage, tl.stageAt(time).u);
          const a = arrangementAt(tl, stage);
          // Interphase and prophase centromeres may be drawn close to x = 0 by chance: they
          // never count. Only the stage's meaning (metaphase, after the pull) puts them there.
          expect(held, `${cell} ${stage}`).toBe(stage === 'metaphase');
          expect(a.onPlane, `${cell} ${stage}`).toBe(held ? a.double : 0);
          // Cross-check: while the model holds them there, the picture draws them on x = 0.
          if (held) {
            for (const c of tl.stateAt(time).centromeres) {
              expect(Math.abs(c.position[0])).toBeLessThan(1e-9);
            }
          }
        }
      }
    }
  });

  it('no chromosome is held on the plate before the metaphase pull is complete', () => {
    expect(heldOnPlate('metaphase', 0)).toBe(false);
    expect(heldOnPlate('metaphase', 0.3)).toBe(false);
    expect(heldOnPlate('metaphase', 0.45)).toBe(true);
    expect(heldOnPlate('metaphase', 1)).toBe(true);
    for (const stage of STAGES_3D.filter((s) => s !== 'metaphase')) {
      expect(heldOnPlate(stage, 0), stage).toBe(false);
      expect(heldOnPlate(stage, 1), stage).toBe(false);
    }
  });

  it('chromosome counts per stage come from the bookkeeping model (runDivision)', () => {
    const pairs = 2;
    const tl = buildTimeline(pairs, 'animal');
    const model = runDivision('mitosis', pairs);
    for (const stage of ['g1', 'g2', 'prophase', 'metaphase', 'anaphase'] as const) {
      const m = model.find((x) => x.stage === MODEL_STAGE[stage])!;
      expect(arrangementAt(tl, stage).chromosomes, stage).toBe(countsOf(m).chromosomes);
    }
  });

  it('other stages do not satisfy the question (no stage is right by default)', () => {
    const tl = buildTimeline(2, 'animal');
    const answer = answerStage(tl, 'equatorRow');
    for (const stage of STAGES_3D) {
      if (stage === answer) continue;
      const a = arrangementAt(tl, stage);
      expect(a.chromosomes > 0 && a.double === a.chromosomes && a.onPlane === a.chromosomes).toBe(
        false,
      );
    }
  });

  it('the verdict compares the prediction with the computed stage only', () => {
    const tl = buildTimeline(2, 'animal');
    const answer = answerStage(tl, 'equatorRow');
    const right = { choice: answer!, label: 'x', at: 1 };
    const wrong = { choice: 'anaphase', label: 'y', at: 1 };
    expect(bioVerdict(answer, right, label)).toEqual({
      correct: answer,
      correctLabel: label(answer!),
      match: true,
    });
    expect(bioVerdict(answer, wrong, label).match).toBe(false);
    expect(bioVerdict(answer, null, label).match).toBeNull();
    expect(bioVerdict(null, right, label)).toEqual({
      correct: null,
      correctLabel: null,
      match: null,
    });
  });
});

describe('biology scenario binding', () => {
  it('the built-in scenario is valid and runs on the model', () => {
    const r = validateScenario(biologyMitosisMetaphase);
    expect(r.ok).toBe(true);
    const b = biologyOf(biologyMitosisMetaphase)!;
    expect(bindingProblems(b)).toEqual([]);
    // Numbers and stage names in its teaching copy agree with the model it runs on.
    expect(b.question.vi).toContain(`2n = ${String(2 * b.pairs)}`);
    const answer = answerStage(buildTimeline(b.pairs, b.cellType), b.stageQuestion)!;
    expect(biologyMitosisMetaphase.expectedConclusion.vi).toContain(STAGE3D_NAME[answer].vi);
    expect(biologyMitosisMetaphase.expectedConclusion.en).toContain(STAGE3D_NAME[answer].en);
  });

  it('unknown parts and parts of the other cell type are reported, never shown', () => {
    const base = biologyOf(biologyMitosisMetaphase)!;
    expect(bindingProblems({ ...base, parts: ['membrane', 'flagellum'] })).toEqual(['unknownPart']);
    expect(bindingProblems({ ...base, parts: ['membrane', 'cellWall'] })).toEqual(['wrongCell']);
  });

  it('schema: duplicate parts and an activity without the interact step are rejected', () => {
    const dup: StudioScenario = {
      ...biologyMitosisMetaphase,
      binding: { ...biologyOf(biologyMitosisMetaphase)!, parts: ['membrane', 'membrane'] },
    };
    expect(validateScenario(dup).ok).toBe(false);
    const noInteract = {
      ...biologyMitosisMetaphase,
      steps: ['predict', 'observe', 'explain', 'conclude', 'report'],
      completion: { ...biologyMitosisMetaphase.completion, observation: false },
    };
    const r = validateScenario(noInteract);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/needs step interact/);
  });
});
