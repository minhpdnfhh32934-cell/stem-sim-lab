import type { Game } from '../../game/Game';
import type { CharacterDefinition } from '../../gameplay/character';
import {
  PLAYER_NAME_MAX,
  PlayerNameSchema,
  ROOM_NAME_MAX,
  RoomIdSchema,
  RoomNameSchema,
  type Refusal,
} from '../../multiplayer/protocol';
import type { SaveSlot } from '../../persistence/saveSlots';
import type { LanRoom, LanRooms } from '../net/LanRooms';
import { el } from './dom';
import { radarArt } from './playArt';
import { playedAgo, playedWhen, stageHead } from './PlayPages';

const NAME_KEY = 'simlab.multiplayer.name';

/** Where Play goes: a room open now (by ID), a room played before, a new room, or an ID typed. */
export type RoomTarget =
  | { readonly kind: 'open'; readonly id: string; readonly name: string }
  | { readonly kind: 'saved'; readonly slot: SaveSlot }
  | { readonly kind: 'create'; readonly name: string }
  | { readonly kind: 'id'; readonly id: string };

/** Who plays: the name the others see, and the character. */
export interface RoomPlayer {
  readonly name: string;
  readonly character: CharacterDefinition;
}

/**
 * The menu's Multiplayer page (Phase M; Phú 2026-11-12, redesigned the same day): who the player
 * is; make a room or type a room ID (each plays at once) on the left; the rooms open on the
 * network as cards in the middle (this computer's and the others' found on the LAN, with their
 * players); the chosen one large on the right with Play, which goes straight in. The rooms played
 * before in this browser (each its own game) are listed under the forms, to play on or delete.
 * Without the room server everything is off and the page says how to start one.
 */
export class MultiplayerPage {
  readonly root = el('section', 'multiplayer play-stage hidden');
  readonly title = el('h2', 'menu-catalog-title');
  private readonly name = el('input', 'multiplayer-input');
  private readonly avatar = el('span', 'mp-avatar');
  private readonly roomName = el('input', 'multiplayer-input');
  private readonly roomId = el('input', 'multiplayer-input multiplayer-code');
  private readonly create = el('button', 'menu-button primary');
  private readonly joinById = el('button', 'menu-button');
  private readonly refresh = el('button', 'menu-button multiplayer-small');
  private readonly lanPill = el('p', 'mp-lan');
  private readonly openCount = el('span', 'stage-count');
  private readonly savedCount = el('span', 'stage-count');
  private readonly status = el('p', 'multiplayer-status');
  private readonly current = el('div', 'multiplayer-current');
  private readonly list = el('ul', 'multiplayer-list mp-rooms');
  private readonly saved = el('ul', 'multiplayer-list mp-saved');
  private readonly selected = el('div', 'multiplayer-selected');
  private readonly stopListening: () => void;
  /** The room chosen in a list (shown with Play). */
  private choice: RoomTarget | null = null;
  /** The played room whose Delete asks to be sure. */
  private confirming: string | null = null;
  private busy = false;

  constructor(
    private readonly game: Game,
    private readonly rooms: LanRooms,
    show: (element: HTMLElement, text: () => string) => void,
    private readonly character: () => CharacterDefinition | undefined,
    onBack: () => void,
    private readonly onPlay: (target: RoomTarget, player: RoomPlayer) => void,
  ) {
    const t = game.texts;
    this.root.setAttribute('aria-labelledby', 'multiplayer-title');
    this.title.id = 'multiplayer-title';

    const field = (input: HTMLInputElement, label: () => string, max: number) => {
      const wrap = el('label', 'multiplayer-field');
      const caption = el('span', 'multiplayer-label');
      show(caption, label);
      input.maxLength = max;
      input.autocomplete = 'off';
      input.spellcheck = false;
      wrap.append(caption, input);
      return wrap;
    };
    const titled = (text: () => string, icon: string) => {
      const h = el('h3', 'mp-card-title');
      const mark = el('span', 'mp-card-icon', icon);
      mark.setAttribute('aria-hidden', 'true');
      const words = el('span');
      show(words, text);
      h.append(mark, words);
      return h;
    };
    this.name.value = storedName() ?? '';
    this.name.addEventListener('change', () => keepName(this.name.value));
    this.name.addEventListener('input', () => this.paintAvatar());
    this.roomId.placeholder = 'ABC234';
    show(this.create, () => t.ui('room.create', 'Create room'));
    show(this.joinById, () => t.ui('room.join', 'Join'));
    show(this.refresh, () => t.ui('room.refresh', 'Refresh'));
    this.create.addEventListener('click', () => this.onCreate());
    this.joinById.addEventListener('click', () => this.onJoinId());
    this.refresh.addEventListener('click', () => rooms.refresh());
    for (const [input, go] of [
      [this.roomName, () => this.onCreate()],
      [this.roomId, () => this.onJoinId()],
    ] as const) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') go();
      });
    }

    // Who the others will see.
    const identity = el('div', 'mp-identity');
    this.avatar.setAttribute('aria-hidden', 'true');
    const nameField = field(this.name, () => t.ui('room.playerName', 'Your name'), PLAYER_NAME_MAX);
    const seen = el('p', 'mp-identity-hint');
    show(seen, () => t.ui('room.seenAs', 'The others see this name above your character.'));
    const who = el('div', 'mp-identity-words');
    who.append(nameField, seen);
    identity.append(this.avatar, who);

    // Left: make a room, join one by its ID, the rooms played before.
    const createBox = el('div', 'multiplayer-box mp-card mp-create');
    const createHint = el('p', 'mp-card-hint');
    show(createHint, () =>
      t.ui('room.createHint', 'On this computer: everyone on the network sees it at once.'),
    );
    createBox.append(
      titled(() => t.ui('room.createTitle', 'Create a room'), '+'),
      createHint,
      field(this.roomName, () => t.ui('room.roomName', 'Room name'), ROOM_NAME_MAX),
      this.create,
    );
    const joinBox = el('div', 'multiplayer-box mp-card mp-join');
    joinBox.append(
      titled(() => t.ui('room.joinTitle', 'Join with a room ID'), '#'),
      field(this.roomId, () => t.ui('room.roomId', 'Room ID'), 6),
      this.joinById,
    );
    const savedTitle = el('h3', 'stage-section-title multiplayer-saved-title');
    const savedWords = el('span');
    show(savedWords, () => t.ui('room.yours', 'Rooms you played'));
    savedTitle.append(savedWords, this.savedCount);
    const side = el('div', 'mp-side');
    side.append(createBox, joinBox, savedTitle, this.saved);

    // Middle: the rooms open on the network.
    const browser = el('div', 'mp-browser');
    const listHead = el('div', 'multiplayer-list-head');
    const listTitle = el('h3', 'stage-section-title');
    const listWords = el('span');
    show(listWords, () => t.ui('room.open', 'Open rooms'));
    listTitle.append(listWords, this.openCount);
    listHead.append(listTitle, this.refresh);
    browser.append(listHead, this.list);

    const grid = el('div', 'mp-grid');
    grid.append(side, browser, this.selected);

    const head = stageHead(
      game,
      show,
      this.title,
      {
        eyebrow: () => t.ui('play.title', 'Play'),
        title: () => t.ui('room.title', 'Multiplayer'),
        lead: () =>
          t.ui('room.lead', 'A room on your network: talk, chat and run the experiments together.'),
      },
      onBack,
    );
    head.querySelector('.stage-words')?.append(this.lanPill);
    this.root.append(head, identity, this.current, grid, this.status);
    this.stopListening = rooms.onChange(() => this.render());
    this.render();
  }

  get open(): boolean {
    return !this.root.classList.contains('hidden');
  }

  dispose(): void {
    this.stopListening();
  }

  /** Buttons off while a room is being entered. */
  setBusy(on: boolean): void {
    this.busy = on;
    this.render();
  }

  /** Something to say under the page (why a room could not be entered). */
  say(text: string): void {
    this.status.textContent = text;
  }

  /** Redraws everything from what the room client last heard and the rooms kept here. */
  render(): void {
    const t = this.game.texts;
    const { peers } = this.game;
    const usable = this.rooms.available && !this.rooms.lost && !this.busy;
    for (const control of [this.name, this.roomName, this.roomId, this.create, this.joinById]) {
      control.disabled = !usable;
    }
    this.refresh.disabled = !usable;
    this.name.placeholder = this.character()
      ? t.of(this.character() as CharacterDefinition, 'displayName')
      : '';
    this.paintAvatar();

    const rooms = this.rooms.rooms;
    const live = this.rooms.available && !this.rooms.lost;
    this.lanPill.classList.toggle('live', live);
    this.lanPill.textContent = live
      ? t.ui('room.lanLive', 'Network · {n} rooms open', { n: rooms.length })
      : t.ui('play.multiOff', 'Room server not running');
    this.openCount.textContent = String(rooms.length);

    // In a room (back from play): its name, ID, who is in it; Play goes back in, or Leave.
    this.current.replaceChildren();
    this.current.classList.toggle('hidden', !peers.room);
    if (peers.room) {
      const room = peers.room;
      const dot = el('span', 'mp-live-dot');
      dot.setAttribute('aria-hidden', 'true');
      const line = el(
        'p',
        'multiplayer-in',
        t.ui('room.in', 'In room “{name}” · ID {id} · {n}/{max} players', {
          name: room.name,
          id: room.id,
          n: room.players,
          max: room.max,
        }),
      );
      const who = el(
        'p',
        'multiplayer-who',
        [this.name.value || '—', ...peers.players.map((p) => p.name)].join(' · '),
      );
      const words = el('div', 'mp-current-words');
      words.append(line, who);
      const play = el('button', 'menu-button primary', t.ui('room.play', 'Play'));
      play.disabled = !usable;
      play.addEventListener('click', () =>
        this.play({ kind: 'open', id: room.id, name: room.name }),
      );
      const leave = el('button', 'menu-button', t.ui('room.leave', 'Leave room'));
      leave.disabled = this.busy;
      leave.addEventListener('click', () => this.rooms.leave());
      const buttons = el('div', 'play-actions');
      buttons.append(play, leave);
      this.current.append(dot, words, buttons);
    }

    // The open rooms, as cards: choosing one shows it large with Play.
    this.list.replaceChildren();
    for (const room of rooms) {
      const chosen = this.choice?.kind === 'open' && this.choice.id === room.id;
      const item = el('li', `multiplayer-room${chosen ? ' chosen' : ''}`);
      const pick = el('button', 'multiplayer-room-pick');
      pick.type = 'button';
      pick.setAttribute('aria-pressed', String(chosen));
      pick.disabled = this.busy;
      const top = el('span', 'mp-room-top');
      top.append(el('span', 'multiplayer-room-name', room.name), this.where(room));
      pick.append(top, el('span', 'multiplayer-room-info', this.rowInfo(room)), pips(room));
      pick.addEventListener('click', () =>
        this.choose({ kind: 'open', id: room.id, name: room.name }),
      );
      item.append(pick);
      this.list.append(item);
    }
    if (rooms.length === 0) {
      const empty = el('li', 'multiplayer-empty mp-searching');
      const words = el('div');
      words.append(
        el('p', 'mp-searching-title', t.ui('room.none', 'No room is open yet.')),
        el(
          'p',
          'mp-searching-hint',
          live
            ? t.ui(
                'room.searching',
                'Searching the network… Make a room: the others see it at once.',
              )
            : t.ui('play.multiOff', 'Room server not running'),
        ),
      );
      empty.append(radarArt(), words);
      empty.classList.toggle('off', !live);
      this.list.append(empty);
    }

    // The rooms played before (each its own game): choose, or delete.
    this.saved.replaceChildren();
    const played = this.game.slots.list('room');
    this.savedCount.textContent = String(played.length);
    for (const slot of played) {
      const name = slot.room?.name ?? '';
      const chosen = this.choice?.kind === 'saved' && this.choice.slot.id === slot.id;
      const item = el('li', `multiplayer-room${chosen ? ' chosen' : ''}`);
      if (this.confirming === slot.id) {
        item.classList.add('confirming');
        const sure = el(
          'button',
          'menu-button danger multiplayer-small',
          t.ui('solo.delete', 'Delete'),
        );
        const no = el('button', 'menu-button multiplayer-small', t.ui('solo.cancel', 'Cancel'));
        sure.addEventListener('click', () => {
          this.game.slots.remove(slot.id);
          this.confirming = null;
          if (chosen) this.choice = null;
          this.render();
        });
        no.addEventListener('click', () => {
          this.confirming = null;
          this.render();
        });
        item.append(
          el(
            'span',
            'play-row-warn',
            t.ui('solo.confirm', 'Delete “{name}”? This cannot be undone.', { name }),
          ),
          sure,
          no,
        );
        this.saved.append(item);
        continue;
      }
      const pick = el('button', 'multiplayer-room-pick');
      pick.type = 'button';
      pick.setAttribute('aria-pressed', String(chosen));
      pick.disabled = this.busy;
      const open = this.openFor(slot);
      const top = el('span', 'mp-room-top');
      const state = el(
        'span',
        `mp-chip${open ? ' live' : ''}`,
        open ? t.ui('room.openNow', 'Open now') : playedAgo(this.game, slot.playedAt),
      );
      top.append(el('span', 'multiplayer-room-name', name), state);
      pick.append(
        top,
        el(
          'span',
          'multiplayer-room-info',
          t.ui('room.savedRow', 'Last ID {id} · played {when}', {
            id: slot.room?.id ?? '',
            when: playedWhen(this.game, slot.playedAt),
          }),
        ),
      );
      pick.addEventListener('click', () => this.choose({ kind: 'saved', slot }));
      const remove = el('button', 'menu-button multiplayer-small', t.ui('solo.delete', 'Delete'));
      remove.setAttribute('aria-label', `${t.ui('solo.delete', 'Delete')} ${name}`);
      remove.disabled = this.busy;
      remove.addEventListener('click', () => {
        this.confirming = slot.id;
        this.render();
      });
      item.append(pick, remove);
      this.saved.append(item);
    }
    if (played.length === 0) {
      this.saved.append(
        el('li', 'multiplayer-empty', t.ui('room.yoursNone', 'No room played yet.')),
      );
    }

    this.renderChoice(usable);

    this.status.textContent = !this.rooms.available
      ? t.ui(
          'room.unavailable',
          'Multiplayer needs the room server: start the game with “npm run preview:lan” (after npm run build) or “npm run dev:lan” on one computer, then open the address it shows on the others (same network).',
        )
      : this.rooms.lost
        ? t.ui('room.lost', 'The connection to the room server was lost: reload the page.')
        : this.refusalText(this.rooms.refusal);
  }

  /** The player's initial, in the avatar beside their name. */
  private paintAvatar(): void {
    const typed = this.name.value.trim() || this.name.placeholder;
    this.avatar.textContent = (typed.at(0) ?? '?').toUpperCase();
  }

  private rowInfo(room: LanRoom): string {
    return this.game.texts.ui('room.row', 'ID {id} · host {host} · {n}/{max}', {
      id: room.id,
      host: room.host,
      n: room.players,
      max: room.max,
    });
  }

  /** Where a room is: this computer, or another of the LAN by its name. */
  private where(room: LanRoom): HTMLElement {
    const t = this.game.texts;
    return room.server !== undefined
      ? el(
          'span',
          'mp-chip multiplayer-room-where',
          t.ui('room.lan', 'on {computer}', { computer: room.server }),
        )
      : el('span', 'mp-chip here', t.ui('room.here', 'This computer'));
  }

  /** The chosen room, large, with Play. */
  private renderChoice(usable: boolean): void {
    const t = this.game.texts;
    this.selected.replaceChildren();
    const choice = this.choice;
    // A room no longer open is no longer chosen.
    if (choice?.kind === 'open' && !this.rooms.rooms.some((r) => r.id === choice.id)) {
      this.choice = null;
    }
    if (choice?.kind === 'saved' && !this.game.slots.get(choice.slot.id)) this.choice = null;
    this.selected.classList.toggle('empty', !this.choice);
    if (!this.choice) {
      const art = el('div', 'multiplayer-selected-art');
      art.setAttribute('aria-hidden', 'true');
      this.selected.append(
        art,
        el('p', 'multiplayer-empty', t.ui('room.pick', 'Choose a room to see it here.')),
      );
      return;
    }
    const target = this.choice;
    const open =
      target.kind === 'open'
        ? this.rooms.rooms.find((r) => r.id === target.id)
        : target.kind === 'saved'
          ? this.openFor(target.slot)
          : undefined;
    const name = target.kind === 'saved' ? (target.slot.room?.name ?? '') : (open?.name ?? '');
    const info = open
      ? this.rowInfo(open)
      : t.ui('room.notOpen', 'Not open now: Play opens it again under this name.');
    const play = el('button', 'menu-button primary multiplayer-play', t.ui('room.play', 'Play'));
    play.disabled = !usable || (open !== undefined && open.players >= open.max);
    play.addEventListener('click', () => this.play(target));
    // The room's mark: its name's first letter in the ring.
    const art = el('div', 'multiplayer-selected-art', (name.trim().at(0) ?? '#').toUpperCase());
    art.setAttribute('aria-hidden', 'true');
    const kicker = el(
      'p',
      'solo-kicker',
      target.kind === 'saved'
        ? t.ui('room.yours', 'Rooms you played')
        : t.ui('room.open', 'Open rooms'),
    );
    this.selected.append(
      art,
      kicker,
      el('h3', 'multiplayer-selected-name', name),
      ...(open ? [this.where(open)] : []),
      el('p', 'multiplayer-selected-info', info),
      ...(open ? [pips(open)] : []),
      ...(target.kind === 'saved'
        ? [
            el(
              'p',
              'multiplayer-selected-info',
              t.ui('solo.played', 'Last played {when}', {
                when: playedWhen(this.game, target.slot.playedAt),
              }),
            ),
          ]
        : []),
      play,
    );
  }

  /** A played room's open room now: by its last ID, else by its name. */
  private openFor(slot: SaveSlot) {
    const lower = slot.room?.name.trim().toLowerCase();
    return (
      this.rooms.rooms.find((r) => r.id === slot.room?.id) ??
      this.rooms.rooms.find((r) => r.name.trim().toLowerCase() === lower)
    );
  }

  private choose(target: RoomTarget): void {
    this.choice = target;
    this.confirming = null;
    this.render();
    this.selected.querySelector<HTMLButtonElement>('.multiplayer-play')?.focus();
  }

  private play(target: RoomTarget): void {
    const player = this.player();
    if (player) this.onPlay(target, player);
  }

  private onCreate(): void {
    const room = RoomNameSchema.safeParse(this.roomName.value);
    if (!room.success) {
      this.say(this.game.texts.ui('room.needRoomName', 'Give the room a name.'));
      return;
    }
    this.play({ kind: 'create', name: room.data });
  }

  private onJoinId(): void {
    const roomId = RoomIdSchema.safeParse(this.roomId.value);
    if (!roomId.success) {
      this.say(this.game.texts.ui('room.badId', 'A room ID has 6 letters and digits.'));
      return;
    }
    this.play({ kind: 'id', id: roomId.data });
  }

  /** The player's name (their character's if left empty) and character, or null with a reason. */
  private player(): RoomPlayer | null {
    const character = this.character();
    if (!character) return null;
    const typed = this.name.value.trim() || this.game.texts.of(character, 'displayName');
    const name = PlayerNameSchema.safeParse(typed);
    if (!name.success) {
      this.say(this.game.texts.ui('room.needName', 'Type your name (up to 20 letters).'));
      return null;
    }
    keepName(this.name.value);
    return { name: name.data, character };
  }

  /** The words for a refused create or join. */
  refusalText(refusal: Refusal | null): string {
    const t = this.game.texts;
    switch (refusal) {
      case 'full':
        return t.ui('room.full', 'That room is full.');
      case 'unknown-room':
        return t.ui('room.unknown', 'No open room has that ID.');
      case 'too-many-rooms':
        return t.ui('room.tooMany', 'Too many rooms are open on this server.');
      case 'not-in-room':
      case 'taken':
      case null:
        return '';
    }
  }
}

/** The room's places: one pip a player, lit for each in it. */
function pips(room: LanRoom): HTMLElement {
  const row = el('span', 'mp-pips');
  row.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < room.max; i++) row.append(el('span', i < room.players ? 'on' : undefined));
  return row;
}

function storedName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

function keepName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    // Not kept: typed again next time.
  }
}
