import * as THREE from 'three';

/**
 * Softer shadow edges for Max (Phase Max). three's PCF takes five taps on a Vogel disk, turned per
 * pixel: at Ultra's radius 4 that is a soft edge with a little grain, and wider it turns grainy.
 * Rewritten so a radius over 5 (Max's 6) takes twelve: a wider penumbra, smooth. A radius of 5 or
 * less takes the same five taps as before, so every other preset draws exactly as it did.
 *
 * It rewrites three's shadow chunk, so it must run before any program is compiled
 * (WorldRenderer's constructor); it throws if a three.js upgrade changed the code it rewrites.
 */
const FIVE_TAPS =
  /shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord\.xy \+ vogelDiskSample\( 0, 5, phi \) \* radius, shadowCoord\.z \) \) \+[\s\S]*?\) \* 0\.2;/;

const TAPS = `int taps = shadowRadius > 5.0 ? 12 : 5;
				shadow = 0.0;
				for ( int i = 0; i < 12; i ++ ) {
					if ( i >= taps ) break;
					shadow += textureLod( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, taps, phi ) * radius, shadowCoord.z ), 0.0 );
				}
				shadow /= float( taps );`;

export const SHADOW_TAPS_MARK = 'int taps = shadowRadius > 5.0 ? 12 : 5;';

/** Rewrites three's PCF shadow taps once (idempotent). */
export function softerShadows(): void {
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  if (chunk.includes(SHADOW_TAPS_MARK)) return;
  if (!FIVE_TAPS.test(chunk)) {
    throw new Error('three.js shadow chunk changed: shadowTaps.ts no longer matches it');
  }
  (THREE.ShaderChunk as Record<string, string>).shadowmap_pars_fragment = chunk.replace(
    FIVE_TAPS,
    TAPS,
  );
}
