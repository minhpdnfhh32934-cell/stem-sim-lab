import { formatFormula } from '../formula';
import { signed } from './oxidation';

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (digits: string) => digits.replace(/\d/g, (d) => SUB[Number(d)] ?? d);

/**
 * A formula with each element's oxidation number written above its symbol, as the book does
 * (SGK tr. 71–74). `values` undefined: the rules did not decide, a "?" is written instead.
 */
export function OxFormula({
  formula,
  values,
  coef,
}: {
  formula: string;
  values: ReadonlyMap<string, number> | undefined;
  coef?: number;
}) {
  const body = formula.replace(/\^.*$/, '');
  const charge = formatFormula(formula).slice(formatFormula(body).length);
  const tokens = [...body.matchAll(/([A-Z][a-z]?)|(\d+)|([^A-Za-z\d])/g)];
  // Elements in the order the formula writes them ("Fe₂O₃: Fe +3, O −2").
  const order = [...new Set(tokens.flatMap((m) => (m[1] ? [m[1]] : [])))];
  const label = values
    ? `${formatFormula(formula)}: ${order.map((el) => `${el} ${signed(values.get(el) ?? 0)}`).join(', ')}`
    : formatFormula(formula);
  return (
    <span className="ox-formula" role="group" aria-label={label}>
      {coef !== undefined && coef > 1 && <span className="rx-eq__coef">{coef}</span>}
      {tokens.map((m, i) => {
        const [text, el, digits] = m;
        if (el) {
          const v = values?.get(el);
          return (
            <span key={i} className="ox-atom">
              <span className="ox-atom__n" aria-hidden="true">
                {v === undefined ? '?' : signed(v)}
              </span>
              <span aria-hidden="true">{el}</span>
            </span>
          );
        }
        return (
          <span key={i} className="ox-formula__rest" aria-hidden="true">
            {digits ? sub(digits) : text}
          </span>
        );
      })}
      {charge && (
        <span className="ox-formula__rest" aria-hidden="true">
          {charge}
        </span>
      )}
    </span>
  );
}
