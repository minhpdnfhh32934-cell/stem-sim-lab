import { describe, expect, it } from 'vitest';
import strings from '../../../content/strings.json';
import { createTexts, ENGLISH } from '../../../core/i18n';
import { burnAt } from '../../../simulation/rocketBurn';
import { Swoop, SWOOP_PAST_ROOF } from '../../../simulation/rocketSwoop';
import { CABIN_AIR, rocketNotes, screenAngle } from './rocketNotes';

const VI = createTexts(strings, () => 'vi');
const swoop = new Swoop(SWOOP_PAST_ROOF);
const chem = swoop.stateAt(-4.34);
const phys = swoop.stateAt(-4.25);
const bio = swoop.stateAt(-1.1);
const notesIn = (texts = ENGLISH) => rocketNotes(texts, SWOOP_PAST_ROOF, chem, phys, bio);
/** A shown number back as a number (narrow spaces out, the decimal mark a point). */
const read = (text: string) =>
  Number(
    text
      .replace(/\u202f/g, '')
      .replace(',', '.')
      .split(' ')[0],
  );
const size = (v: readonly number[]) => Math.hypot(...v);

describe('the rocket opening’s notes', () => {
  it('shows the swoop’s forces at the pull-out, rounded only', () => {
    const [thrust, weight, drag, net, accel] = notesIn().phys.rows;
    expect(read(thrust!.value)).toBeCloseTo(size(phys.thrust) / 1e6, 2);
    expect(read(weight!.value)).toBeCloseTo(size(phys.weight) / 1e6, 2);
    expect(read(drag!.value)).toBeCloseTo(size(phys.drag) / 1e3, 1);
    expect(read(net!.value)).toBeCloseTo(size(phys.net) / 1e6, 2);
    expect(read(accel!.value)).toBeCloseTo(size(phys.accel), 1);
    // Weight straight down; the net force up (the dive bending into a climb).
    expect(Math.abs(weight!.angle!)).toBeCloseTo(180, 9);
    expect(Math.abs(screenAngle(phys.net))).toBeLessThan(90);
  });

  it('shows the flame’s mass flows at the engines’ thrust then', () => {
    const b = burnAt(size(chem.thrust), SWOOP_PAST_ROOF.rocket.isp, SWOOP_PAST_ROOF.rocket.mixture);
    const rates = notesIn().chem.species.map((sp) => read(sp.rate));
    expect(rates).toEqual(
      [b.methane, b.oxygen, b.carbonDioxide, b.water].map((v) => Math.round(v)),
    );
    expect(read(notesIn().chem.rows[1]!.value)).toBeCloseTo(b.unburnt, 1);
  });

  it('keeps the cabin’s air whole, takes his felt acceleration from the model, says the vitals are illustrative', () => {
    const total = CABIN_AIR.air.reduce((sum, gas) => sum + gas.share, 0);
    expect(total).toBeCloseTo(100, 9);
    const notes = notesIn();
    expect(notes.bio.airRows[0]!.value).toBe('101.3 kPa · 21.2 kPa');
    expect(read(notes.bio.vitals[5]!.value)).toBeCloseTo(bio.felt, 2);
    expect(notes.bio.note).toMatch(/illustrative/);
  });

  it('writes Vietnamese with decimal commas', () => {
    const notes = notesIn(VI);
    expect(notes.phys.rows[1]!.value).toMatch(/^\d,\d\d MN$/);
    expect(notes.clock(0.03)).toBe('0,03×');
    expect(notes.bio.note).toMatch(/minh hoạ/);
  });
});
