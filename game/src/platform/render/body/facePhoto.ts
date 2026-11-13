import * as THREE from 'three';

/*
 * The face from a photo, laid on the head (Phú 2026-11-12: "gán luôn ảnh vào mặt nhân vật"): a
 * small square picture of the face, cut from the photo so that its eyes and its mouth stand at
 * fixed places (`FACE_PICTURE`), drawn over the head's face with the drawn eyes and mouth on
 * those places (`BodyModel`), fading into the skin round an oval.
 */

/** The face picture's layout: its size (px) and where the eyes and the mouth are (0–1, from the top left). */
export const FACE_PICTURE = {
  size: 128,
  /** The eye on the picture's left (the face's right); the other at 1 − this. */
  eyeU: 0.35,
  eyeV: 0.42,
  mouthV: 0.744,
} as const;

/** The longest a face picture may be (a JPEG data URL), to fit a LAN room's message. */
export const FACE_PICTURE_MAX_CHARS = 10_000;

/** An oval round the face (in the picture's terms), opaque inside and fading out at its edge. */
function fade(): THREE.DataTexture {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      // uv: v up (the texture's rows run from the bottom).
      const u = (i + 0.5) / n;
      const v = (j + 0.5) / n;
      const r = Math.hypot((u - 0.5) / 0.33, (v - 0.5) / 0.39);
      const t = Math.min(1, Math.max(0, (r - 0.72) / 0.28));
      const a = Math.round(255 * (1 - t * t * (3 - 2 * t)));
      data.set([a, a, a, 255], (j * n + i) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/**
 * The material of the face from a photo: lit as the skin is (`gradientMap`), the picture faded
 * round its oval. Hidden until the picture has loaded; its textures freed with it.
 */
export function facePhotoMaterial(
  picture: string | undefined,
  gradientMap: THREE.Texture,
): THREE.MeshToonMaterial {
  const alphaMap = fade();
  const material = new THREE.MeshToonMaterial({
    gradientMap,
    alphaMap,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  material.visible = false;
  let map: THREE.Texture | null = null;
  if (picture) {
    map = new THREE.TextureLoader().load(picture, () => (material.visible = true));
    map.colorSpace = THREE.SRGBColorSpace;
    material.map = map;
  }
  material.addEventListener('dispose', () => {
    alphaMap.dispose();
    map?.dispose();
  });
  return material;
}
