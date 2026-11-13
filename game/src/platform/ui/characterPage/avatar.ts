import type { CharacterDefinition } from '../../../gameplay/character';

/*
 * The menu's picture of a character before their 3D portrait exists: a flat drawing in their own
 * colours (skin, hair, eyes, top, its neckline's accent), as an SVG data URL — no three.js, so
 * the menu still loads without the renderer. Once the character page has run, the 3D portrait
 * replaces it (cached in the browser, `PORTRAIT_KEY`).
 */

/** Where a 3D portrait is kept in the browser (a preference cache, never part of the save). */
export const PORTRAIT_KEY = 'simlab.portrait.';

/** A key that changes when anything drawn changes: an old picture is never shown. */
export function portraitKey(c: CharacterDefinition): string {
  let h = 0;
  for (const ch of JSON.stringify(c.appearance) + String(c.profile.coat)) {
    h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  }
  return `${PORTRAIT_KEY}${c.id}.${(h >>> 0).toString(36)}`;
}

export function avatar(c: CharacterDefinition): string {
  const a = c.appearance;
  const coat = c.profile.coat ? '#f4f6f8' : a.clothes.top;
  const long = a.hair === 'long' || a.hair === 'bob';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" fill="#cfdbe5"/>
${long ? `<rect x="18" y="20" width="28" height="${a.hair === 'long' ? 30 : 20}" rx="10" fill="${a.hairColor}"/>` : ''}
<path d="M8 64 Q10 44 32 44 Q54 44 56 64 Z" fill="${coat}"/>
<path d="M24 46 L32 58 L40 46 Z" fill="${a.clothes.top}"/>
<rect x="28" y="36" width="8" height="10" fill="${a.skinTone}"/>
<ellipse cx="32" cy="28" rx="13" ry="14" fill="${a.skinTone}"/>
<path d="M18 27 Q18 12 32 12 Q46 12 46 27 Q40 18 32 19 Q24 18 18 27 Z" fill="${a.hairColor}"/>
${a.hair === 'bun' ? `<circle cx="32" cy="11" r="5" fill="${a.hairColor}"/>` : ''}
<ellipse cx="27" cy="29" rx="2.4" ry="3" fill="${a.eyeColor}"/>
<ellipse cx="37" cy="29" rx="2.4" ry="3" fill="${a.eyeColor}"/>
${a.glasses !== 'none' ? `<g fill="none" stroke="#1d1f23" stroke-width="1"><circle cx="27" cy="29" r="4.5"/><circle cx="37" cy="29" r="4.5"/></g>` : ''}
${a.beard ? `<path d="M21 32 Q32 46 43 32 Q38 40 32 40 Q26 40 21 32 Z" fill="${a.hairColor}"/>` : ''}
<path d="M29 36 Q32 38 35 36" stroke="#a5524a" stroke-width="1.2" fill="none"/>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
