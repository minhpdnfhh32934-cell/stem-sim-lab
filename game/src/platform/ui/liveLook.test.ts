import { describe, expect, it } from 'vitest';
import { DAY_S } from '../../world/clock';
import { liveLook } from './liveLook';

const at = (hours: number) => (hours / 24) * DAY_S;

describe('the live menu’s look (Phú 2026-11-18)', () => {
  it('takes its style from the scene’s hour: day, evening, night', () => {
    expect(liveLook({ night: 0, golden: 0, clockS: at(15), yaw: 0 }).hour).toBe('day');
    expect(liveLook({ night: 0.2, golden: 0.8, clockS: at(18.5), yaw: 0 }).hour).toBe('dusk');
    expect(liveLook({ night: 0.9, golden: 0.8, clockS: at(22), yaw: 0 }).hour).toBe('night');
  });

  it('takes its layout from the turned view: behind them, before them, at her right side', () => {
    const look = (yaw: number) => liveLook({ night: 0, golden: 0, clockS: 0, yaw }).view;
    expect(look(0)).toBe('back');
    expect(look(-0.8)).toBe('back');
    expect(look(-2.6)).toBe('front');
    // As far as the wheel turns (side-on to her right, ~-4.6 rad).
    expect(look(-4.6)).toBe('side');
  });

  it('tells the scene’s time and the part of the day it is', () => {
    const l = liveLook({ night: 0, golden: 0, clockS: at(15 + 40 / 60), yaw: 0 });
    expect(l.clock).toBe('15:40');
    expect(l.part).toBe('afternoon');
    expect(liveLook({ night: 0, golden: 0, clockS: at(6), yaw: 0 }).part).toBe('morning');
    expect(liveLook({ night: 0, golden: 0, clockS: at(18.5), yaw: 0 }).part).toBe('evening');
    expect(liveLook({ night: 1, golden: 0, clockS: at(23.5), yaw: 0 }).part).toBe('night');
    // A clock past the day wraps round.
    expect(liveLook({ night: 1, golden: 0, clockS: DAY_S + at(1), yaw: 0 }).clock).toBe('01:00');
  });
});
