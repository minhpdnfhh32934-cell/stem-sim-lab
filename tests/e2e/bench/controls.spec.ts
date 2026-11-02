import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openLab, openTopic } from '../nav';

/**
 * The bench's controls after the uiverse kit B (#115; fixes in docs/BENCH_DESIGN.md §12): target
 * sizes, focus rings on the frame and on paper, keyboard paths, reduced motion and axe.
 */

async function openProjectile(page: Page) {
  await openTopic(page, 'Vật lý', 'Ném xiên');
  await expect(page.locator('.stage__hud-title')).toHaveText('Ném xiên', { timeout: 20_000 });
}

/** Width and height of what a pointer can hit (a hidden radio or a switch: its label). */
async function target(l: Locator) {
  return l.evaluate((el) => {
    const hit = el.matches('input') ? (el.closest('label') ?? el) : el;
    const r = hit.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), what: hit.outerHTML.slice(0, 90) };
  });
}

/**
 * The focused control's ring: its colour against the surface it is drawn on (the control's own
 * background for an inset ring, else the first opaque background around it), as a WCAG ratio.
 */
async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const drawn = (c: Element | null): c is HTMLElement => {
      if (!(c instanceof HTMLElement)) return false;
      const s = getComputedStyle(c);
      const r = c.getBoundingClientRect();
      return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 && r.width > 4;
    };
    const ring = [el, el.nextElementSibling, el.closest('.param__num'), el.closest('label')].find(
      drawn,
    );
    if (!ring) return { what: el.outerHTML.slice(0, 90), ratio: 0 };
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const style = getComputedStyle(ring);
    let at: HTMLElement | null = parseFloat(style.outlineOffset) < 0 ? ring : ring.parentElement;
    while (at && (rgb(getComputedStyle(at).backgroundColor)[3] ?? 1) === 0) at = at.parentElement;
    const lum = ([r = 0, g = 0, b = 0]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const a = lum(rgb(style.outlineColor));
    const b = lum(rgb(getComputedStyle(at ?? document.body).backgroundColor));
    return {
      what: el.outerHTML.slice(0, 90),
      ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    };
  });
}

async function expectRings(page: Page, controls: Locator, min: number) {
  const n = await controls.count();
  expect(n).toBeGreaterThanOrEqual(min);
  // A key press first, so a programmatic focus shows the keyboard ring (:focus-visible).
  await page.keyboard.press('Shift');
  for (let i = 0; i < n; i++) {
    const c = controls.nth(i);
    if (!(await c.isVisible()) || (await c.isDisabled())) continue;
    await c.focus();
    const ring = await focusRing(page);
    expect(ring.ratio, ring.what).toBeGreaterThanOrEqual(3);
  }
}

const FRAME =
  '[data-surface="frame"] :is(button, input, select, [tabindex]):not([tabindex="-1"] *)';

test('targets: 40 px on the bench, the speed steps fill their 168×40 slot', async ({ page }) => {
  await openProjectile(page);
  const controls = page.locator(`${FRAME}, .tray button, .tray input[type="range"], .param__num`);
  const n = await controls.count();
  expect(n).toBeGreaterThan(20);
  for (let i = 0; i < n; i++) {
    const c = controls.nth(i);
    if (!(await c.isVisible())) continue;
    const t = await target(c);
    expect(Math.min(t.w, t.h), t.what).toBeGreaterThanOrEqual(40);
  }
  const speed = await page.locator('.bench-speed').boundingBox();
  expect(speed && [Math.round(speed.width), Math.round(speed.height)]).toEqual([168, 40]);
  for (const step of await page.locator('.bench-speed label').all()) {
    const t = await target(step);
    expect([t.w, t.h]).toEqual([56, 40]);
  }
  // The main action keeps its 144 px whatever it says, so D1 stays at x168.
  const play = page.locator('.bench-play');
  const d1 = page.getByRole('button', { name: 'Bước tiếp theo (.)' });
  for (const name of ['Chạy (Space)', 'Tạm dừng (Space)']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
    expect((await play.boundingBox())?.width).toBe(144);
    expect(Math.round((await d1.boundingBox())?.x ?? 0)).toBe(168);
    await play.click();
  }
});

test('targets: icon buttons grow to 48 px on a touch screen', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: 'tests/e2e/bench/storage-state.json',
    baseURL: 'http://localhost:1420',
    locale: 'vi-VN',
    viewport: { width: 1366, height: 768 },
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await openProjectile(page);
  expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(true);
  const icons = page.locator('[data-surface="frame"] .icon-btn, .tray .panel__header .icon-btn');
  expect(await icons.count()).toBeGreaterThan(4);
  for (const icon of await icons.all()) {
    if (!(await icon.isVisible())) continue;
    const t = await target(icon);
    expect(Math.min(t.w, t.h), t.what).toBeGreaterThanOrEqual(48);
  }
  await ctx.close();
});

test('focus rings reach 3 : 1 on the frame and on paper, in light and dark', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await openProjectile(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
    await expectRings(page, page.locator(FRAME), 15);
    await expectRings(page, page.locator('.tray :is(button, input):not([tabindex="-1"])'), 10);
    await page.getByRole('tab', { name: 'Đồ thị' }).click();
    await expectRings(page, page.locator('.notebook__drawer :is(button, input)'), 3);
    // The tray folded: its spine is frame.
    await page.getByRole('button', { name: 'Thu gọn khay' }).click();
    await expectRings(page, page.getByRole('button', { name: 'Mở khay Điều chỉnh' }), 1);
    await page.getByRole('button', { name: 'Mở khay Điều chỉnh' }).click();
    await page.getByRole('tab', { name: 'Đồ thị' }).click();
    await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
    await page.getByRole('switch', { name: 'Giao diện tối' }).last().waitFor();
    await expectRings(page, page.locator('.settings-dialog .theme-switch :is(input, button)'), 2);
    await page.keyboard.press('Escape');
    // The file menu opens from the frame but is paper again.
    await page.getByRole('button', { name: 'Tệp', exact: true }).click();
    await expectRings(page, page.getByRole('menuitem'), 5);
    await page.getByRole('button', { name: 'Tệp', exact: true }).click();
  }
});

test('keyboard: speed steps, the light / dark switch, − / +, Esc hides a tooltip', async ({
  page,
}) => {
  await openProjectile(page);
  const speed = page.getByRole('group', { name: 'Tốc độ phát' });
  await speed.getByRole('radio', { name: '1×' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(speed.getByRole('radio', { name: '2×' })).toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(speed.getByRole('radio', { name: '0,5×' })).toBeChecked();

  const html = page.locator('html');
  const dark = page.locator('.bench-header').getByRole('switch', { name: 'Giao diện tối' });
  const before = await html.getAttribute('data-theme');
  await dark.focus();
  await page.keyboard.press('Space');
  await expect(html).not.toHaveAttribute('data-theme', before ?? '');
  await page.keyboard.press('Space');
  await expect(html).toHaveAttribute('data-theme', before ?? '');

  // − / + move one slider step; the slider says the value with its unit.
  const v0 = page.getByRole('slider', { name: 'Vận tốc ban đầu' });
  await expect(v0).toHaveAttribute('aria-valuetext', '15 m/s');
  await page.getByRole('button', { name: 'Tăng Vận tốc ban đầu' }).click();
  await expect(v0).not.toHaveAttribute('aria-valuetext', '15 m/s');
  await page.getByRole('button', { name: 'Giảm Vận tốc ban đầu' }).click();
  await expect(v0).toHaveAttribute('aria-valuetext', '15 m/s');
  // The number box is described by its unit.
  await expect(page.getByRole('textbox', { name: 'Vận tốc ban đầu' })).toHaveAccessibleDescription(
    'm/s',
  );

  // A tooltip shown by keyboard focus goes with Esc, the focus stays.
  const step = page.getByRole('button', { name: 'Bước tiếp theo (.)' });
  // A key press after the clicks above: the next focus is a keyboard one (:focus-visible).
  await page.keyboard.press('Shift');
  await step.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Bước tiếp theo (.)');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(step).toBeFocused();
});

test('reduced motion: nothing on the bench has a transition or an animation left', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openProjectile(page);
  await page.getByRole('tab', { name: 'Đồ thị' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Đồ thị' })).toBeVisible();
  const moving = await page.evaluate(() => {
    const out: string[] = [];
    const busy = (s: CSSStyleDeclaration) =>
      s.transitionDuration.split(',').some((d) => parseFloat(d) > 0) ||
      (s.animationName !== 'none' && s.animationDuration.split(',').some((d) => parseFloat(d) > 0));
    for (const el of document.querySelectorAll('*'))
      for (const pseudo of [null, '::before', '::after'])
        if (busy(getComputedStyle(el, pseudo)))
          out.push(`${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}${pseudo ?? ''}`);
    return out;
  });
  expect(moving).toEqual([]);
});

test('axe finds nothing serious on the bench screens', async ({ page }) => {
  const serious = async (screen: string) => {
    const result = await new AxeBuilder({ page }).analyze();
    return result.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${screen}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`);
  };
  const found: string[] = [];
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Virtual Lab/ })).toBeVisible({ timeout: 20_000 });
  found.push(...(await serious('launch')));
  await openLab(page);
  found.push(...(await serious('library')));
  await openProjectile(page);
  found.push(...(await serious('bench')));
  await page.getByRole('tab', { name: 'Đồ thị' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Đồ thị' })).toBeVisible();
  found.push(...(await serious('notebook')));
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  found.push(...(await serious('settings')));
  expect(found).toEqual([]);
});

test('#120: a long topic name ends in "…"; the graph legend is one row under the plot', async ({
  page,
}) => {
  await openProjectile(page);
  const h1 = page.getByRole('heading', { level: 1, name: 'Ném xiên' });
  const cut = () =>
    h1.evaluate((el) => {
      const s = getComputedStyle(el);
      return [
        s.display,
        s.overflowX,
        s.textOverflow,
        s.whiteSpace,
        el.scrollWidth > el.clientWidth,
      ];
    });
  expect(await cut()).toEqual(['block', 'hidden', 'ellipsis', 'nowrap', false]);
  await h1.evaluate((el) => {
    el.textContent = 'Chuyển động ném xiên của một vật trong trọng trường đều '.repeat(4);
  });
  expect(await cut()).toEqual(['block', 'hidden', 'ellipsis', 'nowrap', true]);

  await page.getByRole('tab', { name: 'Đồ thị' }).click();
  const plot = await page.locator('#notebook-panel .chart__plot').boundingBox();
  const legend = await page.locator('#notebook-panel .chart__legend').boundingBox();
  const panel = await page.locator('#notebook-panel .panel__scroll').boundingBox();
  if (!plot || !legend || !panel) throw new Error('graph not drawn');
  expect(plot.width).toBeGreaterThan(280);
  expect(legend.y).toBeGreaterThanOrEqual(plot.y + plot.height - 1);
  expect(legend.y + legend.height).toBeLessThanOrEqual(panel.y + panel.height + 1);
});
