/**
 * What the 3D meiosis view says about the model at a moment (pure: no React, no three.js): the
 * counts chip and the picked part's facts. Every number is read from the bookkeeping model
 * (`runDivision` through the timeline) — never typed in. Numbers are formatted by the caller's
 * `fmt` (the locale's decimal comma).
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../../common';
import type { Segment } from '../division';
import type { MeiosisSelection } from './components';
import type { Meiosis3DState, MeiosisStage3D, MeiosisTimeline } from './timeline';

type Fmt = (v: number) => string;

const kind = (n: number, state: 'single' | 'double') =>
  L(
    state === 'double' ? `${n} NST kép` : `${n} NST đơn`,
    state === 'double' ? `${n} double chromosomes` : `${n} single chromosomes`,
  );

/** Distinct gametes among the four final cells (the model's, by `gameteSignature`). */
export function distinctGametes(tl: MeiosisTimeline): number {
  return new Set(tl.gametes()).size;
}

/**
 * The counts chip of a stage. `formed`: nuclei per cell whose envelope has formed now (telophase
 * shows "forming" until they have).
 */
export function countsChipText(
  tl: MeiosisTimeline,
  stage: MeiosisStage3D,
  formed: number,
): LocalizedText {
  const c = tl.counts(stage);
  const telophase = stage === 'telophase1' || stage === 'telophase2';
  if (telophase && formed >= c.nuclei.to) {
    const per = kind(c.perNucleus ?? 0, c.state);
    return c.cells === 1
      ? L(
          `1 tế bào · ${formed} nhân · mỗi nhân ${per.vi}`,
          `1 cell · ${formed} nuclei · ${per.en} per nucleus`,
        )
      : L(
          `${c.cells} tế bào · mỗi tế bào ${formed} nhân · mỗi nhân ${per.vi}`,
          `${c.cells} cells · ${formed} nuclei each · ${per.en} per nucleus`,
        );
  }
  const each = kind(c.chromosomes, c.state);
  if (telophase) {
    return c.cells === 1
      ? L(
          `1 tế bào · ${each.vi} · đang hình thành ${c.nuclei.to} nhân`,
          `1 cell · ${each.en} · ${c.nuclei.to} nuclei forming`,
        )
      : L(
          `${c.cells} tế bào · mỗi tế bào ${each.vi} · đang hình thành ${c.nuclei.to} nhân`,
          `${c.cells} cells · ${each.en} each · ${c.nuclei.to} nuclei forming in each`,
        );
  }
  if (stage === 'cytokinesis2') {
    const g = distinctGametes(tl);
    return L(
      `Sau khi chia: ${c.cells} tế bào con · mỗi tế bào ${each.vi} · ${g} loại giao tử`,
      `After division: ${c.cells} daughter cells · ${each.en} each · ${g} kinds of gamete`,
    );
  }
  if (stage === 'cytokinesis1') {
    return L(
      `Sau khi chia: ${c.cells} tế bào con · mỗi tế bào ${each.vi}`,
      `After division: ${c.cells} daughter cells · ${each.en} each`,
    );
  }
  return c.cells === 1
    ? L(`1 tế bào · ${each.vi}`, `1 cell · ${each.en}`)
    : L(`${c.cells} tế bào · mỗi tế bào ${each.vi}`, `${c.cells} cells · ${each.en} each`);
}

/** "mẹ 0–0,42 · bố 0,42–1": a chromatid's DNA pieces from the model. */
export function piecesText(pieces: readonly Segment[], fmt: Fmt): LocalizedText {
  const one = (s: Segment, who: string) => `${who} ${fmt(s.from)}–${fmt(s.to)}`;
  return L(
    pieces.map((s) => one(s, s.origin === 'M' ? 'mẹ' : 'bố')).join(' · '),
    pieces.map((s) => one(s, s.origin === 'M' ? 'mother' : 'father')).join(' · '),
  );
}

/** Lines of model facts about the picked part at this moment (empty when there are none). */
export function selectionFacts(
  tl: MeiosisTimeline,
  st: Meiosis3DState,
  sel: MeiosisSelection,
  fmt: Fmt,
): LocalizedText[] {
  const out: LocalizedText[] = [];
  const crossover = (pair: number) => tl.options.crossovers.find((x) => x.pair === pair);
  if (sel.component === 'bivalent' && sel.pair !== undefined) {
    const x = crossover(sel.pair);
    const p = sel.pair + 1;
    out.push(
      L(
        `Theo mô hình: cặp NST số ${p} gồm 2 NST kép tương đồng (1 từ mẹ, 1 từ bố) = 4 crômatit.`,
        `From the model: pair ${p} is two homologous double chromosomes (one from the mother, one from the father) = 4 chromatids.`,
      ),
    );
    out.push(
      x
        ? L(
            `Trao đổi chéo tại vị trí ${fmt(x.point)} dọc chiều dài NST (0 = một đầu, 1 = đầu kia).`,
            `Crossing over at ${fmt(x.point)} along the chromosome (0 = one end, 1 = the other).`,
          )
        : L('Cặp này không trao đổi chéo.', 'This pair does not cross over.'),
    );
    const mFirst = tl.options.orientation[sel.pair] ?? true;
    const [a, b] = mFirst ? ['mẹ', 'bố'] : ['bố', 'mẹ'];
    const [ae, be] = mFirst ? ['mother', 'father'] : ['father', 'mother'];
    out.push(
      L(
        `Kì giữa I: NST từ ${a} quay về cực thứ nhất, NST từ ${b} về cực thứ hai — chiều sắp xếp ngẫu nhiên của lần chạy này.`,
        `Metaphase I: the chromosome from the ${ae} faces the first pole, the one from the ${be} the second — this run’s random orientation.`,
      ),
    );
    return out;
  }
  if (sel.component === 'chiasma') {
    const x = crossover(sel.pair ?? 0);
    if (!x) return out;
    out.push(
      L(
        `Theo mô hình: cặp NST số ${x.pair + 1}, tại vị trí ${fmt(x.point)} dọc chiều dài NST; hai crômatit không chị em phía trong đã đổi đoạn cho nhau.`,
        `From the model: pair ${x.pair + 1}, at ${fmt(x.point)} along the chromosome; the two inner non-sister chromatids have exchanged pieces.`,
      ),
    );
    return out;
  }
  if (sel.chromosome === undefined) return out;
  // The picked chromatid (sister 0 when only the chromosome was picked) and its chromosome now.
  const mine = st.chromatids.filter((c) => c.present && c.chromosome === sel.chromosome);
  const first = mine.find((c) => c.sister === (sel.sister ?? 0)) ?? mine[0];
  const info = first ? tl.chromatids[first.id] : undefined;
  if (!first || !info) return out;
  const from = info.origin === 'M' ? L('từ mẹ', 'the mother') : L('từ bố', 'the father');
  const p = info.pair + 1;
  // A double chromosome has both sisters; after the split each is its own single chromosome.
  const count = first.joined ? mine.length : 1;
  out.push(
    L(
      `Theo mô hình: cặp NST số ${p}, nguồn gốc ${from.vi}; lúc này có ${count} crômatit (${count} phân tử ADN).`,
      `From the model: chromosome pair ${p}, from ${from.en}; it has ${count} chromatid(s) (${count} DNA molecule(s)) now.`,
    ),
  );
  if (sel.component === 'sisterChromatid' || sel.component === 'singleChromosome') {
    const pieces = first.crossed ? info.after : info.before;
    const text = piecesText(pieces, fmt);
    out.push(
      L(
        `Các đoạn ADN của crômatit này: ${text.vi}${first.crossed && info.recombinant ? ' (đã trao đổi chéo)' : ''}.`,
        `DNA pieces of this chromatid: ${text.en}${first.crossed && info.recombinant ? ' (crossed over)' : ''}.`,
      ),
    );
  }
  return out;
}
