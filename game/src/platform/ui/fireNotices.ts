import type { Texts } from '../../core/i18n';
import type { Language } from '../../core/i18n';
import type { GameEvents } from '../../game/GameEvents';
import type { ItemDefinition } from '../../gameplay/item';
import type { NoticeKind } from './NoticeQueue';

/** A number as the player reads it: Vietnamese with a decimal comma. */
const num = (x: number, digits: number, language: Language) => {
  const text = Math.abs(x).toFixed(digits);
  return language === 'vi' ? text.replace('.', ',') : text;
};

/**
 * What the HUD says when heat does something on the circuit bench (Phase E-2), with the numbers
 * that explain it: the power a part takes against what it may take, the current in a lead, the
 * voltage on a lamp against its rating.
 */
export function incidentNotice(
  e: GameEvents['CircuitIncident'],
  item: ItemDefinition | undefined,
  t: Texts,
  language: Language,
): { text: string; kind: NoticeKind } {
  const name = item ? t.of(item, 'displayName') : t.ui('circuit.lead', 'A lead');
  const spec = item?.circuit;
  const w = num(e.watts, e.watts < 10 ? 2 : 0, language);
  const a = num(e.amps, e.amps < 10 ? 2 : 0, language);
  const rated = spec?.ratedWatts;
  const params = { name, w, a, v: num(e.volts, 1, language) };
  switch (e.what) {
    case 'smoke':
      if (!item)
        return {
          text: t.ui(
            'circuit.leadSmoke',
            'A lead is overloaded ({a} A): its insulation melts and smokes.',
            params,
          ),
          kind: 'warn',
        };
      if (spec?.kind === 'cell')
        return {
          text: t.ui(
            'circuit.cellHot',
            '{name} is shorted: {a} A heats it inside — it smokes and may leak.',
            params,
          ),
          kind: 'warn',
        };
      return {
        text: rated
          ? t.ui(
              'circuit.partSmoke',
              '{name} smokes: it takes {w} W but is rated for only {r} W.',
              {
                ...params,
                r: num(rated, 2, language),
              },
            )
          : t.ui('circuit.partHot', '{name} smokes: {a} A is too much for it.', params),
        kind: 'warn',
      };
    case 'fire':
      return {
        text: item
          ? t.ui(
              'circuit.partFire',
              '{name} has caught fire ({w} W)! Switch the supply off, then use the CO₂ extinguisher — or call 114 on your phone (P).',
              params,
            )
          : t.ui(
              'circuit.leadFire',
              'A lead has caught fire: {a} A is far too much for a 0.5 mm² wire! Use the CO₂ extinguisher or call 114 (P).',
              params,
            ),
        kind: 'error',
      };
    case 'failed':
      if (spec?.kind === 'fuse' || spec?.kind === 'ammeter')
        return {
          text: t.ui(
            'circuit.fuseBlown',
            "{name}'s fuse has blown: {a} A was too much. It cut the circuit to protect it — the fuse is ruined.",
            params,
          ),
          kind: 'warn',
        };
      if (spec?.kind === 'cell')
        return {
          text: t.ui(
            'circuit.cellDead',
            '{name} is ruined by the short circuit: overheated, it leaked.',
            params,
          ),
          kind: 'warn',
        };
      return {
        text: t.ui(
          'circuit.partBurnt',
          '{name} has burnt through ({w} W): it no longer conducts.',
          params,
        ),
        kind: 'warn',
      };
    case 'burnt-out':
      return {
        text: t.ui(
          'circuit.lampOut',
          '{name} has burnt out: {v} V on a lamp rated {r} V wears its filament through (life ∝ V^−16).',
          { ...params, r: num(spec?.volts ?? 0, 1, language) },
        ),
        kind: 'warn',
      };
    case 'melted':
      return {
        text: t.ui(
          'circuit.leadMelted',
          'A lead has melted through ({a} A): the circuit is broken there.',
          params,
        ),
        kind: 'warn',
      };
  }
}

/** What the HUD says about fire and the phone's calls. */
export function fireNotice(
  what: GameEvents['FireNotice']['what'],
  t: Texts,
): { text: string; kind: NoticeKind } {
  switch (what) {
    case 'too-close':
      return { text: t.ui('fire.tooClose', 'Too close to the fire! Step back.'), kind: 'error' };
    case 'empty':
      return { text: t.ui('fire.empty', 'The extinguisher is empty.'), kind: 'warn' };
    case 'out':
      return { text: t.ui('fire.out', 'The fire is out.'), kind: 'success' };
    case 'brigade-arrived':
      return {
        text: t.ui('fire.brigade', 'The fire brigade has arrived and put the fire out.'),
        kind: 'success',
      };
  }
}
