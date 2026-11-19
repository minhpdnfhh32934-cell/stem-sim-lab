import { Logger } from '../../core/Logger';
import { loadMuted, loadVolumes } from '../../persistence/settings';
import { createBrowserStorage } from '../storage';

/** Its loudness at full master and effects volume. */
const LEVEL = 0.5;
/** How long (ms) a browser may take to start a context it lets play; past it, silence. */
const START_WAIT_MS = 600;

export interface RocketSound {
  /** How fast time runs now: slowed, the roar deepens and dulls; sped up, it brightens. */
  set(scale: number): void;
  fade(): void;
  /** The player's master and effects volumes (0–100) changed while it plays (its own context). */
  volume(master: number, effects: number, muted: boolean): void;
}

/**
 * The rocket opening's roar (Phú 2026-11-18): brown noise, looped, through a low-pass. Played as
 * a recording would be in slow motion: slowed down, so lower and duller, and back up as time
 * comes back. Like the emblem's opening, only when the browser lets a page sound before a click
 * (the desktop app does); at the player's master and effects volumes, nothing when muted.
 */
export function playRocket(): RocketSound | null {
  if (typeof AudioContext === 'undefined') return null;
  const { storage } = createBrowserStorage();
  const log = Logger.create('warn').child('opening');
  const volumes = loadVolumes(storage, log);
  const level = loadMuted(storage, log) ? 0 : (LEVEL * volumes.master * volumes.effects) / 1e4;
  if (level <= 0) return null;
  const policy = (
    navigator as { getAutoplayPolicy?: (type: string) => string }
  ).getAutoplayPolicy?.('audiocontext');
  if (policy === 'disallowed') return null;

  const ctx = new AudioContext();
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 1400;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  source.connect(low).connect(gain).connect(ctx.destination);
  source.start();
  gain.gain.setTargetAtTime(level, ctx.currentTime, 0.5);
  let closed = false;
  let faded = false;
  let last = -1;
  const close = () => {
    if (closed) return;
    closed = true;
    void ctx.close();
  };
  window.setTimeout(() => {
    if (ctx.state !== 'running') close();
  }, START_WAIT_MS);
  return {
    set: (scale) => {
      if (closed || Math.abs(scale - last) < 0.01) return;
      last = scale;
      const now = ctx.currentTime;
      source.playbackRate.setTargetAtTime(0.3 + 0.7 * Math.min(1.3, scale), now, 0.08);
      low.frequency.setTargetAtTime(150 + 1250 * Math.min(1.6, scale), now, 0.08);
    },
    fade: () => {
      if (closed) return;
      faded = true;
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      window.setTimeout(close, 1500);
    },
    volume: (master, effects, muted) => {
      if (closed || faded) return;
      gain.gain.setTargetAtTime(
        muted ? 0 : (LEVEL * master * effects) / 1e4,
        ctx.currentTime,
        0.05,
      );
    },
  };
}
