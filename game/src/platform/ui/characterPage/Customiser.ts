import { z } from 'zod';
import type { Texts } from '../../../core/i18n';
import type { Game } from '../../../game/Game';
import {
  type CharacterDefinition,
  CharacterDefinitionSchema,
  type Clothes,
  CUSTOM_ID,
  FaceShapeSchema,
  HAIR_STYLES,
  HairDesignSchema,
  SIGNATURE_POSES,
} from '../../../gameplay/character';
import { QUALITY } from '../../render/quality';
import { el } from '../dom';
import type { CustomPreview } from './CustomPreview';

/*
 * The customiser (C-9, Phú 2026-11-08): the player makes their own character — body, face, hair,
 * clothes, extras and a name — seen whole beside the choices and turned by dragging. Every choice
 * is a field of the character's appearance (`CharacterDefinitionSchema`), within its bounds; Save
 * checks the whole against the schema, keeps it in the browser (`CUSTOM_KEY`, for the menu) and
 * gives it to the game (`Game.setCustomCharacter`).
 */

/** Where the player's own character is kept in the browser (the save keeps the one played). */
export const CUSTOM_KEY = 'simlab.character.custom';
/** What the face was before it was made from a photo (never the photo), for Delete. */
export const BEFORE_PHOTO_KEY = 'simlab.character.custom.beforePhoto';

type Appearance = CharacterDefinition['appearance'];
type Draft = CharacterDefinition;

const SKIN = ['#f8dcc8', '#f1c9a8', '#e3b48c', '#c99470', '#a87252', '#7d5038', '#5a3a28'];
const HAIR = [
  '#1b1a1f',
  '#3b2a20',
  '#6b4a2e',
  '#b8864e',
  '#e6c46a',
  '#d9d9de',
  '#e86a9a',
  '#c0392b',
  '#3a6fd8',
  '#7b4bb7',
  '#2e9e6e',
  '#f08a3a',
];
const EYES = ['#4a3426', '#2e5e9e', '#3f8f5a', '#7b4bb7', '#b33a3a', '#c08a2e', '#2b2b30'];
const CLOTH = [
  '#f2f3f4',
  '#1f2228',
  '#4f5b6b',
  '#a8c8ee',
  '#1f3d7a',
  '#c0392b',
  '#e86a9a',
  '#f0b33a',
  '#2e9e6e',
  '#7b4bb7',
  '#8a5a3b',
  '#e8e0cf',
];

/** One choice: its label, and how it reads and writes the draft. */
type Control =
  | {
      kind: 'range';
      label: (t: Texts) => string;
      min: number;
      max: number;
      step: number;
      unit?: string | undefined;
      get: (d: Draft) => number;
      set: (d: Draft, v: number) => void;
    }
  | {
      kind: 'colour';
      label: (t: Texts) => string;
      swatches: readonly string[];
      get: (d: Draft) => string;
      set: (d: Draft, v: string) => void;
    }
  | {
      kind: 'choice';
      label: (t: Texts) => string;
      options: readonly { value: string; label: (t: Texts) => string }[];
      get: (d: Draft) => string;
      set: (d: Draft, v: string) => void;
    };

const range = (
  label: (t: Texts) => string,
  key: keyof Appearance,
  min: number,
  max: number,
  step: number,
  unit?: string,
): Control => ({
  kind: 'range',
  label,
  min,
  max,
  step,
  unit,
  get: (d) => d.appearance[key] as number,
  set: (d, v) => ((d.appearance[key] as number) = v),
});
const colour = (
  label: (t: Texts) => string,
  swatches: readonly string[],
  get: (a: Appearance) => string,
  set: (a: Appearance, v: string) => void,
): Control => ({
  kind: 'colour',
  label,
  swatches,
  get: (d) => get(d.appearance),
  set: (d, v) => set(d.appearance, v),
});
const yesNo = (
  label: (t: Texts) => string,
  get: (d: Draft) => boolean,
  set: (d: Draft, v: boolean) => void,
): Control => ({
  kind: 'choice',
  label,
  options: [
    { value: 'no', label: (t) => t.ui('custom.no', 'No') },
    { value: 'yes', label: (t) => t.ui('custom.yes', 'Yes') },
  ],
  get: (d) => (get(d) ? 'yes' : 'no'),
  set: (d, v) => set(d, v === 'yes'),
});

/** A slider for one of the face's proportions or the photo hairstyle's measures. */
const measure = <G extends 'face' | 'hairDesign'>(
  label: (t: Texts) => string,
  group: G,
  key: keyof Appearance[G],
  min: number,
  max: number,
): Control => ({
  kind: 'range',
  label,
  min,
  max,
  step: 0.01,
  get: (d) => d.appearance[group][key] as number,
  set: (d, v) => ((d.appearance[group][key] as number) = v),
});

/** The fields a photo sets, kept as they were before it so that Delete can give them back. */
const PhotoFieldsSchema = z.object({
  skinTone: z.string(),
  eyeColor: z.string(),
  hairColor: z.string(),
  hair: z.enum(HAIR_STYLES),
  beard: z.boolean(),
  face: FaceShapeSchema,
  hairDesign: HairDesignSchema,
});
type PhotoFields = z.infer<typeof PhotoFieldsSchema>;
const photoFields = (a: Appearance): PhotoFields =>
  structuredClone({
    skinTone: a.skinTone,
    eyeColor: a.eyeColor,
    hairColor: a.hairColor,
    hair: a.hair,
    beard: a.beard,
    face: a.face,
    hairDesign: a.hairDesign,
  });

/** A choice of one of the clothes' fields, its options as [value, label]. */
const pick = <K extends 'neck' | 'sleeves' | 'jacket' | 'legwear' | 'footwear' | 'gloves'>(
  label: (t: Texts) => string,
  key: K,
  options: readonly (readonly [Clothes[K], (t: Texts) => string])[],
): Control => ({
  kind: 'choice',
  label,
  options: options.map(([value, name]) => ({ value, label: name })),
  get: (d) => d.appearance.clothes[key],
  set: (d, v) => (d.appearance.clothes[key] = v as Clothes[K]),
});

const HAIR_NAMES: Record<(typeof HAIR_STYLES)[number], (t: Texts) => string> = {
  short: (t) => t.ui('custom.hair.short', 'Short'),
  ponytail: (t) => t.ui('custom.hair.ponytail', 'Ponytail'),
  spiky: (t) => t.ui('custom.hair.spiky', 'Spiky'),
  bob: (t) => t.ui('custom.hair.bob', 'Bob'),
  long: (t) => t.ui('custom.hair.long', 'Long'),
  bun: (t) => t.ui('custom.hair.bun', 'Bun'),
  curly: (t) => t.ui('custom.hair.curly', 'Curly'),
  sidePart: (t) => t.ui('custom.hair.sidePart', 'Side part'),
  photo: (t) => t.ui('custom.hair.photo', 'From the photo'),
};
const POSE_NAMES: Record<(typeof SIGNATURE_POSES)[number], (t: Texts) => string> = {
  'arms-crossed': (t) => t.ui('custom.pose.armsCrossed', 'Arms crossed'),
  wave: (t) => t.ui('custom.pose.wave', 'Wave'),
  'thumbs-up': (t) => t.ui('custom.pose.thumbsUp', 'Thumbs up'),
  notes: (t) => t.ui('custom.pose.notes', 'Notes'),
  'hands-on-hips': (t) => t.ui('custom.pose.handsOnHips', 'Hands on hips'),
  presenting: (t) => t.ui('custom.pose.presenting', 'Presenting'),
  thinking: (t) => t.ui('custom.pose.thinking', 'Thinking'),
  peace: (t) => t.ui('custom.pose.peace', 'Peace sign'),
};

/** The tabs, each a list of choices. */
const TABS: readonly {
  label: (t: Texts) => string;
  /** Opens with the face-from-a-photo buttons. */
  photo?: true;
  controls: readonly Control[];
}[] = [
  {
    label: (t) => t.ui('custom.tab.body', 'Body'),
    controls: [
      range((t) => t.ui('custom.height', 'Height'), 'heightM', 1.5, 1.95, 0.01, 'm'),
      range((t) => t.ui('custom.build', 'Build'), 'build', 0.8, 1.35, 0.01),
      range((t) => t.ui('custom.muscle', 'Muscle'), 'muscle', 0, 1, 0.01),
      range((t) => t.ui('custom.shoulders', 'Shoulders'), 'shoulderM', 0.32, 0.5, 0.005, 'm'),
      range((t) => t.ui('custom.waist', 'Waist'), 'waistM', 0.22, 0.38, 0.005, 'm'),
      range((t) => t.ui('custom.hips', 'Hips'), 'hipM', 0.3, 0.44, 0.005, 'm'),
      range((t) => t.ui('custom.bust', 'Bust'), 'bustM', 0, 0.05, 0.002, 'm'),
    ],
  },
  {
    label: (t) => t.ui('custom.tab.face', 'Face'),
    photo: true,
    controls: [
      {
        kind: 'choice',
        label: (t) => t.ui('custom.face', 'Face'),
        options: [
          { value: 'soft', label: (t) => t.ui('custom.face.soft', 'Soft, with lashes') },
          { value: 'strong', label: (t) => t.ui('custom.face.strong', 'Strong') },
        ],
        get: (d) => (d.appearance.lashes ? 'soft' : 'strong'),
        set: (d, v) => (d.appearance.lashes = v === 'soft'),
      },
      colour(
        (t) => t.ui('custom.skin', 'Skin'),
        SKIN,
        (a) => a.skinTone,
        (a, v) => (a.skinTone = v),
      ),
      colour(
        (t) => t.ui('custom.eyes', 'Eyes'),
        EYES,
        (a) => a.eyeColor,
        (a, v) => (a.eyeColor = v),
      ),
      yesNo(
        (t) => t.ui('custom.allure', 'Alluring look'),
        (d) => d.appearance.allure,
        (d, v) => (d.appearance.allure = v),
      ),
      yesNo(
        (t) => t.ui('custom.blush', 'Blush and smile'),
        (d) => d.appearance.blush,
        (d, v) => (d.appearance.blush = v),
      ),
      yesNo(
        (t) => t.ui('custom.beard', 'Beard'),
        (d) => d.appearance.beard,
        (d, v) => (d.appearance.beard = v),
      ),
      {
        kind: 'choice',
        label: (t) => t.ui('custom.glasses', 'Glasses'),
        options: [
          { value: 'none', label: (t) => t.ui('custom.glasses.none', 'None') },
          { value: 'round', label: (t) => t.ui('custom.glasses.round', 'Round') },
          { value: 'square', label: (t) => t.ui('custom.glasses.square', 'Square') },
          { value: 'shades', label: (t) => t.ui('custom.glasses.shades', 'Sunglasses') },
        ],
        get: (d) => d.appearance.glasses,
        set: (d, v) => (d.appearance.glasses = v as Appearance['glasses']),
      },
      measure((t) => t.ui('custom.faceWidth', 'Face width'), 'face', 'width', 0.85, 1.15),
      measure((t) => t.ui('custom.faceLength', 'Face length'), 'face', 'length', 0.85, 1.15),
      measure((t) => t.ui('custom.jaw', 'Jaw'), 'face', 'jaw', 0.8, 1.2),
      measure((t) => t.ui('custom.chin', 'Chin'), 'face', 'chin', 0.8, 1.2),
      measure((t) => t.ui('custom.eyeSize', 'Eye size'), 'face', 'eyeSize', 0.8, 1.25),
      measure((t) => t.ui('custom.eyeSpacing', 'Eye spacing'), 'face', 'eyeSpacing', 0.88, 1.12),
      measure((t) => t.ui('custom.nosePlace', 'Nose height'), 'face', 'nose', 0.85, 1.15),
      measure((t) => t.ui('custom.mouthPlace', 'Mouth height'), 'face', 'mouth', 0.85, 1.15),
    ],
  },
  {
    label: (t) => t.ui('custom.tab.hair', 'Hair'),
    controls: [
      {
        kind: 'choice',
        label: (t) => t.ui('custom.hairStyle', 'Style'),
        options: HAIR_STYLES.map((value) => ({ value, label: HAIR_NAMES[value] })),
        get: (d) => d.appearance.hair,
        set: (d, v) => (d.appearance.hair = v as Appearance['hair']),
      },
      colour(
        (t) => t.ui('custom.hairColour', 'Colour'),
        HAIR,
        (a) => a.hairColor,
        (a, v) => (a.hairColor = v),
      ),
      measure(
        (t) => t.ui('custom.hairLength', 'Length (photo style)'),
        'hairDesign',
        'length',
        0,
        1,
      ),
      measure(
        (t) => t.ui('custom.hairFringe', 'Fringe (photo style)'),
        'hairDesign',
        'fringe',
        0,
        1,
      ),
      measure(
        (t) => t.ui('custom.hairParting', 'Parting (photo style)'),
        'hairDesign',
        'parting',
        -1,
        1,
      ),
      measure(
        (t) => t.ui('custom.hairVolume', 'Volume (photo style)'),
        'hairDesign',
        'volume',
        0,
        1,
      ),
      measure((t) => t.ui('custom.hairCurl', 'Curl (photo style)'), 'hairDesign', 'curl', 0, 1),
    ],
  },
  {
    label: (t) => t.ui('custom.tab.top', 'Top'),
    controls: [
      colour(
        (t) => t.ui('custom.top', 'Top'),
        CLOTH,
        (a) => a.clothes.top,
        (a, v) => (a.clothes.top = v),
      ),
      pick((t) => t.ui('custom.neck', 'Neck'), 'neck', [
        ['tie', (t) => t.ui('custom.neck.tie', 'Shirt and tie')],
        ['bow', (t) => t.ui('custom.neck.bow', 'Shirt and bow')],
        ['collar', (t) => t.ui('custom.neck.collar', 'Collar')],
        ['crew', (t) => t.ui('custom.neck.crew', 'Round neck')],
        ['hood', (t) => t.ui('custom.neck.hood', 'Hoodie')],
      ]),
      pick((t) => t.ui('custom.sleeves', 'Sleeves'), 'sleeves', [
        ['long', (t) => t.ui('custom.sleeves.long', 'Long')],
        ['short', (t) => t.ui('custom.sleeves.short', 'Short')],
        ['none', (t) => t.ui('custom.sleeves.none', 'None')],
      ]),
      yesNo(
        (t) => t.ui('custom.crop', 'Bare midriff'),
        (d) => d.appearance.clothes.crop,
        (d, v) => (d.appearance.clothes.crop = v),
      ),
      pick((t) => t.ui('custom.jacket', 'Over it'), 'jacket', [
        ['none', (t) => t.ui('custom.jacket.none', 'Nothing')],
        ['zip', (t) => t.ui('custom.jacket.zip', 'Zip jacket')],
        ['cropped', (t) => t.ui('custom.jacket.cropped', 'Short jacket')],
        ['vest', (t) => t.ui('custom.jacket.vest', 'Tactical vest')],
        ['sweaterVest', (t) => t.ui('custom.jacket.sweaterVest', 'Knit vest')],
      ]),
      colour(
        (t) => t.ui('custom.jacketColour', 'Jacket colour'),
        CLOTH,
        (a) => a.clothes.jacketColour,
        (a, v) => (a.clothes.jacketColour = v),
      ),
      colour(
        (t) => t.ui('custom.jacketTrim', 'Stripes and zips'),
        CLOTH,
        (a) => a.clothes.jacketTrim,
        (a, v) => (a.clothes.jacketTrim = v),
      ),
      colour(
        (t) => t.ui('custom.accent', 'Tie or trim'),
        CLOTH,
        (a) => a.clothes.accent,
        (a, v) => (a.clothes.accent = v),
      ),
      yesNo(
        (t) => t.ui('custom.logo', 'Emblem'),
        (d) => d.appearance.clothes.logo,
        (d, v) => (d.appearance.clothes.logo = v),
      ),
      yesNo(
        (t) => t.ui('custom.blocks', 'Colour blocks'),
        (d) => d.appearance.clothes.blocks,
        (d, v) => (d.appearance.clothes.blocks = v),
      ),
      yesNo(
        (t) => t.ui('custom.coat', 'Lab coat'),
        (d) => d.profile.coat,
        (d, v) => (d.profile.coat = v),
      ),
    ],
  },
  {
    label: (t) => t.ui('custom.tab.bottom', 'Bottom'),
    controls: [
      {
        kind: 'choice',
        label: (t) => t.ui('custom.legs', 'Below'),
        options: [
          { value: 'trousers', label: (t) => t.ui('custom.legs.trousers', 'Trousers') },
          { value: 'joggers', label: (t) => t.ui('custom.legs.joggers', 'Joggers') },
          { value: 'cargo', label: (t) => t.ui('custom.legs.cargo', 'Cargo trousers') },
          { value: 'shorts', label: (t) => t.ui('custom.legs.shorts', 'Shorts') },
          { value: 'pleated', label: (t) => t.ui('custom.legs.pleated', 'Pleated skirt') },
          { value: 'dress', label: (t) => t.ui('custom.legs.dress', 'Dress over tights') },
        ],
        get: (d) => (d.appearance.clothes.skirt ? 'dress' : d.appearance.clothes.legs),
        set: (d, v) => {
          d.appearance.clothes.skirt = v === 'dress';
          if (v !== 'dress') d.appearance.clothes.legs = v as Clothes['legs'];
        },
      },
      colour(
        (t) => t.ui('custom.bottom', 'Trousers, skirt or a dress’s tights'),
        CLOTH,
        (a) => a.clothes.bottom,
        (a, v) => (a.clothes.bottom = v),
      ),
      pick((t) => t.ui('custom.legwear', 'Bare legs'), 'legwear', [
        ['none', (t) => t.ui('custom.legwear.none', 'Bare')],
        ['tights', (t) => t.ui('custom.legwear.tights', 'Tights')],
        ['thighHighs', (t) => t.ui('custom.legwear.thighHighs', 'Stockings')],
      ]),
      colour(
        (t) => t.ui('custom.legwearColour', 'Tights colour'),
        CLOTH,
        (a) => a.clothes.legwearColour,
        (a, v) => (a.clothes.legwearColour = v),
      ),
      yesNo(
        (t) => t.ui('custom.ripped', 'Torn knee'),
        (d) => d.appearance.clothes.ripped,
        (d, v) => (d.appearance.clothes.ripped = v),
      ),
    ],
  },
  {
    label: (t) => t.ui('custom.tab.shoes', 'Shoes'),
    controls: [
      pick((t) => t.ui('custom.footwear', 'Shoes'), 'footwear', [
        ['sneakers', (t) => t.ui('custom.footwear.sneakers', 'Trainers')],
        ['loafers', (t) => t.ui('custom.footwear.loafers', 'Loafers')],
        ['heels', (t) => t.ui('custom.footwear.heels', 'Heels')],
        ['boots', (t) => t.ui('custom.footwear.boots', 'Boots')],
        ['kneeBoots', (t) => t.ui('custom.footwear.kneeBoots', 'Knee boots')],
        ['thighBoots', (t) => t.ui('custom.footwear.thighBoots', 'Thigh boots')],
      ]),
      colour(
        (t) => t.ui('custom.shoes', 'Shoes'),
        CLOTH,
        (a) => a.clothes.shoes,
        (a, v) => (a.clothes.shoes = v),
      ),
    ],
  },
  {
    label: (t) => t.ui('custom.tab.extras', 'Extras'),
    controls: [
      pick((t) => t.ui('custom.gloves', 'Gloves'), 'gloves', [
        ['none', (t) => t.ui('custom.gloves.none', 'None')],
        ['fingerless', (t) => t.ui('custom.gloves.fingerless', 'Fingerless')],
        ['long', (t) => t.ui('custom.gloves.long', 'Long')],
      ]),
      yesNo(
        (t) => t.ui('custom.choker', 'Choker'),
        (d) => d.appearance.clothes.choker,
        (d, v) => (d.appearance.clothes.choker = v),
      ),
      yesNo(
        (t) => t.ui('custom.bandage', 'Bandaged arm'),
        (d) => d.appearance.clothes.bandage,
        (d, v) => (d.appearance.clothes.bandage = v),
      ),
      yesNo(
        (t) => t.ui('custom.watch', 'Watch'),
        (d) => d.appearance.watch,
        (d, v) => (d.appearance.watch = v),
      ),
      yesNo(
        (t) => t.ui('custom.earrings', 'Earrings'),
        (d) => d.appearance.earrings,
        (d, v) => (d.appearance.earrings = v),
      ),
      {
        kind: 'choice',
        label: (t) => t.ui('custom.pose', 'Pose when chosen'),
        options: SIGNATURE_POSES.map((value) => ({ value, label: POSE_NAMES[value] })),
        get: (d) => d.profile.pose,
        set: (d, v) => (d.profile.pose = v as Draft['profile']['pose']),
      },
    ],
  },
];

export class Customiser {
  readonly root = el('section', 'custom-page hidden');
  private readonly previewHost = el('div', 'custom-preview');
  private readonly tabs = el('div', 'custom-tabs');
  private readonly panel = el('div', 'custom-controls');
  private readonly name = el('input', 'custom-name');
  private preview: CustomPreview | null = null;
  private draft: Draft | null = null;
  private tab = 0;
  private redraw = 0;
  private opening = 0;
  /** The face before it was made from a photo (null: not made from one). */
  private beforePhoto: PhotoFields | null = null;
  private readonly photoStatus = el('p', 'custom-photo-status');
  private readonly camera = el('div', 'custom-camera hidden');
  private readonly video = el('video', 'custom-camera-video');
  private stream: MediaStream | null = null;
  private reading = false;
  /** Writes its words in the language of the rest (on every open). */ isOpen = false;

  constructor(
    private readonly game: Game,
    /** Called with the character made (Save), or nothing (Cancel). */
    private readonly onClose: (made: CharacterDefinition | null) => void,
  ) {
    const t = game.texts;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    const title = el('h2', 'custom-title');
    title.id = 'custom-title';
    this.root.setAttribute('aria-labelledby', title.id);
    const cancel = el('button', 'menu-button custom-cancel');
    const save = el('button', 'menu-button primary custom-save');
    cancel.addEventListener('click', () => this.close(null));
    save.addEventListener('click', () => this.save());
    this.name.maxLength = 24;
    this.name.addEventListener('input', () => {
      if (this.draft) this.draft.displayName = this.name.value;
    });
    const nameLabel = el('label', 'custom-name-label');
    const side = el('div', 'custom-side');
    const buttons = el('div', 'custom-buttons');
    buttons.append(cancel, save);
    nameLabel.append(el('span'), this.name);
    side.append(title, nameLabel, this.tabs, this.panel, buttons);
    this.video.muted = true;
    this.video.playsInline = true;
    this.photoStatus.setAttribute('aria-live', 'polite');
    const shoot = el('button', 'menu-button primary custom-camera-shoot');
    const shut = el('button', 'menu-button custom-camera-close');
    shoot.addEventListener('click', () => void this.capture());
    shut.addEventListener('click', () => this.stopCamera());
    const cameraButtons = el('div', 'custom-buttons');
    cameraButtons.append(shut, shoot);
    this.camera.append(this.video, cameraButtons);
    this.root.append(this.previewHost, side, this.camera);
    this.texts = () => {
      title.textContent = t.ui('custom.title', 'Your own character');
      (nameLabel.firstChild as HTMLElement).textContent = t.ui('custom.name', 'Name');
      cancel.textContent = t.ui('custom.cancel', 'Cancel');
      save.textContent = t.ui('custom.save', 'Save');
      this.previewHost.title = t.ui('custom.drag', 'Drag to turn');
      shoot.textContent = t.ui('custom.photo.capture', 'Capture');
      shut.textContent = t.ui('custom.photo.close', 'Close the camera');
    };
    this.root.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !this.isOpen) return;
      event.preventDefault();
      event.stopPropagation();
      if (this.stream) this.stopCamera();
      else this.close(null);
    });
  }

  private readonly texts: () => void;

  /** Opens on a copy of `start` (the player's own, or a first one to begin from). */
  open(start: CharacterDefinition): void {
    if (this.isOpen) return;
    this.isOpen = true;
    const draft = { ...structuredClone(start), id: CUSTOM_ID };
    delete draft.vi; // the player's own words, in no other language
    this.draft = draft;
    this.beforePhoto = storedBeforePhoto();
    this.photoStatus.textContent = '';
    this.name.value = this.draft.displayName;
    this.texts();
    this.renderTabs();
    this.root.classList.remove('hidden');
    this.name.focus();
    const ticket = ++this.opening;
    void import('./CustomPreview').then(({ CustomPreview: Preview }) => {
      if (!this.isOpen || ticket !== this.opening || !this.draft) return;
      this.preview = new Preview(
        this.previewHost,
        QUALITY[this.game.graphicsQuality],
        () => this.game.frameCap,
      );
      this.preview.show(this.draft);
      this.root.dataset.ready = 'true';
    });
  }

  private renderTabs(): void {
    const t = this.game.texts;
    this.tabs.replaceChildren(
      ...TABS.map((tab, i) => {
        const button = el('button', `custom-tab${i === this.tab ? ' active' : ''}`, tab.label(t));
        button.setAttribute('aria-pressed', String(i === this.tab));
        button.addEventListener('click', () => {
          this.tab = i;
          this.renderTabs();
        });
        return button;
      }),
    );
    const tab = TABS[this.tab];
    this.panel.replaceChildren(
      ...(tab?.photo && !(import.meta.env.VITE_SIMLAB_EMBED === '1') ? [this.photoRow()] : []),
      ...(tab?.controls ?? []).map((c) => this.control(c)),
    );
  }

  /** Take a photo, choose one, or delete the face made from one. */
  private photoRow(): HTMLElement {
    const t = this.game.texts;
    const row = el('div', 'custom-photo');
    row.append(el('span', 'custom-label', t.ui('custom.photo', 'Face from a photo')));
    const buttons = el('div', 'custom-options');
    const take = el(
      'button',
      'custom-option custom-photo-camera',
      t.ui('custom.photo.camera', 'Take a photo'),
    );
    const choose = el(
      'button',
      'custom-option custom-photo-pick',
      t.ui('custom.photo.pick', 'Choose a photo'),
    );
    const file = el('input', 'custom-photo-file');
    file.type = 'file';
    file.accept = 'image/*';
    file.hidden = true;
    take.addEventListener('click', () => void this.startCamera());
    choose.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const picked = file.files?.[0];
      file.value = '';
      if (picked) void this.readFile(picked);
    });
    buttons.append(take, choose, file);
    const a = this.draft?.appearance;
    if (this.beforePhoto || a?.hair === 'photo' || a?.facePhoto) {
      const remove = el(
        'button',
        'custom-option custom-photo-delete',
        t.ui('custom.photo.delete', 'Delete the photo face'),
      );
      remove.addEventListener('click', () => this.deletePhotoFace());
      buttons.append(remove);
    }
    for (const b of buttons.querySelectorAll('button')) b.disabled = this.reading;
    row.append(buttons, this.photoStatus);
    return row;
  }

  private say(text: string): void {
    this.photoStatus.textContent = text;
  }

  private async startCamera(): Promise<void> {
    const t = this.game.texts;
    // No camera outside a secure page (a LAN address over plain http): there is no mediaDevices.
    if (!window.isSecureContext || !('mediaDevices' in navigator)) {
      this.say(
        t.ui(
          'custom.photo.noCamera',
          'No camera here (it needs localhost or https). Choose a photo instead.',
        ),
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (!this.isOpen) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      this.camera.classList.remove('hidden');
      await this.video.play();
    } catch {
      this.stopCamera();
      this.say(
        t.ui(
          'custom.photo.noCamera',
          'No camera here (it needs localhost or https). Choose a photo instead.',
        ),
      );
    }
  }

  private stopCamera(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.video.srcObject = null;
    this.camera.classList.add('hidden');
  }

  private async capture(): Promise<void> {
    const { videoWidth: w, videoHeight: h } = this.video;
    if (!this.stream || !w || !h) return;
    // The frame as the camera sees it (the view is shown mirrored, the photo is not).
    const frame = document.createElement('canvas');
    frame.width = w;
    frame.height = h;
    frame.getContext('2d')?.drawImage(this.video, 0, 0, w, h);
    this.stopCamera();
    await this.read(frame, w, h);
    frame.width = 0;
  }

  private async readFile(file: File): Promise<void> {
    let picture: ImageBitmap;
    try {
      picture = await createImageBitmap(file);
    } catch {
      this.say(this.game.texts.ui('custom.photo.failed', 'Could not read the photo.'));
      return;
    }
    await this.read(picture, picture.width, picture.height);
    picture.close();
  }

  /** Reads the face in a picture and makes the draft's face from it. */
  private async read(source: CanvasImageSource, w: number, h: number): Promise<void> {
    const t = this.game.texts;
    const draft = this.draft;
    if (!draft || this.reading) return;
    this.reading = true;
    this.renderTabs();
    this.say(t.ui('custom.photo.reading', 'Reading the face…'));
    try {
      // Embedded in SimLab: no in-app ML model, so the photo reader is not built in.
      if (import.meta.env.VITE_SIMLAB_EMBED === '1') return;
      const { readPhoto } = await import('./photoFace');
      const found = await readPhoto(source, w, h);
      if (draft !== this.draft) return;
      if (!found.ok) {
        this.say(
          t.ui('custom.photo.noFace', 'No face found. Try a clear photo, facing the camera.'),
        );
        return;
      }
      const a = draft.appearance;
      this.beforePhoto ??= photoFields(a);
      a.skinTone = found.skinTone;
      a.eyeColor = found.eyeColor;
      if (found.hairColor) a.hairColor = found.hairColor;
      a.beard = found.beard;
      a.face = { ...found.face };
      a.hairDesign = { ...found.hairDesign };
      a.hair = 'photo';
      // The face's picture on the head (none if it would not fit a room's message: the drawn face).
      if (found.picture) a.facePhoto = found.picture;
      else delete a.facePhoto;
      this.say(
        t.ui(
          'custom.photo.done',
          'Made from the photo. Its face is kept with your character (others in a LAN room see it); Delete removes it.',
        ),
      );
      this.changed();
    } catch (error) {
      this.game.log.warn('Face from a photo failed', String(error));
      this.say(t.ui('custom.photo.failed', 'Could not read the photo.'));
    } finally {
      this.reading = false;
      if (draft === this.draft) this.renderTabs();
    }
  }

  /** Gives back the face as it was before the photo (or the drawn face, if that is not known). */
  private deletePhotoFace(): void {
    const draft = this.draft;
    if (!draft) return;
    const a = draft.appearance;
    if (this.beforePhoto) {
      Object.assign(a, structuredClone(this.beforePhoto));
    } else {
      a.face = FaceShapeSchema.parse({});
      a.hairDesign = HairDesignSchema.parse({});
    }
    if (a.hair === 'photo') a.hair = 'short';
    delete a.facePhoto;
    this.beforePhoto = null;
    this.say(this.game.texts.ui('custom.photo.deleted', 'The face from the photo is deleted.'));
    this.renderTabs();
    this.changed();
  }

  private control(c: Control): HTMLElement {
    const t = this.game.texts;
    const draft = this.draft;
    const row = el('div', `custom-row ${c.kind}`);
    const label = el('span', 'custom-label', c.label(t));
    row.append(label);
    if (!draft) return row;
    if (c.kind === 'range') {
      const input = el('input');
      input.type = 'range';
      input.min = String(c.min);
      input.max = String(c.max);
      input.step = String(c.step);
      input.value = String(c.get(draft));
      input.setAttribute('aria-label', c.label(t));
      const value = el('span', 'custom-value');
      const shown = () => {
        const v = c.get(draft);
        value.textContent = c.unit
          ? `${v.toFixed(c.unit === 'm' && v < 1 ? 3 : 2)} ${c.unit}`
          : v.toFixed(2);
      };
      shown();
      input.addEventListener('input', () => {
        c.set(draft, Number(input.value));
        shown();
        this.changed();
      });
      row.append(input, value);
    } else if (c.kind === 'colour') {
      const swatches = el('div', 'custom-swatches');
      const pick = el('input', 'custom-colour');
      pick.type = 'color';
      pick.setAttribute('aria-label', c.label(t));
      const mark = () => {
        pick.value = c.get(draft);
        for (const s of swatches.children) {
          s.classList.toggle('active', (s as HTMLElement).dataset.colour === c.get(draft));
        }
      };
      for (const colourValue of c.swatches) {
        const s = el('button', 'custom-swatch');
        s.dataset.colour = colourValue;
        s.style.background = colourValue;
        s.setAttribute('aria-label', `${c.label(t)} ${colourValue}`);
        s.addEventListener('click', () => {
          c.set(draft, colourValue);
          mark();
          this.changed();
        });
        swatches.append(s);
      }
      pick.addEventListener('input', () => {
        c.set(draft, pick.value);
        mark();
        this.changed();
      });
      mark();
      swatches.append(pick);
      row.append(swatches);
    } else {
      const options = el('div', 'custom-options');
      for (const o of c.options) {
        const b = el('button', 'custom-option', o.label(t));
        b.dataset.value = o.value;
        const mark = () => {
          for (const x of options.children) {
            const on = (x as HTMLElement).dataset.value === c.get(draft);
            x.classList.toggle('active', on);
            x.setAttribute('aria-pressed', String(on));
          }
        };
        b.addEventListener('click', () => {
          c.set(draft, o.value);
          mark();
          this.changed();
        });
        options.append(b);
        mark();
      }
      row.append(options);
    }
    return row;
  }

  /** Draws the draft again a moment after the last change (a slider sends many). */
  private changed(): void {
    window.clearTimeout(this.redraw);
    this.redraw = window.setTimeout(() => {
      if (this.draft) this.preview?.show(this.draft);
    }, 90);
  }

  private save(): void {
    if (!this.draft) return;
    const t = this.game.texts;
    const name = this.draft.displayName.trim() || t.ui('custom.defaultName', 'New researcher');
    const parsed = CharacterDefinitionSchema.safeParse({ ...this.draft, displayName: name });
    if (!parsed.success) {
      this.game.log.warn('Own character not valid', parsed.error.message);
      return;
    }
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(parsed.data));
      if (this.beforePhoto) {
        localStorage.setItem(BEFORE_PHOTO_KEY, JSON.stringify(this.beforePhoto));
      } else {
        localStorage.removeItem(BEFORE_PHOTO_KEY);
      }
    } catch {
      // Not kept in this browser: the game still has it until the page closes.
    }
    this.game.setCustomCharacter(parsed.data);
    this.close(parsed.data);
  }

  private close(made: CharacterDefinition | null): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.opening++;
    window.clearTimeout(this.redraw);
    this.stopCamera();
    this.beforePhoto = null;
    this.root.classList.add('hidden');
    delete this.root.dataset.ready;
    this.preview?.dispose();
    this.preview = null;
    this.draft = null;
    this.onClose(made);
  }

  dispose(): void {
    window.clearTimeout(this.redraw);
    this.stopCamera();
    this.preview?.dispose();
    this.preview = null;
  }
}

/** The player's own character kept in this browser, if any and still valid. */
export function storedCustom(): CharacterDefinition | null {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return null;
    const parsed = CharacterDefinitionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { ...parsed.data, id: CUSTOM_ID } : null;
  } catch {
    return null;
  }
}

/** The face as it was before a photo, kept with the player's own character (if any, still valid). */
function storedBeforePhoto(): PhotoFields | null {
  try {
    const raw = localStorage.getItem(BEFORE_PHOTO_KEY);
    if (!raw) return null;
    const parsed = PhotoFieldsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
