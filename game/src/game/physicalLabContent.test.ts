import { describe, expect, it } from 'vitest';
import { Registry } from '../core/Registry';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { BUILT_IN_MODELS } from '../simulation/models';
import { buildContent, ContentError, type RawContent } from './content';
import { bundledContent } from '../content';
import { physicalLabFixture } from './physicalLabFixture';

// The content rules of physical-lab containers and seats (docs/physical-lab-architecture.md §2.2,
// §2.3, §2.8), on the fixture (physicalLabFixture.ts: in no content file).

const code = {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', BUILT_IN_MODELS),
};

function problemsOf(raw: RawContent): readonly string[] {
  try {
    buildContent(raw, code);
  } catch (error) {
    if (error instanceof ContentError) return error.problems;
    throw error;
  }
  return [];
}

type Raw = Record<string, unknown> & { id: string };
const find = (list: unknown, id: string) => (list as Raw[]).find((x) => x.id === id)!;
const placement = (raw: RawContent, id: string) =>
  find(find(raw.rooms, 'physics-lab').placements, id) as Raw & { params: Raw };
const experiment = (raw: RawContent) =>
  find(raw.experiments, 'fixture-dilution') as Raw & {
    inputs: Record<string, object>;
    workspace: { setup: Raw[] };
  };
const item = (raw: RawContent, id: string) => find(raw.items, id);
const AT = (id: string) => `rooms.physics-lab.placements.${id}`;

describe('physical-lab containers in content', () => {
  it('takes the fixture as it is', () => {
    expect(problemsOf(physicalLabFixture(bundledContent))).toEqual([]);
  });

  it('binds a container only to a piece and a material its station’s experiment lists', () => {
    const raw = physicalLabFixture(bundledContent);
    placement(raw, 'dl-stock').params.piece = 'beaker';
    placement(raw, 'dl-flask').params.material = 'flask-100';
    expect(problemsOf(raw)).toEqual([
      `${AT('dl-flask')}: "flask-100" is no material of "fixture-dilution"`,
      `${AT('dl-stock')}: "beaker" is no piece of "fixture-dilution"`,
    ]);
  });

  it('keeps a mark or measure equal to what its material sets (one source for a model input)', () => {
    const raw = physicalLabFixture(bundledContent);
    (item(raw, 'fx-flask-50').container as Raw).fillLimitMl = 49;
    (item(raw, 'fx-pipette-5').container as Raw).measured = { volumeMl: 2 };
    expect(problemsOf(raw)).toEqual([
      `${AT('dl-flask')}: its 49 mL mark is not what "flask-50" sets (50 mL)`,
      `${AT('dl-pipette')}: its 2 mL mark is not what "pipette-5" sets (5 mL)`,
    ]);
  });

  it('takes a fill (AFFORDANCE: bookkeeping volume) only as whole µL within the mark', () => {
    const raw = physicalLabFixture(bundledContent);
    placement(raw, 'dl-stock').params.fill = 250.0005;
    placement(raw, 'dl-wash').params.fill = 501;
    expect(problemsOf(raw)).toEqual([
      `${AT('dl-stock')}: fill 250.0005 mL: whole µL of its material, up to 250 mL`,
      `${AT('dl-wash')}: fill 501 mL: whole µL of its material, up to 500 mL`,
    ]);
  });

  it('needs a physical-lab station for a container with a piece', () => {
    const raw = physicalLabFixture(bundledContent);
    placement(raw, 'dl-flask').params.station = 'tower'; // the free-fall tower: physical-3d
    expect(problemsOf(raw)).toContain(
      `${AT('dl-flask')}: a container with a "piece" belongs to a "physical-lab" station`,
    );
  });

  it('shows no hidden input in a text bound to a container', () => {
    const raw = physicalLabFixture(bundledContent);
    experiment(raw).inputs.fillTime = { symbol: 't_fill', unit: 's', hidden: true };
    placement(raw, 'dl-wash').params.note = 'empties in 10 s';
    placement(raw, 'dl-stock').params.note = 'not the fillTime';
    expect(problemsOf(raw)).toEqual([
      `${AT('dl-stock')}: a text bound to it names the hidden input "fillTime"`,
      `${AT('dl-wash')}: a text bound to it shows the hidden input "fillTime" (10)`,
    ]);
  });

  it('needs a closable container for an inversion, and the inverted vessel as its own receiver', () => {
    const raw = physicalLabFixture(bundledContent);
    (item(raw, 'fx-flask-50').container as Raw).closable = false;
    expect(problemsOf(raw)).toEqual([
      'experiments.fixture-dilution.workspace.setup.3: no closable container is "flask"',
    ]);
    const other = physicalLabFixture(bundledContent);
    experiment(other).workspace.setup[3]!.onto = 'cuvette';
    expect(problemsOf(other).join('\n')).toContain(
      'an inversion turns one vessel: "place" = "onto"',
    );
  });

  it('needs every tag a seat accepts on some item', () => {
    const raw = physicalLabFixture(bundledContent);
    (item(raw, 'fx-colorimeter').seats as Raw[])[0]!.accepts = ['fx-beaker'];
    expect(problemsOf(raw)).toEqual([
      'items.fx-colorimeter.seats.0.accepts: no item has the tag "fx-beaker"',
    ]);
  });
});
