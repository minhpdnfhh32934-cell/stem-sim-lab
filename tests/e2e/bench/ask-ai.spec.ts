import { expect, test, type Locator, type Page } from '@playwright/test';
import { fulfillGemini } from '../fakeAi';
import { enterStudio, openTopic } from '../nav';

/** "Hỏi AI" in the bench's notebook: the chat stays in its drawer, off the lesson. */

const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error('not visible');
  return { x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height };
};

async function openAsk(page: Page) {
  await page.addInitScript(() => {
    (globalThis as { __STEMSIM_TEST_GEMINI_KEY__?: string }).__STEMSIM_TEST_GEMINI_KEY__ = 'test';
  });
  await page.route('https://generativelanguage.googleapis.com/v1beta/**', (route) =>
    fulfillGemini(route, 'Rơi tự do là chuyển động chỉ chịu tác dụng của trọng lực.'),
  );
  await openTopic(page, 'Vật lý', 'Rơi tự do');
  await page.getByRole('tab', { name: 'Hỏi AI' }).click();
  return page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
}

test('the chat fills its drawer: nothing of the lesson is under it, every header button fits', async ({
  page,
}) => {
  const chat = await openAsk(page);
  const drawer = await box(page.locator('#notebook-panel'));
  const panel = await box(chat);
  const stage = await box(page.getByRole('region', { name: 'Khung mô phỏng' }));
  expect(panel.right).toBeLessThanOrEqual(drawer.right + 1);
  expect(panel.right).toBeLessThanOrEqual(stage.x + 1);
  expect(panel.bottom).toBeLessThanOrEqual(drawer.bottom + 1);
  for (const name of ['Mở trang AI Teacher', 'Đóng chat']) {
    const button = await box(chat.getByRole('button', { name }));
    expect(button.right, name).toBeLessThanOrEqual(panel.right);
  }
  expect(await chat.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
});

test('screen context goes off however the chat is left; turning it on sweeps the screen', async ({
  page,
}) => {
  const chat = await openAsk(page);
  const tab = page.getByRole('tab', { name: 'Hỏi AI' });
  const toggle = chat.getByRole('checkbox', { name: 'Lấy thông tin từ màn hình' });
  const ways = [
    () => tab.click(),
    () => page.keyboard.press('Escape'),
    () => page.getByRole('tab', { name: 'Thẻ khoa học' }).click(),
    () => chat.getByRole('button', { name: 'Đóng chat' }).click(),
  ];
  for (const leave of ways) {
    await toggle.check({ force: true });
    await expect(page.locator('.screen-scan__band')).toBeAttached();
    await leave();
    await expect(chat).toHaveCount(0);
    await tab.click();
    await expect(toggle).not.toBeChecked();
  }
});

test('"Hỏi thầy" in a guided lesson opens AI Teacher with the question written in, nothing sent', async ({
  page,
}) => {
  const sent: string[] = [];
  await page.addInitScript(() => {
    (globalThis as { __STEMSIM_TEST_GEMINI_KEY__?: string }).__STEMSIM_TEST_GEMINI_KEY__ = 'test';
  });
  await page.route('https://generativelanguage.googleapis.com/v1beta/**', (route) => {
    sent.push(route.request().postData() ?? '');
    return fulfillGemini(route, 'Trả lời.');
  });
  await page.goto('/');
  await enterStudio(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Science Studio' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('tab', { name: 'Vật lý' }).click();
  const next = page.getByRole('button', { name: /^Tiếp:/ });
  await page.getByRole('radio', { name: /√2/ }).click();
  await next.click();
  await page.getByRole('button', { name: 'Chạy thí nghiệm' }).click();
  await next.click();
  await page.getByRole('button', { name: 'Hỏi thầy' }).click();
  await expect(page.getByRole('textbox', { name: 'Nhập câu hỏi' })).toHaveValue(
    /Rơi tự do: thả từ độ cao gấp đôi.*bước Quan sát/,
    { timeout: 20_000 },
  );
  expect(sent).toEqual([]);
});

test('an answer shows in the drawer and survives closing it and opening the full page', async ({
  page,
}) => {
  const chat = await openAsk(page);
  await chat.getByRole('textbox').fill('Rơi tự do là gì?');
  await chat.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(chat.getByText('chỉ chịu tác dụng của trọng lực')).toBeVisible();
  await chat.getByRole('button', { name: 'Đóng chat' }).click();
  await expect(chat).toHaveCount(0);
  await page.getByRole('tab', { name: 'Hỏi AI' }).click();
  await expect(chat.getByText('chỉ chịu tác dụng của trọng lực')).toBeVisible();
  await chat.getByRole('button', { name: 'Mở trang AI Teacher' }).click();
  await expect(page.getByText('chỉ chịu tác dụng của trọng lực')).toBeVisible();
});
