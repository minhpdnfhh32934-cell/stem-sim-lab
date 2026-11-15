import { ArrowDown, ArrowUp, CircleCheck, CircleX } from 'lucide-react';
import { useId, useMemo } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { Segmented } from '@/biology/ui';
import { cx } from '@/ui/cx';
import { IconButton } from '@/ui/IconButton';
import {
  optionOrder,
  orderAnswers,
  orderOf,
  rowLabel,
  rowWhy,
  scoreActivity,
  valueText,
  type Answers,
  type RowResult,
} from './check';
import type { GuidedActivity as Activity } from './schema';

/** One checked row: right or wrong as an icon and a word (never colour alone), then the reason. */
export function RowOutcome({ activity, result }: { activity: Activity; result: RowResult }) {
  const t = useT();
  const L = useLocalized();
  const why = rowWhy(activity, result.id);
  return (
    <div className={cx('guided-outcome', result.correct ? 'is-right' : 'is-wrong')}>
      <strong className="guided-outcome__mark">
        {result.correct ? (
          <CircleCheck size={16} aria-hidden="true" />
        ) : (
          <CircleX size={16} aria-hidden="true" />
        )}
        {result.correct
          ? t('studio.guided.right')
          : t('studio.guided.wrong', { expected: L(valueText(activity, result.expected)) })}
      </strong>
      {why && <span className="guided-outcome__why">{L(why)}</span>}
    </div>
  );
}

interface Props {
  scenarioId: string;
  n: number;
  activity: Activity;
  answers: Answers;
  /** The sheet was checked: rows show their outcome. */
  checked: boolean;
  onChange: (answers: Answers) => void;
}

/** One activity of a guided lesson: put in order, match, or sort; one reusable view for all three. */
export function GuidedActivity({ scenarioId, n, activity: a, answers, checked, onChange }: Props) {
  const t = useT();
  const L = useLocalized();
  const titleId = useId();
  const score = scoreActivity(a, answers);
  const result = (id: string) => score.rows.find((r) => r.id === id);
  const options = useMemo(
    () => (a.kind === 'match' ? optionOrder(scenarioId, a) : []),
    [a, scenarioId],
  );

  const outcome = (id: string) => {
    const r = result(id);
    return checked && r ? <RowOutcome activity={a} result={r} /> : null;
  };
  const rowClass = (id: string) =>
    cx('guided-row', checked && (result(id)?.correct ? 'is-right' : 'is-wrong'));

  let rows;
  if (a.kind === 'order') {
    const order = orderOf(answers);
    const move = (from: number, to: number) => {
      const next = [...order];
      const [item] = next.splice(from, 1);
      if (item === undefined) return;
      next.splice(to, 0, item);
      onChange(orderAnswers(next));
    };
    rows = (
      <ol className="guided-rows">
        {order.map((id, i) => {
          const text = L(rowLabel(a, id));
          return (
            <li key={id} className={rowClass(id)} data-row={id}>
              <div className="guided-row__main">
                <span className="guided-row__n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="guided-row__text">{text}</span>
                <span className="guided-row__tools">
                  <IconButton
                    icon={ArrowUp}
                    label={t('studio.guided.up', { item: text })}
                    size="lg"
                    disabled={i === 0}
                    onClick={() => {
                      move(i, i - 1);
                    }}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label={t('studio.guided.down', { item: text })}
                    size="lg"
                    disabled={i === order.length - 1}
                    onClick={() => {
                      move(i, i + 1);
                    }}
                  />
                </span>
              </div>
              {outcome(id)}
            </li>
          );
        })}
      </ol>
    );
  } else if (a.kind === 'match') {
    rows = (
      <ul className="guided-rows">
        {a.pairs.map((p) => {
          const selectId = `${titleId}-${p.id}`;
          return (
            <li key={p.id} className={rowClass(p.id)} data-row={p.id}>
              <label htmlFor={selectId} className="guided-row__text">
                {L(p.left)}
              </label>
              <select
                id={selectId}
                className="guided-select"
                value={answers[p.id] ?? ''}
                onChange={(e) => {
                  onChange({ ...answers, [p.id]: e.target.value });
                }}
              >
                <option value="" disabled>
                  {t('studio.guided.choose')}
                </option>
                {options.map((id) => (
                  <option key={id} value={id}>
                    {L(valueText(a, id))}
                  </option>
                ))}
              </select>
              {outcome(p.id)}
            </li>
          );
        })}
      </ul>
    );
  } else {
    const groups = a.groups.map((g) => ({ id: g.id, label: g.label }));
    rows = (
      <ul className="guided-rows">
        {a.items.map((item) => (
          <li key={item.id} className={rowClass(item.id)} data-row={item.id}>
            <span className="guided-row__text">{L(item.text)}</span>
            <Segmented
              label={item.text}
              value={answers[item.id] ?? ''}
              options={groups}
              onChange={(group) => {
                onChange({ ...answers, [item.id]: group });
              }}
            />
            {outcome(item.id)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="guided-activity" aria-labelledby={titleId} data-activity={a.id}>
      <h4 id={titleId}>
        <span className="guided-activity__n">{t('studio.guided.activity', { n })}</span>{' '}
        {L(a.prompt)}
      </h4>
      <p className="muted small">{t(`studio.guided.help.${a.kind}`)}</p>
      {rows}
      {checked && (
        <p className="guided-score" role="status">
          {t('studio.guided.score', { correct: score.correct, total: score.total })}
        </p>
      )}
    </section>
  );
}
