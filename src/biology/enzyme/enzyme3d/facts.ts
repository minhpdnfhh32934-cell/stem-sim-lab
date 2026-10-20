/**
 * Words of the enzyme 3D view that carry the model's values (pure): the moment's readout, the
 * picture's description, the scale chip and the picked part's card. Every concentration, rate,
 * share and count comes from the lesson's model (`binding.ts`); `Fmt` writes numbers for the
 * learner's locale.
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../../common';
import { ENZYMES_DRAWN, type EnzymeForm, type EnzymeFrame, type EnzymeModel3D } from './binding';
import {
  FORM_NAME,
  FORM_SHORT,
  INHIBITOR_NOTE,
  LOCK_KEY_NOTE,
  formNote,
  type EnzymeSelection,
} from './components';

export interface Fmt {
  /** Whole numbers. */
  int: (n: number) => string;
  /** A value with at most `digits` significant digits. */
  sig: (v: number, digits: number) => string;
}

export interface PartCard {
  title: LocalizedText;
  lines: LocalizedText[];
}

const MIN = L('phút', 'min');
const both = (f: (u: string) => string): LocalizedText => L(f(MIN.vi), f(MIN.en));

/** "[S] = 2 mM · v = 3,33 mM/phút" or "t = 1,2 phút · [S] = 6,1 mM · [P] = 3,9 mM". */
export function readout(frame: EnzymeFrame, fmt: Fmt): LocalizedText {
  if (frame.t === null)
    return both((u) => `[S] = ${fmt.sig(frame.S, 3)} mM · v = ${fmt.sig(frame.v, 3)} mM/${u}`);
  const t = frame.t;
  return both(
    (u) =>
      `t = ${fmt.sig(t, 3)} ${u} · [S] = ${fmt.sig(frame.S, 3)} mM · [P] = ${fmt.sig(frame.P, 3)} mM`,
  );
}

/** "1 hạt = 0,2 mM". */
export function scaleText(m: EnzymeModel3D, fmt: Fmt): LocalizedText {
  const x = fmt.sig(m.scale, 3);
  return L(`1 hạt = ${x} mM`, `1 particle = ${x} mM`);
}

/** "ES 11 · EI 5 · ESI 0 · tự do 8" (only the forms of this inhibition type). */
export function countsText(m: EnzymeModel3D, frame: EnzymeFrame, fmt: Fmt): LocalizedText {
  const forms = formsIn(m);
  const part = (lang: 'vi' | 'en') =>
    forms.map((f) => `${FORM_SHORT[f][lang]} ${fmt.int(frame.counts[f])}`).join(' · ');
  return L(part('vi'), part('en'));
}

/** Forms the lesson's inhibition type has. */
export function formsIn(m: EnzymeModel3D): EnzymeForm[] {
  switch (m.p.kind) {
    case 'none':
      return ['ES', 'E'];
    case 'competitive':
      return ['ES', 'EI', 'E'];
    case 'noncompetitive':
      return ['ES', 'EI', 'ESI', 'E'];
    case 'uncompetitive':
      return ['ES', 'ESI', 'E'];
  }
}

/** The picture described in words (the canvas's accessible name). */
export function pictureLabel(m: EnzymeModel3D, frame: EnzymeFrame, fmt: Fmt): LocalizedText {
  const r = readout(frame, fmt);
  const c = countsText(m, frame, fmt);
  const s = scaleText(m, fmt);
  const n = String(ENZYMES_DRAWN);
  const ps = fmt.int(frame.particles.S);
  const pp = fmt.int(frame.particles.P);
  return L(
    `Thể tích phản ứng với ${n} enzyme (mẫu đại diện): ${c.vi}. ${r.vi}. ${ps} hạt cơ chất${frame.t === null ? '' : `, ${pp} hạt sản phẩm`} (${s.vi}).`,
    `Reaction volume with ${n} enzymes (a representative sample): ${c.en}. ${r.en}. ${ps} substrate particles${frame.t === null ? '' : `, ${pp} product particles`} (${s.en}).`,
  );
}

/** Kind of the k-th place of the substrate/product pool now. */
export function spKind(frame: EnzymeFrame, k: number): 'S' | 'P' | null {
  if (k < 0) return null;
  if (k < frame.particles.S) return 'S';
  if (k < frame.particles.S + frame.particles.P) return 'P';
  return null;
}

/** Whether a pick still names something drawn now. */
export function selectionValid(
  m: EnzymeModel3D,
  frame: EnzymeFrame,
  sel: EnzymeSelection,
): boolean {
  if (sel.kind === 'enzyme') return sel.index >= 0 && sel.index < ENZYMES_DRAWN;
  if (sel.pool === 'sp') return spKind(frame, sel.index) !== null;
  return m.p.kind !== 'none' && sel.index >= 0 && sel.index < frame.particles.I;
}

const pct = (f: number, fmt: Fmt) => `${fmt.sig(f * 100, 3)} %`;

/** The picked part's card: an enzyme's form and its share in the model, or a particle's kind. */
export function selectionCard(
  m: EnzymeModel3D,
  frame: EnzymeFrame,
  forms: readonly EnzymeForm[],
  sel: EnzymeSelection,
  fmt: Fmt,
): PartCard | null {
  if (!selectionValid(m, frame, sel)) return null;
  const at = (lang: 'vi' | 'en') =>
    frame.t === null
      ? `[S] = ${fmt.sig(frame.S, 3)} mM`
      : `t = ${fmt.sig(frame.t, 3)} ${MIN[lang]} ([S] = ${fmt.sig(frame.S, 3)} mM)`;
  const n = String(ENZYMES_DRAWN);
  if (sel.kind === 'enzyme') {
    const form = forms[sel.index] ?? 'E';
    const share = frame.species[form];
    const drawn = fmt.int(frame.counts[form]);
    const lines: LocalizedText[] = [
      formNote(form, m.p.kind),
      L(
        `Theo mô hình, ở ${at('vi')}: ${pct(share, fmt)} số enzyme ở dạng ${FORM_SHORT[form].vi}; trên hình ${drawn}/${n} enzyme.`,
        `In the model, at ${at('en')}: ${pct(share, fmt)} of the enzyme is ${FORM_SHORT[form].en}; drawn: ${drawn}/${n} enzymes.`,
      ),
    ];
    if (form === 'ES') {
      const v = fmt.sig(frame.v, 3);
      const vmax = fmt.sig(m.p.vmax, 3);
      const es = fmt.int(frame.counts.ES);
      lines.push(
        L(
          `[ES]/[E]tổng = v/Vmax = ${v}/${vmax} → làm tròn(${n} × ${v}/${vmax}) = ${es} enzyme ES.`,
          `[ES]/[E]total = v/Vmax = ${v}/${vmax} → round(${n} × ${v}/${vmax}) = ${es} ES enzymes.`,
        ),
      );
    }
    if (form === 'ES' || form === 'E') lines.push(LOCK_KEY_NOTE);
    return {
      title: L(
        `Enzyme số ${String(sel.index + 1)}: ${FORM_NAME[form].vi}`,
        `Enzyme no. ${String(sel.index + 1)}: ${FORM_NAME[form].en}`,
      ),
      lines,
    };
  }
  const scale = fmt.sig(m.scale, 3);
  if (sel.pool === 'i') {
    const kind = m.p.kind === 'none' ? 'competitive' : m.p.kind;
    const I = fmt.sig(m.p.inhibitor, 3);
    const ki = fmt.sig(m.p.ki, 3);
    const count = fmt.int(frame.particles.I);
    return {
      title: L('Hạt chất ức chế (I)', 'Inhibitor particle (I)'),
      lines: [
        INHIBITOR_NOTE[kind],
        L(
          `[I] = ${I} mM, Kᵢ = ${ki} mM → ${count} hạt (1 hạt = ${scale} mM). Mô hình coi [I] tự do bằng [I] đã chọn.`,
          `[I] = ${I} mM, Kᵢ = ${ki} mM → ${count} particles (1 particle = ${scale} mM). The model takes free [I] as the [I] chosen.`,
        ),
      ],
    };
  }
  const kind = spKind(frame, sel.index);
  if (kind === 'S') {
    const count = fmt.int(frame.particles.S);
    return {
      title: L('Hạt cơ chất (S)', 'Substrate particle (S)'),
      lines: [
        L(
          'Cơ chất tự do trong dung dịch; enzyme gắn nó vào trung tâm hoạt động rồi biến thành sản phẩm.',
          'Free substrate in solution; an enzyme binds it in its active site and turns it into product.',
        ),
        L(
          `${at('vi')} → ${count} hạt (1 hạt = ${scale} mM).`,
          `${at('en')} → ${count} particles (1 particle = ${scale} mM).`,
        ),
      ],
    };
  }
  const count = fmt.int(frame.particles.P);
  const total = fmt.int(m.pool0);
  return {
    title: L('Hạt sản phẩm (P)', 'Product particle (P)'),
    lines: [
      L(
        'Sản phẩm do phức hợp ES tạo ra; trên hình, hạt cơ chất đổi thành hạt sản phẩm tại chỗ (minh họa).',
        'Product made by ES complexes; in the picture a substrate particle turns into a product particle where it is (illustration).',
      ),
      L(
        `[P] = [S]₀ − [S](t) = ${fmt.sig(m.s0, 3)} − ${fmt.sig(frame.S, 3)} = ${fmt.sig(frame.P, 3)} mM → ${count} hạt; S + P = ${total} hạt (1 hạt = ${scale} mM).`,
        `[P] = [S]₀ − [S](t) = ${fmt.sig(m.s0, 3)} − ${fmt.sig(frame.S, 3)} = ${fmt.sig(frame.P, 3)} mM → ${count} particles; S + P = ${total} particles (1 particle = ${scale} mM).`,
      ),
    ],
  };
}
