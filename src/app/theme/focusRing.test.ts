import { describe, expect, it } from 'vitest';
import { cssDeclarations } from './cssTesting';

/**
 * Every focusable thing shows a focus ring (#205 A4). The global `:focus-visible` rule draws it;
 * a stylesheet may remove an element's own outline only where another rule shows focus for it
 * (its box, its card, a colour change), listed here with that rule.
 */
const RING_ELSEWHERE: Record<string, string> = {
  'src/app/bench/bench.css .param__num .param__number:focus-visible':
    'src/app/bench/bench.css .param__num:focus-within',
  'src/app/bench/bench.css .shelf-card__open:focus-visible':
    'src/app/bench/bench.css .shelf-card:has(.shelf-card__open:focus-visible)',
  'src/app/command/command.css .command-palette__search input':
    'src/app/command/command.css .command-palette__search:focus-within',
  'src/app/layout/layout.css .splitter:focus-visible':
    'src/app/layout/layout.css .splitter:focus-visible',
  'src/app/layout/layout.css .problem-input__field':
    'src/app/layout/layout.css .problem-input:focus-within',
  'src/app/layout/layout.css .problem-input__field:focus-visible':
    'src/app/layout/layout.css .problem-input:focus-within',
  'src/app/sim/sim.css .stage__canvas': 'src/app/sim/sim.css .stage__canvas:focus-visible',
  'src/chemistry/chem.css .pt__search input': 'src/chemistry/chem.css .pt__search:focus-within',
  'src/teacher/chat/chat.css .chat-panel__composer textarea':
    'src/teacher/chat/chat.css .chat-panel__composer:has(textarea:focus-visible)',
  'src/ui/ui.css select option:focus-visible': 'src/ui/ui.css select option:focus-visible',
};
/** Removed with no ring anywhere: only for things that are not controls. */
const NOT_A_CONTROL: Record<string, string> = {
  'src/app/whatsnew/whatsnew.css .whatsnew__title:focus':
    'the heading is focused on open so a screen reader starts there; it does nothing',
};

const isOff = (v: string) => /^(none|0)$/.test(v);

describe('focus rings (#205 A4)', () => {
  const decls = cssDeclarations();

  it('every outline removal is listed, with the rule that shows focus instead', () => {
    const off = decls.filter((d) => d.prop === 'outline' && isOff(d.value)).map((d) => d.key);
    expect(off.filter((k) => !(k in RING_ELSEWHERE) && !(k in NOT_A_CONTROL))).toEqual([]);
    expect(
      [...Object.keys(RING_ELSEWHERE), ...Object.keys(NOT_A_CONTROL)].filter(
        (k) => !off.includes(k),
      ),
    ).toEqual([]);
  });

  it('each listed rule really draws something: an outline, a shadow or a background', () => {
    for (const ring of new Set(Object.values(RING_ELSEWHERE))) {
      const shows = decls.some(
        (d) =>
          d.key === ring &&
          ['outline', 'box-shadow', 'background'].includes(d.prop) &&
          !isOff(d.value),
      );
      expect(shows, ring).toBe(true);
    }
  });

  it('the global ring is there', () => {
    expect(
      decls.some(
        (d) =>
          d.key === 'src/app/theme/base.css :focus-visible' &&
          d.prop === 'outline' &&
          d.value.includes('var(--focus-ring)'),
      ),
    ).toBe(true);
  });
});
