import type { LocalizedText, Source } from '@/core/data/dataset';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });
export { usePublishCard } from '@/modules/usePublishCard';

/** Biology bibliography (editions/pages confirmed by the reviewing teacher). */
export const BSRC = {
  sgk10: {
    id: 'sgk-sh10',
    citation:
      'Sách giáo khoa Sinh học 10 (Chương trình GDPT 2018), NXB Giáo dục Việt Nam — chu kì tế bào, nguyên phân, giảm phân, trao đổi chất qua màng',
  },
  sgk12: {
    id: 'sgk-sh12',
    citation:
      'Sách giáo khoa Sinh học 12 (Chương trình GDPT 2018), NXB Giáo dục Việt Nam — cơ sở phân tử, quy luật di truyền, di truyền quần thể, sinh thái',
  },
  campbell: { id: 'campbell', citation: 'L. A. Urry et al. — Campbell Biology, Pearson' },
  hartl: {
    id: 'hartl-clark',
    citation: 'D. L. Hartl, A. G. Clark — Principles of Population Genetics, Sinauer',
  },
  murray: {
    id: 'murray',
    citation: 'J. D. Murray — Mathematical Biology I, Springer (logistic, Lotka–Volterra)',
  },
  cornish: {
    id: 'cornish-bowden',
    citation: 'A. Cornish-Bowden — Fundamentals of Enzyme Kinetics, Wiley-Blackwell',
  },
  schnell: {
    id: 'schnell-mendoza',
    citation:
      'S. Schnell, C. Mendoza — J. Theor. Biol. 187 (1997) 207–212: closed-form MM time course (Lambert W)',
  },
  atkins: {
    id: 'atkins',
    citation: "P. Atkins, J. de Paula — Atkins' Physical Chemistry (osmosis, van 't Hoff equation)",
  },
} satisfies Record<string, Source>;
