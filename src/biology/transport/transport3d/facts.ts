/**
 * Words of the "Khuếch tán & thẩm thấu" 3D view that carry the model's values (pure): the
 * moment's readout, the counts, the picture's description and the picked part's card. Every
 * concentration, height, pressure and count comes from the lesson's model (`diffusion.ts`,
 * `osmosis.ts`); `Fmt` writes numbers for the learner's locale.
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../../common';
import { sideOf, type DiffusionFrame, type DiffusionModel3D } from './diffusion';
import {
  NET_NOTE,
  PORES_NOTE,
  SOLUTE_NOTE,
  WATER_NOTE,
  type TransportSelection,
} from './components';
import { SOLUTE_DRAWN, WATER_DRAWN, type OsmosisFrame, type OsmosisModel3D } from './osmosis';

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

const same = (s: string): LocalizedText => L(s, s);
const cm = (m: number, fmt: Fmt) => fmt.sig(m * 100, 3);
const kPa = (pa: number, fmt: Fmt) => fmt.sig(pa / 1000, 3);

/* ───────────────────────────── Diffusion ───────────────────────────── */

/** "t = 1,2 phút · C₁ = 6,2 mM · C₂ = 3,8 mM". */
export function diffusionReadout(f: DiffusionFrame, fmt: Fmt): LocalizedText {
  const rest = `C₁ = ${fmt.sig(f.c1, 3)} mM · C₂ = ${fmt.sig(f.c2, 3)} mM`;
  return L(`t = ${fmt.sig(f.t, 3)} phút · ${rest}`, `t = ${fmt.sig(f.t, 3)} min · ${rest}`);
}

/** "Ngăn 1: 112 hạt · Ngăn 2: 48 hạt". */
export function diffusionCounts(f: DiffusionFrame, fmt: Fmt): LocalizedText {
  return L(
    `Ngăn 1: ${fmt.int(f.n1)} hạt · Ngăn 2: ${fmt.int(f.n2)} hạt`,
    `Side 1: ${fmt.int(f.n1)} · Side 2: ${fmt.int(f.n2)} particles`,
  );
}

/** "1 hạt ≈ 0,125 µmol". */
export function particleScale(m: DiffusionModel3D, fmt: Fmt): LocalizedText {
  const x = fmt.sig(m.perParticle, 3);
  return L(`1 hạt ≈ ${x} µmol`, `1 particle ≈ ${x} µmol`);
}

/** "V₁ : V₂ = 1 : 3". */
const volumes = (m: DiffusionModel3D, fmt: Fmt) =>
  `V₁ : V₂ = ${fmt.sig(m.inputs.v1, 3)} : ${fmt.sig(m.inputs.v2, 3)}`;

export function diffusionPicture(m: DiffusionModel3D, f: DiffusionFrame, fmt: Fmt): LocalizedText {
  const pores = fmt.int(Math.round(m.inputs.pores));
  const vols = volumes(m, fmt);
  return L(
    `Hộp hai ngăn (${vols}) ngăn bởi màng có ${pores} lỗ. t = ${fmt.sig(f.t, 3)} phút: ngăn 1 có ${fmt.int(f.n1)} hạt, ngăn 2 có ${fmt.int(f.n2)} hạt.`,
    `A two-sided box (${vols}) split by a membrane with ${pores} pores. t = ${fmt.sig(f.t, 3)} min: ${fmt.int(f.n1)} particles on side 1, ${fmt.int(f.n2)} on side 2.`,
  );
}

function diffusionCard(
  m: DiffusionModel3D,
  f: DiffusionFrame,
  sel: TransportSelection,
  fmt: Fmt,
): PartCard | null {
  const i = m.inputs;
  const t = fmt.sig(f.t, 3);
  const pa = fmt.sig(i.pa, 3);
  const n = Math.round(i.pores);
  switch (sel.kind) {
    case 'membrane':
      return {
        title: L('Màng có lỗ', 'Porous membrane'),
        lines: [
          L(
            'Chất tan chỉ đi qua màng ở các lỗ; phần còn lại của màng chặn chất tan.',
            'The solute crosses the membrane only through the pores; the rest of the membrane holds it back.',
          ),
          n > 0
            ? L(
                `Màng có ${fmt.int(n)} lỗ. Mô hình Fick dùng PA = ${pa} mL/phút (độ thấm × diện tích), không dùng số lỗ.`,
                `The membrane has ${fmt.int(n)} pores. The Fick model uses PA = ${pa} mL/min (permeability × area), not the number of pores.`,
              )
            : L(
                `Màng không có lỗ nên trên hình không hạt nào qua được; đồ thị Fick vẫn dùng PA = ${pa} mL/phút.`,
                `The membrane has no pore, so no particle crosses on the picture; the Fick chart still uses PA = ${pa} mL/min.`,
              ),
          NET_NOTE,
        ],
      };
    case 'pore':
      if (sel.index < 0 || sel.index >= n) return null;
      return {
        title: L(
          `Lỗ màng ${fmt.int(sel.index + 1)}/${fmt.int(n)}`,
          `Pore ${fmt.int(sel.index + 1)} of ${fmt.int(n)}`,
        ),
        lines: [
          L(
            'Kênh xuyên qua màng: hạt chất tan đi qua màng ở đây.',
            'A channel through the membrane: solute particles cross here.',
          ),
          L(
            `Đến t = ${t} phút: ${fmt.int(f.crossed)} hạt đã qua màng (theo định luật Fick).`,
            `By t = ${t} min: ${fmt.int(f.crossed)} particles have crossed (Fick’s law).`,
          ),
          PORES_NOTE,
        ],
      };
    case 'particle': {
      if (sel.index < 0 || sel.index >= m.total) return null;
      const s = sideOf(m, f, sel.index);
      const started = sel.index < m.n1Start ? 1 : 2;
      return {
        title: L(
          `Hạt chất tan số ${fmt.int(sel.index + 1)}`,
          `Solute particle ${fmt.int(sel.index + 1)}`,
        ),
        lines: [
          s === started
            ? L(`Đang ở ngăn ${String(s)} (t = ${t} phút).`, `On side ${String(s)} (t = ${t} min).`)
            : L(
                `Đã qua màng từ ngăn ${String(started)} sang ngăn ${String(s)} (t = ${t} phút).`,
                `Has crossed from side ${String(started)} to side ${String(s)} (t = ${t} min).`,
              ),
          L(
            `Mỗi hạt ứng với ≈ ${fmt.sig(m.perParticle, 3)} µmol chất tan (${fmt.sig(m.amount, 3)} µmol chia cho ${fmt.int(m.total)} hạt).`,
            `Each particle stands for ≈ ${fmt.sig(m.perParticle, 3)} µmol of solute (${fmt.sig(m.amount, 3)} µmol over ${fmt.int(m.total)} particles).`,
          ),
          L(
            'Đường đi của từng hạt là minh họa; số hạt mỗi ngăn theo định luật Fick.',
            'Each particle’s path is illustration; the number on each side follows Fick’s law.',
          ),
        ],
      };
    }
    case 'compartment': {
      const s = sel.side;
      const v = fmt.sig(s === 1 ? i.v1 : i.v2, 3);
      const c = fmt.sig(s === 1 ? f.c1 : f.c2, 3);
      const nn = fmt.int(s === 1 ? f.n1 : f.n2);
      const sub = s === 1 ? '₁' : '₂';
      return {
        title: L(`Ngăn ${String(s)}`, `Side ${String(s)}`),
        lines: [
          L(
            `Thể tích V${sub} = ${v} mL; bề rộng hai ngăn trên hình theo tỉ lệ ${volumes(m, fmt)}.`,
            `Volume V${sub} = ${v} mL; the two sides’ widths follow ${volumes(m, fmt)}.`,
          ),
          L(
            `Lúc t = ${t} phút: C${sub} = ${c} mM (định luật Fick); trên hình ${nn} hạt.`,
            `At t = ${t} min: C${sub} = ${c} mM (Fick’s law); ${nn} particles drawn.`,
          ),
          L(
            `Cân bằng: C₁ = C₂ = ${fmt.sig(m.ceq, 3)} mM — mật độ hạt hai ngăn như nhau.`,
            `Equilibrium: C₁ = C₂ = ${fmt.sig(m.ceq, 3)} mM — the same particle density on both sides.`,
          ),
        ],
      };
    }
    default:
      return null;
  }
}

/* ───────────────────────────── Osmosis ───────────────────────────── */

/** "t = 120 s · h_L = 21,3 cm · h_R = 18,7 cm · Δh = 2,6 cm". */
export function osmosisReadout(f: OsmosisFrame, fmt: Fmt): LocalizedText {
  return same(
    `t = ${fmt.sig(f.t, 3)} s · h_L = ${cm(f.hL, fmt)} cm · h_R = ${cm(f.hR, fmt)} cm · Δh = ${cm(f.dh, fmt)} cm`,
  );
}

/** The model's final state, in words. */
function equilibriumLine(m: OsmosisModel3D, fmt: Fmt): LocalizedText {
  const dh = cm(m.eq.dh, fmt);
  const pi = kPa(m.eq.pi, fmt);
  return m.eq.dry
    ? L(
        `Mô hình: nhánh nước cạn trước khi cân bằng — Δh = ${dh} cm, Π = ${pi} kPa vẫn lớn hơn ρgΔh.`,
        `Model: the water arm runs dry before balance — Δh = ${dh} cm, Π = ${pi} kPa is still above ρgΔh.`,
      )
    : L(
        `Cân bằng (mô hình): Δh = ${dh} cm, Π = ρgΔh = ${pi} kPa.`,
        `Equilibrium (model): Δh = ${dh} cm, Π = ρgΔh = ${pi} kPa.`,
      );
}

export function osmosisPicture(f: OsmosisFrame, fmt: Fmt): LocalizedText {
  const t = fmt.sig(f.t, 3);
  const h = `h_L = ${cm(f.hL, fmt)} cm, h_R = ${cm(f.hR, fmt)} cm, Δh = ${cm(f.dh, fmt)} cm`;
  return L(
    `Ống chữ U: dung dịch bên trái, nước cất bên phải, màng bán thấm ở đáy. t = ${t} s: ${h}.`,
    `U-tube: solution on the left, pure water on the right, a semipermeable membrane at the bottom. t = ${t} s: ${h}.`,
  );
}

function osmosisCard(
  m: OsmosisModel3D,
  f: OsmosisFrame,
  sel: TransportSelection,
  fmt: Fmt,
): PartCard | null {
  const pressures = L(
    `Π = iCRT = ${kPa(f.pi, fmt)} kPa; ρgΔh = ${kPa(f.rhoGdh, fmt)} kPa với Δh = ${cm(f.dh, fmt)} cm.`,
    `Π = iCRT = ${kPa(f.pi, fmt)} kPa; ρgΔh = ${kPa(f.rhoGdh, fmt)} kPa with Δh = ${cm(f.dh, fmt)} cm.`,
  );
  const conc = L(
    `Nồng độ C = C₀h₀/h_L = ${fmt.sig(f.c, 3)} mM (lúc đầu C₀ = ${fmt.sig(m.p.c0, 3)} mM): dung dịch loãng dần khi cột dâng.`,
    `Concentration C = C₀h₀/h_L = ${fmt.sig(f.c, 3)} mM (at first C₀ = ${fmt.sig(m.p.c0, 3)} mM): the solution is diluted as it rises.`,
  );
  switch (sel.kind) {
    case 'membrane':
      return {
        title: L('Màng bán thấm', 'Semipermeable membrane'),
        lines: [
          L(
            'Cho nước đi qua nhưng giữ chất tan lại: số hạt chất tan bên nhánh dung dịch không đổi.',
            'Lets water through but holds the solute back: the solute in the solution arm never changes.',
          ),
          L(
            'Nước đi vào nhánh dung dịch khi áp suất thẩm thấu Π lớn hơn áp suất thủy tĩnh ρgΔh.',
            'Water flows into the solution arm while the osmotic pressure Π is above the hydrostatic pressure ρgΔh.',
          ),
          pressures,
          L(
            'Ở cân bằng, nước vẫn đi qua màng theo cả hai chiều với tốc độ bằng nhau nên mực chất lỏng đứng yên.',
            'At equilibrium water still crosses both ways at equal rates, so the levels stay still.',
          ),
        ],
      };
    case 'column':
      return sel.side === 'solution'
        ? {
            title: L('Cột dung dịch (nhánh trái)', 'Solution column (left arm)'),
            lines: [
              L(
                `h_L = ${cm(f.hL, fmt)} cm (lúc đầu h₀ = ${cm(m.p.h0, fmt)} cm), t = ${fmt.sig(f.t, 3)} s.`,
                `h_L = ${cm(f.hL, fmt)} cm (at first h₀ = ${cm(m.p.h0, fmt)} cm), t = ${fmt.sig(f.t, 3)} s.`,
              ),
              conc,
              pressures,
              equilibriumLine(m, fmt),
            ],
          }
        : {
            title: L('Cột nước cất (nhánh phải)', 'Pure water column (right arm)'),
            lines: [
              L(
                `h_R = ${cm(f.hR, fmt)} cm (lúc đầu h₀ = ${cm(m.p.h0, fmt)} cm): nước đã sang nhánh dung dịch.`,
                `h_R = ${cm(f.hR, fmt)} cm (at first h₀ = ${cm(m.p.h0, fmt)} cm): water has moved to the solution arm.`,
              ),
              L(
                `Δh = h_L − h_R = ${cm(f.dh, fmt)} cm; h_L + h_R = 2h₀ vì hai nhánh cùng tiết diện.`,
                `Δh = h_L − h_R = ${cm(f.dh, fmt)} cm; h_L + h_R = 2h₀ as both arms have the same cross-section.`,
              ),
              pressures,
              equilibriumLine(m, fmt),
            ],
          };
    case 'solute':
      if (sel.index < 0 || sel.index >= SOLUTE_DRAWN) return null;
      return {
        title: L('Hạt chất tan', 'Solute particle'),
        lines: [
          SOLUTE_NOTE,
          conc,
          L(
            `Hệ số i = ${fmt.int(m.p.i)}: mỗi phân tử chất tan cho i hạt trong dung dịch (Π = iCRT).`,
            `Factor i = ${fmt.int(m.p.i)}: each solute unit gives i particles in solution (Π = iCRT).`,
          ),
        ],
      };
    case 'water':
      return {
        title: L('Phân tử nước (minh họa)', 'Water molecule (illustration)'),
        lines: [
          WATER_NOTE,
          L(
            `Đến t = ${fmt.sig(f.t, 3)} s, mực dung dịch đã dâng ${cm(f.hL - m.p.h0, fmt)} cm nhờ nước đi qua màng.`,
            `By t = ${fmt.sig(f.t, 3)} s the solution has risen ${cm(f.hL - m.p.h0, fmt)} cm from the water that crossed.`,
          ),
        ],
      };
    default:
      return null;
  }
}

export type TransportView3D =
  | { mode: 'diffusion'; model: DiffusionModel3D; frame: DiffusionFrame }
  | { mode: 'osmosis'; model: OsmosisModel3D; frame: OsmosisFrame };

/** The picked part's card (null when the pick names nothing drawn now). */
export function selectionCard(
  v: TransportView3D,
  sel: TransportSelection,
  fmt: Fmt,
): PartCard | null {
  return v.mode === 'diffusion'
    ? diffusionCard(v.model, v.frame, sel, fmt)
    : osmosisCard(v.model, v.frame, sel, fmt);
}

/** Whether a pick still names something drawn (new inputs or the other process drop it). */
export function selectionValid(v: TransportView3D, sel: TransportSelection): boolean {
  if (v.mode === 'diffusion') {
    if (sel.kind === 'particle') return sel.index >= 0 && sel.index < v.model.total;
    if (sel.kind === 'pore') return sel.index >= 0 && sel.index < Math.round(v.model.inputs.pores);
    return sel.kind === 'membrane' || sel.kind === 'compartment';
  }
  if (sel.kind === 'solute') return sel.index >= 0 && sel.index < SOLUTE_DRAWN;
  if (sel.kind === 'water') return sel.index >= 0 && sel.index < WATER_DRAWN;
  return sel.kind === 'membrane' || sel.kind === 'column';
}
