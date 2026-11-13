import { decimalComma, isFraction, layoutFormula, type Item } from '../../core/formula';
import type { Language } from '../../core/i18n';

/**
 * Text with formulas as a teacher writes them, as DOM nodes (`core/formula.ts`): subscripts in
 * `<sub>`, exponents in `<sup>`, fractions stacked (`.frac`), 0,5 in Vietnamese. `shown`: the
 * source characters written so far (a line written out letter by letter); Infinity: all. For the
 * teacher's dialogue, the Explain view and the test paper.
 */
export function formulaNodes(text: string, language: Language, shown = Infinity): Node[] {
  return nodes(layoutFormula(language === 'vi' ? decimalComma(text) : text), shown);
}

/** Fills `element` with `text` written as formulas (replacing what it held). */
export function showFormula(element: HTMLElement, text: string, language: Language): void {
  element.replaceChildren(...formulaNodes(text, language));
}

function nodes(items: readonly Item[], shown: number): Node[] {
  const out: Node[] = [];
  for (const item of items) {
    if (isFraction(item)) {
      if (shown <= item.from) break;
      const frac = document.createElement('span');
      frac.className = 'frac';
      const num = document.createElement('span');
      num.className = 'frac-num';
      num.append(...nodes(item.num, shown));
      const den = document.createElement('span');
      den.className = 'frac-den';
      den.append(...nodes(item.den, shown));
      frac.append(num, den);
      out.push(frac);
      continue;
    }
    const count = Math.max(0, Math.min(item.text.length, shown - item.from));
    if (count === 0) break;
    const text = document.createTextNode(item.text.slice(0, count));
    if (item.level === 'base') out.push(text);
    else {
      const mark = document.createElement(item.level === 'sub' ? 'sub' : 'sup');
      mark.append(text);
      out.push(mark);
    }
  }
  return out;
}
