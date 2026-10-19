import { useEffect, useRef, useState } from 'react';
import { fitScale } from './fitScale';
import { loadKatex } from './katex';

interface EquationProps {
  tex: string;
  display?: boolean;
}

/**
 * Renders a KaTeX formula; shows the TeX source until KaTeX has loaded. A display equation wider
 * than its box (the narrow Inspector) is drawn smaller to fit instead of scrolling sideways.
 */
export function Equation({ tex, display = true }: EquationProps) {
  const [html, setHtml] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let alive = true;
    void loadKatex().then((k) => {
      if (!alive) return;
      try {
        setHtml(
          k.default.renderToString(tex, {
            displayMode: display,
            throwOnError: true,
            output: 'html',
            // Vietnamese letters inside \text{…} (e.g. "số va chạm") have no KaTeX font
            // metrics; the browser draws them with the UI font, which is what we want.
            strict: (code: string) => (code === 'unknownSymbol' ? 'ignore' : 'warn'),
          }),
        );
      } catch (e) {
        console.error('KaTeX error in', tex, e);
        setHtml(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [tex, display]);

  // Fit the rendered equation to its box, now and whenever the box changes width.
  useEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!display || html === null || !el || !box) return;
    const fit = () => {
      el.style.fontSize = '';
      const style = getComputedStyle(box);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const s = fitScale(
        box.clientWidth - (Number.isFinite(padding) ? padding : 0),
        el.scrollWidth,
      );
      if (s < 1) el.style.fontSize = `${String(s)}em`;
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => {
      ro.disconnect();
    };
  }, [html, display]);

  if (html === null) {
    return <code className="equation equation--raw">{tex}</code>;
  }
  return (
    <span
      ref={ref}
      className={display ? 'equation equation--display' : 'equation'}
      // KaTeX output is generated from our own trusted formula strings.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
