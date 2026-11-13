import type * as THREE from 'three';

/** Names every unnamed mesh of `glass` under `root` "glass" (the glassware finish lists them by name). */
export function nameGlass(root: THREE.Object3D, glass: THREE.Material): void {
  root.traverse((o) => {
    if (!o.name && (o as Partial<THREE.Mesh>).material === glass) o.name = 'glass';
  });
}
