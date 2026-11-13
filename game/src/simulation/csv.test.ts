import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { csvColumn, csvFileName, runCsv } from './csv';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from './experiment';
import { ExperimentSession } from './ExperimentSession';
import { quantize, readings } from './measurement';
import { pendulumModel } from './models/pendulum';
import { projectileModel } from './models/projectile';
import type { RunRecord } from './RunRecord';

const parse = (id: string): ExperimentDefinition =>
  ExperimentDefinitionSchema.parse(
    (bundledContent.experiments as { id: string }[]).find((e) => e.id === id),
  );
const projectile = parse('projectile-motion');
const pendulum = parse('pendulum');

/** A station's session with one finished run per entry of `settings`. */
function runs(
  definition: ExperimentDefinition,
  settings: Record<string, number>[],
  apparatus: Record<string, number>,
  stopAfter?: number,
) {
  const model = definition.id === 'pendulum' ? pendulumModel : projectileModel;
  const s = new ExperimentSession(`${definition.id}-station`, definition, model);
  s.setReady(true);
  for (const values of settings) {
    if (s.run) s.reset();
    for (const [id, value] of Object.entries(values)) s.setParameter(id, value);
    s.start(apparatus);
    if (stopAfter !== undefined) {
      s.advance(stopAfter);
      s.stop();
    }
    for (let i = 0; s.state === 'running' && i < 100_000; i++) s.advance(1 / 60);
  }
  return s;
}

/** The CSV split into its `#` metadata lines, header and rows (as numbers). */
function read(csv: string) {
  expect(csv.endsWith('\r\n')).toBe(true);
  const lines = csv.slice(0, -2).split('\r\n');
  const meta = lines.filter((l) => l.startsWith('#'));
  expect(lines.slice(0, meta.length)).toEqual(meta); // all metadata comes first
  const header = (lines[meta.length] ?? '').split(',');
  const rows = lines.slice(meta.length + 1).map((l) => l.split(','));
  return { meta, header, rows };
}

describe('CSV export of a recorded run', () => {
  it('writes the projectile run: what produced it, then every sample exactly as stored', () => {
    const r = runs(projectile, [{ velocity: 8 }], { height: 0.59 }).history[0]!;
    const { meta, header, rows } = read(runCsv(r));
    expect(r.status).toBe('completed');
    expect(meta.slice(0, 4)).toEqual([
      '# SimLab 3D recorded run',
      '# Experiment: Projectile motion (projectile-motion; model kinematics.projectile)',
      '# Run: 1 at projectile-motion-station (projectile-motion-station#1)',
      `# Status: completed (model) after ${r.time} s`,
    ]);
    expect(meta).toEqual(
      expect.arrayContaining([
        '# Parameter velocity (v₀) = 8 m/s',
        '# Parameter angle (θ) = 45 °',
        '# Parameter gravity (g) = 9.81 m/s²',
        '# Input height (h) = 0.59 m',
        `# Theory range = ${r.theory()?.range} m`,
        `# Result range (Range) = ${r.results?.range} m; theory range`,
        `# Samples: ${r.sampleCount} rows; every 0.01 s of simulated time in 0.001 s model steps; ` +
          'a completed run also has a row at its end',
        '# Column vx_m_s: Horizontal velocity (m/s)',
      ]),
    );
    expect(header).toEqual(['time_s', 'x_m', 'y_m', 'vx_m_s', 'vy_m_s', 'speed_m_s']);
    expect(rows).toHaveLength(r.sampleCount);
    // Every value reads back as exactly the stored double: nothing rounded, nothing recomputed.
    rows.forEach((cells, k) => {
      expect(Number(cells[0])).toBe(r.sampleTimes[k]);
      r.sampleValues.forEach((values, i) => expect(Number(cells[i + 1])).toBe(values[k]));
    });
    const landing = rows.at(-1)!;
    expect(Number(landing[0])).toBe(r.time); // a row at the landing itself
    expect(Number(landing[1])).toBe(r.results?.range);
    expect(Number(landing[2])).toBe(0); // the ball's lowest point on the floor
  });

  it('writes the pendulum run, with a degrees copy of θ converted on export', () => {
    const r = runs(pendulum, [{ angle: 30 }], { mass: 0.5 }).history[0]!;
    const { meta, header, rows } = read(runCsv(r));
    expect(header).toEqual([
      'time_s',
      'theta_rad',
      'theta_deg',
      'omega_rad_s',
      'alpha_rad_s2',
      'x_m',
      'y_m',
      'kinetic_J',
      'potential_J',
      'energy_J',
    ]);
    expect(meta).toEqual(
      expect.arrayContaining([
        '# Parameter length (L) = 1 m',
        '# Parameter angle (θ₀) = 30 °',
        '# Input mass (m) = 0.5 kg',
        '# Input omega0 (ω₀) = 0 rad/s',
        `# Theory smallAnglePeriod = ${r.theory()?.smallAnglePeriod} s`,
        `# Theory period = ${r.theory()?.period} s`,
        `# Result period (Period vs exact theory) = ${r.results?.period} s; theory period`,
        '# Column theta_deg: Angle in degrees, converted on export (× 180/π)',
      ]),
    );
    expect(rows).toHaveLength(r.sampleCount);
    const theta = r.sampleValues[0]!;
    rows.forEach((cells, k) => {
      expect(Number(cells[1])).toBe(theta[k]);
      expect(Number(cells[2])).toBe((theta[k] ?? NaN) * (180 / Math.PI));
      for (let i = 1; i < r.sampleValues.length; i++) {
        expect(Number(cells[i + 2])).toBe(r.sampleValues[i]?.[k]);
      }
    });
    expect(Number(rows[0]?.[1])).toBe((30 * Math.PI) / 180); // released at θ₀
    expect(Number(rows[0]?.[2])).toBeCloseTo(30, 12);
  });

  it('is deterministic: the same run gives the same file, whatever happens in between', () => {
    const s = runs(pendulum, [{ angle: 30 }, { angle: 50, length: 2 }], { mass: 0.5 });
    const first = s.history[0]!;
    const before = runCsv(first);
    s.reset();
    s.setParameter('gravity', 1.62);
    s.setParameter('resolution', 0.1); // the timer too: the record keeps its own 0.01 s
    s.start({ mass: 0.5 });
    s.advance(1);
    expect(before).toContain('at resolution d = 0.01 s');
    expect(runCsv(first)).toBe(before);
    expect(runCsv(first)).toBe(runCsv(first));
    expect(before).not.toBe(runCsv(s.history[1]!));
  });

  it('marks a stopped run as incomplete and claims no results', () => {
    const r = runs(projectile, [{}], { height: 0.59 }, 0.4).history[0]!;
    expect(r.status).toBe('stopped');
    const { meta, rows } = read(runCsv(r));
    expect(meta).toContain(`# Status: stopped at ${r.time} s: incomplete; no measured results`);
    expect(meta).toContain('# Results: none (the run did not complete)');
    expect(meta.some((l) => l.startsWith('# Result '))).toBe(false);
    // Nor a reading: no uncertainty for what was never measured.
    expect(meta).toContain('# Measurements: none (the run did not complete)');
    expect(meta.some((l) => l.startsWith('# Measurement '))).toBe(false);
    expect(meta).toContain('# Parameter resolution (d) = 0.01 m'); // what it was set up with
    expect(rows).toHaveLength(r.sampleCount);
  });

  it('adds each reading after the results, from the run’s own result and resolution', () => {
    const r = runs(projectile, [{ velocity: 8 }], { height: 0.59 }).history[0]!;
    const { meta, header } = read(runCsv(r));
    const range = r.results?.range ?? NaN;
    const [reading] = readings(projectile, r);
    expect(reading?.text).toBe(quantize(range, 0.01).toFixed(2));
    expect(meta).toContain('# Parameter resolution (d) = 0.01 m');
    expect(meta).toContain(`# Result range (Range) = ${range} m; theory range`); // unrounded
    const first = meta.findIndex((l) => l.startsWith('# Measurement '));
    expect(meta[first - 1]).toMatch(/^# Result impact-speed /); // after the results
    expect(meta.slice(first, first + 5)).toEqual([
      `# Measurement range (Range R) by Tape measure: reading = ${reading?.text} m ` +
        'at resolution d = 0.01 m',
      `# Measurement range: standard uncertainty u = d/√12 = ${0.01 / Math.sqrt(12)} m; ` +
        'bound d/2 = 0.005 m',
      '# Measurement range: not included: judging where the ball landed, ' +
        "the tape's calibration and alignment, parallax",
      expect.stringMatching(/^# Measurement model: a reading is its result above/),
      expect.stringMatching(/^# Samples: /),
    ]);
    expect(header).toEqual(['time_s', 'x_m', 'y_m', 'vx_m_s', 'vy_m_s', 'speed_m_s']);
  });

  it('differs only in resolution and reading for the same run at two resolutions', () => {
    const settings = [
      { angle: 30, resolution: 0.1 },
      { angle: 30, resolution: 0.001 },
    ];
    const [coarse, fine] = runs(pendulum, settings, { mass: 0.5 }).history.map((r) =>
      read(runCsv(r)),
    );
    expect(fine?.header).toEqual(coarse?.header);
    expect(fine?.rows).toEqual(coarse?.rows); // the same samples, digit for digit
    expect(fine?.meta).toHaveLength(coarse?.meta.length ?? 0);
    const changed = coarse?.meta.filter((line, i) => line !== fine?.meta[i]);
    expect(changed).toEqual([
      expect.stringMatching(/^# Run: 1 /),
      '# Parameter resolution (d) = 0.1 s',
      expect.stringMatching(
        /^# Measurement period \(Period T\) by Timer \(period mode\): reading = \d\.\d s at resolution d = 0\.1 s$/,
      ),
      `# Measurement period: standard uncertainty u = d/√12 = ${0.1 / Math.sqrt(12)} s; ` +
        'bound d/2 = 0.05 s',
    ]);
  });

  it('writes no measurement lines for an experiment without instruments', () => {
    const r = runs({ ...projectile, instruments: [] }, [{}], { height: 0.59 }).history[0]!;
    expect(runCsv(r)).not.toMatch(/# Measurement/);
  });

  it('names columns and files with safe ASCII', () => {
    expect(csvColumn('alpha', 'rad/s²')).toBe('alpha_rad_s2');
    expect(csvColumn('angle', '°')).toBe('angle_deg');
    expect(csvColumn('count', '')).toBe('count');
    const s = runs(pendulum, [{}, {}, {}], { mass: 0.5 });
    const [one, , three] = s.history as RunRecord[];
    expect(csvFileName(three!)).toBe('simlab-pendulum-run-003.csv');
    const shot = runs(projectile, [{}], { height: 0.59 }).history[0]!;
    expect(csvFileName(shot)).toBe('simlab-projectile-motion-run-001.csv');
    for (const name of [csvFileName(one!), csvFileName(shot)]) {
      expect(name).toMatch(/^[a-z0-9-]+\.csv$/);
    }
  });
});
