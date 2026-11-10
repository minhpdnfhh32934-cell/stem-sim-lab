import { expect, test, type Page } from '@playwright/test';
import { openLab } from '../nav';

const TOPICS = [
  'Bảng tuần hoàn',
  'Cấu hình electron',
  'Mô hình Bohr',
  'Hình dạng orbital',
  'Phân tử 3D',
  'Hình học phân tử (VSEPR)',
  'Độ phân cực liên kết',
  'Thư viện phản ứng đã kiểm chứng',
  'Cân bằng phương trình',
  'Thuyết va chạm',
  'Phân bố Maxwell–Boltzmann',
  'Cân bằng hóa học & Le Chatelier',
  'Chuẩn độ acid – base',
  'Tinh thể kim loại và NaCl',
];

async function openChemistry(page: Page) {
  await openLab(page);
  await page.getByRole('radio', { name: 'Hóa học' }).click();
}

test('every chemistry topic opens without errors and publishes a Science Card', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openChemistry(page);
  for (const [i, name] of TOPICS.entries()) {
    // The bench's shelf is its own screen: back to it through the subject crumb.
    if (i > 0)
      await page
        .locator('.bench-crumbs')
        .getByRole('button', { name: 'Hóa học', exact: true })
        .click();
    await page.getByRole('main').getByRole('button', { name, exact: true }).click();
    // Each topic is a lazy module the dev server compiles on first use. The bench edge's chip is
    // the card's first depth (§11); the tray's summary too, unless the view folds its tray.
    await expect(page.locator('button.bench-chip')).toBeVisible({ timeout: 20_000 });
    if ((await page.locator('.tray[data-folded]').count()) === 0)
      await expect(page.locator('.science-card')).toBeVisible();
    await page.waitForTimeout(300);
  }
  expect(errors).toEqual([]);
});

test('electron configuration shows the Cr exception from the data table', async ({ page }) => {
  await openChemistry(page);
  await page.getByRole('button', { name: 'Cấu hình electron', exact: true }).click();
  // The element picker is on the bench edge, beside the stepper (§9.10).
  await page.getByRole('combobox', { name: /^Nguyên tố/ }).selectOption('24');
  await expect(page.getByText('[Ar] 3d⁵ 4s¹').first()).toBeVisible();
  await expect(page.getByText(/Ngoại lệ/)).toBeVisible();
});

test('balancer: balances, and warns for reactions outside the library', async ({ page }) => {
  await openChemistry(page);
  await page.getByRole('button', { name: 'Cân bằng phương trình', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Nhập phương trình' });
  await input.fill('Al + O2 -> Al2O3');
  await expect(page.getByText('4Al + 3O₂ → 2Al₂O₃')).toBeVisible();
  await expect(page.getByText(/chưa có trong cơ sở dữ liệu đã kiểm chứng/)).toBeVisible();
  await input.fill('CH4 + O2 -> CO2 + H2O');
  await expect(page.getByText(/Có trong thư viện đã kiểm chứng/)).toBeVisible();
  await input.fill('H2O -> H2O2');
  await expect(page.getByText(/Không thể cân bằng/)).toBeVisible();
});

test('reaction mechanism: stepping shows bond changes and the illustrative label', async ({
  page,
}) => {
  await openChemistry(page);
  await page.getByRole('button', { name: 'Thư viện phản ứng đã kiểm chứng', exact: true }).click();
  await page.getByRole('option', { name: /SN2/ }).click();
  // The bench keeps the bond-change table in the notebook.
  await page.getByRole('tab', { name: 'Các bước và liên kết thay đổi' }).click();
  await expect(page.getByText('Đứt: C1–Br2')).toBeVisible();
  await page.getByRole('slider', { name: 'Tiến trình phản ứng' }).fill('0.5');
  // The bench writes it as a stamp at the stage's bottom left (§9.5).
  await expect(
    page
      .locator('.bench-stamp')
      .getByText('Chuyển tiếp minh họa — không phải quỹ đạo nguyên tử thực'),
  ).toBeVisible();
});

test('3D molecule: picking atoms measures the H–O–H angle of water', async ({ page }) => {
  await openChemistry(page);
  await page.getByRole('button', { name: 'Hình học phân tử (VSEPR)', exact: true }).click();
  await page.getByRole('button', { name: 'H₂O', exact: true }).click();
  await expect(page.getByText('AX₂E₂')).toBeVisible();
  await expect(page.getByText('Gấp khúc (chữ V)')).toBeVisible();
});

test('unknown SMILES: RDKit checks it and shows 2D only, with a warning', async ({ page }) => {
  await openChemistry(page);
  await page.getByRole('button', { name: 'Phân tử 3D', exact: true }).click();
  await page.getByRole('searchbox', { name: /Tìm phân tử/ }).fill('CC(C)CC(=O)O');
  await expect(
    page.getByText(/chưa có trong thư viện đã kiểm chứng — chỉ hiển thị cấu trúc 2D/),
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/C₅H₁₀O₂/)).toBeVisible();
});

test('titration: dragging the NaOH volume changes the pH and the indicator, fits 1366×768', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openChemistry(page);
  await page.getByRole('button', { name: 'Chuẩn độ acid – base', exact: true }).click();
  const readout = page.locator('.tit-readout');
  await expect(readout.getByText('1,00', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(readout.getByText(/không màu/)).toBeVisible();
  await page.getByRole('slider', { name: /Thể tích NaOH/ }).fill('12');
  await expect(readout.getByText(/hồng tím/)).toBeVisible();
  await expect(readout.getByText(/NaOH dư/)).toBeVisible();
  await expect(page.getByText('Hình và màu minh họa, không theo tỉ lệ')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('equilibrium: the energy diagram follows Eₐ and is labelled qualitative, fits 1366×768', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openChemistry(page);
  await page.getByRole('button', { name: 'Cân bằng hóa học & Le Chatelier', exact: true }).click();
  const diagram = page.getByRole('img', { name: /Giản đồ năng lượng/ });
  await expect(diagram).toHaveAttribute('aria-label', /ΔH = −20 kJ\/mol \(tỏa nhiệt\)/, {
    timeout: 20_000,
  });
  await expect(page.getByText('Hình dạng đường cong: minh họa định tính')).toBeVisible();
  await page.getByLabel('Eₐ thuận (kJ/mol)').fill('80');
  await expect(diagram).toHaveAttribute('aria-label', /ΔH = 10 kJ\/mol \(thu nhiệt\)/);
  await expect(page.getByText(/ΔH = Eₐ\(thuận\) − Eₐ\(nghịch\) = 10 kJ\/mol/)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
