import { expect, test } from '@playwright/test';
import { continueInto, sceneSave } from './saves';
import { Aim, approach, dial, expectDebug, openResults, shot, use, type Vec3 } from './support';

// The later physics benches (Phase T-2 adds measuring speed), moved off the projectile range by Phase T-1a (the lab's walls
// and islands, the bay, the optics room), in the real app, one test each: found in the
// catalog, reached by Continue from a save of a player standing in front of the station's board (no
// developer jump), played with keyboard and mouse: read the board, walk to the desk, set the dials
// the checklist asks for, RUN, the results on the monitor beside their theory, the run marked in
// the catalog. Five stand on the south wall (the bench ones' monitors over their bench, opened from
// the board's stand, as the incline's is beside its bench: the desk is out of reach), the lens and
// the power board on the north wall.

interface Bench {
  experiment: string;
  /** Its scene (the Physics Lab by default), the room it stands in, where the catalog says it is played. */
  scene?: string;
  room: string;
  place: string;
  /** Part of its name, in the results panel's title. */
  name: string;
  station: string;
  board: string;
  /** The board's face, 1.375 m up and 0.02 m off its wall. */
  boardFace: Vec3;
  /** Where the save stands the player, looking at the board. */
  atBoard: [number, number];
  /** The way from the board to the desk; its last point is where the player stands at the desk. */
  toDesk: [number, number][];
  /** Dials turned at the desk: target, placement suffix, key, presses. */
  dials: [Vec3, string, 'e' | 'f', number][];
  run: Vec3;
  apparatus: Vec3;
  /** The way from the desk to where the monitor is in reach (none: from the desk). */
  toMonitor: [number, number][];
  monitor: Vec3;
  /** The checklist's next step after the dials (k), after the run (k + 1), after the monitor. */
  steps: [number, number, number];
  /** Results whose simulated value must read as its theory. */
  compare: string[];
}

const BENCHES: Bench[] = [
  {
    experiment: 'specific-heat',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'specific heat capacity',
    station: 'calorimeter',
    board: 'Specific heat — instructions',
    boardFace: [18.53, 2.425, -6.45],
    atBoard: [17.1, -5.3],
    toDesk: [[17.1, -5.6]],
    dials: [
      [[17.65, 0.875, -6.4], 'calorimeter-dial-water', 'e', 1], // m 0.2 → 0.3 kg
      [[17.65, 0.875, -6.2], 'calorimeter-dial-power', 'f', 1], // P 40 → 20 W
    ],
    run: [17.65, 0.875, -5.55],
    apparatus: [18.6, 1.05, -5.6],
    toMonitor: [],
    monitor: [18.95, 1.775, -5.15],
    steps: [3, 4, 5],
    compare: ['finalTemperature', 'temperatureRise', 'energy'],
  },
  {
    experiment: 'latent-heat',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'latent heat of fusion',
    station: 'ice',
    board: 'Latent heat of fusion — instructions',
    boardFace: [18.53, 2.425, -3.876],
    atBoard: [17.1, -3.876],
    toDesk: [[17.1, -3.026]],
    dials: [
      [[17.65, 0.875, -3.826], 'ice-dial-power', 'e', 1], // P 36 → 48 W
      [[17.65, 0.875, -3.626], 'ice-dial-heating', 'f', 1], // t 4 → 2 min
    ],
    run: [17.65, 0.875, -2.976],
    apparatus: [18.6, 1.1, -3.026],
    toMonitor: [],
    monitor: [18.95, 1.775, -2.576],
    steps: [3, 4, 5],
    compare: [
      'meltHeated',
      'meltControl',
      'meltByHeater',
      'energy',
      'latentHeatSeen',
      'latentHeatUncorrected',
    ],
  },
  {
    experiment: 'boyle',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: "Boyle's law",
    station: 'boyle',
    board: "Boyle's law — instructions",
    boardFace: [18.53, 2.425, 2.176],
    atBoard: [17.1, 2.176],
    toDesk: [[17.1, 3.026]],
    dials: [
      [[17.65, 0.875, 2.226], 'boyle-dial-end', 'f', 1], // V 30 → 25 mL
      [[17.65, 0.875, 2.426], 'boyle-dial-start', 'f', 1], // V0 60 → 40 mL
    ],
    run: [17.65, 0.875, 3.076],
    apparatus: [18.6, 1.1, 3.026],
    toMonitor: [],
    monitor: [18.95, 1.775, 3.476],
    steps: [3, 4, 5],
    compare: ['volume', 'pressure', 'pressureVolume', 'inverseVolume'],
  },
  {
    experiment: 'charles',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: "Charles's law",
    station: 'charles',
    board: "Charles's law — instructions",
    boardFace: [18.53, 2.425, 5.45],
    atBoard: [17.1, 5.45],
    toDesk: [[17.1, 6.3]],
    dials: [
      [[17.65, 0.875, 5.5], 'charles-dial-bath', 'e', 1], // t 60 → 80 °C
      [[17.65, 0.875, 5.7], 'charles-dial-start', 'e', 1], // L0 10 → 12 cm
    ],
    run: [17.65, 0.875, 6.35],
    apparatus: [18.6, 1.05, 6.3],
    toMonitor: [],
    monitor: [18.95, 1.775, 6.75],
    steps: [3, 4, 5],
    compare: ['temperature', 'length'],
  },
  {
    experiment: 'magnetic-force',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'force on a current',
    station: 'balance',
    board: 'Magnetic force — instructions',
    boardFace: [16.45, 2.425, 7.03],
    atBoard: [16.45, 5.6],
    toDesk: [[15.6, 5.6]],
    dials: [
      [[16.4, 0.875, 6.15], 'balance-dial-current', 'e', 1], // I 2 → 3 A
      [[16.2, 0.875, 6.15], 'balance-dial-wire', 'e', 1], // L 4 → 8 cm
    ],
    run: [15.55, 0.875, 6.15],
    apparatus: [15.6, 1.05, 7.1],
    toMonitor: [],
    monitor: [15.15, 1.775, 7.45],
    steps: [3, 4, 5],
    compare: ['balanceReading', 'force'],
  },
  {
    experiment: 'induction',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'Electromagnetic induction',
    station: 'induction',
    board: 'Electromagnetic induction — instructions',
    boardFace: [14.15, 2.425, -2.612],
    atBoard: [14.15, -1.132],
    toDesk: [
      [15, -1.132],
      [15, -1.132],
    ],
    dials: [
      [[14.2, 0.875, -1.682], 'induction-dial-speed', 'e', 1], // v 0.5 → 1 m/s
      [[14.4, 0.875, -1.682], 'induction-dial-turns', 'e', 1], // N 400 → 800
    ],
    run: [15.05, 0.875, -1.682],
    apparatus: [15, 0.98, -2.632],
    toMonitor: [],
    monitor: [14.95, 1.65, -2.927],
    steps: [3, 4, 5],
    compare: ['firstPeak', 'secondPeak', 'peakEmf'],
  },
  {
    experiment: 'radioactive-decay',
    room: 'pendulum-bay',
    place: 'Played in Physics Laboratory · Pendulum bay',
    name: 'Radioactive decay',
    station: 'decay',
    board: 'Radioactive decay — instructions',
    boardFace: [0.35, 2.425, -15.28],
    atBoard: [0.35, -13.85],
    toDesk: [[1.2, -13.85]],
    dials: [
      [[0.4, 0.875, -14.4], 'decay-dial-half', 'f', 1], // Pa-234m → 30 s
      [[0.6, 0.875, -14.4], 'decay-dial-draw', 'e', 1], // count 1 → 2
    ],
    run: [1.25, 0.875, -14.4],
    apparatus: [1.2, 0.98, -15.35],
    toMonitor: [],
    monitor: [1.65, 1.775, -15.7],
    steps: [3, 4, 5],
    compare: [],
  },
  {
    experiment: 'resonance',
    room: 'pendulum-bay',
    place: 'Played in Physics Laboratory · Pendulum bay',
    name: 'Forced oscillation',
    station: 'resonance',
    board: 'Resonance — instructions',
    boardFace: [-2.25, 2.425, -15.28],
    atBoard: [-2.25, -13.85],
    toDesk: [[-1.4, -13.85]],
    dials: [
      [[-2.2, 0.875, -14.4], 'resonance-dial-drive', 'e', 1], // f 1.5 → 1.8 Hz
      [[-2, 0.875, -14.4], 'resonance-dial-damping', 'e', 1], // ζ 0.1 → 0.2
    ],
    run: [-1.35, 0.875, -14.4],
    apparatus: [-1.4, 1.3, -15.35],
    toMonitor: [],
    monitor: [-0.95, 1.775, -15.7],
    steps: [3, 4, 5],
    compare: ['steadyAmplitude'],
  },
  {
    experiment: 'sound-frequency',
    room: 'waves-optics',
    place: 'Played in Physics Laboratory · Waves & Optics Room',
    name: 'Measuring the frequency',
    station: 'sound',
    board: 'Sound frequency — instructions',
    boardFace: [24.45, 2.425, 5.23],
    atBoard: [24.45, 3.8],
    toDesk: [[23.6, 3.8]],
    dials: [
      [[24.4, 0.875, 4.35], 'sound-dial-frequency', 'e', 1], // fork 440 → 512 Hz
      [[24.2, 0.875, 4.35], 'sound-dial-time', 'e', 1], // time base 0.5 → 1 ms/div
    ],
    run: [23.55, 0.875, 4.35],
    apparatus: [23.6, 1.05, 5.3],
    toMonitor: [],
    monitor: [23.15, 1.775, 5.65],
    steps: [3, 4, 5],
    compare: ['period', 'divisions', 'frequency'],
  },
  {
    experiment: 'double-slit',
    room: 'waves-optics',
    place: 'Played in Physics Laboratory · Waves & Optics Room',
    name: "Young's double slit",
    station: 'young',
    board: "Young's double slit — instructions",
    boardFace: [20.15, 2.425, -5.23],
    atBoard: [20.15, -3.8],
    toDesk: [[21, -3.8]],
    dials: [
      [[20.2, 0.875, -4.35], 'young-dial-wavelength', 'f', 1], // red → green laser
      [[20.6, 0.875, -4.35], 'young-dial-screen', 'e', 1], // D 1.0 → 1.5 m
    ],
    run: [21.05, 0.875, -4.35],
    apparatus: [21, 1.05, -5.3],
    toMonitor: [],
    monitor: [21.45, 1.775, -5.65],
    steps: [3, 4, 5],
    compare: ['tenFringes', 'fringeSpacing', 'wavelengthFromFringes'],
  },
  {
    experiment: 'ripple-tank',
    room: 'waves-optics',
    place: 'Played in Physics Laboratory · Waves & Optics Room',
    name: 'Interference of water waves',
    station: 'ripple',
    board: 'Ripple tank — instructions',
    boardFace: [22.75, 2.425, -5.23],
    atBoard: [22.75, -3.8],
    toDesk: [[23.6, -3.8]],
    dials: [
      [[22.8, 0.875, -4.35], 'ripple-dial-frequency', 'e', 1], // f 20 → 25 Hz
      [[23.0, 0.875, -4.35], 'ripple-dial-sources', 'f', 1], // S1S2 6 → 4 cm
    ],
    run: [23.65, 0.875, -4.35],
    apparatus: [23.6, 1.05, -5.3],
    toMonitor: [],
    monitor: [24.05, 1.775, -5.65],
    steps: [3, 4, 5],
    compare: ['maxima', 'maximaSpan', 'waveSpeed'],
  },
  {
    experiment: 'electric-field',
    room: 'waves-optics',
    place: 'Played in Physics Laboratory · Waves & Optics Room',
    name: 'electric field of point charges',
    station: 'field',
    board: 'Electric field — instructions',
    boardFace: [23.4, 2.425, 0.02],
    atBoard: [23.4, 1.5],
    toDesk: [[24.25, 1.5]],
    dials: [
      [[23.65, 0.875, 0.95], 'field-dial-second', 'e', 1], // Q2 none → +5 nC
      [[23.85, 0.875, 0.95], 'field-dial-distance', 'e', 1], // r 10 → 20 cm
    ],
    run: [24.3, 0.875, 0.95],
    apparatus: [24.25, 1.05, 0],
    toMonitor: [],
    monitor: [24.7, 1.775, -0.35],
    steps: [3, 4, 5],
    compare: ['fieldOne', 'fieldTwo', 'fieldSum', 'force'],
  },
  {
    experiment: 'standing-wave',
    room: 'waves-optics',
    place: 'Played in Physics Laboratory · Waves & Optics Room',
    name: 'Standing waves',
    station: 'string',
    board: 'Standing waves — instructions',
    boardFace: [25.35, 2.425, -5.23],
    atBoard: [25.35, -3.8],
    toDesk: [[26.2, -3.8]],
    dials: [
      [[25.4, 0.875, -4.35], 'string-dial-loops', 'e', 1], // n 2 → 3
      [[25.6, 0.875, -4.35], 'string-dial-hanging', 'e', 1], // m 100 → 200 g
    ],
    run: [26.25, 0.875, -4.35],
    apparatus: [26.2, 1.05, -5.3],
    toMonitor: [],
    monitor: [26.65, 1.775, -5.65],
    steps: [3, 4, 5],
    compare: ['resonantFrequency', 'wavelength', 'waveSpeed'],
  },
  {
    experiment: 'speed-of-sound',
    room: 'waves-optics',
    place: 'Played in Physics Laboratory · Waves & Optics Room',
    name: 'The speed of sound',
    station: 'tube',
    board: 'Speed of sound — instructions',
    boardFace: [21.85, 2.425, 5.23],
    atBoard: [21.85, 3.8],
    toDesk: [[21, 3.8]],
    dials: [
      [[21.8, 0.875, 4.35], 'tube-dial-frequency', 'f', 1], // fork 512 → 440 Hz
      [[21.6, 0.875, 4.35], 'tube-dial-temperature', 'e', 1], // t 20 → 25 °C
    ],
    run: [20.95, 0.875, 4.35],
    apparatus: [21, 1.4, 5.3],
    toMonitor: [],
    monitor: [20.55, 1.775, 5.65],
    steps: [3, 4, 5],
    compare: ['firstResonance', 'secondResonance', 'speedOfSound'],
  },
  {
    experiment: 'capacitor',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'Charging and discharging',
    station: 'rc',
    board: 'Capacitor — instructions',
    boardFace: [13.983, 2.425, 7.03],
    atBoard: [13.983, 5.6],
    toDesk: [[13.133, 5.6]],
    dials: [
      [[13.933, 0.875, 6.15], 'rc-dial-resistance', 'e', 1], // R 1 → 2.2 kΩ
      [[13.733, 0.875, 6.15], 'rc-dial-capacitance', 'f', 1], // C 1000 → 470 µF
    ],
    run: [13.083, 0.875, 6.15],
    apparatus: [13.133, 1.05, 7.1],
    toMonitor: [],
    monitor: [12.683, 1.775, 7.45],
    steps: [3, 4, 5],
    compare: ['timeConstantSeen'],
  },
  {
    experiment: 'cell-emf',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'EMF and internal resistance',
    station: 'emf',
    board: 'EMF and internal resistance — instructions',
    boardFace: [10.517, 2.425, 7.03],
    atBoard: [10.517, 5.6],
    toDesk: [[9.667, 5.6]],
    dials: [
      [[10.467, 0.875, 6.15], 'emf-dial-cell', 'e', 1], // new → used cell
      [[10.267, 0.875, 6.15], 'emf-dial-rheostat', 'e', 1], // R 4 → 6 Ω
    ],
    run: [9.617, 0.875, 6.15],
    apparatus: [9.667, 1.05, 7.1],
    toMonitor: [],
    monitor: [9.217, 1.775, 7.45],
    steps: [3, 4, 5],
    compare: ['voltage', 'current', 'power'],
  },
  {
    experiment: 'force-composition',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'Composition of concurrent forces',
    station: 'forces',
    board: 'Composition of forces — instructions',
    boardFace: [4.817, 2.425, -7.03],
    atBoard: [4.817, -5.6],
    toDesk: [[5.667, -5.6]],
    dials: [
      [[4.867, 0.875, -6.15], 'forces-dial-force1', 'e', 1], // F1 3 → 4 N
      [[5.267, 0.875, -6.15], 'forces-dial-angle', 'e', 1], // α 90 → 120°
    ],
    run: [5.717, 0.875, -6.15],
    apparatus: [5.667, 1.2, -7.1],
    toMonitor: [],
    monitor: [6.117, 1.775, -7.45],
    steps: [3, 4, 5],
    compare: ['reading3', 'resultantAngle', 'resultantSquared'],
  },
  {
    experiment: 'moment-of-force',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'Moment of a force',
    station: 'lever',
    board: 'Moment of a force — instructions',
    boardFace: [8.283, 2.425, -7.03],
    atBoard: [8.283, -5.6],
    toDesk: [[9.133, -5.6]],
    dials: [
      [[8.333, 0.875, -6.15], 'lever-dial-mass1', 'e', 1], // m1 100 → 150 g
      [[8.933, 0.875, -6.15], 'lever-dial-distance2', 'e', 1], // d2 25 → 30 cm
    ],
    run: [9.183, 0.875, -6.15],
    apparatus: [9.133, 1.2, -7.1],
    toMonitor: [],
    monitor: [9.583, 1.775, -7.45],
    steps: [3, 4, 5],
    compare: ['moment1', 'moment2', 'netMoment'],
  },
  {
    experiment: 'liquid-pressure',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'Pressure in a liquid',
    station: 'pressure',
    board: 'Liquid pressure — instructions',
    boardFace: [15.85, 2.425, 2.612],
    atBoard: [15.85, 1.132],
    toDesk: [
      [15, 1.132],
      [15, 1.132],
    ],
    dials: [
      [[15.8, 0.875, 1.682], 'pressure-dial-liquid', 'e', 1], // water → salt water
      [[15.6, 0.875, 1.682], 'pressure-dial-depth', 'f', 1], // h 20 → 15 cm
    ],
    run: [14.95, 0.875, 1.682],
    apparatus: [15, 1.2, 2.632],
    toMonitor: [],
    monitor: [15.05, 1.65, 2.927],
    steps: [3, 4, 5],
    compare: ['gaugePressure', 'pressure', 'manometerDifference'],
  },
  {
    experiment: 'measuring-speed',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'Measuring speed',
    station: 'speed',
    board: 'Measuring speed — instructions',
    boardFace: [4.017, 2.425, -2.612],
    atBoard: [4.017, -1.132],
    toDesk: [
      [4.867, -1.132],
      [4.867, -1.132],
    ],
    dials: [
      [[4.067, 0.875, -1.682], 'speed-dial-angle', 'e', 1], // α 10 → 15°
      [[4.267, 0.875, -1.682], 'speed-dial-gate', 'f', 1], // x_B 0.8 → 0.7 m
    ],
    run: [4.917, 0.875, -1.682],
    apparatus: [4.867, 1.1, -2.632],
    toMonitor: [],
    monitor: [4.817, 1.65, -2.927],
    steps: [3, 4, 5],
    compare: ['speedA', 'speedB', 'averageSpeed'],
  },
  {
    experiment: 'newtons-second-law',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: "Newton's second law",
    station: 'newton',
    board: "Air track: uniform motion and Newton's second law — instructions",
    boardFace: [1.15, 2.425, 2.612],
    atBoard: [1.15, 1.132],
    toDesk: [
      [0.3, 1.132],
      [0.3, 1.132],
    ],
    dials: [
      [[1.1, 0.875, 1.682], 'newton-dial-hanging', 'e', 1], // m 10 → 15 g
      [[0.7, 0.875, 1.682], 'newton-dial-gate', 'f', 1], // x_B 0.6 → 0.5 m
    ],
    run: [0.05, 0.875, 1.682],
    apparatus: [0.3, 1.05, 2.632],
    toMonitor: [],
    monitor: [-0.15, 1.65, 2.927],
    steps: [3, 4, 5],
    compare: ['speedA', 'speedB', 'measuredAcceleration'],
  },
  {
    experiment: 'atwood-machine',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'Atwood machine',
    station: 'atwood',
    board: 'Atwood machine — instructions',
    boardFace: [-0.55, 2.625, -2.612],
    atBoard: [-0.55, -1.132],
    toDesk: [
      [0.3, -1.132],
      [0.3, -1.132],
    ],
    dials: [
      [[-0.3, 0.875, -1.682], 'atwood-dial-extra', 'e', 1], // Δm 20 → 40 g
      [[-0.1, 0.875, -1.682], 'atwood-dial-height', 'e', 1], // h 0.6 → 0.8 m
    ],
    run: [0.35, 0.875, -1.682],
    apparatus: [0.85, 1.5, -2.632],
    toMonitor: [],
    monitor: [-0.15, 1.65, -2.927],
    steps: [3, 4, 5],
    compare: ['fallTime', 'measuredAcceleration', 'gravityEstimate'],
  },
  {
    experiment: 'buoyancy',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'Density and buoyancy',
    station: 'buoyancy',
    board: 'Density and buoyancy — instructions',
    boardFace: [15.217, 2.425, -7.03],
    atBoard: [15.217, -5.6],
    toDesk: [[16.067, -5.6]],
    dials: [
      [[15.267, 0.875, -6.15], 'buoyancy-dial-material', 'e', 1], // aluminium → copper
      [[15.467, 0.875, -6.15], 'buoyancy-dial-liquid', 'e', 1], // water → sea water
    ],
    run: [16.117, 0.875, -6.15],
    apparatus: [16.067, 1.25, -7.1],
    toMonitor: [],
    monitor: [16.517, 1.775, -7.45],
    steps: [3, 4, 5],
    compare: ['buoyantForce', 'density', 'displacedVolume'],
  },
  {
    experiment: 'mechanical-energy',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'mechanical energy',
    station: 'energy',
    board: 'Mechanical energy — instructions',
    boardFace: [5.717, 2.425, 2.612],
    atBoard: [5.717, 1.132],
    toDesk: [
      [4.867, 1.132],
      [4.867, 1.132],
    ],
    dials: [[[5.667, 0.875, 1.682], 'energy-dial-height', 'e', 1]], // h 0.2 → 0.25 m
    run: [4.817, 0.875, 1.682],
    apparatus: [4.867, 1.2, 2.632],
    toMonitor: [],
    monitor: [4.917, 1.65, 2.927],
    steps: [2, 3, 4],
    compare: ['startEnergy', 'kineticA', 'turnHeight'],
  },
  {
    experiment: 'collisions',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'Collisions',
    station: 'collision',
    board: 'Collisions — instructions',
    boardFace: [9.35, 2.425, -2.612],
    atBoard: [9.35, -1.132],
    toDesk: [
      [10.2, -1.132],
      [10.2, -1.132],
    ],
    dials: [
      [[9.8, 0.875, -1.682], 'collision-dial-bumpers', 'f', 1], // e 1 → 0.9
      [[9.4, 0.875, -1.682], 'collision-dial-mass', 'e', 1], // m_A 0.3 → 0.4 kg
    ],
    run: [10.25, 0.875, -1.682],
    apparatus: [10.2, 1.05, -2.632],
    toMonitor: [],
    monitor: [10.15, 1.65, -2.927],
    steps: [3, 4, 5],
    compare: ['momentumBefore', 'momentumAfter', 'velocityB'],
  },
  {
    experiment: 'circular-motion',
    room: 'pendulum-bay',
    place: 'Played in Physics Laboratory · Pendulum bay',
    name: 'circular motion',
    station: 'whirl',
    board: 'Uniform circular motion — instructions',
    boardFace: [-4.53, 2.425, -13.5],
    atBoard: [-2.95, -13.35],
    toDesk: [
      [-2.95, -14.2],
      [-2.95, -14.2],
    ],
    dials: [
      [[-3.5, 0.875, -13.4], 'whirl-dial-length', 'e', 1], // L 0.3 → 0.35 m
      [[-3.5, 0.875, -13.6], 'whirl-dial-hanging-mass', 'e', 1], // M 0.2 → 0.3 kg
    ],
    run: [-3.5, 0.875, -14.25],
    apparatus: [-4.6, 1.3, -14.2],
    toMonitor: [],
    monitor: [-4.95, 2, -14.15],
    steps: [3, 4, 5],
    compare: ['period', 'angularVelocity', 'tension'],
  },
  {
    experiment: 'reflection',
    room: 'waves-optics',
    place: 'Played in Physics Laboratory · Waves & Optics Room',
    name: 'Reflection',
    station: 'mirror',
    board: 'Reflection — instructions',
    boardFace: [28.78, 2.425, 1.45],
    atBoard: [27.35, 1.45],
    toDesk: [[27.35, 2.3]],
    dials: [[[27.9, 0.875, 1.5], 'mirror-dial-angle', 'e', 1]], // θ 30 → 45°
    run: [27.9, 0.875, 2.35],
    apparatus: [28.85, 0.95, 2.3],
    toMonitor: [],
    monitor: [29.2, 1.775, 2.75],
    steps: [2, 3, 4],
    compare: ['incidence', 'reflection', 'between'],
  },
  {
    experiment: 'converging-lens',
    room: 'waves-optics',
    place: 'Played in Physics Laboratory · Waves & Optics Room',
    name: 'Converging lens',
    station: 'lens',
    board: 'Converging lens — instructions',
    boardFace: [27.05, 2.425, 5.23],
    atBoard: [27.05, 3.8],
    toDesk: [
      [26.2, 3.8],
      [26.2, 3.8],
    ],
    dials: [
      [[27, 0.875, 4.35], 'lens-dial-focal', 'e', 1], // f 0.1 → 0.15 m
      [[26.8, 0.875, 4.35], 'lens-dial-object', 'e', 1], // u 0.3 → 0.4 m
    ],
    run: [26.15, 0.875, 4.35],
    apparatus: [26.2, 1.1, 5.3],
    toMonitor: [],
    monitor: [26.35, 1.75, 5.65],
    steps: [3, 4, 5],
    compare: ['focalLength', 'inverseObjectDistance', 'distanceSum'],
  },
  {
    experiment: 'electrical-power',
    room: 'physics-lab',
    place: 'Played in Physics Laboratory',
    name: 'Electrical power',
    station: 'power',
    board: 'Electrical power — instructions',
    boardFace: [7.05, 2.425, 7.03],
    atBoard: [7.05, 5.6],
    toDesk: [[6.2, 5.6]],
    dials: [
      [[7, 0.875, 6.15], 'power-dial-circuit', 'e', 1], // series → parallel
      [[6.8, 0.875, 6.15], 'power-dial-voltage', 'f', 1], // U 12 → 9 V
    ],
    run: [6.15, 0.875, 6.15],
    apparatus: [6.2, 1.05, 7.1],
    toMonitor: [],
    monitor: [5.75, 1.775, 7.45],
    steps: [3, 4, 5],
    compare: ['power', 'current', 'power1'],
  },
  {
    experiment: 'transpiration',
    scene: 'biology-lab',
    room: 'biology-lab',
    place: 'Played in Biology Laboratory',
    name: 'Transpiration',
    station: 'transpiration',
    board: 'Transpiration — instructions',
    boardFace: [-8.45, 2.425, 2.98],
    atBoard: [-8.45, 1.5],
    toDesk: [
      [-9.3, 1.5],
      [-9.3, 1.5],
    ],
    dials: [
      [[-8.5, 0.875, 2.05], 'transpiration-dial-light', 'e', 1], // I 10 000 → 20 000 lux
      [[-8.7, 0.875, 2.05], 'transpiration-dial-humidity', 'f', 1], // RH 50 → 30 %
    ],
    run: [-9.35, 0.875, 2.05],
    apparatus: [-9.3, 1.3, 3.0],
    toMonitor: [],
    monitor: [-9.25, 1.65, 3.295],
    steps: [3, 4, 5],
    compare: ['distance', 'uptake', 'transpirationRate'],
  },
  {
    experiment: 'solubility',
    scene: 'chemistry-lab',
    room: 'chemistry-lab',
    place: 'Played in Chemistry Laboratory',
    name: 'Solubility',
    station: 'solubility',
    board: 'Solubility — instructions',
    boardFace: [7.45, 2.425, 1.58],
    atBoard: [7.45, 0.1],
    toDesk: [
      [6.6, 0.1],
      [6.6, 0.1],
    ],
    dials: [
      [[7.4, 0.875, 0.65], 'solubility-dial-solid', 'e', 1], // KNO₃ → NaCl
      [[7.2, 0.875, 0.65], 'solubility-dial-temperature', 'e', 1], // 20 → 40 °C
    ],
    run: [6.55, 0.875, 0.65],
    apparatus: [6.6, 1.2, 1.6],
    toMonitor: [],
    monitor: [6.65, 1.65, 1.895],
    steps: [3, 4, 5],
    compare: ['residue', 'dissolved', 'concentration'],
  },
  {
    experiment: 'seed-respiration',
    scene: 'biology-lab',
    room: 'biology-lab',
    place: 'Played in Biology Laboratory',
    name: 'Respiration of germinating seeds',
    station: 'respiration',
    board: 'Respiration — instructions',
    boardFace: [-11.45, 2.425, 6.08],
    atBoard: [-11.45, 4.6],
    toDesk: [
      [-12.3, 4.6],
      [-12.3, 4.6],
    ],
    dials: [
      [[-11.5, 0.875, 5.15], 'respiration-dial-seeds', 'e', 1], // peas → sunflower seeds
      [[-11.7, 0.875, 5.15], 'respiration-dial-temperature', 'e', 1], // T 20 → 25 °C
    ],
    run: [-12.35, 0.875, 5.15],
    apparatus: [-12.3, 1.3, 6.1],
    toMonitor: [],
    monitor: [-12.25, 1.65, 6.395],
    steps: [3, 4, 5],
    compare: ['gasTakenUp', 'uptakeRate'],
  },
  {
    experiment: 'mendelian-cross',
    scene: 'biology-lab',
    room: 'biology-lab',
    place: 'Played in Biology Laboratory',
    name: 'Mendel',
    station: 'pea-cross',
    board: 'Pea cross — instructions',
    boardFace: [2.35, 2.425, 4.18],
    atBoard: [2.35, 2.7],
    toDesk: [
      [1.5, 2.7],
      [1.5, 2.7],
    ],
    dials: [
      [[2.3, 0.875, 3.25], 'pea-cross-dial-parent1', 'f', 1], // P₁ YyRr → Yyrr
      [[2.1, 0.875, 3.25], 'pea-cross-dial-parent2', 'f', 1], // P₂ YyRr → Yyrr
    ],
    run: [1.45, 0.875, 3.25],
    apparatus: [1.5, 1.3, 4.2],
    toMonitor: [],
    monitor: [1.55, 1.65, 4.495],
    steps: [3, 4, 5],
    compare: ['degreesOfFreedom', 'smallestExpected'],
  },
  {
    experiment: 'mark-recapture',
    scene: 'biology-lab',
    room: 'biology-lab',
    place: 'Played in Biology Laboratory',
    name: 'Estimating a population',
    station: 'mark-recapture',
    board: 'Mark and recapture — instructions',
    boardFace: [2.35, 2.425, -2.52],
    atBoard: [2.35, -4],
    toDesk: [
      [1.5, -4],
      [1.5, -4],
    ],
    dials: [
      [[2.3, 0.875, -3.45], 'mark-recapture-dial-marked', 'e', 1], // M 50 → 80
      [[2.1, 0.875, -3.45], 'mark-recapture-dial-caught', 'e', 1], // C 50 → 80
    ],
    run: [1.45, 0.875, -3.45],
    apparatus: [1.5, 1.3, -2.5],
    toMonitor: [],
    monitor: [1.55, 1.65, -2.205],
    steps: [3, 4, 5],
    compare: [],
  },
  {
    experiment: 'food-tests',
    scene: 'biology-lab',
    room: 'biology-lab',
    place: 'Played in Biology Laboratory',
    name: 'Tests for biological molecules',
    station: 'food-tests',
    board: 'Food tests — instructions',
    boardFace: [-11.55, 2.425, -3.02],
    atBoard: [-11.55, -4.5],
    toDesk: [
      [-12.4, -4.5],
      [-12.4, -4.5],
    ],
    dials: [
      [[-11.6, 0.875, -3.95], 'food-tests-dial-sample', 'e', 1], // sample A → B
      [[-11.8, 0.875, -3.95], 'food-tests-dial-test', 'e', 1], // iodine → Benedict’s
    ],
    run: [-12.45, 0.875, -3.95],
    apparatus: [-12.4, 1.3, -3],
    toMonitor: [],
    monitor: [-12.35, 1.65, -2.705],
    steps: [3, 4, 5],
    compare: ['colour', 'positive'],
  },
];

for (const b of BENCHES) {
  test(`${b.experiment}: Continue, read, dials, RUN, results against theory`, async ({ page }) => {
    test.setTimeout(240_000);
    const station = (pattern: string, timeout = 15_000) =>
      expect(page.locator('.debug-text')).toContainText(
        new RegExp(`Station:\\s+${b.room}/${b.station} ${pattern}`),
        { timeout },
      );
    const walk = async (aim: Aim, way: [number, number][]) => {
      for (const [x, z] of way) await approach(page, aim, x, z);
    };

    await page.goto('/');
    // An experiment in two topics is listed under each: the first will do.
    const item = page.locator(`.menu-catalog-item[data-experiment="${b.experiment}"]`).first();
    await page.getByRole('button', { name: 'Experiment catalog' }).click();
    await expect(item.locator('.menu-place')).toHaveText(b.place);
    await expect(item.locator('.menu-run')).toHaveText('Not yet run to the end');

    const board = b.boardFace;
    const errors = await continueInto(
      page,
      sceneSave(b.scene ?? 'physics-lab', [b.atBoard[0], 0, b.atBoard[1]], board),
    );
    const aim = new Aim(page);
    await aim.sync();
    await expectDebug(page, 'Room', b.room);

    // 1. Read the board, walk to the desk, set the dials.
    await use(page, aim, board, `${b.room}/${b.station}-instructions`, 'Inspect');
    await expect(page.locator('.hud-toast').last()).toContainText(b.board);
    await walk(aim, b.toDesk);
    await station('configured .*step 1/6');
    for (const [target, id, key, times] of b.dials) {
      await dial(page, aim, target, `${b.room}/${id}`, key, times);
    }
    await station(`configured .*step ${b.steps[0]}/6`);

    // 2. RUN to the end.
    await use(page, aim, b.run, `${b.room}/${b.station}-run`, 'RUN');
    await station(`completed .*step ${b.steps[1]}/6`, 90_000);
    await aim.at(b.apparatus);
    await page.waitForTimeout(400);
    await shot(page, `${b.experiment}-1-run`);

    // 3. The monitor: the run's values read as their theory (the model is exact).
    await walk(aim, b.toMonitor);
    const panel = await openResults(page, aim, b.monitor, `${b.room}/${b.station}-monitor`);
    await expect(panel.locator('h2')).toContainText(b.name);
    await expect(panel.locator('h2')).toContainText('run 1 (completed)');
    for (const id of b.compare) {
      const row = panel.locator(`tr[data-result="${id}"]`);
      const theory = (await row.locator('.theory').textContent())?.trim() ?? '';
      expect(theory, id).toMatch(/\d/);
      await expect(row.locator('.measured'), id).toHaveText(theory);
    }
    // At the desk or the board's stand the station is the nearest: the step counts the monitor read.
    await station(`completed .*step ${b.steps[2]}/6`);
    await shot(page, `${b.experiment}-2-results`);

    // 4. Back in the menu (the game saves on leaving the page): the run is marked in the catalog.
    await page.reload();
    await page.getByRole('button', { name: 'Experiment catalog' }).click();
    await expect(item.locator('.menu-run')).toHaveText('Run completed');
    expect(errors).toEqual([]);
  });
}
