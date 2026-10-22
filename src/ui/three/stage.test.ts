import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lightRig, rigLight } from './lighting';
import { StageKeeper, readStageTokens, type StageTokens } from './stage';
import { fakeRenderer } from './testing';

const TOKENS: StageTokens = {
  theme: 'light',
  rimTint: '#16804a',
  backdrop: {
    stage: '#fbfcfe',
    sunken: '#e7ebf2',
    app: '#eef1f6',
    skyTop: '#dbe7f3',
    skyHorizon: '#f3f6f9',
  },
};
const DARK: StageTokens = {
  theme: 'dark',
  rimTint: '#4cc38a',
  backdrop: {
    stage: '#10151d',
    sunken: '#0f141c',
    app: '#0d1117',
    skyTop: '#0d1828',
    skyHorizon: '#1a2838',
  },
};

afterEach(() => {
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.theme;
});

describe('StageKeeper', () => {
  it('puts every scene on one backdrop; a theme switch rebuilds it and frees the old one', () => {
    const keeper = new StageKeeper();
    const { factory } = fakeRenderer();
    const renderer = factory({ antialias: true });
    const a = new THREE.Scene();
    a.add(lightRig());
    keeper.apply(a, renderer, 1, TOKENS);
    const first = keeper.backdrop;
    expect(first).toBeInstanceOf(THREE.DataTexture);
    expect(a.background).toBe(first);
    expect(a.environmentIntensity).toBe(0.7);

    // A second scene (the model changed) reuses the same texture: nothing rebuilt.
    const b = new THREE.Scene();
    keeper.apply(b, renderer, 1, TOKENS);
    expect(keeper.backdrop).toBe(first);
    expect(b.background).toBe(first);

    // Dark theme: a new texture; the old one is freed.
    const freed = vi.spyOn(first!, 'dispose');
    const c = new THREE.Scene();
    c.add(lightRig());
    keeper.apply(c, renderer, 1, DARK);
    expect(freed).toHaveBeenCalledTimes(1);
    expect(keeper.backdrop).not.toBe(first);
    expect(c.background).toBe(keeper.backdrop);
    expect(rigLight(c, 'rim')?.intensity).toBe(2.4);
    expect(c.environmentIntensity).toBe(0.5);

    const last = vi.spyOn(keeper.backdrop!, 'dispose');
    keeper.dispose();
    expect(last).toHaveBeenCalledTimes(1);
    expect(keeper.backdrop).toBeNull();
  });

  it('an outdoor rig gets the sky; a scene with its own background keeps it', () => {
    const keeper = new StageKeeper();
    const renderer = fakeRenderer().factory({ antialias: true });
    const out = new THREE.Scene();
    out.add(lightRig({ preset: 'outdoor' }));
    expect(keeper.apply(out, renderer, 1, TOKENS).preset).toBe('outdoor');
    expect(out.background).toBeInstanceOf(THREE.DataTexture);
    const own = new THREE.Scene();
    const color = new THREE.Color(0x123456);
    own.background = color;
    keeper.apply(own, renderer, 1, TOKENS);
    expect(own.background).toBe(color);
    keeper.dispose();
  });

  it('without the stylesheet (no tokens) the canvas stays transparent, as before', () => {
    const keeper = new StageKeeper();
    const scene = new THREE.Scene();
    keeper.apply(scene, fakeRenderer().factory({ antialias: true }), 1, readStageTokens());
    expect(scene.background).toBeNull();
    keeper.dispose();
  });

  it('reads the theme and tokens from the page', () => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.setProperty('--bg-stage', '#10151d');
    const t = readStageTokens();
    expect(t.theme).toBe('dark');
    expect(t.backdrop.stage).toBe('#10151d');
  });
});
