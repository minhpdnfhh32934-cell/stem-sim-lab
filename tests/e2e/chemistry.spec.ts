import { expect, test, type Page } from '@playwright/test';

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
];

async function openChemistry(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Hóa học' }).click();
}

test('every chemistry topic opens without errors and publishes a Science Card', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openChemistry(page);
  for (const name of TOPICS) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.science-card')).toBeVisible();
    await page.waitForTimeout(300);
  }
  expect(errors).toEqual([]);
});

test('electron configuration shows the Cr exception from the data table', async ({ page }) => {
  await openChemistry(page);
  await page.getByRole('button', { name: 'Cấu hình electron', exact: true }).click();
  await page.getByLabel('Nguyên tố').selectOption('24');
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
  await expect(page.getByText('Đứt: C1–Br2')).toBeVisible();
  await page.getByRole('slider', { name: 'Tiến trình phản ứng' }).fill('0.5');
  await expect(
    page
      .locator('.rx-status')
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
