import {
  CircleAlert,
  CircleHelp,
  ListChecks,
  PencilRuler,
  Play,
  Quote,
  RefreshCw,
  Settings,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDictionary, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import type { Draft } from '@/ai/draft';
import { MAX_PROBLEM_CHARS } from '@/ai/pipeline';
import { fromSI, toSI, unitLabel } from '@/core/units';
import { applyAutoDefaults } from '@/physics/autoDefaults';
import { sceneIds } from '@/physics/registry';
import type { ParamDef, ParamSource, Params, PhysicsScene } from '@/physics/types';
import { Equation } from '@/science-card/Equation';
import { IconButton } from '@/ui/IconButton';
import {
  analyze,
  closeAnalyze,
  confirmDraft,
  openManual,
  useAnalyzeStore,
  type AnalyzeErrorCode,
} from './analyze';
import './ai.css';

/**
 * "Tôi hiểu đề như sau" (MASTER_PROMPT §3.1): nothing is simulated before the user has
 * seen, and can correct, every value and where it came from. Also hosts the manual
 * "Tự dựng cảnh" mode and the unsupported / error states of the AI pipeline.
 */
export function ProblemDialog() {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const { phase, mode, draft, scene } = useAnalyzeStore();
  const open = phase === 'review' || phase === 'unsupported' || phase === 'error';

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const title =
    phase === 'review'
      ? mode === 'manual'
        ? t('analyze.manualTitle')
        : t('analyze.title')
      : phase === 'unsupported'
        ? t('analyze.unsupportedTitle')
        : t('analyze.errorTitle');

  return (
    <dialog
      ref={ref}
      className="dialog dialog--wide"
      aria-labelledby="problem-dialog-title"
      onClose={closeAnalyze}
    >
      <header className="dialog__header">
        <h2 id="problem-dialog-title">{title}</h2>
        <IconButton icon={X} label={t('analyze.close')} onClick={closeAnalyze} tooltipSide="left" />
      </header>
      {phase === 'review' && draft && scene && (
        // Keyed by the draft: a new analysis or topic starts from a fresh table.
        <DraftReview key={`${draft.topic}:${draft.problemText}`} draft={draft} scene={scene} />
      )}
      {phase === 'unsupported' && <UnsupportedView />}
      {phase === 'error' && <ErrorView />}
    </dialog>
  );
}

function SourceBadge({ source }: { source: ParamSource }) {
  const t = useT();
  return (
    <span
      className={`param__source param__source--${source}`}
      data-tip={t(`params.sourceHint.${source}`)}
    >
      {t(`params.source.${source}`)}
    </span>
  );
}

function DraftReview({ draft, scene }: { draft: Draft; scene: PhysicsScene }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { mode, model } = useAnalyzeStore();
  const [params, setParams] = useState<Params>(draft.params);
  const [sources, setSources] = useState<Record<string, ParamSource>>(draft.sources);
  const [kept, setKept] = useState<Set<string>>(new Set());

  const visible = scene.params.filter((d) => !d.when || d.when(params));
  const missing = draft.missing.filter((k) => {
    const def = scene.params.find((d) => d.key === k);
    if (def?.when && !def.when(params)) return false;
    return sources[k] === 'default' && !kept.has(k);
  });
  const validation = scene.validate?.(params) ?? [];
  const questionLabels = useMemo(() => {
    const answers = scene.solve(scene.defaults, 'vi').answers;
    return draft.questions
      .map((id) => answers.find((a) => a.id === id)?.label)
      .filter((x) => x !== undefined);
  }, [scene, draft.questions]);

  const setValue = (key: string, si: number) => {
    const nextSources = { ...sources, [key]: 'user' as const };
    setSources(nextSources);
    setParams(applyAutoDefaults(scene, { ...params, [key]: si }, nextSources));
  };

  const topicNames = getDictionary(locale).topics as Record<string, string>;
  const blocking = draft.issues.filter((i) => i.blocking);
  const warnings = draft.issues.filter((i) => !i.blocking);

  return (
    <>
      <div className="dialog__body problem-review">
        <p className="muted">{mode === 'manual' ? t('analyze.manualIntro') : t('analyze.intro')}</p>

        {mode === 'manual' ? (
          <label className="problem-review__topic">
            <span>{t('analyze.topic')}</span>
            <select
              value={scene.id}
              onChange={(e) => {
                void openManual(e.target.value);
              }}
            >
              {sceneIds().map((id) => (
                <option key={id} value={id}>
                  {topicNames[id] ?? id}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <p className="problem-review__topic">
              <span>{t('analyze.topic')}</span>
              <strong>{L(scene.title)}</strong>
              {model && <span className="muted small">{t('analyze.model', { model })}</span>}
            </p>
            <blockquote className="problem-review__text" aria-label={t('analyze.problem')}>
              {draft.problemText}
            </blockquote>
          </>
        )}

        <table className="problem-table">
          <thead>
            <tr>
              <th scope="col">{t('analyze.quantity')}</th>
              <th scope="col">{t('analyze.value')}</th>
              <th scope="col">{t('analyze.source')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((def) => (
              <ReviewRow
                key={def.key}
                def={def}
                valueSI={params[def.key] ?? 0}
                source={sources[def.key] ?? 'default'}
                written={draft.written[def.key]}
                missing={missing.includes(def.key)}
                onChange={(v) => {
                  setValue(def.key, v);
                }}
                onKeep={() => {
                  setKept(new Set([...kept, def.key]));
                }}
              />
            ))}
          </tbody>
        </table>

        {mode === 'ai' && (
          <section className="problem-review__section">
            <h3>
              <ListChecks size={15} strokeWidth={1.75} aria-hidden="true" />
              {t('analyze.questions')}
            </h3>
            {questionLabels.length ? (
              <ul className="chip-list">
                {questionLabels.map((l) => (
                  <li key={l.vi} className="chip">
                    {L(l)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{t('analyze.noQuestions')}</p>
            )}
          </section>
        )}

        <TextList title={t('analyze.assumptions')} items={draft.assumptions} icon={ListChecks} />
        <TextList
          title={t('analyze.clarifications')}
          items={draft.clarifications}
          icon={CircleHelp}
          tone="info"
        />
        {draft.unsupported.length > 0 && (
          <section className="problem-review__section problem-review__section--warn" role="note">
            <h3>
              <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
              {t('analyze.unsupported')}
            </h3>
            <p className="small">{t('analyze.unsupportedNote')}</p>
            <ul>
              {draft.unsupported.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </section>
        )}
        {(blocking.length > 0 || warnings.length > 0) && (
          <section className="problem-review__section problem-review__section--warn">
            <h3>
              <CircleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
              {t('analyze.issues')}
            </h3>
            <ul>
              {[...blocking, ...warnings].map((i, n) => (
                <li key={n}>{L(i.message)}</li>
              ))}
            </ul>
          </section>
        )}
        {validation.length > 0 && (
          <section className="problem-review__section problem-review__section--warn" role="alert">
            <h3>
              <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
              {t('analyze.validation')}
            </h3>
            <ul>
              {validation.map((m) => (
                <li key={m.vi}>{L(m)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <footer className="dialog__footer">
        {missing.length > 0 && (
          <span className="dialog__footer-note" role="status">
            {t('analyze.missingBlock', { count: missing.length })}
          </span>
        )}
        <button type="button" className="btn" onClick={closeAnalyze}>
          {t('analyze.cancel')}
        </button>
        <button
          type="button"
          className="btn btn--accent"
          disabled={missing.length > 0}
          onClick={() => {
            void confirmDraft(draft, params, sources);
          }}
        >
          <Play size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('analyze.confirm')}
        </button>
      </footer>
    </>
  );
}

function WrittenNote({ written }: { written: { value: number; unit: string; quote: string } }) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const unit = written.unit === '1' ? '' : ` ${unitLabel(written.unit)}`;
  return (
    <p className="problem-table__quote">
      <Quote size={12} strokeWidth={1.75} aria-hidden="true" />
      {t('analyze.inProblem', {
        value: `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US').format(written.value)}${unit}`,
      })}
      {written.quote && <> · {t('analyze.quote', { quote: written.quote })}</>}
    </p>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  // Local text so that intermediate input ("0,", "-") is not rejected while typing.
  const [text, setText] = useState(() => String(Number(value.toPrecision(6))));
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : String(Number(value.toPrecision(6)));
  return (
    <input
      className="param__number mono"
      inputMode="decimal"
      aria-label={label}
      value={shown}
      onFocus={() => {
        setText(String(Number(value.toPrecision(6))));
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
      }}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value.replace(',', '.').trim());
        if (e.target.value.trim() !== '' && Number.isFinite(v)) onChange(v);
      }}
    />
  );
}

function ReviewRow({
  def,
  valueSI,
  source,
  written,
  missing,
  onChange,
  onKeep,
}: {
  def: ParamDef;
  valueSI: number;
  source: ParamSource;
  written: { value: number; unit: string; quote: string } | undefined;
  missing: boolean;
  onChange: (si: number) => void;
  onKeep: () => void;
}) {
  const t = useT();
  const L = useLocalized();
  const unit = def.unit ?? '1';
  return (
    <tr className={missing ? 'is-missing' : undefined}>
      <th scope="row">
        <span className="problem-table__name">
          {L(def.label)} {def.symbol && <Equation tex={def.symbol} display={false} />}
        </span>
      </th>
      <td>
        {def.kind === 'number' && (
          <>
            <NumberField
              label={L(def.label)}
              value={fromSI(valueSI, unit)}
              onChange={(v) => {
                onChange(toSI(v, unit));
              }}
            />
            <span className="param__unit">{unit === '1' ? '' : unitLabel(unit)}</span>
          </>
        )}
        {def.kind === 'choice' && (
          <div className="segmented" role="radiogroup" aria-label={L(def.label)}>
            {def.choices?.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={valueSI === c.value}
                className="segmented__item"
                onClick={() => {
                  onChange(c.value);
                }}
              >
                {L(c.label)}
              </button>
            ))}
          </div>
        )}
        {def.kind === 'toggle' && (
          <input
            type="checkbox"
            aria-label={L(def.label)}
            checked={valueSI > 0.5}
            onChange={(e) => {
              onChange(e.target.checked ? 1 : 0);
            }}
          />
        )}
        {written && <WrittenNote written={written} />}
        {missing && (
          <p className="problem-table__missing">
            <CircleHelp size={12} strokeWidth={1.75} aria-hidden="true" />
            {t('analyze.missingHint')}{' '}
            <button type="button" className="link-button" onClick={onKeep}>
              {t('analyze.keepDefault')}
            </button>
          </p>
        )}
      </td>
      <td>
        {missing ? (
          <span className="param__source param__source--missing">{t('analyze.missing')}</span>
        ) : (
          <SourceBadge source={source} />
        )}
      </td>
    </tr>
  );
}

function TextList({
  title,
  items,
  icon: Icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: typeof ListChecks;
  tone?: 'info';
}) {
  if (!items.length) return null;
  return (
    <section
      className={`problem-review__section${tone ? ` problem-review__section--${tone}` : ''}`}
    >
      <h3>
        <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
        {title}
      </h3>
      <ul>
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </section>
  );
}

function UnsupportedView() {
  const t = useT();
  const unsupported = useAnalyzeStore((s) => s.unsupported);
  return (
    <>
      <div className="dialog__body problem-review">
        <p>{t('analyze.unsupportedBody')}</p>
        {unsupported?.reason && (
          <p className="muted">{t('analyze.reason', { reason: unsupported.reason })}</p>
        )}
        {unsupported && unsupported.parts.length > 0 && (
          <ul>
            {unsupported.parts.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>
      <footer className="dialog__footer">
        <button type="button" className="btn" onClick={closeAnalyze}>
          {t('analyze.close')}
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => {
            void openManual();
          }}
        >
          <PencilRuler size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('analyze.manual')}
        </button>
      </footer>
    </>
  );
}

const HINTED: readonly AnalyzeErrorCode[] = [
  'timeout',
  'network',
  'missingKey',
  'invalidJson',
  'noModel',
];

function ErrorView() {
  const t = useT();
  const error = useAnalyzeStore((s) => s.error);
  const problemText = useWorkspaceStore((s) => s.problemText);
  const setSettingsOpen = useWorkspaceStore((s) => s.setSettingsOpen);
  if (!error) return null;
  const code = error.code;
  const hintKey = HINTED.includes(code)
    ? (`analyze.hint.${code as 'timeout' | 'network' | 'missingKey' | 'invalidJson' | 'noModel'}` as const)
    : ('analyze.hint.other' as const);
  const settingsFix =
    code === 'network' ||
    code === 'missingKey' ||
    code === 'timeout' ||
    code === 'unavailable' ||
    code === 'http';
  return (
    <>
      <div className="dialog__body problem-review">
        <p className="problem-review__error" role="alert">
          <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
          {t(`analyze.error.${code}`, { detail: error.detail, max: MAX_PROBLEM_CHARS })}
        </p>
        <p className="muted">{t(hintKey)}</p>
      </div>
      <footer className="dialog__footer">
        {settingsFix && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              closeAnalyze();
              setSettingsOpen(true);
            }}
          >
            <Settings size={15} strokeWidth={1.75} aria-hidden="true" />
            {t('analyze.openSettings')}
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => {
            void openManual();
          }}
        >
          <PencilRuler size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('analyze.manual')}
        </button>
        {code !== 'empty' && code !== 'tooLong' && (
          <button
            type="button"
            className="btn btn--accent"
            onClick={() => {
              void analyze(problemText);
            }}
          >
            <RefreshCw size={15} strokeWidth={1.75} aria-hidden="true" />
            {t('analyze.retry')}
          </button>
        )}
      </footer>
    </>
  );
}
