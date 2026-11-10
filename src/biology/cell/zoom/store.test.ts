import { beforeEach, describe, expect, it } from 'vitest';
import { CAMERA_MOVE_MS } from '@/ui/three/useThreeHost';
import { cellToDna } from '../../modules';
import { GLIDE_MS, zoomIn, zoomOut } from './hooks';
import { restoreZoom, setZoomLevel, useCellZoom } from './store';

beforeEach(() => {
  useCellZoom.setState({ level: 0, moving: false, labels: null });
});

describe('cell → DNA zoom state', () => {
  it('a file restores one of the six levels and ignores anything else', () => {
    restoreZoom({ level: 3 });
    expect(useCellZoom.getState().level).toBe(3);
    for (const bad of [6, -1, 2.5, '2', null, undefined]) {
      restoreZoom({ level: bad });
      expect(useCellZoom.getState().level).toBe(3);
    }
  });

  it('saves the level in .stemsim files (bindStore)', () => {
    setZoomLevel(4);
    expect(cellToDna.state?.get()).toEqual({ level: 4 });
    cellToDna.state?.set({ level: 1 });
    expect(useCellZoom.getState().level).toBe(1);
  });

  it('zooming without a glide steps at once and stops at both ends', () => {
    zoomOut();
    expect(useCellZoom.getState().level).toBe(0);
    for (let i = 0; i < 8; i++) zoomIn(false);
    expect(useCellZoom.getState().level).toBe(5);
    zoomOut();
    expect(useCellZoom.getState().level).toBe(4);
  });

  it('a glide marks the moment as moving (not to scale) until the next level is set', () => {
    zoomIn(true);
    expect(useCellZoom.getState()).toMatchObject({ level: 0, moving: true });
    // No second step and no zoom out while gliding.
    zoomIn(true);
    zoomOut();
    expect(useCellZoom.getState()).toMatchObject({ level: 0, moving: true });
    setZoomLevel(1);
    expect(useCellZoom.getState()).toMatchObject({ level: 1, moving: false });
  });

  it('the glide lasts as long as the 3D camera move', () => {
    expect(GLIDE_MS).toBe(CAMERA_MOVE_MS);
  });
});
