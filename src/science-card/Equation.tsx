import { useEffect, useState } from 'react';
import { loadKatex } from './katex';

interface EquationProps {
  tex: string;
  display?: boolean;
}

/** Renders a KaTeX formula; shows the TeX source until KaTeX has loaded. */
export function Equation({ tex, display = true }: EquationProps) {
  const [html, setHtml] = useState<string | null>(null);

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

  if (html === null) {
    return <code className="equation equation--raw">{tex}</code>;
  }
  return (
    <span
      className={display ? 'equation equation--display' : 'equation'}
      // KaTeX output is generated from our own trusted formula strings.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
