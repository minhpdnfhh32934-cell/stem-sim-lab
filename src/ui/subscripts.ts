/** "W_đ (J)" → [W][đ as subscript][ (J)]; "_{ms}" groups several characters. */
export function splitSubscripts(text: string): { text: string; sub: boolean }[] {
  const parts: { text: string; sub: boolean }[] = [];
  const re = /_(?:\{([^}]*)\}|([\p{L}\p{N}]+))/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), sub: false });
    parts.push({ text: m[1] ?? m[2] ?? '', sub: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), sub: false });
  return parts;
}

/** Same for text a library put into the DOM (e.g. uPlot legend labels). */
export function subscriptElement(el: Element): void {
  const text = el.textContent;
  if (!text.includes('_')) return;
  el.replaceChildren(
    ...splitSubscripts(text).map((p) => {
      if (!p.sub) return document.createTextNode(p.text);
      const s = document.createElement('sub');
      s.textContent = p.text;
      return s;
    }),
  );
}
