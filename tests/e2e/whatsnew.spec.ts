/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * The "SimLab đã được cập nhật" box after an update (src/app/whatsnew/) and Settings → "Lịch sử
 * phiên bản". The expected versions come from the bundled release-notes/versions.json, so the
 * test follows the data when a version's notes are reviewed (notesReady).
 */
interface Entry {
  version: string;
  notesReady: boolean;
}
const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const { versions } = json('../../release-notes/versions.json') as { versions: Entry[] };
const current = (json('../../package.json') as { version: string }).version;

/** a > b, numerically. */
function newer(a: string, b: string): boolean {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

const FROM = '0.4.1';
const expected = versions
  .filter((v) => v.notesReady && newer(v.version, FROM) && !newer(v.version, current))
  .map((v) => v.version);

test('after an update the box shows once, then never again; the history is in Settings', async ({
  page,
}) => {
  expect(expected.length).toBeGreaterThan(0);
  await page.goto('/');
  // This browser last saw an older SimLab; start the app again.
  await page.evaluate(
    (record) => {
      localStorage.setItem('stemsim.whatsnew', record);
    },
    JSON.stringify({ lastSeen: FROM }),
  );
  await page.reload();

  const dialog = page.getByRole('dialog', { name: 'SimLab đã được cập nhật' });
  await expect(dialog).toBeVisible();
  // Every reviewed version since 0.4.1, newest first.
  await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(
    expected.map((v) => `Phiên bản ${v}`),
  );
  await expect(dialog.getByRole('heading', { name: 'Tính năng mới' }).first()).toBeVisible();
  // The footer stays on screen at 1366×768 (the notes scroll inside the box).
  const close = dialog.getByRole('button', { name: 'Đóng' });
  await expect(close).toBeInViewport();
  await close.click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('stemsim.whatsnew'))).toBe(
    JSON.stringify({ lastSeen: current }),
  );

  // Same version again: no box.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chào mừng đến với SimLab' })).toBeVisible();
  await page.waitForTimeout(2500);
  await expect(dialog).toBeHidden();

  // The full history: Settings → Lịch sử phiên bản.
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await page.getByRole('tab', { name: 'Lịch sử phiên bản' }).click();
  const list = page.getByRole('list', { name: 'Các phiên bản, mới nhất ở trên' });
  await expect(list).toBeVisible();
  await expect(list.locator(':scope > li')).toHaveCount(versions.length);
  await expect(list.locator('.version-history__version').first()).toHaveText(
    `Phiên bản ${versions[0]!.version}`,
  );
  // The running version: a neutral label, never a status its own bundle cannot know.
  const running = list.locator(':scope > li').first();
  await expect(running.locator('.release-badge--current')).toHaveText('Bản đang dùng');
  await expect(
    running.locator('.release-badge--inReview, .release-badge--mergedNotReleased'),
  ).toHaveCount(0);
  await expect(list.locator('.release-badge--released').first()).toHaveText('Đã phát hành');
  await expect(list.locator('.release-badge--unverified').first()).toHaveText('Chưa xác minh');
  // An older version opens to show its notes.
  const older = list.locator(':scope > li').nth(1);
  await older.locator('summary').click();
  await expect(older.getByRole('heading', { level: 4 }).first()).toBeVisible();
  const scrolls = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(scrolls).toBe(false);
});
