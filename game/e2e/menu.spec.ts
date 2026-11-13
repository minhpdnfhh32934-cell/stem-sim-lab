import { expect, type Page, test } from '@playwright/test';
import { expectDebug, menuNewGame, openSettings, closeSettings } from './support';

// The main menu's sky and emblem: the stars drift slowly behind the panel, science glyphs now and
// then cross the sky far away, and the emblem above the name barely moves — all decorative, never
// in the way — everything stands still when the browser asks for reduced motion, and stops with
// the menu once a game starts.

/** The running animation and the current transform of each element `selector` matches. */
const motion = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els.map((e) => {
      const style = getComputedStyle(e);
      return { animation: style.animationName, transform: style.transform };
    }),
  );

const EMBLEM_PARTS =
  '.menu-emblem .emblem-orbit, .menu-emblem .emblem-flight, .menu-emblem .emblem-strobe, .menu-emblem .emblem-glow';

/**
 * Each star layer's drift: its x (px, its transform's translation), its own tile (px) and its
 * animation's own clock (s) — read together, so a speed can be measured against the animation's
 * time, not the test's.
 */
const drift = (page: Page) =>
  page.locator('.menu-stars').evaluateAll((els) =>
    els.map((e) => ({
      x: new DOMMatrix(getComputedStyle(e).transform).m41,
      tile: parseFloat(getComputedStyle(e).getPropertyValue('--tile')),
      t: Number(e.getAnimations()[0]?.currentTime ?? 0) / 1000,
    })),
  );

test('menu sky and emblem: slow motion behind the panel, still under reduced motion, stopped in the game', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SIMLAB', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1); // no second canvas: all of it is CSS and SVG
  const sky = page.locator('.menu-sky');
  await expect(sky).toHaveAttribute('aria-hidden', 'true');
  expect(await sky.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none');
  await expect(page.locator('.menu-stars')).toHaveCount(3);

  // The emblem: beside the heading, not in it, hidden from assistive technology.
  const emblem = page.locator('.menu-brand > svg.menu-emblem');
  await expect(emblem).toBeVisible();
  await expect(emblem).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('h1 svg')).toHaveCount(0);

  // The meteors: a fixed pool of four glyphs in the sky, taking no clicks.
  const meteors = page.locator('.menu-sky > .menu-meteor');
  await expect(meteors).toHaveCount(4);
  expect(
    await meteors.evaluateAll((els) => els.map((e) => getComputedStyle(e).pointerEvents)),
  ).toEqual(['none', 'none', 'none', 'none']);

  // Moving: the stars drift; in the emblem the strobe images light in turn with the glow flaring,
  // the trajectory flows and the satellite circles; each glyph runs its own crossing.
  const stars = await motion(page, '.menu-stars');
  const parts = await motion(page, EMBLEM_PARTS);
  expect(stars.map((l) => l.animation)).toEqual(['menu-drift', 'menu-drift', 'menu-drift']);
  expect(parts.map((p) => p.animation)).toEqual([
    'emblem-orbit',
    'emblem-flight',
    'emblem-strobe',
    'emblem-strobe',
    'emblem-strobe',
    'emblem-strobe',
    'emblem-flare',
  ]);
  // The sweep runs launch to landing: each strobe image lights later than the one before it.
  expect(
    await page
      .locator('.emblem-strobe')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).animationDelay)),
  ).toEqual(['0s', '0.25s', '0.75s', '1s']);
  expect((await motion(page, '.menu-meteor')).map((m) => m.animation)).toEqual([
    'meteor-flask',
    'meteor-helix',
    'meteor-apple',
    'meteor-pendulum',
  ]);
  // The stars visibly drift, all to the right, nearer layers faster (near, mid, far: about 11, 7
  // and 4 px/s), each speed measured over at least 1.5 s of its own animation clock.
  const start = await drift(page);
  await expect
    .poll(async () => Math.min(...(await drift(page)).map((d, i) => d.t - (start[i]?.t ?? 0))), {
      timeout: 15_000,
    })
    .toBeGreaterThan(1.5);
  const speeds = (await drift(page)).map((d, i) => {
    const from = start[i] ?? d;
    const dx = (((d.x - from.x) % d.tile) + d.tile) % d.tile; // a wrap past the tile is no jump back
    return dx / (d.t - from.t);
  });
  for (const [i, [low, high]] of [
    [9, 13],
    [5.5, 8.5],
    [3, 5],
  ].entries()) {
    expect(speeds[i], `layer ${i}: ${speeds[i]} px/s`).toBeGreaterThan(low ?? 0);
    expect(speeds[i], `layer ${i}: ${speeds[i]} px/s`).toBeLessThan(high ?? 0);
  }
  await expect
    .poll(async () => (await motion(page, '.emblem-orbit'))[0]?.transform)
    .not.toBe(parts[0]?.transform);

  // Never focused: Tab goes through the menu's controls only.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => {
        const at = document.activeElement;
        return at instanceof Element && at.closest('.menu-sky, .menu-emblem') !== null;
      }),
    ).toBe(false);
  }

  // The panel stays above the sky: its controls take the clicks.
  await openSettings(page);
  await expect(page.getByLabel('English')).toBeChecked();
  await closeSettings(page);

  // Wide and narrow windows: the emblem is shown whole, and nothing widens the page or the menu.
  for (const [width, height] of [
    [1280, 720],
    [430, 860],
    [360, 640],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const menu = document.querySelector('.menu');
          return Math.max(
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
            menu ? menu.scrollWidth - menu.clientWidth : 0,
          );
        }),
      )
      .toBeLessThanOrEqual(0);
    await expect(emblem).toBeVisible();
    const box = await emblem.boundingBox();
    expect(box && box.width > 0 && box.x >= 0 && box.x + box.width <= width, `${width} px`).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  // Reduced motion: no motion at all — stars, emblem and glyphs — and the glyphs stay away.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const layer of await motion(page, '.menu-stars')) {
    expect(layer).toEqual({ animation: 'none', transform: 'none' });
  }
  for (const part of await motion(page, EMBLEM_PARTS)) expect(part.animation).toBe('none');
  // Still, the emblem is drawn as it always was: strobe images and glow at their own opacity.
  expect(
    await page.locator('.emblem-strobe, .emblem-glow').evaluateAll((els) =>
      els.map((e) => {
        const style = getComputedStyle(e);
        return `${style.fillOpacity} ${style.opacity}`;
      }),
    ),
  ).toEqual(['0.4 1', '0.65 1', '0.65 1', '0.4 1', '0.18 1']);
  expect(
    await meteors.evaluateAll((els) =>
      els.map((e) => {
        const style = getComputedStyle(e);
        return `${style.animationName} ${style.opacity}`;
      }),
    ),
  ).toEqual(['none 0', 'none 0', 'none 0', 'none 0']);
  await expect(emblem).toBeVisible(); // still drawn, only still
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // In the game the menu, and its sky and emblem with it, is gone.
  await menuNewGame(page);
  await expectDebug(page, 'Phase', 'playing');
  await expect(sky).toBeHidden();
  await expect(emblem).toBeHidden();
  expect(errors).toEqual([]);
});

/**
 * The trail as drawn: the layer's opacity, the head's position, and each segment's start (its
 * transform's translation) and length (the scale of its rotated 1 px box), front to back.
 */
const trailState = (page: Page) =>
  page.locator('.menu-trail').evaluate((root) => {
    const at = (e: Element) => new DOMMatrix(getComputedStyle(e).transform);
    const head = at(root.querySelector('.menu-trail-head') ?? root);
    return {
      opacity: Number(getComputedStyle(root).opacity),
      head: { x: head.m41, y: head.m42 },
      segments: [...root.querySelectorAll('.menu-trail-segment')].map((e) => {
        const m = at(e);
        return { x: m.m41, y: m.m42, length: Math.hypot(m.a, m.b) };
      }),
    };
  });

test('menu cursor trail: one faint tapering line behind the mouse, out when still, off under reduced motion, stopped in the game', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SIMLAB', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await page.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(true);
  const trail = page.locator('.menu-trail');
  await expect(trail).toHaveAttribute('aria-hidden', 'true');
  expect(await trail.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none');
  // A fixed pool: one head and eleven segments, made with the menu.
  await expect(trail.locator('.menu-trail-head')).toHaveCount(1);
  await expect(trail.locator('.menu-trail-segment')).toHaveCount(11);
  expect((await trailState(page)).opacity).toBe(0); // nothing before the mouse moves

  // Count every element added to the menu from here on: the trail creates none as it runs.
  await page.evaluate(() => {
    const added = { count: 0 };
    Object.assign(window, { trailAdded: added });
    new MutationObserver((records) => {
      for (const r of records) added.count += r.addedNodes.length;
    }).observe(document.querySelector('.menu') ?? document.body, {
      childList: true,
      subtree: true,
    });
  });

  // Moving: the line starts at the pointer, its segments joined end to end, never longer than
  // 110 px however fast the stroke; the front segments brighter than the tail.
  await page.mouse.move(200, 600);
  await page.mouse.move(900, 300, { steps: 6 }); // a fast stroke
  await expect
    .poll(async () => {
      const { opacity, head } = await trailState(page);
      return opacity > 0 ? Math.hypot(head.x - 900, head.y - 300) : Infinity;
    })
    .toBeLessThan(1);
  const lit = await trailState(page);
  expect(Math.hypot((lit.segments[0]?.x ?? 0) - 900, (lit.segments[0]?.y ?? 0) - 300)).toBeLessThan(
    1,
  );
  expect(lit.segments.reduce((sum, s) => sum + s.length, 0)).toBeLessThanOrEqual(110.5);
  const fade = await trail
    .locator('.menu-trail-segment')
    .evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).opacity)));
  for (let i = 1; i < fade.length; i++) expect(fade[i]).toBeLessThan(fade[i - 1] ?? 0);
  // Still: it goes out entirely.
  await expect.poll(async () => (await trailState(page)).opacity, { timeout: 5000 }).toBe(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { trailAdded: { count: number } }).trailAdded.count,
    ),
  ).toBe(0);

  // The panel's controls still take the clicks.
  await openSettings(page);
  await page.getByLabel('English').check();
  await expect(page.getByLabel('English')).toBeChecked();

  // Reduced motion: the trail is off, like the stars, the emblem and the glyphs.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(trail).toBeHidden();
  await page.mouse.move(300, 300, { steps: 10 });
  await page.waitForTimeout(300);
  expect((await trailState(page)).opacity).toBe(0);
  for (const part of await motion(page, `.menu-stars, .menu-meteor, ${EMBLEM_PARTS}`)) {
    expect(part.animation).toBe('none');
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // In the game the menu and its trail are hidden, and the trail is no longer moved.
  await menuNewGame(page);
  await expectDebug(page, 'Phase', 'playing');
  await expect(trail).toBeHidden();
  const frozen = await trailState(page);
  await page.mouse.move(100, 100, { steps: 10 });
  await page.waitForTimeout(500);
  expect(await trailState(page)).toEqual(frozen);
  expect(errors).toEqual([]);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 860 } });

  test('menu cursor trail: off for a coarse pointer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'SIMLAB', exact: true })).toBeVisible();
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await expect(page.locator('.menu-trail')).toBeHidden();
    await page.mouse.move(100, 100);
    await page.mouse.move(300, 500, { steps: 10 });
    await page.waitForTimeout(300);
    expect((await trailState(page)).opacity).toBe(0);
  });
});
