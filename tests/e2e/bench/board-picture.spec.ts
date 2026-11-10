import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Item 2, the picture leg of "Khoanh để hỏi" in a real browser: the learner's own strokes (no
 * text) are circled, the circled area becomes a PNG (selectionImage.ts: SVG → image →
 * OffscreenCanvas) and goes only to the vision model on this computer. Ollama on 127.0.0.1:11434
 * is a fake answered by `page.route`; every cloud host is counted and refused.
 */

const OLLAMA = 'http://127.0.0.1:11434';
const MODEL = 'qwen2.5vl:7b';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const LESSON = ['# Rơi tự do', '1. Chọn chiều dương hướng xuống.', '2. Gốc thời gian lúc thả vật.'];
const ANSWER = 'Hình em vẽ là một đường gấp khúc đi lên rồi đi xuống.';

interface ChatMessage {
  role: string;
  content: string;
  images?: string[];
}

async function fakeVisionOllama(
  page: Page,
  chats: ChatMessage[][],
  cloud: string[],
  lesson: string,
) {
  for (const host of [
    'https://generativelanguage.googleapis.com/**',
    'https://api.groq.com/**',
    'https://api.anthropic.com/**',
    'https://*.wikipedia.org/**',
  ]) {
    await page.route(host, (route) => {
      cloud.push(route.request().url());
      return route.abort('blockedbyclient');
    });
  }
  for (const port of [1234, 8080]) {
    await page.route(`http://127.0.0.1:${String(port)}/**`, (route) =>
      route.abort('connectionrefused'),
    );
  }
  await page.route(`${OLLAMA}/**`, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const json = (body: unknown) => route.fulfill({ headers: CORS, json: body });
    if (path === '/api/version') return json({ version: '0.12.6' });
    if (path === '/api/tags') {
      return json({ models: [{ name: MODEL, model: MODEL, details: { family: 'qwen25vl' } }] });
    }
    if (path === '/api/show') {
      return json({
        details: { family: 'qwen25vl' },
        model_info: { 'general.architecture': 'qwen25vl', 'qwen25vl.context_length': 32768 },
        capabilities: ['completion', 'vision'],
      });
    }
    if (path === '/api/chat') {
      const body = req.postDataJSON() as { messages?: ChatMessage[] };
      chats.push(body.messages ?? []);
      const text = chats.length === 1 ? lesson : ANSWER;
      const lines = [
        { model: MODEL, message: { role: 'assistant', content: text }, done: false },
        {
          model: MODEL,
          message: { role: 'assistant', content: '' },
          done: true,
          done_reason: 'stop',
        },
      ];
      return route.fulfill({
        headers: { ...CORS, 'Content-Type': 'application/x-ndjson' },
        body: lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
      });
    }
    return route.fulfill({ status: 404, headers: CORS, body: '404 page not found' });
  });
}

/** The vision model on this computer, chosen and checked earlier (as Settings saves it). */
async function chooseLocalVision(page: Page) {
  await page.addInitScript(
    ({ base, model }) => {
      const yes = {
        listModels: 'yes',
        contextLength: 'yes',
        vision: 'yes',
        streaming: 'yes',
        cancel: 'yes',
        jsonSchema: 'yes',
        loadState: 'yes',
      };
      localStorage.setItem(
        'stemsim.local-ai',
        JSON.stringify({
          state: {
            userEndpoints: [],
            selected: { kind: 'ollama', baseUrl: base, model, label: `Ollama · ${model}` },
            checks: {
              [`ollama|${base}|${model}`]: {
                capabilities: yes,
                contextLength: 32768,
                checkedAt: Date.now(),
              },
            },
          },
          version: 1,
        }),
      );
      localStorage.setItem(
        'stemsim.teacher-chat',
        JSON.stringify({
          state: {
            engine: 'local',
            engineChosen: true,
            previousEngine: { engine: 'cloud', chosen: true },
          },
          version: 6,
        }),
      );
    },
    { base: OLLAMA, model: MODEL },
  );
}

/** A path through `points` with the mouse held down. */
async function stroke(page: Page, points: { x: number; y: number }[]) {
  const [first, ...rest] = points;
  if (!first) return;
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of rest) await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.mouse.up();
}

/** Taught on the board by the vision model on this computer, quickly ("Viết nhanh"). */
async function teach(page: Page, lesson: string) {
  const chats: ChatMessage[][] = [];
  const cloud: string[] = [];
  await fakeVisionOllama(page, chats, cloud, lesson);
  await chooseLocalVision(page);
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  await expect(board).toContainText('Hỏi AI Teacher một câu', { timeout: 20_000 });
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải bài rơi tự do');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 20_000 });
  expect(chats).toHaveLength(1);
  return { board, chats, cloud };
}

/** "Hỏi thầy chỗ này" on a circled picture: one PNG, on the learner's turn, nothing online. */
async function askAboutPicture(
  page: Page,
  { board, chats, cloud }: Awaited<ReturnType<typeof teach>>,
) {
  const bar = board.getByRole('group', { name: 'Chỗ em khoanh trên bảng' });
  await expect(bar).toContainText('Hình em khoanh');
  await expect(page.locator('.chat-panel')).toContainText('chỉ trên máy, không gửi lên mạng');
  await bar.getByRole('button', { name: 'Hỏi thầy chỗ này' }).click();
  await expect.poll(() => chats.length, { timeout: 20_000 }).toBe(2);
  const asked = chats[1] ?? [];
  const last = [...asked].reverse().find((m) => m.role === 'user');
  // A real PNG made in the browser (its signature, base64), on the learner's turn only.
  expect(last?.images?.[0]?.startsWith('iVBORw0KGgo')).toBe(true);
  expect(asked.filter((m) => (m.images ?? []).length > 0)).toHaveLength(1);
  const chat = page.locator('.chat-panel');
  await expect(chat.locator('article.chat-message--assistant').last()).toContainText(ANSWER, {
    timeout: 20_000,
  });
  expect(cloud).toEqual([]);
}

/** A loop of 32 segments around (cx, cy). */
const loopAround = (cx: number, cy: number, rx: number, ry: number) =>
  Array.from({ length: 33 }, (_, i) => {
    const a = (2 * Math.PI * i) / 32;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });

test('item 2: circling the learner’s own strokes sends a PNG to the vision model on this computer only', async ({
  page,
}) => {
  const taught = await teach(page, LESSON.join('\n'));
  const { board } = taught;
  // The learner draws a zigzag in an empty part of the board, then circles it.
  const sheet = await board.locator('.board__sheet').first().boundingBox();
  if (!sheet) throw new Error('no board');
  const cx = sheet.x + sheet.width * 0.7;
  const cy = sheet.y + sheet.height * 0.7;
  await board.getByRole('button', { name: 'Bút của em' }).click();
  await stroke(page, [
    { x: cx - 40, y: cy + 20 },
    { x: cx - 20, y: cy - 20 },
    { x: cx, y: cy + 20 },
    { x: cx + 20, y: cy - 20 },
    { x: cx + 40, y: cy + 20 },
  ]);
  await board.getByRole('button', { name: 'Khoanh để hỏi' }).click();
  await stroke(page, loopAround(cx, cy, 75, 50));
  await askAboutPicture(page, taught);
});

test('item 2: circling a drawing without labels sends its PNG (the drawing’s own SVG) to this computer only', async ({
  page,
}) => {
  const taught = await teach(
    page,
    `Ta vẽ hệ trục <draw id="d1" zone="diagram" type="axes" spec='{}'/>. Rồi viết <write id="s1" zone="steps">v = gt</write>.`,
  );
  const drawing = taught.board.locator('.board__drawing[data-draw-id="d1"]');
  const box = await drawing.boundingBox();
  if (!box) throw new Error('no drawing on the board');
  await taught.board.getByRole('button', { name: 'Khoanh để hỏi' }).click();
  await stroke(
    page,
    loopAround(
      box.x + box.width / 2,
      box.y + box.height / 2,
      box.width / 2 + 14,
      box.height / 2 + 14,
    ),
  );
  await askAboutPicture(page, taught);
});
