import { translate, type Locale, type MessageKey, type MessageParams } from '@/app/i18n';
import { fmtQty } from '@/physics/common/tex';
import { scenarioSteps, type StudioScenario } from './scenario';
import { engineEvidence, learnerText, type EvidenceRecord, type StudioSession } from './session';
import { unverifiedItems, unverifiedLabel } from './unverified';

/**
 * What the Science Studio shares with AI Teacher when the learner turns on screen context.
 * Engine facts, the learner's notes and earlier AI text are separate sections, each with its own
 * budget, so one long section can never push another out; the most important come first because
 * the chat may cut the screen text further from the end.
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
    if (v.correctLabel) engine.push(tr('studio.report.computed', { label: v.correctLabel }));
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
      ? tr('studio.ai.prediction', { label: session.prediction.label })
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

export function renderStudioContext(ctx: StudioContext, locale: Locale): string {
  const cut = translate(locale, 'studio.ai.cut');
  const text = [
    ...fit(ctx.head, BUDGET.head, cut),
    ...fit(ctx.unverified, BUDGET.unverified, cut),
    ...fit(ctx.engine, BUDGET.engine, cut),
    ...fit(ctx.learner, BUDGET.learner, cut),
    ...fit(ctx.ai, BUDGET.ai, cut),
  ].join('\n');
  return text.slice(0, STUDIO_CONTEXT_MAX);
}

export function studioContextText(
  scenario: StudioScenario,
  session: StudioSession,
  locale: Locale,
): string {
  return renderStudioContext(buildStudioContext(scenario, session, locale), locale);
}
