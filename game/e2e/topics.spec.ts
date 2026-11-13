import { readdirSync, readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import {
  Aim,
  expectDebug,
  lookAngles,
  type Vec3,
  walkThrough,
  menuNewGame,
  menuContinue,
  openSolo,
  closePlay,
  openSettings,
  closeSettings,
} from './support';

const content = (file: string) =>
  JSON.parse(readFileSync(new URL(`../src/content/${file}`, import.meta.url), 'utf8')) as unknown;
const topics = content('topics.json') as { experiments: string[] }[];
/** Every experiment definition: one file each, `experiments/<id>.json`. */
const experiments = readdirSync(new URL('../src/content/experiments/', import.meta.url))
  .filter((file) => file.endsWith('.json'))
  .map((file) => content(`experiments/${file}`)) as {
  id: string;
  description?: string;
  note?: string;
  vi?: { description?: string; note?: string };
  procedure: { instruction: string; vi?: { instruction?: string } }[];
}[];
/** The experiments the catalog lists, in its order: those of the topics, topic by topic. */
const listed = topics.flatMap((t) => t.experiments);
const laboratories = content('laboratories.json') as {
  displayName: string;
  vi: { displayName: string };
  experiments?: string[];
}[];
/** The laboratory an experiment is played in (its scene bears the same name), in each language. */
const labOf = (id: string) => {
  const lab = laboratories.find((l) => l.experiments?.includes(id))!;
  return { en: lab.displayName, vi: lab.vi.displayName };
};

// Phase R4 in the real app — formerly the main menu's "Experiments by topic" (Phases 9, 11, 12B,
// 13B, 13C): the experiment catalog, a page of the menu, lists the content's subjects, topics and
// experiments, each with where its station stands, what it teaches, how to run it, the way there
// from a new game and from the saved game, and whether that save ran it to its natural end — in
// English and in Vietnamese. Browsing it moves nothing; the menu still starts a game.

/** The way to an experiment's laboratory from where a new game starts. */
const newGameWay = (id: string) =>
  `From a new game: Preparation Room → Cleanroom entry → SIMLAB Hub → ${labOf(id).en}`;

/** Opens the catalog from the Home by its button, named in the language shown. */
async function openCatalog(page: Page, name = 'Experiment catalog') {
  await closeSettings(page);
  await page.getByRole('button', { name, exact: true }).click();
  const catalog = page.locator('.menu-catalog');
  await expect(catalog).toBeVisible();
  // The experiments load the first time it opens: the list replaces the loading line.
  await expect(catalog.locator('.menu-catalog-status')).toHaveCount(0);
  return catalog;
}

/** Back to the Home by the catalog's button, named in the language shown. */
async function backHome(page: Page, name = 'Back to the main menu') {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.locator('.menu-panel')).toBeVisible();
}

/** Reloads the menu with a save in `sceneId` listing `completed` (only read by the menu here). */
async function menuWith(page: Page, sceneId: string, completed: string[] = []) {
  const save = {
    version: 2,
    savedAt: '2026-10-23T00:00:00.000Z',
    player: {
      characterId: 'researcher-male',
      sceneId,
      position: [0, 0, 0],
      yaw: 0,
      pitch: 0,
      equipment: [],
    },
    world: { entityStates: {} },
    progression: { completedExperiments: completed, procedures: {} },
  };
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: 'simlab.save.slot-1',
    value: JSON.stringify(save),
  });
  await page.reload();
}

const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};

test('catalog: opened from the Home, by subject, topic and experiment, in English and Vietnamese', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/');
  // The Home keeps its controls and has no topic section any more.
  await expect(page.locator('.menu-topics')).toHaveCount(0);
  await expect(page.getByText('Experiments by topic')).toHaveCount(0);
  await expect(page.locator('.menu-catalog')).toBeHidden();

  const catalog = await openCatalog(page);
  await expect(page.locator('.menu-panel')).toBeHidden(); // a page in place of the panel
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('.menu-sky')).toBeVisible(); // the sky stays behind it
  await expect(catalog.locator('h2')).toBeFocused(); // its title read first
  await expect(catalog.locator('h3')).toHaveText([
    'Physics Laboratory',
    'Chemistry Laboratory',
    'Biology Laboratory',
  ]);
  await expect(catalog.locator('h4')).toHaveText([
    'Kinematics',
    'Dynamics',
    'Conservation laws',
    'Fluids',
    'Oscillations and waves',
    'Electricity',
    'Optics',
    'Thermal physics',
    'Ideal gases',
    'Magnetism',
    'Nuclear physics',
    'Acids and bases',
    'Solutions and concentration',
    'Reaction rates',
    'States of matter',
    'Ions in solution and precipitation',
    'Separating mixtures',
    'Energy in reactions',
    'Chemical equilibrium',
    'Electrochemistry',
    'Organic compounds',
    'Particles: models and simulations',
    'Cells',
    'Biological molecules',
    'Transport across membranes',
    'Enzymes',
    'Photosynthesis',
    'Water in plants',
    'Respiration',
    'Inheritance',
    'Ecology',
    'Genes, proteins and mutations',
    'Evolution and populations',
    'The human body',
    'Plant responses',
  ]);
  // Every laboratory has experiments now: none says it is planned.
  await expect(catalog.locator('.menu-planned')).toHaveCount(0);
  // As many experiments as the topics list, nothing more, each with where it is played.
  const items = catalog.locator('.menu-catalog-item');
  await expect(items).toHaveCount(listed.length);
  expect(
    await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-experiment'))),
  ).toEqual(listed);
  await expect(items.locator('.menu-experiment')).toHaveText([
    'Free fall',
    'Projectile motion',
    'Measuring speed with photogates',
    "Air track: uniform motion and Newton's second law",
    "Air track: uniform motion and Newton's second law",
    'Atwood machine: bodies joined over a pulley',
    "Hooke's law",
    'Friction on an inclined plane',
    'Uniform circular motion',
    'Composition of concurrent forces',
    'Moment of a force: the lever balance',
    'Conservation of mechanical energy',
    'Collisions and momentum on an air track',
    'Density and buoyancy',
    'Pressure in a liquid against depth',
    'Simple pendulum',
    'Forced oscillation and resonance',
    'Measuring the frequency of a sound with an oscilloscope',
    'Interference of water waves in a ripple tank',
    'Standing waves on a string',
    'The speed of sound with a resonance tube',
    'The electric field of point charges (simulation)',
    "Ohm's law: series and parallel resistors",
    'Electrical power: P = U·I',
    'Charging and discharging a capacitor',
    'EMF and internal resistance of a cell',
    'Refraction and total internal reflection',
    'Reflection from a plane mirror',
    'Converging lens',
    "Young's double slit: the wavelength of laser light",
    'The specific heat capacity of water',
    'The specific latent heat of fusion of ice',
    "Boyle's law: pressure and volume of a gas",
    "Charles's law: volume and temperature of a gas",
    'The force on a current in a magnetic field',
    'Electromagnetic induction: a magnet through a coil',
    'The AC generator',
    'Radioactive decay and half-life (simulation)',
    'Acid–base titration',
    'Measuring pH: strong and weak acids, bases and a buffer',
    'Dilution: C₁V₁ = C₂V₂',
    'Solubility and temperature',
    'Reaction rate: crystal violet fading',
    'Collision theory: why heat and concentration speed reactions',
    'Heating curve of water',
    'Testing for ions: precipitation reactions',
    'Separating salt from sand: dissolve, filter, evaporate',
    'Enthalpy of neutralisation',
    "Chemical equilibrium and Le Chatelier's principle: NO₂ and N₂O₄",
    'Galvanic cells: the Daniell cell and the electrochemical series',
    "Electrolysis of copper sulfate: Faraday's laws",
    'Reactivity of the halogens: displacement reactions',
    'What makes iron rust: conditions for corrosion',
    'Making soap: saponification of a fat',
    'Speeds of gas molecules: the Maxwell–Boltzmann distribution',
    'Electrons in atoms: shells, configuration and the periodic table',
    'Atomic orbitals: where the electron is likely to be',
    'Shapes of molecules (VSEPR) and polarity',
    'Balancing equations: conservation of atoms and mass',
    'Observing cells under the microscope',
    'Cell division: mitosis and meiosis',
    'Tests for biological molecules: unknown samples',
    'Osmosis in potato tissue',
    'Diffusion and cell size: agar cubes',
    'Plasmolysis in onion cells',
    'Enzyme activity',
    'Rate of photosynthesis',
    'Transpiration: a bubble potometer',
    'Respiration of germinating seeds: a respirometer',
    'Fermentation by yeast',
    "Mendel's laws: a dihybrid cross in peas",
    'Estimating a population: mark and recapture',
    'Population growth: the logistic curve',
    'Predator and prey: the Lotka–Volterra cycles',
    'From gene to protein: transcription, translation and mutations',
    'Extracting DNA from strawberries',
    'Human karyotypes and chromosome mutations',
    'Population genetics: Hardy–Weinberg and genetic drift',
    'Heart rate during exercise and recovery',
    'Tropisms: shoots bending to light and gravity',
  ]);
  // Phase T-1a: the wing rebuilt — the range keeps the launcher, the bay the pendulum and the whirl,
  // the optics room the ray optics, the lab the rest.
  await expect(items.locator('.menu-place')).toHaveText([
    'Played in Physics Laboratory',
    'Played in Physics Laboratory · Projectile range',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory · Pendulum bay',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory · Pendulum bay',
    'Played in Physics Laboratory · Pendulum bay',
    'Played in Physics Laboratory · Waves & Optics Room',
    'Played in Physics Laboratory · Waves & Optics Room',
    'Played in Physics Laboratory · Waves & Optics Room',
    'Played in Physics Laboratory · Waves & Optics Room',
    'Played in Physics Laboratory · Waves & Optics Room',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory · Waves & Optics Room',
    'Played in Physics Laboratory · Waves & Optics Room',
    'Played in Physics Laboratory · Waves & Optics Room',
    'Played in Physics Laboratory · Waves & Optics Room',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory',
    'Played in Physics Laboratory · Pendulum bay',
    'Played in Physics Laboratory · Pendulum bay',
    'Played in Chemistry Laboratory',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory',
    'Played in Chemistry Laboratory',
    'Played in Chemistry Laboratory',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Chemistry Laboratory · Chemistry Practice Room',
    'Played in Biology Laboratory',
    'Played in Biology Laboratory · Biology Practice Room',
    'Played in Biology Laboratory',
    'Played in Biology Laboratory',
    'Played in Biology Laboratory · Biology Practice Room',
    'Played in Biology Laboratory · Biology Practice Room',
    'Played in Biology Laboratory',
    'Played in Biology Laboratory',
    'Played in Biology Laboratory',
    'Played in Biology Laboratory',
    'Played in Biology Laboratory · Biology Practice Room',
    'Played in Biology Laboratory',
    'Played in Biology Laboratory',
    'Played in Biology Laboratory · Biology Practice Room',
    'Played in Biology Laboratory · Biology Practice Room',
    'Played in Biology Laboratory · Biology Practice Room',
    'Played in Biology Laboratory · Biology Practice Room',
    'Played in Biology Laboratory · Biology Practice Room',
    'Played in Biology Laboratory · Biology Practice Room',
    'Played in Biology Laboratory · Biology Practice Room',
    'Played in Biology Laboratory · Biology Practice Room',
  ]);
  // The way from where a new game starts, through the gate on it, under each experiment.
  await expect(items.locator('.menu-route')).toHaveText(listed.map(newGameWay));
  // Browsing only: the one button is Back — no Play, nothing that starts or moves the game.
  await expect(catalog.locator('button')).toHaveCount(1);
  await expect(catalog.getByText(/\bplay\b/i)).toHaveCount(0);

  // Esc goes back, the focus on the button that opened the catalog; so does Back.
  await page.keyboard.press('Escape');
  await expect(catalog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Experiment catalog' })).toBeFocused();
  await openCatalog(page);
  await backHome(page);
  await expect(page.getByRole('button', { name: 'Experiment catalog' })).toBeFocused();

  await openSettings(page);
  await page.getByLabel('Tiếng Việt').check();
  await openCatalog(page, 'Danh mục thí nghiệm');
  await expect(catalog.locator('h3')).toHaveText([
    'Phòng thí nghiệm Vật lý',
    'Phòng thí nghiệm Hóa học',
    'Phòng thí nghiệm Sinh học',
  ]);
  await expect(catalog.locator('h4')).toHaveText([
    'Động học',
    'Động lực học',
    'Các định luật bảo toàn',
    'Chất lưu',
    'Dao động và sóng',
    'Điện học',
    'Quang học',
    'Vật lí nhiệt',
    'Khí lí tưởng',
    'Từ trường',
    'Vật lí hạt nhân',
    'Axit và bazơ',
    'Dung dịch và nồng độ',
    'Tốc độ phản ứng',
    'Các thể của chất',
    'Ion trong dung dịch và phản ứng kết tủa',
    'Tách các chất ra khỏi hỗn hợp',
    'Năng lượng trong phản ứng hóa học',
    'Cân bằng hóa học',
    'Điện hóa học',
    'Hợp chất hữu cơ',
    'Hạt vi mô: mô hình và mô phỏng',
    'Tế bào',
    'Các phân tử sinh học',
    'Vận chuyển các chất qua màng',
    'Enzyme',
    'Quang hợp',
    'Trao đổi nước ở thực vật',
    'Hô hấp',
    'Di truyền học',
    'Sinh thái học',
    'Gen, prôtêin và đột biến',
    'Tiến hóa và quần thể',
    'Cơ thể người',
    'Cảm ứng ở thực vật',
  ]);
  await expect(items.locator('.menu-experiment')).toHaveText([
    'Rơi tự do',
    'Chuyển động ném xiên',
    'Đo tốc độ bằng cổng quang điện',
    'Đệm khí: chuyển động thẳng đều và định luật II Newton',
    'Đệm khí: chuyển động thẳng đều và định luật II Newton',
    'Máy Atwood: hai vật nối với nhau qua ròng rọc',
    'Định luật Húc',
    'Ma sát trên mặt phẳng nghiêng',
    'Chuyển động tròn đều',
    'Tổng hợp hai lực đồng quy',
    'Momen lực: đòn bẩy cân bằng',
    'Bảo toàn cơ năng',
    'Va chạm và động lượng trên đệm khí',
    'Khối lượng riêng và lực đẩy Ác-si-mét',
    'Áp suất chất lỏng theo độ sâu',
    'Con lắc đơn',
    'Dao động cưỡng bức và hiện tượng cộng hưởng',
    'Đo tần số của sóng âm bằng dao động kí',
    'Giao thoa sóng nước trong chậu sóng',
    'Sóng dừng trên sợi dây',
    'Đo tốc độ truyền âm bằng ống cộng hưởng',
    'Điện trường của điện tích điểm (mô phỏng)',
    'Định luật Ôm: đoạn mạch nối tiếp và song song',
    'Công suất điện: P = U·I',
    'Nạp và phóng điện cho tụ điện',
    'Đo suất điện động và điện trở trong của pin',
    'Khúc xạ ánh sáng và phản xạ toàn phần',
    'Phản xạ ánh sáng trên gương phẳng',
    'Thấu kính hội tụ',
    'Thí nghiệm Y-âng: đo bước sóng ánh sáng laser',
    'Đo nhiệt dung riêng của nước',
    'Đo nhiệt nóng chảy riêng của nước đá',
    'Định luật Boyle: áp suất và thể tích của chất khí',
    'Định luật Charles: thể tích và nhiệt độ của chất khí',
    'Lực từ tác dụng lên dòng điện',
    'Cảm ứng điện từ: nam châm đi qua cuộn dây',
    'Máy phát điện xoay chiều',
    'Sự phóng xạ và chu kì bán rã (mô phỏng)',
    'Chuẩn độ axit – bazơ',
    'Đo pH: axit mạnh, axit yếu, bazơ và dung dịch đệm',
    'Pha loãng dung dịch: C₁V₁ = C₂V₂',
    'Độ tan và nhiệt độ',
    'Tốc độ phản ứng: tím tinh thể mất màu',
    'Thuyết va chạm: vì sao nhiệt độ và nồng độ làm phản ứng nhanh hơn',
    'Đường cong đun nóng của nước',
    'Nhận biết ion: phản ứng tạo kết tủa',
    'Tách muối ra khỏi cát: hòa tan, lọc, cô cạn',
    'Nhiệt trung hòa',
    'Cân bằng hóa học và nguyên lý Lơ Sa-tơ-li-ê: NO₂ và N₂O₄',
    'Pin điện hóa: pin Đa-ni-en và dãy điện hóa',
    'Điện phân dung dịch đồng sunfat: định luật Fa-ra-đây',
    'Tính oxi hóa của các halogen: phản ứng thế',
    'Vì sao sắt bị gỉ: điều kiện của sự ăn mòn',
    'Điều chế xà phòng: phản ứng xà phòng hóa chất béo',
    'Tốc độ của phân tử khí: phân bố Maxwell–Boltzmann',
    'Electron trong nguyên tử: lớp electron, cấu hình và bảng tuần hoàn',
    'Orbital nguyên tử: nơi electron thường có mặt',
    'Hình học phân tử (VSEPR) và độ phân cực',
    'Cân bằng phương trình: bảo toàn nguyên tử và khối lượng',
    'Quan sát tế bào dưới kính hiển vi',
    'Phân bào: nguyên phân và giảm phân',
    'Nhận biết các phân tử sinh học: các mẫu chưa biết',
    'Thẩm thấu ở mô khoai tây',
    'Khuếch tán và kích thước tế bào: khối thạch',
    'Hiện tượng co nguyên sinh ở tế bào vảy hành',
    'Hoạt tính enzyme',
    'Tốc độ quang hợp',
    'Thoát hơi nước: bình đo bằng bọt khí (potometer)',
    'Hô hấp của hạt đang nảy mầm: hô hấp kế',
    'Lên men rượu nhờ nấm men',
    'Các quy luật Menđen: phép lai hai cặp tính trạng ở đậu Hà Lan',
    'Ước tính kích thước quần thể: phương pháp bắt – thả – bắt lại',
    'Sự tăng trưởng của quần thể: đường cong logistic',
    'Vật ăn thịt và con mồi: chu kì Lotka–Volterra',
    'Từ gen đến prôtêin: phiên mã, dịch mã và đột biến',
    'Tách chiết ADN từ quả dâu tây',
    'Bộ nhiễm sắc thể người và đột biến số lượng NST',
    'Di truyền quần thể: định luật Hacđi–Vanbec và phiêu bạt di truyền',
    'Nhịp tim khi vận động và khi nghỉ',
    'Hướng động: thân cây uốn cong theo ánh sáng và trọng lực',
  ]);
  await expect(items.locator('.menu-place')).toHaveText([
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Khu ném xiên',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Khu con lắc',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Khu con lắc',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Khu con lắc',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Phòng Sóng và Quang học',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Phòng Sóng và Quang học',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Phòng Sóng và Quang học',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Phòng Sóng và Quang học',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Phòng Sóng và Quang học',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Phòng Sóng và Quang học',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Phòng Sóng và Quang học',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Phòng Sóng và Quang học',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Phòng Sóng và Quang học',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Khu con lắc',
    'Thực hiện tại Phòng thí nghiệm Vật lý · Khu con lắc',
    'Thực hiện tại Phòng thí nghiệm Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Hóa học · Phòng thực hành Hóa học',
    'Thực hiện tại Phòng thí nghiệm Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
    'Thực hiện tại Phòng thí nghiệm Sinh học · Phòng thực hành Sinh học',
  ]);
  await expect(items.locator('.menu-route').first()).toHaveText(
    'Từ trò chơi mới: Phòng chuẩn bị → Vào phòng sạch → Sảnh SIMLAB → Phòng thí nghiệm Vật lý',
  );
  await page.screenshot({ path: 'test-results/catalog-vi.png' });

  // A short window: the page starts on screen and scrolls to the rest.
  await page.setViewportSize({ width: 1280, height: 520 });
  expect((await catalog.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await backHome(page, 'Quay lại màn hình chính');
  await openSettings(page);
  await page.getByLabel('English').check();
  // The Home still starts a game.
  await menuNewGame(page);
  await expectDebug(page, 'Scene', 'preparation-room');
  expect(errors).toEqual([]);
});

// The way's last door, walked in the game: from the hub through "Enter Physics Lab". The player
// is put in the hub by Continue from a save — the game's own load path, no developer jump.
test('directions: the hub door the way names leads into the Physics Lab', async ({ page }) => {
  const errors = watchErrors(page);
  const DOOR: Vec3 = [12.95, 1.05, -3]; // simlab-hub/door-physics, east wall
  const STAND: Vec3 = [11.2, 0, -3];
  const [yaw, pitch] = lookAngles(STAND, DOOR);
  const save = {
    version: 2,
    savedAt: '2026-10-23T00:00:00.000Z',
    player: {
      characterId: 'researcher-male',
      sceneId: 'simlab-hub',
      position: STAND,
      yaw,
      pitch,
      equipment: [],
    },
    world: { entityStates: {} },
    progression: { completedExperiments: [], procedures: {} },
  };
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: 'simlab.save.slot-1', value: JSON.stringify(save) },
  );
  await page.goto('/');
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'simlab-hub');
  const aim = new Aim(page);
  await aim.sync();
  await aim.at(DOOR);
  await expectDebug(page, 'Focus', 'simlab-hub/door-physics');
  // It slides open: through it, 1 m into the lab.
  await walkThrough(page, {
    label: 'Enter Physics Lab',
    to: 'physics-lab',
    done: (p) => p[0] > -4,
  });
  await expectDebug(page, 'Room', 'physics-lab');
  expect(errors).toEqual([]);
});

// Under the way from a new game, the way from the save Continue would load — and none for a save
// Continue would refuse.
test('catalog directions from the saved game Continue would load', async ({ page }) => {
  const errors = watchErrors(page);
  const catalog = page.locator('.menu-catalog');
  const fromNewGame = catalog.locator('.menu-route');
  const fromSave = catalog.locator('.menu-saved-route');
  const each = (text: (id: string) => string) => listed.map(text);

  await page.goto('/');
  await openCatalog(page);
  await expect(fromNewGame).toHaveText(each(newGameWay));
  await expect(fromSave.filter({ visible: true })).toHaveCount(0); // no save
  // The details are folded away until opened; opened, the ways show.
  await expect(fromNewGame.first()).toBeHidden();
  await catalog.locator('.menu-more > summary').first().click();
  await expect(fromNewGame.first()).toBeVisible();

  // From the hub, past the cleanroom gate: no procedure on the way.
  await menuWith(page, 'simlab-hub');
  await openCatalog(page);
  await expect(fromNewGame).toHaveText(each(newGameWay));
  await expect(fromSave).toHaveText(
    each((id) => `From your saved game: SIMLAB Hub → ${labOf(id).en}`),
  );
  await backHome(page);
  await openSettings(page);
  await page.getByLabel('Tiếng Việt').check();
  await openCatalog(page, 'Danh mục thí nghiệm');
  await expect(fromSave).toHaveText(each((id) => `Từ bản lưu: Sảnh SIMLAB → ${labOf(id).vi}`));
  // In a narrow window the ways wrap instead of widening the menu.
  await page.setViewportSize({ width: 360, height: 640 });
  for (const summary of await catalog.locator('.menu-more > summary').all()) await summary.click();
  const fit = (all: Element[]) => all.every((e) => e.scrollWidth <= e.clientWidth);
  expect(await catalog.locator('.menu-route, .menu-saved-route').evaluateAll(fit)).toBe(true);
  expect(await page.locator('.menu').evaluateAll(fit)).toBe(true);
  await page.screenshot({ path: 'test-results/saved-route-vi-narrow.png' });
  await page.setViewportSize({ width: 1280, height: 720 });

  // Saved in the laboratory itself (the language chosen stays: Vietnamese).
  await menuWith(page, 'physics-lab');
  await openCatalog(page, 'Danh mục thí nghiệm');
  await expect(fromSave).toHaveText(
    each((id) =>
      labOf(id).en === 'Physics Laboratory'
        ? 'Từ bản lưu: bạn đang ở Phòng thí nghiệm Vật lý'
        : `Từ bản lưu: Phòng thí nghiệm Vật lý → Sảnh SIMLAB → ${labOf(id).vi}`,
    ),
  );
  await backHome(page, 'Quay lại màn hình chính');
  await openSettings(page);
  await page.getByLabel('English').check();
  await openCatalog(page);
  await expect(fromSave).toHaveText(
    each((id) =>
      labOf(id).en === 'Physics Laboratory'
        ? 'From your saved game: you are already in Physics Laboratory'
        : `From your saved game: Physics Laboratory → SIMLAB Hub → ${labOf(id).en}`,
    ),
  );

  // A save whose scene is gone: Continue is offered but would refuse it, so no way from it.
  await menuWith(page, 'old-lab');
  await openSolo(page);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  await closePlay(page);
  await openCatalog(page);
  await expect(fromNewGame).toHaveText(each(newGameWay));
  await expect(fromSave.filter({ visible: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Under each experiment's name, what it teaches (its description); opened, how to run it (its
// procedure) and, folded once more, the model's notes — from the content, in the language shown.
test('catalog: each experiment shows its learning objective, its steps and the model notes', async ({
  page,
}) => {
  const errors = watchErrors(page);
  // As the game picks a content text: the Vietnamese if there is one, else the English.
  const pick = (text: string | undefined, vi: string | undefined, vietnamese: boolean) =>
    (vietnamese ? vi : undefined) ?? text ?? '';
  const catalog = page.locator('.menu-catalog');
  const items = catalog.locator('.menu-catalog-item');
  const expectTexts = async (vietnamese: boolean) => {
    for (const [i, id] of listed.entries()) {
      const experiment = experiments.find((e) => e.id === id)!;
      const item = items.nth(i);
      const objective = item.locator('.menu-objective');
      await expect(objective).toHaveText(
        pick(experiment.description, experiment.vi?.description, vietnamese),
      );
      await expect(objective).toBeVisible(); // not folded away
      const [above, below] = [
        (await item.locator('.menu-experiment').boundingBox())!,
        (await objective.boundingBox())!,
      ];
      expect(below.y).toBeGreaterThanOrEqual(above.y + above.height - 1);
      await expect(item.locator('.menu-steps li')).toHaveText(
        experiment.procedure.map((s) => pick(s.instruction, s.vi?.instruction, vietnamese)),
      );
      await expect(item.locator('.menu-model p')).toHaveText(
        pick(experiment.note, experiment.vi?.note, vietnamese),
      );
    }
  };

  await page.goto('/');
  await openCatalog(page);
  // Folded: the steps until their row is opened, the notes until they are opened in it.
  const first = items.first();
  await expect(first.locator('.menu-steps')).toBeHidden();
  await first.locator('.menu-more > summary').click();
  await expect(first.locator('.menu-steps')).toBeVisible();
  await expect(first.locator('.menu-model p')).toBeHidden();
  await first.locator('.menu-model > summary').click();
  await expect(first.locator('.menu-model p')).toBeVisible();
  await expectTexts(false);
  await backHome(page);
  await openSettings(page);
  await page.getByLabel('Tiếng Việt').check();
  await openCatalog(page, 'Danh mục thí nghiệm');
  await expectTexts(true);

  await page.setViewportSize({ width: 360, height: 640 });
  await expectTexts(true);
  const fit = (all: Element[]) => all.every((e) => e.scrollWidth <= e.clientWidth);
  expect(await page.locator('.menu, .menu-catalog-item').evaluateAll(fit)).toBe(true);
  await page.screenshot({ path: 'test-results/objectives-vi-narrow.png' });
  expect(errors).toEqual([]);
});

// An experiment the save Continue would load has run to its natural end at least once is marked
// as such (the game's own progression, `endReason` 'model'); every other one says it has not —
// only experiments of the content count, whatever else the save lists.
test('catalog: experiments the save has run to the end are marked, the others not', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const run = listed[1]!; // an experiment of the content, run in the save below
  const catalog = page.locator('.menu-catalog');
  const marks = catalog.locator('.menu-catalog-item .menu-run');
  const expectMarks = async (done: string, notDone: string) => {
    await expect(marks).toHaveText(listed.map((id) => (id === run ? done : notDone)));
    expect(await marks.evaluateAll((els) => els.map((e) => e.getAttribute('data-done')))).toEqual(
      listed.map((id) => String(id === run)),
    );
  };

  await page.goto('/');
  await openCatalog(page);
  await expect(marks).toHaveText(listed.map(() => 'Not yet run to the end')); // no save
  await expect(catalog.locator('.menu-catalog-progress')).toHaveText(
    'No saved game yet: an experiment run to its end is marked here.',
  );

  // Listed twice, and beside an experiment the content no longer has.
  await menuWith(page, 'simlab-hub', [run, run, 'retired-experiment']);
  await openCatalog(page);
  await expectMarks('Run completed', 'Not yet run to the end');
  await expect(catalog.locator('.menu-catalog-progress')).toHaveText(
    `Your saved game: 1 of ${listed.length} experiments run to the end`,
  );
  await backHome(page);
  await openSettings(page);
  await page.getByLabel('Tiếng Việt').check();
  await openCatalog(page, 'Danh mục thí nghiệm');
  await expectMarks('Đã chạy hoàn tất', 'Chưa chạy đến khi tự kết thúc');

  await page.setViewportSize({ width: 360, height: 640 });
  await expectMarks('Đã chạy hoàn tất', 'Chưa chạy đến khi tự kết thúc');
  const fit = (all: Element[]) => all.every((e) => e.scrollWidth <= e.clientWidth);
  expect(await page.locator('.menu, .menu-catalog-item').evaluateAll(fit)).toBe(true);
  await page.screenshot({ path: 'test-results/run-marks-vi-narrow.png' });
  expect(errors).toEqual([]);
});
