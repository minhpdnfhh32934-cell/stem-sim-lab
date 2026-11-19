/**
 * Ultra's ripples on a liquid's surface (quality.ts `liquids`), one GLSL function for the two places
 * that draw them: the surface's reflection (ContainerView.ts) and what is seen through it
 * (effectsPass.ts), so the rings they show are the same rings. `p` and `impact` are in the
 * surface's own unit circle; two trains of rings (not one regular target) travel out from where a
 * stream or a drop falls in and fade with distance and with `amount` (how stirred it is, 0–1).
 * Returns the surface's slope (xy) and how much its rings gather (+) or spread (−) the light (z).
 * Drawn only: the level and the volume stay the model's.
 */
export const RIPPLE_GLSL = /* glsl */ `
vec3 ripple( vec2 p, vec2 impact, float t, float amount ) {
  vec2 d = p - impact;
  float ri = max( length( d ), 1e-4 );
  float a = 34.0 * ri - 11.0 * t;
  float b = 55.0 * ri - 16.0 * t + 1.7;
  float fade = exp( -3.0 * ri ) * amount;
  float slope = ( 0.65 * cos( a ) + 0.35 * cos( b ) ) * fade * 0.32;
  float gather = ( 0.65 * sin( a ) + 0.35 * sin( b ) ) * fade;
  return vec3( d / ri * slope, gather );
}
`;
