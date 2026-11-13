import * as THREE from 'three';
import type { Game } from '../../game/Game';
import { decimalComma, layoutFormula } from '../../core/formula';
import { boardArea, lineWidth } from '../../gameplay/npc/board';
import { drawFormula } from './formulaCanvas';
import type { BoardView } from '../../gameplay/npc/NpcSystem';

/** Canvas pixels per metre of board. */
const PX_PER_M = 900;
/** A letter's height per line, and where its baseline sits in the line. */
const LETTER = 0.74;
const BASELINE = 0.8;
/** Blue marker; the answer in red. */
const INK = '#1c3a8a';
const ANSWER = '#b42318';
const FONT = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";
const hand = (px: number) => `${px.toFixed(1)}px ${FONT}`;
/** How far a line may be stretched or squeezed to land where the teacher's hand wrote it. */
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.4;

/**
 * What the hub's teacher writes on a board (Phase Y-3): the NpcSystem's board lines, as many
 * letters of each as he has written, in a marker hand on the board's face — the title underlined,
 * the answer in red. Each line is fitted to the width his hand moved over (`gameplay/npc/board`),
 * so the ink appears under the pen. One canvas, drawn again only when the writing changes; it stays
 * after the lesson (a board keeps what is written) until another is written or its room goes.
 * `holder` stands at the board: the camera frames it during a lesson.
 */
export class BoardWriting {
  readonly holder = new THREE.Group();
  /** Made when something is first written (none before: nothing to draw). */
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private texture: THREE.CanvasTexture | null = null;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly mesh: THREE.Mesh;
  private version = -1;
  private boardId: string | null = null;
  private lines = -1;

  constructor(
    parent: THREE.Object3D,
    private readonly game: Game,
  ) {
    this.material = new THREE.MeshStandardMaterial({
      transparent: true,
      depthWrite: false,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.name = 'board-writing';
    this.holder.name = 'board';
    this.holder.add(this.mesh);
    this.holder.visible = false;
    parent.add(this.holder);
  }

  update(): void {
    const view = this.game.npcs.board;
    const entity = view.boardId === null ? undefined : this.game.world.entity(view.boardId);
    if (!entity || !this.ready()) {
      this.holder.visible = false;
      this.boardId = null;
      return;
    }
    // Where the board is (its scene may have come back in at another place).
    const [x, y, z] = entity.pose.position;
    const [qx, qy, qz, qw] = entity.pose.rotation;
    this.holder.position.set(x, y, z);
    this.holder.quaternion.set(qx, qy, qz, qw);
    this.holder.visible = true;
    if (view.boardId === this.boardId && view.version === this.version) return;
    const size = entity.item.visual.size;
    const area = boardArea(size, view.lines.length);
    if (view.boardId !== this.boardId || view.lines.length !== this.lines) {
      this.boardId = view.boardId;
      this.lines = view.lines.length;
      const canvas = this.canvas as HTMLCanvasElement;
      canvas.width = Math.round(area.width * PX_PER_M);
      canvas.height = Math.round(area.height * PX_PER_M);
      this.mesh.scale.set(area.width, area.height, 1);
      this.mesh.position.set(area.left + area.width / 2, area.top - area.height / 2, area.face);
    }
    this.version = view.version;
    this.draw(view, area);
    if (this.texture) this.texture.needsUpdate = true;
  }

  /** The canvas and its texture, made the first time a board is written on; false without a 2D canvas. */
  private ready(): boolean {
    if (this.context) return true;
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    if (!this.context) return false;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    return true;
  }

  dispose(): void {
    this.holder.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture?.dispose();
  }

  private draw(view: Readonly<BoardView>, area: ReturnType<typeof boardArea>): void {
    const c = this.context;
    if (!c) return;
    const canvas = this.canvas;
    if (!canvas) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    const lineH = area.lineHeight * PX_PER_M;
    const size = LETTER * lineH;
    c.textBaseline = 'alphabetic';
    c.lineCap = 'round';
    const { lines, shown } = view;
    // As a teacher writes: subscripts, exponents, fractions (core/formula); 0,5 in Vietnamese.
    const vi = this.game.language === 'vi';
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i] ?? '';
      const n = Math.min(text.length, shown[i] ?? 0);
      if (n <= 0) continue;
      const items = layoutFormula(vi ? decimalComma(text) : text);
      const answer = i >= view.answer && lines.length > 3;
      c.fillStyle = answer ? ANSWER : INK;
      c.strokeStyle = c.fillStyle;
      // Fitted to the width the hand moved over, so the letters land under the pen.
      const width = drawFormula(c, items, hand, size, 0, 0, Infinity, false) || 1;
      const scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, (lineWidth(area, text.length) * PX_PER_M) / width),
      );
      const baseline = (i + BASELINE) * lineH;
      c.save();
      c.translate(0, baseline);
      c.scale(Math.min(scale, (area.width * PX_PER_M) / width), 1);
      drawFormula(c, items, hand, size, 0, 0, n, true);
      if (i < view.title && n === text.length) {
        // The title underlined.
        c.lineWidth = Math.max(2, lineH * 0.04);
        c.beginPath();
        c.moveTo(0, lineH * 0.12);
        c.lineTo(width, lineH * 0.12);
        c.stroke();
      }
      c.restore();
    }
  }
}
