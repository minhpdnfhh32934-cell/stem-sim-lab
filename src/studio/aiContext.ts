import { translate, type Locale, type MessageKey, type MessageParams } from '@/app/i18n';
import { fmtQty } from '@/physics/common/tex';
import { scenarioSteps, type StudioScenario } from './scenario';
import {
  computedLabel,
  engineEvidence,
  learnerText,
  predictionLabel,
  type EvidenceRecord,
  type StudioSession,
} from './session';
import { unverifiedItems, unverifiedLabel } from './unverified';

/**
 * What the Science Studio shares with AI Teacher when the learner turns on screen context.
 * Engine facts, the learner's notes and earlier AI text are separate sections, each with its own
 * budget, so one long section can never push another out. The most important come first: the
 * head (lesson, step, rules), then the engine facts, then pending data, notes and AI text. A
 * smaller screen budget (Gemma on an integrated card: 1200 characters) trims from the end, so
 * after the head the engine facts are the last thing to go.
 */
export interface StudioContext {
  head: string[];
  unverified: string[];
  engine: string[];
  learner: string[];
  ai: string[];
}

/** Longest text the studio shares (characters); below the chat's own compact screen limit. */
export const STUDIO_CONTEXT_MAX = 3600;

// Sums to 3500, leaving room for the "cut" markers within STUDIO_CONTEXT_MAX.
const BUDGET = { head: 500, unverified: 400, engine: 1500, learner: 800, ai: 300 } as const;

/** Longest single learner note or AI text quoted (characters). */
const QUOTE_MAX = 250;

type Tr = (key: MessageKey, params?: MessageParams) => string;

function clip(text: string, max: number, cut: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…${cut}`;
}

export function buildStudioContext(
  scenario: StudioScenario,
  session: StudioSession,
  locale: Locale,
): StudioContext {
  const tr: Tr = (key, params) => translate(locale, key, params);
  const L = (t: { vi: string; en: string }) => t[locale];
  const cut = tr('studio.ai.cut');
  const steps = scenarioSteps(scenario);

  const head = [
    tr('studio.ai.header'),
    tr('studio.ai.lesson', {
      title: L(scenario.title),
      subject: tr(`studio.tabs.${scenario.subject}`),
      level: tr(`levels.${scenario.level}`),
    }),
    tr('studio.ai.step', {
      n: steps.indexOf(session.step) + 1,
      total: steps.length,
      step: tr(`studio.flow.steps.${session.step}`),
    }),
    tr('studio.ai.rules'),
  ];

  const pending = unverifiedItems(scenario, session);
  const unverified =
    pending.length === 0
      ? []
      : [
          tr('studio.ai.unverified'),
          ...pending.map((item) => `- ${unverifiedLabel(item, locale)}`),
        ];

  // Latest run first: it is the one the learner is most likely asking about.
  const runs = [...engineEvidence(session)].sort((a, b) => b.at - a.at);
  const engine = [tr('studio.ai.engine')];
  if (runs.length === 0) engine.push(tr('studio.ai.noEngine'));
  for (const run of runs) {
    engine.push(tr('studio.ai.record', { title: L(run.title), model: run.model }));
    for (const c of run.conditions) {
      engine.push(
        tr('studio.report.condition', {
          id: c.id,
          inputs: c.inputs
            .map((q) => `${L(q.label)} = ${fmtQty(locale, q.value, q.unit)}`)
            .join('; '),
        }),
      );
    }
    for (const q of run.quantities) {
      engine.push(
        tr('studio.ai.quantity', {
          label: L(q.label),
          condition: q.condition,
          value: fmtQty(locale, q.value, q.unit),
        }),
      );
    }
    for (const f of run.facts ?? []) engine.push(`${L(f.label)}: ${L(f.text)}`);
  }
  const v = session.verdict;
  if (v) {
    const computed = computedLabel(v, locale);
    if (computed) engine.push(tr('studio.report.computed', { label: computed }));
    engine.push(
      v.match === null
        ? tr('studio.report.verdictNone')
        : v.match
          ? tr('studio.report.verdictMatch')
          : tr('studio.report.verdictMiss'),
    );
  }

  const learner = [tr('studio.ai.learner')];
  learner.push(
    session.prediction
      ? tr('studio.ai.prediction', { label: predictionLabel(session.prediction, locale) })
      : tr('studio.ai.noPrediction'),
  );
  for (const role of ['explanation', 'conclusion', 'note'] as const) {
    const text = learnerText(session, role).trim();
    if (text) learner.push(tr(`studio.ai.${role}`, { text: clip(text, QUOTE_MAX, cut) }));
  }

  const aiRecords = session.evidence.filter(
    (e): e is Extract<EvidenceRecord, { kind: 'ai' }> => e.kind === 'ai',
  );
  const last = aiRecords[aiRecords.length - 1];
  const ai = last
    ? [tr('studio.ai.aiText'), `[${last.provider}] ${clip(last.text, QUOTE_MAX, cut)}`]
    : [];

  return { head, unverified, engine, learner, ai };
}

/** Lines of a section until its budget is used; a cut section says so. */
function fit(lines: readonly string[], budget: number, cut: string): string[] {
  const out: string[] = [];
  let used = 0;
  for (const line of lines) {
    const cost = line.length + 1;
    if (used + cost > budget) {
      out.push(cut);
      break;
    }
    out.push(line);
    used += cost;
  }
  return out;
}

/**
 * The context text within `max` characters (at most STUDIO_CONTEXT_MAX). Each section takes up
 * to its own budget from what the sections before it left.
 */
export function renderStudioContext(
  ctx: StudioContext,
  locale: Locale,
  max: number = STUDIO_CONTEXT_MAX,
): string {
  const cut = translate(locale, 'studio.ai.cut');
  const limit = Math.max(0, Math.min(max, STUDIO_CONTEXT_MAX));
  const out: string[] = [];
  let left = limit;
  const add = (lines: readonly string[], budget: number) => {
    // Nothing fits any more (not even the cut marker): later sections are left out.
    if (lines.length === 0 || left <= cut.length + 1) return;
    const part = fit(lines, Math.min(budget, left), cut);
    out.push(...part);
    left -= part.reduce((n, line) => n + line.length + 1, 0);
  };
  add(ctx.head, BUDGET.head);
  add(ctx.engine, BUDGET.engine);
  add(ctx.unverified, BUDGET.unverified);
  add(ctx.learner, BUDGET.learner);
  add(ctx.ai, BUDGET.ai);
  return out.join('\n').slice(0, limit);
}

/** The Studio's screen context; `max` is the chat's screen budget for this question. */
export function studioContextText(
  scenario: StudioScenario,
  session: StudioSession,
  locale: Locale,
  max?: number,
): string {
  return renderStudioContext(buildStudioContext(scenario, session, locale), locale, max);
}
