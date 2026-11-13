import * as THREE from 'three';
import { daylight, twilight } from '../../world/clock';

// The sky seen through the hub's clerestories and oculus (Phase V-1): it follows the time of day —
// the pale day sky the hub always had, warm at dawn and dusk, deep blue at night. It glows as a lit
// pane and lights nothing: the hall's own lights keep it evenly bright at every hour.

const DAY = new THREE.Color('#eaf2fb');
const NIGHT = new THREE.Color('#14244a');
const TWILIGHT = new THREE.Color('#f3b07c');
/** How bright the pane glows by night (by day: 1). */
const NIGHT_GLOW = 0.35;

/** Writes the sky pane's colour and glow for `clockS` into `material` (no allocation). */
export function paintSky(material: THREE.MeshStandardMaterial, clockS: number): void {
  const day = daylight(clockS);
  material.color.lerpColors(NIGHT, DAY, day).lerp(TWILIGHT, 0.65 * twilight(clockS));
  material.emissive.copy(material.color);
  material.emissiveIntensity = NIGHT_GLOW + (1 - NIGHT_GLOW) * day;
}
