import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly, lookKey } from './assembly';
import { GLASSWARE_LOOK, LOOKS } from './looks';

// An assembly's materials: one shared by every assembly that makes the same and never changes it,
// freed with the last; a material changed later (`mine`), drawn on a texture or hooked into its
// shader keeps its own.

const satin = (color: string) => new THREE.MeshStandardMaterial({ color, ...LOOKS.satin });
const freed = (material: THREE.Material) => {
  const seen = { freed: 0 };
  material.addEventListener('dispose', () => seen.freed++);
  return seen;
};

describe('Assembly materials', () => {
  it('shares one material for the same values across assemblies, freed with the last', () => {
    const a = new Assembly();
    const b = new Assembly();
    const red = a.own(satin('#c8382f'));
    expect(b.own(satin('#c8382f'))).toBe(red);
    expect(b.own(satin('#2f5fc8'))).not.toBe(red);
    expect(b.own(new THREE.MeshStandardMaterial({ color: '#c8382f', ...LOOKS.matte }))).not.toBe(
      red,
    );
    const red$ = freed(red);
    a.dispose();
    a.dispose(); // given back once
    expect(red$.freed).toBe(0);
    b.dispose();
    expect(red$.freed).toBe(1);
    const c = new Assembly();
    expect(c.own(satin('#c8382f'))).not.toBe(red); // a new one once all were freed
    c.dispose();
  });

  it('never shares a material changed later, drawn on a texture or hooked into its shader', () => {
    const a = new Assembly();
    const b = new Assembly();
    const glow = a.mine(satin('#ffd25a'));
    const shared = b.own(satin('#ffd25a'));
    expect(shared).not.toBe(glow);
    expect(a.own(satin('#ffd25a'))).toBe(shared); // the shared one, never the changing one
    const map = new THREE.Texture();
    const printed = a.own(new THREE.MeshBasicMaterial({ map }));
    expect(b.own(new THREE.MeshBasicMaterial({ map }))).not.toBe(printed);
    const hooked = satin('#ffffff');
    hooked.onBeforeCompile = () => {};
    expect(lookKey(hooked)).toBeNull();
    expect(lookKey(printed)).toBeNull();
    const glow$ = freed(glow);
    const printed$ = freed(printed);
    a.dispose();
    expect([glow$.freed, printed$.freed]).toEqual([1, 1]); // its own: freed with it
    b.dispose();
  });

  it('keys every value: colours exactly, names and see-through glass apart', () => {
    const grey = (b: number) =>
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.5, b) });
    expect(lookKey(grey(0.5))).toBe(lookKey(grey(0.5)));
    expect(lookKey(grey(0.5))).not.toBe(lookKey(grey(0.5001))); // one hex, two colours
    const glass = new THREE.MeshStandardMaterial({ color: '#d8eef5', ...GLASSWARE_LOOK });
    const unnamed = new THREE.MeshStandardMaterial({
      ...GLASSWARE_LOOK,
      color: '#d8eef5',
      name: '',
    });
    expect(lookKey(glass)).not.toBe(lookKey(unnamed));
    const noDepth = new THREE.MeshStandardMaterial({ color: '#d8eef5', ...GLASSWARE_LOOK });
    noDepth.depthWrite = false;
    expect(lookKey(noDepth)).not.toBe(lookKey(glass));
  });
});
