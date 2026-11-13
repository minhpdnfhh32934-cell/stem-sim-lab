import { vi } from 'vitest';
import { ENGLISH } from '../../../../core/i18n';
import type { BenchPose, StationView } from '../../../../gameplay/experiment/StationSystem';
import {
  type ExperimentDefinition,
  ExperimentDefinitionSchema,
  type SetupStep,
  type WorkspacePiece,
} from '../../../../simulation/experiment';
import type { PieceContext, PieceView } from '../types';
import { FakeNode } from './chemDom';

/* Station views and piece contexts for the Chemistry piece tests (tests only). */

const experiments = import.meta.glob<unknown>('../../../../content/experiments/*.json', {
  eager: true,
  import: 'default',
});

/** A shipped definition by id. */
export function definitionOf(id: string): ExperimentDefinition {
  const raw = experiments[`../../../../content/experiments/${id}.json`];
  if (raw === undefined) throw new Error(`no experiment ${id}`);
  return ExperimentDefinitionSchema.parse(raw);
}

export const piece = (
  kind: string,
  shows: WorkspacePiece['shows'] = [],
  owns: string[] = [],
  id = kind,
): WorkspacePiece => ({ id, kind, slot: 'bench', label: id, owns, shows });

export interface Station {
  status?: BenchPose['status'];
  parameters?: Record<string, number>;
  sample?: Record<string, number>;
  setup?: { step: Partial<SetupStep> & { id: string; onto: string }; done: boolean }[];
  model?: string;
  dials?: Record<string, number>;
  run?: unknown;
}

/** A bench station view: only what the Chemistry pieces read is real. */
export function stationView(definition: ExperimentDefinition, s: Station = {}): StationView {
  const parameters = s.parameters ?? {};
  const view = {
    kind: 'bench',
    id: 'lab/station',
    model: s.model ?? 'test',
    definition,
    session: {
      parameters: s.dials ?? parameters,
      run: s.run ?? null,
      state: s.status ?? 'configured',
    },
    checklist: [],
    next: 0,
    runBlock: null,
    setup: (s.setup ?? []).map(({ step, done }) => ({
      step: {
        place: step.place ?? 'material',
        phase: 'before-run',
        after: [],
        instruction: step.id,
        refusal: step.id,
        ...step,
      },
      done,
    })),
    pose: { status: s.status ?? 'configured', parameters, sample: s.sample ?? {} },
  };
  return view as unknown as StationView;
}

export interface Mounted {
  view: PieceView;
  root: FakeNode;
  ctx: PieceContext;
  sent: Parameters<PieceContext['send']>[0][];
  /** Reasons `ctx.refusal` gives by command (null: allowed). */
  refuse: Record<string, string | null>;
}

/** Mounts a piece view into a fake root. */
export function mountPiece(
  factory: () => PieceView,
  p: WorkspacePiece,
  refuse: Record<string, string | null> = {},
): Mounted {
  const sent: Mounted['sent'] = [];
  const ctx: PieceContext = {
    texts: ENGLISH,
    stationId: 'lab/station',
    piece: p,
    send: (command) => void sent.push(command),
    refusal: vi.fn((command: string) => refuse[command] ?? null),
  };
  const view = factory();
  const root = new FakeNode('div');
  view.mount(root as unknown as HTMLElement, ctx);
  return { view, root, ctx, sent, refuse };
}
