import { useEffect, useLayoutEffect, type RefObject } from 'react';

/**
 * The picked part's card (mitosis 3D view) is one scroll container: its head (the part's name,
 * "Hỏi thầy", "Bỏ chọn") and its text scroll together, so every line can be reached in any
 * window. When the card's row has room, the head stays in view while the text scrolls under it.
 * Whether there is room is measured, not guessed from a fixed row height: the head is taller when
 * it wraps in a narrow card, and a wider UI font (Linux) changes the room the row gets.
 */

/** Full lines of the part's text that must still show under a head that stays. */
export const MIN_LINES_UNDER_HEAD = 2;

/** Sizes of the picked part's card, px. */
export interface CardRoom {
  /** Height the card may take (its grid row: the slot). */
  readonly room: number;
  /** Height of the head, padding included (the same whether it stays or not). */
  readonly head: number;
  /** What the card adds around the text: top and bottom borders, bottom padding. */
  readonly frame: number;
  /** Line height of the part's text. */
  readonly line: number;
}

/**
 * True when the head may stay in view: under it, at least `MIN_LINES_UNDER_HEAD` full lines of
 * text still show, the last line included (it stops above the card's bottom padding). In a
 * shorter row, or when something could not be measured, the head scrolls with the text: a head
 * that stayed would cover lines that could then never be read.
 */
export function headStays({ room, head, frame, line }: CardRoom): boolean {
  if (!(line > 0) || !(room > 0)) return false;
  return room - frame - head >= MIN_LINES_UNDER_HEAD * line - 0.5;
}

const px = (value: string): number => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/** Reads the card's sizes from the page (`line-height: normal` counts as 1.45, as in base.css). */
export function measureCard(slot: HTMLElement, card: HTMLElement, head: HTMLElement): CardRoom {
  const box = getComputedStyle(card);
  const text = getComputedStyle(card.querySelector('p') ?? card);
  return {
    room: slot.getBoundingClientRect().height,
    head: head.getBoundingClientRect().height,
    frame: px(box.borderTopWidth) + px(box.borderBottomWidth) + px(box.paddingBottom),
    line: px(text.lineHeight) || 1.45 * px(text.fontSize),
  };
}

/** Marks the card `data-head="stays"` or `"scrolls"` (bio.css makes a staying head sticky). */
export function fitCardHead(slot: HTMLElement, card: HTMLElement, head: HTMLElement): boolean {
  const stays = headStays(measureCard(slot, card, head));
  card.dataset.head = stays ? 'stays' : 'scrolls';
  return stays;
}

/**
 * Keeps the card's head fitted: after every render of the card (another part, another language)
 * before the frame is drawn, and on the next frame after the row or the head changes size (a
 * window resize, a wider font). Whether the head stays never changes either size, so fitting
 * cannot feed back into the observer.
 */
export function useCardHeadFit(
  slotRef: RefObject<HTMLElement | null>,
  cardRef: RefObject<HTMLElement | null>,
  headRef: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    if (slotRef.current && cardRef.current && headRef.current)
      fitCardHead(slotRef.current, cardRef.current, headRef.current);
  });
  useEffect(() => {
    const slot = slotRef.current;
    const card = cardRef.current;
    const head = headRef.current;
    if (
      !slot ||
      !card ||
      !head ||
      typeof ResizeObserver === 'undefined' ||
      typeof requestAnimationFrame === 'undefined'
    )
      return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        fitCardHead(slot, card, head);
      });
    });
    observer.observe(slot);
    observer.observe(head);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [slotRef, cardRef, headRef]);
}
