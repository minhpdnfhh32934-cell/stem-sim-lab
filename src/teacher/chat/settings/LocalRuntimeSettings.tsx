import { isTauri } from '@tauri-apps/api/core';
import {
  Activity,
  CircleAlert,
  CircleCheck,
  LifeBuoy,
  LoaderCircle,
  PlugZap,
  Plus,
  RotateCcw,
  Search,
  ServerCog,
  ShieldAlert,
  Trash2,
  Unplug,
} from 'lucide-react';
import { useState, type SyntheticEvent, type ReactNode } from 'react';
import { formatNumber, useT, type Locale, type MessageKey, type TFunction } from '@/app/i18n';
import { PROVIDER_NAME } from '@/app/ai/aiStatusView';
import { analysisEngine, useAnalysisEngine, type AnalysisEngine } from '@/app/ai/engineChoice';
import {
  localFailure,
  localFailureText,
  localModelLabel,
  runtimeName,
} from '@/app/ai/localRuntime';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useAiStore, type ProviderChoice } from '@/ai/aiStore';
import { aiErrorKind } from '@/ai/errorKind';
import { getLocalClient } from '@/ai/local/client';
import { DEFAULTS, loopbackV4 } from '@/ai/local/endpoint';
import { checkFor, checkKey, useLocalAiStore, type ModelCheck } from '@/ai/local/localAiStore';
import { adapter, detailsFromListing } from '@/ai/local/runtimes';
import {
  CAPABILITY_NAMES,
  UNVERIFIED,
  type Cap,
  type Capabilities,
  type LocalModel,
  type LocalTest,
  type ProbeStatus,
  type RuntimeKind,
  type RuntimeProbe,
} from '@/ai/local/types';
import { cx } from '@/ui/cx';
import { useChatStore } from '../chatStore';
import { MIN_LOCAL_CONTEXT } from '../memory';
import '../chat.css';
import './localRuntime.css';

/** A model of a runtime at an address. */
interface Target {
  kind: RuntimeKind;
  baseUrl: string;
  model: string;
}

/** "Kiểm tra kết nối" / "Kiểm tra trả lời" of one model (this session only). */
type Step =
  | { phase: 'running' }
  | { phase: 'done'; ok: boolean; text: string; at: number; incompatible?: boolean };

/** Longest runtime message shown after a failed "Kiểm tra trả lời". */
const MAX_DETAIL = 160;

const keyOf = (x: Target) => checkKey(x.kind, x.baseUrl, x.model);
/** What was saved about a model on this computer, if anything. */
const checkOf = (checks: Record<string, ModelCheck>, x: Target): ModelCheck | null =>
  checks[keyOf(x)] ?? null;
const sameTarget = (a: Target | null, b: Target | null) =>
  a !== null && b !== null && keyOf(a) === keyOf(b);

/** "127.0.0.1:11434" of an address. */
const hostPort = (base: string) => base.replace(/^http:\/\//, '');

/** File sizes in the learner's number format ("4,7 GB"). */
function bytesText(locale: Locale, n: number): string {
  if (n >= 1e9) return `${formatNumber(locale, n / 1e9, { maximumFractionDigits: 1 })} GB`;
  if (n >= 1e6) return `${formatNumber(locale, n / 1e6, { maximumFractionDigits: 0 })} MB`;
  return `${formatNumber(locale, Math.max(1, Math.round(n / 1e3)))} KB`;
}

function timeText(locale: Locale, at: number): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(at);
}

function capText(t: TFunction, cap: Cap): string {
  return cap === 'yes'
    ? t('localRuntime.yes')
    : cap === 'no'
      ? t('localRuntime.no')
      : t('localRuntime.unverified');
}

/**
 * What was seen on this computer about a model: its saved check first, then what its runtime's
 * list said. Documentation (`declared`) never counts here.
 */
function seenCapabilities(
  kind: RuntimeKind,
  check: ModelCheck | null,
  listed: LocalModel | null,
): Capabilities {
  const fromList = listed
    ? detailsFromListing(listed, adapter(kind).declared).capabilities
    : UNVERIFIED;
  const fromCheck = check?.capabilities ?? UNVERIFIED;
  return Object.fromEntries(
    CAPABILITY_NAMES.map((n) => [n, fromCheck[n] !== 'unverified' ? fromCheck[n] : fromList[n]]),
  ) as unknown as Capabilities;
}

/** Why a model cannot be used for AI Teacher, or null. */
function incompatibleReason(
  t: TFunction,
  locale: Locale,
  remote: boolean,
  context: number | null,
  testFailed: boolean,
): string | null {
  if (remote) return t('localRuntime.reasons.remote');
  if (context !== null && context < MIN_LOCAL_CONTEXT)
    return t('localRuntime.reasons.smallContext', { context: formatNumber(locale, context) });
  if (testFailed) return t('localRuntime.reasons.testFailed');
  return null;
}

/** The sentence for a runtime that did not answer as asked (its detection status). */
function probeProblem(status: ProbeStatus): MessageKey {
  switch (status) {
    case 'unreachable':
      return 'chat.errors.localDown';
    case 'loading':
      return 'chat.errors.localLoading';
    case 'needsAuth':
      return 'chat.errors.localAuth';
    default:
      return 'chat.errors.localNotRuntime';
  }
}

/**
 * Basic mode keeps technical parts folded behind one line (one main action per screen); Advanced
 * shows them directly, under `heading` when there is one.
 */
function More({
  summary,
  heading,
  children,
}: {
  summary: string;
  heading?: string;
  children: ReactNode;
}) {
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  if (advanced) {
    return (
      <>
        {heading && <h4 className="local-rt__subtitle">{heading}</h4>}
        {children}
      </>
    );
  }
  return (
    <details className="local-rt__more">
      <summary>{summary}</summary>
      {children}
    </details>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: 'neutral' | 'ok' | 'info' | 'warn' | 'bad';
  children: ReactNode;
}) {
  return <li className={cx('local-rt__badge', `local-rt__badge--${tone}`)}>{children}</li>;
}

/**
 * Settings → "AI trên máy khác": AI programs the learner runs on this computer (Ollama, LM Studio,
 * llama.cpp's llama-server, another OpenAI-compatible server). Nothing here runs on its own: no
 * runtime is asked when the page opens (a saved choice is shown as saved), "Tìm trên máy này"
 * asks only the three usual addresses and the ones the learner added, and "Kiểm tra trả lời" —
 * the only button that makes a model generate — is one request per click.
 */
export function LocalRuntimeSettings() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const selected = useLocalAiStore((s) => s.selected);
  const checks = useLocalAiStore((s) => s.checks);
  const status = useLocalAiStore((s) => s.status);
  // The last detection and its model lists last for the session: reopening Settings shows them
  // again, with the time they were seen.
  const detectedAt = useLocalAiStore((s) => s.detectedAt);
  const lists = useLocalAiStore((s) => s.lists);
  const userEndpoints = useLocalAiStore((s) => s.userEndpoints);
  const engine = useChatStore((s) => s.engine);
  const provider = useAiStore((s) => s.provider);
  const noKey = useAiStore((s) => s.status === 'noKey');
  // The engine that really answers while the local runtime is not in use: a pre-selected Gemma
  // without its model is the API. Every sentence below names this one, never only the setting.
  const effective = useAnalysisEngine();
  const [focus, setFocus] = useState<Target | null>(null);
  const [connection, setConnection] = useState<Record<string, Step>>({});
  const [tests, setTests] = useState<Record<string, Step>>({});
  /** Asked this session (a restored choice is not, until a button is pressed). */
  const [asked, setAsked] = useState(false);
  const [note, setNote] = useState('');
  const [address, setAddress] = useState('');
  const [addResult, setAddResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const browser = !isTauri();

  /**
   * Where the AI Teacher's questions go now, in one sentence. The provider's plain name (never
   * the menu label with its advice, such as "khuyên dùng"), and nothing "is sent" without a key.
   */
  const nowText = (e: AnalysisEngine, p: ProviderChoice, keyMissing: boolean): string => {
    switch (e) {
      case 'gemma':
        return t('localRuntime.now.gemma');
      case 'gemma-missing':
        return t('localRuntime.now.gemmaMissing');
      case 'local':
        return t('localRuntime.currentLocal');
      case 'local-missing':
        return t('localRuntime.waiting');
      case 'cloud':
        return p === 'off'
          ? t('localRuntime.now.cloudOff')
          : t(keyMissing ? 'localRuntime.now.cloudNoKey' : 'localRuntime.now.cloud', {
              provider: PROVIDER_NAME[p],
            });
    }
  };
  /** The short name of the engine that answers now (badges). */
  const engineShort =
    effective === 'gemma' || effective === 'gemma-missing'
      ? t('chat.gemma')
      : provider === 'off'
        ? t('chat.cloud')
        : `${t('chat.cloud')} · ${PROVIDER_NAME[provider]}`;
  /** "Đang chọn cho AI Teacher" only while it really answers; otherwise who does. */
  const selectedBadge =
    engine === 'local' ? (
      <Badge tone="info">{t('localRuntime.badges.selected')}</Badge>
    ) : (
      <Badge tone="neutral">{t('localRuntime.badges.selectedIdle', { engine: engineShort })}</Badge>
    );
  const usual = DEFAULTS.map((d) => hostPort(loopbackV4(d.port).base)).join(', ');

  const listedModel = (x: Target): LocalModel | null => {
    const l = lists[x.baseUrl];
    return l?.phase === 'done' ? (l.list.models.find((m) => m.id === x.model) ?? null) : null;
  };

  const detect = async () => {
    setNote('');
    setAsked(true);
    const store = useLocalAiStore.getState();
    try {
      await store.detect();
    } catch {
      // The store keeps the error kind; the page says it below.
      return;
    }
    // Lists only what this detection found (nothing after a reset meanwhile).
    await store.loadLists();
  };

  /** Cheap: the runtime says who it is, then what it knows about the model. Nothing generates. */
  const checkConnection = async (x: Target) => {
    const key = keyOf(x);
    setAsked(true);
    setConnection((c) => ({ ...c, [key]: { phase: 'running' } }));
    let step: Step;
    try {
      const client = getLocalClient();
      const probe = await client.probe(x.baseUrl);
      if (probe.status !== 'found' || probe.kind !== x.kind) {
        step = {
          phase: 'done',
          ok: false,
          text: t(probeProblem(probe.status === 'found' ? 'notRuntime' : probe.status), {
            name: runtimeName(locale, x.kind),
          }),
          at: Date.now(),
        };
      } else {
        const details = await client.modelInfo(x.kind, x.baseUrl, x.model);
        useLocalAiStore.getState().recordCheck(x.kind, x.baseUrl, details);
        step = details.remote
          ? {
              phase: 'done',
              ok: false,
              text: t('chat.errors.localRemote'),
              at: Date.now(),
              incompatible: true,
            }
          : {
              phase: 'done',
              ok: true,
              text: t('localRuntime.connectionOk', { time: timeText(locale, Date.now()) }),
              at: Date.now(),
            };
      }
    } catch (e) {
      step = {
        phase: 'done',
        ok: false,
        text: localFailureText(locale, localFailure(e), x.kind),
        at: Date.now(),
      };
    }
    setConnection((c) => ({ ...c, [key]: step }));
  };

  /** One tiny generation: it loads the model. One click, one request, never retried. */
  const testAnswer = async (x: Target) => {
    const key = keyOf(x);
    setAsked(true);
    setTests((s) => ({ ...s, [key]: { phase: 'running' } }));
    let result: LocalTest;
    try {
      result = await getLocalClient().test(x.kind, x.baseUrl, x.model);
    } catch (e) {
      // The client answers every runtime failure as a result; this is the app or the gate.
      const kind = aiErrorKind(e);
      setTests((s) => ({
        ...s,
        [key]: {
          phase: 'done',
          ok: false,
          text:
            kind === 'notAllowed'
              ? t('localRuntime.test.notAllowed')
              : localFailureText(locale, localFailure(e), x.kind),
          at: Date.now(),
        },
      }));
      return;
    }
    const at = Date.now();
    if (result.status === 'ok')
      useLocalAiStore.getState().recordTest(x.kind, x.baseUrl, x.model, result, at);
    const text =
      result.status === 'ok'
        ? result.firstPieceMs !== null
          ? t('localRuntime.test.ok', {
              seconds: formatNumber(locale, result.firstPieceMs / 1000, {
                maximumFractionDigits: 1,
              }),
            })
          : t('localRuntime.test.okNoTime')
        : t(`localRuntime.test.${result.status}`, {
            // The runtime's own words, short (untrusted text, shown as text).
            detail: Array.from(result.detail).slice(0, MAX_DETAIL).join(''),
          });
    setTests((s) => ({
      ...s,
      [key]: {
        phase: 'done',
        ok: result.status === 'ok',
        text,
        at,
        incompatible: ['modelMissing', 'remoteModel', 'notRuntime'].includes(result.status),
      },
    }));
  };

  const chooseForTeacher = (x: Target) => {
    const store = useLocalAiStore.getState();
    const listed = listedModel(x);
    // What the list showed (context, pictures) counts as seen when nothing was checked yet.
    if (listed && !checkOf(store.checks, x)) {
      store.recordCheck(x.kind, x.baseUrl, detailsFromListing(listed, adapter(x.kind).declared));
    }
    store.select({ ...x, label: localModelLabel(locale, x.kind, x.model) });
    useChatStore.getState().setEngine('local');
    setNote('');
  };

  const unselect = async () => {
    useLocalAiStore.getState().select(null);
    useChatStore.getState().leaveLocal();
    setFocus(null);
    setNote('');
    // Read after the change: the engine that answers now, not only the one set (a pre-selected
    // Gemma without its model sends the questions to the API, and the learner is told so).
    const now = await analysisEngine();
    const ai = useAiStore.getState();
    setNote(
      t('localRuntime.unselected', { now: nowText(now, ai.provider, ai.status === 'noKey') }),
    );
  };

  const addAddress = (e: SyntheticEvent) => {
    e.preventDefault();
    try {
      const base = useLocalAiStore.getState().addEndpoint(address);
      setAddResult({ ok: true, text: t('localRuntime.added', { address: base }) });
      setAddress('');
    } catch {
      // Off this computer (or not an address): refused here, nothing is asked.
      setAddResult({ ok: false, text: t('localRuntime.addRefused') });
    }
  };

  const reset = () => {
    // Also forgets the detection and its model lists (answers still on their way are dropped).
    useLocalAiStore.getState().reset();
    setFocus(null);
    setConnection({});
    setTests({});
    setAddResult(null);
    setConfirmReset(false);
    setNote(
      useChatStore.getState().engine === 'local'
        ? `${t('localRuntime.resetDone')} ${t('localRuntime.resetEngineNote')}`
        : t('localRuntime.resetDone'),
    );
  };

  const shown: Target | null = focus ?? selected;
  const detecting = status.phase === 'detecting';
  const detectError =
    status.phase === 'error'
      ? status.error === 'notAllowed'
        ? t('localRuntime.notAllowed')
        : status.error === 'needsAppUpdate'
          ? t('localRuntime.needsUpdate')
          : t('localRuntime.detectFailed')
      : null;
  const anyRunning = status.probes.some((p) => p.status !== 'unreachable');

  /**
   * Why the chosen model cannot be used, as the last detection saw it (this session), or null
   * when it saw nothing wrong or did not ask that address. Its model list must be complete to say
   * a model is missing.
   */
  const selectedProblem = ((): string | null => {
    if (!selected || status.phase !== 'done') return null;
    const probe = status.probes.find((p) => p.baseUrl === selected.baseUrl);
    if (!probe) return null;
    const name = runtimeName(locale, selected.kind);
    if (probe.status !== 'found') return t(probeProblem(probe.status), { name });
    if (probe.kind !== selected.kind) return t('chat.errors.localNotRuntime', { name });
    const list = lists[selected.baseUrl];
    if (list?.phase !== 'done') return null;
    const listed = list.list.models.find((m) => m.id === selected.model);
    if (!listed) return list.list.more ? null : t('chat.errors.localModelMissing', { name });
    return listed.remote ? t('chat.errors.localRemote') : null;
  })();

  const modelRow = (probe: RuntimeProbe, kind: RuntimeKind, m: LocalModel) => {
    const x: Target = { kind, baseUrl: probe.baseUrl, model: m.id };
    const check = checkOf(checks, x);
    const context = check?.contextLength ?? m.contextLength;
    const test = tests[keyOf(x)];
    const conn = connection[keyOf(x)];
    const reason = incompatibleReason(
      t,
      locale,
      m.remote,
      context,
      (test?.phase === 'done' && test.incompatible === true) ||
        (conn?.phase === 'done' && conn.incompatible === true),
    );
    const isSelected = sameTarget(selected, x);
    const vision = seenCapabilities(kind, check, m).vision;
    const facts = [
      m.sizeBytes !== null ? bytesText(locale, m.sizeBytes) : null,
      context !== null
        ? t('localRuntime.facts.context', {
            value: t('localRuntime.contextUnit', { count: formatNumber(locale, context) }),
          })
        : null,
      t('localRuntime.facts.vision', { value: capText(t, vision) }),
      m.parameterSize,
    ].filter((f): f is string => f !== null && f !== '');
    return (
      <article
        key={m.id}
        className={cx(
          'chat-settings__model',
          'local-rt__model',
          sameTarget(shown, x) && 'is-selected',
        )}
      >
        <label className="chat-settings__model-choice">
          <input
            type="radio"
            name="local-model"
            checked={sameTarget(shown, x)}
            disabled={m.remote}
            onChange={() => {
              setFocus(x);
            }}
          />
          <span className="chat-settings__model-copy">
            <strong>{m.id}</strong>
            <small>{facts.join(' · ')}</small>
          </span>
        </label>
        <ul className="local-rt__badges">
          <Badge tone="neutral">{t('localRuntime.badges.listed')}</Badge>
          {m.loaded === true && <Badge tone="info">{t('localRuntime.badges.loaded')}</Badge>}
          {m.loaded === false && <Badge tone="neutral">{t('localRuntime.badges.notLoaded')}</Badge>}
          {isSelected && selectedBadge}
          {check?.testedAt !== undefined && (
            <Badge tone="ok">
              {t('localRuntime.badges.tested', { time: timeText(locale, check.testedAt) })}
            </Badge>
          )}
          {reason !== null && (
            <Badge tone="bad">{t('localRuntime.badges.incompatible', { reason })}</Badge>
          )}
        </ul>
      </article>
    );
  };

  const probeRow = (probe: RuntimeProbe) => {
    const kind = probe.kind ?? probe.expected;
    const name = kind ? runtimeName(locale, kind) : t('localRuntime.unknownKind');
    const list = lists[probe.baseUrl];
    const chip =
      probe.status === 'found'
        ? probe.version
          ? t('localRuntime.status.foundVersion', { version: probe.version })
          : t('localRuntime.status.found')
        : t(`localRuntime.status.${probe.status}`);
    const identified = probe.kind !== null && probe.status !== 'notRuntime';
    const tone =
      probe.status === 'found' ? 'ok' : probe.status === 'unreachable' ? 'neutral' : 'warn';
    return (
      <li key={probe.baseUrl} className="local-rt__runtime">
        <div className="local-rt__runtime-head">
          <strong>{name}</strong>
          <code>{hostPort(probe.baseUrl)}</code>
          <ul className="local-rt__badges">
            {identified && <Badge tone="info">{t('localRuntime.badges.detected')}</Badge>}
            <Badge tone={tone}>{chip}</Badge>
          </ul>
        </div>
        {probe.status !== 'found' && (
          <p className="muted small">{t(`localRuntime.statusHint.${probe.status}`)}</p>
        )}
        {probe.status === 'found' && probe.kind !== null && (
          <div className="local-rt__models">
            <h4>{t('localRuntime.modelsTitle', { name })}</h4>
            {list?.phase === 'loading' && (
              <p className="muted small" role="status">
                <LoaderCircle size={14} className="spin" aria-hidden="true" />{' '}
                {t('localRuntime.modelsLoading')}
              </p>
            )}
            {list?.phase === 'error' && (
              <p className="chat-settings__error" role="alert">
                <CircleAlert size={15} aria-hidden="true" />
                {t('localRuntime.modelsFailed', {
                  reason: localFailureText(locale, localFailure(list.error), probe.kind),
                })}
              </p>
            )}
            {list === undefined && <p className="muted small">{t('localRuntime.modelsAgain')}</p>}
            {list?.phase === 'done' && list.list.models.length === 0 && (
              <p className="muted small">{t('localRuntime.modelsEmpty')}</p>
            )}
            {list?.phase === 'done' && list.list.models.length > 0 && (
              <div
                className="chat-settings__models"
                role="radiogroup"
                aria-label={t('localRuntime.modelsTitle', { name })}
              >
                {list.list.models.map((m) => modelRow(probe, probe.kind as RuntimeKind, m))}
              </div>
            )}
            {list?.phase === 'done' && list.list.more && (
              <p className="muted small">
                {t('localRuntime.modelsMore', { count: list.list.models.length })}
              </p>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      {(selected !== null || engine === 'local') && (
        <fieldset className="settings-group">
          <legend>
            <PlugZap size={15} aria-hidden="true" />
            {engine === 'local' ? t('localRuntime.currentTitle') : t('localRuntime.savedTitle')}
          </legend>
          {selected ? (
            <>
              <p>
                <strong>
                  {t('localRuntime.currentBody', {
                    label: selected.label,
                    address: hostPort(selected.baseUrl),
                  })}
                </strong>
              </p>
              <ul className="local-rt__badges">
                {selectedBadge}
                {selectedProblem !== null && (
                  <Badge tone="bad">{t('localRuntime.badges.unavailable')}</Badge>
                )}
                {checkFor({ checks }, selected)?.testedAt !== undefined ? (
                  <Badge tone="ok">
                    {t('localRuntime.badges.tested', {
                      time: timeText(locale, checkFor({ checks }, selected)?.testedAt ?? 0),
                    })}
                  </Badge>
                ) : (
                  <Badge tone="neutral">{t('localRuntime.neverTested')}</Badge>
                )}
              </ul>
              <p className="muted small">
                {engine !== 'local'
                  ? t('localRuntime.currentOther', { now: nowText(effective, provider, noKey) })
                  : selectedProblem !== null
                    ? t('localRuntime.currentLocalUnavailable')
                    : t('localRuntime.currentLocal')}
              </p>
              {selectedProblem !== null && (
                <p className="chat-settings__error" role="alert">
                  <CircleAlert size={15} aria-hidden="true" />
                  {selectedProblem}
                </p>
              )}
              {!asked && status.phase === 'idle' && (
                <p className="muted small">{t('localRuntime.restoredNote')}</p>
              )}
            </>
          ) : (
            <p className="muted small" role="status">
              {t('localRuntime.waiting')}
            </p>
          )}
          <div className="settings-actions">
            {selected && engine !== 'local' && (
              <button
                type="button"
                className="btn btn--accent"
                onClick={() => {
                  useChatStore.getState().setEngine('local');
                }}
              >
                <PlugZap size={14} aria-hidden="true" />
                {t('localRuntime.useForTeacher')}
              </button>
            )}
            <button type="button" className="btn" onClick={() => void unselect()}>
              <Unplug size={14} aria-hidden="true" />
              {t('localRuntime.unselect')}
            </button>
          </div>
        </fieldset>
      )}
      {note && (
        <p className="chat-settings__success" role="status">
          <CircleCheck size={15} aria-hidden="true" />
          {note}
        </p>
      )}

      <fieldset className="settings-group">
        <legend>
          <Search size={15} aria-hidden="true" />
          {t('localRuntime.detectTitle')}
        </legend>
        <p className="muted small">{t('localRuntime.intro')}</p>
        <div className="settings-actions">
          <button
            type="button"
            className="btn btn--accent"
            disabled={detecting}
            onClick={() => void detect()}
          >
            {detecting ? (
              <LoaderCircle size={15} className="spin" aria-hidden="true" />
            ) : (
              <Search size={15} aria-hidden="true" />
            )}
            {detecting ? t('localRuntime.detecting') : t('localRuntime.detect')}
          </button>
        </div>
        <p className="muted small">{t('localRuntime.detectPrivacy', { addresses: usual })}</p>
        <p className="local-rt__fallback small">
          <ShieldAlert size={14} aria-hidden="true" /> {t('localRuntime.fallback')}
        </p>
        {browser && (
          <p className="muted small" role="note">
            {t('localRuntime.corsNote')}
          </p>
        )}
        {detectError && (
          <p className="chat-settings__error" role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {detectError}
          </p>
        )}
        {status.phase === 'done' && (
          <>
            {detectedAt !== null && (
              <p className="muted small" role="note">
                {t('localRuntime.detectedAt', { time: timeText(locale, detectedAt) })}
                {/* A result from before this page was opened may be out of date. */}
                {!asked && ` ${t('localRuntime.detectedEarlier')}`}
              </p>
            )}
            <ul className="local-rt__runtimes">{status.probes.map(probeRow)}</ul>
            {!anyRunning && <p className="muted small">{t('localRuntime.noneFound')}</p>}
          </>
        )}
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <Activity size={15} aria-hidden="true" />
          {shown
            ? t('localRuntime.detailsTitle', { model: shown.model })
            : t('localRuntime.chooseModel')}
        </legend>
        {shown ? (
          <ModelDetailsCard
            target={shown}
            listed={listedModel(shown)}
            check={checkOf(checks, shown)}
            connection={connection[keyOf(shown)]}
            test={tests[keyOf(shown)]}
            inUse={engine === 'local' && sameTarget(selected, shown)}
            onCheck={() => void checkConnection(shown)}
            onTest={() => void testAnswer(shown)}
            onUse={() => {
              chooseForTeacher(shown);
            }}
          />
        ) : (
          <p className="muted small">{t('localRuntime.pickHint')}</p>
        )}
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <ServerCog size={15} aria-hidden="true" />
          {t('localRuntime.addTitle')}
        </legend>
        <More summary={t('localRuntime.moreTitle')}>
          <form className="local-rt__add" onSubmit={addAddress}>
            <label>
              <span>{t('localRuntime.addLabel')}</span>
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                }}
              />
            </label>
            <button type="submit" className="btn" disabled={address.trim() === ''}>
              <Plus size={14} aria-hidden="true" />
              {t('localRuntime.add')}
            </button>
          </form>
          {addResult && (
            <p
              className={addResult.ok ? 'chat-settings__success' : 'chat-settings__error'}
              role={addResult.ok ? 'status' : 'alert'}
            >
              {addResult.ok ? (
                <CircleCheck size={15} aria-hidden="true" />
              ) : (
                <CircleAlert size={15} aria-hidden="true" />
              )}
              {addResult.text}
            </p>
          )}
          {userEndpoints.length > 0 && (
            <>
              <p className="muted small">{t('localRuntime.addedList')}</p>
              <ul className="local-rt__addresses">
                {userEndpoints.map((base) => (
                  <li key={base}>
                    <code>{hostPort(base)}</code>
                    <button
                      type="button"
                      className="btn"
                      aria-label={t('localRuntime.remove', { address: hostPort(base) })}
                      onClick={() => {
                        useLocalAiStore.getState().removeEndpoint(base);
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </More>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <LifeBuoy size={15} aria-hidden="true" />
          {t('localRuntime.helpTitle')}
        </legend>
        <ul className="local-rt__help">
          {(['notRunning', 'modelMissing', 'loading', 'needsAuth', 'notAi'] as const).map((k) => (
            <li key={k}>{t(`localRuntime.help.${k}`)}</li>
          ))}
          {browser && <li>{t('localRuntime.help.cors')}</li>}
        </ul>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <ShieldAlert size={15} aria-hidden="true" />
          {t('localRuntime.honestTitle')}
        </legend>
        <ul className="local-rt__help">
          {(['gpu', 'logs', 'internet'] as const).map((k) => (
            <li key={k}>{t(`localRuntime.honest.${k}`)}</li>
          ))}
          <li>{t('localRuntime.fallback')}</li>
        </ul>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <RotateCcw size={15} aria-hidden="true" />
          {t('localRuntime.resetTitle')}
        </legend>
        <p className="muted small">{t('localRuntime.resetBody')}</p>
        <div className="settings-actions">
          {confirmReset ? (
            <>
              <button type="button" className="btn btn--danger" onClick={reset}>
                <Trash2 size={14} aria-hidden="true" />
                {t('localRuntime.resetConfirm')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setConfirmReset(false);
                }}
              >
                {t('localRuntime.resetCancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setConfirmReset(true);
              }}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('localRuntime.reset')}
            </button>
          )}
        </div>
      </fieldset>
    </>
  );
}

/** The model being looked at: what is known about it, the two checks and "Dùng cho AI Teacher". */
function ModelDetailsCard({
  target,
  listed,
  check,
  connection,
  test,
  inUse,
  onCheck,
  onTest,
  onUse,
}: {
  target: Target;
  listed: LocalModel | null;
  check: ModelCheck | null;
  connection: Step | undefined;
  test: Step | undefined;
  inUse: boolean;
  onCheck: () => void;
  onTest: () => void;
  onUse: () => void;
}) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const caps = seenCapabilities(target.kind, check, listed);
  const declared = adapter(target.kind).declared;
  const context = check?.contextLength ?? listed?.contextLength ?? null;
  const remote = listed?.remote === true;
  const reason = incompatibleReason(
    t,
    locale,
    remote,
    context,
    (test?.phase === 'done' && test.incompatible === true) ||
      (connection?.phase === 'done' && connection.incompatible === true),
  );
  const busy = connection?.phase === 'running' || test?.phase === 'running';
  const unverified = t('localRuntime.unverified');
  return (
    <>
      <p className="muted small">
        {runtimeName(locale, target.kind)} · <code>{hostPort(target.baseUrl)}</code>
      </p>
      <h4 className="local-rt__subtitle">{t('localRuntime.resourcesTitle')}</h4>
      <ul className="local-rt__facts">
        <li>
          {t('localRuntime.facts.size', {
            value:
              listed && listed.sizeBytes !== null
                ? bytesText(locale, listed.sizeBytes)
                : unverified,
          })}
        </li>
        <li>
          {t('localRuntime.facts.context', {
            value:
              context !== null
                ? t('localRuntime.contextUnit', { count: formatNumber(locale, context) })
                : unverified,
          })}
        </li>
        <li>{t('localRuntime.facts.memory', { value: t('localRuntime.memoryUnknown') })}</li>
        <li>{t('localRuntime.facts.vision', { value: capText(t, caps.vision) })}</li>
        {listed?.parameterSize && (
          <li>{t('localRuntime.facts.params', { value: listed.parameterSize })}</li>
        )}
        {listed?.quantization && (
          <li>{t('localRuntime.facts.quant', { value: listed.quantization })}</li>
        )}
      </ul>
      {reason !== null && (
        <p className="chat-settings__error" role="note">
          <CircleAlert size={15} aria-hidden="true" />
          {t('localRuntime.badges.incompatible', { reason })}
        </p>
      )}

      <p className="local-rt__warning small">{t('localRuntime.testWarning')}</p>
      <div className="settings-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCheck}>
          {connection?.phase === 'running' ? (
            <LoaderCircle size={14} className="spin" aria-hidden="true" />
          ) : (
            <PlugZap size={14} aria-hidden="true" />
          )}
          {t('localRuntime.checkConnection')}
        </button>
        <button type="button" className="btn" disabled={busy || remote} onClick={onTest}>
          {test?.phase === 'running' ? (
            <LoaderCircle size={14} className="spin" aria-hidden="true" />
          ) : (
            <Activity size={14} aria-hidden="true" />
          )}
          {t('localRuntime.testAnswer')}
        </button>
        <button
          type="button"
          className="btn btn--accent"
          disabled={inUse || reason !== null}
          onClick={onUse}
        >
          <CircleCheck size={14} aria-hidden="true" />
          {t('localRuntime.useForTeacher')}
        </button>
      </div>
      {connection?.phase === 'running' && (
        <p className="muted small" role="status">
          {t('localRuntime.checkingConnection')}
        </p>
      )}
      {connection?.phase === 'done' && (
        <p
          className={connection.ok ? 'chat-settings__success' : 'chat-settings__error'}
          role="status"
        >
          {connection.ok ? (
            <CircleCheck size={15} aria-hidden="true" />
          ) : (
            <CircleAlert size={15} aria-hidden="true" />
          )}
          {connection.text}
        </p>
      )}
      {test?.phase === 'running' && (
        <p className="muted small" role="status">
          {t('localRuntime.testing')}
        </p>
      )}
      {test?.phase === 'done' && (
        <p className={test.ok ? 'chat-settings__success' : 'chat-settings__error'} role="status">
          {test.ok ? (
            <CircleCheck size={15} aria-hidden="true" />
          ) : (
            <CircleAlert size={15} aria-hidden="true" />
          )}
          {test.text}
        </p>
      )}
      <p className="muted small">
        {check?.testedAt !== undefined
          ? t('localRuntime.testedAt', { time: timeText(locale, check.testedAt) })
          : t('localRuntime.neverTested')}
      </p>

      <More summary={t('localRuntime.capsTitle')} heading={t('localRuntime.capsTitle')}>
        <table className="local-rt__caps">
          <caption className="sr-only">{t('localRuntime.capsTitle')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('localRuntime.capsName')}</th>
              <th scope="col">{t('localRuntime.capsSeen')}</th>
              <th scope="col">{t('localRuntime.capsDeclared')}</th>
            </tr>
          </thead>
          <tbody>
            {CAPABILITY_NAMES.map((name) => (
              <tr key={name}>
                <th scope="row">{t(`localRuntime.caps.${name}`)}</th>
                <td data-cap={caps[name]}>{capText(t, caps[name])}</td>
                <td className="muted">
                  {declared[name] === 'yes' && caps[name] !== 'yes'
                    ? t('localRuntime.capsDeclaredYes')
                    : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </More>
    </>
  );
}
