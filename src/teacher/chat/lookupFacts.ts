/**
 * Questions the app answers from its own tables and engines, next to the equation balancer in
 * tools.ts (CLAUDE.md: "numbers only from deterministic tools"). The same rule holds here: a wrong
 * fact is worse than none, so each reader needs the question's own words and a value its engine
 * accepts, and stays silent otherwise.
 */
import { formatNumber, translate, type Locale } from '@/app/i18n';
import {
  cleanDna,
  codingToMrna,
  codonEntry,
  complement,
  SequenceError,
  strandDirection,
  transcribeTemplate,
  translate as translateRna,
  type StrandDirection,
} from '@/biology/central/dogma';
import { cross, GenotypeError, ratio, type Locus } from '@/biology/genetics/mendel';
import { hardyWeinberg } from '@/biology/genetics/population';
import {
  configString,
  elementBySymbol,
  elementByZ,
  ELEMENTS,
  shellOrder,
  shorthand,
  superscript,
  type ElementData,
} from '@/chemistry/data/elements';
import { FormulaError, molarMass, parseFormula } from '@/chemistry/formula';
import { constant } from '@/core/constants';
import { convert, isKnownUnit, unitLabel, UnitError } from '@/core/units';

/** "của chất H2SO4", "of the element Fe": the words between a phrase and what it is about. */
const OF = String.raw`\s+(?:của|of)\s+(?:(?:chất|hợp chất|khí|phân tử|nguyên tử|nguyên tố|muối|axit|bazơ|kim loại|the|element|atom|compound)\s+)*`;

/** The word right after a phrase, and the text behind that word. */
function wordAfter(q: string, phrase: RegExp): { word: string; rest: string } | null {
  const m = phrase.exec(q);
  if (!m) return null;
  const after = q.slice(m.index + m[0].length);
  const w = /^[^\s,;:?!]+/u.exec(after)?.[0];
  return w ? { word: w.replace(/\.$/, ''), rest: after.slice(w.length) } : null;
}

/** Elements whose letter is also the usual name of a substance in a problem ("A và B", "X, Y"). */
const PLACEHOLDER = /^[BY]$/;

const MASS_PHRASE = new RegExp(
  String.raw`(?:khối lượng mol(?: phân tử| nguyên tử)?|phân tử khối|nguyên tử khối|khối lượng (?:phân tử|nguyên tử)|molar mass|molecular weight|atomic weight)${OF}`,
  'iu',
);
/** The problem prescribes its own rounded values: "Na = 23", "M = 58,5 g/mol". */
const GIVEN_MASSES = /\b[A-Z][a-z]?\s*=\s*\d|\d\s*g\/mol/;

function molar(q: string, locale: Locale): string | null {
  if (GIVEN_MASSES.test(q)) return null;
  const word = wordAfter(q, MASS_PHRASE)?.word;
  if (!word || PLACEHOLDER.test(word)) return null;
  try {
    // Elements without a standard atomic weight only have a mass number in the table.
    const elements = [...parseFormula(word).counts.keys()];
    if (elements.some((el) => elementBySymbol(el)?.mass_number_only !== false)) return null;
    const mass = formatNumber(locale, molarMass(word), { maximumFractionDigits: 3 });
    return translate(locale, 'toolFacts.molarMass', { formula: word, mass });
  } catch (e) {
    if (e instanceof FormulaError) return null;
    throw e;
  }
}

const CONFIG_PHRASE = new RegExp(
  String.raw`(?:cấu hình (?:electron|e)|electron configuration)`,
  'iu',
);
const CONFIG_OF = new RegExp(CONFIG_PHRASE.source + OF, 'iu');

function elementNamed(word: string): ElementData | undefined {
  if (PLACEHOLDER.test(word)) return undefined;
  const lower = word.toLowerCase();
  return (
    elementBySymbol(word) ??
    ELEMENTS.find((e) => e.aliases_vi.includes(lower) || e.name.toLowerCase() === lower)
  );
}

function configuration(q: string, locale: Locale): string | null {
  // The table holds neutral atoms only: an ion is never answered with its atom's configuration.
  if (!CONFIG_PHRASE.test(q) || /\b(?:cation|anion|ion)\b/i.test(q)) return null;
  const after = wordAfter(q, CONFIG_OF);
  const z = /\bZ\s*=\s*(\d{1,3})\b/.exec(q)?.[1];
  const e =
    (after && !/^\s*\d*[+\-−]/.test(after.rest) ? elementNamed(after.word) : undefined) ??
    (z ? elementByZ(Number(z)) : undefined);
  if (!e) return null;
  const full = configString(shellOrder(e.configuration));
  const short = shorthand(e);
  const params = { symbol: e.symbol, z: e.z, config: full, short };
  return translate(
    locale,
    short === full ? 'toolFacts.configuration' : 'toolFacts.configurationShort',
    params,
  );
}

/** How learners write the units the registry spells differently. */
const UNIT_WORDS: Record<string, string> = {
  giờ: 'h',
  phút: 'min',
  giây: 's',
  lít: 'L',
  tấn: 't',
  'km/giờ': 'km/h',
  'm/giây': 'm/s',
  '°C': 'degC',
  µm: 'um',
  µC: 'uC',
  µN: 'uN',
  Ω: 'ohm',
  'm²': 'm^2',
  'cm²': 'cm^2',
  'm³': 'm^3',
  'dm³': 'dm^3',
  'cm³': 'cm^3',
  'm/s²': 'm/s^2',
  'g/cm³': 'g/cm^3',
  'kg/m³': 'kg/m^3',
};
const UNIT = String.raw`[\p{L}°µΩ/^*²³\d]+`;
const CONVERSION = new RegExp(
  String.raw`(?<![\p{L}\p{N}.,])(\d+(?:[.,]\d+)?)\s*(${UNIT})\s+(?:(?:ra|sang|thành|to|in)\s+|(?:bằng|là) bao nhiêu\s+|=\s*\?+\s*)(${UNIT})`,
  'gu',
);
const CONVERT_WORDS = /đổi|chuyển|bao nhiêu|=\s*\?|convert|how many/i;

function registered(word: string): string | null {
  const unit = UNIT_WORDS[word] ?? word;
  return isKnownUnit(unit) ? unit : null;
}

function conversions(q: string, locale: Locale): string[] {
  if (!CONVERT_WORDS.test(q)) return [];
  const out: string[] = [];
  for (const m of q.matchAll(CONVERSION)) {
    const written = m[1] ?? '';
    const from = registered(m[2] ?? '');
    const to = registered(m[3] ?? '');
    // "1.000" or "1,000": a thousands mark or a decimal, depending on who wrote it.
    if (!from || !to || from === to || /^\d{1,3}[.,]\d{3}$/.test(written)) continue;
    const value = Number(written.replace(',', '.'));
    try {
      const result = convert(value, from, to);
      out.push(
        translate(locale, 'toolFacts.conversion', {
          value: formatNumber(locale, value),
          from: unitLabel(from, locale),
          result: formatNumber(locale, result, { maximumSignificantDigits: 6 }),
          to: unitLabel(to, locale),
        }),
      );
    } catch (e) {
      if (!(e instanceof UnitError)) throw e;
    }
  }
  return out;
}

const CODON =
  /(?:[Cc]odon|CODON|[Bb]ộ ba(?: mã sao| mã h[oó]á?)?|[Tt]riplet)\s+(?:5['′’]\s*[-–]?\s*)?([UCAG]{3})(?![\p{L}\p{N}])/gu;

function codons(q: string, locale: Locale): string[] {
  const out: string[] = [];
  for (const m of q.matchAll(CODON)) {
    const codon = m[1] ?? '';
    const entry = codonEntry(codon);
    if (!entry) continue;
    const params = { codon, three: entry.three, name: entry.name };
    const key = entry.stop
      ? 'toolFacts.codonStop'
      : entry.start
        ? 'toolFacts.codonStart'
        : 'toolFacts.codon';
    out.push(translate(locale, key, params));
  }
  return out;
}

const MARK = "[53]['′’‘`´]";
const SEQUENCE = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:${MARK}\s*[-–—]*\s*)?[ATGCUX](?:[ \-–—]?[ATGCUX]){5,}(?:\s*[-–—]*\s*${MARK})?(?![\p{L}\p{N}])`,
  'u',
);
/** A strand longer than this does not fit the on-device prompt. */
const MAX_BASES = 90;
const ASK_COMPLEMENT =
  /(?:viết|tìm|xác định|cho biết)[^.?!]{0,30}mạch bổ sung|(?:write|find|give)[^.?!]{0,30}complementary strand/i;
const MRNA = /mARN|mRNA/;
const STRAND_NAME =
  /.*(mạch (?:mã )?gốc|mạch khuôn|template|mạch bổ sung|mạch mã h[oó]á?|coding strand)/is;
const ASK_PROTEIN = /dịch mã|chuỗi (?:poli|poly)peptit|axit amin|translate|amino acid|polypeptide/i;

const FLIP: Record<StrandDirection, StrandDirection> = { '5to3': '3to5', '3to5': '5to3' };

/** A strand with its ends when they are known, as written otherwise. */
function withEnds(bases: string, dir: StrandDirection | null): string {
  if (!dir) return bases;
  return dir === '5to3' ? `5'-${bases}-3'` : `3'-${bases}-5'`;
}

function proteinFact(rna: string, dir: StrandDirection | null, locale: Locale): string | null {
  const read = dir === '3to5' ? Array.from(rna).reverse().join('') : rna;
  const t = translateRna(read);
  if (t.start < 0) return null;
  const chain = t.codons
    .filter((c) => c.entry && !c.entry.stop)
    .map((c) => c.entry?.three ?? '')
    .join('-');
  if (!chain) return null;
  const stop = t.codons[t.stopIndex]?.codon;
  return stop
    ? translate(locale, 'toolFacts.protein', { rna: withEnds(read, '5to3'), chain, stop })
    : translate(locale, 'toolFacts.proteinNoStop', { rna: withEnds(read, '5to3'), chain });
}

function strands(q: string, locale: Locale): string[] {
  const m = SEQUENCE.exec(q);
  if (!m) return [];
  const raw = m[0].replace(/[–—]/g, '-');
  let dir: StrandDirection | null;
  let bases: string;
  try {
    dir = strandDirection(raw);
    bases = cleanDna(raw);
  } catch (e) {
    if (e instanceof SequenceError) return [];
    throw e;
  }
  if (bases.length > MAX_BASES) return [];
  const strand = withEnds(bases, dir);
  const out: string[] = [];
  if (/U/.test(raw)) {
    const rna = codingToMrna(bases);
    const protein = ASK_PROTEIN.test(q) ? proteinFact(rna, dir, locale) : null;
    return protein ? [protein] : [];
  }
  if (ASK_COMPLEMENT.test(q)) {
    const result = withEnds(complement(bases), dir && FLIP[dir]);
    out.push(translate(locale, 'toolFacts.complement', { strand, result }));
  }
  const named = STRAND_NAME.exec(q.slice(0, m.index))?.[1];
  if (MRNA.test(q) && named) {
    const template = /gốc|khuôn|template/i.test(named);
    const rna = template ? transcribeTemplate(bases) : codingToMrna(bases);
    const rnaDir = template && dir ? FLIP[dir] : dir;
    out.push(translate(locale, 'toolFacts.mrna', { strand, result: withEnds(rna, rnaDir) }));
    const protein = ASK_PROTEIN.test(q) ? proteinFact(rna, rnaDir, locale) : null;
    if (protein) out.push(protein);
  }
  return out;
}

const CROSS = /(?<![\p{L}\p{N}])([A-Za-z]{2,6})\s*[×xX*]\s*([A-Za-z]{2,6})(?![\p{L}\p{N}])/u;
const CROSS_WORDS =
  /lai|kiểu gen|kiểu hình|giao tử|\bF[12]\b|cross|genotype|phenotype|offspring|punnett/i;
/** The engine assumes independent loci and one gene per trait. */
const NOT_MENDELIAN =
  /liên kết|hoán vị|tương tác|át chế|cộng gộp|giới tính|linked|linkage|epistasis/i;
const INCOMPLETE = /không hoàn toàn|đồng trội|incomplete dominance|codominan/i;

function joined(m: Map<string, number>): string {
  const n = ratio([...m.values()]);
  return [...m.keys()].map((k, i) => `${String(n[i] ?? 0)} ${k}`).join(' : ');
}

function mendel(q: string, locale: Locale): string | null {
  if (!CROSS_WORDS.test(q) || NOT_MENDELIAN.test(q)) return null;
  const m = CROSS.exec(q);
  const p1 = m?.[1] ?? '';
  const p2 = m?.[2] ?? '';
  if (!p1 || p1.length % 2 || p1.length > 6) return null;
  const incomplete = INCOMPLETE.test(q);
  const loci: Locus[] = [];
  for (let i = 0; i < p1.length; i += 2) {
    loci.push({
      letter: p1.charAt(i).toUpperCase(),
      dominance: incomplete ? 'incomplete' : 'complete',
    });
  }
  try {
    const c = cross(p1, p2, loci);
    const parts = { p1, p2 };
    const genotypes = c.genotypes.size <= 9 ? joined(c.genotypes) : null;
    const phenotypes = incomplete ? null : joined(c.phenotypes);
    if (genotypes && phenotypes)
      return translate(locale, 'toolFacts.crossBoth', { ...parts, genotypes, phenotypes });
    if (genotypes) return translate(locale, 'toolFacts.crossGenotypes', { ...parts, genotypes });
    return phenotypes
      ? translate(locale, 'toolFacts.crossPhenotypes', { ...parts, phenotypes })
      : null;
  } catch (e) {
    if (e instanceof GenotypeError) return null;
    throw e;
  }
}

const HARDY = /cân bằng di truyền|hardy|hacđi|hac-đi/i;
const FREQ = String.raw`\s*(?:=|là|bằng|:)\s*(0[.,]\d+)`;
const P_GIVEN = new RegExp(String.raw`(?<!\p{L})p(?:\(A\))?${FREQ}`, 'u');
const Q_GIVEN = new RegExp(String.raw`(?<!\p{L})q(?:\(a\))?${FREQ}`, 'u');
const ALLELE_GIVEN = new RegExp(String.raw`[Tt]ần số (?:của )?alen\s+([A-Za-z])${FREQ}`, 'u');
const fraction = (s: string | undefined) =>
  s === undefined ? undefined : Number(s.replace(',', '.'));

function hardy(q: string, locale: Locale): string | null {
  if (!HARDY.test(q)) return null;
  const allele = ALLELE_GIVEN.exec(q);
  const letter = allele?.[1] ?? '';
  const upper = letter !== '' && letter === letter.toUpperCase();
  const pGiven = fraction(P_GIVEN.exec(q)?.[1] ?? (upper ? allele?.[2] : undefined));
  const qGiven = fraction(Q_GIVEN.exec(q)?.[1] ?? (letter && !upper ? allele?.[2] : undefined));
  if (pGiven !== undefined && qGiven !== undefined && Math.abs(pGiven + qGiven - 1) > 1e-9) {
    return null;
  }
  const p = pGiven ?? (qGiven === undefined ? undefined : 1 - qGiven);
  if (p === undefined || p <= 0 || p >= 1) return null;
  const f = hardyWeinberg(p);
  const num = (x: number) => formatNumber(locale, x, { maximumFractionDigits: 4 });
  const A = (letter || 'A').toUpperCase();
  const a = A.toLowerCase();
  return translate(locale, 'toolFacts.hardyWeinberg', {
    p: num(p),
    q: num(1 - p),
    AA: `${A}${A}`,
    Aa: `${A}${a}`,
    aa: `${a}${a}`,
    fAA: num(f.AA),
    fAa: num(f.Aa),
    faa: num(f.aa),
  });
}

const CONSTANTS: readonly (readonly [RegExp, string])[] = [
  [/hằng số planck rút gọn|reduced planck/i, 'hbar'],
  [/hằng số planck|planck(?:'s)? constant/i, 'h'],
  [/số avogadro|avogadro(?:'s)? (?:constant|number)/i, 'NA'],
  [/hằng số boltzmann|boltzmann constant/i, 'kB'],
  [/hằng số khí|gas constant/i, 'R'],
  [/hằng số faraday|faraday constant/i, 'F'],
  [/hằng số hấp dẫn|gravitational constant/i, 'G'],
  [/hằng số coulomb|coulomb constant/i, 'kC'],
  [/tốc độ ánh sáng|vận tốc ánh sáng|speed of light/i, 'c'],
  [/điện tích nguyên tố|elementary charge/i, 'e'],
  [/khối lượng (?:của )?electron|electron mass/i, 'me'],
  [/khối lượng (?:của )?proton|proton mass/i, 'mp'],
  [/khối lượng (?:của )?(?:neutron|nơtron)|neutron mass/i, 'mn'],
];
const ASKS_VALUE = /bằng bao nhiêu|là bao nhiêu|giá trị|how much|value of/i;

function scientific(v: number, locale: Locale): string {
  const [mantissa = '', exponent = '0'] = v.toExponential().split('e');
  const power = Number(exponent);
  const digits = { maximumSignificantDigits: 12 };
  if (Math.abs(power) < 5) return formatNumber(locale, v, digits);
  const sign = power < 0 ? '⁻' : '';
  return `${formatNumber(locale, Number(mantissa), digits)} × 10${sign}${superscript(Math.abs(power))}`;
}

function physicalConstant(q: string, locale: Locale): string | null {
  if (!ASKS_VALUE.test(q)) return null;
  const id = CONSTANTS.find(([words]) => words.test(q))?.[1];
  if (!id) return null;
  const c = constant(id);
  return translate(locale, 'toolFacts.constant', {
    name: c.name[locale],
    symbol: c.symbol,
    value: scientific(c.value, locale),
    unit: c.unit.replace(/\*/g, '·'),
  });
}

/** What the app itself can say about this question, as sentences for the learner and the AI. */
export function lookupFacts(question: string, locale: Locale): string[] {
  const q = question.normalize('NFC');
  return [
    molar(q, locale),
    configuration(q, locale),
    ...conversions(q, locale),
    ...codons(q, locale),
    ...strands(q, locale),
    mendel(q, locale),
    hardy(q, locale),
    physicalConstant(q, locale),
  ].filter((s): s is string => s !== null);
}
