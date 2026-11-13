import * as THREE from 'three';
import type { Game } from '../../game/Game';
import { MARKS_SHOWN, progressSummary, type Subject } from '../../game/progressSummary';
import type { TopicDefinition } from '../../simulation/experiment';

/** The screen inside the display board's frame (props/hub.ts `board`: 3 cm of frame a side). */
const FRAME_M = 0.03;
/** Canvas pixels per metre of screen: ~2000 px across the 4.3 m board. */
const PX_PER_M = 470;
/** How often (s) what it shows is worked out again (drawn only when it changed). */
const LOOK_S = 1;
const FONT = "'Segoe UI', system-ui, sans-serif";
const INK = '#eef4fa';
const DIM = '#9fb0c0';
const PANEL = '#121b26';
const SCREEN = '#0b121b';
const GRID = 'rgba(159, 176, 192, 0.25)';
const COLOUR: Record<TopicDefinition['subject'], string> = {
  physics: '#4ea8ff',
  chemistry: '#ff9f43',
  biology: '#4cd38a',
  interdisciplinary: '#b892ff',
};

/**
 * The hub's learning progress board (Phú, 2026-11-10): from the save alone (`progressSummary`) —
 * experiments done per subject as bars, the teacher's paper marks as a chart with their mean, the
 * topics learned, the guided tasks, and the next experiment to do. One canvas on the board's
 * screen, a glowing display (unlit), drawn again only when what it shows changes; looked at once a
 * second while the hub is resident, never otherwise.
 */
export class ProgressBoard {
  private readonly holder = new THREE.Group();
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private texture: THREE.CanvasTexture | null = null;
  private readonly material = new THREE.MeshBasicMaterial({ toneMapped: false });
  private readonly mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
  private boardId: string | null = null;
  private shown = '';
  private since = Infinity;

  constructor(
    parent: THREE.Object3D,
    private readonly game: Game,
  ) {
    this.mesh.name = 'progress-board-screen';
    this.holder.name = 'progress-board';
    this.holder.add(this.mesh);
    this.holder.visible = false;
    parent.add(this.holder);
  }

  update(dt: number): void {
    this.since += dt;
    if (this.since < LOOK_S) return;
    this.since = 0;
    const entity = this.find();
    if (!entity) {
      this.holder.visible = false;
      this.boardId = null;
      return;
    }
    const [w, h, d] = entity.item.visual.size;
    if (entity.id !== this.boardId) {
      this.boardId = entity.id;
      this.shown = '';
      const [width, height] = [w - 2 * FRAME_M, h - 2 * FRAME_M];
      if (!this.ready(width, height)) return;
      this.mesh.scale.set(width, height, 1);
      // The pose is the box centre; the panel's face (props/hub.ts `board`), a hair before it.
      this.mesh.position.set(0, 0, -d / 2 + 0.03 + 0.003);
    }
    // Where the board is (its scene may have come back in at another place).
    const [x, y, z] = entity.pose.position;
    const [qx, qy, qz, qw] = entity.pose.rotation;
    this.holder.position.set(x, y, z);
    this.holder.quaternion.set(qx, qy, qz, qw);
    this.holder.visible = true;
    const summary = progressSummary(this.game.content, this.game.state.progression);
    const key = JSON.stringify([
      this.game.language,
      summary.subjects,
      summary.topicsDone.map((t) => t.id),
      summary.topicsStarted,
      summary.marks,
      summary.papers,
      summary.tasks,
      summary.next?.experiment.id,
    ]);
    if (key === this.shown) return;
    this.shown = key;
    this.draw(summary);
    if (this.texture) this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.holder.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture?.dispose();
  }

  private find() {
    for (const entity of this.game.world.allEntities()) {
      if (entity.item.tags.includes('progress-board')) return entity;
    }
    return undefined;
  }

  /** The canvas and its texture, made the first time a board is found; false without a 2D canvas. */
  private ready(width: number, height: number): boolean {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d');
      if (!this.context) return false;
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.anisotropy = 4;
      this.material.map = this.texture;
      this.material.needsUpdate = true;
    }
    this.canvas.width = Math.round(width * PX_PER_M);
    this.canvas.height = Math.round(height * PX_PER_M);
    return this.context !== null;
  }

  private draw(s: ReturnType<typeof progressSummary>): void {
    const c = this.context;
    const canvas = this.canvas;
    if (!c || !canvas) return;
    const t = this.game.texts;
    const W = canvas.width;
    const H = canvas.height;
    const u = W / 100; // one hundredth of the width
    c.fillStyle = SCREEN;
    c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';
    // Every line kept inside its panel: a line too long is narrowed to fit (`maxWidth`).
    const text = (
      s: string,
      x: number,
      y: number,
      size: number,
      colour = INK,
      weight = 400,
      width = 41 * u,
    ) => {
      c.font = `${weight} ${Math.round(size * u)}px ${FONT}`;
      c.fillStyle = colour;
      c.fillText(s, x, y, width);
    };
    /** `s` broken into lines of at most `width` px at the current font (words kept whole). */
    const wrap = (s: string, width: number): string[] => {
      const lines: string[] = [];
      let line = '';
      for (const word of s.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && c.measureText(next).width > width) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      return lines;
    };
    const panel = (x: number, y: number, w: number, h: number, title: string) => {
      c.fillStyle = PANEL;
      c.beginPath();
      c.roundRect(x, y, w, h, u);
      c.fill();
      text(title, x + 2 * u, y + 4.2 * u, 2.2, DIM, 600);
    };

    // Title and the totals.
    text(t.ui('progressBoard.title', 'Learning progress'), 3 * u, 6.5 * u, 4.4, INK, 700);
    const totals =
      s.experiments.total > 0
        ? t.ui('progressBoard.totals', '{done} of {total} experiments · {topics} of {all} topics', {
            done: s.experiments.done,
            total: s.experiments.total,
            topics: s.topicsDone.length,
            all: s.topicsTotal,
          })
        : t.ui('progressBoard.loading', 'Loading the experiments…');
    c.textAlign = 'right';
    text(totals, 97 * u, 6.5 * u, 2.4, DIM);
    c.textAlign = 'left';

    // Experiments done by subject: a bar each.
    const top = 9.5 * u;
    panel(3 * u, top, 45 * u, 21 * u, t.ui('progressBoard.experiments', 'Experiments done'));
    const names: Record<Subject, string> = {
      physics: t.ui('progressBoard.physics', 'Physics'),
      chemistry: t.ui('progressBoard.chemistry', 'Chemistry'),
      biology: t.ui('progressBoard.biology', 'Biology'),
    };
    s.subjects.forEach(({ subject, done, total }, i) => {
      const y = top + 8.5 * u + i * 4.3 * u;
      text(names[subject], 5 * u, y + 1.6 * u, 2.2);
      const [bx, bw, bh] = [18 * u, 22 * u, 2.2 * u];
      c.fillStyle = GRID;
      c.fillRect(bx, y - 0.2 * u, bw, bh);
      c.fillStyle = COLOUR[subject];
      c.fillRect(bx, y - 0.2 * u, total > 0 ? (bw * done) / total : 0, bh);
      text(`${done}/${total}`, 41 * u, y + 1.6 * u, 2.2, DIM);
    });

    // The papers' marks: a bar each (out of 10), the mean as a line.
    panel(52 * u, top, 45 * u, 21 * u, t.ui('progressBoard.marks', 'Test marks (out of 10)'));
    const [cx, cy, cw, ch] = [56 * u, top + 7 * u, 38 * u, 10.5 * u];
    c.strokeStyle = GRID;
    c.lineWidth = Math.max(1, u * 0.12);
    for (const k of [0, 5, 10]) {
      const y = cy + ch - (ch * k) / 10;
      c.beginPath();
      c.moveTo(cx, y);
      c.lineTo(cx + cw, y);
      c.stroke();
      c.textAlign = 'right';
      text(String(k), cx - 0.8 * u, y + 0.6 * u, 1.6, DIM);
      c.textAlign = 'left';
    }
    if (s.marks.length === 0) {
      c.textAlign = 'center';
      text(
        t.ui('progressBoard.noMarks', 'No paper marked yet: ask the teacher for a test.'),
        cx + cw / 2,
        cy + ch / 2,
        1.9,
        DIM,
      );
      c.textAlign = 'left';
    } else {
      const slot = cw / MARKS_SHOWN;
      s.marks.forEach((mark, i) => {
        const bh = (ch * mark) / 10;
        c.fillStyle = mark >= 8 ? '#4cd38a' : mark >= 5 ? '#4ea8ff' : '#ff6b6b';
        c.fillRect(cx + i * slot + slot * 0.18, cy + ch - bh, slot * 0.64, bh);
      });
      if (s.average !== null) {
        const y = cy + ch - (ch * s.average) / 10;
        c.strokeStyle = '#ffd166';
        c.lineWidth = Math.max(2, u * 0.25);
        c.setLineDash([u, 0.6 * u]);
        c.beginPath();
        c.moveTo(cx, y);
        c.lineTo(cx + cw, y);
        c.stroke();
        c.setLineDash([]);
      }
      text(
        t.ui('progressBoard.markStats', '{papers} papers · mean {mean} · best {best}', {
          papers: s.papers,
          mean: (s.average ?? 0).toFixed(1),
          best: (s.best ?? 0).toFixed(1),
        }),
        cx,
        cy + ch + 2.6 * u,
        1.9,
        DIM,
      );
    }

    // Topics learned (every experiment of the topic done).
    const low = top + 23.5 * u;
    const rows = H - low - 3 * u;
    panel(3 * u, low, 45 * u, rows, t.ui('progressBoard.topics', 'Topics learned'));
    if (s.topicsDone.length === 0) {
      text(
        t.ui('progressBoard.noTopics', 'None yet: finish every experiment of a topic.'),
        5 * u,
        low + 9 * u,
        2,
        DIM,
      );
    } else {
      const fit = Math.max(1, Math.floor((rows - 7 * u) / (3.2 * u)));
      s.topicsDone.slice(0, fit).forEach((topic, i) => {
        c.fillStyle = COLOUR[topic.subject];
        c.beginPath();
        c.arc(6 * u, low + 8.4 * u + i * 3.2 * u, 0.7 * u, 0, Math.PI * 2);
        c.fill();
        text(t.of(topic, 'name'), 8 * u, low + 9.1 * u + i * 3.2 * u, 2);
      });
      if (s.topicsDone.length > fit) {
        text(
          t.ui('progressBoard.more', '+{n} more', { n: s.topicsDone.length - fit }),
          36 * u,
          low + 4.2 * u,
          1.9,
          DIM,
        );
      }
    }
    text(
      t.ui('progressBoard.started', '{n} topics started', { n: s.topicsStarted }),
      5 * u,
      low + rows - 2 * u,
      1.8,
      DIM,
    );

    // What to do next, and the guided tasks.
    panel(52 * u, low, 45 * u, rows, t.ui('progressBoard.next', 'Next step'));
    if (s.next) {
      // Its name on two lines at most (the longest names are about 70 letters).
      c.font = `600 ${Math.round(2.4 * u)}px ${FONT}`;
      const lines = wrap(t.of(s.next.experiment, 'name'), 41 * u).slice(0, 2);
      lines.forEach((line, i) => {
        text(line, 54 * u, low + 9.5 * u + i * 3 * u, 2.4, INK, 600);
      });
      text(
        t.ui('progressBoard.inTopic', 'in the topic “{topic}”', {
          topic: t.of(s.next.topic, 'name'),
        }),
        54 * u,
        low + 10.2 * u + lines.length * 3 * u,
        2,
        DIM,
      );
    } else if (s.experiments.total > 0) {
      text(t.ui('progressBoard.allDone', 'Every experiment done!'), 54 * u, low + 10 * u, 2.4);
    }
    text(
      t.ui('progressBoard.tasks', 'Guided tasks: {done} of {total}', s.tasks),
      54 * u,
      low + rows - 2 * u,
      1.9,
      DIM,
    );
  }
}
