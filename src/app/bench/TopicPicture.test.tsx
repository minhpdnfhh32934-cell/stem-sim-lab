import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CATALOG } from '@/app/catalog';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { hasScene } from '@/physics/registry';
import { hasTopicPicture, SHELF_PREVIEWS, shelfPreviewUrl } from './shelfPreviews';
import { TopicPicture } from './TopicPicture';

const repo = (path: string) => resolve(import.meta.dirname, '../../..', path);
const available = Object.values(CATALOG)
  .flat()
  .flatMap((c) => c.topics)
  .filter((t) => t.status === 'available');

afterEach(() => {
  act(() => {
    useSettingsStore.getState().setTheme('system');
  });
});

describe('shelf pictures of the topics without an engine frame (docs/BENCH_DESIGN.md §9.3)', () => {
  it('every topic without a physics engine frame has one, and no other topic does', () => {
    const ids = available.filter((t) => !hasScene(t.id)).map((t) => t.id);
    expect([...SHELF_PREVIEWS].sort()).toEqual([...ids].sort());
    expect(available.every((t) => hasTopicPicture(t.id))).toBe(true);
  });

  it('a small WebP in each look, and the script makes exactly these', () => {
    const script = readFileSync(repo('scripts/bench/shelf-previews.mjs'), 'utf8');
    for (const id of SHELF_PREVIEWS) {
      expect(script).toContain(`'${id}'`);
      for (const theme of ['light', 'dark'] as const) {
        const file = repo(`public/shelf/${id}.${theme}.webp`);
        const head = readFileSync(file).subarray(0, 12).toString('latin1');
        expect(head.startsWith('RIFF') && head.endsWith('WEBP'), file).toBe(true);
        expect(statSync(file).size, file).toBeLessThan(60 * 1024);
      }
    }
  });

  it('the card shows the picture of the current look, and its line art if it cannot load', () => {
    act(() => {
      useSettingsStore.getState().setTheme('dark');
    });
    const { container } = render(
      <TopicPicture topic="mitosis" className="shelf-card__still" fallback={<i data-art />} />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe(shelfPreviewUrl('mitosis', 'dark'));
    expect(img?.getAttribute('alt')).toBe('');
    fireEvent.error(img!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-art]')).not.toBeNull();
  });

  it('physics keeps its engine frame; an unknown topic has no picture', () => {
    expect(hasTopicPicture('obliqueProjectile')).toBe(true);
    expect(hasTopicPicture('mitosis')).toBe(true);
    expect(hasTopicPicture('noSuchTopic')).toBe(false);
    const { container } = render(<TopicPicture topic="obliqueProjectile" className="x" />);
    expect(container.querySelector('canvas.x')).not.toBeNull();
  });
});
