import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useT } from '@/app/i18n';
import { closeGame, useGameStore } from './gameStore';
import './game.css';

/** The built game ships with the app's files (public/game, docs/GAME.md). */
const GAME_URL = `${import.meta.env.BASE_URL}game/index.html`;

/**
 * "SimLab 3D" over the whole window: a bar with the way back, then the game in a frame of the
 * same origin (its WebGL, sound and saves stay inside it). Closing removes the frame, so the
 * game's GPU context is freed; the focus goes back to the button that opened it.
 */
export function GameDialog() {
  const t = useT();
  const open = useGameStore((s) => s.open);
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      opener.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog game-dialog"
      aria-labelledby="game-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        closeGame();
      }}
    >
      <div className="game-dialog__bar">
        <button
          type="button"
          className="btn"
          onClick={() => {
            closeGame();
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('game.back')}
        </button>
        <h2 id="game-dialog-title" className="game-dialog__title">
          {t('game.title')}
        </h2>
        <span className="game-dialog__badge">{t('game.preview')}</span>
        <p className="game-dialog__note">{t('game.note')}</p>
      </div>
      {open && (
        <iframe
          className="game-dialog__frame"
          src={GAME_URL}
          title={t('game.frameTitle')}
          allow="fullscreen; gamepad"
        />
      )}
    </dialog>
  );
}
