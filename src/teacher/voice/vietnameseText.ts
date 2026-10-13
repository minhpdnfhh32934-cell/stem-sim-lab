/**
 * Turns an AI Teacher answer into words a Vietnamese voice can read naturally
 * (docs/TEACHSCRIPT.md §8, PROMPT_PHAN_2 B6.1): numbers with the decimal comma
 * ("9,81" → "chín phẩy tám mốt"), units ("m/s²" → "mét trên giây bình phương"), formulas
 * ("F = m·a" → "ép bằng mờ nhân a"), LaTeX, chemistry ("H₂O" → "hát hai ô"), Greek letters and
 * symbols. Then `splitForSpeech` cuts it into short phrases with pauses, so every voice
 * (Windows, Gemini, the on-device model) breathes where a teacher would.
 *
 * Pure functions, no I/O. Readings follow common Northern classroom usage
 * ("linh", "nghìn", "mốt", "tư", "lăm").
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const GROUPS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function digit(n: number): string {
  return DIGITS[n] ?? '';
}

/** 0–999; `full` reads "không trăm" / "linh" (a group after a higher one: 1 005 → "một nghìn không trăm linh năm"). */
function readTriple(n: number, full: boolean): string[] {
  const h = Math.floor(n / 100);
  const t = Math.floor(n / 10) % 10;
  const u = n % 10;
  const out: string[] = [];
  if (full || h > 0) out.push(digit(h), 'trăm');
  if (t === 0) {
    if (u > 0) {
      if (full || h > 0) out.push('linh');
      out.push(digit(u));
    }
  } else if (t === 1) {
    out.push('mười');
    if (u === 5) out.push('lăm');
    else if (u > 0) out.push(digit(u));
  } else {
    out.push(digit(t), 'mươi');
    if (u === 1) out.push('mốt');
    else if (u === 4) out.push('tư');
    else if (u === 5) out.push('lăm');
    else if (u > 0) out.push(digit(u));
  }
  return out;
}

/** Reads a string of digits: "2026" → "hai nghìn không trăm hai mươi sáu". */
export function readInteger(digits: string): string {
  const clean = digits.replace(/^0+(?=\d)/, '');
  if (!/^\d+$/.test(clean)) return digits;
  if (clean === '0') return 'không';
  // Longer than the named groups (or an ID-like string): digit by digit.
  if (clean.length > 18) return readDigits(clean);
  const groups: number[] = [];
  for (let end = clean.length; end > 0; end -= 3) {
    groups.unshift(Number(clean.slice(Math.max(0, end - 3), end)));
  }
  const words: string[] = [];
  let started = false;
  groups.forEach((g, i) => {
    const unit = GROUPS[groups.length - 1 - i] ?? '';
    if (g === 0) return;
    words.push(...readTriple(g, started));
    if (unit) words.push(unit);
    started = true;
  });
  return words.join(' ');
}

export function readDigits(digits: string): string {
  return Array.from(digits)
    .map((d) => digit(Number(d)))
    .join(' ');
}

/**
 * The part after the decimal comma, read the way teachers say it: "81" → "tám mốt",
 * "5" → "năm", "14" → "mười bốn", "05" → "không năm", longer parts digit by digit.
 */
function readFraction(part: string): string {
  if (part.length === 1) return digit(Number(part));
  if (part.length === 2 && !part.startsWith('0')) {
    const t = Number(part[0]);
    const u = Number(part[1]);
    if (t === 1) return readInteger(part);
    const unit = u === 0 ? 'mươi' : u === 1 ? 'mốt' : u === 4 ? 'tư' : u === 5 ? 'lăm' : digit(u);
    return `${digit(t)} ${unit}`;
  }
  return readDigits(part);
}

/**
 * Reads one number as written in a Vietnamese or English answer: "9,81", "1.250.000",
 * "3.14", "1,000,000", "-5".
 */
export function readNumber(raw: string): string {
  let s = raw.replace(/\s+/g, '');
  let sign = '';
  if (/^[-−]/.test(s)) {
    sign = 'âm ';
    s = s.slice(1);
  }
  let intPart = s;
  let frac = '';
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    // Vietnamese grouping: 1.250.000,5
    const [i = '', f = ''] = s.split(',');
    intPart = i.replace(/\./g, '');
    frac = f;
  } else if (/^\d{1,3}(,\d{3}){2,}(\.\d+)?$/.test(s)) {
    // English grouping with at least two groups: 1,000,000.5
    const [i = '', f = ''] = s.split('.');
    intPart = i.replace(/,/g, '');
    frac = f;
  } else if (/^\d+[.,]\d+$/.test(s)) {
    const [i = '', f = ''] = s.split(/[.,]/);
    intPart = i;
    frac = f;
  }
  const words = readInteger(intPart);
  return `${sign}${frac ? `${words} phẩy ${readFraction(frac)}` : words}`;
}

/**
 * A fraction of two whole numbers: "3/4" → "ba phần tư" (a quarter is "tư", as in "một phần
 * tư"; convention to confirm), "1/2" → "một phần hai".
 */
function fraction(num: string, den: string): string {
  return `${readInteger(num)} phần ${den === '4' ? 'tư' : readInteger(den)}`;
}

/** Names of Latin letters as Vietnamese science teachers read symbols ("F" → "ép"). */
const LETTERS: Record<string, string> = {
  a: 'a',
  b: 'bê',
  c: 'xê',
  d: 'đê',
  // The Vietnamese letter used as an index: W_đ (động năng), W_t (thế năng).
  đ: 'đê',
  e: 'e',
  f: 'ép',
  g: 'gờ',
  h: 'hát',
  i: 'i',
  j: 'gi',
  k: 'ca',
  l: 'lờ',
  m: 'mờ',
  n: 'nờ',
  o: 'o',
  p: 'pê',
  q: 'quy',
  r: 'rờ',
  s: 'ét',
  t: 'tê',
  u: 'u',
  v: 'vê',
  w: 'vê kép',
  x: 'ích',
  y: 'i',
  z: 'dét',
};

export function letterName(ch: string): string {
  if (ch === 'O') return 'ô';
  return LETTERS[ch.toLowerCase()] ?? ch;
}

/** Letter by letter: "Fe" → "ép e", "ac" → "a xê". */
function spell(letters: string): string {
  return Array.from(letters).map(letterName).join(' ');
}

const GREEK: Record<string, string> = {
  α: 'an-pha',
  β: 'bê-ta',
  γ: 'gam-ma',
  δ: 'đen-ta',
  Δ: 'đen-ta',
  ε: 'ép-xi-lon',
  ζ: 'dê-ta',
  η: 'ê-ta',
  θ: 'tê-ta',
  λ: 'lam-đa',
  μ: 'muy',
  µ: 'muy',
  ν: 'nuy',
  ξ: 'xi',
  π: 'pi',
  ρ: 'rô',
  σ: 'xích-ma',
  Σ: 'xích-ma',
  τ: 'tau',
  φ: 'phi',
  Φ: 'phi',
  χ: 'chi',
  ψ: 'psi',
  ω: 'ô-mê-ga',
  Ω: 'ô-mê-ga',
};

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function fromScript(s: string): string {
  return Array.from(s)
    .map((c) => {
      const i = SUB.indexOf(c);
      if (i >= 0) return String(i);
      const j = SUP.indexOf(c);
      if (j >= 0) return String(j);
      if (c === '⁺') return '+';
      if (c === '⁻') return '-';
      return c;
    })
    .join('');
}

// ---------------------------------------------------------------- units

const BASE_UNITS: Record<string, string> = {
  m: 'mét',
  cm: 'xen-ti-mét',
  mm: 'mi-li-mét',
  km: 'ki-lô-mét',
  dm: 'đề-xi-mét',
  nm: 'na-nô-mét',
  µm: 'mi-crô-mét',
  μm: 'mi-crô-mét',
  s: 'giây',
  ms: 'mi-li-giây',
  min: 'phút',
  h: 'giờ',
  kg: 'ki-lô-gam',
  g: 'gam',
  mg: 'mi-li-gam',
  N: 'niu-tơn',
  kN: 'ki-lô-niu-tơn',
  J: 'jun',
  kJ: 'ki-lô-jun',
  MJ: 'mê-ga-jun',
  cal: 'ca-lo',
  kcal: 'ki-lô-ca-lo',
  W: 'oát',
  kW: 'ki-lô-oát',
  MW: 'mê-ga-oát',
  kWh: 'ki-lô-oát giờ',
  eV: 'e-léc-tron vôn',
  Pa: 'pát-xcan',
  kPa: 'ki-lô-pát-xcan',
  atm: 'át-mốt-phe',
  mmHg: 'mi-li-mét thủy ngân',
  V: 'vôn',
  mV: 'mi-li-vôn',
  kV: 'ki-lô-vôn',
  A: 'am-pe',
  mA: 'mi-li-am-pe',
  Ω: 'ôm',
  kΩ: 'ki-lô-ôm',
  C: 'cu-lông',
  µC: 'mi-crô-cu-lông',
  μC: 'mi-crô-cu-lông',
  nC: 'na-nô-cu-lông',
  F: 'fa-ra',
  µF: 'mi-crô-fa-ra',
  μF: 'mi-crô-fa-ra',
  T: 'tes-la',
  Wb: 'vê-be',
  H: 'hen-ri',
  Hz: 'héc',
  kHz: 'ki-lô-héc',
  MHz: 'mê-ga-héc',
  K: 'ken-vin',
  '°C': 'độ xê',
  '°F': 'độ ép',
  '°': 'độ',
  rad: 'ra-đi-an',
  mol: 'mol',
  mmol: 'mi-li-mol',
  L: 'lít',
  mL: 'mi-li-lít',
  ml: 'mi-li-lít',
  // Molar concentration "0,1 M" (convention to confirm: "mol trên lít" or "mo-lan").
  M: 'mol trên lít',
  mM: 'mi-li-mol trên lít',
  '%': 'phần trăm',
};
// Longest first, so "kWh" wins over "kW" and "mmHg" over "mm".
const UNIT_KEYS = Object.keys(BASE_UNITS).sort((a, b) => b.length - a.length);
const LENGTHS = new Set(['m', 'cm', 'mm', 'km', 'dm', 'nm', 'µm', 'μm']);

/** "m/s²" → "mét trên giây bình phương", "J/(kg·K)" → "jun trên ki-lô-gam ken-vin"; null if not a unit. */
export function readUnit(raw: string): string | null {
  const s = fromScript(raw).replace(/\^\{?([+\-−]?\d)\}?/g, '^$1');
  const out: string[] = [];
  let i = 0;
  let units = 0;
  while (i < s.length) {
    const c = s[i] ?? '';
    if (c === '/') {
      out.push('trên');
      i++;
      continue;
    }
    if (c === '·' || c === '.' || c === '*' || c === '⋅') {
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      i++;
      continue;
    }
    const key = UNIT_KEYS.find((k) => s.startsWith(k, i));
    if (!key) return null;
    i += key.length;
    units++;
    let words = BASE_UNITS[key] ?? key;
    // Exponent right after the unit: ^2, ², 2 (written "m/s2"), ^-1.
    const exp = /^(?:\^)?([+\-−]?\d)/.exec(s.slice(i));
    if (exp && (s[i] === '^' || /[\d\-−+]/.test(s[i] ?? ''))) {
      const n = (exp[1] ?? '').replace('−', '-');
      i += exp[0].length;
      // A length squared or cubed is an area or a volume wherever it stands: "kg/m³" is
      // "ki-lô-gam trên mét khối", "N/m²" "niu-tơn trên mét vuông".
      if (n === '2') words += LENGTHS.has(key) ? ' vuông' : ' bình phương';
      else if (n === '3') words += LENGTHS.has(key) ? ' khối' : ' lập phương';
      else words += ` mũ ${n.startsWith('-') ? `trừ ${readInteger(n.slice(1))}` : readInteger(n)}`;
    }
    out.push(words);
  }
  return units > 0 ? out.join(' ') : null;
}

// ---------------------------------------------------------------- chemistry

const ELEMENTS = new Set(
  (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se ' +
    'Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb ' +
    'Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm ' +
    'Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'
  ).split(' '),
);

/** A formula as written in text: "H2O", "Fe(OH)₃", "NaCl" (coefficient and charge apart). */
const FORMULA_BODY = String.raw`(?:[A-Z][a-z]?(?:\d+|[₀-₉]+)?|\((?:[A-Z][a-z]?(?:\d+|[₀-₉]+)?)+\)(?:\d+|[₀-₉]+)?)+`;
const FORMULA_CHARGE = String.raw`\^?\{?\d*[+\-−]\}?|[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻]`;
const FORMULA = new RegExp(
  String.raw`(?<![\p{L}\d])(\d*)(${FORMULA_BODY})(${FORMULA_CHARGE})?(?![\p{L}\d])`,
  'gu',
);

/** A state symbol right after a formula: "H2O(l)", "NaCl (dd)", "CO₂(k)". */
const STATE_AFTER_FORMULA = new RegExp(
  String.raw`(?<![\p{L}\d])(\d*)(${FORMULA_BODY})(${FORMULA_CHARGE})?(\s?)\((aq|dd|s|r|l|g|k)\)`,
  'gu',
);
/** Elements written as molecules with a count: H₂, N₂, O₂, O₃, F₂, Cl₂, Br₂, I₂, P₄, S₈. */
const MOLECULES = new Set(['H', 'N', 'O', 'F', 'Cl', 'Br', 'I', 'P', 'S']);
const STATES: Record<string, string> = {
  aq: 'dung dịch',
  dd: 'dung dịch',
  s: 'rắn',
  r: 'rắn',
  l: 'lỏng',
  g: 'khí',
  k: 'khí',
};

function stateAfterFormula(
  all: string,
  coef: string,
  body: string,
  charge: string | undefined,
  space: string,
  state: string,
  offset: number,
  text: string,
): string {
  const symbols = body.match(/[A-Z][a-z]?/g) ?? [];
  if (!symbols.every((x) => ELEMENTS.has(x))) return all;
  // A lone one-letter symbol with "(s)", "(l)", "(g)" is usually a quantity with its unit: "V (l)",
  // "m(g)", "t (s)" (never "vê lỏng"). It is a state only inside an equation, next to "+" or an
  // arrow: "C(s) + O2(g)", "→ Fe(s)". Vietnamese "(r)", "(k)", "(dd)" are never units: "C(r)".
  const inEquation =
    /(?:[+→⟶⇌]|->)\s*$/u.test(text.slice(0, offset)) ||
    /^\s*(?:[+→⟶⇌]|->)/u.test(text.slice(offset + all.length));
  const lone =
    symbols.length === 1 &&
    body.length === 1 &&
    !charge &&
    (space !== '' || ['s', 'l', 'g'].includes(state)) &&
    !inEquation;
  // After a space only a solution ("NaCl (dd)"), a compound ("H2O (l)") or an element's molecule
  // ("O₂ (k)"): "V1 (l)", "V2 (l)" are volumes in litres.
  const molecule =
    symbols.length === 1 &&
    symbols.every((x) => MOLECULES.has(x)) &&
    Number(/\d+/.exec(fromScript(body))?.[0] ?? 0) >= 2;
  const spacedOk = !space || state === 'aq' || state === 'dd' || symbols.length >= 2 || molecule;
  if (lone || !spacedOk) return all;
  return `${coef}${body}${charge ?? ''} ${STATES[state] ?? state} `;
}

/** Stands for "nồng độ" until the end, so neither LaTeX nor the letter rules touch the words. */
const CONCENTRATION = String.fromCharCode(0xe000);
/** "[S]", "[H+]", "$[OH^-]$", "\left[ H_2O \right]": a bracket around one token (no list, no space). */
const BRACKETED =
  /(?:\\left\s*)?(?<!\\)\[\s*((?:\\[a-zA-Z]+\s*\{[^{}]*\}|[^[\]\s,;\\])+)\s*(?:\\right\s*)?\]/g;
/** The words before the bracket already say it: "nồng độ [H+]", "nồng độ cơ chất [S]". */
const SAID_CONCENTRATION = /nồng độ(?:\s+\p{L}+){0,2}[\s$(]*$/iu;

/** One chemical species, the only thing whose bracket means a concentration. */
function isSpecies(raw: string): boolean {
  const plain = fromScript(
    raw.replace(/\\[a-zA-Z]+\s*\{([^{}]*)\}/g, '$1').replace(/[_^{}]/g, ''),
  ).replace('−', '-');
  const m = /^((?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*)+)(\d*[+-])?$/.exec(plain);
  if (!m) return false;
  const body = m[1] ?? '';
  const symbols = body.match(/[A-Z][a-z]?/g) ?? [];
  // Real elements ("[Na⁺]", "[H2O]"), or a generic species of one or two capitals ("[E]", "[ES]");
  // never a word or an abbreviation ("[Wikipedia]", "[SGK]").
  return symbols.every((x) => ELEMENTS.has(x)) || /^[A-Z]{1,2}$/.test(body);
}

function concentrations(text: string): string {
  return text.replace(BRACKETED, (all, inner: string, offset: number) => {
    if (!isSpecies(inner)) return all;
    // "[Ar] 3d⁶ 4s²" is a noble-gas core of an electron configuration, not a concentration.
    if (/^\s*[1-7][spdf]/.test(text.slice(offset + all.length))) return all;
    const said = SAID_CONCENTRATION.test(text.slice(Math.max(0, offset - 40), offset));
    return ` ${said ? '' : CONCENTRATION} ${inner} `;
  });
}

/** "H2SO4" → "hát hai ét ô bốn"; null when it is not a plausible formula. */
function readFormula(body: string, charged: boolean): string | null {
  const symbols = body.match(/[A-Z][a-z]?/g) ?? [];
  if (!symbols.every((s) => ELEMENTS.has(s))) return null;
  const hasCount = /[\d₀-₉]/.test(body);
  const twoLetter = symbols.some((s) => s.length === 2);
  // "CO2", "H2O" (a count) or "NaCl" (several symbols, one with two letters). A lone "Ta" or
  // "Ba" is the Vietnamese word; plain capitals ("AB") go to the acronym rule.
  if (!hasCount && !charged && !(twoLetter && symbols.length >= 2)) return null;
  const parts: string[] = [];
  for (const m of fromScript(body).matchAll(/([A-Z][a-z]?)|(\d+)|([()])/g)) {
    if (m[1]) parts.push(Array.from(m[1]).map(letterName).join(' '));
    else if (m[2]) parts.push(readInteger(m[2]));
  }
  return parts.join(' ');
}

function readCharge(raw: string): string {
  const c = fromScript(raw)
    .replace(/[\^{}]/g, '')
    .replace('−', '-');
  const n = c.slice(0, -1);
  const sign = c.endsWith('+') ? 'cộng' : 'trừ';
  return n ? `${readInteger(n)} ${sign}` : sign;
}

// ---------------------------------------------------------------- LaTeX

const LATEX_WORDS: Record<string, string> = {
  cdot: ' nhân ',
  times: ' nhân ',
  div: ' chia ',
  pm: ' cộng trừ ',
  mp: ' trừ cộng ',
  approx: ' xấp xỉ ',
  simeq: ' xấp xỉ ',
  sim: ' xấp xỉ ',
  neq: ' khác ',
  ne: ' khác ',
  in: ' thuộc ',
  notin: ' không thuộc ',
  leq: ' nhỏ hơn hoặc bằng ',
  le: ' nhỏ hơn hoặc bằng ',
  geq: ' lớn hơn hoặc bằng ',
  ge: ' lớn hơn hoặc bằng ',
  ll: ' rất nhỏ so với ',
  gg: ' rất lớn so với ',
  to: ' → ',
  rightarrow: ' → ',
  longrightarrow: ' → ',
  Rightarrow: ' suy ra ',
  implies: ' suy ra ',
  Leftrightarrow: ' tương đương ',
  iff: ' tương đương ',
  rightleftharpoons: ' ⇌ ',
  infty: ' vô cùng ',
  degree: '°',
  circ: '°',
  sin: ' sin ',
  cos: ' cốt ',
  tan: ' tang ',
  cot: ' cô-tang ',
  ln: ' lốc nê-pe ',
  log: ' lốc ',
  lim: ' giới hạn ',
  sum: ' tổng ',
  int: ' tích phân ',
  partial: ' đạo hàm riêng ',
  angle: ' góc ',
  perp: ' vuông góc ',
  parallel: ' song song ',
  propto: ' tỉ lệ với ',
  alpha: ' α ',
  beta: ' β ',
  gamma: ' γ ',
  delta: ' δ ',
  Delta: ' Δ ',
  epsilon: ' ε ',
  varepsilon: ' ε ',
  eta: ' η ',
  theta: ' θ ',
  lambda: ' λ ',
  mu: ' μ ',
  nu: ' ν ',
  xi: ' ξ ',
  pi: ' π ',
  rho: ' ρ ',
  sigma: ' σ ',
  Sigma: ' Σ ',
  tau: ' τ ',
  phi: ' φ ',
  varphi: ' φ ',
  Phi: ' Φ ',
  omega: ' ω ',
  Omega: ' Ω ',
};
const LATEX_TEXT = new Set([
  'text',
  'mathrm',
  'mathbf',
  'mathit',
  'operatorname',
  'boldsymbol',
  'textbf',
  'textit',
]);
const LATEX_DROP = new Set(['left', 'right', 'displaystyle', 'limits', 'quad', 'qquad']);
const SUBSCRIPT_WORDS: Record<string, string> = {
  max: 'cực đại',
  min: 'cực tiểu',
  tb: 'trung bình',
  ms: 'ma sát',
  ht: 'hướng tâm',
};

/** Reads one `{…}` group starting at `i` (which must be `{`); returns its content and the next index. */
function group(s: string, i: number): [string, number] {
  if (s[i] !== '{') {
    // A single token argument: \frac12, x^2.
    const m = /^\\[a-zA-Z]+|^./.exec(s.slice(i));
    const tok = m?.[0] ?? '';
    return [tok, i + tok.length];
  }
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') {
      depth--;
      if (depth === 0) return [s.slice(i + 1, j), j + 1];
    }
  }
  return [s.slice(i + 1), s.length];
}

/** LaTeX (inside $…$) → plain text with words; letters and numbers are finished by `toSpeech`. */
export function readLatex(src: string): string {
  let out = '';
  let i = 0;
  const s = src.replace(/\{,\}/g, ',').replace(/\\[,;:! ]/g, ' ');
  while (i < s.length) {
    const c = s[i] ?? '';
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      const name = m?.[1] ?? '';
      i += (m?.[0] ?? '\\').length;
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const [a, i1] = group(s, skipSpaces(s, i));
        const [b, i2] = group(s, skipSpaces(s, i1));
        i = i2;
        const num = readLatex(a).trim();
        const den = readLatex(b).trim();
        const plain = /^\d+$/.test(num) && /^\d+$/.test(den);
        out += plain ? ` ${fraction(num, den)} ` : ` ${num} trên ${den} `;
      } else if (name === 'log' && s[skipSpaces(s, i)] === '_') {
        // "\log_2 8" → "lốc cơ số hai của tám".
        const [base, i1] = group(s, skipSpaces(s, i) + 1);
        i = i1;
        out += ` lốc cơ số ${readLatex(base).trim()} của `;
      } else if (name === 'sqrt') {
        let degree = 'hai';
        if (s[i] === '[') {
          const end = s.indexOf(']', i);
          degree = readLatex(s.slice(i + 1, end)).trim();
          i = end + 1;
        }
        const [a, i1] = group(s, skipSpaces(s, i));
        i = i1;
        out += ` căn bậc ${degree} của ${readLatex(a)} `;
      } else if (name === 'vec' || name === 'overrightarrow' || name === 'overline') {
        const [a, i1] = group(s, skipSpaces(s, i));
        i = i1;
        out += ` ${name === 'overline' ? '' : 'véc-tơ '}${readLatex(a)} `;
      } else if (LATEX_TEXT.has(name)) {
        const [a, i1] = group(s, skipSpaces(s, i));
        i = i1;
        out += a;
      } else if (name === '%') {
        out += '%';
      } else if (LATEX_DROP.has(name)) {
        /* layout only */
      } else if (name in LATEX_WORDS) {
        out += LATEX_WORDS[name] ?? ' ';
      } else {
        out += ' ';
      }
    } else if (c === '_') {
      const [a, i1] = group(s, i + 1);
      i = i1;
      const inner = readLatex(a).trim();
      out += ` ${SUBSCRIPT_WORDS[inner] ?? inner} `;
    } else if (c === '^') {
      const [a, i1] = group(s, i + 1);
      i = i1;
      const inner = readLatex(a).trim().replace(/\s+/g, '');
      out += inner === '°' ? '°' : `^{${inner}}`;
    } else if (c === '{' || c === '}') {
      i++;
    } else if (/[a-zA-ZđĐ]/.test(c)) {
      // Product of single-letter symbols ("mv" = m·v); longer words (max, min) stay whole.
      const run = /^[a-zA-ZđĐ]+/.exec(s.slice(i))?.[0] ?? c;
      i += run.length;
      // Read as letter names here, so "2m" in a formula is "hai mờ", never "hai mét".
      out +=
        run.length <= 3 && !(run in SUBSCRIPT_WORDS)
          ? ` ${Array.from(run).map(letterName).join(' ')} `
          : ` ${run} `;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function skipSpaces(s: string, i: number): number {
  let j = i;
  while (s[j] === ' ') j++;
  return j;
}

// ---------------------------------------------------------------- whole text

/** Whole words only; `\b` does not work next to Vietnamese letters, hence the lookarounds. */
function word(w: string): RegExp {
  return new RegExp(String.raw`(?<![\p{L}\d])${w}(?![\p{L}\d])`, 'gu');
}

const ABBREVIATIONS: [RegExp, string][] = [
  [word('SGK'), 'sách giáo khoa'],
  [word('THPT'), 'trung học phổ thông'],
  [word('THCS'), 'trung học cơ sở'],
  [word('ĐLBT'), 'định luật bảo toàn'],
  [word('đktc'), 'điều kiện tiêu chuẩn'],
  [word('VD|Vd'), 'ví dụ'],
  // "tr. 45" is a page, not a sentence end.
  [/(?<![\p{L}])[Tt]r\.[ \t]*(?=\d)/gu, 'trang '],
  // "v.v." keeps its full stop when a new sentence follows ("… v.v. Vậy …").
  [/(?<![\p{L}])v\.v\.?(?=[ \t]+\p{Lu}|[ \t]*$)/gmu, 'vân vân.'],
  [/(?<![\p{L}])v\.v\.?/gu, 'vân vân'],
  [word('pH'), 'pê hát'],
  [word('NST'), 'nhiễm sắc thể'],
  [word('mARN|mRNA'), 'mờ a rờ nờ'],
  [word('tARN|tRNA'), 'tê a rờ nờ'],
  [word('rARN|rRNA'), 'rờ a rờ nờ'],
  [word('ADP'), 'a đê pê'],
  [word('ADN'), 'a đê nờ'],
  [word('ARN|RNA'), 'a rờ nờ'],
  [word('DNA'), 'đê nờ a'],
  [word('ATP'), 'a tê pê'],
  // Scientists and units named after them, as Vietnamese textbooks write them.
  [word('Newton'), 'Niu-tơn'],
  [word('Joule'), 'Jun'],
  [word('Watt'), 'Oát'],
  [word('Pascal'), 'Pa-xcan'],
  [word('Coulomb'), 'Cu-lông'],
  [word('Ampère|Ampere'), 'Am-pe'],
  [word('Ohm'), 'Ôm'],
  [word('Kepler'), 'Kê-ple'],
  [word('Hooke'), 'Húc'],
  [word('Faraday'), 'Pha-ra-đây'],
  [word('Lenz'), 'Len-xơ'],
  [word('Archimedes|Acsimet'), 'Ác-si-mét'],
  [word('Avogadro'), 'A-vô-ga-đrô'],
  [word('Mendel'), 'Men-đen'],
  [word('Darwin'), 'Đác-uyn'],
  [word('Bernoulli'), 'Béc-nu-li'],
  [word('Galileo'), 'Ga-li-lê'],
  [word('Einstein'), 'Anh-xtanh'],
  [word('Kelvin'), 'Ken-vin'],
  [word('Planck'), 'Plăng'],
];

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10 };

/** "II" → 2 (only I, V, X; up to 39). */
function roman(r: string): number | null {
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const v = ROMAN[r[i] ?? ''] ?? 0;
    const next = ROMAN[r[i + 1] ?? ''] ?? 0;
    total += v < next ? -v : v;
  }
  return total > 0 ? total : null;
}

const SYMBOLS: [RegExp, string][] = [
  [/⇌|⇄/g, ' thuận nghịch '],
  [/⇒|⟹/g, ' suy ra '],
  [/⇔|⟺/g, ' tương đương '],
  [/≈|≃|∼/g, ' xấp xỉ '],
  [/≠/g, ' khác '],
  [/≤|⩽/g, ' nhỏ hơn hoặc bằng '],
  [/≥|⩾/g, ' lớn hơn hoặc bằng '],
  [/±/g, ' cộng trừ '],
  [/[×⋅·∙]/g, ' nhân '],
  [/÷/g, ' chia '],
  [/∛/g, ' căn bậc ba của '],
  [/√/g, ' căn bậc hai của '],
  [/∞/g, ' vô cùng '],
  [/∝/g, ' tỉ lệ với '],
  [/⊥/g, ' vuông góc '],
  [/∥/g, ' song song '],
  [/∆/g, ' đen-ta '],
  // Number sets are read by their letter: "x ∈ ℝ" → "ích thuộc rờ".
  [/ℝ/g, ' R '],
  [/ℕ/g, ' N '],
  [/ℤ/g, ' Z '],
  [/ℚ/g, ' Q '],
  [/\s=\s|(?<=[\p{L}\d)\s])=(?=[\p{L}\d(\s-])/gu, ' bằng '],
  [/\s<\s/g, ' nhỏ hơn '],
  [/\s>\s/g, ' lớn hơn '],
  [/\s\+\s|(?<=[\p{L}\d)])\+(?=[\p{L}\d(])/gu, ' cộng '],
  [/\s[-−–]\s/g, ' trừ '],
  // Also when an earlier rule left spaces: "1/cos²x" → "một / cốt …".
  [/(?<=[\p{L}\d)][ \t]*)\/(?=[ \t]*[\p{L}\d(])/gu, ' trên '],
];

// Grouping by a space ("1 000 kg", the Vietnamese standard), a dot or a comma; then decimals.
const NUMBER = String.raw`\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?!\d)(?:,\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d{1,3}(?:,\d{3}){2,}(?:\.\d+)?|\d+[.,]\d+|\d+`;
const UNIT_CANDIDATE = String.raw`(?:°[CF]?|%|[A-Za-zµμΩ][A-Za-zµμΩ²³⁻¹·⋅./()^{}\d−-]*)`;
const QUANTITY = new RegExp(
  String.raw`(?<![\p{L}\d.,^{])([-−](?=\d))?(${NUMBER})` +
    String.raw`(?:\s*[×x·*]\s*10(?:\^\{?([+\-−]?\d+)\}?|([⁺⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+))|[eE]([+-]?\d+))?` +
    String.raw`(?:(\s{0,2})(${UNIT_CANDIDATE})(?!\p{L}))?`,
  'gu',
);

const POWER = new RegExp(
  String.raw`\^\{?([+\-−]?[\p{L}\d]+)\}?|([⁺⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)` +
    String.raw`(?:(\s{0,2})(${UNIT_CANDIDATE})(?!\p{L}))?`,
  'gu',
);

function exponentWords(raw: string): string {
  const n = fromScript(raw).replace('−', '-').replace('+', '');
  return n.startsWith('-') ? `trừ ${readInteger(n.slice(1))}` : readInteger(n);
}

/** The unit's words and what follows it; null when the letters are not a unit. */
function unitAfter(unit: string | undefined): [string, string] | null {
  if (!unit) return ['', ''];
  // Trailing punctuation belongs to the sentence, not to the unit; a closing bracket only
  // when it has no partner inside the unit ("J/(kg·K)" keeps it).
  let trimmed = unit.replace(/[./·-]+$/, '');
  while (trimmed.endsWith(')') && count(trimmed, '(') < count(trimmed, ')')) {
    trimmed = trimmed.slice(0, -1).replace(/[./·-]+$/, '');
  }
  const read = readUnit(trimmed);
  return read ? [` ${read}`, unit.slice(trimmed.length)] : null;
}

function count(s: string, ch: string): number {
  return s.split(ch).length - 1;
}

function quantity(
  _all: string,
  minus: string | undefined,
  num: string,
  exp1: string | undefined,
  exp2: string | undefined,
  exp3: string | undefined,
  space: string | undefined,
  unit: string | undefined,
): string {
  let words = readNumber(`${minus ? '-' : ''}${num}`);
  const exp = exp1 ?? exp2 ?? exp3;
  if (exp) words += ` nhân mười mũ ${exponentWords(exp)}`;
  const after = unitAfter(unit);
  // Letters glued to a coefficient are a product of symbols: "4ac" → "bốn a xê".
  const product = !after && !space ? /^([A-Za-z]{2,3})([^\p{L}\d]*)$/u.exec(unit ?? '') : null;
  if (product) return ` ${words} ${spell(product[1] ?? '')}${product[2] ?? ''}`;
  // Not a unit: give the letters back untouched ("3 con" stays "ba con"), always after a space
  // so a coefficient is not glued to its letter ("2n" → "hai nờ", not "hain"; audit VOI-02).
  if (!after) return ` ${words}${unit ? space || ' ' : (space ?? '')}${unit ?? ''}`;
  return ` ${words}${after[0]}${after[1]} `;
}

/** Markdown → plain text; keeps $…$ math for `readLatex`. */
function stripMarkdown(content: string): string {
  return (
    content
      .replace(/```[\s\S]*?```/g, '\n(đoạn mã trong tin nhắn)\n')
      .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+(.*)$/gm, (_m, h: string) => `${h.replace(/[.:!?]+$/, '')}.`)
      .replace(/^\s*[-*+]\s+/gm, '')
      // Numbered steps keep their number: "1. Tính a" → "1, Tính a" ("một, …").
      .replace(/^\s*(\d+)[.)]\s+/gm, '$1, ')
      // Answer options on one line ("A. 10 m/s B. 20 m/s", also after "Câu hỏi:") go on lines
      // of their own (never "Phương án A. sai, phương án B. đúng")…
      .replace(/^(?:[^\n]*:[ \t]*)?A[.)]\s.*\sB[.)]\s.*$/gm, (line) =>
        line.replace(/:[ \t]*(?=A[.)]\s)/, ':\n').replace(/\s+(?=[B-F][.)]\s)/g, '\n'),
      )
      // …and an option letter is read with a comma, never as a sentence end ("A, 10 m/s").
      .replace(/^\s*([A-F])[.)]\s+/gm, '$1, ')
      // A step number after a colon or a sentence end: "Có hai bước: 1. Tính a. 2. Tính F."
      .replace(/([:.!?])([ \t]+)(\d{1,2})\.[ \t]+(?=\p{L})/gu, '$1$2$3, ')
      .replace(/^\s*>\s?/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(?<![\w*])\*([^*\n]+)\*(?!\w)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/(?:^[ \t]*\|.*\|[ \t]*(?:\n|$))+/gm, readTable)
  );
}

/** A markdown table → one sentence per row; cells under "Đơn vị" are read as units. */
function readTable(block: string): string {
  const rows = block
    .split('\n')
    .filter((r) => r.trim() && !/^\s*\|[\s:|-]+\|\s*$/.test(r))
    .map((r) =>
      r
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim()),
    );
  const header = rows[0] ?? [];
  const unitColumns = new Set(header.flatMap((h, i) => (/đơn vị|unit/i.test(h) ? [i] : [])));
  const lines = rows.map((cells, r) =>
    cells.map((c, i) => (r > 0 && unitColumns.has(i) ? (readUnit(c) ?? c) : c)).join(', '),
  );
  return `${lines.map((l) => `${l}.`).join('\n')}\n`;
}

const TEX_ARROW = /\\(?:long)?rightarrow|\\to(?![a-zA-Z])|→/;
const TEX_ARROWS = new RegExp(TEX_ARROW.source, 'g');

/** Element symbols of one LaTeX term ("2H_2O" → H, O); null when it is not a chemical species. */
function texSpecies(term: string): string[] | null {
  const count = String.raw`(?:_\{?\d+\}?)?`;
  const m = new RegExp(
    String.raw`^\d*((?:[A-Z][a-z]?${count}|\((?:[A-Z][a-z]?${count})+\)${count})+)$`,
  ).exec(term);
  const body = m?.[1] ?? '';
  const symbols = body.match(/[A-Z][a-z]?/g) ?? [];
  // A subscript 0 or 1 is an index (T_1, v_0), never a number of atoms.
  if (!m || /_\{?[01]\}?(?!\d)/.test(body) || !symbols.every((x) => ELEMENTS.has(x))) return null;
  return symbols;
}

/**
 * A chemical equation around the arrow: two species joined by "+" ("H_2 + O_2") or a compound
 * ("H_2O"). "T_1 \\to T_2" or "E_3 \\rightarrow E_2" is not one.
 */
function chemicalTex(tex: string): boolean {
  if (!TEX_ARROW.test(tex)) return false;
  const plain = tex
    .replace(/\\(?:mathrm|text|ce)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\^\{?\d*[+\-−]\}?/g, '')
    .replace(/\((?:aq|dd|s|r|l|g|k)\)/g, '')
    .replace(/\s+/g, '');
  return plain.split(TEX_ARROWS).some((side) => {
    const terms = side.split('+').map(texSpecies);
    return (terms.length >= 2 && terms.every(Boolean)) || terms.some((t) => (t?.length ?? 0) >= 2);
  });
}

/** A chemical equation written in LaTeX ("2H_2 + O_2 \\rightarrow 2H_2O"): its arrow reads "tạo thành". */
function latexSpeech(tex: string): string {
  const read = readLatex(tex);
  return chemicalTex(tex) ? read.replace(/\s*→\s*/g, ' tạo thành ') : read;
}

/** Words that put a text in chemistry, where "Fe", "Cu", "Na" are element symbols. */
const CHEM_WORDS =
  /(?<![\p{L}])(?:kim loại|phi kim|nguyên tố|nguyên tử|electron|phản ứng|dung dịch|ion|oxi ho[áa]|kết tủa|cấu hình|ho[áa] trị|muối|axit|bazơ)(?![\p{L}])/iu;
/** The cell's energy carriers: an arrow between them is a reaction ("ATP → ADP + Pi"). */
const BIO_SPECIES = /(?<![\p{L}])(?:ATP|ADP|AMP|NADP?H?|FADH?2?)(?![\p{L}\d])/u;
/**
 * Element symbols that are also Vietnamese words opening a sentence ("Ba vật…", "Ta có…"):
 * there they stay words; elsewhere in a chemistry text they are spelled ("Cho Ba vào nước").
 */
const WORD_SYMBOLS = new Set('Ba Ta Co Ra La Ga Be Li Mo Ti Te Lu Ho No Bi Xe In Si'.split(' '));

/** One orbital of an electron configuration: "1s²", "2p^6", "3d10". */
const ORBITAL = String.raw`[1-7][spdf](?:\^\{?\d{1,2}\}?|[⁰¹²³⁴⁵⁶⁷⁸⁹]{1,2}|\d{1,2})?`;
const CONFIGURATION = new RegExp(
  String.raw`(?<![\p{L}\d])(?:\[(He|Ne|Ar|Kr|Xe|Rn)\][ \t]*)?(${ORBITAL}(?:[ \t.]*${ORBITAL})*)(?![\p{L}\d])`,
  'gu',
);

/** "1s² 2s² 2p⁶" → "một ét hai, hai ét hai, hai pê sáu"; null when it is not a configuration. */
function readConfiguration(
  core: string | undefined,
  seq: string,
  chemistry: boolean,
): string | null {
  const orbitals = [
    ...seq.matchAll(/([1-7])([spdf])(?:\^\{?(\d{1,2})\}?|([⁰¹²³⁴⁵⁶⁷⁸⁹]{1,2})|(\d{1,2}))?/gu),
  ].map((m) => ({ n: m[1] ?? '', l: m[2] ?? '', e: m[3] ?? m[4] ?? m[5] ?? '' }));
  const first = orbitals[0];
  // A lone "2s" is two seconds; "3s¹", "2p⁶" or a sequence is a configuration.
  const sure =
    Boolean(core) ||
    orbitals.length >= 2 ||
    (first !== undefined && first.e !== '' && (first.l !== 's' || chemistry));
  if (!sure) return null;
  const parts = orbitals.map(
    (o) => `${readInteger(o.n)} ${letterName(o.l)}${o.e ? ` ${readInteger(fromScript(o.e))}` : ''}`,
  );
  return (core ? [spell(core), ...parts] : parts).join(', ');
}

/**
 * "AaBb", "aa", "Bb": pairs of the same letter (alleles of one gene). No Vietnamese word is
 * made of doubled letters.
 */
function isGenotype(w: string): boolean {
  if (w.length % 2 !== 0 || w.length > 8) return false;
  for (let i = 0; i < w.length; i += 2) {
    if ((w[i] ?? '').toLowerCase() !== (w[i + 1] ?? '').toLowerCase()) return false;
  }
  return true;
}

/** Mathematical functions written in plain text (LaTeX has its own words in LATEX_WORDS). */
const FUNCTIONS: [RegExp, string][] = [
  [/(?<![\p{L}\\])(?:cotg|cot)(?![\p{L}])/gu, ' cô-tang '],
  [/(?<![\p{L}\\])cos(?![\p{L}])/gu, ' cốt '],
  [/(?<![\p{L}\\])tg(?![\p{L}])/gu, ' tang '],
  // "tan" is also a Vietnamese word ("muối tan trong nước"): a function only before its argument.
  [/(?<![\p{L}\\])tan(?=\s*(?:[\d(αβγδθφπ√²³]|[A-Za-z](?![\p{L}])))/gu, ' tang '],
  [/(?<![\p{L}\\])ln(?![\p{L}])/gu, ' lốc nê-pe '],
  [/(?<![\p{L}\\])log(?![\p{L}])/gu, ' lốc '],
];

/** "[0; 1]", "đoạn [a, b]", "∈ [a, b]": a closed interval, read "từ … đến …". */
const INTERVAL =
  /(?:(∈|∉|(?<![\p{L}])thuộc|(?<![\p{L}])đoạn)\s*)?\[\s*([^[\];,\n]+?)\s*([;,])\s*([^[\];,\n]+?)\s*\]/gu;
const INTERVAL_HEAD: Record<string, string> = {
  đoạn: 'đoạn ',
  '∉': 'không thuộc đoạn ',
  '∈': 'thuộc đoạn ',
  thuộc: 'thuộc đoạn ',
};

/** Whole answer → words for a Vietnamese voice. */
export function toSpeech(content: string): string {
  const chemContext = CHEM_WORDS.test(content);
  // Concentrations "[S]", "[H⁺]" → "nồng độ S" (audit VOI-02), in text and in LaTeX alike; an
  // interval "[a, b]" or a citation "[1]", "[Wikipedia]" is not a species and is left.
  let s = concentrations(stripMarkdown(content));
  // Math segments first: they use their own grammar.
  s = s
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, m: string) => `\n${latexSpeech(m)}.\n`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, m: string) => `\n${latexSpeech(m)}.\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, m: string) => ` ${latexSpeech(m)} `)
    .replace(/\$([^$\n]+)\$/g, (_m, m: string) => ` ${latexSpeech(m)} `)
    .replace(/\\([#$&%_{}])/g, '$1');
  for (const [re, words] of ABBREVIATIONS) s = s.replace(re, words);
  // Sets and intervals: "x ∈ [0; 1]" → "ích thuộc đoạn từ không đến một".
  s = s
    .replace(INTERVAL, (all, lead: string | undefined, a: string, sep: string, b: string) => {
      if (!lead && sep !== ';') return all;
      const head = lead ? (INTERVAL_HEAD[lead] ?? '') : '';
      return ` ${head}từ ${a} đến ${b} `;
    })
    .replace(/∉/g, ' không thuộc ')
    .replace(/∈/g, ' thuộc ');
  // Functions: "log₂8" → "lốc cơ số hai của tám", "cos 60°" → "cốt …", "Vmax" → "vê cực đại".
  s = s.replace(
    /(?<![\p{L}\\])log(?:_\{?([^{}\s]+?)\}?|([₀-₉]+))\s*/gu,
    (_m, a: string | undefined, b: string | undefined) =>
      ` lốc cơ số ${fromScript(a ?? b ?? '')} của `,
  );
  for (const [re, words] of FUNCTIONS) s = s.replace(re, words);
  s = s.replace(
    /(?<![\p{L}\d])([A-Za-z])(max|min)(?![\p{L}\d])/gu,
    (_m, l: string, w: string) => ` ${letterName(l)} ${SUBSCRIPT_WORDS[w] ?? w} `,
  );
  // Genetics: a cross "AaBb × AaBb" → "a a bê bê lai với a a bê bê"; a ratio "9 : 3 : 3 : 1"
  // → "chín ba ba một" (a time "10:30" is not one).
  s = s
    .replace(
      /(?<![\p{L}\d])([A-Za-z]{2,8})\s*[×xX]\s*([A-Za-z]{2,8})(?![\p{L}\d])/gu,
      (all, a: string, b: string) =>
        isGenotype(a) && isGenotype(b) ? ` ${spell(a)} lai với ${spell(b)} ` : all,
    )
    // Never a state symbol "NaCl (dd)" or a unit "2 mM". All capitals ("AA") are read alike by
    // the acronym rule.
    .replace(
      /(?<![\p{L}\d(])([A-Za-z]{2,8})(?![\p{L}\d])/gu,
      (all, w: string, offset: number, text: string) => {
        const unit = /\d\s*$/.test(text.slice(0, offset)) && readUnit(w) !== null;
        return !unit && /[a-z]/.test(w) && isGenotype(w) ? ` ${spell(w)} ` : all;
      },
    )
    .replace(/(?<![\d:.,])(\d+)((?:\s*:\s*\d+)+)(?!\d|[.,]\d)/g, (all, a: string, rest: string) => {
      const parts = [a, ...rest.split(':').slice(1)].map((p) => p.trim());
      const ratio = parts.length >= 3 || /\s:\s/.test(all) || /^\d+:\d$/.test(all);
      return ratio ? ` ${parts.map((p) => readInteger(p)).join(' ')} ` : all;
    });
  // Dates and plain fractions before numbers lose their slashes.
  s = s
    .replace(
      /(?:ngày\s+)?\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
      (_m, d: string, m: string, y: string) =>
        ` ngày ${readInteger(d)} tháng ${readInteger(m)} năm ${readInteger(y)} `,
    )
    .replace(
      /(?<![\p{L}\d./])(\d+)\/(\d+)(?![\p{L}\d/])/gu,
      (_m, a: string, b: string) => ` ${fraction(a, b)} `,
    );
  // Class names "lớp 10A1" → "lớp mười a một"; groups "nhóm IA, VIIA" → "nhóm một a, bảy a".
  s = s
    .replace(
      /((?<![\p{L}])[Ll]ớp\s+)(\d{1,2})([A-Z])(\d{1,2})?(?![\p{L}\d])/gu,
      (_m, w: string, n: string, l: string, k: string | undefined) =>
        `${w}${readInteger(n)} ${letterName(l)}${k ? ` ${readInteger(k)}` : ''} `,
    )
    .replace(
      /((?<![\p{L}])[Nn]hóm(?:\s+chính)?\s+)([IVX]{1,4}[AB](?:(?:\s*,\s*|\s+(?:và|hoặc|đến)\s+)[IVX]{1,4}[AB])*)(?![\p{L}\d])/gu,
      (_m, w: string, list: string) =>
        `${w}${list.replace(/([IVX]{1,4})([AB])/g, (g, r: string, x: string) => {
          const n = roman(r);
          return n ? `${readInteger(String(n))} ${letterName(x)}` : g;
        })}`,
    );
  // Electron configurations: "1s² 2s² 2p⁶" (before the numbers read "1 s" as one second).
  s = s.replace(CONFIGURATION, (all, core: string | undefined, seq: string) => {
    const read = readConfiguration(core, seq, chemContext);
    return read ? ` ${read} ` : all;
  });
  // State symbols after a formula: "NaCl (aq)" → "NaCl dung dịch", "H2O(l)" → "… lỏng"; a unit
  // after a symbol, a number or a word stays a unit ("t (s)", "5 (s)", "Thời gian (s)").
  s = s.replace(STATE_AFTER_FORMULA, stateAfterFormula);
  // Chemistry: "2H2O" → "hai hát hai ô"; a reaction arrow means "tạo thành".
  const found = { chemistry: false };
  s = s.replace(FORMULA, (all, coef: string, body: string, charge: string | undefined) => {
    const read = readFormula(body, Boolean(charge));
    if (!read) return all;
    found.chemistry = true;
    return ` ${coef ? `${readInteger(coef)} ` : ''}${read}${charge ? ` ${readCharge(charge)}` : ''} `;
  });
  const reaction = found.chemistry || BIO_SPECIES.test(content);
  s = s.replace(/→|⟶|->/g, reaction ? ' tạo thành ' : ' suy ra ');
  // A gas given off / a precipitate in a reaction; elsewhere the arrows mean up and down.
  const chemistry = found.chemistry || chemContext;
  s = s
    .replace(/↑/g, chemistry ? ' bay lên ' : ' tăng ')
    .replace(/↓/g, chemistry ? ' kết tủa ' : ' giảm ');
  // A lone element symbol in a chemistry text: "Kim loại Fe, Cu" → "ép e, xê u".
  if (chemistry) {
    s = s.replace(
      /(?<![\p{L}\d])([A-Z][a-z])(?![\p{L}\d])/gu,
      (all, sym: string, offset: number, text: string) => {
        if (!ELEMENTS.has(sym)) return all;
        const before = text.slice(0, offset);
        const inReaction =
          /(?:\+|tạo thành)\s*$/u.test(before) ||
          /^\s*(?:\+|tạo thành)/u.test(text.slice(offset + all.length));
        // "Ba vật…", "Ta có…": a word that opens a sentence and goes on with more words (a list
        // "kiềm: Li, Na, K" is symbols).
        const opensSentence =
          /(?:^|[.!?:]\s+|\n\s*)$/u.test(before) &&
          /^\s+\p{Ll}/u.test(text.slice(offset + all.length));
        if (opensSentence && WORD_SYMBOLS.has(sym) && !inReaction) return all;
        return ` ${spell(sym)} `;
      },
    );
  }
  // Indexed symbols: v0, t₁, F12.
  s = s.replace(
    /(?<![\p{L}\d])([A-Za-z])(\d{1,2}|[₀-₉]{1,2})(?![\p{L}\d.,])/gu,
    (_m, l: string, d: string) => ` ${letterName(l)} ${readInteger(fromScript(d))} `,
  );
  // Products of symbols right after an operator: "F = ma", "v0 + at", "A = Fs" → letter names;
  // before the numbers become words, so "= 3" ("= ba") is never spelled.
  s = s.replace(
    /(?<=(?:[=+×·*]|\s[-−])\s*)([A-Za-z]{2,3})(?=\s*(?:[=+\-−×·*/)<>.,;:!?…]|$))/gmu,
    (w: string) => ` ${spell(w)} `,
  );
  // "3.10⁸", "6,626.10⁻³⁴": the dot before a power of ten is a multiplication sign.
  s = s.replace(/(\d)\.(?=10(?:\^\{?[+\-−]?\d|[⁺⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]))/g, '$1·');
  // "220 . 2": a dot between spaces is never a decimal point either.
  s = s.replace(/(\d)[ \t]+\.[ \t]+(?=\d)/g, '$1 · ');
  // Numbers, with their unit and powers of ten.
  s = s.replace(QUANTITY, quantity);
  // A unit on its own: "đơn vị kg/m³", "km/h", "N/m²" (a part of two letters, a power, or the
  // word "đơn vị" before it); "F/m", "s/t" stay formulas.
  s = s.replace(
    /(?<![\p{L}\d/])([A-Za-zµμΩ]{1,4}[²³]?)\/([A-Za-zµμΩ]{1,4}[²³]?)(?![\p{L}\d/])/gu,
    (all, a: string, b: string, offset: number, text: string) => {
      const named = /đơn vị[\s:(]*$/iu.test(text.slice(Math.max(0, offset - 12), offset));
      const unitLike = named || [a, b].some((p) => /[A-Za-zµμΩ]{2}|[²³]/u.test(p));
      const read = unitLike ? readUnit(all) : null;
      return read ? ` ${read} ` : all;
    },
  );
  // A unit after a word: "1.200 cá thể/km²" → "… cá thể trên ki-lô-mét vuông" (never "l/g").
  s = s.replace(
    /(?<![\p{L}\d])(\p{L}+)\/([A-Za-zµμΩ°][A-Za-zµμΩ²³⁻¹^\d]*)(?![\p{L}\d])/gu,
    (all, w: string, u: string) => {
      const read = w.length >= 3 || /[^a-zA-Z]/.test(w) ? readUnit(u) : null;
      return read ? `${w} trên ${read} ` : all;
    },
  );
  // Powers left over: x², 10^{-3} (numbers are words by now), with a unit after them.
  s = s
    .replace(
      POWER,
      (_m, a: string | undefined, b: string | undefined, space?: string, unit?: string) => {
        const e = fromScript((a ?? b ?? '').replace('−', '-'));
        const words =
          e === '2'
            ? 'bình phương'
            : e === '3'
              ? 'lập phương'
              : /^-?\d+$/.test(e)
                ? `mũ ${exponentWords(e)}`
                : `mũ ${e}`;
        const after = unitAfter(unit);
        // A symbol after the power is a word of its own: "sin²x" → "sin bình phương ích".
        if (!after) return ` ${words}${unit ? space || ' ' : (space ?? '')}${unit ?? ''}`;
        return ` ${words}${after[0]}${after[1]} `;
      },
    )
    // A unit in brackets after a symbol: "v (m/s)".
    .replace(/\(([^()\s]{2,12})\)/g, (all, u: string) => {
      const read = /[/²³^]/.test(u) || u.length > 1 ? readUnit(u) : null;
      return read ? ` (${read}) ` : all;
    })
    .replace(/[₀-₉]+/g, (d) => ` ${readInteger(fromScript(d))} `);
  for (const [re, words] of SYMBOLS) s = s.replace(re, words);
  s = s.replace(/[αβγδΔεζηθλμµνξπρσΣτφΦχψωΩ]/g, (g) => ` ${GREEK[g] ?? g} `);
  s = s.replace(/°/g, ' độ ');
  // Roman numerals after the words that use them: "Định luật II" → "hai", "lần thứ IV" → "tư".
  s = s.replace(
    /((?<![\p{L}])(?:[Kk][ìỳ]\s+(?:đầu|giữa|sau|cuối)|[Gg]iảm phân|[Nn]guyên phân|[Ll]ần thứ|[Ll]uật|[Cc]hương|[Bb]ài|[Pp]hần|[Mm]ục|[Kk][ỷỳìỉ]|[Ll]oại|[Nn]hóm(?: chính)?|[Ll]ớp|[Gg]iai đoạn))\s+([IVX]{1,6})(?![\p{L}\d])/gu,
    (all, w: string, r: string) => {
      const n = roman(r);
      if (!n) return all;
      const ordinal = w.endsWith('thứ') && (n === 1 || n === 4);
      return `${w} ${ordinal ? (n === 1 ? 'nhất' : 'tư') : readInteger(String(n))}`;
    },
  );
  // After a bare "lần" a single I or V is usually a symbol ("Mỗi lần I tăng": current I): only
  // II, III, IV… or a numeral that ends the clause ("phân bào lần I.") is a number.
  s = s.replace(
    /((?<![\p{L}])[Ll]ần)\s+([IVX]{2,6}|[IVX](?=[ \t]*(?:[,.;:!?…)]|$)))(?![\p{L}\d])/gmu,
    (all, w: string, r: string) => {
      const n = roman(r);
      return n ? `${w} ${readInteger(String(n))}` : all;
    },
  );
  // Symbols written as single letters ("g", "F"), short capital acronyms ("AB", "AI") and
  // vowel-less runs that cannot be Vietnamese words ("mgh", "mc", "Km").
  s = s.replace(
    /(?<![\p{L}\d'-])([A-Za-z]|[A-Z]{2,4}|[B-DF-HJ-NP-TV-Zb-df-hj-np-tv-z]{2,4})(?![\p{L}\d'-])/gu,
    (_m, w: string) => ` ${spell(w)} `,
  );
  // Any digit still left (an odd format) is read digit by digit rather than skipped.
  s = s.replace(/\d+/g, (d) => ` ${readInteger(d)} `);
  return s
    .replaceAll(CONCENTRATION, ' nồng độ ')
    .replace(/[\\{}_^*#|~[\]$]/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/[ \t]+([,.;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface SpeechChunk {
  text: string;
  /** Silence after this chunk, milliseconds. */
  pauseMs: number;
}

/** Longest phrase given to a voice at once (long utterances stall some engines). */
const MAX_CHUNK = 220;

/**
 * Cuts spoken text into phrases with pauses a teacher would make: paragraph > sentence >
 * colon/semicolon > comma.
 */
export function splitForSpeech(spoken: string, maxChars = MAX_CHUNK): SpeechChunk[] {
  const chunks: SpeechChunk[] = [];
  const paragraphs = spoken.split(/\n+/).map((p) => p.trim());
  paragraphs.forEach((paragraph, pi) => {
    if (!paragraph) return;
    const sentences = paragraph.match(/[^.!?…;:]+(?:[.!?…;:]+|$)/g) ?? [paragraph];
    sentences.forEach((sentence, si) => {
      const text = sentence.trim();
      if (!text) return;
      const last = si === sentences.length - 1;
      const end = text.at(-1) ?? '';
      const pause = last
        ? pi === paragraphs.length - 1
          ? 0
          : 520
        : end === ':' || end === ';'
          ? 260
          : 320;
      for (const piece of splitLong(text, maxChars)) chunks.push({ text: piece, pauseMs: 140 });
      const lastChunk = chunks.at(-1);
      if (lastChunk) lastChunk.pauseMs = pause;
    });
  });
  return chunks;
}

function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let current = '';
  for (const part of text.split(/(?<=,)\s+/)) {
    if (current && current.length + part.length + 1 > max) {
      out.push(current);
      current = part;
    } else {
      current = current ? `${current} ${part}` : part;
    }
    while (current.length > max) {
      const cut = current.lastIndexOf(' ', max);
      const at = cut > max / 2 ? cut : max;
      out.push(current.slice(0, at).trim());
      current = current.slice(at).trim();
    }
  }
  if (current) out.push(current);
  return out;
}
