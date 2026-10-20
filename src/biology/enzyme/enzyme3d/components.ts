/**
 * Texts of the 3D view of "Động học enzyme": names of the parts on the picture, the enzyme forms,
 * what is illustration, the 3D Science Card and the selection type. Vietnamese is the source of
 * truth; every new text is listed in docs/DATA_REVIEW.md (ENZ3D-*, review_status: pending) —
 * sources: Cornish-Bowden, Fundamentals of Enzyme Kinetics; SGK Sinh học 10; Campbell Biology.
 */
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../../common';
import { MOTION } from '../../view3d/texts';
import type { Inhibition } from '../enzyme';
import { ENZYME_CARD } from '../enzymeCard';
import { ENZYMES_DRAWN, type EnzymeForm } from './binding';

export type EnzymePart =
  | 'volume'
  | 'enzyme'
  | 'activeSite'
  | 'otherSite'
  | 'complex'
  | 'substrate'
  | 'product'
  | 'inhibitor';

/** What the learner picked: an enzyme (0-based), or a particle of a pool (0-based place). */
export type EnzymeSelection =
  { kind: 'enzyme'; index: number } | { kind: 'particle'; pool: 'sp' | 'i'; index: number };

/** "Minh họa — không phải tỉ lệ/hình dạng thật" (the same words as the other 3D views). */
export const ENZYME_SCALE_NOTE = L(
  'Minh họa — không phải tỉ lệ/hình dạng thật.',
  'Illustration — not to scale or true shape.',
);

/** The required illustration label of this view. */
export const ENZYME_ILLUSTRATION = L(
  'Hình dạng enzyme, vị trí và chuyển động của hạt là minh họa; số enzyme là mẫu đại diện.',
  'Enzyme shapes and the particles’ places and motion are illustration; the number of enzymes is a representative sample.',
);

/** The lock-and-key picture is a cartoon. */
export const LOCK_KEY_NOTE = L(
  'Khe ở trung tâm hoạt động vừa khít cơ chất là hình vẽ hoạt họa kiểu "ổ khóa – chìa khóa", không phải cấu trúc thật của enzyme.',
  'The pocket at the active site that fits the substrate is a lock-and-key cartoon, not the enzyme’s real structure.',
);

/** The same, short, under the picture. */
export const LOCK_KEY_SHORT = L(
  'Khe ở trung tâm hoạt động là hình hoạt họa kiểu "ổ khóa – chìa khóa".',
  'The active-site pocket is a lock-and-key cartoon.',
);

/** Enzymes are a sample; free particles have their own scale. */
export const SAMPLE_NOTE = L(
  `${String(ENZYMES_DRAWN)} enzyme là mẫu đại diện cho toàn bộ enzyme: số enzyme ở mỗi dạng lấy theo tỉ lệ của mô hình. Hạt tự do vẽ theo thang nồng độ riêng (ghi trên hình); enzyme không cùng thang vì mô hình coi [E] ≪ [S].`,
  `The ${String(ENZYMES_DRAWN)} enzymes are a representative sample of all the enzyme: how many are in each form follows the model's shares. Free particles have their own concentration scale (shown on the picture); enzymes are not on that scale because the model assumes [E] ≪ [S].`,
);

/** Names on the picture ("Hiện tên"). */
export const ENZYME_PARTS: Record<EnzymePart, LocalizedText> = {
  volume: L('Thể tích phản ứng', 'Reaction volume'),
  enzyme: L('Enzyme tự do (E)', 'Free enzyme (E)'),
  activeSite: L('Trung tâm hoạt động', 'Active site'),
  otherSite: L(
    'Vị trí gắn chất ức chế (ngoài trung tâm hoạt động)',
    'Inhibitor site (outside the active site)',
  ),
  complex: L('Phức hợp enzyme – cơ chất (ES)', 'Enzyme–substrate complex (ES)'),
  substrate: L('Cơ chất (S)', 'Substrate (S)'),
  product: L('Sản phẩm (P)', 'Product (P)'),
  inhibitor: L('Chất ức chế (I)', 'Inhibitor (I)'),
};

export const FORM_NAME: Record<EnzymeForm, LocalizedText> = {
  E: L('Enzyme tự do (E)', 'Free enzyme (E)'),
  ES: L('Phức hợp enzyme – cơ chất (ES)', 'Enzyme–substrate complex (ES)'),
  EI: L('Phức hợp enzyme – chất ức chế (EI)', 'Enzyme–inhibitor complex (EI)'),
  ESI: L(
    'Phức hợp enzyme – cơ chất – chất ức chế (ESI)',
    'Enzyme–substrate–inhibitor complex (ESI)',
  ),
};

/** Short names on the chips and tags. */
export const FORM_SHORT: Record<EnzymeForm, LocalizedText> = {
  E: L('tự do', 'free'),
  ES: L('ES', 'ES'),
  EI: L('EI', 'EI'),
  ESI: L('ESI', 'ESI'),
};

/** What a form means, for the lesson's inhibition type. */
export function formNote(form: EnzymeForm, kind: Inhibition): LocalizedText {
  switch (form) {
    case 'E':
      return kind === 'uncompetitive'
        ? L(
            'Trung tâm hoạt động còn trống. Chất ức chế phi cạnh tranh không gắn được vào enzyme tự do.',
            'The active site is empty. An uncompetitive inhibitor cannot bind the free enzyme.',
          )
        : L(
            'Trung tâm hoạt động còn trống: enzyme sẵn sàng gắn cơ chất.',
            'The active site is empty: the enzyme is ready to bind substrate.',
          );
    case 'ES':
      return L(
        'Cơ chất nằm trong trung tâm hoạt động. Chỉ phức hợp ES biến cơ chất thành sản phẩm: v = kcat·[ES].',
        'The substrate sits in the active site. Only the ES complex turns substrate into product: v = kcat·[ES].',
      );
    case 'EI':
      return kind === 'competitive'
        ? L(
            'Chất ức chế cạnh tranh chiếm trung tâm hoạt động nên cơ chất không gắn vào được; khi [S] rất lớn, cơ chất lấn át được chất ức chế.',
            'A competitive inhibitor occupies the active site, so substrate cannot bind; at very high [S] the substrate outcompetes it.',
          )
        : L(
            'Chất ức chế gắn vào vị trí khác, ngoài trung tâm hoạt động; enzyme vẫn gắn được cơ chất nhưng khi đó không tạo sản phẩm.',
            'The inhibitor binds another site, outside the active site; the enzyme can still bind substrate but then makes no product.',
          );
    case 'ESI':
      return kind === 'uncompetitive'
        ? L(
            'Chất ức chế phi cạnh tranh chỉ gắn vào phức hợp ES (trên hình, vị trí gắn chỉ hiện khi enzyme đã gắn cơ chất — hình vẽ hoạt họa); phức hợp ESI không tạo sản phẩm.',
            'An uncompetitive inhibitor binds only the ES complex (in the picture its site shows only once the enzyme holds substrate — a cartoon); ESI makes no product.',
          )
        : L(
            'Gắn cả cơ chất (ở trung tâm hoạt động) và chất ức chế (ở vị trí khác): phức hợp ESI không tạo sản phẩm.',
            'Holds both substrate (in the active site) and inhibitor (at the other site): ESI makes no product.',
          );
  }
}

/** What an inhibitor particle does, for the inhibition type. */
export const INHIBITOR_NOTE: Record<Exclude<Inhibition, 'none'>, LocalizedText> = {
  competitive: L(
    'Ức chế cạnh tranh: gắn vào trung tâm hoạt động, tranh chỗ với cơ chất (Km biểu kiến tăng, Vmax không đổi).',
    'Competitive: binds the active site, competing with the substrate (apparent Km rises, Vmax unchanged).',
  ),
  noncompetitive: L(
    'Ức chế không cạnh tranh: gắn vào vị trí khác, ở cả E và ES (Vmax biểu kiến giảm, Km không đổi).',
    'Non-competitive: binds another site, on both E and ES (apparent Vmax falls, Km unchanged).',
  ),
  uncompetitive: L(
    'Ức chế phi cạnh tranh: chỉ gắn vào phức hợp ES (Vmax và Km biểu kiến cùng giảm).',
    'Uncompetitive: binds only the ES complex (apparent Vmax and Km fall together).',
  ),
};

/** The camera choices: the whole volume, or close to one enzyme. */
export const CAMERA_NAME = {
  overview: L('Toàn cảnh', 'Whole picture'),
  close: L('Cận cảnh enzyme', 'Close to an enzyme'),
} as const;

/**
 * The 3D Science Card: the lesson's card (same model, equations, confidence and sources) with
 * the fractions the picture draws and what it adds.
 */
export function enzymeCard3d(): ScienceCardData {
  const base = ENZYME_CARD;
  return {
    ...base,
    title: L('Động học enzyme 3D', 'Enzyme kinetics in 3D'),
    equations: [
      ...base.equations,
      {
        tex: '\\dfrac{[ES]}{[E]_t} = \\dfrac{v}{V_{\\max}},\\quad v = k_{cat}[ES],\\ V_{\\max} = k_{cat}[E]_t',
        label: L('Phần enzyme đang gắn cơ chất', 'Share of enzyme holding substrate'),
      },
      {
        tex: '[E] : [ES] : [EI] : [ESI] = 1 : s : i : s\\,i,\\quad s = \\dfrac{[S]}{K_m},\\ i = \\dfrac{[I]}{K_i}',
        label: L(
          'Cân bằng nhanh, ức chế không cạnh tranh (cạnh tranh: không có ESI; phi cạnh tranh: không có EI)',
          'Rapid equilibrium, non-competitive (competitive: no ESI; uncompetitive: no EI)',
        ),
      },
    ],
    assumptions: [
      ...base.assumptions,
      ENZYME_SCALE_NOTE,
      ENZYME_ILLUSTRATION,
      MOTION,
      LOCK_KEY_NOTE,
      SAMPLE_NOTE,
      L(
        `Số enzyme vẽ ở dạng ES = làm tròn(${String(ENZYMES_DRAWN)} · v/Vmax); các dạng E, EI, ESI chia phần còn lại theo tỉ lệ cân bằng nhanh, làm tròn theo phần dư lớn nhất nên luôn cộng lại đúng ${String(ENZYMES_DRAWN)}.`,
        `Enzymes drawn as ES = round(${String(ENZYMES_DRAWN)} · v/Vmax); E, EI and ESI share the rest in the rapid-equilibrium fractions, rounded by largest remainders so they always add up to ${String(ENZYMES_DRAWN)}.`,
      ),
      L(
        'Hạt tự do: 1 hạt = x mM (x = 1, 2 hoặc 5 × 10ⁿ, như nhau ở mọi mức chất lượng). Đồ thị theo thời gian: số hạt S và P chia từ làm tròn([S]₀/x) nên S + P luôn bằng số hạt lúc đầu; [P] = [S]₀ − [S](t).',
        'Free particles: 1 particle = x mM (x = 1, 2 or 5 × 10ⁿ, the same on every quality tier). Time course: the S and P particles share round([S]₀/x), so S + P always equals the starting number; [P] = [S]₀ − [S](t).',
      ),
      L(
        'Mô hình coi nồng độ chất ức chế tự do bằng [I] đã chọn. Vị trí gắn chất ức chế không cạnh tranh/phi cạnh tranh được vẽ ở cạnh bên enzyme — vị trí minh họa.',
        'The model takes the free inhibitor concentration as the [I] chosen. The non-/uncompetitive inhibitor site is drawn on the enzyme’s side — an illustrative place.',
      ),
      L(
        'Chính xác (lấy từ mô hình): [S], [P], v, Vmax và Km biểu kiến, tỉ lệ các dạng E, ES, EI, ESI; số enzyme mỗi dạng và số hạt chỉ làm tròn.',
        'Exact (from the model): [S], [P], v, apparent Vmax and Km, the shares of E, ES, EI, ESI; the enzymes per form and the particle counts are only rounded.',
      ),
    ],
    sources: [BSRC.cornish, BSRC.schnell, BSRC.sgk10, BSRC.campbell],
    reviewStatus: 'pending',
  };
}
