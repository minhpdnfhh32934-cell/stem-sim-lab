import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { layoutLabels, overlaps, type LabelAnchor } from '@/ui/three/labels';
import { fakeRenderer } from '@/ui/three/testing';
import { setDivisionState } from '../stageIndex';
import { COMPONENTS, componentVisible } from './components';
import { Mitosis3DView } from './Mitosis3DView';
import { stateFor, timelineFor, useMitosis3D } from './store';

const SIZE = { w: 900, h: 560 };

beforeEach(() => {
  // jsdom has no layout: the stage and every label get a size.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(SIZE.w);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(SIZE.h);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(90);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(22);
  setDivisionState('mitosis', { pairs: 2, index: 0, cellType: 'animal', view3d: true, speed: 1 });
  useMitosis3D.setState({
    t: 0,
    playing: false,
    selected: null,
    camera: 'overview',
    viewNonce: 0,
    webglFailed: false,
    active: false,
    cellLocked: false,
    labels: null,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useSettingsStore.setState({ uiMode: 'basic' });
});

const shownLabels = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('.m3d__labels .three-label')]
    .filter((e) => !e.hidden)
    .map((e) => e.textContent);

describe('mitosis 3D name labels ("Hiện tên")', () => {
  it('Basic mode: names of the parts seen now, beside the picture, hidden from screen readers', async () => {
    useSettingsStore.setState({ uiMode: 'basic' });
    const { factory } = fakeRenderer();
    const view = render(<Mitosis3DView createRenderer={factory} />);
    const tl = timelineFor(2, 'animal');
    act(() => {
      useMitosis3D.setState({ t: tl.keyTime('metaphase') });
    });
    await waitFor(() => {
      expect(shownLabels(view.container).length).toBeGreaterThan(2);
    });
    const layer = view.container.querySelector('.m3d__labels');
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    // Every name is a part of the model's list that can be seen at this moment.
    const st = stateFor(tl, useMitosis3D.getState().t);
    const visible = Object.entries(COMPONENTS)
      .filter(([id]) => componentVisible(id as keyof typeof COMPONENTS, st))
      .map(([, c]) => c.name.vi);
    for (const name of shownLabels(view.container)) expect(visible).toContain(name);
    expect(shownLabels(view.container)).toContain(COMPONENTS.doubleChromosome.name.vi);
    // The toggle hides them (and says so).
    const toggle = screen.getByRole('button', { name: 'Hiện tên các bộ phận' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(shownLabels(view.container)).toEqual([]);
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('Advanced mode and a lesson holding the model start without names', () => {
    useSettingsStore.setState({ uiMode: 'advanced' });
    const { factory } = fakeRenderer();
    render(<Mitosis3DView createRenderer={factory} />);
    expect(screen.getByRole('button', { name: 'Hiện tên các bộ phận' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    cleanup();
    useSettingsStore.setState({ uiMode: 'basic' });
    useMitosis3D.setState({ cellLocked: true });
    render(<Mitosis3DView createRenderer={factory} />);
    expect(screen.getByRole('button', { name: 'Hiện tên các bộ phận' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('the debug hook is kept under its old name too', () => {
    const { factory } = fakeRenderer();
    const view = render(<Mitosis3DView createRenderer={factory} />);
    expect(window.__simlabMitosis3d).toBeDefined();
    expect(window.__simlab3d?.mitosis).toBe(window.__simlabMitosis3d);
    view.unmount();
    expect(window.__simlab3d?.mitosis).toBeUndefined();
  });
});

describe('label layout', () => {
  const anchor = (id: string, x: number, y: number, visible = true): LabelAnchor => ({
    id,
    x,
    y,
    visible,
    w: 80,
    h: 20,
  });
  const safe = { left: 0, top: 50, right: 600, bottom: 400 };

  it('columns left and right of the parts, never overlapping, inside the safe area', () => {
    const anchors = [
      anchor('a', 290, 200),
      anchor('b', 300, 202),
      anchor('c', 305, 205),
      anchor('d', 310, 207),
      anchor('e', 280, 199),
      anchor('f', 295, 201),
    ];
    const placed = layoutLabels(anchors, safe);
    expect(placed).toHaveLength(6);
    const size = () => ({ w: 80, h: 20 });
    for (const a of placed) {
      expect(a.x).toBeGreaterThanOrEqual(safe.left);
      expect(a.x + 80).toBeLessThanOrEqual(safe.right);
      expect(a.y).toBeGreaterThanOrEqual(safe.top);
      expect(a.y + 20).toBeLessThanOrEqual(safe.bottom);
      for (const b of placed) if (a !== b) expect(overlaps(a, b, size)).toBe(false);
    }
    expect(placed.filter((p) => p.side === 'left')).toHaveLength(3);
  });

  it('parts behind the camera or off the safe area get no label; the cap keeps the first ones', () => {
    const placed = layoutLabels(
      [
        anchor('a', 100, 100),
        anchor('b', 100, 20),
        anchor('c', 200, 100, false),
        anchor('d', 300, 300),
      ],
      safe,
      { cap: 1 },
    );
    expect(placed.map((p) => p.id)).toEqual(['a']);
  });

  it('too many labels for the height: the least important are left out', () => {
    const many = Array.from({ length: 30 }, (_, i) => anchor(`p${String(i)}`, 300 + (i % 2), 100));
    const placed = layoutLabels(many, { left: 0, top: 0, right: 600, bottom: 200 });
    expect(placed.length).toBeLessThan(30);
    const kept = new Set(placed.map((p) => p.id));
    expect(kept.has('p0')).toBe(true);
    expect(kept.has('p29')).toBe(false);
  });
});
