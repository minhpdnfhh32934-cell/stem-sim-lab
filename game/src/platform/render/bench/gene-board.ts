import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import {
  codonsRead,
  GENE,
  MUTATIONS,
  translate,
} from '../../../simulation/models/proteinSynthesis';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Protein synthesis (model `biology.protein-synthesis`, Phase X): a display board with the gene as
// a DNA ladder — the coding strand above, the template strand below, one block per base in its
// colour (A green, T red, G yellow, C blue) — the mRNA (U orange) copied below it as the run goes,
// then a ribosome moving along the mRNA codon by codon, adding one bead per amino acid to the
// protein chain beneath (a colour per amino acid). A white marker points at the mutated base.

const BASE = 0.03;
const PITCH = 0.0128;
const BLOCK = 0.0105;
const CAPACITY = 36;
const Y_CODING = 0.43;
const Y_TEMPLATE = 0.408;
const Y_MRNA = 0.35;
const Y_PROTEIN = 0.265;
const FRONT = -0.03;
const COLOURS: Readonly<Record<string, string>> = {
  A: '#3fae5a',
  T: '#d64545',
  U: '#e08a2c',
  G: '#e8c934',
  C: '#3a68d6',
};
const PAIR: Readonly<Record<string, string>> = { A: 'T', T: 'A', G: 'C', C: 'G' };
const AMINO = 'ACDEFGHIKLMNPQRSTVWY';

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

const xOf = (i: number, length: number) => (i - (length - 1) / 2) * PITCH;

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const board = own(new THREE.MeshStandardMaterial({ color: '#eef1f4', ...LOOKS.satin }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  mesh(keep(new THREE.BoxGeometry(0.48, 0.3, 0.012)), board).position.set(0, 0.34, FRONT - 0.012);
  for (const x of [-0.2, 0.2])
    mesh(keep(new THREE.BoxGeometry(0.02, 0.17, 0.02)), painted).position.set(
      x,
      BASE + 0.085,
      FRONT - 0.012,
    );
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const satin = own(new THREE.MeshStandardMaterial({ ...LOOKS.satin }));
  const block = keep(new THREE.BoxGeometry(BLOCK, 0.018, 0.008));
  const row = (name: string) => {
    const m = new THREE.InstancedMesh(block, satin, CAPACITY);
    m.name = name;
    m.castShadow = false;
    m.count = 0;
    kit.group.add(m);
    return m;
  };
  const coding = row('dna');
  const template = row('template-strand');
  const messenger = row('mrna');
  const beads = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.013, 14, 10)), satin, 12);
  beads.name = 'protein';
  beads.castShadow = false;
  beads.count = 0;
  kit.group.add(beads);
  const ribosomeMaterial = own(
    new THREE.MeshStandardMaterial({ color: '#8a5fb8', ...LOOKS.satin }),
  );
  const ribosome = new THREE.Group();
  ribosome.name = 'ribosome';
  kit.group.add(ribosome);
  mesh(
    keep(new THREE.SphereGeometry(1, 18, 12).scale(0.026, 0.018, 0.012)),
    ribosomeMaterial,
    ribosome,
  ).position.y = 0.016;
  mesh(
    keep(new THREE.SphereGeometry(1, 18, 12).scale(0.02, 0.012, 0.012)),
    ribosomeMaterial,
    ribosome,
  ).position.y = -0.014;
  const marker = mesh(
    keep(new THREE.ConeGeometry(0.006, 0.014, 10).rotateX(Math.PI)),
    own(new THREE.MeshBasicMaterial({ color: '#ffffff' })),
  );
  marker.name = 'mutation';
  const matrix = new THREE.Matrix4();
  const colour = new THREE.Color();
  let shownMutation = NaN;
  let shownCopied = NaN;
  let shownMade = NaN;
  let dna = GENE;
  let protein = '';
  let reads = 0;

  const place = (m: THREE.InstancedMesh, i: number, x: number, y: number, hex: string) => {
    matrix.makeTranslation(x, y, FRONT);
    m.setMatrixAt(i, matrix);
    m.setColorAt(i, colour.set(hex));
  };
  const done = (m: THREE.InstancedMesh) => {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };

  const pose = ({ parameters, sample }: BenchPose) => {
    const mutation = Math.round(parameters.mutation ?? 0);
    const transcribed = Number.isFinite(sample.transcribed)
      ? Math.round(sample.transcribed ?? 0)
      : 0;
    const translated = Number.isFinite(sample.translated) ? Math.round(sample.translated ?? 0) : 0;
    if (mutation === shownMutation && transcribed === shownCopied && translated === shownMade)
      return;
    const changedGene = mutation !== shownMutation;
    shownMutation = mutation;
    shownCopied = transcribed;
    shownMade = translated;
    if (changedGene) {
      dna = (MUTATIONS[mutation] ?? ((x: string) => x))(GENE);
      protein = translate(dna);
      reads = codonsRead(dna);
      const n = Math.min(CAPACITY, dna.length);
      for (let i = 0; i < n; i++) {
        const b = dna[i] ?? 'A';
        place(coding, i, xOf(i, n), Y_CODING, COLOURS[b] ?? '#888');
        place(template, i, xOf(i, n), Y_TEMPLATE, COLOURS[PAIR[b] ?? 'A'] ?? '#888');
      }
      coding.count = n;
      template.count = n;
      done(coding);
      done(template);
      let first = -1;
      for (let i = 0; i < n && first < 0; i++) if (dna[i] !== GENE[i]) first = i;
      marker.visible = first >= 0;
      marker.position.set(xOf(Math.max(0, first), n), Y_CODING + 0.024, FRONT);
    }
    const n = Math.min(CAPACITY, dna.length);
    const copied = Math.min(n, transcribed);
    for (let i = 0; i < copied; i++) {
      const b = dna[i] === 'T' ? 'U' : (dna[i] ?? 'A');
      place(messenger, i, xOf(i, n), Y_MRNA, COLOURS[b] ?? '#888');
    }
    messenger.count = copied;
    done(messenger);
    const made = Math.min(12, translated, protein.length);
    for (let i = 0; i < made; i++) {
      const hue = AMINO.indexOf(protein[i] ?? 'A') / AMINO.length;
      matrix.makeTranslation(xOf(i * 3 + 1, n), Y_PROTEIN, FRONT + 0.004);
      beads.setMatrixAt(i, matrix);
      beads.setColorAt(i, colour.setHSL(hue, 0.65, 0.52));
    }
    beads.count = made;
    done(beads);
    // The ribosome sits on the codon being read, once the mRNA is complete.
    ribosome.visible = copied >= n && reads > 0;
    const codon = Math.min(translated, reads - 1);
    ribosome.position.set(xOf(codon * 3 + 1, n), Y_MRNA, FRONT + 0.012);
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      for (const m of [coding, template, messenger, beads]) m.dispose();
      kit.dispose();
    },
  };
}

export const geneBoard: BenchModel = {
  frame,
  rig,
  reads: ['transcribed', 'translated'],
  fullScale: { transcribed: 34, translated: 11 },
};
