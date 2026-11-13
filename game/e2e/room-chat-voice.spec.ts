import { expect, test, type Browser, type Page } from '@playwright/test';
import { expectDebug, openMultiplayer, roomIdOf, shot } from './support';

// Chat and voice in a LAN room (Phú 2026-11-12, "as in Minecraft, with voice"): two browsers in
// one room. Enter opens the chat line, Enter sends it, the other sees it; held V talks, the other
// hears it (the browser's fake microphone, a beep: its level shows the speaker's name there).
// The pages are on localhost, a secure page: the microphone is given.

test.use({
  launchOptions: {
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
});

const opened: Page[] = [];
test.afterEach(async () => {
  for (const page of opened.splice(0)) await page.context().close();
});

async function player(browser: Browser, errors: string[]): Promise<Page> {
  const context = await browser.newContext({ permissions: ['microphone'] });
  const page = await context.newPage();
  opened.push(page);
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await openMultiplayer(page);
  return page;
}

test('room chat and push-to-talk voice between two players', async ({ browser }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  const a = await player(browser, errors);
  await a.getByLabel('Your name').fill('An');
  await a.getByLabel('Room name').fill('Lớp chat');
  await a.getByRole('button', { name: 'Create room' }).click();
  await expectDebug(a, 'Phase', 'playing');
  const id = await roomIdOf(a);
  const b = await player(browser, errors);
  await b.getByLabel('Your name').fill('Bình');
  await b.getByLabel('Room ID').fill(id);
  await b.locator('.multiplayer-box').getByRole('button', { name: 'Join' }).click();
  await expectDebug(b, 'Phase', 'playing');
  await expectDebug(a, 'Players', `${id} 2/8 · Bình`);

  // Chat: Enter opens the line (the game goes on), Enter sends; both see it, the sender's own.
  await a.keyboard.press('Enter');
  const entry = a.locator('.chat-entry');
  await expect(entry).toBeVisible();
  await expect(entry).toBeFocused();
  await a.keyboard.type('Xin chào cả lớp <b>!</b>');
  await a.keyboard.press('Enter');
  await expect(entry).toBeHidden();
  await expectDebug(a, 'Phase', 'playing'); // not paused by the freed mouse
  const lineB = b.locator('.chat-line').last();
  await expect(lineB).toHaveText('<An> Xin chào cả lớp <b>!</b>'); // text, never markup
  await expect(a.locator('.chat-line.own')).toHaveText('<An> Xin chào cả lớp <b>!</b>');
  // Esc closes the line unsent, without the pause menu.
  await b.keyboard.press('Enter');
  await b.keyboard.type('chưa gửi');
  await b.keyboard.press('Escape');
  await expect(b.locator('.chat-entry')).toBeHidden();
  await expect(b.locator('.pause')).toBeHidden();
  await expect(a.locator('.chat-line')).toHaveCount(1);
  await shot(b, 'room-chat-1');

  // Voice: both microphones given; held V on A, B hears An; let go, silence.
  await expect(a.locator('.voice-self')).toHaveText('Hold V to talk', { timeout: 15_000 });
  await expect(b.locator('.voice-self')).toHaveText('Hold V to talk');
  await a.keyboard.down('v');
  await expect(a.locator('.voice.talking .voice-self')).toHaveText('🎙 Talking…');
  await expect(b.locator('.voice-speakers')).toHaveText('🔊 An', { timeout: 20_000 });
  await shot(b, 'room-voice-1-heard');
  await a.keyboard.up('v');
  await expect(b.locator('.voice-speakers')).toHaveText('', { timeout: 10_000 });
  // And the other way.
  await b.keyboard.down('v');
  await expect(a.locator('.voice-speakers')).toHaveText('🔊 Bình', { timeout: 20_000 });
  await b.keyboard.up('v');
  expect(errors).toEqual([]);
});
