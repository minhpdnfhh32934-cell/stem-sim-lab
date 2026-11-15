/**
 * "Khái quát về virus" (SH10 KNTT Bài 24, #255): the parts of a virus particle and the five stages
 * of its multiplication, in short, simple words that keep the textbook's meaning (tr. 141–144,
 * read on taphuan.nxbgd.vn 15/11/2026). "Capsomere" is not a word of the textbook: its text and
 * source are OpenStax Biology 2e §21.1. Teaching texts, review_status pending (DATA_REVIEW
 * SH10-VIRUS-*). No numbers in these texts.
 */
import type { LocalizedText, Source } from '@/core/data/dataset';
import { L } from '../common';

export const SGK_SH10_BAI24: Source = {
  id: 'sgk-sh10-kntt-bai24',
  citation:
    'SGK Sinh học 10, bộ Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam), Bài 24 “Khái quát về virus”, tr. 141–144 (đọc trên taphuan.nxbgd.vn ngày 15/11/2026)',
  url: 'https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-10.4700819489',
};

export const OPENSTAX_BIO_21_1: Source = {
  id: 'openstax-biology-2e-21-1',
  citation:
    'M. A. Clark, M. Douglas, J. Choi — Biology 2e, OpenStax (2018), §21.1 “Viral Evolution, Morphology, and Classification”, mục Morphology (CC BY 4.0; đọc ngày 15/11/2026)',
  url: 'https://openstax.org/books/biology-2e/pages/21-1-viral-evolution-morphology-and-classification',
};

export type VirusPart = 'core' | 'capsid' | 'capsomere' | 'envelope' | 'spikes';
export const VIRUS_PARTS: readonly VirusPart[] = [
  'core',
  'capsid',
  'capsomere',
  'envelope',
  'spikes',
];
/** Parts only an enveloped virus has. */
export const ENVELOPE_PARTS: ReadonlySet<VirusPart> = new Set(['envelope', 'spikes']);

export function partsShown(enveloped: boolean): VirusPart[] {
  return VIRUS_PARTS.filter((p) => enveloped || !ENVELOPE_PARTS.has(p));
}

export const isVirusPart = (v: unknown): v is VirusPart =>
  typeof v === 'string' && (VIRUS_PARTS as readonly string[]).includes(v);

export const PART_TEXT: Record<
  VirusPart,
  { name: LocalizedText; short: LocalizedText; text: LocalizedText; source: Source }
> = {
  core: {
    name: L('Lõi nucleic acid', 'Nucleic acid core'),
    short: L('Lõi nucleic acid', 'Nucleic acid core'),
    text: L(
      'Vật chất di truyền của virus: DNA hoặc RNA, mạch kép hoặc mạch đơn, gồm một hoặc vài đoạn phân tử tương đối ngắn. Mọi virus đều có lõi này.',
      'The virus’s genetic material: DNA or RNA, double- or single-stranded, in one or a few fairly short molecules. Every virus has this core.',
    ),
    source: SGK_SH10_BAI24,
  },
  capsid: {
    name: L('Vỏ capsid (vỏ protein)', 'Capsid (protein coat)'),
    short: L('Vỏ capsid', 'Capsid'),
    text: L(
      'Lớp vỏ bằng protein bao quanh lõi nucleic acid. Lõi và vỏ capsid là hai thành phần chính mà mọi virus đều có.',
      'The protein coat around the nucleic acid core. The core and the capsid are the two main parts every virus has.',
    ),
    source: SGK_SH10_BAI24,
  },
  capsomere: {
    name: L('Capsomere (đơn vị protein của vỏ)', 'Capsomere (protein unit of the coat)'),
    short: L('Capsomere', 'Capsomere'),
    text: L(
      'Vỏ capsid ghép từ nhiều đơn vị protein gọi là capsomere; các protein này do gene của chính virus mã hoá. Ở virus hình đa diện, các capsomere xếp thành khối nhiều mặt gần giống hình cầu.',
      'The capsid is assembled from many protein units called capsomeres, encoded by the virus’s own genes. In a polyhedral virus they form a many-faced, nearly round shell.',
    ),
    source: OPENSTAX_BIO_21_1,
  },
  envelope: {
    name: L('Vỏ ngoài', 'Envelope'),
    short: L('Vỏ ngoài', 'Envelope'),
    text: L(
      'Chỉ có ở một số virus (nhiều virus động vật): lớp màng kép phospholipid bọc bên ngoài vỏ capsid.',
      'Only some viruses (many animal viruses) have it: a phospholipid bilayer around the capsid.',
    ),
    source: SGK_SH10_BAI24,
  },
  spikes: {
    name: L('Gai glycoprotein', 'Glycoprotein spikes'),
    short: L('Gai glycoprotein', 'Spikes'),
    text: L(
      'Các gai glycoprotein trên vỏ ngoài giúp virus tiếp cận và bám vào tế bào chủ.',
      'Glycoprotein spikes on the envelope help the virus reach and attach to its host cell.',
    ),
    source: SGK_SH10_BAI24,
  },
};

export const STAGES = ['attachment', 'penetration', 'synthesis', 'assembly', 'release'] as const;
export type Stage = (typeof STAGES)[number];

/** The five stages of multiplication (tr. 143–144), in order. */
export const STAGE_TEXT: Record<Stage, { name: LocalizedText; text: LocalizedText }> = {
  attachment: {
    name: L('Hấp phụ', 'Attachment'),
    text: L(
      'Virus bám vào tế bào chủ: gai glycoprotein (hoặc protein bề mặt, ở virus không có vỏ ngoài) khớp đặc hiệu với thụ thể trên bề mặt tế bào chủ, như chìa khoá với ổ khoá.',
      'The virus attaches to the host cell: its glycoprotein spikes (or surface proteins, in a virus without an envelope) fit specific receptors on the host’s surface, like a key in a lock.',
    ),
  },
  penetration: {
    name: L('Xâm nhập', 'Penetration'),
    text: L(
      'Vật chất di truyền của virus vào trong tế bào chủ. Mỗi loại virus một cách: thể thực khuẩn bơm DNA vào vi khuẩn và để vỏ protein bên ngoài; nhiều virus động vật có vỏ ngoài đưa cả vỏ capsid vào rồi mới giải phóng nucleic acid; virus thực vật vào qua vết thương do côn trùng chích hút hay ăn cây.',
      'The virus’s genetic material enters the host cell, in a way that depends on the virus: a bacteriophage injects its DNA and leaves its protein coat outside; many enveloped animal viruses bring the whole capsid in and then release the nucleic acid; plant viruses enter through wounds made by insects that suck or chew the plant.',
    ),
  },
  synthesis: {
    name: L('Tổng hợp', 'Synthesis'),
    text: L(
      'Virus dùng enzyme của tế bào chủ để phiên mã, dịch mã tạo protein của virus và nhân bản vật chất di truyền của nó. Một số virus RNA mang theo enzyme phiên mã ngược để sao RNA thành DNA trước.',
      'The virus uses the host cell’s enzymes to transcribe and translate its proteins and to copy its genetic material. Some RNA viruses carry a reverse transcriptase to copy their RNA into DNA first.',
    ),
  },
  assembly: {
    name: L('Lắp ráp', 'Assembly'),
    text: L(
      'Lõi nucleic acid được lắp vào vỏ protein thành các hạt virus hoàn chỉnh.',
      'Nucleic acid cores are packed into protein coats, making complete virus particles.',
    ),
  },
  release: {
    name: L('Giải phóng', 'Release'),
    text: L('Các virus mới thoát ra khỏi tế bào chủ.', 'The new viruses leave the host cell.'),
  },
};
