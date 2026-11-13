import { isFraction, layoutFormula, type Item } from './formula';
import type { Language } from './i18n';

/**
 * A line with formulas as a teacher reads it aloud (Phú, 2026-11-10): `m_A` "m A", `·` "nhân",
 * a fraction "… trên …", `²` "bình phương", Greek letters by name, units by name after a number
 * (`0.4 m/s` "không phẩy bốn mét trên giây"). From the same layout as what is written
 * (`formula.ts`), so the voice says what the board and the box show. Pure.
 */
export function speakFormula(text: string, language: Language): string {
  const words = WORDS[language];
  const said = layoutFormula(text)
    .map((item) => spoken(item, words))
    .join('');
  return said
    .replace(/\s+/gu, ' ')
    .replace(/ ([;,.:!?)])/gu, '$1')
    .replace(/\( /gu, '(')
    .trim();
}

interface Words {
  readonly over: string;
  readonly power: string;
  readonly squared: string;
  readonly cubed: string;
  readonly prime: string;
  readonly root: string;
  readonly minus: string;
  readonly negative: string;
  readonly operators: Readonly<Record<string, string>>;
  readonly greek: Readonly<Record<string, string>>;
  readonly units: Readonly<Record<string, string>>;
  readonly per: string;
  readonly decimalComma: boolean;
}

const VI: Words = {
  over: 'trên',
  power: 'mũ',
  squared: 'bình phương',
  cubed: 'lập phương',
  prime: 'phẩy',
  root: 'căn',
  minus: 'trừ',
  negative: 'âm',
  operators: {
    '=': 'bằng',
    '≈': 'xấp xỉ',
    '+': 'cộng',
    '·': 'nhân',
    '×': 'nhân',
    '/': 'chia',
    ':': 'chia',
    '>': 'lớn hơn',
    '<': 'nhỏ hơn',
    '≥': 'lớn hơn hoặc bằng',
    '≤': 'nhỏ hơn hoặc bằng',
    '→': 'tạo thành',
    '⇌': 'thuận nghịch',
    '∝': 'tỉ lệ với',
    '±': 'cộng trừ',
  },
  greek: {
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
    ν: 'nuy',
    ξ: 'xi',
    π: 'pi',
    ρ: 'rô',
    σ: 'xích-ma',
    Σ: 'xích-ma',
    τ: 'tô',
    φ: 'phi',
    Φ: 'phi',
    χ: 'khi',
    ψ: 'pơ-xi',
    Ψ: 'pơ-xi',
    ω: 'ô-mê-ga',
    Ω: 'ô-mê-ga',
  },
  units: {
    m: 'mét',
    s: 'giây',
    kg: 'ki-lô-gam',
    g: 'gam',
    mg: 'mi-li-gam',
    mol: 'mol',
    mmol: 'mi-li-mol',
    L: 'lít',
    mL: 'mi-li-lít',
    J: 'jun',
    kJ: 'ki-lô-jun',
    N: 'niu-tơn',
    V: 'vôn',
    mV: 'mi-li-vôn',
    A: 'am-pe',
    mA: 'mi-li-am-pe',
    W: 'oát',
    kW: 'ki-lô-oát',
    Pa: 'pa-xcan',
    kPa: 'ki-lô-pa-xcan',
    K: 'ken-vin',
    h: 'giờ',
    min: 'phút',
    rad: 'ra-đi-an',
    cm: 'xen-ti-mét',
    mm: 'mi-li-mét',
    µm: 'mi-crô-mét',
    nm: 'na-nô-mét',
    km: 'ki-lô-mét',
    Hz: 'héc',
    C: 'cu-lông',
    Ω: 'ôm',
    T: 'tét-la',
    F: 'fa-ra',
    µF: 'mi-crô-fa-ra',
    Wb: 'vê-be',
    lx: 'lux',
    '°C': 'độ C',
    '°': 'độ',
    day: 'ngày',
    days: 'ngày',
    beats: 'nhịp',
    cells: 'tế bào',
    mmHg: 'mi-li-mét thủy ngân',
    µg: 'mi-crô-gam',
  },
  per: 'trên',
  decimalComma: true,
};

const EN: Words = {
  over: 'over',
  power: 'to the power',
  squared: 'squared',
  cubed: 'cubed',
  prime: 'prime',
  root: 'the square root of',
  minus: 'minus',
  negative: 'minus',
  operators: {
    '=': 'equals',
    '≈': 'is about',
    '+': 'plus',
    '·': 'times',
    '×': 'times',
    '/': 'divided by',
    ':': 'divided by',
    '>': 'is greater than',
    '<': 'is less than',
    '≥': 'is at least',
    '≤': 'is at most',
    '→': 'gives',
    '⇌': 'is in equilibrium with',
    '∝': 'is proportional to',
    '±': 'plus or minus',
  },
  greek: {
    α: 'alpha',
    β: 'beta',
    γ: 'gamma',
    δ: 'delta',
    Δ: 'delta',
    ε: 'epsilon',
    ζ: 'zeta',
    η: 'eta',
    θ: 'theta',
    λ: 'lambda',
    μ: 'mu',
    ν: 'nu',
    ξ: 'xi',
    π: 'pi',
    ρ: 'rho',
    σ: 'sigma',
    Σ: 'sigma',
    τ: 'tau',
    φ: 'phi',
    Φ: 'phi',
    χ: 'chi',
    ψ: 'psi',
    Ψ: 'psi',
    ω: 'omega',
    Ω: 'omega',
  },
  units: {
    m: 'metres',
    s: 'seconds',
    kg: 'kilograms',
    g: 'grams',
    mg: 'milligrams',
    mol: 'moles',
    mmol: 'millimoles',
    L: 'litres',
    mL: 'millilitres',
    J: 'joules',
    kJ: 'kilojoules',
    N: 'newtons',
    V: 'volts',
    mV: 'millivolts',
    A: 'amperes',
    mA: 'milliamperes',
    W: 'watts',
    kW: 'kilowatts',
    Pa: 'pascals',
    kPa: 'kilopascals',
    K: 'kelvin',
    h: 'hours',
    min: 'minutes',
    rad: 'radians',
    cm: 'centimetres',
    mm: 'millimetres',
    µm: 'micrometres',
    nm: 'nanometres',
    km: 'kilometres',
    Hz: 'hertz',
    C: 'coulombs',
    Ω: 'ohms',
    T: 'tesla',
    F: 'farads',
    µF: 'microfarads',
    Wb: 'webers',
    lx: 'lux',
    '°C': 'degrees Celsius',
    '°': 'degrees',
    day: 'day',
    days: 'days',
    beats: 'beats',
    cells: 'cells',
    mmHg: 'millimetres of mercury',
    µg: 'micrograms',
  },
  per: 'per',
  decimalComma: false,
};

const WORDS: Readonly<Record<Language, Words>> = { vi: VI, en: EN };

const SUPER_DIGITS: Readonly<Record<string, string>> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '−',
  '⁺': '+',
};
const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

function spoken(item: Item, w: Words): string {
  if (isFraction(item)) {
    const num = item.num.map((i) => spoken(i, w)).join('');
    const den = item.den.map((i) => spoken(i, w)).join('');
    return ` ${num} ${w.over} ${den} `;
  }
  if (item.level === 'sub') return ` ${spell(item.text)} `;
  if (item.level === 'sup') return power(item.text, w);
  if (item.unit) return ` ${unitName(item.text, w)} `;
  return plain(item.text, w);
}

/** A subscript as letters: "AB" "A B" (an acronym is read letter by letter), "max" as a word. */
function spell(text: string): string {
  return /^[A-Z0-9]{2,3}$/u.test(text) ? text.split('').join(' ') : text;
}

/** An exponent: ² "squared", ³ "cubed", otherwise "to the power …". */
function power(text: string, w: Words): string {
  if (text === '2') return ` ${w.squared} `;
  if (text === '3') return ` ${w.cubed} `;
  return ` ${w.power} ${plain(text, w)} `;
}

/** A unit, maybe over another and with powers: "m/s²" "mét trên giây bình phương". */
function unitName(text: string, w: Words): string {
  return text
    .split('/')
    .map((part) =>
      part
        .replace(/^\(|\)$/gu, '')
        .split('·')
        .map((factor) => {
          const base = factor.replace(/[²³⁻¹⁰-⁹]+$/u, '');
          const exponent = factor.slice(base.length);
          return `${w.units[base] ?? base}${exponent ? superscript(exponent, w) : ''}`;
        })
        .join(' '),
    )
    .join(` ${w.per} `);
}

/** Unicode superscripts: ² "squared", ⁻¹ "to the power minus 1", an ion's charge Cu²⁺ "2 plus". */
function superscript(marks: string, w: Words): string {
  const digits = marks.replace(/./gu, (c) => SUPER_DIGITS[c] ?? c);
  // A charge ends with its sign (Na⁺, Cu²⁺, Cl⁻, PO₄³⁻); an exponent starts with it (s⁻¹).
  const charge = /^(\d*)([+−])$/u.exec(digits);
  if (charge) {
    const sign = charge[2] === '+' ? (w.operators['+'] ?? '+') : w.minus;
    return ` ${charge[1] ?? ''} ${sign} `;
  }
  return power(digits, w);
}

/** Plain text: operators, Greek letters, primes, sub- and superscript digits, decimals said. */
function plain(text: string, w: Words): string {
  let out = text;
  if (w.decimalComma) out = out.replace(/(\d)\.(\d)/gu, '$1,$2');
  // A minus with no term before it (at the start, after = or a bracket or an operator): negative
  // (x = −2); between two terms: minus (208 − 0.7).
  out = out.replace(/−/gu, (_m, at: number, whole: string) => {
    const before = whole.slice(0, at).trimEnd();
    return /(^|[(=+·×,;:[≈<>])$/u.test(before) ? ` ${w.negative} ` : ` ${w.minus} `;
  });
  // A chemical formula, element by element: CO₂ "C O 2", CH₃COOH "C H 3 C O O H".
  out = out.replace(/\b(?:[A-Z][a-z]?[₀-₉]*){2,}(?![a-z])/gu, (formula) =>
    /[₀-₉]|[A-Z].*[A-Z]/u.test(formula)
      ? ` ${(formula.match(/[A-Z][a-z]?|[₀-₉]+/gu) ?? []).join(' ')} `
      : formula,
  );
  // A colon between two terms (spaced): division; a label's colon ("Given:") is left.
  out = out.replace(/ : /gu, ` ${w.operators[':'] ?? ':'} `);
  for (const [symbol, word] of Object.entries(w.operators)) {
    if (symbol === ':' || symbol === '/') continue;
    out = out.split(symbol).join(` ${word} `);
  }
  // A slash left inline between terms (not a unit's: those are units already).
  out = out.replace(/(\S)\/(\S)/gu, `$1 ${w.operators['/'] ?? '/'} $2`);
  out = out.replace(/√/gu, ` ${w.root} `);
  // Degrees, written against the number (30°, 25°C).
  out = out
    .replace(/°C/gu, ` ${w.units['°C'] ?? '°C'} `)
    .replace(/°/gu, ` ${w.units['°'] ?? '°'} `);
  // A prime (v′, v_B'): ′ always, ' when no letter follows (a word's apostrophe: Newton's).
  out = out.replace(/′|'(?!\p{L})/gu, ` ${w.prime} `);
  out = out.replace(/[²³⁰¹⁴-⁹⁻⁺]+/gu, (marks) => superscript(marks, w));
  out = out.replace(/[₀-₉]/gu, (c) => ` ${SUB_DIGITS.indexOf(c)} `);
  out = out.replace(/[α-ωΑ-Ω]/gu, (c) => ` ${w.greek[c] ?? c} `);
  return out;
}
