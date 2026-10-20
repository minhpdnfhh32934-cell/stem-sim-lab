import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LAYER } from './layers';
import {
  LOOK,
  applyStageLook,
  contactShadow,
  disposeLightRig,
  fitShadow,
  lightDirection,
  lightRig,
  rigLight,
} from './lighting';

const deg = (r: number) => (r * 180) / Math.PI;

describe('light rig presets', () => {
  it('studio: key 5200 K at azimuth 40°, elevation 50°; fill low left; rim behind the key', () => {
    const rig = lightRig({ size: 12 });
    expect(rig.userData.preset).toBe('studio');
    const key = rigLight(rig, 'key') as THREE.DirectionalLight;
    const fill = rigLight(rig, 'fill') as THREE.DirectionalLight;
    const rim = rigLight(rig, 'rim') as THREE.DirectionalLight;
    const hemi = rigLight(rig, 'hemisphere') as THREE.HemisphereLight;
    expect(key.intensity).toBe(2.4);
    expect(fill.intensity).toBe(0.45);
    expect(rim.intensity).toBe(1.8);
    expect(hemi.intensity).toBe(0.25);
    const k = key.position.clone().normalize();
    expect(deg(Math.asin(k.y))).toBeCloseTo(50, 5);
    expect(deg(Math.atan2(k.x, k.z))).toBeCloseTo(40, 5);
    // Warm key (red ≥ green > blue), cool fill (blue strongest).
    expect(key.color.r).toBeGreaterThan(key.color.b);
    expect(fill.color.b).toBeGreaterThan(fill.color.r);
    // Fill from the left and low; rim from behind (−z), opposite the key (−x).
    expect(fill.position.x).toBeLessThan(0);
    expect(fill.position.y).toBeLessThan(key.position.y / 3);
    expect(rim.position.z).toBeLessThan(0);
    expect(rim.position.x).toBeLessThan(0);
    expect(key.castShadow).toBe(false);
    disposeLightRig(rig);
  });

  it('outdoor: sun 3.0 at elevation 55° with a fitted shadow camera; sky / soil hemisphere', () => {
    const rig = lightRig({ preset: 'outdoor', shadows: true, sky: '#dbe7f3', ground: '#816f62' });
    const sun = rigLight(rig, 'key') as THREE.DirectionalLight;
    expect(sun.intensity).toBe(3);
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.mapSize.x).toBe(1024);
    expect(sun.shadow.radius).toBe(4);
    const hemi = rigLight(rig, 'hemisphere') as THREE.HemisphereLight;
    expect(hemi.intensity).toBe(0.6);
    expect(`#${hemi.color.getHexString()}`).toBe('#dbe7f3');
    expect(`#${hemi.groundColor.getHexString()}`).toBe('#816f62');
    fitShadow(rig, [2, 0, -1], 8);
    expect(sun.target.position.toArray()).toEqual([2, 0, -1]);
    const dir = sun.position.clone().sub(sun.target.position).normalize();
    expect(deg(Math.asin(dir.y))).toBeCloseTo(55, 5);
    expect(sun.shadow.camera.right).toBeCloseTo(8.8, 5);
    expect(rigLight(rig, 'back')?.intensity).toBe(0.5);
    disposeLightRig(rig);
  });

  it('applyStageLook: environment per preset and theme, the dark rim stronger and tinted', () => {
    const scene = new THREE.Scene();
    scene.add(lightRig());
    const light = applyStageLook(scene, { theme: 'light', rimTint: '#4cc38a', envScale: 1 });
    expect(light).toEqual({ preset: 'studio', exposure: 1 });
    expect(scene.environmentIntensity).toBe(0.7);
    expect(deg(scene.environmentRotation.y)).toBeCloseTo(-30, 5);
    const rim = rigLight(scene, 'rim') as THREE.DirectionalLight;
    expect(rim.intensity).toBe(1.8);
    expect(rim.color.getHex()).toBe(0xffffff);

    const dark = applyStageLook(scene, { theme: 'dark', rimTint: '#4cc38a', envScale: 1 });
    expect(dark).toEqual({ preset: 'studio', exposure: 1.05 });
    expect(scene.environmentIntensity).toBe(0.5);
    expect(rim.intensity).toBe(2.4);
    // 30 % towards the tint: greener than white, still mostly white.
    expect(rim.color.g).toBeGreaterThan(rim.color.r);
    expect(rim.color.r).toBeGreaterThan(0.6);

    // Back to light: the tint is gone.
    applyStageLook(scene, { theme: 'light', rimTint: '#4cc38a', envScale: 1 });
    expect(rim.color.getHex()).toBe(0xffffff);

    const out = new THREE.Scene();
    out.add(lightRig({ preset: 'outdoor' }));
    expect(applyStageLook(out, { theme: 'dark', rimTint: '', envScale: 1 }).preset).toBe('outdoor');
    expect(out.environmentIntensity).toBe(LOOK.outdoor.environment.dark);
    // A scene without a rig is lit like the studio.
    expect(applyStageLook(new THREE.Scene(), { theme: 'light', rimTint: '', envScale: 0 })).toEqual(
      {
        preset: 'studio',
        exposure: 1,
      },
    );
  });

  it('lightDirection: azimuth from +z towards +x, elevation above the horizon', () => {
    expect(
      lightDirection(0, 0)
        .toArray()
        .map((v) => Number(v.toFixed(6))),
    ).toEqual([0, 0, 1]);
    expect(lightDirection(90, 0).x).toBeCloseTo(1, 6);
    expect(lightDirection(0, 90).y).toBeCloseTo(1, 6);
  });

  it('a contact shadow is kept out of the ambient occlusion pass', () => {
    const s = contactShadow(-1, 2, 1);
    expect(s.mesh.userData.layer).toBe(LAYER.FX);
    s.dispose();
  });
});
