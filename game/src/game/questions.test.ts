import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { questionBanks } from '../content/questions';
import { Registry } from '../core/Registry';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { BUILT_IN_MODELS } from '../simulation/models';
import { addQuestionBanks, buildContent } from './content';
import { labPack } from './labPack';
import { bootTestGame } from './testing';

describe('the question banks (Phase Y-4): a chunk of their own', () => {
  it('are not in the lab pack: none after it loads, every experiment’s once they load', async () => {
    expect('questions' in labPack).toBe(false);
    const { game, logs } = await bootTestGame();
    await game.loadLab();
    expect(game.content.questions.all()).toEqual([]);
    await Promise.all([game.loadQuestions(), game.loadQuestions()]); // one load, shared
    const banks = game.content.questions.all();
    expect(banks.map((b) => b.id).sort()).toEqual(
      game.content.experiments
        .all()
        .map((e) => e.id)
        .sort(),
    );
    expect(banks.every((b) => b.questions.length >= 10)).toBe(true);
    await game.loadQuestions(); // again: nothing added twice
    expect(game.content.questions.all()).toHaveLength(banks.length);
    expect(logs.filter((l) => l.level === 'error')).toEqual([]);
  });

  it('refuses broken banks with every problem, and adds none of them', () => {
    const code = {
      behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
      models: new Registry('simulation model', BUILT_IN_MODELS),
    };
    const content = buildContent({ ...bundledContent, questions: [] }, code);
    const broken = structuredClone(questionBanks) as { id: string; questions: unknown[] }[];
    broken[0]!.questions = broken[0]!.questions.slice(0, 3); // too few
    broken[1]!.id = 'no-such-experiment';
    // Its schema first (the cross-checks wait until every bank reads).
    expect(() => addQuestionBanks(content, code, broken)).toThrow(
      /questions\.0\.questions: Too small.*>=20/,
    );
    expect(content.questions.all()).toEqual([]);
    broken[0] = structuredClone(questionBanks[0]) as (typeof broken)[number];
    expect(() => addQuestionBanks(content, code, broken)).toThrow(
      /no experiment "no-such-experiment"/,
    );
    expect(content.questions.all()).toEqual([]);
  });
});
