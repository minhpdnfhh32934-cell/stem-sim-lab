import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { SetupProgress } from '../../../gameplay/experiment/StationSystem';
import { LaboratoryDefinitionSchema } from '../../../world/definitions';
import { WORKSPACE_LAYOUTS, readableInk, regionOf } from './layouts';
import {
  LayerStack,
  acceptingPieces,
  currentStage,
  libraryItems,
  misplacedStep,
  placement,
  stageChips,
} from './state';
import { WORKSPACE, viewWith } from './workspaceFixture';

const progress = (done: readonly string[]): SetupProgress[] =>
  viewWith(done).setup as SetupProgress[];

describe('lifecycle stage', () => {
  it('is derived from the session and the setup, never stored', () => {
    expect(currentStage('idle', progress([]), false)).toBe('setup');
    expect(currentStage('idle', progress(['clamp', 'fill']), false)).toBe('setup');
    expect(currentStage('configured', progress(['clamp', 'fill', 'add-indicator']), false)).toBe(
      'run',
    );
    expect(currentStage('configured', [], false)).toBe('run'); // no setup steps: ready at once
    expect(currentStage('running', progress([]), false)).toBe('observe');
    expect(currentStage('stopped', progress([]), false)).toBe('observe'); // its data is kept
    expect(currentStage('completed', progress([]), false)).toBe('measure');
    expect(currentStage('completed', progress([]), true)).toBe('analyse');
  });

  it('marks earlier stages done, and leaves Setup out when there is none', () => {
    expect(stageChips('observe', true).map((c) => `${c.stage}:${c.status}`)).toEqual([
      'setup:done',
      'run:done',
      'observe:current',
      'measure:todo',
      'analyse:todo',
    ]);
    expect(stageChips('run', false).map((c) => c.stage)).toEqual([
      'run',
      'observe',
      'measure',
      'analyse',
    ]);
  });
});

describe('Esc closes the innermost layer first', () => {
  it('pops layers in the reverse order they opened, then reports none', () => {
    const layers = new LayerStack();
    layers.push('callout');
    layers.push('placing');
    layers.push('results');
    expect([layers.pop(), layers.pop(), layers.pop(), layers.pop()]).toEqual([
      'results',
      'placing',
      'callout',
      null,
    ]);
  });

  it('moves a layer opened again to the top instead of listing it twice', () => {
    const layers = new LayerStack();
    layers.push('callout');
    layers.push('brief');
    layers.push('callout');
    expect(layers.pop()).toBe('callout');
    expect(layers.pop()).toBe('brief');
    expect(layers.pop()).toBeNull();
  });
});

describe('library and placement', () => {
  const items = libraryItems(WORKSPACE);
  const item = (id: string) => items.find((i) => i.id === id)!;
  const piece = (id: string) => WORKSPACE.pieces.find((p) => p.id === id)!;
  const none = () => false;

  it('lists the materials of the definition, then the pieces a setup step places', () => {
    expect(items.map((i) => `${i.kind}:${i.id}`)).toEqual([
      'material:naoh',
      'material:indicator',
      'equipment:burette',
    ]);
  });

  it('sends the setting a material makes and the step it completes, to the piece that takes it', () => {
    expect(placement(WORKSPACE, item('naoh'), piece('burette'), none)).toMatchObject({
      accepted: true,
      sets: { parameter: 'titrant', value: 0.1 },
      step: { id: 'fill' },
    });
    expect(placement(WORKSPACE, item('indicator'), piece('flask'), none)).toMatchObject({
      accepted: true,
      sets: null,
      step: { id: 'add-indicator' },
    });
    expect(placement(WORKSPACE, item('burette'), piece('stand'), none)).toMatchObject({
      step: { id: 'clamp' },
    });
  });

  it('still sets a parameter once its step is done, and names no step then', () => {
    const done = (id: string) => id === 'fill';
    expect(placement(WORKSPACE, item('naoh'), piece('burette'), done)).toMatchObject({
      accepted: true,
      step: null,
      sets: { parameter: 'titrant' },
    });
  });

  it('refuses a piece that does not take the item, and quotes the step that places it', () => {
    expect(placement(WORKSPACE, item('naoh'), piece('flask'), none).accepted).toBe(false);
    expect(misplacedStep(WORKSPACE, 'naoh')?.refusal).toBe(
      'The burette holds the titrant, NaOH, in this experiment.',
    );
    expect(misplacedStep(WORKSPACE, 'flask')).toBeNull();
  });

  it('lights exactly the accepting pieces', () => {
    expect([...acceptingPieces(WORKSPACE, item('naoh'), none)]).toEqual(['burette']);
    expect([...acceptingPieces(WORKSPACE, item('burette'), none)]).toEqual(['stand']);
  });
});

describe('layouts', () => {
  it('has one layout per presentation, each with a region to fall back on', () => {
    for (const layout of Object.values(WORKSPACE_LAYOUTS)) {
      expect(layout.regions).toContain(layout.fallback);
      if (layout.hero) expect(layout.regions).toEqual(expect.arrayContaining([...layout.hero]));
    }
    expect(WORKSPACE_LAYOUTS['2d-workspace'].monitor).toBe('notebook');
    expect(WORKSPACE_LAYOUTS['bench-embedded'].overlay).toBe('anchored');
    expect(WORKSPACE_LAYOUTS.microscopy.hero).toEqual(['prep', 'field']);
  });

  it('puts a piece in the region its slot names, else the fallback', () => {
    const obs = WORKSPACE_LAYOUTS.observation;
    expect(regionOf(obs, 'lens')).toBe('lens');
    expect(regionOf(obs, 'somewhere')).toBe('front-centre');
    const bench = WORKSPACE_LAYOUTS['2d-workspace'];
    expect(regionOf(bench, 'stand.clamp')).toBe('bench');
    const microscopy = WORKSPACE_LAYOUTS.microscopy;
    expect(regionOf(microscopy, 'field.eyepiece')).toBe('field');
  });
});

describe('a lab’s look comes from its data', () => {
  const lab = { id: 'x', displayName: 'X', type: 'chemistry', rooms: ['r'] } as const;

  it('takes an optional accent and stage as #rrggbb, and rejects anything else', () => {
    expect(
      LaboratoryDefinitionSchema.parse({ ...lab, accent: '#a78bfa', stage: '#dfe4e8' }),
    ).toMatchObject({
      accent: '#a78bfa',
    });
    expect(LaboratoryDefinitionSchema.parse(lab).accent).toBeUndefined();
    expect(() => LaboratoryDefinitionSchema.parse({ ...lab, accent: 'violet' })).toThrow();
  });

  it('gives Chemistry and Biology their accent and stage, and Physics none', () => {
    const labs = LaboratoryDefinitionSchema.array().parse(bundledContent.laboratories);
    const look = (type: string) => labs.find((l) => l.type === type);
    expect(look('chemistry')).toMatchObject({ accent: '#a78bfa', stage: '#dfe4e8' });
    expect(look('biology')).toMatchObject({ accent: '#6cc79a', stage: '#f3f1ea' });
    expect(look('physics')?.accent).toBeUndefined();
  });

  it('chooses the ink that reads on the stage at 4.5:1 or better', () => {
    const luminance = (hex: string) => {
      const c = (at: number) => {
        const v = parseInt(hex.slice(at, at + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5);
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [luminance(a), luminance(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    for (const stage of ['#dfe4e8', '#f3f1ea', '#162231', '#808080', '#a78bfa']) {
      expect(ratio(stage, readableInk(stage))).toBeGreaterThanOrEqual(4.5);
    }
    expect(readableInk('#dfe4e8')).toBe('#1b2430');
    expect(readableInk('#162231')).toBe('#f2f8fc');
  });
});
