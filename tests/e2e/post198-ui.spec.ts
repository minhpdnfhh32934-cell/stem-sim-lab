import { expect, test, type Locator, type Page } from '@playwright/test';
import { enterStudio, openLab, openTopic } from './nav';

/**
 * Interface rules written after PR #198 for the bench (tests/e2e/bench, no longer run), carried
 * over to the classic window at 1366 × 768: SVG text at the 12 px floor (#205 A1), focus rings
 * where an outline was removed (#205 A4), labels whole or reachable (#205 A5), the stage's text at
 * the floor (#205 B4). What each test checks is unchanged; only the way to the screen differs.
 */
const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function useFontScale(page: Page, fontScale: number) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript((scale) => {
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
    );
  }, fontScale);
}

/**
 * Text drawn inside SVG pictures is sized in the picture's own units, so its size on screen is
 * font-size × the picture's scale (getScreenCTM).
 */
async function smallestTextPx(svg: Locator): Promise<number> {
  await expect(svg.locator('text').first()).toBeVisible({ timeout: 20_000 });
  return svg.evaluate((el) => {
    const sizes = [...el.querySelectorAll('text')].map((t) => {
      const m = (t as SVGGraphicsElement).getScreenCTM();
      const scale = m ? Math.hypot(m.a, m.b) : 1;
      return parseFloat(getComputedStyle(t).fontSize) * scale;
    });
    return Math.min(...sizes);
  });
}

async function check(svg: Locator, what: string) {
  const px = await smallestTextPx(svg);
  test.info().annotations.push({ type: what, description: `${px.toFixed(2)} px` });
  expect(px, what).toBeGreaterThanOrEqual(12 - 0.01);
}

const lines = (loc: Locator) =>
  loc.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
  });

/** A label is whole, or (cut to "…") whole in its tooltip, reached with the keyboard too. */
async function wholeByKeyboard(page: Page, label: Locator, name: string) {
  const cut = await label.evaluate((el) => el.scrollWidth > el.clientWidth);
  if (!cut) {
    await expect(label).not.toHaveAttribute('tabindex');
    return;
  }
  await expect(label).toHaveAttribute('data-tip', name);
  await expect(label).toHaveAttribute('tabindex', '0');
  for (let i = 0; i < 200; i += 1) {
    await page.keyboard.press('Tab');
    if (await label.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(label).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText(name);
}

for (const fontScale of [1, 1.4] as const) {
  const at = `${String(fontScale * 100)} %`;

  test.describe(`SVG text at ${at} (#205 A1)`, () => {
    test.beforeEach(async ({ page }) => {
      await useFontScale(page, fontScale);
    });

    test(`titration picture: NaOH and HCl at least 12px (${at})`, async ({ page }) => {
      await openTopic(page, 'Hóa học', 'Chuẩn độ acid – base');
      await check(page.getByRole('img', { name: /Buret và cốc dung dịch/ }), 'titration');
    });

    test(`energy diagram labels at least 12px (${at})`, async ({ page }) => {
      await openTopic(page, 'Hóa học', 'Cân bằng hóa học & Le Chatelier');
      await check(page.getByRole('img', { name: /Giản đồ năng lượng/ }), 'energy diagram');
    });

    test(`Gemini key guide drawings at least 12px (${at})`, async ({ page }) => {
      await openLab(page);
      // The AI status chip also says 'Cài đặt' without a key; the gear is the last one.
      await page.getByRole('button', { name: 'Cài đặt', exact: true }).last().click();
      const settings = page.getByRole('dialog', { name: 'Cài đặt' });
      await settings.getByRole('tab', { name: 'Kết nối AI' }).click();
      const guide = settings.locator('details.ai-guide', {
        hasText: 'Hướng dẫn lấy khóa API Gemini',
      });
      if (!(await guide.evaluate((d) => (d as HTMLDetailsElement).open))) {
        await guide.locator('summary').click();
      }
      const arts = guide.locator('svg.guide-art');
      await expect(arts).toHaveCount(3);
      for (let i = 0; i < 3; i += 1) await check(arts.nth(i), `guide drawing ${String(i + 1)}`);
    });

    test(`Science Studio test tube labels at least 12px (${at})`, async ({ page }) => {
      await page.goto('/');
      await enterStudio(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Science Studio' })).toBeVisible({
        timeout: 20_000,
      });
      await page.getByRole('tab', { name: 'Hóa học' }).click();
      await page.getByRole('radio', { name: 'Xuất hiện kết tủa' }).click();
      await page.getByRole('button', { name: /^Tiếp:/ }).click();
      await page.getByRole('button', { name: 'Thêm dung dịch NaCl' }).click();
      await check(page.getByRole('img', { name: /^Ống nghiệm/ }), 'test tube');
    });
  });

  test(`Cân bằng hóa học & Le Chatelier: labels whole or reachable, font ${at} (#205 A5)`, async ({
    page,
  }) => {
    await useFontScale(page, fontScale);
    await openTopic(page, 'Hóa học', 'Cân bằng hóa học & Le Chatelier');
    const inspector = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
    const title = inspector.locator('.science-card__title');
    await expect(title).toBeVisible({ timeout: 20_000 });
    for (const mode of ['Cơ bản', 'Nâng cao']) {
      expect(await lines(inspector.getByRole('radio', { name: mode, exact: true })), mode).toBe(1);
    }
    // The lesson's name above its controls (the bench header's h1 there), and the card's title.
    const name = inspector.locator('.section__title--keep-case');
    await expect(name).toHaveText('Cân bằng hóa học');
    await wholeByKeyboard(page, name, (await name.textContent()) ?? '');
    await wholeByKeyboard(page, title, (await title.textContent()) ?? '');
    expect(await sideScroll(page)).toBeLessThanOrEqual(0);
  });

  test(`physics at ${at}: the time readout clear of the scrubber, stage text ≥ 12 px (#205 B4)`, async ({
    page,
  }) => {
    await useFontScale(page, fontScale);
    await openTopic(page, 'Vật lý', 'Ném xiên');
    await expect(page.locator('.stage__hud-title')).toBeVisible({ timeout: 20_000 });
    const readout = page.locator('.timeline__time');
    await expect(readout).toHaveText(/^t = /);
    const r = await readout.evaluate((el) => ({
      fits: el.scrollWidth <= el.clientWidth,
      right: el.getBoundingClientRect().right,
    }));
    expect(r.fits).toBe(true);
    const scrub = await page.locator('.timeline__scrubber').boundingBox();
    expect(r.right).toBeLessThanOrEqual(scrub?.x ?? 0);

    // Text over the stage (title, time, notes): at least 12 px × Cỡ chữ.
    const smallest = await page.locator('.stage').evaluate((stage) => {
      let min = Infinity;
      for (const el of stage.querySelectorAll<HTMLElement>('*')) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
        if (!own || el.getClientRects().length === 0) continue;
        min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
      }
      return min;
    });
    expect(smallest).toBeGreaterThanOrEqual(12 * fontScale - 0.01);
    expect(await sideScroll(page)).toBe(0);
  });
}

// #205 A4: the places that removed their own outline show focus somewhere else, reached with the
// keyboard (Tab). The rule list is in src/app/theme/focusRing.test.ts.
async function tabTo(page: Page, selector: string, max = 300): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector)) return;
  }
  throw new Error(`Tab never reached ${selector}`);
}

async function ring(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const st = getComputedStyle(el);
      return `${st.outlineStyle} ${st.outlineWidth}`;
    });
}

test.describe('focus rings (#205 A4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test('the stage canvas shows a ring when the keyboard reaches it', async ({ page }) => {
    await openTopic(page, 'Vật lý', 'Ném xiên');
    await expect(page.locator('.stage__canvas')).toBeVisible({ timeout: 20_000 });
    await tabTo(page, '.stage__canvas');
    expect(await ring(page, '.stage__canvas')).toBe('solid 2px');
  });

  test('the periodic table search box shows its ring', async ({ page }) => {
    await openTopic(page, 'Hóa học', 'Bảng tuần hoàn');
    await expect(page.locator('.pt__search input')).toBeVisible({ timeout: 20_000 });
    await tabTo(page, '.pt__search input');
    expect(await ring(page, '.pt__search')).toBe('solid 2px');
  });

  test("AI Teacher's message box shows its ring", async ({ page }) => {
    await page.goto('/');
    await page.locator('.launch-card--teacher').click();
    await expect(page.getByRole('region', { name: 'Dạy học bằng AI' })).toBeVisible();
    await tabTo(page, '.chat-panel__composer textarea');
    expect(await ring(page, '.chat-panel__composer')).toBe('solid 2px');
  });

  test('the Ctrl+K search row shows its ring', async ({ page }) => {
    await openLab(page);
    await page.keyboard.press('Control+k');
    const input = page.locator('.command-palette__search input');
    await expect(input).toBeFocused({ timeout: 10_000 });
    expect(await ring(page, '.command-palette__search')).toBe('solid 2px');
  });
});

// #202: in presentation mode the exit button is a 40 px target and never sits on the stage's HUD.
// The bench opened it from Tệp; the classic top bar has its own button.
test('presentation: the HUD stays clear of the 40 px exit button; Esc leaves it', async ({
  page,
}) => {
  await openTopic(page, 'Vật lý', 'Ném xiên');
  await expect(page.locator('.stage__hud-title')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Chế độ trình chiếu (F5)' }).click();
  const exit = page.getByRole('button', { name: 'Thoát trình chiếu (Esc)' });
  await expect(exit).toBeVisible();
  await expect(page.locator('.topbar')).toHaveCount(0);
  // The HUD's right end (title, "Đã có can thiệp") never sits under the button.
  const hud = await page.locator('.stage__hud').boundingBox();
  const button = await exit.boundingBox();
  if (!hud || !button) throw new Error('not visible');
  // A 40 px target (#202; it was 38 px).
  expect(Math.min(button.width, button.height)).toBeGreaterThanOrEqual(40);
  const apart =
    hud.x + hud.width <= button.x ||
    button.x + button.width <= hud.x ||
    hud.y + hud.height <= button.y ||
    button.y + button.height <= hud.y;
  expect(apart, `HUD ${JSON.stringify(hud)} vs exit ${JSON.stringify(button)}`).toBe(true);
  await page.keyboard.press('Escape');
  await expect(exit).toHaveCount(0);
  await expect(page.locator('.topbar')).toHaveCount(1);
});

// #205 B6 checked three things on every Settings page: 40 px targets, text ≥ 12 px × Cỡ chữ and no
// sideways spill. The first two were bench styles (the classic pages keep 25 px segments and
// 11 px notes); the spill check holds here too, in Advanced so that every page shows.
for (const fontScale of [1, 1.4] as const) {
  test(`every Settings page at ${String(fontScale * 100)} %: nothing spills sideways (#205 B6)`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript((scale) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({
          state: { locale: 'vi', fontScale: scale, uiMode: 'advanced' },
          version: 2,
        }),
      );
    }, fontScale);
    await openLab(page);
    await page.getByRole('button', { name: 'Cài đặt', exact: true }).last().click();
    const sheet = page.getByRole('dialog', { name: 'Cài đặt' });
    await expect(sheet).toBeVisible();
    const tabs = await sheet.getByRole('tab').all();
    expect(tabs.length).toBeGreaterThan(8);
    for (const tab of tabs) {
      const name = ((await tab.textContent()) ?? '').trim();
      await tab.click();
      const panel = sheet.locator('.settings-panel:not([hidden])');
      await expect(panel).toBeVisible();
      const spill = await panel.evaluate((el) => {
        const out: string[] = [];
        const edge = el.getBoundingClientRect().right;
        for (const e of el.querySelectorAll<HTMLElement>('*')) {
          if (e.getClientRects().length === 0) continue;
          const b = e.getBoundingClientRect();
          if (b.width > 0 && b.right > edge + 1) out.push(e.className.slice(0, 30));
        }
        return [...new Set(out)].slice(0, 5);
      });
      expect(spill, name).toEqual([]);
    }
    expect(await sideScroll(page)).toBe(0);
  });
}
