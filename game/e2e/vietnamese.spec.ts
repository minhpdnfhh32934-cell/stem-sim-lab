import { expect, test } from '@playwright/test';
import {
  Aim,
  approach,
  dial,
  expectDebug,
  labSave,
  menuContinue,
  menuNewGame,
  shot,
  use,
  type Vec3,
  openSettings,
} from './support';

// Phase 6G in the real app: the free-fall station played in Vietnamese. The language is chosen
// the way a player chooses it — Settings in the main menu — then Continue (Tiếp tục) into the
// Physics Lab; the run is the same as in free-fall.spec.ts and its numbers must be too: only the
// words change. The debug panel stays English, so it still reports the station's state.

const LAB = 'physics-lab';
const T = {
  tower: [1.467, 1.6, -6.85],
  instructions: [0.317, 2.425, -7.03],
  dialHeight: [2.717, 0.875, -5.9],
  run: [1.867, 0.875, -5.9],
  monitor: [2.467, 1.775, -7.455],
} satisfies Record<string, Vec3>;
const AT_DESK = { x: 2.017, z: -5.35 };
const AT_BOARD = { x: 0.567, z: -5.35 };
const AT_MONITOR = { x: 2.467, z: -5.35 };

// Theory written out here, independently of the game: a release from rest at h = 2.5 m on Earth.
const T_FALL = Math.sqrt((2 * 2.5) / 9.81);
const V_IMPACT = -Math.sqrt(2 * 9.81 * 2.5);
const hud = (value: number) => Number(value.toPrecision(4)).toString().replace('-', '−');
const panelValue = (value: number) => value.toFixed(3).replace('-', '−');

test('free fall in Vietnamese: chosen in Settings, played through, the same numbers', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: 'simlab.save.slot-1', value: JSON.stringify(labSave([2.017, 0, -5.35], T.tower)) },
  );
  await page.goto('/');
  await openSettings(page);
  await page.getByLabel('Tiếng Việt').check();
  await menuContinue(page);
  await expectDebug(page, 'Scene', LAB);
  await expectDebug(page, 'Phase', 'playing');

  const aim = new Aim(page);
  await aim.sync();
  const objective = page.locator('.hud-objective');
  await expect(objective).toContainText('Rơi tự do');
  await expect(objective).toContainText('Bước 1/5');
  await expect(objective).toContainText('Đọc hướng dẫn rơi tự do trên bảng.');
  await expect(page.locator('.hud-hint')).toContainText('Nhấp chuột để nhìn quanh');

  // The board: Xem (Inspect), its Vietnamese title in the notice.
  await approach(page, aim, AT_BOARD.x, AT_BOARD.z);
  await use(page, aim, T.instructions, `${LAB}/instructions`, 'Xem');
  await expect(page.locator('.hud-toast').last()).toContainText('Rơi tự do — hướng dẫn');
  await expectDebug(page, 'Station', `${LAB}/tower configured .* step 1/5`);
  await expect(objective).toContainText('Đặt độ cao thả h');

  // The desk: the h dial offers Tăng h (E) and Giảm h (F); h 1.5 → 2.5 m.
  await approach(page, aim, AT_BOARD.x, AT_DESK.z);
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await aim.at(T.dialHeight);
  await expect(page.locator('.hud-prompt')).toContainText('Tăng h');
  await expect(page.locator('.hud-prompt')).toContainText('Giảm h');
  await dial(page, aim, T.dialHeight, `${LAB}/dial-height`, 'e', 10);
  await expectDebug(page, 'Station', `${LAB}/tower configured height=2.5 gravity=9.81 .* step 2/5`);

  // CHẠY (RUN): the same fall, the same results as in English.
  await use(page, aim, T.run, `${LAB}/button-run`, 'CHẠY');
  await expectDebug(
    page,
    'Station',
    `${LAB}/tower completed .* fall-time=${T_FALL.toFixed(3)} impact-velocity=${V_IMPACT.toFixed(3)}`,
  );
  await expect(page.locator('.hud-toast').last()).toHaveText(
    `Rơi tự do — t: ${hud(T_FALL)} s · v: ${hud(V_IMPACT)} m/s`,
  );
  await aim.at(T.tower);
  await page.waitForTimeout(400);
  await shot(page, 'vietnamese-1-desk');

  // The results monitor and the full results, in Vietnamese around the same numbers.
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  await aim.at(T.monitor);
  await expectDebug(page, 'Focus', `${LAB}/monitor`);
  await expect(page.locator('.hud-prompt')).toContainText('Xem kết quả');
  await page.waitForTimeout(400);
  await shot(page, 'vietnamese-2-monitor');
  await page.keyboard.press('e');
  const panel = page.locator('.results-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('h2')).toContainText('Rơi tự do — lần chạy 1 (hoàn tất)');
  await expect(panel.locator('.results-table:not(.results-reading) th')).toHaveText([
    '',
    'Lý thuyết',
    'Mô phỏng',
    'Chênh lệch',
    'Thời gian rơi',
    'Vận tốc chạm sàn',
  ]);
  for (const [result, value, unit] of [
    ['fall-time', T_FALL, 's'],
    ['impact-velocity', V_IMPACT, 'm/s'],
  ] as const) {
    const row = panel.locator(`tr[data-result="${result}"]`);
    await expect(row.locator('.theory')).toHaveText(`${panelValue(value)} ${unit}`);
    await expect(row.locator('.measured')).toHaveText(`${panelValue(value)} ${unit}`);
  }
  await expect(panel.locator('.results-main h3')).toHaveText(
    'Thời gian rơi t, đọc bằng: Đồng hồ (cổng quang)',
  );
  await expect(panel.locator('table.results-reading th')).toHaveText([
    'Số đọc',
    'Độ phân giải d',
    'Độ không đảm bảo chuẩn u = d/√12',
    'Sai số làm tròn lớn nhất d/2',
  ]);
  await expect(panel.locator('table.results-reading[data-reading="fall-time"] td')).toHaveText([
    `${T_FALL.toFixed(2)} s`,
    '0.01 s',
    '0.0029 s',
    '0.005 s',
  ]);
  await expect(panel).toContainText('Khối lượng không ảnh hưởng');
  await expect(panel.locator('svg[data-graph="height-time"]')).toContainText(
    'Độ cao theo thời gian',
  );
  await expect(panel.locator('svg[data-graph="height-time"]')).toContainText('y (m)');
  await expect(panel.locator('.results-runs h3')).toHaveText('Các lần chạy');
  await shot(page, 'vietnamese-3-results');
  expect(errors).toEqual([]);
});

test('the cleanroom entry in Vietnamese: objective, prompt and the reason the door stays shut', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await openSettings(page);
  await page.getByLabel('Tiếng Việt').check();
  await menuNewGame(page);
  await expectDebug(page, 'Scene', 'preparation-room');
  const objective = page.locator('.hud-objective');
  await expect(objective).toContainText('Vào phòng sạch');
  await expect(objective).toContainText('Bước 1/15 · Tìm hiểu quy định');
  await expect(objective).toContainText('Đọc quy định vào phòng sạch trên bảng thông báo.');
  // Spawn faces north through the doorway: walk down the corridor until the door is in focus.
  await page.keyboard.down('w');
  await expectDebug(page, 'Focus', 'cleanroom-corridor/door-hub');
  await page.keyboard.up('w');
  const reason = 'Chưa được vào. Tiếp theo: Đọc quy định vào phòng sạch trên bảng thông báo.';
  await expect(page.locator('.hud-prompt')).toContainText('Vào khu vực sạch (Sảnh SIMLAB)');
  await expect(page.locator('.hud-prompt .hud-blocked')).toHaveText(reason);
  await page.keyboard.press('e');
  await expect(page.locator('.hud-toast.warn').last()).toHaveText(reason);
  await page.screenshot({ path: 'test-results/vietnamese-4-entry-blocked.png' });
  await expectDebug(page, 'Scene', 'preparation-room'); // still here
  expect(errors).toEqual([]);
});
