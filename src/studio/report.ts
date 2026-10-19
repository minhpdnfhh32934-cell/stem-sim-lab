import {
  formatNumber,
  translate,
  type Locale,
  type MessageKey,
  type MessageParams,
} from '@/app/i18n';
import type { Source } from '@/core/data/dataset';
import { fmtQty } from '@/physics/common/tex';
import type { StudioScenario } from './scenario';
import {
  engineEvidence,
  learnerText,
  type EngineQuantity,
  type EvidenceRecord,
  type StudioSession,
} from './session';
import { unverifiedItems, unverifiedLabel } from './unverified';

/**
 * Practice report built only from a session's evidence. Engine numbers, the learner's words and
 * AI text stay in separate, labelled sections; nothing is computed or rephrased here.
 */
export type ReportBlock =
  | { kind: 'h1' | 'h2' | 'p' | 'quote' | 'note'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

export interface ReportInput {
  scenario: StudioScenario;
  session: StudioSession;
  locale: Locale;
  /** Sources of the model that produced the numbers (e.g. the scene's Science Card). */
  modelSources?: readonly Source[];
  generatedAt: number;
}

/** Relative difference below which an engine value and its cross-check count as equal. */
const CHECK_EPS = 1e-6;

function qty(locale: Locale, q: EngineQuantity): string {
  return fmtQty(locale, q.value, q.unit);
}

function checkCell(locale: Locale, tr: Tr, q: EngineQuantity): string {
  if (q.check === null) return '—';
  const rel = Math.abs(q.value - q.check) / Math.max(Math.abs(q.check), 1e-12);
  if (rel < CHECK_EPS)
    return tr('studio.report.checkOk', { value: fmtQty(locale, q.check, q.unit) });
  return tr('studio.report.checkDiff', {
    value: fmtQty(locale, q.check, q.unit),
    diff: formatNumber(locale, rel, { style: 'percent', maximumSignificantDigits: 2 }),
  });
}

type Tr = (key: MessageKey, params?: MessageParams) => string;

export function reportBlocks(input: ReportInput): ReportBlock[] {
  const { scenario, session, locale } = input;
  const tr: Tr = (key, params) => translate(locale, key, params);
  const L = (t: { vi: string; en: string }) => t[locale];
  const blocks: ReportBlock[] = [];
  const time = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(input.generatedAt));

  blocks.push({ kind: 'h1', text: L(scenario.title) });
  blocks.push({ kind: 'note', text: tr('studio.report.generated', { time }) });
  blocks.push({ kind: 'note', text: tr(`studio.report.review.${scenario.review_status}`) });
  if (scenario.author === 'teacher') blocks.push({ kind: 'note', text: tr('studio.teacher') });

  blocks.push({ kind: 'h2', text: tr('studio.report.objectives') });
  blocks.push({ kind: 'list', items: scenario.objectives.map(L) });

  blocks.push({ kind: 'h2', text: tr('studio.report.prediction') });
  blocks.push({
    kind: 'p',
    text: session.prediction
      ? tr('studio.report.predicted', { label: session.prediction.label })
      : tr('studio.report.noPrediction'),
  });

  const runs = engineEvidence(session);
  const numeric = runs.length === 0 || runs.some((r) => r.quantities.length > 0);
  blocks.push({
    kind: 'h2',
    text: tr(numeric ? 'studio.report.engine' : 'studio.report.engineFacts'),
  });
  if (runs.length === 0) blocks.push({ kind: 'p', text: tr('studio.report.noEngine') });
  for (const run of runs) {
    const params = { model: run.model, title: L(run.title) };
    blocks.push({
      kind: 'note',
      text:
        run.quantities.length > 0
          ? tr('studio.report.engineNote', params)
          : tr('studio.report.libraryNote', params),
    });
    if (run.conditions.length > 0) {
      blocks.push({
        kind: 'list',
        items: run.conditions.map((c) =>
          tr('studio.report.condition', {
            id: c.id,
            inputs: c.inputs.map((q) => `${L(q.label)} = ${qty(locale, q)}`).join('; '),
          }),
        ),
      });
    }
    if (run.facts && run.facts.length > 0) {
      blocks.push({ kind: 'list', items: run.facts.map((f) => `${L(f.label)}: ${L(f.text)}`) });
    }
    if (run.quantities.length === 0) continue;
    blocks.push({
      kind: 'table',
      head: [
        tr('studio.report.col.quantity'),
        tr('studio.report.col.condition'),
        tr('studio.report.col.value'),
        tr('studio.report.col.check'),
      ],
      rows: run.quantities.map((q) => [
        L(q.label),
        q.condition,
        qty(locale, q),
        checkCell(locale, tr, q),
      ]),
    });
  }

  blocks.push({ kind: 'h2', text: tr('studio.report.explanation') });
  const explanation = learnerText(session, 'explanation').trim();
  blocks.push(
    explanation
      ? { kind: 'quote', text: explanation }
      : { kind: 'p', text: tr('studio.report.empty') },
  );

  const ai = session.evidence.filter(
    (e): e is Extract<EvidenceRecord, { kind: 'ai' }> => e.kind === 'ai',
  );
  if (ai.length > 0) {
    blocks.push({ kind: 'h2', text: tr('studio.report.ai') });
    blocks.push({ kind: 'note', text: tr('studio.report.aiNote') });
    for (const rec of ai) {
      blocks.push({ kind: 'quote', text: `[${rec.provider}] ${rec.text}` });
    }
  }

  blocks.push({ kind: 'h2', text: tr('studio.report.conclusion') });
  const v = session.verdict;
  if (v) {
    const items: string[] = [];
    if (v.correctLabel) items.push(tr('studio.report.computed', { label: v.correctLabel }));
    items.push(
      v.match === null
        ? tr('studio.report.verdictNone')
        : v.match
          ? tr('studio.report.verdictMatch')
          : tr('studio.report.verdictMiss'),
    );
    blocks.push({ kind: 'list', items });
  } else {
    blocks.push({ kind: 'p', text: tr('studio.report.noEngine') });
  }
  const conclusion = learnerText(session, 'conclusion').trim();
  blocks.push({ kind: 'p', text: tr('studio.report.yourConclusion') });
  blocks.push(
    conclusion
      ? { kind: 'quote', text: conclusion }
      : { kind: 'p', text: tr('studio.report.empty') },
  );
  blocks.push({
    kind: 'p',
    text: tr('studio.report.expected', { text: L(scenario.expectedConclusion) }),
  });

  const caveats = [...scenario.assumptions, ...scenario.limits].map(L);
  if (caveats.length > 0) {
    blocks.push({ kind: 'h2', text: tr('studio.report.assumptions') });
    blocks.push({ kind: 'list', items: caveats });
  }

  const pending = unverifiedItems(scenario, session);
  if (pending.length > 0) {
    blocks.push({ kind: 'h2', text: tr('studio.report.unverified') });
    blocks.push({ kind: 'note', text: tr('studio.report.unverifiedNote') });
    blocks.push({ kind: 'list', items: pending.map((item) => unverifiedLabel(item, locale)) });
  }

  const sources = [...scenario.sources, ...(input.modelSources ?? [])];
  const seen = new Set<string>();
  const unique = sources.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
  blocks.push({ kind: 'h2', text: tr('studio.report.sources') });
  blocks.push(
    unique.length > 0
      ? {
          kind: 'list',
          items: unique.map((s) => (s.url ? `${s.citation} — ${s.url}` : s.citation)),
        }
      : { kind: 'p', text: tr('studio.report.noSources') },
  );
  blocks.push({ kind: 'note', text: tr('studio.report.footer') });
  return blocks;
}

const mdCell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const mdQuote = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => `> ${l}`)
    .join('\n');

export function renderMarkdown(blocks: readonly ReportBlock[]): string {
  const out = blocks.map((b) => {
    switch (b.kind) {
      case 'h1':
        return `# ${b.text}`;
      case 'h2':
        return `## ${b.text}`;
      case 'p':
        return b.text;
      case 'note':
        return `_${b.text}_`;
      case 'quote':
        return mdQuote(b.text);
      case 'list':
        return b.items.map((i) => `- ${i}`).join('\n');
      case 'table':
        return [
          `| ${b.head.map(mdCell).join(' | ')} |`,
          `| ${b.head.map(() => '---').join(' | ')} |`,
          ...b.rows.map((r) => `| ${r.map(mdCell).join(' | ')} |`),
        ].join('\n');
    }
  });
  return `${out.join('\n\n')}\n`;
}

export function renderText(blocks: readonly ReportBlock[]): string {
  const out = blocks.map((b) => {
    switch (b.kind) {
      case 'h1':
        return `${b.text}\n${'='.repeat(Math.min(b.text.length, 60))}`;
      case 'h2':
        return `${b.text}\n${'-'.repeat(Math.min(b.text.length, 60))}`;
      case 'p':
      case 'note':
        return b.text;
      case 'quote':
        return b.text
          .split(/\r?\n/)
          .map((l) => `  “${l}”`)
          .join('\n');
      case 'list':
        return b.items.map((i) => `• ${i}`).join('\n');
      case 'table':
        return b.rows
          .map((r) => r.map((c, i) => `${b.head[i] ?? ''}: ${c}`).join(' · '))
          .join('\n');
    }
  });
  return `${out.join('\n\n')}\n`;
}

export function buildReport(input: ReportInput, format: 'markdown' | 'text' = 'markdown'): string {
  const blocks = reportBlocks(input);
  return format === 'markdown' ? renderMarkdown(blocks) : renderText(blocks);
}
