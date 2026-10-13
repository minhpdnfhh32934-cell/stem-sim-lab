import { describe, expect, it } from 'vitest';
import { meiosis, mitosis } from '../../modules';
import { STAGES } from '../division';
import { claimStageIndex, setDivisionState, stageIndexKind } from '../stageIndex';
import { useDivisionStore } from '../state';

describe('mitosis module state (files, history, undo)', () => {
  it('saves and restores the 3D inputs', () => {
    useDivisionStore.setState({ pairs: 3, cellType: 'plant', view3d: false, speed: 2 });
    const saved = mitosis.state!.get();
    expect(saved).toMatchObject({ pairs: 3, cellType: 'plant', view3d: false, speed: 2 });
    useDivisionStore.setState({ pairs: 1, cellType: 'animal', view3d: true, speed: 1 });
    mitosis.state!.set(saved);
    expect(useDivisionStore.getState()).toMatchObject({
      pairs: 3,
      cellType: 'plant',
      view3d: false,
      speed: 2,
    });
  });

  it('ignores unknown cell types and speeds from a file', () => {
    useDivisionStore.setState({ cellType: 'animal', speed: 1, view3d: true });
    mitosis.state!.set({ cellType: 'fungus', speed: 7, view3d: 'yes' });
    expect(useDivisionStore.getState()).toMatchObject({
      cellType: 'animal',
      speed: 1,
      view3d: true,
    });
  });

  it('drops 2n outside the selector and stage indexes outside the stage list', () => {
    setDivisionState('mitosis', { pairs: 2, index: 1 });
    for (const pairs of [0, 5, 2.5, -1, 1e9])
      for (const index of [-1, 1.5, STAGES.mitosis.length, 99]) {
        mitosis.state!.set({ pairs, index });
        expect(useDivisionStore.getState()).toMatchObject({ pairs: 2, index: 1 });
      }
    // Meiosis has more stages: its last index is valid there, not one past it.
    meiosis.state!.set({ index: STAGES.meiosis.length - 1, pairs: 4 });
    expect(useDivisionStore.getState()).toMatchObject({
      pairs: 4,
      index: STAGES.meiosis.length - 1,
    });
    meiosis.state!.set({ index: STAGES.meiosis.length, pairs: 0 });
    expect(useDivisionStore.getState()).toMatchObject({
      pairs: 4,
      index: STAGES.meiosis.length - 1,
    });
    mitosis.state!.set({ index: STAGES.mitosis.length - 1, pairs: 1 });
    expect(useDivisionStore.getState()).toMatchObject({
      pairs: 1,
      index: STAGES.mitosis.length - 1,
    });
  });

  it('a restored stage index belongs to its division', () => {
    // Opening a mitosis file while the last stage view was meiosis keeps the file's stage.
    claimStageIndex('meiosis');
    mitosis.state!.set({ index: 4 });
    expect(stageIndexKind()).toBe('mitosis');
    claimStageIndex('mitosis');
    expect(useDivisionStore.getState().index).toBe(4);
    // And the reverse: a meiosis file, then the meiosis view.
    meiosis.state!.set({ index: 7 });
    expect(stageIndexKind()).toBe('meiosis');
    claimStageIndex('meiosis');
    expect(useDivisionStore.getState().index).toBe(7);
    // Its index is not a mitosis stage: the mitosis view starts again at G1.
    claimStageIndex('mitosis');
    expect(useDivisionStore.getState().index).toBe(0);
  });
});
