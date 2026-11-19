import * as THREE from 'three';
import type { Anchor, PrologueView } from '../../wallpaper/prologue/Prologue';
import type { Notes } from '../../wallpaper/prologue/plan';
import { MOLECULES, SPECIES_AT } from '../../wallpaper/prologue/notes3d';
import type { Wallpaper } from '../../wallpaper/Wallpaper';
import { el, svg } from '../dom';
import type { RocketNotes, Row } from './rocketNotes';
import './rocketIntro.css';

/*
 * The rocket opening's notes on the page (Phú 2026-11-18), over the live wallpaper while it plays
 * its prologue: one subject's panel at a time, slammed in slanted, its rows after; leader lines
 * drawn in from what each note is about (the flame and its molecules, the centre of mass, Khoa,
 * the cabin's screens); labels by the molecules and the force arrows; how fast time runs; and a
 * Skip button in the corner.
 */

/** Where each species' label sits from its molecule (CSS px): reactants left, products right. */
const TAG_OFFSETS: [number, number][] = [
  [-150, -95],
  [-60, -175],
  [130, 90],
  [140, -110],
];
/** The drag's label shows while its arrow is longer than this (m; drawn ×10 it is ~4 m). */
const DRAG_LABEL_MIN = 1.5;

export class RocketOverlay {
  readonly root = el('div', 'rocket-overlay');
  private readonly lines = svg('svg', { class: 'rocket-lines', 'aria-hidden': 'true' });
  private readonly clock = el('div', 'rocket-clock');
  private readonly skipButton = el('button', 'rocket-skip');
  private readonly panels: Record<Notes, HTMLElement>;
  private readonly leaders: Record<Notes, SVGGElement>;
  private readonly speciesTags: HTMLElement[] = [];
  private readonly arrowTags: HTMLElement[] = [];
  private showing: Notes | null = null;
  private layoutDirty = false;
  private clockText = '';
  private readonly v = new THREE.Vector3();
  private readonly resize = () => (this.layoutDirty = true);

  constructor(
    private readonly notes: RocketNotes,
    onSkip: () => void,
  ) {
    this.root.setAttribute('aria-hidden', 'true');
    this.panels = { chem: this.chemPanel(), phys: this.physPanel(), bio: this.bioPanel() };
    this.leaders = {
      chem: svg('g', { class: 'rocket-leaders' }),
      phys: svg('g', { class: 'rocket-leaders' }),
      bio: svg('g', { class: 'rocket-leaders' }),
    };
    this.lines.append(this.leaders.chem, this.leaders.phys, this.leaders.bio);
    const tags = el('div', 'rocket-tags');
    notes.chem.species.forEach((sp) => {
      const tag = el('div', `rocket-tag ${sp.side}`);
      tag.append(
        el('b', undefined, sp.formula),
        el('span', undefined, sp.name),
        el('em', undefined, sp.rate),
      );
      this.speciesTags.push(tag);
      tags.append(tag);
    });
    const colors = notes.phys.rows.slice(0, 4).map((row) => row.swatch ?? '');
    notes.phys.tags.forEach((text, i) => {
      const tag = el('div', 'rocket-tag force', text);
      tag.style.setProperty('--swatch', colors[i] ?? '');
      this.arrowTags.push(tag);
      tags.append(tag);
    });
    this.skipButton.type = 'button';
    this.skipButton.removeAttribute('aria-hidden');
    this.skipButton.append(el('span', undefined, notes.skip), el('i', 'rocket-skip-arrow'));
    this.skipButton.addEventListener('click', (event) => {
      event.stopPropagation();
      onSkip();
    });
    this.root.append(
      this.lines,
      tags,
      this.panels.chem,
      this.panels.phys,
      this.panels.bio,
      this.clock,
      this.skipButton,
    );
    document.body.append(this.root);
    window.addEventListener('resize', this.resize);
    requestAnimationFrame(() => this.root.classList.add('playing'));
  }

  /** Per frame: the shot's notes on (their lines drawn once laid out), the labels placed. */
  update(p: PrologueView, wallpaper: Wallpaper): void {
    const shots = ['chem', 'phys', 'bio'] as const;
    const on = p.notes;
    if (on !== this.showing || this.layoutDirty) {
      for (const shot of shots) {
        this.panels[shot].classList.toggle('on', shot === on);
        this.leaders[shot].classList.toggle('on', shot === on);
      }
      if (on !== this.showing) this.speciesTags.forEach((tag) => tag.classList.remove('on'));
      this.showing = on;
      this.layoutDirty = false;
      if (on) this.drawLeaders(on, wallpaper);
    }
    const chem = on === 'chem' ? p.notesT : -1;
    SPECIES_AT.forEach((m, i) => {
      const tag = this.speciesTags[i];
      if (tag && chem >= (MOLECULES[m]?.enter ?? 0) + 0.2) tag.classList.add('on');
    });
    this.placeArrowTags(on === 'phys', wallpaper);
    const slow = p.scale < 0.98;
    this.clock.classList.toggle('on', slow);
    const text = this.notes.clock(p.scale);
    if (slow && text !== this.clockText) {
      this.clockText = text;
      this.clock.textContent = `⏱ ${text}`;
    }
  }

  /** The shot's leader lines: from what each note is about to its panel or its label. */
  private drawLeaders(shot: Notes, wallpaper: Wallpaper): void {
    const group = this.leaders[shot];
    group.replaceChildren();
    const panel = this.panels[shot];
    const box = {
      left: panel.offsetLeft,
      top: panel.offsetTop,
      right: panel.offsetLeft + panel.offsetWidth,
      bottom: panel.offsetTop + panel.offsetHeight,
    };
    const at = (name: Anchor): [number, number] | null => {
      const p = wallpaper.anchor(name, this.v);
      return p ? [p.x, p.y] : null;
    };
    if (shot === 'chem') {
      SPECIES_AT.forEach((m, i) => {
        const tag = this.speciesTags[i];
        const from = at(`molecule${i}`);
        if (!tag || !from) return;
        const out = this.notes.chem.species[i]?.side === 'out';
        const offset = TAG_OFFSETS[i] ?? [0, 0];
        const x = from[0] + offset[0];
        const y = from[1] + offset[1];
        tag.style.transform = `translate(${x}px, ${y}px) translate(${out ? '0' : '-100%'}, -50%)`;
        this.leader(group, from, [x, y], i * 0.12 + (MOLECULES[m]?.enter ?? 0));
      });
      const flame = at('flame');
      if (flame) this.leader(group, flame, [box.right, (box.top + box.bottom) / 2], 0.1);
    } else if (shot === 'phys') {
      const com = at('com');
      if (com) this.leader(group, com, [box.left, box.top + 40], 0.1);
    } else {
      const khoa = at('khoa');
      const cabin = at('cabin');
      const air = panel.querySelector<HTMLElement>('.rocket-air');
      if (cabin && air) this.leader(group, cabin, [box.right, box.top + air.offsetTop + 12], 0.35);
      if (khoa) this.leader(group, khoa, [box.right, box.bottom - 48], 0.15);
    }
  }

  /** A line with an elbow from a point to a place, drawn in after `delay` seconds. */
  private leader(group: SVGGElement, from: [number, number], to: [number, number], delay: number) {
    const elbow = from[0] + (to[0] - from[0]) * 0.35;
    const d = `M ${from[0]} ${from[1]} L ${elbow} ${to[1]} L ${to[0]} ${to[1]}`;
    const style = `--delay: ${delay.toFixed(2)}s`;
    group.append(
      svg('path', { d, class: 'under', pathLength: 1, style }),
      svg('path', { d, class: 'ink', pathLength: 1, style }),
      svg('circle', { cx: from[0], cy: from[1], r: 6, class: 'dot', style }),
    );
  }

  /** The forces' labels beside their arrows, following them as they are added tip to tail. */
  private placeArrowTags(on: boolean, wallpaper: Wallpaper): void {
    this.arrowTags.forEach((tag, i) => {
      const at = on ? wallpaper.anchor(`arrow${i}`, this.v) : null;
      const vec = on ? wallpaper.arrowVector(i) : null;
      if (!at || !vec) {
        tag.classList.remove('on');
        return;
      }
      // The drag's own label only while it is drawn ×10, before the sum.
      const shown = i !== 2 || vec.length() > DRAG_LABEL_MIN;
      tag.classList.toggle('on', shown);
      if (!shown) return;
      // Beside the arrow (screen), on its right; the sum's on its left.
      const len = Math.hypot(vec.x, vec.y) || 1;
      const side = i === 3 ? -1 : 1;
      const px = (vec.y / len) * side;
      const py = (vec.x / len) * side;
      const x = at.x + px * 22;
      const y = at.y + py * 22;
      tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${px >= 0 ? '0' : '-100%'}, -50%)`;
    });
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.root.classList.add('leaving');
    window.setTimeout(() => this.root.remove(), 400);
  }

  // --- the panels --------------------------------------------------------------------------

  private head(subject: string, title: string, extra?: string): HTMLElement {
    const head = el('div', 'rocket-head');
    head.append(el('span', 'rocket-subject', subject), el('span', 'rocket-title', title));
    if (extra) head.append(el('span', 'rocket-badge', extra));
    return head;
  }

  private rows(rows: readonly Row[], from = 0): HTMLElement {
    const list = el('div', 'rocket-rows');
    rows.forEach((row, i) => {
      const line = el('div', 'rocket-row');
      line.style.setProperty('--i', String(from + i));
      const label = el('span', 'rocket-label', row.label);
      if (row.swatch) {
        const swatch = el('i', 'rocket-swatch');
        swatch.style.background = row.swatch;
        label.prepend(swatch);
      }
      const value = el('span', 'rocket-value', row.value);
      if (row.angle !== undefined) {
        const arrow = el('i', 'rocket-dir');
        arrow.style.transform = `rotate(${row.angle.toFixed(1)}deg)`;
        value.append(arrow);
      }
      line.append(label, value);
      list.append(line);
    });
    return list;
  }

  private chemPanel(): HTMLElement {
    const c = this.notes.chem;
    const panel = el('div', 'rocket-panel chem');
    panel.append(
      this.head(c.subject, c.title),
      el('div', 'rocket-eq', c.equation),
      this.rows(c.rows, 1),
      el('div', 'rocket-note', c.note),
    );
    return panel;
  }

  private physPanel(): HTMLElement {
    const p = this.notes.phys;
    const panel = el('div', 'rocket-panel phys');
    panel.append(
      this.head(p.subject, p.title),
      this.rows(p.rows),
      el('div', 'rocket-note', p.note),
    );
    return panel;
  }

  private bioPanel(): HTMLElement {
    const b = this.notes.bio;
    const panel = el('div', 'rocket-panel bio');
    const body = el('div', 'rocket-bio');
    const vitals = el('div', 'rocket-vitals');
    vitals.append(ecg(), this.rows(b.vitals));
    const air = el('div', 'rocket-air');
    air.append(el('div', 'rocket-air-title', b.airTitle));
    b.air.forEach((gas, i) => {
      const line = el('div', 'rocket-gas');
      line.style.setProperty('--i', String(i + 2));
      const bar = el('div', 'rocket-bar');
      const fill = el('i');
      fill.style.background = gas.color;
      // The smallest shares still seen as a sliver.
      fill.style.setProperty('--share', String(Math.max(gas.share, 0.012)));
      bar.append(fill);
      line.append(el('span', undefined, gas.text), bar);
      air.append(line);
    });
    air.append(this.rows(b.airRows, 6));
    body.append(vitals, air);
    panel.append(
      this.head(b.subject, b.title, b.illustrative),
      body,
      el('div', 'rocket-note', b.note),
    );
    return panel;
  }
}

/** An illustrative heart trace (PQRST) at the vitals' rate: drawn in, not live. */
function ecg(): SVGSVGElement {
  const width = 220;
  const height = 44;
  const beat = 60 / 118;
  const seconds = 2.4;
  const points: string[] = [];
  for (let i = 0; i <= 240; i++) {
    const t = (i / 240) * seconds;
    const p = (t % beat) / beat;
    const bump = (c: number, w: number, a: number) => a * Math.exp(-(((p - c) / w) ** 2));
    const y =
      bump(0.18, 0.035, 0.12) -
      bump(0.3, 0.008, 0.12) +
      bump(0.32, 0.012, 1) -
      bump(0.345, 0.01, 0.25) +
      bump(0.58, 0.05, 0.22);
    points.push(
      `${((i / 240) * width).toFixed(1)},${(height * 0.7 - y * height * 0.6).toFixed(1)}`,
    );
  }
  const box = svg('svg', { class: 'rocket-ecg', viewBox: `0 0 ${width} ${height}` });
  box.append(svg('polyline', { points: points.join(' '), pathLength: 1 }));
  return box;
}
