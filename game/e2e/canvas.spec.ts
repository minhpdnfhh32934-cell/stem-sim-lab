import { expect, type Page, test } from '@playwright/test';
import { expectDebug, labSave, menuContinue } from './support';

// The page owns its one canvas (main.ts creates it in the viewport) and the renderer draws on it:
// it neither makes another nor removes this one. The renderer, and the canvas's WebGL context,
// come with the first world scene; the boot only checks for WebGL 2 on a canvas outside the page.

/** Records the WebGL contexts the page asks for, each with where its canvas was at that moment. */
async function recordWebGLContexts(page: Page) {
  await page.addInitScript(() => {
    const made: string[] = [];
    Object.assign(window, { webglContexts: made });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called with .call(this) below
    const getContext = HTMLCanvasElement.prototype.getContext as (
      this: HTMLCanvasElement,
      id: string,
      options?: unknown,
    ) => RenderingContext | null;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      id: string,
      options?: unknown,
    ) {
      // The menu's character picture draws on a canvas of its own, never in the page: left out.
      if (id.startsWith('webgl') && this.dataset.role !== 'portrait')
        made.push(`${id} on ${this.parentElement?.className ?? 'none'}`);
      return getContext.call(this, id, options);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

const webglContexts = (page: Page) =>
  page.evaluate(() => (window as unknown as { webglContexts: string[] }).webglContexts);

test('canvas: the page owns its one canvas, the renderer draws on it, from the menu into the world', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await recordWebGLContexts(page);
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    {
      key: 'simlab.save.slot-1',
      value: JSON.stringify(labSave([3.967, 0, 0], [1.933, 1.6, 7.5])),
    },
  );

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SIMLAB', exact: true })).toBeVisible();
  // One canvas, in the viewport, with no WebGL context yet: the only one made so far was the boot's
  // check, on a canvas outside the page; nobody has drawn on this one (a bare canvas is 300 × 150).
  await expect(page.locator('canvas')).toHaveCount(1);
  const canvas = page.locator('.viewport > canvas');
  await expect(canvas).toHaveCount(1);
  expect(await webglContexts(page)).toEqual(['webgl2 on none']);
  expect(await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual([300, 150]);
  await canvas.evaluate((c) => (c.dataset.seen = 'menu'));

  // Into the world: the renderer's one context, made on that same canvas, which it sized to the
  // window; still the only canvas.
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'physics-lab');
  await expectDebug(page, 'Phase', 'playing');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('.viewport > canvas[data-seen="menu"]')).toHaveCount(1);
  expect(await webglContexts(page)).toEqual(['webgl2 on none', 'webgl2 on viewport']);
  expect(await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual([1280, 720]);
  expect(errors).toEqual([]);
});

test('canvas: without WebGL, boot stops at the systems stage and the canvas leaves with the page', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called with .call(this) below
    const getContext = HTMLCanvasElement.prototype.getContext as (
      this: HTMLCanvasElement,
      id: string,
      options?: unknown,
    ) => RenderingContext | null;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      id: string,
      options?: unknown,
    ) {
      return id.startsWith('webgl') ? null : getContext.call(this, id, options);
    } as typeof HTMLCanvasElement.prototype.getContext;
    // How the canvas leaves the page: by itself (taken out by the renderer), or with the
    // viewport when the error screen replaces the page.
    const removals: string[] = [];
    Object.assign(window, { canvasRemovals: removals });
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (node instanceof HTMLCanvasElement) removals.push('canvas alone');
          else if (node instanceof Element && node.querySelector('canvas')) {
            const screen = [...record.addedNodes].some(
              (added) => added instanceof Element && added.classList.contains('fatal'),
            );
            removals.push(screen ? 'with the page, for the error screen' : 'with its parent');
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto('/');
  const fatal = page.locator('.fatal');
  await expect(fatal.locator('h1')).toHaveText('SIMLAB could not start');
  await expect(fatal.locator('p')).toHaveText('Stage: systems');
  await expect(fatal.locator('pre')).toContainText('WebGL is not available in this browser');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as unknown as { canvasRemovals: string[] }).canvasRemovals),
  ).toEqual(['with the page, for the error screen']);
});
