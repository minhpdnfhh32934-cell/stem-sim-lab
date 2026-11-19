import * as THREE from 'three';

/*
 * The night over the wallpaper (Phase W-6), laid over three's daytime sky as the light goes: a
 * deep blue deepening up from a horizon still lit by the city, stars that twinkle (hashed on the
 * sky's own directions, so they hold still as the view sways), and the moon with its halo.
 * Drawn at the far plane like the day sky, see-through by `uNight`.
 */

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = (modelMatrix * vec4(position, 0.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
}`;

const FRAGMENT = /* glsl */ `
uniform float uNight;
uniform float uTime;
uniform vec3 uMoon;
varying vec3 vDir;
float starHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float up = clamp(d.y, -0.2, 1.0);
  vec3 zenith = vec3(0.004, 0.009, 0.024);
  vec3 mid = vec3(0.012, 0.022, 0.055);
  vec3 glow = vec3(0.09, 0.06, 0.09);
  vec3 col = mix(mid, zenith, smoothstep(0.05, 0.7, up));
  col += glow * exp(-max(up, 0.0) * 14.0);
  // Stars: one per cell of a fine grid on the sphere, a few bright, twinkling.
  vec3 cell = floor(d * 260.0);
  float h = starHash(cell);
  vec3 centre = (cell + 0.5 + 0.35 * (vec3(starHash(cell + 1.3), starHash(cell + 2.7), starHash(cell + 4.1)) - 0.5)) / 260.0;
  float star = step(0.985, h) * smoothstep(0.0022, 0.0, length(d - normalize(centre)));
  float twinkle = 0.6 + 0.4 * sin(uTime * (1.5 + 3.0 * h) + h * 40.0);
  col += vec3(0.85, 0.9, 1.0) * star * twinkle * (0.6 + 2.5 * step(0.997, h)) * smoothstep(0.02, 0.2, up);
  // The moon and its halo.
  float m = dot(d, normalize(uMoon));
  col += vec3(0.9, 0.93, 1.0) * smoothstep(0.99975, 0.99985, m) * 3.0;
  col += vec3(0.25, 0.3, 0.45) * pow(max(m, 0.0), 220.0) * 0.6;
  gl_FragColor = vec4(col, uNight);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export interface NightSky {
  readonly mesh: THREE.Mesh;
  /** Towards the moon (world). */
  readonly moon: THREE.Vector3;
  update(night: number, time: number): void;
  dispose(): void;
}

export function nightSky(): NightSky {
  const moon = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();
  const uNight = { value: 0 };
  const uTime = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: { uNight, uTime, uMoon: { value: moon } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.scale.setScalar(1000);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  return {
    mesh,
    moon,
    update(night, time) {
      uNight.value = night;
      uTime.value = time;
      mesh.visible = night > 0.002;
    },
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
