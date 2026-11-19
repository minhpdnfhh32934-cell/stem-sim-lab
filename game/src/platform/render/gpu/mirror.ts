import * as THREE from 'three';
import { blendOverlay, color, reflector, screenUV, uniform } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import type { MirrorGlass } from '../mirrors';

/**
 * A mirror's glass under WebGPU (mirrors.ts draws three's Reflector under WebGL): three's
 * reflector node, its reflection taken for the glass's own part of the view only (Mirrors'
 * crop), so its whole target lies on the glass, as under WebGL. The node samples by the screen,
 * mirrored left to right; the crop's part of the view is mapped onto its target.
 */
export const gpuMirror: MirrorGlass = (geometry, spec) => {
  const reflection = reflector({
    resolutionScale: spec.scale,
    // Not WebGL's 4 samples: its target then alike the frame's, the reflection draws with the
    // frame's pipelines (41 made for it, compiled on Chrome's GPU thread while frames waited). The
    // frame's TRAA smooths the glass as the rest.
    samples: 0,
    bounces: false, // no mirror in a mirror (as Mirrors hides them all while one reflects)
  });
  const offset = uniform(new THREE.Vector2(0, 0));
  const size = uniform(new THREE.Vector2(1, 1));
  reflection.uvNode = screenUV.flipX().sub(offset).div(size);
  const material = new MeshBasicNodeMaterial();
  material.colorNode = blendOverlay(reflection.rgb, color(spec.tint)); // the Reflector's tint
  const glass = new THREE.Mesh(geometry, material);
  glass.add(reflection.target); // the plane's own: its normal +z
  const base = reflection.reflector;
  const update = base.updateBefore.bind(base);
  base.updateBefore = (frame) => {
    const own = frame.camera;
    if (!own) return update(frame);
    const { camera, part } = spec.view(own);
    offset.value.set(part[0], part[1]);
    size.value.set(part[2], part[3]);
    frame.camera = camera; // the node reads the frame's camera
    spec.hide(true);
    try {
      return update(frame);
    } finally {
      spec.hide(false);
      frame.camera = own;
    }
  };
  return Object.assign(glass, {
    dispose() {
      reflection.dispose();
      material.dispose();
    },
  });
};
