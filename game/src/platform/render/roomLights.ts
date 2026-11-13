import * as THREE from 'three';
import { DEFAULT_PENUMBRA, LIGHT_SLOTS, type RoomLight } from '../../world/lighting';

/**
 * Shadow map of a key light until the preset sets its own (`mapSize`, quality.ts): one room each
 * (the old sun spread 1024² over a whole scene).
 */
const SHADOW_MAP = 1024;

/**
 * The room lights (world/lighting.ts) as a fixed set of spot lights: LIGHT_SLOTS.key that cast
 * shadows and LIGHT_SLOTS.other that do not, made once. Rooms come and go by filling and emptying
 * slots, never by adding lights, so a door opening changes no shader. An empty slot is dark and
 * its shadow map is not drawn.
 */
export class RoomLightPool {
  private readonly keys: THREE.SpotLight[] = [];
  private readonly others: THREE.SpotLight[] = [];
  /** Which light each slot holds (`lightKey`), or null: free. */
  private readonly keyOwners: (string | null)[] = Array<string | null>(LIGHT_SLOTS.key).fill(null);
  private readonly otherOwners: (string | null)[] = Array<string | null>(LIGHT_SLOTS.other).fill(
    null,
  );
  /** Lights the last assignment had no slot for (a third scene left open): drawn without them. */
  dropped = 0;

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < LIGHT_SLOTS.key; i++) this.keys.push(spot(scene, true));
    for (let i = 0; i < LIGHT_SLOTS.other; i++) this.others.push(spot(scene, false));
  }

  /**
   * Puts `lights` in the slots (the current scene's first, when there are too few); the rest go
   * dark. A light already in a slot keeps it: a room waking or going to sleep moves no other room's
   * lights, so their shadow maps stay as drawn (moved, each map was drawn again, and for a frame
   * showed another room's shadows — a flash as the player walked between rooms).
   */
  assign(lights: readonly RoomLight[]): void {
    this.dropped = 0;
    const keys = lights.map(lightKey);
    const wanted = new Set(keys);
    // More lights than slots (a third scene open): assigned afresh in order, the current scene's
    // first, as before.
    const keyLights = lights.filter((l) => l.role === 'key').length;
    if (keyLights > this.keys.length) this.keyOwners.fill(null);
    if (lights.length - keyLights > this.others.length) this.otherOwners.fill(null);
    // Slots whose light is gone are free; the others keep theirs.
    for (const owners of [this.keyOwners, this.otherOwners]) {
      owners.forEach((owner, i) => {
        if (owner !== null && !wanted.has(owner)) owners[i] = null;
      });
    }
    lights.forEach((light, n) => {
      const key = keys[n] ?? '';
      const [slots, owners] =
        light.role === 'key' ? [this.keys, this.keyOwners] : [this.others, this.otherOwners];
      let i = owners.indexOf(key);
      if (i < 0) i = owners.indexOf(null);
      const slot = slots[i];
      if (i < 0 || !slot) {
        this.dropped++;
        return;
      }
      owners[i] = key;
      slot.position.fromArray(light.position);
      slot.target.position.fromArray(light.target);
      slot.color.set(light.color);
      slot.intensity = light.intensity;
      slot.angle = light.angle;
      slot.penumbra = light.penumbra;
      slot.distance = light.range; // also the shadow camera's far plane (SpotLightShadow)
      // Its map is drawn when the light or what it shows changes (shadowCache.ts), not each frame.
    });
    const dark = (slots: THREE.SpotLight[], owners: (string | null)[]) =>
      slots.forEach((slot, i) => {
        if (owners[i] !== null || slot.intensity === 0) return;
        slot.intensity = 0;
        // Drawn once more, then left: the shaders sample every key's map, which must exist (a
        // depth texture) even for a dark slot, or WebGL refuses the draw.
        slot.shadow.needsUpdate = true;
      });
    dark(this.keys, this.keyOwners);
    dark(this.others, this.otherOwners);
  }

  /** Shown in enhanced scenes; hiding them changes the shaders, so only the preset does. */
  set visible(on: boolean) {
    for (const light of [...this.keys, ...this.others]) light.visible = on;
  }

  /** The key lights' shadows (the graphics quality). */
  set shadows(on: boolean) {
    for (const light of this.keys) light.castShadow = on;
  }

  /**
   * The key lights' shadow maps, `size` px a side (the graphics quality). Every key slot, dark ones
   * too: three resizes a map only when it draws it, and a dark slot draws only when asked.
   */
  set mapSize(size: number) {
    for (const light of this.keys) {
      if (light.shadow.mapSize.x === size) continue;
      light.shadow.mapSize.set(size, size);
      light.shadow.needsUpdate = true;
    }
  }

  /** How far the key lights' shadow edges are blurred (the graphics quality). */
  set softness(radius: number) {
    for (const light of this.keys) light.shadow.radius = radius;
  }

  /** Each slot as the renderer draws it (tests and the developer panel). */
  get slots(): readonly THREE.SpotLight[] {
    return [...this.keys, ...this.others];
  }

  dispose(): void {
    for (const light of [...this.keys, ...this.others]) {
      light.removeFromParent();
      light.target.removeFromParent();
      light.dispose(); // its shadow map
    }
  }
}

/** A light's identity across assignments: its room and where it hangs. */
const lightKey = (light: RoomLight) => `${light.roomId}|${light.position.join(',')}`;

function spot(scene: THREE.Scene, key: boolean): THREE.SpotLight {
  const light = new THREE.SpotLight('#ffffff', 0, 0, Math.PI / 4, DEFAULT_PENUMBRA, 2);
  light.castShadow = key;
  light.shadow.autoUpdate = false;
  light.shadow.needsUpdate = true; // its map made on the first frame (see assign)
  if (key) {
    light.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    light.shadow.camera.near = 0.1;
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.02;
  }
  scene.add(light, light.target);
  return light;
}
