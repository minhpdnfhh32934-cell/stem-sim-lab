import { describe, expect, it } from 'vitest';
import { mitosis } from '../../modules';
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
});
