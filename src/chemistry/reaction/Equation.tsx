import { formatFormula } from '../formula';
import type { Reaction } from '../data/reactions';

/** "2H₂ + O₂ → 2H₂O" with typographic formulas. */
export function EquationText({
  r,
  className,
}: {
  r: Pick<Reaction, 'reactants' | 'products' | 'reversible'>;
  className?: string;
}) {
  const side = (terms: Reaction['reactants']) =>
    terms.map((t, i) => (
      <span key={i}>
        {i > 0 && <span className="rx-eq__plus"> + </span>}
        {t.coef > 1 && <span className="rx-eq__coef">{t.coef}</span>}
        <span className="rx-eq__formula">{formatFormula(t.formula)}</span>
      </span>
    ));
  return (
    <p className={`rx-eq ${className ?? ''}`}>
      {side(r.reactants)}
      <span className="rx-eq__arrow">{r.reversible ? ' ⇌ ' : ' → '}</span>
      {side(r.products)}
    </p>
  );
}
