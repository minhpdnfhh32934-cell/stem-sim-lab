import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import rawBank from '../../content/sounds.json';
import { type Bank, parseBank, SynthSchema } from './bank';
import { impulseResponse, renderSynth, roomRt60 } from './synth';

const AUDIO = join(__dirname, '../../../public/audio');
const RATE = 48000;

function bank(): Bank {
  const parsed = parseBank(rawBank);
  if (!('bank' in parsed)) throw new Error(parsed.problems);
  return parsed.bank;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

describe('the sound bank (content/sounds.json)', () => {
  it('is valid: a sound for every moment the code names and every floor', () => {
    expect(bank().sounds.length).toBeGreaterThan(0);
  });

  it('every recorded file is in the game, credited, and every file in the game is used', () => {
    const used = new Set(bank().sounds.flatMap((s) => s.files ?? []));
    const credits = readFileSync(join(AUDIO, 'CREDITS.md'), 'utf8');
    for (const file of used) {
      expect(existsSync(join(AUDIO, file)), file).toBe(true);
      const folder = file.slice(0, file.lastIndexOf('/') + 1);
      const name = file.slice(folder.length).replace(/-\d+\.ogg$/, '');
      expect(credits, file).toContain(`${folder}${name}`);
    }
    const shipped = filesUnder(AUDIO)
      .map((path) => relative(AUDIO, path).split('\\').join('/'))
      .filter((path) => path.endsWith('.ogg'));
    expect(shipped.sort()).toEqual([...used].sort());
  });

  it('every room’s air is a looped sound of the room bus', () => {
    const sounds = new Map(bank().sounds.map((s) => [s.id, s]));
    for (const room of bundledContent.rooms as { id: string; ambience?: string }[]) {
      expect(room.ambience, room.id).toBeDefined();
      const air = sounds.get(room.ambience ?? '');
      expect([room.id, air?.bus, air?.synth?.loop]).toEqual([room.id, 'room', true]);
    }
  });

  it('no sound made in code clips; each is audible', () => {
    for (const sound of bank().sounds) {
      if (!sound.synth) continue;
      const samples = renderSynth(sound.synth, RATE, 3);
      const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect([sound.id, peak < 0.999]).toEqual([sound.id, true]);
      expect([sound.id, rms(samples) > 0.01]).toEqual([sound.id, true]);
    }
  });
});

describe('sounds made in code (synth.ts)', () => {
  const recipe = (layers: unknown[], seconds = 0.5, loop = false) =>
    SynthSchema.parse({ seconds, loop, layers });

  it('is the same every time from the same seed, and differs with another', () => {
    const noise = recipe([{ noise: 'pink' }]);
    expect(renderSynth(noise, RATE, 5)).toEqual(renderSynth(noise, RATE, 5));
    expect(renderSynth(noise, RATE, 5)).not.toEqual(renderSynth(noise, RATE, 6));
  });

  it('a tone has its pitch, and is silent outside its time', () => {
    const tone = recipe([{ tone: 'sine', hz: 1000, at: 0.1, for: 0.2, attack: 0, release: 0 }]);
    const x = renderSynth(tone, RATE);
    expect(x.length).toBe(RATE / 2);
    let crossings = 0;
    for (let i = 0.1 * RATE + 1; i < 0.3 * RATE; i++) {
      if ((x[i - 1] ?? 0) < 0 !== (x[i] ?? 0) < 0) crossings++;
    }
    expect(crossings).toBeGreaterThan(395); // 1000 Hz for 0.2 s: 400 crossings
    expect(crossings).toBeLessThan(405);
    expect(Math.max(...x.subarray(0, 0.1 * RATE - 1).map(Math.abs))).toBe(0);
    expect(Math.max(...x.subarray(0.3 * RATE + 1).map(Math.abs))).toBe(0);
  });

  it('a filter takes out what it should: a low-passed noise has little of its highs', () => {
    const white = renderSynth(recipe([{ noise: 'white' }]), RATE);
    const low = renderSynth(
      recipe([{ noise: 'white', filter: { type: 'lowpass', hz: 300 } }]),
      RATE,
    );
    // Highs show as sample-to-sample change.
    const change = (x: Float32Array) => rms(x.map((v, i) => v - (x[i - 1] ?? 0)));
    expect(change(low) / rms(low)).toBeLessThan(0.1 * (change(white) / rms(white)));
  });

  it('a loop’s end flows into its start (no click at the seam)', () => {
    const loop = renderSynth(
      recipe([{ noise: 'brown', filter: { type: 'lowpass', hz: 200 } }], 2, true),
      RATE,
    );
    const steps = loop.map((v, i) => Math.abs(v - (loop[i - 1] ?? v)));
    const typical = steps.reduce((a, b) => a + b, 0) / steps.length;
    expect(Math.abs((loop[0] ?? 0) - (loop[loop.length - 1] ?? 0))).toBeLessThan(10 * typical);
  });

  it('a reverb falls 60 dB in its time; Sabine’s estimate grows with the room', () => {
    const [left] = impulseResponse(0.8, RATE);
    const energy = (from: number, to: number) =>
      left.subarray(from * RATE, to * RATE).reduce((s, v) => s + v * v, 0) / ((to - from) * RATE);
    const fall = 10 * Math.log10(energy(0.79, 0.81) / energy(0.01, 0.03));
    expect(fall).toBeLessThan(-55);
    expect(fall).toBeGreaterThan(-65);
    expect(roomRt60(2, 3, 2)).toBeLessThan(roomRt60(14, 3.5, 11.4));
    expect(roomRt60(14, 3.5, 11.4)).toBeLessThan(roomRt60(26, 9, 18));
  });
});
