import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DAY_S } from '../../world/clock';
import { FINISHES } from './palette';
import { paintSky } from './sky';

const at = (hour: number) => (hour / 24) * DAY_S;
const painted = (hour: number) => {
  const material = new THREE.MeshStandardMaterial();
  paintSky(material, at(hour));
  return material;
};

describe("the hub's sky by the time of day", () => {
  it('by day, the pale sky the hub always had, glowing fully', () => {
    const noon = painted(12);
    expect(noon.color.getHexString(THREE.SRGBColorSpace)).toBe(
      FINISHES['outside-sky'].color.slice(1),
    );
    expect(noon.emissiveIntensity).toBe(1);
    expect(painted(8).color.equals(noon.color)).toBe(true); // a new game's 08:00: as before
  });

  it('deep blue and dim at night, warm at dawn and dusk', () => {
    const night = painted(0);
    expect(night.emissiveIntensity).toBeLessThan(0.5);
    expect(night.color.b).toBeGreaterThan(night.color.r);
    expect(night.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(0.2);
    for (const hour of [6, 18]) {
      const warm = painted(hour).color;
      expect(warm.r, `${hour}:00`).toBeGreaterThan(warm.b);
    }
  });
});
