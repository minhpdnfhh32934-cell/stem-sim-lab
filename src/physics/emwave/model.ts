import { formatNumber } from '@/app/i18n';
import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';

const L = (vi: string, en: string): LocalizedText => ({ vi, en });

/**
 * Electromagnetic waves (SGK Vật lí 11 KNTT, Bài 11, tr. 44–47). In vacuum every EM wave travels
 * at the speed the textbook gives, c = 3.10⁸ m/s (tr. 44 and "Em đã học", tr. 47), so λ = c/f.
 * The SI value (exact by definition of the metre) is 299 792 458 m/s: the card quotes it.
 */
export const C_SGK = 3e8;
export const C_SI = 299_792_458;

export type BandId = 'radio' | 'microwave' | 'ir' | 'visible' | 'uv' | 'xray' | 'gamma';

export interface Band {
  id: BandId;
  name: LocalizedText;
  /** Shortest and longest wavelength in vacuum (m). */
  min: number;
  max: number;
  /** Where the textbook gives the range. */
  where: LocalizedText;
}

/**
 * Wavelength ranges in vacuum from the textbook (review_status pending, docs/DATA_REVIEW.md
 * VL11-EM-1): Bảng 11.1, tr. 47, for six bands, and tr. 47 (mục 6) for gamma rays. The book
 * says the bands have no sharp borders (tr. 45): radio contains microwaves, X and gamma overlap.
 */
export const EM_BANDS: readonly Band[] = [
  {
    id: 'radio',
    name: L('Sóng vô tuyến', 'Radio waves'),
    min: 1e-3,
    max: 1e5,
    where: L('Bảng 11.1, tr. 47', 'Table 11.1, p. 47'),
  },
  {
    id: 'microwave',
    name: L('Sóng vi ba', 'Microwaves'),
    min: 1e-3,
    max: 1,
    where: L('Bảng 11.1, tr. 47', 'Table 11.1, p. 47'),
  },
  {
    id: 'ir',
    name: L('Tia hồng ngoại', 'Infrared'),
    min: 7.6e-7,
    max: 1e-3,
    where: L('Bảng 11.1, tr. 47', 'Table 11.1, p. 47'),
  },
  {
    id: 'visible',
    name: L('Ánh sáng nhìn thấy', 'Visible light'),
    min: 3.8e-7,
    max: 7.6e-7,
    where: L('Bảng 11.1, tr. 47', 'Table 11.1, p. 47'),
  },
  {
    id: 'uv',
    name: L('Tia tử ngoại', 'Ultraviolet'),
    min: 1e-9,
    max: 3.8e-7,
    where: L('Bảng 11.1, tr. 47', 'Table 11.1, p. 47'),
  },
  {
    id: 'xray',
    name: L('Tia X', 'X-rays'),
    min: 3e-11,
    max: 3e-9,
    where: L('Bảng 11.1, tr. 47', 'Table 11.1, p. 47'),
  },
  {
    id: 'gamma',
    name: L('Tia gamma', 'Gamma rays'),
    min: 1e-14,
    max: 1e-10,
    where: L('mục 6, tr. 47', 'section 6, p. 47'),
  },
];

/** The whole scale the app shows: from the shortest gamma ray to the longest radio wave. */
export const SCALE = { min: 1e-14, max: 1e5 } as const;

/** Every band of the table that contains λ (borders included; several where bands overlap). */
export function bandsOf(lambda: number): Band[] {
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-12 * b;
  return EM_BANDS.filter(
    (b) => (lambda >= b.min || near(lambda, b.min)) && (lambda <= b.max || near(lambda, b.max)),
  );
}

/** f = c/λ with the textbook's c. */
export const frequencyOf = (lambda: number) => C_SGK / lambda;
/** λ = c/f with the textbook's c. */
export const wavelengthOf = (f: number) => C_SGK / f;
/** T = 1/f = λ/c. */
export const periodOf = (lambda: number) => lambda / C_SGK;

/** A band's frequency range (Hz): the activity of tr. 47 asks for it. */
export const frequencyRange = (b: Band) => ({ min: frequencyOf(b.max), max: frequencyOf(b.min) });

const SUP: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/**
 * A number as the textbook writes large and small ones: "5·10¹⁴", "3,8·10⁻⁷", "1·10⁵" (Vietnamese
 * decimal comma), "10⁻¹²" for a power of ten; plain between 0,01 and 10 000.
 */
export function sci(locale: Locale, v: number, sig = 3): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(v)) + 1e-12);
  if (exp >= -2 && exp <= 4) return formatNumber(locale, Number(v.toPrecision(sig)));
  let mant = Number((v / 10 ** exp).toPrecision(sig));
  let e = exp;
  if (Math.abs(mant) >= 10) {
    mant /= 10;
    e += 1;
  }
  const power = `10${String(e).replace(/[-\d]/g, (c) => SUP[c] ?? c)}`;
  return mant === 1 ? power : `${formatNumber(locale, mant)}·${power}`;
}

/** A length in the unit the textbook would use: "100 km", "3 cm", "760 nm", "1·10⁻⁵ nm". */
export function lengthText(locale: Locale, m: number): string {
  const units: [string, number][] = [
    ['km', 1e3],
    ['m', 1],
    ['cm', 1e-2],
    ['mm', 1e-3],
    ['µm', 1e-6],
    ['nm', 1e-9],
    ['pm', 1e-12],
  ];
  const [u, f] = units.find(([, v]) => m >= v * (1 - 1e-12)) ?? ['nm', 1e-9];
  // Below 1 µm the book writes nm (380 nm), except picometres for X-rays (30 pm).
  if (u === 'µm' && m < 1e-6 * (1 - 1e-12)) return `${sci(locale, m / 1e-9)} nm`;
  return `${sci(locale, m / f)} ${u}`;
}
