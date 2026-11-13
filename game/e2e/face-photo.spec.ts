import { expect, type Page, test } from '@playwright/test';

// A face from a photo (Phú 2026-11-12), in the real app: the customiser's Face tab takes a photo or
// a chosen one, MediaPipe reads the face (its landmarks and the hair), the draft's face, colours
// and hairstyle are made from it, its picture laid on the head, and Delete gives the face back. The photo here is the
// preview's own drawn face (no photo of a real person is bundled), shot large and chosen as a
// file. SwiftShader: nothing here is timed.

test.use({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 3 });

async function openCustomiser(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Choose your character/ }).click();
  await expect(page.locator('.char-page[data-ready="true"]')).toBeVisible();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next character' }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const customiser = page.getByRole('dialog', { name: 'Your own character' });
  await expect(page.locator('.custom-page[data-ready="true"] canvas')).toHaveCount(1);
  return customiser;
}

test('face from a photo: chosen, read, made, deleted', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const customiser = await openCustomiser(page);
  await customiser.getByRole('button', { name: 'Face', exact: true }).click();
  await expect(customiser.getByRole('button', { name: 'Take a photo' })).toBeVisible();
  await expect(customiser.getByRole('button', { name: 'Delete the photo face' })).toHaveCount(0);

  // The photo: the drawn head, from the preview (the debug panel out of the way), at 3× pixels.
  await page.locator('.debug').evaluate((d: HTMLElement) => (d.style.display = 'none'));
  await page.waitForTimeout(1500);
  const box = await page.locator('.custom-preview').boundingBox();
  if (!box) throw new Error('no preview');
  const out = process.env.FACE_OUT; // a folder to keep the shots in, when looking at them
  const shotAt = (name: string, clip: { x: number; y: number; width: number; height: number }) =>
    page.screenshot({ clip, ...(out ? { path: `${out}/${name}.png` } : {}) });
  const head = { x: box.x + 183, y: box.y + 85, width: 120, height: 140 };
  const photo = await shotAt('photo', head);

  await customiser.locator('.custom-photo-file').setInputFiles({
    name: 'face.png',
    mimeType: 'image/png',
    buffer: photo,
  });
  const status = customiser.locator('.custom-photo-status');
  await expect(status).not.toHaveText(/Reading/, { timeout: 120_000 });
  await expect(status).not.toHaveText('');
  info.annotations.push({ type: 'status', description: (await status.textContent()) ?? '' });
  await expect(status).toHaveText(/^Made from the photo\./);
  await expect(customiser.getByRole('slider', { name: 'Face width' })).toBeVisible();
  await customiser.getByRole('button', { name: 'Hair', exact: true }).click();
  await expect(customiser.getByRole('button', { name: 'From the photo' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.waitForTimeout(800);
  await shotAt('made', head);

  // Saved: the character with its face's small picture (small enough for a LAN room's message),
  // and what the face was before (no picture).
  await customiser.getByRole('button', { name: 'Save' }).click();
  await expect(customiser).toBeHidden();
  const kept = await page.evaluate(() => ({
    made: JSON.parse(localStorage.getItem('simlab.character.custom') ?? '{}') as {
      appearance?: { hair?: string; face?: Record<string, number>; facePhoto?: string };
    },
    before: localStorage.getItem('simlab.character.custom.beforePhoto'),
    keys: Object.keys(localStorage),
  }));
  info.annotations.push({ type: 'made', description: JSON.stringify(kept.made.appearance) });
  expect(kept.made.appearance?.hair).toBe('photo');
  expect(kept.before).toBeTruthy();
  expect(kept.made.appearance?.facePhoto?.startsWith('data:image/jpeg;base64,')).toBe(true);
  expect(JSON.stringify(kept.made).length).toBeLessThan(15_000);
  expect(kept.before).not.toContain('data:image');

  // Edit, Delete: the face as it was.
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(customiser).toBeVisible();
  await customiser.getByRole('button', { name: 'Face', exact: true }).click();
  await customiser.getByRole('button', { name: 'Delete the photo face' }).click();
  await expect(customiser.getByRole('button', { name: 'Delete the photo face' })).toHaveCount(0);
  await customiser.getByRole('button', { name: 'Save' }).click();
  await expect(customiser).toBeHidden();
  const after = await page.evaluate(() => ({
    made: JSON.parse(localStorage.getItem('simlab.character.custom') ?? '{}') as {
      appearance?: { hair?: string; face?: Record<string, number>; facePhoto?: string };
    },
    before: localStorage.getItem('simlab.character.custom.beforePhoto'),
  }));
  expect(after.made.appearance?.hair).not.toBe('photo');
  expect(Object.values(after.made.appearance?.face ?? {})).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  expect(after.made.appearance?.facePhoto).toBeUndefined();
  expect(after.before).toBeNull();
  expect(errors).toEqual([]);
});
