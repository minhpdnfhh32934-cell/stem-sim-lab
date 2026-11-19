import type { Texts } from '../../../core/i18n';
import { burnAt, COMBUSTION_KJ_PER_MOL } from '../../../simulation/rocketBurn';
import type { SwoopSpec, SwoopState } from '../../../simulation/rocketSwoop';

/*
 * What the rocket opening writes beside the rocket (Phú 2026-11-18): at its flame as the engines
 * light, at its body as it pulls out of the dive, in the cabin by Khoa. The flight's and the
 * flame's numbers are the swoop's (simulation/rocketSwoop.ts) at those moments; Khoa's vitals are
 * illustrative and say so; the cabin's air is set as sea-level air. Pure: no DOM (tested).
 */

/** Khoa's vitals: illustrative, for a fit young man about to jump (not measured). */
const VITALS = { heart: 118, systolic: 136, diastolic: 86, spo2: 98, breaths: 22, temp: 36.9 };
/** The cabin: sea-level dry air (mole %, summing to 100), its pressure, temperature, humidity. */
const AIR = [
  { formula: 'N₂', share: 78.08, color: '#2fa8ff' },
  { formula: 'O₂', share: 20.95, color: '#4fbf7a' },
  { formula: 'Ar', share: 0.93, color: '#b07ad8' },
  { formula: 'CO₂', share: 0.04, color: '#a3242b' },
] as const;
const CABIN = { kPa: 101.3, celsius: 22, humidity: 45 };

/** The forces' colours, as the arrows are drawn (wallpaper/prologue/notes3d.ts). */
export const FORCE_COLORS = {
  thrust: '#2fa8ff',
  weight: '#d8343c',
  drag: '#9a6a3c',
  net: '#111417',
} as const;

export interface Row {
  readonly label: string;
  readonly value: string;
  readonly swatch?: string;
  /** The direction it points on screen (degrees clockwise from up). */
  readonly angle?: number;
}

export interface Species {
  readonly formula: string;
  readonly name: string;
  readonly rate: string;
  readonly side: 'in' | 'out';
}

export interface RocketNotes {
  readonly chem: {
    readonly subject: string;
    readonly title: string;
    readonly equation: string;
    readonly species: readonly Species[];
    readonly rows: readonly Row[];
    readonly note: string;
  };
  readonly phys: {
    readonly subject: string;
    readonly title: string;
    readonly rows: readonly Row[];
    /** The arrows' own labels: thrust, weight, drag, net. */
    readonly tags: readonly [string, string, string, string];
    readonly note: string;
  };
  readonly bio: {
    readonly subject: string;
    readonly title: string;
    readonly illustrative: string;
    readonly vitals: readonly Row[];
    readonly airTitle: string;
    readonly air: readonly {
      readonly formula: string;
      readonly share: number;
      readonly text: string;
      readonly color: string;
    }[];
    readonly airRows: readonly Row[];
    readonly note: string;
  };
  readonly skip: string;
  /** How fast time runs, e.g. "0,03×". */
  clock(scale: number): string;
}

/**
 * A vector's direction on screen, degrees clockwise from up: the forces are seen square to the
 * flight's plane from its roof side, world x to the right, y up.
 */
export const screenAngle = (v: readonly [number, number, number]): number =>
  (Math.atan2(v[0], v[1]) * 180) / Math.PI;

const size = (v: readonly [number, number, number]) => Math.hypot(v[0], v[1], v[2]);

/** The notes, from the swoop's state at each note's moment. */
export function rocketNotes(
  texts: Texts,
  spec: SwoopSpec,
  chem: SwoopState,
  phys: SwoopState,
  bio: SwoopState,
): RocketNotes {
  const mark = texts.ui('number.decimal', '.');
  // Thousands set apart by a narrow space (SI), the decimal mark the language's.
  const n = (value: number, digits = 0) => {
    const [whole = '', part] = Math.abs(value).toFixed(digits).split('.');
    const sign = value < 0 && Number(value.toFixed(digits)) !== 0 ? '−' : '';
    return sign + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (part ? mark + part : '');
  };
  const burn = burnAt(size(chem.thrust), spec.rocket.isp, spec.rocket.mixture);
  const mn = (v: readonly [number, number, number]) => `${n(size(v) / 1e6, 2)} MN`;
  const kgs = (v: number, digits = 0) => `${n(v, digits)} kg/s`;
  const pO2 = Number((CABIN.kPa * (AIR[1].share / 100)).toFixed(1));
  const stoich = { mix: n(spec.rocket.mixture, 1), stoich: n(burn.stoichiometric, 2) };

  return {
    chem: {
      subject: texts.ui('intro.rocket.chem', 'Chemistry'),
      title: texts.ui('intro.rocket.chemTitle', 'Combustion · the tail'),
      equation: 'CH₄ + 2 O₂ → CO₂ + 2 H₂O',
      species: [
        {
          formula: 'CH₄',
          name: texts.ui('intro.rocket.methane', 'methane'),
          rate: kgs(burn.methane),
          side: 'in',
        },
        {
          formula: 'O₂',
          name: texts.ui('intro.rocket.oxygen', 'oxygen'),
          rate: kgs(burn.oxygen),
          side: 'in',
        },
        {
          formula: 'CO₂',
          name: texts.ui('intro.rocket.carbonDioxide', 'carbon dioxide'),
          rate: kgs(burn.carbonDioxide),
          side: 'out',
        },
        {
          formula: 'H₂O',
          name: texts.ui('intro.rocket.water', 'water vapour'),
          rate: kgs(burn.water),
          side: 'out',
        },
      ],
      rows: [
        {
          label: texts.ui('intro.rocket.ratio', 'Oxidiser : fuel, by mass'),
          value: texts.ui('intro.rocket.ratioValue', '{mix} (complete burning {stoich})', stoich),
        },
        {
          label: texts.ui('intro.rocket.unburnt', 'Methane left unburnt'),
          value: kgs(burn.unburnt, 1),
        },
        {
          label: texts.ui('intro.rocket.heat', 'Heat released'),
          value: `${n(burn.heat / 1e9, 1)} GW`,
        },
        {
          label: texts.ui('intro.rocket.enthalpy', 'ΔH per mol of CH₄'),
          value: `${n(-COMBUSTION_KJ_PER_MOL, 1)} kJ/mol`,
        },
      ],
      note: texts.ui(
        'intro.rocket.chemNote',
        'Run fuel-rich ({mix} < {stoich}) to keep the chamber cooler, so some methane leaves unburnt. Mass in = mass out; the water leaves as vapour.',
        stoich,
      ),
    },
    phys: {
      subject: texts.ui('intro.rocket.phys', 'Physics'),
      title: texts.ui('intro.rocket.physTitle', 'Forces · the body'),
      rows: [
        {
          label: texts.ui('intro.rocket.thrust', 'Thrust T'),
          value: mn(phys.thrust),
          swatch: FORCE_COLORS.thrust,
          angle: screenAngle(phys.thrust),
        },
        {
          label: texts.ui('intro.rocket.weight', 'Weight P = m·g'),
          value: mn(phys.weight),
          swatch: FORCE_COLORS.weight,
          angle: screenAngle(phys.weight),
        },
        {
          label: texts.ui('intro.rocket.drag', 'Air drag Fc = ½·ρ·v²·Cd·A'),
          value: `${n(size(phys.drag) / 1e3, 1)} kN`,
          swatch: FORCE_COLORS.drag,
          angle: screenAngle(phys.drag),
        },
        {
          label: texts.ui('intro.rocket.net', 'Net force F = T + P + Fc (vectors)'),
          value: mn(phys.net),
          swatch: FORCE_COLORS.net,
          angle: screenAngle(phys.net),
        },
        {
          label: texts.ui('intro.rocket.accel', 'Acceleration a = F / m'),
          value: `${n(size(phys.accel), 1)} m/s²`,
        },
        {
          label: texts.ui('intro.rocket.massSpeed', 'Mass · speed'),
          value: `${n(phys.mass / 1000)} t · ${n(phys.speed)} m/s`,
        },
      ],
      tags: [
        `T = ${mn(phys.thrust)}`,
        `P = ${mn(phys.weight)}`,
        texts.ui('intro.rocket.dragTag', 'Fc = {value} (drawn ×10)', {
          value: `${n(size(phys.drag) / 1e3, 1)} kN`,
        }),
        `F = ${mn(phys.net)}`,
      ],
      note: texts.ui(
        'intro.rocket.pullNote',
        'Drawn 1 MN = 5 m; drag alone ×10, in the sum at true size. The net force points up and against the motion: the dive bends into a climb and the rocket slows.',
      ),
    },
    bio: {
      subject: texts.ui('intro.rocket.bio', 'Biology'),
      title: texts.ui('intro.rocket.bioTitle', 'The cabin · Khoa'),
      illustrative: texts.ui('intro.rocket.illustrative', 'illustrative'),
      vitals: [
        {
          label: texts.ui('intro.rocket.heart', 'Heart rate'),
          value: texts.ui('intro.rocket.bpm', '{n} beats/min', { n: VITALS.heart }),
        },
        {
          label: texts.ui('intro.rocket.pressure', 'Blood pressure'),
          value: `${VITALS.systolic}/${VITALS.diastolic} mmHg`,
        },
        { label: texts.ui('intro.rocket.spo2', 'Blood oxygen SpO₂'), value: `${VITALS.spo2} %` },
        {
          label: texts.ui('intro.rocket.breathing', 'Breathing'),
          value: texts.ui('intro.rocket.perMinute', '{n} breaths/min', { n: VITALS.breaths }),
        },
        {
          label: texts.ui('intro.rocket.temperature', 'Body temperature'),
          value: `${n(VITALS.temp, 1)} °C`,
        },
        {
          label: texts.ui('intro.rocket.felt', 'Felt acceleration'),
          value: `${n(bio.felt, 2)} g`,
        },
      ],
      airTitle: texts.ui('intro.rocket.air', 'Cabin air (dry), by volume'),
      air: AIR.map((gas) => ({
        formula: gas.formula,
        share: gas.share / 100,
        text: `${gas.formula} ${n(gas.share, 2)} %`,
        color: gas.color,
      })),
      airRows: [
        {
          label: texts.ui('intro.rocket.cabinPressure', 'Pressure · O₂ partial pressure'),
          value: `${n(CABIN.kPa, 1)} kPa · ${n(pO2, 1)} kPa`,
        },
        {
          label: texts.ui('intro.rocket.climate', 'Temperature · humidity'),
          value: `${CABIN.celsius} °C · ${CABIN.humidity} %`,
        },
      ],
      note: texts.ui(
        'intro.rocket.bioNote',
        'Vitals are illustrative, not measured from a person. Felt acceleration is the model’s: (thrust + drag) ÷ (m·g₀).',
      ),
    },
    skip: texts.ui('intro.rocket.skipButton', 'Skip'),
    clock: (scale) => `${n(scale, scale < 0.1 ? 2 : 1)}×`,
  };
}

/** The cabin air's shares (mole fractions) and pressure: for the test. */
export const CABIN_AIR = { air: AIR, kPa: CABIN.kPa };
