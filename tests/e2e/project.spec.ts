/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function openLogistic(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page.getByRole('button', { name: 'Tăng trưởng logistic', exact: true }).click();
  await expect(page.locator('.science-card')).toBeVisible();
}

function slider(page: Page, name: RegExp) {
  return page.locator('label', { hasText: name }).locator('input[type="range"]');
}

test('undo / redo restores module inputs', async ({ page }) => {
  await openLogistic(page);
  const undo = page.getByRole('button', { name: /Hoàn tác/ });
  await expect(undo).toBeDisabled();
  await slider(page, /Sức chứa K/).fill('1500');
  await expect(page.getByText('Sức chứa K = 1.500')).toBeVisible();
  await expect(undo).toBeEnabled();
  await page.waitForTimeout(600);
  await page.keyboard.press('Control+z');
  await expect(page.getByText('Sức chứa K = 1.000')).toBeVisible();
  await page.getByRole('button', { name: /Làm lại/ }).click();
  await expect(page.getByText('Sức chứa K = 1.500')).toBeVisible();
});

test('save and reopen a .stemsim file', async ({ page }) => {
  await openLogistic(page);
  await slider(page, /Sức chứa K/).fill('1500');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.keyboard.press('Control+s'),
  ]);
  expect(download.suggestedFilename()).toMatch(/^tang-truong-logistic-.*\.stemsim$/);
  const path = await download.path();
  const text = await readFile(path, 'utf8');
  const json = JSON.parse(text) as { topicId: string; module: { state: { K: number } } };
  expect(json.topicId).toBe('logisticGrowth');
  expect(json.module.state.K).toBe(1500);

  // Open it on a fresh page (another topic open), through the menu.
  await page.goto('/');
  await page.getByRole('radio', { name: 'Hóa học' }).click();
  await page.getByRole('button', { name: 'Bảng tuần hoàn', exact: true }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Tệp' }).click();
  await page.getByRole('menuitem', { name: /Mở tệp/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'bai.stemsim',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect(page.getByText('Sức chứa K = 1.500')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Sinh học' })).toBeChecked();
});

test('a broken project file is rejected with a message', async ({ page }) => {
  await page.goto('/');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Tệp' }).click();
  await page.getByRole('menuitem', { name: /Mở tệp/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'hong.stemsim',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"x"}'),
  });
  await expect(page.getByText(/không đúng định dạng \.stemsim/)).toBeVisible();
});

test('history lists opened simulations and reopens them', async ({ page }) => {
  await openLogistic(page);
  await slider(page, /Sức chứa K/).fill('1500');
  await page.waitForTimeout(1800); // the history entry follows edits after a short delay
  await page.getByRole('radio', { name: 'Hóa học' }).click();
  await page.getByRole('button', { name: 'Bảng tuần hoàn', exact: true }).click();
  await page.getByRole('tab', { name: 'Lịch sử' }).click();
  const entry = page.locator('.history__item', { hasText: 'Tăng trưởng logistic' }).first();
  await expect(entry).toBeVisible();
  await entry.locator('.history__open').click();
  await expect(page.getByText('Sức chứa K = 1.500')).toBeVisible();
});

test('sources & assumptions page lists datasets and review status', async ({ page }) => {
  await openLogistic(page);
  await page.getByRole('button', { name: 'Tệp' }).click();
  await page.getByRole('menuitem', { name: 'Nguồn & Giả định' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nguồn & Giả định' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('118 nguyên tố')).toBeVisible();
  await expect(dialog.getByText(/CODATA 2022/).first()).toBeVisible();
  await expect(dialog.getByText('Tăng trưởng quần thể (logistic)')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('in-app updates are explained as desktop-only in the browser build', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tệp' }).click();
  await page.getByRole('menuitem', { name: 'Kiểm tra cập nhật' }).click();
  await expect(page.getByText('Cập nhật trong app chỉ có ở bản cài trên máy.')).toBeVisible();
});

test('first run: level → subjects → age question → tour (once, can be skipped)', async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/');
  // Onboarding (A4.2) comes first; the safety question and the tour wait behind it.
  const onboarding = page.getByRole('dialog', { name: 'Bạn muốn học ở trình độ nào?' });
  await expect(onboarding).toBeVisible();
  await expect(onboarding).toContainText('Bước 1/5');
  await expect(page.getByRole('dialog', { name: 'Trước khi bắt đầu' })).toHaveCount(0);
  await onboarding.getByRole('button', { name: 'Tiếp' }).click();
  const subjects = page.getByRole('dialog', { name: 'Bạn quan tâm môn nào?' });
  await subjects.getByRole('button', { name: /^Sinh học/ }).click();
  await subjects.getByRole('button', { name: 'Xong' }).click();
  await expect(page.getByRole('radio', { name: 'Sinh học' })).toBeChecked();
  const gate = page.getByRole('dialog', { name: 'Trước khi bắt đầu' });
  await expect(gate).toBeVisible();
  await expect(page.locator('.tour')).toHaveCount(0);
  await gate.getByRole('button', { name: 'Tôi chưa đủ 18 tuổi' }).click();
  // Under 18 in the main edition: no AI, so no "Kết nối AI" step.
  await expect(page.getByRole('dialog', { name: /Kết nối AI/ })).toHaveCount(0);
  const tour = page.getByRole('dialog', { name: 'Chào mừng đến STEM Sim Lab' });
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: 'Tiếp', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Chọn môn' })).toBeVisible();
  await page.locator('.tour').getByRole('button', { name: 'Bỏ qua' }).click();
  await expect(page.locator('.tour')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.tour')).toHaveCount(0);
  await context.close();
});

test('undo works for physics parameters too', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ném xiên', exact: true }).click();
  const field = page.getByRole('spinbutton').first();
  await expect(field).toHaveValue('15');
  await field.fill('20');
  await field.press('Enter');
  await expect(field).toHaveValue('20');
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Hoàn tác/ }).click();
  await expect(field).toHaveValue('15');
  await page.getByRole('button', { name: /Làm lại/ }).click();
  await expect(field).toHaveValue('20');
});

test('manual mode offers chemistry and biology topics too', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tự dựng cảnh (không dùng AI)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tự dựng cảnh' });
  const select = dialog.getByRole('combobox', { name: 'Chủ đề' });
  await expect(select.locator('optgroup')).toHaveCount(3);
  await expect(select.locator('optgroup[label="Hóa học"] option')).toHaveCount(12);
  await expect(select.locator('optgroup[label="Sinh học"] option')).toHaveCount(11);
  await select.selectOption('logisticGrowth');
  await expect(dialog.locator('.problem-review__module input[type="range"]').first()).toBeVisible();
  await dialog
    .locator('.problem-review__module label', { hasText: 'Sức chứa K' })
    .locator('input')
    .fill('1500');
  await dialog.getByRole('button', { name: 'Mô phỏng' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Sức chứa K = 1.500')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Sinh học' })).toBeChecked();
  // Back to a physics topic from the same picker.
  await page.getByRole('button', { name: 'Tự dựng cảnh (không dùng AI)' }).click();
  await select.selectOption('freeFall');
  await expect(dialog.locator('.qty-cards')).toBeVisible();
});
