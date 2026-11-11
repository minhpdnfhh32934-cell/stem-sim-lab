import { expect, type Page } from '@playwright/test';

/**
 * Turns on both overload notices, as the ladder would on a slow machine (slow motion ×0,5 and a
 * lower display quality): the dev server serves the app's own perf store module.
 */
export async function showOverloadNotices(page: Page): Promise<void> {
  await page.evaluate(async (url) => {
    const { usePerfStore } = (await import(
      /* @vite-ignore */ url
    )) as typeof import('../../src/perf/perfStore');
    usePerfStore.setState({ timeScale: 0.5, degraded: true });
  }, '/src/perf/perfStore.ts');
}

/**
 * The notices' strip (`notes`) lies wholly below `above` and shares no pixel with any element
 * matching `clear` (each must be on screen). Read in one go in the page: no locator waits.
 */
export async function expectNoticesBelow(
  page: Page,
  notes: string,
  above: string,
  clear: string,
): Promise<void> {
  const r = await page.evaluate(
    ([n, a, c]) => {
      const box = (el: Element) => el.getBoundingClientRect();
      const strip = document.querySelector(n);
      const top = document.querySelector(a);
      const covered = [...document.querySelectorAll(c)].map((el) => {
        const b = box(el);
        const s = strip ? box(strip) : null;
        return (
          s !== null && s.left < b.right && b.left < s.right && s.top < b.bottom && b.top < s.bottom
        );
      });
      return {
        found: [strip !== null, top !== null, covered.length],
        gap: strip && top ? box(strip).top - box(top).bottom : null,
        covered: covered.filter(Boolean).length,
      };
    },
    [notes, above, clear] as const,
  );
  expect(r.found.slice(0, 2), `${notes} and ${above} on screen`).toEqual([true, true]);
  expect(r.found[2], `${clear} on screen`).toBeGreaterThan(0);
  expect(r.gap ?? -1).toBeGreaterThanOrEqual(-0.5);
  expect(r.covered, 'the notices cover nothing of the view').toBe(0);
}
