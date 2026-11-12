import { expect, test, type Page } from '@playwright/test';
import { openLab } from '../nav';

/**
 * R5 (#205 A3): every visible control is at least 40 × 40 px at 1366×768, with Cỡ chữ at 100 % and
 * 140 %. A field inside a <label> counts by its label (a click anywhere on it reaches the field).
 * The periodic table's tiles are left to #205 B7, which lays the table out again.
 */
async function smallControls(page: Page): Promise<string[]> {
  // Opening dialogs grow from 0.97: measure once every finite animation has ended.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  return page.evaluate(() => {
    const sel =
      'button, [role="button"], a[href], input:not([type="hidden"]), select, [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], summary';
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (el.closest('[inert]') || el.matches('.pt-cell')) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
      const label = el.matches('input') ? el.closest('label') : null;
      const r = (label ?? el).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      if (r.width >= 40 - 0.5 && r.height >= 40 - 0.5) continue;
      const name = (el.getAttribute('aria-label') ?? el.textContent)
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      out.push(`${String(Math.round(r.width))}×${String(Math.round(r.height))} "${name}"`);
    }
    return out;
  });
}

async function openTopic(page: Page, subject: string, topic: string) {
  await openLab(page);
  await page.getByRole('radio', { name: subject }).click();
  await page.getByRole('main').getByRole('button', { name: topic, exact: true }).click();
  await expect(page.locator('.bench-edge')).toBeVisible({ timeout: 20_000 });
  // The lesson's lazy module draws its tray and edge controls.
  await page.waitForTimeout(1500);
}

const SCREENS: [string, (page: Page) => Promise<void>][] = [
  ['launch page', async (page) => page.goto('/').then(() => undefined)],
  ['shelf', (page) => openLab(page)],
  ['physics lesson', (page) => openTopic(page, 'Vật lý', 'Ném xiên')],
  ['chemistry lesson', (page) => openTopic(page, 'Hóa học', 'Phân bố Maxwell–Boltzmann')],
  ['biology lesson', (page) => openTopic(page, 'Sinh học', 'Nguyên phân')],
  [
    'AI Teacher',
    async (page) => {
      await page.goto('/');
      await page.locator('.launch-card--teacher').click();
      await expect(page.getByRole('region', { name: 'Dạy học bằng AI' })).toBeVisible();
    },
  ],
  [
    'Settings',
    async (page) => {
      await openLab(page);
      // Without a key the AI status chip also says "Cài đặt"; the gear is the last one.
      await page.getByRole('button', { name: 'Cài đặt', exact: true }).last().click();
      await expect(page.getByRole('dialog', { name: 'Cài đặt' })).toBeVisible();
    },
  ],
];

for (const fontScale of [1, 1.4] as const) {
  test(`every control is a 40 px target, font ${String(fontScale * 100)} % (#205 A3)`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript((scale) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
      );
    }, fontScale);
    const found: Record<string, string[]> = {};
    for (const [name, open] of SCREENS) {
      await open(page);
      const small = await smallControls(page);
      if (small.length) found[name] = small;
    }
    expect(found).toEqual({});
  });
}
