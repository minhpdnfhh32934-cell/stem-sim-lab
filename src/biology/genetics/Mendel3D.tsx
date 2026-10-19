/**
 * The Punnett square in 3D (a figure above the lesson's table): tiles coloured by phenotype as in
 * the table, the gametes along the edges, a bar per phenotype as tall as its exact probability.
 */
import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { L } from '../common';
import { useFmt } from '../fmt';
import { Bio3DFigureBody, type SceneSpec } from '../view3d/Bio3DView';
import { ILLUSTRATION } from '../view3d/texts';
import { cross, phenotype, ratio, type Locus } from './mendel';
import { buildMendelScene } from './scenes3d';
import { LETTERS, useMendel } from './store';

export function Mendel3D() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useMendel();
  const data = useMemo(() => {
    const loci: Locus[] = LETTERS.slice(0, st.loci).map((letter, i) => ({
      letter,
      dominance: st.dominance[i] ?? 'complete',
    }));
    try {
      const result = cross(st.p1, st.p2, loci);
      const keys = [...result.phenotypes.keys()].sort();
      const ratios = ratio(keys.map((k) => result.phenotypes.get(k) ?? 0));
      return { result, keys, ratios, loci };
    } catch {
      return null;
    }
  }, [st.p1, st.p2, st.loci, st.dominance]);
  if (!data) return null;
  const { result, keys, ratios, loci } = data;
  const hueOf = (ph: string) => Math.max(0, keys.indexOf(ph)) % 5;
  const bars = keys.map((k, i) => ({
    key: `${k} · ${fmt((result.phenotypes.get(k) ?? 0) * 100, 4)} %`,
    count: String(ratios[i] ?? 0),
    probability: result.phenotypes.get(k) ?? 0,
    hue: hueOf(k),
  }));
  const scene: SceneSpec = {
    build: (kit) =>
      buildMendelScene(kit, {
        rows: result.punnett.rows,
        cols: result.punnett.cols,
        cells: result.punnett.cells,
        hue: result.punnett.cells.map((row) => row.map((c) => hueOf(phenotype(c, loci)))),
        bars,
        texts: { female: '♀', male: '♂' },
      }),
    buildKey: JSON.stringify([st.p1, st.p2, st.loci, st.dominance, bars]),
    label: Lz(
      L(
        `Bảng Punnett ${st.p1} × ${st.p2} dạng 3D; tỉ lệ kiểu hình ${ratios.join(' : ')}.`,
        `3D Punnett square ${st.p1} × ${st.p2}; phenotype ratio ${ratios.join(' : ')}.`,
      ),
    ),
    viewDir: [0.15, 0.95, 1],
    aspect: 1.8,
  };
  return (
    <Bio3DFigureBody
      lesson="mendel"
      scene={scene}
      caption={`${Lz(
        L(
          'Mỗi ô là một tổ hợp giao tử; màu theo kiểu hình như trong bảng. Chiều cao cột = xác suất chính xác của kiểu hình.',
          'Each tile is one pair of gametes, coloured by phenotype as in the table. Bar height = the exact probability of the phenotype.',
        ),
      )} ${Lz(ILLUSTRATION)}`}
    />
  );
}
