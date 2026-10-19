import type { LocalizedText } from '@/core/data/dataset';
import type { ChemistryBinding } from '../scenario';
import { withActions, withEngine, type StudioSession } from '../session';
import { applyAction, nextLog, replayBench, type BenchAction } from './bench';
import { chemVerdict, isTargetMix, mixEvidence, type ChemChoice } from './evidence';
import { mixOutcome } from './library';

/**
 * One bench action applied to a session. The tube is rebuilt from the stored log, so an invalid
 * action leaves the session untouched. A mix stores its library evidence; only the question's
 * pair sets the verdict, any other mix keeps the current one.
 */
export function withBenchAction(
  s: StudioSession,
  b: ChemistryBinding,
  a: BenchAction,
  now: number,
  labelOf: (c: ChemChoice) => LocalizedText,
): StudioSession {
  const step = applyAction(replayBench(s.actions, b.inventory), a, b.inventory);
  if (!step.ok) return s;
  const next = withActions(s, nextLog(s.actions, a, now), now);
  if (a.op !== 'mix') return next;
  const result = mixOutcome(step.state.contents);
  const verdict = isTargetMix(b, step.state.contents)
    ? chemVerdict(result, s.prediction, labelOf)
    : s.verdict;
  return withEngine(next, mixEvidence(step.state.contents, result, now), verdict);
}
