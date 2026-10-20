/**
 * 3D figure above the sequences of "Đột biến điểm": the normal and the mutated helix with the
 * changed bases and residues glowing. ("ADN → mARN → Protein" has its own 3D view:
 * `dogma3d/Dogma3DView.tsx`.)
 */
import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { L } from '../common';
import { Bio3DFigureBody, type SceneSpec } from '../view3d/Bio3DView';
import { ILLUSTRATION } from '../view3d/texts';
import { analyzeMutation, mutatedTranslation, type Mutation, type Translation } from './dogma';
import { MAX_BP, buildMutationScene } from './scene3d';
import { mutationOf, parseInput, useDogmaStore } from './state';

const residues = (t: Translation, glowFrom: number) =>
  t.codons
    .filter((c) => !c.entry?.stop)
    .map((c) => ({ name: c.entry?.three ?? '?', glow: glowFrom >= 0 && c.index >= glowFrom }));

/** Positions changed on the mutated coding strand, and where a deletion left a gap. */
function changes(m: Mutation): { changed: Set<number>; deletedAt: number } {
  if (m.kind === 'substitution') return { changed: new Set([m.pos]), deletedAt: -1 };
  if (m.kind === 'insertion')
    return {
      changed: new Set(Array.from({ length: m.bases.length }, (_, k) => m.pos + k)),
      deletedAt: -1,
    };
  return { changed: new Set(), deletedAt: m.pos };
}

export function Dogma3D() {
  const Lz = useLocalized();
  const st = useDogmaStore();
  const parsed = useMemo(() => parseInput(st.input, st.strand), [st.input, st.strand]);
  const coding = parsed.ok ? parsed.coding : '';
  if (!parsed.ok || !coding) return null;
  const ends = { five: '5′', three: '3′' };
  const cut =
    coding.length > MAX_BP
      ? ` ${Lz(
          L(
            `Hình chỉ vẽ ${String(MAX_BP)}/${String(coding.length)} cặp nuclêôtit đầu.`,
            `The picture shows the first ${String(MAX_BP)} of ${String(coding.length)} base pairs.`,
          ),
        )}`
      : '';
  const legend = Lz(
    L(
      'Màu bazơ: A lục, T đỏ cam, U hồng, G cam, C lam.',
      'Base colours: A green, T vermilion, U pink, G orange, C blue.',
    ),
  );

  const m = mutationOf(st, coding.length);
  if (!m) return null;
  const a = analyzeMutation(coding, m);
  const mt = mutatedTranslation(coding, m);
  const ch = changes(m);
  const texts = {
    ...ends,
    normal: Lz(L('Bình thường', 'Normal')),
    mutant: Lz(L('Đột biến', 'Mutated')),
  };
  const scene: SceneSpec = {
    build: (kit) =>
      buildMutationScene(kit, {
        coding,
        mutated: mt.coding,
        changed: ch.changed,
        deletedAt: ch.deletedAt,
        normal: residues(a.before, -1),
        mutant: residues(mt.t, a.firstChange),
        texts,
      }),
    buildKey: JSON.stringify([coding, m, texts]),
    label: Lz(
      L(
        `ADN bình thường và ADN đột biến; protein bình thường ${String(a.before.protein.length)} axit amin, protein đột biến ${String(mt.t.protein.length)} axit amin.`,
        `Normal and mutated DNA; normal protein ${String(a.before.protein.length)} amino acids, mutated protein ${String(mt.t.protein.length)}.`,
      ),
    ),
    viewDir: [0.1, 0.25, 1],
    aspect: 2.4,
  };
  return (
    <Bio3DFigureBody
      lesson="pointMutation"
      scene={scene}
      caption={`${Lz(
        L(
          'Bazơ bị thay đổi và các axit amin từ chỗ đột biến trở đi phát sáng.',
          'The changed bases, and the amino acids from the mutation on, glow.',
        ),
      )} ${legend}${cut} ${Lz(ILLUSTRATION)}`}
    />
  );
}
