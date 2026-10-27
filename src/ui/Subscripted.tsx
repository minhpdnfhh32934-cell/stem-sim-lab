import { Fragment } from 'react';
import { splitSubscripts } from './subscripts';

/**
 * Scientific labels write subscripts without a Unicode form as "W_đ", "v_y" or "F_{ms}"; on
 * screen they become real subscripts instead of a raw underscore.
 */
export function Subscripted({ text }: { text: string }) {
  return (
    <>
      {splitSubscripts(text).map((p, i) =>
        p.sub ? <sub key={i}>{p.text}</sub> : <Fragment key={i}>{p.text}</Fragment>,
      )}
    </>
  );
}
