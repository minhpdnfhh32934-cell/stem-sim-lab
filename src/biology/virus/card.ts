/** Science Card of "Khái quát về virus": a qualitative illustration, no equations. */
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { SGK_SH10_BAI24 } from './parts';

export const VIRUS_ILLUSTRATION = L(
  'Minh họa — không theo tỉ lệ; số khối nhỏ trên vỏ capsid và số gai vẽ ra chỉ để minh họa.',
  'Illustration — not to scale; the numbers of small bumps on the capsid and of spikes drawn are only illustrative.',
);

export const VIRUS_CARD: ScienceCardData = {
  title: L('Cấu tạo của virus', 'The structure of a virus'),
  model: L(
    'Sơ đồ định tính một hạt virus (virion) hình đa diện: lõi nucleic acid và vỏ protein (vỏ capsid); một số virus động vật có thêm vỏ ngoài là màng kép phospholipid với các gai glycoprotein. Năm giai đoạn nhân lên chỉ trình bày bằng chữ.',
    'A qualitative diagram of one polyhedral virus particle (virion): a nucleic acid core and a protein coat (the capsid); some animal viruses also have an envelope, a phospholipid bilayer with glycoprotein spikes. The five stages of multiplication are given in words only.',
  ),
  equations: [],
  assumptions: [
    VIRUS_ILLUSTRATION,
    L(
      'Lõi vẽ như một sợi cuộn; vật chất di truyền thật có thể là DNA hoặc RNA, mạch kép hoặc mạch đơn.',
      'The core is drawn as a coiled thread; the real genetic material may be DNA or RNA, double- or single-stranded.',
    ),
  ],
  validity: L(
    'Một kiểu virus (hình đa diện). Virus rất đa dạng về hình dạng: hình xoắn, hình đa diện, hình cầu, dạng phức tạp (SGK H 24.1).',
    'One kind of virus (polyhedral). Viruses come in many shapes: helical, polyhedral, spherical, complex (textbook figure 24.1).',
  ),
  confidence: 'qualitative',
  confidenceNote: L(
    'Hình định tính: không đọc kích thước hay số lượng từ hình.',
    'Qualitative picture: do not read sizes or counts from it.',
  ),
  userIntervened: false,
  sources: [SGK_SH10_BAI24],
  reviewStatus: 'pending',
};
