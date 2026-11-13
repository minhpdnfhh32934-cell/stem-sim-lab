import { expect, type Page, test } from '@playwright/test';
import { doStep, openNotebookResults, pick, piece, stepButton } from './bio-workspace';
import { bar, exitWorkspace, openWorkspace, workspace } from './chem-workspace';
import { continueInto, sceneSave } from './saves';
import { Aim, approach, expectDebug, position, shot, use, type Vec3 } from './support';

// The microscope station in the Biology Lab's south-east corner, in the real app: found in the
// catalog, reached by Continue from a save of a player standing in the lab (no developer jump),
// played with keyboard and mouse: read the board, walk up to the microscope, E opens the
// workspace, the onion slide is made on the prep tile (a clean slide, the specimen, the iodine
// stain, a coverslip) and put on the stage, the 10× objective and the stage at the focal plane
// are picked, "Observe" turns the fine focus, the eyepiece field comes alive, the field and the
// cells counted against the optics written out here, Exit puts the player where they stood.
// A prepared slide (cheek cells) has no preparation: only the stage, and its stain is closed.

const LAB = 'biology-lab';
const SCOPE = `${LAB}/digital-microscope`;
// Interaction targets (centres of the faces the player looks at) and where the player stands. The
// microscope stands on its own bench against the south wall, facing north; the desk is gone.
const T = {
  instructions: [-1, 1.725, 7.45],
  microscope: [0.45, 1.075, 7.15],
} satisfies Record<string, Vec3>;
const AT_BOARD = { x: -1, z: 6.4 };
const AT_SCOPE = { x: 0.5, z: 6.1 };

// M = 10 × 10, FOV = 18 mm/10 = 1800 µm, depth of field λ/NA² = 0.55 µm/0.25², written out here;
// onion cells are 250 µm long, so 7 whole ones fit across the field: 1800/7 = 257.143 µm each.
const FIELD = 18_000 / 10;
const DEPTH = 0.55 / 0.25 ** 2; // 8.8 µm
const COUNT = Math.floor(FIELD / 250);
const LENGTH = FIELD / COUNT;

/** A player in the lab in front of the microscope board, looking at it. */
const SAVE = sceneSave(LAB, [AT_BOARD.x, 0, AT_BOARD.z], T.instructions);

async function expectStation(page: Page, pattern: string, timeout = 15_000) {
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${SCOPE} ${pattern}`),
    { timeout },
  );
}

test('microscope: Continue, read, walk up, E, make the onion slide, 10× in focus, Observe, the count, Exit', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const catalog = page.locator('.menu-catalog');
  const item = catalog.locator('.menu-catalog-item[data-experiment="microscope"]');
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-place')).toHaveText('Played in Biology Laboratory');
  await expect(item.locator('.menu-run')).toHaveText('Not yet run to the end');

  const errors = await continueInto(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await expectDebug(page, 'Room', LAB);
  // Not ready: the onion is the slide at first, and it has to be made.
  await expectStation(page, 'idle specimen=0 stain=1 objective=4 focus=50 step 0/7');
  await expect(page.locator('.hud-objective')).toContainText('Observing cells');

  // 1. Read the board, then walk up to the microscope: it offers to work at the bench (E).
  await use(page, aim, T.instructions, `${LAB}/microscope-instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText('Microscope — instructions');
  await approach(page, aim, AT_SCOPE.x, AT_SCOPE.z);
  const stoodAt = await position(page);
  const ws = await openWorkspace(page, aim, T.microscope, SCOPE, 'microscopy');
  await expectStation(page, 'idle .* step 2/7'); // the board read, the microscope looked at
  // The bench is a workspace, not a desk; the prep tile is the hero until the slide is made.
  await expect(ws).toHaveAttribute('data-hero', 'prep');
  await expect(bar(page, 'run')).toHaveText('Observe');
  await expect(ws.locator('.ws-line')).toHaveText('Take a clean slide first.');
  const field = piece(page, 'eyepiece').locator('canvas.bio-field-canvas');
  const standby = piece(page, 'eyepiece').locator('.bio-standby');
  await expect(standby).toHaveText('Lamp off');
  const before = await field.evaluate((c: HTMLCanvasElement) => c.toDataURL());

  // 2. A step out of order is refused with the reason; nothing changes.
  await stepButton(page, 'stage').click({ force: true }); // aria-disabled: it says why, sends nothing
  await expect(piece(page, 'stage').locator('.bio-refusal')).toHaveText(
    'Take a clean slide first.',
  );
  await expect(stepButton(page, 'stage')).toHaveAttribute('aria-pressed', 'false');

  // 3. The onion slide, as spec 21 has it: a clean slide, the specimen, a stain, a coverslip, the
  // stage. The stain is chosen at the bottles first (iodine, the usual one for onion).
  await doStep(page, 'new-slide');
  await doStep(page, 'specimen');
  await pick(page, 'stains', 'Iodine solution');
  await doStep(page, 'stain');
  // Made: the station refuses another stain or specimen until the bench is cleared.
  await expect(piece(page, 'stains').locator('input[aria-disabled="true"]').first()).toBeAttached();
  await doStep(page, 'coverslip');
  await doStep(page, 'stage');
  await expect(ws.locator('.ws-state')).toHaveText('Ready');
  await expect(ws).toHaveAttribute('data-hero', 'field'); // the eyepiece takes over
  await expectStation(page, 'configured specimen=0 stain=1 objective=4 focus=50 step 3/7');

  // 4. The objective and the fine focus, each on the piece that owns it: 10×, Δz = 0 µm.
  await pick(page, 'nosepiece', '10× (total 100×)');
  await pick(page, 'focus', /^0 µm$/);
  await expectStation(page, 'configured specimen=0 stain=1 objective=10 focus=0 step 5/7');
  await shot(page, 'microscope-1-before');

  // 5. Observe: the fine focus lowers the stage 100 µm in 5 s; the field comes alive.
  await bar(page, 'run').click();
  await expect(ws.locator('.ws-state')).toHaveText('Running');
  await expect(standby).toHaveText('');
  await expectStation(
    page,
    `completed .* magnification=100.000 fieldOfView=${FIELD.toFixed(3)} depthOfField=${DEPTH.toFixed(3)} sharpness=1.000 contrast=0.800 cellsCounted=${COUNT}.000 measuredLength=${LENGTH.toFixed(3)} step 6/7`,
    60_000,
  );
  await expect(ws.locator('.ws-state')).toHaveText('Completed');
  expect(await field.evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(before);
  await shot(page, 'microscope-2-focused');

  // 6. Measure: the diameter of the field and the cells counted across it, the model's n.
  await piece(page, 'eyepiece').getByRole('button', { name: 'Measure' }).click();
  await expect(piece(page, 'eyepiece').locator('.bio-count')).toContainText(
    `${COUNT} cells counted`,
  );

  // 7. The results in the notebook: the field, the count and the length beside the theory.
  const panel = await openNotebookResults(page);
  await expect(panel.locator('h2')).toContainText('Observing cells');
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  const result = (id: string) => panel.locator(`tr[data-result="${id}"]`);
  await expect(result('magnification').locator('.measured')).toHaveText('100.000 ×');
  await expect(result('fieldOfView').locator('.theory')).toHaveText(`${FIELD.toFixed(3)} µm`);
  await expect(result('fieldOfView').locator('.measured')).toHaveText(`${FIELD.toFixed(3)} µm`);
  await expect(result('contrast').locator('.measured')).toHaveText('0.800 (Clear)');
  await expect(result('cellsCounted').locator('.measured')).toHaveText(
    `${COUNT}.000 (Few: a rough length)`,
  );
  await expect(result('measuredLength').locator('.theory')).toHaveText(
    '250.000 µm (From the count)',
  );
  await expect(result('measuredLength').locator('.measured')).toHaveText(
    `${LENGTH.toFixed(3)} µm (From the count)`,
  );
  await expect(panel.locator('svg[data-graph="focus-curve"]')).toBeVisible();
  await expectStation(page, 'completed .* step 7/7');
  await page.keyboard.press('Escape'); // the results sheet
  await shot(page, 'microscope-3-results');

  // 8. A prepared slide: Clear the bench, choose the cheek cells in the library. Only the stage is
  // asked for, and its stain stays the player's choice (the station refuses nothing here).
  await bar(page, 'clear').click();
  await expectStation(page, 'idle specimen=0 .*');
  await pick(page, 'specimens', 'Human cheek cells');
  await expect(stepButton(page, 'new-slide')).toHaveCount(0);
  await expect(stepButton(page, 'stage')).toBeVisible();
  await expect(ws.locator('.ws-line')).toHaveText('Put the slide on the microscope stage first.');
  await expect(piece(page, 'stains').locator('input[aria-disabled="false"]')).toHaveCount(3);
  await pick(page, 'stains', 'Methylene blue');
  await doStep(page, 'stage');
  await expect(ws.locator('.ws-state')).toHaveText('Ready');

  // 9. Exit: the same spot in the lab.
  await exitWorkspace(page, stoodAt);
  await expect(workspace(page)).toBeHidden();

  // 10. Back in the menu (the game saves on leaving the page): the run is marked in the catalog.
  await page.reload();
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-run')).toHaveText('Run completed');
  expect(errors).toEqual([]);
});
