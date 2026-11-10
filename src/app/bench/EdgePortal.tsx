import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEdgeSlot } from './edgeSlot';
import { BenchContext } from './shellMode';

/**
 * A module view's player: on the bench it is drawn in the edge's slot (its state stays in the
 * view), elsewhere where it stands. Nothing changes in the classic shell.
 */
export function EdgePortal({ children }: { children: ReactNode }) {
  const bench = useContext(BenchContext);
  const el = useEdgeSlot((s) => s.el);
  return bench && el ? createPortal(children, el) : children;
}
