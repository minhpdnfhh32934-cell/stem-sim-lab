import type { PieceViewFactory } from './types';

/**
 * The piece views by `kind` (burette, conical-flask, ph-meter…), like `BENCH_MODELS`. A module in
 * `pieces/` adds its kinds by exporting `pieces`, a record from kind to factory; the host reads
 * them all, so a subject's pieces are added without touching the host. Empty is fine: a kind with
 * no view is drawn as a labelled placeholder and warned about once.
 */
type PieceModule = { readonly pieces?: Readonly<Record<string, PieceViewFactory>> };

const modules = import.meta.glob<PieceModule>(['./pieces/*.ts', '!./pieces/*.test.ts'], {
  eager: true,
});

function collect(): Readonly<Record<string, PieceViewFactory>> {
  const all: Record<string, PieceViewFactory> = {};
  for (const module of Object.values(modules)) Object.assign(all, module.pieces);
  return Object.freeze(all);
}

export const WORKSPACE_PIECES: Readonly<Record<string, PieceViewFactory>> = collect();

/** Remembers which unknown kinds were reported, so each is warned about once per host. */
export class PieceResolver {
  private readonly reported = new Set<string>();

  constructor(
    private readonly registry: Readonly<Record<string, PieceViewFactory>>,
    private readonly warn: (kind: string) => void,
  ) {}

  /** The factory for `kind`, or null (warning the first time) for a kind with no view. */
  resolve(kind: string): PieceViewFactory | null {
    const factory = Object.hasOwn(this.registry, kind) ? this.registry[kind] : undefined;
    if (factory) return factory;
    if (!this.reported.has(kind)) {
      this.reported.add(kind);
      this.warn(kind);
    }
    return null;
  }
}
