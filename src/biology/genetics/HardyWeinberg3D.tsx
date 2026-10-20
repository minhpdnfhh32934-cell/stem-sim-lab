/**
 * Hardy–Weinberg in 3D (a figure above the lesson's chart and table): the observed population,
 * each individual coloured by genotype, and its gene pool — 2·AA + Aa copies of A and Aa + 2·aa
 * copies of a — in a jar. Counts are the learner's numbers; places are illustration.
 */
import { useLocalized } from '@/app/i18n/localized';
import { useTierConfig } from '@/perf/perfStore';
import { L } from '../common';
import { useFmt } from '../fmt';
import { Bio3DFigureBody, type SceneSpec } from '../view3d/Bio3DView';
import { ILLUSTRATION, perFigure } from '../view3d/texts';
import { allelePool, genotypeFigures } from './genetics3d';
import { testHardyWeinberg } from './population';
import { buildHwScene } from './scenes3d';
import { useHw } from './store';

export function HardyWeinberg3D() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useHw();
  const tier = useTierConfig();
  const t = testHardyWeinberg(st.AA, st.Aa, st.aa);
  const figures = genotypeFigures(st, Math.floor(tier.maxParticles / 2));
  const pool = allelePool(st);
  // Gene copies per bead: at most 600 beads in the jar (the pool is twice the population).
  const perAllele = Math.max(1, Math.ceil((pool.A + pool.a) / 600));
  const texts = {
    AA: `AA: ${fmt(st.AA, 6)}`,
    Aa: `Aa: ${fmt(st.Aa, 6)}`,
    aa: `aa: ${fmt(st.aa, 6)}`,
    A: `A: ${fmt(pool.A, 6)} (p = ${fmt(t.p, 4)})`,
    a: `a: ${fmt(pool.a, 6)} (q = ${fmt(t.q, 4)})`,
    pool: Lz(L('Vốn gen', 'Gene pool')),
  };
  const scene: SceneSpec = {
    build: (kit) => buildHwScene(kit, { figures, pool, perAllele, texts }),
    buildKey: JSON.stringify([figures, pool, perAllele, texts]),
    label: Lz(
      L(
        `Quần thể ${texts.AA}, ${texts.Aa}, ${texts.aa} và vốn gen ${texts.A}, ${texts.a}.`,
        `Population ${texts.AA}, ${texts.Aa}, ${texts.aa} and its gene pool ${texts.A}, ${texts.a}.`,
      ),
    ),
    viewDir: [0.15, 0.7, 1],
    aspect: 2,
  };
  const beadNote =
    perAllele <= 1
      ? Lz(L('Mỗi hạt là 1 bản sao gen.', 'Each bead is 1 gene copy.'))
      : Lz(
          L(
            `Mỗi hạt ≈ ${fmt(perAllele, 6)} bản sao gen (làm tròn).`,
            `Each bead ≈ ${fmt(perAllele, 6)} gene copies (rounded).`,
          ),
        );
  return (
    <Bio3DFigureBody
      lesson="hardyWeinberg"
      scene={scene}
      caption={`${Lz(perFigure(figures.per, (v) => fmt(v, 6)))} ${beadNote} ${Lz(ILLUSTRATION)}`}
    />
  );
}
